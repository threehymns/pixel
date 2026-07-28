import { deflate, inflate } from 'pako';
import { ProjectState, Layer, Frame, PixelGrid, PixelValue } from '../types';
import { rgbToHex, hexToRgb } from '../utils';

// Helper to convert UTF-8 string to Uint8Array with 2-byte length prefix
function encodeString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const result = new Uint8Array(2 + bytes.length);
  result[0] = bytes.length & 0xff;
  result[1] = (bytes.length >> 8) & 0xff;
  result.set(bytes, 2);
  return result;
}

// Helper to read 2-byte length UTF-8 string
function decodeString(view: DataView, offset: number): { str: string; length: number } {
  const len = view.getUint16(offset, true);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset + 2, len);
  const decoder = new TextDecoder('utf-8');
  return { str: decoder.decode(bytes), length: 2 + len };
}

// Blend mode mapping for Aseprite
const BLEND_MODE_MAP: Record<string, number> = {
  'normal': 0,
  'multiply': 1,
  'screen': 2,
  'overlay': 3,
  'darken': 4,
  'lighten': 5,
  'color-dodge': 6,
  'color-burn': 7,
  'hard-light': 8,
  'soft-light': 9,
  'difference': 10,
  'exclusion': 11,
  'hue': 12,
  'saturation': 13,
  'color': 14,
  'luminosity': 15,
  'addition': 16,
  'subtract': 17,
  'divide': 18
};

const REVERSE_BLEND_MODE_MAP: Record<number, string> = {
  0: 'normal',
  1: 'multiply',
  2: 'screen',
  3: 'overlay',
  4: 'darken',
  5: 'lighten',
  6: 'color-dodge',
  7: 'color-burn',
  8: 'hard-light',
  9: 'soft-light',
  10: 'difference',
  11: 'exclusion',
  12: 'hue',
  13: 'saturation',
  14: 'color',
  15: 'luminosity',
  16: 'addition',
  17: 'subtract',
  18: 'divide'
};

/**
 * Encodes a ProjectState into Aseprite (.aseprite / .ase) binary format.
 */
export function encodeAseprite(state: ProjectState): Uint8Array {
  const isIndexed = state.colorMode === 'indexed';
  const width = state.width;
  const height = state.height;
  const numFrames = Math.max(1, state.frames.length);

  // Build full palette list
  const paletteHexList = state.palette && state.palette.length > 0 
    ? state.palette 
    : ['#000000', '#ffffff'];

  // Map palette colors for indexed mode lookup
  const paletteColorMap = new Map<string, number>();
  paletteHexList.forEach((hex, idx) => {
    paletteColorMap.set(hex.toLowerCase(), idx);
  });

  const frameChunksBuffers: Uint8Array[][] = [];

  for (let f = 0; f < numFrames; f++) {
    const frame = state.frames[f] || { id: `frame-${f}`, layerData: {} };
    const chunks: Uint8Array[] = [];

    // Frame 0 contains metadata chunks (Layer Chunks & Palette Chunk)
    if (f === 0) {
      // 1. Layer Chunks (Type 0x2004)
      state.layers.forEach((layer) => {
        const nameBytes = encodeString(layer.name || 'Layer');
        const payloadLen = 18 + nameBytes.length;
        const chunkSize = 6 + payloadLen;
        const buf = new Uint8Array(chunkSize);
        const view = new DataView(buf.buffer);

        view.setUint32(0, chunkSize, true);
        view.setUint16(4, 0x2004, true); // Chunk Type

        // Flags: 1 = visible, 2 = editable
        let flags = 0;
        if (layer.visible !== false) flags |= 1;
        if (!layer.locked) flags |= 2;
        view.setUint16(6, flags, true);

        view.setUint16(8, 0, true); // Layer type (0 = Normal)
        view.setUint16(10, 0, true); // Child level
        view.setUint16(12, 0, true); // Default width
        view.setUint16(14, 0, true); // Default height
        
        const blendModeInt = BLEND_MODE_MAP[layer.blendMode || 'normal'] ?? 0;
        view.setUint16(16, blendModeInt, true); // Blend mode

        const opacityByte = Math.round(((layer.opacity ?? 100) / 100) * 255);
        view.setUint8(18, opacityByte); // Opacity
        // Bytes 19-21 reserved

        buf.set(nameBytes, 24);
        chunks.push(buf);
      });

      // 2. Palette Chunk (Type 0x2019)
      const numColors = paletteHexList.length;
      const palettePayloadLen = 20 + numColors * 6;
      const paletteChunkSize = 6 + palettePayloadLen;
      const pBuf = new Uint8Array(paletteChunkSize);
      const pView = new DataView(pBuf.buffer);

      pView.setUint32(0, paletteChunkSize, true);
      pView.setUint16(4, 0x2019, true); // Palette Chunk Type

      pView.setUint32(6, numColors, true); // Palette size
      pView.setUint32(10, 0, true); // First color index
      pView.setUint32(14, Math.max(0, numColors - 1), true); // Last color index
      // Bytes 18-25 reserved (0)

      let pOffset = 26;
      paletteHexList.forEach((hex) => {
        pView.setUint16(pOffset, 0, true); // Color flags (no name)
        const [r, g, b] = hexToRgb(hex);
        pView.setUint8(pOffset + 2, r);
        pView.setUint8(pOffset + 3, g);
        pView.setUint8(pOffset + 4, b);
        pView.setUint8(pOffset + 5, 255); // Alpha
        pOffset += 6;
      });

      chunks.push(pBuf);
    }

    // 3. Cel Chunks (Type 0x2005) for each layer in this frame
    state.layers.forEach((layer, layerIdx) => {
      const grid = frame.layerData[layer.id];
      if (!grid) return; // No pixels on this layer for this frame

      // Construct uncompressed pixel buffer
      let uncompressedPixels: Uint8Array;

      if (isIndexed) {
        uncompressedPixels = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
          const val = grid[i];
          if (val === null || val === undefined) {
            uncompressedPixels[i] = 0; // Transparent index
          } else if (typeof val === 'number') {
            uncompressedPixels[i] = val;
          } else {
            const idx = paletteColorMap.get(val.toLowerCase());
            uncompressedPixels[i] = idx !== undefined ? idx : 0;
          }
        }
      } else {
        // 32 bpp RGBA
        uncompressedPixels = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const val = grid[i];
          const byteIdx = i * 4;
          if (val === null || val === undefined) {
            uncompressedPixels[byteIdx] = 0;
            uncompressedPixels[byteIdx + 1] = 0;
            uncompressedPixels[byteIdx + 2] = 0;
            uncompressedPixels[byteIdx + 3] = 0;
          } else {
            const hexColor = typeof val === 'number' ? (paletteHexList[val] || '#000000') : val;
            const [r, g, b] = hexToRgb(hexColor);
            uncompressedPixels[byteIdx] = r;
            uncompressedPixels[byteIdx + 1] = g;
            uncompressedPixels[byteIdx + 2] = b;
            uncompressedPixels[byteIdx + 3] = 255;
          }
        }
      }

      // Compress pixels with zlib
      const compressedPixels = deflate(uncompressedPixels);

      // Payload size: 2(layerIdx) + 2(x) + 2(y) + 1(opacity) + 2(celType=2) + 2(zIndex) + 5(reserved) + 2(width) + 2(height) + compressedPixels.length = 20 + compressedPixels.length
      const payloadLen = 20 + compressedPixels.length;
      const chunkSize = 6 + payloadLen;
      const celBuf = new Uint8Array(chunkSize);
      const celView = new DataView(celBuf.buffer);

      celView.setUint32(0, chunkSize, true);
      celView.setUint16(4, 0x2005, true); // Cel Chunk Type

      celView.setUint16(6, layerIdx, true); // Layer index
      celView.setInt16(8, 0, true); // X position
      celView.setInt16(10, 0, true); // Y position
      celView.setUint8(12, 255); // Opacity
      celView.setUint16(13, 2, true); // Cel Type 2 (Compressed Image)
      celView.setInt16(15, 0, true); // Z-Index
      // Bytes 17-21 reserved (0)

      celView.setUint16(22, width, true); // Cel width
      celView.setUint16(24, height, true); // Cel height

      celBuf.set(compressedPixels, 26);
      chunks.push(celBuf);
    });

    frameChunksBuffers.push(chunks);
  }

  // Calculate total file size and frame offsets
  let totalFileSize = 128; // Header
  const frameSizes: number[] = [];

  frameChunksBuffers.forEach((chunks) => {
    let chunksSizeSum = 0;
    chunks.forEach((c) => (chunksSizeSum += c.length));
    const frameTotalSize = 16 + chunksSizeSum; // 16-byte frame header + chunks
    frameSizes.push(frameTotalSize);
    totalFileSize += frameTotalSize;
  });

  // Create full binary output buffer
  const fileBuf = new Uint8Array(totalFileSize);
  const view = new DataView(fileBuf.buffer);

  // --- WRITE FILE HEADER (128 bytes) ---
  view.setUint32(0, totalFileSize, true);
  view.setUint16(4, 0xA5E0, true); // Magic Number 0xA5E0
  view.setUint16(6, numFrames, true);
  view.setUint16(8, width, true);
  view.setUint16(10, height, true);
  view.setUint16(12, isIndexed ? 8 : 32, true); // Color depth
  view.setUint32(14, 1, true); // Flags (1 = layer opacity valid)
  view.setUint16(18, 100, true); // Speed (deprecated)
  // Bytes 20-27 reserved
  view.setUint8(28, 0); // Transparent index
  // Bytes 29-31 reserved
  view.setUint16(32, paletteHexList.length, true); // Number of colors
  view.setUint8(34, 1); // Pixel width
  view.setUint8(35, 1); // Pixel height
  view.setUint16(36, 0, true); // Grid X
  view.setUint16(38, 0, true); // Grid Y
  view.setUint16(40, 16, true); // Grid Width
  view.setUint16(42, 16, true); // Grid Height
  // Bytes 44-127 reserved (0)

  // --- WRITE FRAMES ---
  let offset = 128;
  for (let f = 0; f < numFrames; f++) {
    const chunks = frameChunksBuffers[f];
    const frameSize = frameSizes[f];
    const chunkCount = chunks.length;

    // Write Frame Header (16 bytes)
    view.setUint32(offset, frameSize, true);
    view.setUint16(offset + 4, 0xF1FA, true); // Frame Magic 0xF1FA
    view.setUint16(offset + 6, chunkCount > 0xffff ? 0xffff : chunkCount, true); // Old chunk count
    view.setUint16(offset + 8, 100, true); // Frame duration ms
    // Bytes 10-11 reserved
    view.setUint32(offset + 12, chunkCount, true); // New chunk count

    offset += 16;

    // Write Chunks
    chunks.forEach((cBuf) => {
      fileBuf.set(cBuf, offset);
      offset += cBuf.length;
    });
  }

  return fileBuf;
}

/**
 * Parses an Aseprite (.aseprite / .ase) binary file buffer into a ProjectState.
 */
export function parseAseprite(buffer: ArrayBuffer, fileName?: string): ProjectState {
  const view = new DataView(buffer);
  const fileSize = view.getUint32(0, true);
  const magic = view.getUint16(4, true);

  if (magic !== 0xA5E0) {
    throw new Error(`Invalid Aseprite file: Magic 0x${magic.toString(16).toUpperCase()} does not match 0xA5E0`);
  }

  const numFrames = view.getUint16(6, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  const colorDepth = view.getUint16(12, true); // 32 = RGBA, 8 = Indexed
  const transparentIndex = view.getUint8(28);

  const layers: Layer[] = [];
  let palette: string[] = [];
  const frames: Frame[] = [];

  let offset = 128; // Start after 128-byte main header

  for (let f = 0; f < numFrames; f++) {
    if (offset >= buffer.byteLength) break;

    const frameSize = view.getUint32(offset, true);
    const frameMagic = view.getUint16(offset + 4, true);

    if (frameMagic !== 0xF1FA) {
      console.warn(`Frame ${f} has invalid magic 0x${frameMagic.toString(16)}`);
      break;
    }

    const oldNumChunks = view.getUint16(offset + 6, true);
    const frameDuration = view.getUint16(offset + 8, true);
    const newNumChunks = view.getUint32(offset + 12, true);

    const chunkCount = newNumChunks > 0 ? newNumChunks : oldNumChunks;
    let chunkOffset = offset + 16;

    const frameLayerData: Record<string, PixelGrid> = {};

    for (let c = 0; c < chunkCount; c++) {
      if (chunkOffset >= offset + frameSize || chunkOffset >= buffer.byteLength) break;

      const chunkSize = view.getUint32(chunkOffset, true);
      const chunkType = view.getUint16(chunkOffset + 4, true);
      const payloadOffset = chunkOffset + 6;

      // 1. Layer Chunk (Type 0x2004)
      if (chunkType === 0x2004) {
        const flags = view.getUint16(payloadOffset, true);
        const layerType = view.getUint16(payloadOffset + 2, true);
        const blendModeInt = view.getUint16(payloadOffset + 10, true);
        const opacityByte = view.getUint8(payloadOffset + 12);
        
        const { str: name } = decodeString(view, payloadOffset + 18);

        const layerId = `layer-${layers.length}`;
        layers.push({
          id: layerId,
          name: name || `Layer ${layers.length + 1}`,
          visible: (flags & 1) !== 0,
          locked: (flags & 2) === 0,
          opacity: Math.round((opacityByte / 255) * 100),
          blendMode: (REVERSE_BLEND_MODE_MAP[blendModeInt] || 'normal') as any
        });
      }

      // 2. Palette Chunk (Type 0x2019)
      else if (chunkType === 0x2019) {
        const numColors = view.getUint32(payloadOffset, true);
        const firstIdx = view.getUint32(payloadOffset + 4, true);
        const lastIdx = view.getUint32(payloadOffset + 8, true);

        let pEntryOffset = payloadOffset + 20;
        const newPalette: string[] = [...palette];

        for (let p = firstIdx; p <= lastIdx; p++) {
          if (pEntryOffset >= chunkOffset + chunkSize) break;
          const entryFlags = view.getUint16(pEntryOffset, true);
          const r = view.getUint8(pEntryOffset + 2);
          const g = view.getUint8(pEntryOffset + 3);
          const b = view.getUint8(pEntryOffset + 4);
          const a = view.getUint8(pEntryOffset + 5);

          newPalette[p] = rgbToHex(r, g, b);

          pEntryOffset += 6;
          if (entryFlags & 1) {
            // String name included
            const nameLen = view.getUint16(pEntryOffset, true);
            pEntryOffset += 2 + nameLen;
          }
        }
        palette = newPalette;
      }

      // 3. Cel Chunk (Type 0x2005)
      else if (chunkType === 0x2005) {
        const layerIndex = view.getUint16(payloadOffset, true);
        const celX = view.getInt16(payloadOffset + 2, true);
        const celY = view.getInt16(payloadOffset + 4, true);
        const celOpacity = view.getUint8(payloadOffset + 6);
        const celType = view.getUint16(payloadOffset + 7, true);

        const targetLayer = layers[layerIndex];
        const layerId = targetLayer ? targetLayer.id : `layer-${layerIndex}`;

        // Cel Type 2: Compressed Image (zlib)
        if (celType === 2) {
          const celWidth = view.getUint16(payloadOffset + 16, true);
          const celHeight = view.getUint16(payloadOffset + 18, true);

          const compressedOffset = payloadOffset + 20;
          const compressedLength = chunkSize - 6 - 20;

          if (compressedLength > 0 && compressedOffset + compressedLength <= buffer.byteLength) {
            const compressedBytes = new Uint8Array(buffer, compressedOffset, compressedLength);
            try {
              const rawBytes = inflate(compressedBytes);
              const grid: PixelGrid = new Array(width * height).fill(null);

              if (colorDepth === 32) {
                // RGBA (32 bpp)
                for (let cy = 0; cy < celHeight; cy++) {
                  for (let cx = 0; cx < celWidth; cx++) {
                    const rawIdx = (cy * celWidth + cx) * 4;
                    const r = rawBytes[rawIdx];
                    const g = rawBytes[rawIdx + 1];
                    const b = rawBytes[rawIdx + 2];
                    const a = rawBytes[rawIdx + 3];

                    const tx = celX + cx;
                    const ty = celY + cy;

                    if (tx >= 0 && tx < width && ty >= 0 && ty < height && a > 0) {
                      grid[ty * width + tx] = rgbToHex(r, g, b);
                    }
                  }
                }
              } else if (colorDepth === 8) {
                // Indexed (8 bpp)
                for (let cy = 0; cy < celHeight; cy++) {
                  for (let cx = 0; cx < celWidth; cx++) {
                    const rawIdx = cy * celWidth + cx;
                    const colorIdx = rawBytes[rawIdx];

                    const tx = celX + cx;
                    const ty = celY + cy;

                    if (tx >= 0 && tx < width && ty >= 0 && ty < height && colorIdx !== transparentIndex) {
                      const hex = palette[colorIdx] || '#000000';
                      grid[ty * width + tx] = hex;
                    }
                  }
                }
              }

              frameLayerData[layerId] = grid;
            } catch (err) {
              console.error(`Failed to decompress cel chunk for layer ${layerIndex}:`, err);
            }
          }
        }
        // Cel Type 0: Raw Image (Uncompressed)
        else if (celType === 0) {
          const celWidth = view.getUint16(payloadOffset + 16, true);
          const celHeight = view.getUint16(payloadOffset + 18, true);
          const rawOffset = payloadOffset + 20;

          const grid: PixelGrid = new Array(width * height).fill(null);
          const rawBytes = new Uint8Array(buffer, rawOffset, chunkSize - 6 - 20);

          if (colorDepth === 32) {
            for (let cy = 0; cy < celHeight; cy++) {
              for (let cx = 0; cx < celWidth; cx++) {
                const rawIdx = (cy * celWidth + cx) * 4;
                const r = rawBytes[rawIdx];
                const g = rawBytes[rawIdx + 1];
                const b = rawBytes[rawIdx + 2];
                const a = rawBytes[rawIdx + 3];

                const tx = celX + cx;
                const ty = celY + cy;

                if (tx >= 0 && tx < width && ty >= 0 && ty < height && a > 0) {
                  grid[ty * width + tx] = rgbToHex(r, g, b);
                }
              }
            }
          } else if (colorDepth === 8) {
            for (let cy = 0; cy < celHeight; cy++) {
              for (let cx = 0; cx < celWidth; cx++) {
                const rawIdx = cy * celWidth + cx;
                const colorIdx = rawBytes[rawIdx];

                const tx = celX + cx;
                const ty = celY + cy;

                if (tx >= 0 && tx < width && ty >= 0 && ty < height && colorIdx !== transparentIndex) {
                  const hex = palette[colorIdx] || '#000000';
                  grid[ty * width + tx] = hex;
                }
              }
            }
          }

          frameLayerData[layerId] = grid;
        }
        // Cel Type 1: Linked Cel
        else if (celType === 1) {
          const linkedFrameIdx = view.getUint16(payloadOffset + 16, true);
          if (frames[linkedFrameIdx] && frames[linkedFrameIdx].layerData[layerId]) {
            frameLayerData[layerId] = [...frames[linkedFrameIdx].layerData[layerId]];
          }
        }
      }

      chunkOffset += chunkSize;
    }

    // Ensure all layers have a grid entry in this frame
    layers.forEach((l) => {
      if (!frameLayerData[l.id]) {
        frameLayerData[l.id] = new Array(width * height).fill(null);
      }
    });

    frames.push({
      id: `frame-${f}`,
      layerData: frameLayerData
    });

    offset += frameSize;
  }

  // Ensure default layer if none found
  if (layers.length === 0) {
    layers.push({
      id: 'layer-0',
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal'
    });
  }

  // Ensure default frame if none found
  if (frames.length === 0) {
    const defaultLayerData: Record<string, PixelGrid> = {};
    layers.forEach((l) => {
      defaultLayerData[l.id] = new Array(width * height).fill(null);
    });
    frames.push({
      id: 'frame-0',
      layerData: defaultLayerData
    });
  }

  const cleanTitle = fileName ? fileName.replace(/\.[^/.]+$/, "") : 'Pixel Art';

  const state: ProjectState = {
    id: `project-${Date.now()}`,
    title: cleanTitle,
    width,
    height,
    colorMode: colorDepth === 8 ? 'indexed' : 'rgba',
    layers,
    frames,
    activeLayerId: layers[0].id,
    selectedLayerIds: [layers[0].id],
    activeFrameIndex: 0,
    selectedFrameIndices: [0],
    palette: palette.length > 0 ? palette : ['#000000', '#ffffff'],
    paletteLibrary: [],
    activePaletteId: '',
    primaryColor: palette[0] || '#ffffff',
    secondaryColor: palette[1] || '#000000',

    symmetry: { x: false, y: false },
    inkType: 'simple',
    shades: ['#000000', '#5d5d5d', '#b4b4b4', '#ffffff'],

    tool: 'pencil',
    brushSize: 1,
    brushShape: 'circle',
    fillContiguous: true,
    pixelPerfect: false,
    ditheringEnabled: false,
    rotationAlgorithm: 'nearest',
    zoom: Math.min(32, Math.floor(512 / Math.max(width, height))),
    onionSkin: false,
    showGrid: false,
    selection: null,
    selectionMode: 'replace',
    tiled: false,
    referenceImage: null
  };

  return state;
}
