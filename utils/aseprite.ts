import { inflate, deflate } from 'pako';
import { 
  ProjectState, Layer, Frame, FrameTag, Slice, SliceKey, Tileset, 
  ColorProfile, UserData, UserPropertyMap, ExternalFile, CelExtra, 
  PixelGrid, LayerBlendMode, LayerType 
} from '../types';
import {
  EMPTY_PIXEL,
  computeInitialZoom,
  createPixelGrid,
  decodeIndexedPixel,
  encodeIndexedPixel,
  findNearestPaletteIndex,
  getPackedPalette255,
  hexToRgb,
  isLittleEndian,
  isPackedRgbaPixel,
  packRGBA,
  rgbToHex,
} from './pixelBuffer';

// --- Aseprite Blend Mode Mapping ---
const ASEPRITE_BLEND_MODES: Record<number, LayerBlendMode> = {
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

const BLEND_MODE_TO_ASEPRITE: Record<LayerBlendMode, number> = {
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

/**
 * Converts layers from Aseprite chunk order (where Group Header precedes its children)
 * to PixelForge Studio app order (where Group Header comes after its children in bottom-to-top array,
 * so it appears at the top of the group in the UI list).
 */
export function convertAsepriteChunkOrderToAppOrder(rawLayers: Layer[]): Layer[] {
  const layers = [...rawLayers];
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].type === 'group') {
      const groupLayer = layers[i];
      const groupLevel = groupLayer.childLevel ?? 0;
      let lastDescendantIdx = i;
      for (let j = i + 1; j < layers.length; j++) {
        if ((layers[j].childLevel ?? 0) > groupLevel) {
          lastDescendantIdx = j;
        } else {
          break;
        }
      }
      if (lastDescendantIdx > i) {
        layers.splice(i, 1);
        layers.splice(lastDescendantIdx, 0, groupLayer);
      }
    }
  }
  return layers;
}

/**
 * Converts layers from PixelForge Studio app order (where Group Header comes after its children)
 * back to Aseprite chunk order (where Group Header precedes its children).
 */
export function convertAppOrderToAsepriteChunkOrder(appLayers: Layer[]): Layer[] {
  const layers = [...appLayers];
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].type === 'group') {
      const groupLayer = layers[i];
      const groupLevel = groupLayer.childLevel ?? 0;
      let firstDescendantIdx = i;
      for (let j = i - 1; j >= 0; j--) {
        if ((layers[j].childLevel ?? 0) > groupLevel) {
          firstDescendantIdx = j;
        } else {
          break;
        }
      }
      if (firstDescendantIdx < i) {
        layers.splice(i, 1);
        layers.splice(firstDescendantIdx, 0, groupLayer);
      }
    }
  }
  return layers;
}

// --- Binary Reader Helper ---
class BinaryReader {
  private view: DataView;
  private utf8Decoder = new TextDecoder('utf-8');
  public offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.view.byteLength;
  }

  readByte(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  readWord(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readShort(): number {
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readDword(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readLong(): number {
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readInt64(): number {
    const low = this.view.getUint32(this.offset, true);
    const high = this.view.getInt32(this.offset + 4, true);
    this.offset += 8;
    return high * 0x100000000 + low;
  }

  readUint64(): number {
    const low = this.view.getUint32(this.offset, true);
    const high = this.view.getUint32(this.offset + 4, true);
    this.offset += 8;
    return high * 0x100000000 + low;
  }

  readFixed(): number {
    const raw = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return raw / 65536.0;
  }

  readFloat(): number {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readDouble(): number {
    const val = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  readString(): string {
    const len = this.readWord();
    if (len === 0) return '';
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return this.utf8Decoder.decode(bytes);
  }

  readBytes(len: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return bytes;
  }

  readUUID(): string {
    const bytes = this.readBytes(16);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  seek(pos: number) {
    this.offset = pos;
  }
}

// --- Binary Writer Helper ---
class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private utf8Encoder = new TextEncoder();
  public offset: number = 0;

  constructor(initialCapacity = 1024 * 1024) {
    this.buffer = new Uint8Array(initialCapacity);
    this.view = new DataView(this.buffer.buffer);
  }

  private ensureCapacity(additionalBytes: number) {
    if (this.offset + additionalBytes > this.buffer.byteLength) {
      const newCapacity = Math.max(this.buffer.byteLength * 2, this.offset + additionalBytes + 1024);
      const newBuf = new Uint8Array(newCapacity);
      newBuf.set(this.buffer);
      this.buffer = newBuf;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  writeByte(val: number) {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, val & 0xff);
    this.offset += 1;
  }

  writeWord(val: number) {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, val & 0xffff, true);
    this.offset += 2;
  }

  writeShort(val: number) {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, val, true);
    this.offset += 2;
  }

  writeDword(val: number) {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, val >>> 0, true);
    this.offset += 4;
  }

  writeLong(val: number) {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, val, true);
    this.offset += 4;
  }

  writeInt64(val: number) {
    this.ensureCapacity(8);
    const low = val % 0x100000000;
    const high = Math.floor(val / 0x100000000);
    this.view.setUint32(this.offset, low >>> 0, true);
    this.view.setInt32(this.offset + 4, high, true);
    this.offset += 8;
  }

  writeUint64(val: number) {
    this.ensureCapacity(8);
    const low = val % 0x100000000;
    const high = Math.floor(val / 0x100000000);
    this.view.setUint32(this.offset, low >>> 0, true);
    this.view.setUint32(this.offset + 4, high >>> 0, true);
    this.offset += 8;
  }

  writeFixed(val: number) {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, Math.round(val * 65536.0), true);
    this.offset += 4;
  }

  writeFloat(val: number) {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, val, true);
    this.offset += 4;
  }

  writeDouble(val: number) {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, val, true);
    this.offset += 8;
  }

  writeString(str: string) {
    const encoded = this.utf8Encoder.encode(str);
    this.writeWord(encoded.length);
    if (encoded.length > 0) {
      this.ensureCapacity(encoded.length);
      this.buffer.set(encoded, this.offset);
      this.offset += encoded.length;
    }
  }

  writeBytes(bytes: Uint8Array) {
    if (bytes.length === 0) return;
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  getBytes(): Uint8Array {
    return this.buffer.subarray(0, this.offset);
  }
}

// --- Helper Functions for User Data Properties (0x2020 bit 4) ---
function parsePropertyValue(reader: BinaryReader, type: number): any {
  switch (type) {
    case 0x0001: // bool
      return reader.readByte() !== 0;
    case 0x0002: // int8
      const i8 = reader.readByte();
      return i8 > 127 ? i8 - 256 : i8;
    case 0x0003: // uint8
      return reader.readByte();
    case 0x0004: // int16
      return reader.readShort();
    case 0x0005: // uint16
      return reader.readWord();
    case 0x0006: // int32
      return reader.readLong();
    case 0x0007: // uint32
      return reader.readDword();
    case 0x0008: // int64
      return reader.readInt64();
    case 0x0009: // uint64
      return reader.readUint64();
    case 0x000A: // FIXED
      return reader.readFixed();
    case 0x000B: // FLOAT
      return reader.readFloat();
    case 0x000C: // DOUBLE
      return reader.readDouble();
    case 0x000D: // STRING
      return reader.readString();
    case 0x000E: // POINT
      return { x: reader.readLong(), y: reader.readLong() };
    case 0x000F: // SIZE
      return { w: reader.readLong(), h: reader.readLong() };
    case 0x0010: // RECT
      return {
        x: reader.readLong(),
        y: reader.readLong(),
        w: reader.readLong(),
        h: reader.readLong()
      };
    case 0x0011: { // vector
      const elemCount = reader.readDword();
      const elemType = reader.readWord();
      const vec: any[] = [];
      for (let i = 0; i < elemCount; i++) {
        const itemType = elemType === 0 ? reader.readWord() : elemType;
        vec.push(parsePropertyValue(reader, itemType));
      }
      return vec;
    }
    case 0x0012: { // nested properties map
      const propCount = reader.readDword();
      const props: Record<string, any> = {};
      for (let i = 0; i < propCount; i++) {
        const name = reader.readString();
        const propType = reader.readWord();
        props[name] = parsePropertyValue(reader, propType);
      }
      return props;
    }
    case 0x0013: // UUID
      return reader.readUUID();
    default:
      return null;
  }
}

function getPropertyType(val: any): number {
  if (typeof val === 'boolean') return 0x0001;
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return 0x0006;
    return 0x000C;
  }
  if (typeof val === 'string') {
    if (/^[0-9a-f]{32}$/i.test(val)) return 0x0013;
    return 0x000D;
  }
  if (Array.isArray(val)) return 0x0011;
  if (val && typeof val === 'object') {
    if ('x' in val && 'y' in val && 'w' in val && 'h' in val) return 0x0010;
    if ('x' in val && 'y' in val) return 0x000E;
    if ('w' in val && 'h' in val) return 0x000F;
    return 0x0012;
  }
  return 0x000D;
}

function writePropertyValue(writer: BinaryWriter, type: number, value: any) {
  switch (type) {
    case 0x0001:
      writer.writeByte(value ? 1 : 0);
      break;
    case 0x0002:
    case 0x0003:
      writer.writeByte(Number(value) & 0xff);
      break;
    case 0x0004:
      writer.writeShort(Number(value));
      break;
    case 0x0005:
      writer.writeWord(Number(value));
      break;
    case 0x0006:
      writer.writeLong(Number(value));
      break;
    case 0x0007:
      writer.writeDword(Number(value));
      break;
    case 0x0008:
      writer.writeInt64(Number(value));
      break;
    case 0x0009:
      writer.writeUint64(Number(value));
      break;
    case 0x000A:
      writer.writeFixed(Number(value));
      break;
    case 0x000B:
      writer.writeFloat(Number(value));
      break;
    case 0x000C:
      writer.writeDouble(Number(value));
      break;
    case 0x000D:
      writer.writeString(String(value || ''));
      break;
    case 0x000E:
      writer.writeLong(value?.x || 0);
      writer.writeLong(value?.y || 0);
      break;
    case 0x000F:
      writer.writeLong(value?.w || 0);
      writer.writeLong(value?.h || 0);
      break;
    case 0x0010:
      writer.writeLong(value?.x || 0);
      writer.writeLong(value?.y || 0);
      writer.writeLong(value?.w || 0);
      writer.writeLong(value?.h || 0);
      break;
    case 0x0011: {
      const arr = Array.isArray(value) ? value : [];
      writer.writeDword(arr.length);
      let sameType: number | null = arr.length > 0 ? getPropertyType(arr[0]) : 0x000D;
      for (let i = 1; i < arr.length; i++) {
        if (getPropertyType(arr[i]) !== sameType) {
          sameType = 0;
          break;
        }
      }
      const elemType = sameType !== null ? sameType : 0;
      writer.writeWord(elemType);
      for (const item of arr) {
        const itemType = elemType === 0 ? getPropertyType(item) : elemType;
        if (elemType === 0) {
          writer.writeWord(itemType);
        }
        writePropertyValue(writer, itemType, item);
      }
      break;
    }
    case 0x0012: {
      const keys = Object.keys(value || {});
      writer.writeDword(keys.length);
      for (const k of keys) {
        writer.writeString(k);
        const pType = getPropertyType(value[k]);
        writer.writeWord(pType);
        writePropertyValue(writer, pType, value[k]);
      }
      break;
    }
    case 0x0013: {
      const hex = String(value || '').replace(/-/g, '').padStart(32, '0');
      const bytes = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) || 0;
      }
      writer.writeBytes(bytes);
      break;
    }
  }
}

function encodeUserDataChunk(uData: UserData): Uint8Array {
  const uWriter = new BinaryWriter(256);
  uWriter.writeDword(0);
  uWriter.writeWord(0x2020);

  let uFlags = 0;
  if (uData.text) uFlags |= 1;
  if (uData.color) uFlags |= 2;
  if (uData.propertiesMaps && uData.propertiesMaps.length > 0) uFlags |= 4;

  uWriter.writeDword(uFlags);

  if (uData.text) uWriter.writeString(uData.text);
  if (uData.color) {
    uWriter.writeByte(uData.color.r);
    uWriter.writeByte(uData.color.g);
    uWriter.writeByte(uData.color.b);
    uWriter.writeByte(uData.color.a);
  }
  if (uData.propertiesMaps && uData.propertiesMaps.length > 0) {
    const propsWriter = new BinaryWriter(256);
    propsWriter.writeDword(uData.propertiesMaps.length);
    for (const map of uData.propertiesMaps) {
      propsWriter.writeDword(map.key);
      const keys = Object.keys(map.properties || {});
      propsWriter.writeDword(keys.length);
      for (const k of keys) {
        propsWriter.writeString(k);
        const pType = getPropertyType(map.properties[k]);
        propsWriter.writeWord(pType);
        writePropertyValue(propsWriter, pType, map.properties[k]);
      }
    }
    const propsBytes = propsWriter.getBytes();
    uWriter.writeDword(4 + propsBytes.length);
    uWriter.writeBytes(propsBytes);
  }

  const uBytes = uWriter.getBytes();
  new DataView(uBytes.buffer).setUint32(0, uBytes.length, true);
  return uBytes;
}

/**
 * Parses an Aseprite file (.ase/.aseprite) into a ProjectState object.
 */
export async function parseAseprite(buffer: ArrayBuffer, filename = 'imported'): Promise<ProjectState> {
  const reader = new BinaryReader(buffer);

  // 1. Header (128 bytes)
  const fileSize = reader.readDword();
  const magic = reader.readWord();
  if (magic !== 0xa5e0) {
    throw new Error(`Invalid Aseprite magic number: 0x${magic.toString(16).toUpperCase()}`);
  }

  const numFrames = reader.readWord();
  const width = reader.readWord();
  const height = reader.readWord();
  const colorDepth = reader.readWord(); // 32 = RGBA, 16 = Grayscale, 8 = Indexed
  const flags = reader.readDword();
  const speed = reader.readWord();
  reader.readDword();
  reader.readDword();
  const transparentIndex = reader.readByte();
  reader.readBytes(3);
  const numColors = reader.readWord();
  const pixWidth = reader.readByte();
  const pixHeight = reader.readByte();
  const gridX = reader.readShort();
  const gridY = reader.readShort();
  const gridWidth = reader.readWord();
  const gridHeight = reader.readWord();
  reader.seek(128);

  const colorMode = colorDepth === 8 ? 'indexed' : 'rgba';

  const palette: string[] = [];
  const paletteNames: Record<number, string> = {};
  const layers: Layer[] = [];
  const layerIdMap: string[] = [];
  const tags: FrameTag[] = [];
  const slices: Slice[] = [];
  const tilesets: Tileset[] = [];
  const externalFiles: ExternalFile[] = [];
  let colorProfile: ColorProfile | undefined = undefined;
  let spriteUserData: UserData | undefined = undefined;
  let mask: { x: number; y: number; width: number; height: number; name?: string; bitmap?: Uint8Array } | undefined = undefined;

  const frameDurations: number[] = [];
  const frameLayerData: Record<string, PixelGrid>[] = [];
  for (let f = 0; f < numFrames; f++) {
    frameLayerData.push({});
  }

  let lastReadObject: any = null;
  let tagUserDatas: UserData[] = [];

  // Parse Frames
  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frameStartPos = reader.offset;
    const frameBytes = reader.readDword();
    const frameMagic = reader.readWord();
    if (frameMagic !== 0xf1fa) {
      throw new Error(`Invalid Frame magic number at frame ${frameIdx}: 0x${frameMagic.toString(16).toUpperCase()}`);
    }

    const oldChunkCount = reader.readWord();
    const frameDuration = reader.readWord();
    reader.readBytes(2);
    const newChunkCount = reader.readDword();

    const chunkCount = newChunkCount > 0 ? newChunkCount : (oldChunkCount === 0xffff ? 0xffff : oldChunkCount);
    frameDurations.push(frameDuration > 0 ? frameDuration : (speed > 0 ? speed : 100));

    const frameEndPos = frameStartPos + frameBytes;

    for (let c = 0; c < chunkCount && reader.offset < frameEndPos; c++) {
      const chunkStartPos = reader.offset;
      const chunkSize = reader.readDword();
      const chunkType = reader.readWord();
      const chunkDataEnd = chunkStartPos + chunkSize;

      switch (chunkType) {
        // --- 0x2004: Layer Chunk ---
        case 0x2004: {
          const lFlags = reader.readWord();
          const lType = reader.readWord();
          const childLevel = reader.readWord();
          reader.readWord();
          reader.readWord();
          const blendModeInt = reader.readWord();
          const opacityByte = reader.readByte();
          reader.readBytes(3);
          const name = reader.readString();

          let tilesetIndex: number | undefined = undefined;
          if (lType === 2) {
            tilesetIndex = reader.readDword();
          }

          let uuid: string | undefined = undefined;
          if (flags & 4) {
            uuid = reader.readUUID();
          }

          const layerId = `layer-${layers.length}-${Date.now()}`;
          const layer: Layer = {
            id: layerId,
            name: name || `Layer ${layers.length + 1}`,
            visible: (lFlags & 1) !== 0,
            locked: (lFlags & 2) === 0 ? false : true,
            opacity: Math.round((opacityByte / 255) * 100),
            blendMode: ASEPRITE_BLEND_MODES[blendModeInt] || 'normal',
            type: lType === 1 ? 'group' : (lType === 2 ? 'tilemap' : 'normal'),
            childLevel,
            tilesetIndex,
            collapsed: (lFlags & 32) !== 0,
            uuid,
            lockMovement: (lFlags & 4) !== 0,
            isBackground: (lFlags & 8) !== 0,
            preferLinkedCels: (lFlags & 16) !== 0,
            isReference: (lFlags & 64) !== 0
          };

          layers.push(layer);
          layerIdMap.push(layerId);
          lastReadObject = layer;
          break;
        }

        // --- 0x2005: Cel Chunk ---
        case 0x2005: {
          const layerIdx = reader.readWord();
          const xPos = reader.readShort();
          const yPos = reader.readShort();
          const celOpacity = reader.readByte();
          const celType = reader.readWord();
          const zIndex = reader.readShort();
          reader.readBytes(5);

          // Resolve Z-Index offset
          const effectiveLayerIdx = Math.max(0, Math.min(layerIdMap.length - 1, layerIdx + zIndex));
          const targetLayerId = layerIdMap[effectiveLayerIdx] || layerIdMap[layerIdx];

          if (targetLayerId) {
            if (!frameLayerData[frameIdx][targetLayerId]) {
              frameLayerData[frameIdx][targetLayerId] = createPixelGrid(width * height);
            }
            const grid = frameLayerData[frameIdx][targetLayerId];

            if (celType === 1) {
              // Linked Cel
              const linkFramePos = reader.readWord();
              const sourceLayerId = layerIdMap[layerIdx] || targetLayerId;
              if (linkFramePos < frameIdx && frameLayerData[linkFramePos][sourceLayerId]) {
                const sourceGrid = frameLayerData[linkFramePos][sourceLayerId];
                grid.set(sourceGrid.subarray(0, Math.min(grid.length, sourceGrid.length)));
              }
            } else if (celType === 2 || celType === 0) {
              // Compressed Image (Type 2) or Raw (Type 0)
              const celW = reader.readWord();
              const celH = reader.readWord();

              let uncompressedData: Uint8Array;
              if (celType === 2) {
                const remainingChunkBytes = chunkDataEnd - reader.offset;
                const compressedBytes = reader.readBytes(remainingChunkBytes);
                try {
                  uncompressedData = inflate(compressedBytes);
                } catch (e) {
                  console.warn("Failed to inflate cel data", e);
                  uncompressedData = new Uint8Array(0);
                }
              } else {
                const bpp = colorDepth === 32 ? 4 : (colorDepth === 16 ? 2 : 1);
                uncompressedData = reader.readBytes(celW * celH * bpp);
              }

              if (uncompressedData.length > 0) {
                const currentLayer = layers[layerIdx];
                const isBg = Boolean(currentLayer?.isBackground);
                let pixelOffset = 0;
                const celAlphaMult = celOpacity / 255;
                for (let cy = 0; cy < celH; cy++) {
                  const canvasY = yPos + cy;
                  const rowInBounds = canvasY >= 0 && canvasY < height;
                  const rowBase = canvasY * width;
                  for (let cx = 0; cx < celW; cx++) {
                    const canvasX = xPos + cx;

                    if (rowInBounds && canvasX >= 0 && canvasX < width) {
                      const gridIdx = rowBase + canvasX;

                      if (colorDepth === 32) {
                        const r = uncompressedData[pixelOffset];
                        const g = uncompressedData[pixelOffset + 1];
                        const b = uncompressedData[pixelOffset + 2];
                        const rawA = uncompressedData[pixelOffset + 3];
                        const a = celOpacity === 255 ? rawA : Math.round(rawA * celAlphaMult);
                        pixelOffset += 4;

                        if (a > 0) {
                          grid[gridIdx] = packRGBA(r, g, b, a);
                        }
                      } else if (colorDepth === 16) {
                        const val = uncompressedData[pixelOffset];
                        const rawA = uncompressedData[pixelOffset + 1];
                        const a = celOpacity === 255 ? rawA : Math.round(rawA * celAlphaMult);
                        pixelOffset += 2;

                        if (a > 0) {
                          grid[gridIdx] = packRGBA(val, val, val, a);
                        }
                      } else if (colorDepth === 8) {
                        const pIdx = uncompressedData[pixelOffset];
                        pixelOffset += 1;

                        if (pIdx !== transparentIndex || isBg) {
                          grid[gridIdx] = encodeIndexedPixel(pIdx);
                        }
                      }
                    } else {
                      pixelOffset += (colorDepth === 32 ? 4 : (colorDepth === 16 ? 2 : 1));
                    }
                  }
                }
              }
            } else if (celType === 3) {
              // Compressed Tilemap
              const mapWidthInTiles = reader.readWord();
              const mapHeightInTiles = reader.readWord();
              const bitsPerTile = reader.readWord();
              const tileIdMask = reader.readDword();
              const xFlipMask = reader.readDword();
              const yFlipMask = reader.readDword();
              const dFlipMask = reader.readDword();
              reader.readBytes(10);

              const remainingChunkBytes = chunkDataEnd - reader.offset;
              const compressedBytes = reader.readBytes(remainingChunkBytes);
              try {
                const tileData = inflate(compressedBytes);
                const targetLayer = layers.find(l => l.id === targetLayerId);
                const tileset = targetLayer?.tilesetIndex !== undefined ? tilesets.find(t => t.id === targetLayer.tilesetIndex) : tilesets[0];

                if (tileset && tileset.pixels) {
                  const tW = tileset.tileWidth;
                  const tH = tileset.tileHeight;
                  const tileReader = new BinaryReader(tileData.buffer);

                  for (let ty = 0; ty < mapHeightInTiles; ty++) {
                    for (let tx = 0; tx < mapWidthInTiles; tx++) {
                      let rawTile = 0;
                      if (bitsPerTile === 32) rawTile = tileReader.readDword();
                      else if (bitsPerTile === 16) rawTile = tileReader.readWord();
                      else if (bitsPerTile === 8) rawTile = tileReader.readByte();

                      const tileId = rawTile & tileIdMask;
                      const xFlip = (rawTile & xFlipMask) !== 0;
                      const yFlip = (rawTile & yFlipMask) !== 0;
                      const dFlip = (rawTile & dFlipMask) !== 0;

                      if (tileId > 0 && tileId < tileset.tilesCount) {
                        const tileStartPixelIndex = tileId * (tW * tH);
                        for (let cy = 0; cy < tH; cy++) {
                          for (let cx = 0; cx < tW; cx++) {
                            const canvasX = xPos + tx * tW + cx;
                            const canvasY = yPos + ty * tH + cy;
                            if (canvasX >= 0 && canvasX < width && canvasY >= 0 && canvasY < height) {
                              const gIdx = canvasY * width + canvasX;

                              let srcCx = cx;
                              let srcCy = cy;
                              if (dFlip) {
                                const tmp = srcCx;
                                srcCx = srcCy;
                                srcCy = tmp;
                              }
                              if (xFlip) {
                                srcCx = tW - 1 - srcCx;
                              }
                              if (yFlip) {
                                srcCy = tH - 1 - srcCy;
                              }

                              const tPixIdx = tileStartPixelIndex + srcCy * tW + srcCx;
                              const val = tileset.pixels[tPixIdx];
                              if (val !== EMPTY_PIXEL) {
                                grid[gIdx] = val;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn("Failed to inflate tilemap data", e);
              }
            }
          }
          lastReadObject = { type: 'cel', frameIdx, layerIdx };
          break;
        }

        // --- 0x2006: Cel Extra Chunk ---
        case 0x2006: {
          const ceFlags = reader.readDword();
          const preciseX = reader.readFixed();
          const preciseY = reader.readFixed();
          const wInSprite = reader.readFixed();
          const hInSprite = reader.readFixed();
          reader.readBytes(16);
          break;
        }

        // --- 0x2008: External Files Chunk ---
        case 0x2008: {
          const numEntries = reader.readDword();
          reader.readBytes(8);
          for (let e = 0; e < numEntries; e++) {
            const entryId = reader.readDword();
            const entryType = reader.readByte();
            reader.readBytes(7);
            const extFilename = reader.readString();
            externalFiles.push({ id: entryId, type: entryType, filename: extFilename });
          }
          break;
        }

        // --- 0x2016: Mask Chunk [DEPRECATED] ---
        case 0x2016: {
          const mx = reader.readShort();
          const my = reader.readShort();
          const mw = reader.readWord();
          const mh = reader.readWord();
          reader.readBytes(8);
          const mName = reader.readString();
          const bitmapLen = mh * Math.ceil(mw / 8);
          const bitmap = reader.readBytes(bitmapLen);
          mask = { x: mx, y: my, width: mw, height: mh, name: mName, bitmap };
          break;
        }

        // --- 0x2019: Palette Chunk ---
        case 0x2019: {
          const paletteSize = reader.readDword();
          const fromIdx = reader.readDword();
          const toIdx = reader.readDword();
          reader.readBytes(8);

          for (let p = fromIdx; p <= toIdx; p++) {
            const entryFlags = reader.readWord();
            const r = reader.readByte();
            const g = reader.readByte();
            const b = reader.readByte();
            const a = reader.readByte();

            if (entryFlags & 1) {
              const cName = reader.readString();
              paletteNames[p] = cName;
            }

            palette[p] = rgbToHex(r, g, b);
          }
          lastReadObject = palette;
          break;
        }

        // --- 0x0004 & 0x0011: Old Palette Chunks ---
        case 0x0004:
        case 0x0011: {
          if (palette.length === 0) {
            const numPackets = reader.readWord();
            let curPalIdx = 0;
            for (let pkt = 0; pkt < numPackets; pkt++) {
              const skip = reader.readByte();
              const count = reader.readByte();
              const numColors = count === 0 ? 256 : count;
              curPalIdx += skip;
              for (let col = 0; col < numColors; col++) {
                let r = reader.readByte();
                let g = reader.readByte();
                let b = reader.readByte();
                if (chunkType === 0x0011) {
                  r = Math.round((r * 255) / 63);
                  g = Math.round((g * 255) / 63);
                  b = Math.round((b * 255) / 63);
                }
                palette[curPalIdx++] = rgbToHex(r, g, b);
              }
            }
          }
          break;
        }

        // --- 0x2018: Tags Chunk ---
        case 0x2018: {
          const numTags = reader.readWord();
          reader.readBytes(8);

          for (let t = 0; t < numTags; t++) {
            const fromFrame = reader.readWord();
            const toFrame = reader.readWord();
            const dirByte = reader.readByte();
            const repeat = reader.readWord();
            reader.readBytes(6);
            const r = reader.readByte();
            const g = reader.readByte();
            const b = reader.readByte();
            reader.readByte();
            const name = reader.readString();

            const dirs: ('forward' | 'reverse' | 'ping-pong' | 'ping-pong-reverse')[] = [
              'forward', 'reverse', 'ping-pong', 'ping-pong-reverse'
            ];

            const tag: FrameTag = {
              id: `tag-${t}-${Date.now()}`,
              name,
              from: fromFrame,
              to: toFrame,
              direction: dirs[dirByte] || 'forward',
              repeat,
              color: rgbToHex(r, g, b)
            };
            tags.push(tag);
          }
          tagUserDatas = [];
          lastReadObject = tags;
          break;
        }

        // --- 0x2020: User Data Chunk ---
        case 0x2020: {
          const uFlags = reader.readDword();
          let text: string | undefined = undefined;
          let color: { r: number; g: number; b: number; a: number } | undefined = undefined;
          let propertiesMaps: UserPropertyMap[] | undefined = undefined;

          if (uFlags & 1) text = reader.readString();
          if (uFlags & 2) {
            color = {
              r: reader.readByte(),
              g: reader.readByte(),
              b: reader.readByte(),
              a: reader.readByte()
            };
          }
          if (uFlags & 4) {
            const sizeInBytes = reader.readDword();
            const numMaps = reader.readDword();
            propertiesMaps = [];
            for (let m = 0; m < numMaps; m++) {
              const mapKey = reader.readDword();
              const numProps = reader.readDword();
              const props: Record<string, any> = {};
              for (let p = 0; p < numProps; p++) {
                const pName = reader.readString();
                const pType = reader.readWord();
                props[pName] = parsePropertyValue(reader, pType);
              }
              propertiesMaps.push({ key: mapKey, properties: props });
            }
          }

          const uData: UserData = { text, color, propertiesMaps };

          if (lastReadObject === tags && tags.length > 0) {
            const tagIdx = tagUserDatas.length;
            if (tagIdx < tags.length) {
              tags[tagIdx].userData = uData;
              if (color) {
                tags[tagIdx].color = rgbToHex(color.r, color.g, color.b);
              }
              tagUserDatas.push(uData);
            }
          } else if (lastReadObject && typeof lastReadObject === 'object') {
            lastReadObject.userData = uData;
          } else {
            spriteUserData = uData;
          }
          break;
        }

        // --- 0x2022: Slice Chunk ---
        case 0x2022: {
          const numSliceKeys = reader.readDword();
          const sFlags = reader.readDword();
          reader.readDword();
          const name = reader.readString();

          const sliceKeys: SliceKey[] = [];
          for (let k = 0; k < numSliceKeys; k++) {
            const frameNum = reader.readDword();
            const sx = reader.readLong();
            const sy = reader.readLong();
            const sw = reader.readDword();
            const sh = reader.readDword();

            let center: { x: number; y: number; w: number; h: number } | undefined = undefined;
            if (sFlags & 1) {
              center = {
                x: reader.readLong(),
                y: reader.readLong(),
                w: reader.readDword(),
                h: reader.readDword()
              };
            }

            let pivot: { x: number; y: number } | undefined = undefined;
            if (sFlags & 2) {
              pivot = {
                x: reader.readLong(),
                y: reader.readLong()
              };
            }

            sliceKeys.push({ frame: frameNum, x: sx, y: sy, w: sw, h: sh, center, pivot });
          }

          const slice: Slice = {
            id: `slice-${slices.length}-${Date.now()}`,
            name,
            keys: sliceKeys
          };
          slices.push(slice);
          lastReadObject = slice;
          break;
        }

        // --- 0x2023: Tileset Chunk ---
        case 0x2023: {
          const tsId = reader.readDword();
          const tsFlags = reader.readDword();
          const numTiles = reader.readDword();
          const tW = reader.readWord();
          const tH = reader.readWord();
          const baseIndex = reader.readShort();
          reader.readBytes(14);
          const tsName = reader.readString();

          let extFileId: number | undefined = undefined;
          let extTilesetId: number | undefined = undefined;

          if (tsFlags & 1) {
            extFileId = reader.readDword();
            extTilesetId = reader.readDword();
          }

          let tPixels: PixelGrid | undefined = undefined;
          if (tsFlags & 2) {
            const compLen = reader.readDword();
            const compBytes = reader.readBytes(compLen);
            try {
              const rawTiles = inflate(compBytes);
              const totalPixels = tW * tH * numTiles;
              tPixels = createPixelGrid(totalPixels);
              let pOff = 0;
              for (let i = 0; i < totalPixels; i++) {
                if (colorDepth === 32) {
                  const r = rawTiles[pOff];
                  const g = rawTiles[pOff + 1];
                  const b = rawTiles[pOff + 2];
                  const a = rawTiles[pOff + 3];
                  pOff += 4;
                  tPixels[i] = a > 0 ? packRGBA(r, g, b, a) : EMPTY_PIXEL;
                } else if (colorDepth === 8) {
                  const pIdx = rawTiles[pOff++];
                  tPixels[i] = pIdx !== transparentIndex ? encodeIndexedPixel(pIdx) : EMPTY_PIXEL;
                }
              }
            } catch (e) {
              console.warn("Failed to inflate tileset data", e);
            }
          }

          const tileset: Tileset = {
            id: tsId,
            name: tsName,
            tileWidth: tW,
            tileHeight: tH,
            baseIndex,
            tilesCount: numTiles,
            pixels: tPixels,
            externalFileId: extFileId,
            externalTilesetId: extTilesetId
          };
          tilesets.push(tileset);
          lastReadObject = tileset;
          break;
        }

        // --- 0x2007: Color Profile Chunk ---
        case 0x2007: {
          const cpType = reader.readWord();
          const cpFlags = reader.readWord();
          const fixedGamma = reader.readFixed();
          reader.readBytes(8);

          let iccData: Uint8Array | undefined = undefined;
          if (cpType === 2) {
            const iccLen = reader.readDword();
            iccData = reader.readBytes(iccLen);
          }

          colorProfile = {
            type: cpType,
            flags: cpFlags,
            gamma: fixedGamma,
            iccData
          };
          break;
        }

        default:
          break;
      }

      reader.seek(chunkDataEnd);
    }

    reader.seek(frameEndPos);
  }

  // Calculate parentId for each layer based on childLevel stack
  const groupStack: { id: string; level: number }[] = [];
  for (const layer of layers) {
    const level = layer.childLevel ?? 0;
    while (groupStack.length > 0 && groupStack[groupStack.length - 1].level >= level) {
      groupStack.pop();
    }
    if (groupStack.length > 0) {
      layer.parentId = groupStack[groupStack.length - 1].id;
    } else {
      layer.parentId = null;
    }
    if (layer.type === 'group') {
      groupStack.push({ id: layer.id, level });
    }
  }

  // Reorder layers from Aseprite chunk order (where group headers precede their children)
  // to PixelForge Studio app order (where group headers follow their children in the bottom-to-top array)
  const reorderedLayers = convertAsepriteChunkOrderToAppOrder(layers);
  layers.length = 0;
  layers.push(...reorderedLayers);

  if (palette.length === 0) {
    palette.push('#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff');
  }

  if (layers.length === 0) {
    const lId = `layer-${Date.now()}`;
    layers.push({
      id: lId,
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal'
    });
  }

  const frames: Frame[] = [];
  for (let f = 0; f < numFrames; f++) {
    const fId = `frame-${f}-${Date.now()}`;
    const fData: Record<string, PixelGrid> = {};

    layers.forEach(layer => {
      if (layer.type !== 'group' && frameLayerData[f][layer.id]) {
        fData[layer.id] = frameLayerData[f][layer.id];
      }
    });

    frames.push({
      id: fId,
      duration: frameDurations[f] || 100,
      layerData: fData
    });
  }

  const cleanTitle = filename.replace(/\.[^/.]+$/, "") || 'imported';

  return {
    id: `project-${Date.now()}`,
    title: cleanTitle,
    width,
    height,
    colorMode: colorMode as 'indexed' | 'rgba',
    layers,
    frames,
    activeLayerId: layers[0].id,
    selectedLayerIds: [layers[0].id],
    activeFrameIndex: 0,
    selectedFrameIndices: [0],
    palette,
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
    zoom: computeInitialZoom(width, height, 32),
    onionSkin: false,
    showGrid: gridWidth > 0 && gridHeight > 0,
    grid: { x: gridX, y: gridY, width: gridWidth, height: gridHeight },
    pixelRatio: { width: pixWidth || 1, height: pixHeight || 1 },
    tags,
    slices,
    tilesets,
    externalFiles,
    colorProfile,
    transparentIndex,
    paletteNames,
    userData: spriteUserData,
    mask,
    selection: null,
    selectionMode: 'replace',
    tiled: false,
    referenceImage: null
  };
}

const FALLBACK_ASEPRITE_PALETTE = ['#000000', '#ffffff'];

export type AsepriteCompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface CachedEncodedCel {
  width: number;
  height: number;
  pxLen: number;
  hash: number;
  hasValidHash: boolean;
  nonNullCount: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  hasIndexedValues: boolean;
  hasStringValues: boolean;
  compressedKey: string | null;
  compressedLevel: number;
  compressedPaletteSig: string | null;
  compressedBytes: Uint8Array | null;
}

export interface AsepriteEncodeOptions {
  compressionLevel?: AsepriteCompressionLevel;
  frameGridIds?: Record<string, number>[];
  externalCelCache?: Map<number, CachedEncodedCel>;
  maxExternalCacheEntries?: number;
  maxExternalCacheBytes?: number;
}

const DEFAULT_MAX_EXTERNAL_CACHE_BYTES = 96 * 1024 * 1024; // 96 MB
const NATIVE_DEFLATE_MIN_RAW_BYTES = 262_144; // 256 KB

function evictExternalCelCache(
  cache: Map<number, CachedEncodedCel>,
  maxEntries: number,
  maxBytes: number
): void {
  let totalBytes = 0;
  cache.forEach((entry) => {
    totalBytes += entry.compressedBytes ? entry.compressedBytes.byteLength : 0;
  });

  while (cache.size > maxEntries || (totalBytes > maxBytes && cache.size > 0)) {
    const oldest = cache.entries().next().value;
    if (!oldest) break;
    const [oldestKey, oldestVal] = oldest;
    cache.delete(oldestKey);
    totalBytes -= oldestVal.compressedBytes ? oldestVal.compressedBytes.byteLength : 0;
  }
}

function storeInExternalCelCache(
  cache: Map<number, CachedEncodedCel>,
  gridId: number,
  entry: CachedEncodedCel,
  maxEntries: number,
  maxBytes: number
): void {
  const entryBytes = entry.compressedBytes ? entry.compressedBytes.byteLength : 0;
  cache.delete(gridId);
  if (entryBytes <= maxBytes) {
    cache.set(gridId, entry);
  }
  evictExternalCelCache(cache, maxEntries, maxBytes);
}

function computePixelGridHash(px: PixelGrid, width: number, height: number): number {
  const pxLen = px.length;
  let hash = (2166136261 ^ pxLen) | 0;
  const limit = Math.min(pxLen, width * height);
  for (let i = 0; i < limit; i++) {
    const val = px[i];
    if (val === EMPTY_PIXEL) continue;
    hash = Math.imul(hash ^ Math.imul(i + 1, 0x9e3779b1) ^ val, 16777619);
  }
  for (let i = width * height; i < pxLen; i++) {
    const val = px[i];
    if (val === EMPTY_PIXEL) continue;
    hash = Math.imul(hash ^ Math.imul(i + 1, 0x9e3779b1) ^ val, 16777619);
  }
  return hash;
}

function analyzeCelPixels(
  px: PixelGrid,
  width: number,
  height: number,
  computeHash: boolean
): CachedEncodedCel {
  const pxLen = px.length;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let nonNullCount = 0;
  let hash = computeHash ? ((2166136261 ^ pxLen) | 0) : 0;
  let hasIndexedValues = false;
  let hasStringValues = false;

  if (computeHash) {
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      if (rowOffset >= pxLen) break;
      const rowEnd = Math.min(width, pxLen - rowOffset);
      for (let x = 0; x < rowEnd; x++) {
        const i = rowOffset + x;
        const val = px[i];
        if (val === EMPTY_PIXEL) continue;
        nonNullCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if ((val >>> 24) !== 0) {
          hasStringValues = true;
        } else {
          hasIndexedValues = true;
        }
        hash = Math.imul(hash ^ Math.imul(i + 1, 0x9e3779b1) ^ val, 16777619);
      }
    }
    for (let i = width * height; i < pxLen; i++) {
      const val = px[i];
      if (val === EMPTY_PIXEL) continue;
      hash = Math.imul(hash ^ Math.imul(i + 1, 0x9e3779b1) ^ val, 16777619);
    }
  } else {
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      if (rowOffset >= pxLen) break;
      const rowEnd = Math.min(width, pxLen - rowOffset);
      for (let x = 0; x < rowEnd; x++) {
        const val = px[rowOffset + x];
        if (val === EMPTY_PIXEL) continue;
        nonNullCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if ((val >>> 24) !== 0) {
          hasStringValues = true;
        } else {
          hasIndexedValues = true;
        }
      }
    }
  }

  return {
    width,
    height,
    pxLen,
    hash,
    hasValidHash: computeHash,
    nonNullCount,
    minX,
    maxX,
    minY,
    maxY,
    hasIndexedValues,
    hasStringValues,
    compressedKey: null,
    compressedLevel: -1,
    compressedPaletteSig: null,
    compressedBytes: null,
  };
}

function buildCelRawBuffer(
  px: PixelGrid,
  width: number,
  height: number,
  minX: number,
  minY: number,
  celW: number,
  celH: number,
  isIndexed: boolean,
  hasIndexedValues: boolean,
  effectiveTransparentIndex: number,
  effectivePalette: string[]
): Uint8Array {
  // Zero-copy fast path for full-bleed little-endian RGBA cels (avoids 33MB copy on 4K photos)
  if (
    !isIndexed &&
    isLittleEndian &&
    !hasIndexedValues &&
    minX === 0 &&
    minY === 0 &&
    celW === width &&
    celH === height &&
    px.length >= width * height
  ) {
    return new Uint8Array(px.buffer, px.byteOffset, width * height * 4);
  }

  const bpp = isIndexed ? 1 : 4;
  const rawBuffer = new Uint8Array(celW * celH * bpp);

  if (!isIndexed && isLittleEndian && !hasIndexedValues) {
    const raw32 = new Uint32Array(rawBuffer.buffer);
    for (let cy = 0; cy < celH; cy++) {
      const srcStart = (minY + cy) * width + minX;
      raw32.set(px.subarray(srcStart, srcStart + celW), cy * celW);
    }
    return rawBuffer;
  }

  const palettePacked = isIndexed ? null : getPackedPalette255(effectivePalette);
  let rawOffset = 0;
  for (let cy = 0; cy < celH; cy++) {
    const rowBase = (minY + cy) * width + minX;
    for (let cx = 0; cx < celW; cx++) {
      const val = px[rowBase + cx];

      if (isIndexed) {
        if (val === EMPTY_PIXEL) {
          rawBuffer[rawOffset++] = effectiveTransparentIndex;
        } else if ((val >>> 24) === 0) {
          rawBuffer[rawOffset++] = decodeIndexedPixel(val) & 0xff;
        } else {
          rawBuffer[rawOffset++] = findNearestPaletteIndex(
            val & 0xff,
            (val >>> 8) & 0xff,
            (val >>> 16) & 0xff,
            effectivePalette
          );
        }
      } else {
        if (val === EMPTY_PIXEL) {
          rawOffset += 4;
        } else if ((val >>> 24) !== 0) {
          rawBuffer[rawOffset++] = val & 0xff;
          rawBuffer[rawOffset++] = (val >>> 8) & 0xff;
          rawBuffer[rawOffset++] = (val >>> 16) & 0xff;
          rawBuffer[rawOffset++] = (val >>> 24) & 0xff;
        } else {
          const pIdx = decodeIndexedPixel(val);
          const packed =
            palettePacked && pIdx >= 0 && pIdx < palettePacked.length
              ? palettePacked[pIdx]
              : 0;
          rawBuffer[rawOffset++] = packed & 0xff;
          rawBuffer[rawOffset++] = (packed >>> 8) & 0xff;
          rawBuffer[rawOffset++] = (packed >>> 16) & 0xff;
          rawBuffer[rawOffset++] = (packed >>> 24) & 0xff;
        }
      }
    }
  }
  return rawBuffer;
}

async function deflateWithCompressionStream(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    // Kick off write without awaiting first so large buffers don't deadlock on TransformStream backpressure
    const writePromise = writer.write(data as BufferSource).then(() => writer.close());
    writePromise.catch(() => {});

    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLen += value.byteLength;
      }
    }
    await writePromise;

    if (chunks.length === 1) return chunks[0];
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      out.set(chunks[i], offset);
      offset += chunks[i].byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Asynchronously pre-compresses large cels (>= 256 KB raw) using native browser CompressionStream('deflate')
 * (RFC 1950 zlib format, 3-5x faster than JS pako on 4K photos) and stores results in the cel cache
 * so encodeAseprite can reuse them with zero JS deflate work.
 */
export async function precompressLargeCelsInCache(
  state: AsepriteEncodeInput,
  options?: AsepriteEncodeOptions
): Promise<void> {
  if (typeof CompressionStream === 'undefined') return;
  const { width, height, colorMode, palette = [], layers, frames } = state;
  const compressionLevel: AsepriteCompressionLevel = options?.compressionLevel ?? 6;
  const externalCelCache = options?.externalCelCache;
  const frameGridIds = options?.frameGridIds;
  const maxExternalCacheEntries = options?.maxExternalCacheEntries ?? 48;
  const maxExternalCacheBytes = options?.maxExternalCacheBytes ?? DEFAULT_MAX_EXTERNAL_CACHE_BYTES;

  const effectivePalette = palette && palette.length > 0 ? palette : FALLBACK_ASEPRITE_PALETTE;
  const paletteSig = effectivePalette.join(',');
  const numFrames = frames.length;
  const needHash = numFrames > 1;
  const isIndexed = colorMode === 'indexed';
  const effectiveTransparentIndex =
    state.transparentIndex !== undefined && state.transparentIndex >= 0
      ? state.transparentIndex
      : isIndexed
        ? effectivePalette.length <= 255
          ? 255
          : 0
        : 0;
  const compressedKey = `${isIndexed ? 1 : 0}:${effectiveTransparentIndex}`;

  const seenGridIds = new Set<number>();
  const seenGrids = new Set<PixelGrid>();

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frame = frames[frameIdx];
    const curFrameGridIds = frameGridIds?.[frameIdx];
    for (let lIdx = 0; lIdx < layers.length; lIdx++) {
      const layer = layers[lIdx];
      if (layer.type === 'group') continue;
      const px = frame.layerData[layer.id];
      if (!px || px.length === 0) continue;

      const gridId = curFrameGridIds ? curFrameGridIds[layer.id] : undefined;
      if (gridId !== undefined) {
        if (seenGridIds.has(gridId)) continue;
        seenGridIds.add(gridId);
      } else {
        if (seenGrids.has(px)) continue;
        seenGrids.add(px);
      }

      let cachedAnalysis =
        (externalCelCache && gridId !== undefined ? externalCelCache.get(gridId) : undefined) ??
        ENCODED_CEL_CACHE.get(px);

      if (
        !cachedAnalysis ||
        cachedAnalysis.width !== width ||
        cachedAnalysis.height !== height ||
        cachedAnalysis.pxLen !== px.length
      ) {
        cachedAnalysis = analyzeCelPixels(px, width, height, needHash);
        ENCODED_CEL_CACHE.set(px, cachedAnalysis);
      } else if (needHash && !cachedAnalysis.hasValidHash) {
        cachedAnalysis.hash = computePixelGridHash(px, width, height);
        cachedAnalysis.hasValidHash = true;
      }

      if (cachedAnalysis.nonNullCount === 0) continue;

      const celW = cachedAnalysis.maxX - cachedAnalysis.minX + 1;
      const celH = cachedAnalysis.maxY - cachedAnalysis.minY + 1;
      const rawByteSize = celW * celH * (isIndexed ? 1 : 4);
      if (rawByteSize < NATIVE_DEFLATE_MIN_RAW_BYTES) continue;

      const needsPaletteMatch = isIndexed
        ? cachedAnalysis.hasStringValues
        : cachedAnalysis.hasIndexedValues;
      const alreadyCompressed = Boolean(
        cachedAnalysis.compressedBytes &&
          cachedAnalysis.compressedKey === compressedKey &&
          cachedAnalysis.compressedLevel >= compressionLevel &&
          (!needsPaletteMatch || cachedAnalysis.compressedPaletteSig === paletteSig)
      );
      if (alreadyCompressed) continue;

      const rawBuffer = buildCelRawBuffer(
        px,
        width,
        height,
        cachedAnalysis.minX,
        cachedAnalysis.minY,
        celW,
        celH,
        isIndexed,
        cachedAnalysis.hasIndexedValues,
        effectiveTransparentIndex,
        effectivePalette
      );

      const compressed = await deflateWithCompressionStream(rawBuffer);
      if (!compressed) continue;

      cachedAnalysis.compressedKey = compressedKey;
      cachedAnalysis.compressedLevel = compressionLevel;
      cachedAnalysis.compressedPaletteSig = paletteSig;
      cachedAnalysis.compressedBytes = compressed;
      ENCODED_CEL_CACHE.set(px, cachedAnalysis);

      if (externalCelCache && gridId !== undefined) {
        storeInExternalCelCache(
          externalCelCache,
          gridId,
          cachedAnalysis,
          maxExternalCacheEntries,
          maxExternalCacheBytes
        );
      }
    }
  }
}

const ENCODED_CEL_CACHE = new WeakMap<PixelGrid, CachedEncodedCel>();

export type AsepriteEncodeInput = Pick<
  ProjectState,
  | 'width'
  | 'height'
  | 'colorMode'
  | 'palette'
  | 'paletteNames'
  | 'layers'
  | 'frames'
  | 'tags'
  | 'slices'
  | 'tilesets'
  | 'externalFiles'
  | 'colorProfile'
  | 'transparentIndex'
  | 'grid'
  | 'pixelRatio'
  | 'userData'
>;

/**
 * Encodes a ProjectState object into a binary Aseprite (.ase/.aseprite) Uint8Array buffer.
 */
export function encodeAseprite(
  state: AsepriteEncodeInput,
  options?: AsepriteEncodeOptions
): Uint8Array {
  const { 
    width, height, colorMode, palette = [], paletteNames, layers, frames, 
    tags = [], slices = [], tilesets = [], externalFiles = [], userData 
  } = state;
  const compressionLevel: AsepriteCompressionLevel = options?.compressionLevel ?? 6;
  const externalCelCache = options?.externalCelCache;
  const frameGridIds = options?.frameGridIds;
  const maxExternalCacheEntries = options?.maxExternalCacheEntries ?? 48;
  const maxExternalCacheBytes = options?.maxExternalCacheBytes ?? DEFAULT_MAX_EXTERNAL_CACHE_BYTES;

  const effectivePalette = (palette && palette.length > 0) 
    ? palette 
    : FALLBACK_ASEPRITE_PALETTE;
  const paletteSig = effectivePalette.join(',');
  const numFrames = frames.length;
  const needLinkedCelHash = numFrames > 1;
  const isIndexed = colorMode === 'indexed';
  const colorDepth = isIndexed ? 8 : 32;

  // In indexed mode, if transparentIndex is not explicitly set, designate an index
  // outside the active palette colors (e.g. 255 if palette has <= 255 colors)
  // so palette color index 0 is never lost as transparent.
  const effectiveTransparentIndex = (state.transparentIndex !== undefined && state.transparentIndex >= 0)
    ? state.transparentIndex
    : (isIndexed ? (effectivePalette.length <= 255 ? 255 : 0) : 0);

  const hasUuids = layers.some(l => l.uuid);
  const headerFlags = 3 | (hasUuids ? 4 : 0);

  const asepriteLayers = convertAppOrderToAsepriteChunkOrder(layers);
  const asepriteLayerById = new Map<string, Layer>();
  for (let i = 0; i < asepriteLayers.length; i++) {
    asepriteLayerById.set(asepriteLayers[i].id, asepriteLayers[i]);
  }

  interface CelSignatureEntry {
    frameIdx: number;
    px: PixelGrid | null;
    compressedBytes: Uint8Array | null;
    len: number;
    nonNullCount: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }
  const seenGridByLayer: Map<PixelGrid, number>[] = asepriteLayers.map(() => new Map());
  const seenGridIdByLayer: Map<number, number>[] = asepriteLayers.map(() => new Map());
  const celBucketsByLayer: Map<number, CelSignatureEntry[]>[] = asepriteLayers.map(() => new Map());

  interface EncodedFrameParts {
    header: Uint8Array;
    parts: Uint8Array[];
    totalBytes: number;
  }
  const encodedFrames: EncodedFrameParts[] = [];

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frame = frames[frameIdx];
    const frameChunksWriter = new BinaryWriter(frameIdx === 0 ? 1024 * 16 : 256);
    const frameExtraParts: Uint8Array[] = [];
    let frameExtraBytes = 0;
    let numChunksInFrame = 0;

    // --- Frame 0 Special Header Chunks ---
    if (frameIdx === 0) {
      // 1. Color Profile Chunk (0x2007)
      const cpWriter = new BinaryWriter(32);
      cpWriter.writeDword(0);
      cpWriter.writeWord(0x2007);
      cpWriter.writeWord(state.colorProfile?.type ?? 1);
      cpWriter.writeWord(state.colorProfile?.flags ?? 0);
      cpWriter.writeFixed(state.colorProfile?.gamma ?? 1.0);
      cpWriter.writeBytes(new Uint8Array(8));
      if (state.colorProfile?.type === 2 && state.colorProfile.iccData) {
        cpWriter.writeDword(state.colorProfile.iccData.length);
        cpWriter.writeBytes(state.colorProfile.iccData);
      }
      const cpBytes = cpWriter.getBytes();
      new DataView(cpBytes.buffer).setUint32(0, cpBytes.length, true);
      frameChunksWriter.writeBytes(cpBytes);
      numChunksInFrame++;

      // 2. Palette Chunk (0x2019)
      const palWriter = new BinaryWriter(1024 * 8);
      palWriter.writeDword(0);
      palWriter.writeWord(0x2019);
      palWriter.writeDword(effectivePalette.length);
      palWriter.writeDword(0);
      palWriter.writeDword(effectivePalette.length - 1);
      palWriter.writeBytes(new Uint8Array(8));

      for (let p = 0; p < effectivePalette.length; p++) {
        const hex = effectivePalette[p] || '#000000';
        const [r, g, b] = hexToRgb(hex);
        const a = 255;
        const cName = paletteNames?.[p];
        palWriter.writeWord(cName ? 1 : 0);
        palWriter.writeByte(r);
        palWriter.writeByte(g);
        palWriter.writeByte(b);
        palWriter.writeByte(a);
        if (cName) {
          palWriter.writeString(cName);
        }
      }
      const palBytes = palWriter.getBytes();
      new DataView(palBytes.buffer).setUint32(0, palBytes.length, true);
      frameChunksWriter.writeBytes(palBytes);
      numChunksInFrame++;

      // 3. External Files Chunk (0x2008)
      if (externalFiles.length > 0) {
        const extWriter = new BinaryWriter(256);
        extWriter.writeDword(0);
        extWriter.writeWord(0x2008);
        extWriter.writeDword(externalFiles.length);
        extWriter.writeBytes(new Uint8Array(8));
        for (const ext of externalFiles) {
          extWriter.writeDword(ext.id);
          extWriter.writeByte(ext.type);
          extWriter.writeBytes(new Uint8Array(7));
          extWriter.writeString(ext.filename);
        }
        const extBytes = extWriter.getBytes();
        new DataView(extBytes.buffer).setUint32(0, extBytes.length, true);
        frameChunksWriter.writeBytes(extBytes);
        numChunksInFrame++;
      }

      // 4. Layer Chunks (0x2004)
      for (let lIdx = 0; lIdx < asepriteLayers.length; lIdx++) {
        const layer = asepriteLayers[lIdx];
        const lWriter = new BinaryWriter(256);
        lWriter.writeDword(0);
        lWriter.writeWord(0x2004);

        let lFlags = 0;
        if (layer.visible) lFlags |= 1;
        if (!layer.locked) lFlags |= 2;
        if (layer.lockMovement) lFlags |= 4;
        if (layer.isBackground) lFlags |= 8;
        if (layer.preferLinkedCels) lFlags |= 16;
        if (layer.collapsed) lFlags |= 32;
        if (layer.isReference) lFlags |= 64;

        let lType = 0;
        if (layer.type === 'group') lType = 1;
        if (layer.type === 'tilemap') lType = 2;

        lWriter.writeWord(lFlags);
        lWriter.writeWord(lType);
        
        let computedChildLevel = layer.childLevel ?? 0;
        if (layer.parentId) {
          let p = asepriteLayerById.get(layer.parentId);
          let depth = 0;
          while (p) {
            depth++;
            p = p.parentId ? asepriteLayerById.get(p.parentId) : undefined;
          }
          computedChildLevel = depth;
        }
        lWriter.writeWord(computedChildLevel);
        lWriter.writeWord(width);
        lWriter.writeWord(height);
        lWriter.writeWord(BLEND_MODE_TO_ASEPRITE[layer.blendMode] ?? 0);
        lWriter.writeByte(Math.round(((layer.opacity ?? 100) / 100) * 255));
        lWriter.writeBytes(new Uint8Array(3));
        lWriter.writeString(layer.name);

        if (lType === 2) {
          lWriter.writeDword(layer.tilesetIndex || 0);
        }

        if (headerFlags & 4) {
          const hex = (layer.uuid || '').replace(/-/g, '').padStart(32, '0');
          const uuidBytes = new Uint8Array(16);
          for (let i = 0; i < 16; i++) {
            uuidBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) || 0;
          }
          lWriter.writeBytes(uuidBytes);
        }

        const lBytes = lWriter.getBytes();
        new DataView(lBytes.buffer).setUint32(0, lBytes.length, true);
        frameChunksWriter.writeBytes(lBytes);
        numChunksInFrame++;

        if (layer.userData) {
          const uBytes = encodeUserDataChunk(layer.userData);
          frameChunksWriter.writeBytes(uBytes);
          numChunksInFrame++;
        }
      }

      // 5. Tileset Chunks (0x2023)
      for (const ts of tilesets) {
        const tsWriter = new BinaryWriter(1024);
        tsWriter.writeDword(0);
        tsWriter.writeWord(0x2023);
        tsWriter.writeDword(ts.id);

        let tsFlags = 0;
        if (ts.externalFileId !== undefined) tsFlags |= 1;
        if (ts.pixels && ts.pixels.length > 0) tsFlags |= 2;

        tsWriter.writeDword(tsFlags);
        tsWriter.writeDword(ts.tilesCount);
        tsWriter.writeWord(ts.tileWidth);
        tsWriter.writeWord(ts.tileHeight);
        tsWriter.writeShort(ts.baseIndex);
        tsWriter.writeBytes(new Uint8Array(14));
        tsWriter.writeString(ts.name);

        if (tsFlags & 1) {
          tsWriter.writeDword(ts.externalFileId || 0);
          tsWriter.writeDword(ts.externalTilesetId || 0);
        }

        if (tsFlags & 2 && ts.pixels) {
          const totalPixels = ts.tileWidth * ts.tileHeight * ts.tilesCount;
          const bpp = isIndexed ? 1 : 4;
          const rawTiles = new Uint8Array(totalPixels * bpp);
          const palettePacked = getPackedPalette255(effectivePalette);
          let pOff = 0;
          for (let i = 0; i < totalPixels; i++) {
            const val = ts.pixels[i];
            if (isIndexed) {
              if (val === EMPTY_PIXEL) {
                rawTiles[pOff++] = effectiveTransparentIndex;
              } else if (!isPackedRgbaPixel(val)) {
                rawTiles[pOff++] = decodeIndexedPixel(val) & 0xff;
              } else {
                rawTiles[pOff++] = findNearestPaletteIndex(
                  val & 0xff,
                  (val >>> 8) & 0xff,
                  (val >>> 16) & 0xff,
                  effectivePalette
                );
              }
            } else {
              if (val === EMPTY_PIXEL) {
                pOff += 4;
              } else if (isPackedRgbaPixel(val)) {
                rawTiles[pOff++] = val & 0xff;
                rawTiles[pOff++] = (val >>> 8) & 0xff;
                rawTiles[pOff++] = (val >>> 16) & 0xff;
                rawTiles[pOff++] = (val >>> 24) & 0xff;
              } else {
                const pIdx = decodeIndexedPixel(val);
                const packed = pIdx >= 0 && pIdx < palettePacked.length ? palettePacked[pIdx] : 0;
                rawTiles[pOff++] = packed & 0xff;
                rawTiles[pOff++] = (packed >>> 8) & 0xff;
                rawTiles[pOff++] = (packed >>> 16) & 0xff;
                rawTiles[pOff++] = (packed >>> 24) & 0xff;
              }
            }
          }
          const compTiles = deflate(rawTiles);
          tsWriter.writeDword(compTiles.length);
          tsWriter.writeBytes(compTiles);
        }

        const tsBytes = tsWriter.getBytes();
        new DataView(tsBytes.buffer).setUint32(0, tsBytes.length, true);
        frameChunksWriter.writeBytes(tsBytes);
        numChunksInFrame++;

        if (ts.userData) {
          const uBytes = encodeUserDataChunk(ts.userData);
          frameChunksWriter.writeBytes(uBytes);
          numChunksInFrame++;
        }
      }

      // 6. Tags Chunk (0x2018)
      if (tags.length > 0) {
        const tWriter = new BinaryWriter(1024);
        tWriter.writeDword(0);
        tWriter.writeWord(0x2018);
        tWriter.writeWord(tags.length);
        tWriter.writeBytes(new Uint8Array(8));

        const dirMap: Record<string, number> = {
          'forward': 0, 'reverse': 1, 'ping-pong': 2, 'ping-pong-reverse': 3
        };

        for (const tag of tags) {
          tWriter.writeWord(tag.from);
          tWriter.writeWord(tag.to);
          tWriter.writeByte(dirMap[tag.direction || 'forward'] ?? 0);
          tWriter.writeWord(tag.repeat || 0);
          tWriter.writeBytes(new Uint8Array(6));
          const [tr, tg, tb] = tag.color ? hexToRgb(tag.color) : [0, 0, 0];
          tWriter.writeByte(tr);
          tWriter.writeByte(tg);
          tWriter.writeByte(tb);
          tWriter.writeByte(0);
          tWriter.writeString(tag.name);
        }
        const tBytes = tWriter.getBytes();
        new DataView(tBytes.buffer).setUint32(0, tBytes.length, true);
        frameChunksWriter.writeBytes(tBytes);
        numChunksInFrame++;

        if (tags.some(t => t.userData)) {
          for (const tag of tags) {
            const uBytes = encodeUserDataChunk(tag.userData || {});
            frameChunksWriter.writeBytes(uBytes);
            numChunksInFrame++;
          }
        }
      }

      // 7. Slices Chunk (0x2022)
      for (const slice of slices) {
        const sWriter = new BinaryWriter(512);
        sWriter.writeDword(0);
        sWriter.writeWord(0x2022);
        sWriter.writeDword(slice.keys.length);

        let sFlags = 0;
        if (slice.keys.some(k => k.center)) sFlags |= 1;
        if (slice.keys.some(k => k.pivot)) sFlags |= 2;

        sWriter.writeDword(sFlags);
        sWriter.writeDword(0);
        sWriter.writeString(slice.name);

        for (const key of slice.keys) {
          sWriter.writeDword(key.frame || key.frameIndex || 0);
          sWriter.writeLong(key.x);
          sWriter.writeLong(key.y);
          sWriter.writeDword(key.w);
          sWriter.writeDword(key.h);

          if (sFlags & 1) {
            sWriter.writeLong(key.center?.x || 0);
            sWriter.writeLong(key.center?.y || 0);
            sWriter.writeDword(key.center?.w || 0);
            sWriter.writeDword(key.center?.h || 0);
          }

          if (sFlags & 2) {
            sWriter.writeLong(key.pivot?.x || 0);
            sWriter.writeLong(key.pivot?.y || 0);
          }
        }
        const sBytes = sWriter.getBytes();
        new DataView(sBytes.buffer).setUint32(0, sBytes.length, true);
        frameChunksWriter.writeBytes(sBytes);
        numChunksInFrame++;

        if (slice.userData) {
          const uBytes = encodeUserDataChunk(slice.userData);
          frameChunksWriter.writeBytes(uBytes);
          numChunksInFrame++;
        }
      }

      // 8. Sprite User Data Chunk (0x2020)
      if (userData) {
        const uBytes = encodeUserDataChunk(userData);
        frameChunksWriter.writeBytes(uBytes);
        numChunksInFrame++;
      }
    }

    // --- Cel Chunks for this frame ---
    const compressedKey = `${isIndexed ? 1 : 0}:${effectiveTransparentIndex}`;
    const curFrameGridIds = frameGridIds?.[frameIdx];

    for (let lIdx = 0; lIdx < asepriteLayers.length; lIdx++) {
      const layer = asepriteLayers[lIdx];
      if (layer.type === 'group') continue;
      const px = frame.layerData[layer.id];
      const gridId = curFrameGridIds ? curFrameGridIds[layer.id] : undefined;

      // Lookup worker-persistent cache when gridId is provided
      let externalCached: CachedEncodedCel | undefined;
      if (externalCelCache && gridId !== undefined) {
        externalCached = externalCelCache.get(gridId);
        if (externalCached) {
          // Refresh LRU position
          externalCelCache.delete(gridId);
          externalCelCache.set(gridId, externalCached);
        }
      }

      if (!px && !externalCached) continue;

      const seenGrids = seenGridByLayer[lIdx];
      const seenGridIds = seenGridIdByLayer[lIdx];
      const celBuckets = celBucketsByLayer[lIdx];

      let linkedFrameIdx = -1;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      let hasPixels = false;
      let cachedAnalysis: CachedEncodedCel | undefined;

      // O(1) fast path when a frame shares the exact same PixelGrid reference or gridId
      const refMatch = needLinkedCelHash
        ? ((gridId !== undefined ? seenGridIds.get(gridId) : undefined) ??
          (px ? seenGrids.get(px) : undefined))
        : undefined;

      if (refMatch !== undefined) {
        linkedFrameIdx = refMatch;
      } else {
        const pxLen = px ? px.length : (externalCached?.pxLen ?? width * height);
        cachedAnalysis = externalCached ?? (px ? ENCODED_CEL_CACHE.get(px) : undefined);

        if (
          !cachedAnalysis ||
          cachedAnalysis.width !== width ||
          cachedAnalysis.height !== height ||
          cachedAnalysis.pxLen !== pxLen
        ) {
          if (!px) continue;
          cachedAnalysis = analyzeCelPixels(px, width, height, needLinkedCelHash);
          ENCODED_CEL_CACHE.set(px, cachedAnalysis);
        } else {
          if (needLinkedCelHash && !cachedAnalysis.hasValidHash && px) {
            cachedAnalysis.hash = computePixelGridHash(px, width, height);
            cachedAnalysis.hasValidHash = true;
          }
          minX = cachedAnalysis.minX;
          maxX = cachedAnalysis.maxX;
          minY = cachedAnalysis.minY;
          maxY = cachedAnalysis.maxY;
        }

        minX = cachedAnalysis.minX;
        maxX = cachedAnalysis.maxX;
        minY = cachedAnalysis.minY;
        maxY = cachedAnalysis.maxY;

        const { hash, nonNullCount } = cachedAnalysis;
        hasPixels = nonNullCount > 0;

        if (needLinkedCelHash) {
          const bucket = celBuckets.get(hash);
          if (bucket) {
            for (let b = 0; b < bucket.length; b++) {
              const entry = bucket[b];
              if (
                entry.len === pxLen &&
                entry.nonNullCount === nonNullCount &&
                entry.minX === minX &&
                entry.maxX === maxX &&
                entry.minY === minY &&
                entry.maxY === maxY &&
                ((px && entry.px && isPixelGridEqual(px, entry.px)) ||
                  (cachedAnalysis.compressedBytes &&
                    entry.compressedBytes &&
                    isUint8ArrayEqual(cachedAnalysis.compressedBytes, entry.compressedBytes)))
              ) {
                linkedFrameIdx = entry.frameIdx;
                break;
              }
            }
          }

          if (linkedFrameIdx >= 0) {
            if (px) seenGrids.set(px, linkedFrameIdx);
            if (gridId !== undefined) seenGridIds.set(gridId, linkedFrameIdx);
          } else {
            if (px) seenGrids.set(px, frameIdx);
            if (gridId !== undefined) seenGridIds.set(gridId, frameIdx);
          }
        }
      }

      if (linkedFrameIdx >= 0) {
        const celWriter = new BinaryWriter(32);
        celWriter.writeDword(0);
        celWriter.writeWord(0x2005);
        celWriter.writeWord(lIdx);
        celWriter.writeShort(0);
        celWriter.writeShort(0);
        celWriter.writeByte(255);
        celWriter.writeWord(1); // Linked
        celWriter.writeShort(0);
        celWriter.writeBytes(new Uint8Array(5));
        celWriter.writeWord(linkedFrameIdx);

        const celBytes = celWriter.getBytes();
        new DataView(celBytes.buffer).setUint32(0, celBytes.length, true);
        frameExtraParts.push(celBytes);
        frameExtraBytes += celBytes.byteLength;
        numChunksInFrame++;
      } else {
        if (hasPixels && cachedAnalysis) {
          const celW = maxX - minX + 1;
          const celH = maxY - minY + 1;
          const needsPaletteMatch = isIndexed
            ? cachedAnalysis.hasStringValues
            : cachedAnalysis.hasIndexedValues;
          const canReuseCompressed = Boolean(
            cachedAnalysis.compressedBytes &&
            cachedAnalysis.compressedKey === compressedKey &&
            cachedAnalysis.compressedLevel >= compressionLevel &&
            (!needsPaletteMatch || cachedAnalysis.compressedPaletteSig === paletteSig)
          );

          let compressedCelBytes: Uint8Array;
          if (canReuseCompressed && cachedAnalysis.compressedBytes) {
            compressedCelBytes = cachedAnalysis.compressedBytes;
          } else {
            if (!px) continue;
            const rawBuffer = buildCelRawBuffer(
              px,
              width,
              height,
              minX,
              minY,
              celW,
              celH,
              isIndexed,
              cachedAnalysis.hasIndexedValues,
              effectiveTransparentIndex,
              effectivePalette
            );

            compressedCelBytes = deflate(rawBuffer, { level: compressionLevel });
            cachedAnalysis.compressedKey = compressedKey;
            cachedAnalysis.compressedLevel = compressionLevel;
            cachedAnalysis.compressedPaletteSig = paletteSig;
            cachedAnalysis.compressedBytes = compressedCelBytes;
          }

          if (externalCelCache && gridId !== undefined) {
            storeInExternalCelCache(
              externalCelCache,
              gridId,
              cachedAnalysis,
              maxExternalCacheEntries,
              maxExternalCacheBytes
            );
          }

          // Register in celBuckets only when multi-frame linked cel deduplication is possible
          if (needLinkedCelHash) {
            const bucket = celBuckets.get(cachedAnalysis.hash);
            const sigEntry: CelSignatureEntry = {
              frameIdx,
              px: px ?? null,
              compressedBytes: compressedCelBytes,
              len: cachedAnalysis.pxLen,
              nonNullCount: cachedAnalysis.nonNullCount,
              minX,
              maxX,
              minY,
              maxY,
            };
            if (bucket) {
              bucket.push(sigEntry);
            } else {
              celBuckets.set(cachedAnalysis.hash, [sigEntry]);
            }
          }

          // Write only the 26-byte cel header and attach compressedCelBytes directly (zero intermediate copies)
          const celHeader = new Uint8Array(26);
          const celHeaderView = new DataView(celHeader.buffer);
          const celChunkTotalSize = 26 + compressedCelBytes.byteLength;
          celHeaderView.setUint32(0, celChunkTotalSize, true);
          celHeaderView.setUint16(4, 0x2005, true);
          celHeaderView.setUint16(6, lIdx, true);
          celHeaderView.setInt16(8, minX, true);
          celHeaderView.setInt16(10, minY, true);
          celHeaderView.setUint8(12, 255);
          celHeaderView.setUint16(13, 2, true); // Compressed Image
          celHeaderView.setInt16(15, 0, true); // zIndex
          // bytes 17..21 reserved zeros
          celHeaderView.setUint16(22, celW, true);
          celHeaderView.setUint16(24, celH, true);

          frameExtraParts.push(celHeader, compressedCelBytes);
          frameExtraBytes += celChunkTotalSize;
          numChunksInFrame++;
        } else if (externalCelCache && gridId !== undefined && cachedAnalysis) {
          storeInExternalCelCache(
            externalCelCache,
            gridId,
            cachedAnalysis,
            maxExternalCacheEntries,
            maxExternalCacheBytes
          );
        }
      }
    }

    const metaChunksData = frameChunksWriter.getBytes();
    const frameParts: Uint8Array[] = [];
    if (metaChunksData.byteLength > 0) {
      frameParts.push(metaChunksData);
    }
    for (let p = 0; p < frameExtraParts.length; p++) {
      frameParts.push(frameExtraParts[p]);
    }
    const frameTotalBytes = 16 + metaChunksData.byteLength + frameExtraBytes;

    const frameHeader = new Uint8Array(16);
    const frameHeaderView = new DataView(frameHeader.buffer);
    frameHeaderView.setUint32(0, frameTotalBytes, true);
    frameHeaderView.setUint16(4, 0xf1fa, true);
    frameHeaderView.setUint16(6, numChunksInFrame > 0xffff ? 0xffff : numChunksInFrame, true);
    frameHeaderView.setUint16(8, frame.duration || 100, true);
    // bytes 10..11 reserved zeros
    frameHeaderView.setUint32(12, numChunksInFrame, true);

    encodedFrames.push({
      header: frameHeader,
      parts: frameParts,
      totalBytes: frameTotalBytes,
    });
  }

  let totalFramesBytes = 0;
  for (let i = 0; i < encodedFrames.length; i++) {
    totalFramesBytes += encodedFrames[i].totalBytes;
  }
  const totalFileSize = 128 + totalFramesBytes;

  // Single final allocation: write file header + all frames/chunks directly once
  const output = new Uint8Array(totalFileSize);
  const headerView = new DataView(output.buffer);
  headerView.setUint32(0, totalFileSize, true);
  headerView.setUint16(4, 0xa5e0, true);
  headerView.setUint16(6, numFrames, true);
  headerView.setUint16(8, width, true);
  headerView.setUint16(10, height, true);
  headerView.setUint16(12, colorDepth, true);
  headerView.setUint32(14, headerFlags, true);
  headerView.setUint16(18, frames[0]?.duration || 100, true);
  headerView.setUint32(20, 0, true);
  headerView.setUint32(24, 0, true);
  headerView.setUint8(28, effectiveTransparentIndex);
  // bytes 29..31 reserved zeros
  headerView.setUint16(32, effectivePalette.length, true);
  headerView.setUint8(34, state.pixelRatio?.width || 1);
  headerView.setUint8(35, state.pixelRatio?.height || 1);
  headerView.setInt16(36, state.grid?.x || 0, true);
  headerView.setInt16(38, state.grid?.y || 0, true);
  headerView.setUint16(40, state.grid?.width || 0, true);
  headerView.setUint16(42, state.grid?.height || 0, true);
  // bytes 44..127 reserved zeros

  let writeOffset = 128;
  for (let f = 0; f < encodedFrames.length; f++) {
    const ef = encodedFrames[f];
    output.set(ef.header, writeOffset);
    writeOffset += ef.header.byteLength;
    for (let p = 0; p < ef.parts.length; p++) {
      const part = ef.parts[p];
      output.set(part, writeOffset);
      writeOffset += part.byteLength;
    }
  }

  return output;
}

function isPixelGridEqual(a: PixelGrid, b: PixelGrid): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isUint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
