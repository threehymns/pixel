import { GifWriter } from 'omggif';
import { ProjectState } from '../types';
import { renderFrameToCanvas } from '../utils';

export interface ExportPngOptions {
  state: ProjectState;
  scale?: number;
  frameIndex?: number;
  backgroundColor?: string | null;
}

export interface ExportSpriteSheetOptions {
  state: ProjectState;
  scale?: number;
  columns?: number;
  frameIndices?: number[];
  backgroundColor?: string | null;
}

export interface ExportGifOptions {
  state: ProjectState;
  scale?: number;
  fps?: number;
  loop?: number; // 0 = infinite
  frameIndices?: number[];
  backgroundColor?: string | null;
  transparent?: boolean;
  onProgress?: (percent: number) => void;
}

export const renderScaledFrameCanvas = (
  state: ProjectState,
  frameIndex: number,
  scale: number = 1,
  backgroundColor?: string | null
): HTMLCanvasElement => {
  const rawCanvas = renderFrameToCanvas(state, frameIndex);
  const targetW = state.width * scale;
  const targetH = state.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawCanvas;

  ctx.imageSmoothingEnabled = false;

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  ctx.drawImage(rawCanvas, 0, 0, state.width, state.height, 0, 0, targetW, targetH);
  return canvas;
};

export const renderCustomSpriteSheetCanvas = (options: ExportSpriteSheetOptions): HTMLCanvasElement => {
  const { state, scale = 1, columns, frameIndices, backgroundColor } = options;
  const targetFrames = frameIndices && frameIndices.length > 0 
    ? frameIndices 
    : state.frames.map((_, i) => i);

  const cols = columns && columns > 0 ? columns : targetFrames.length;
  const rows = Math.ceil(targetFrames.length / cols);

  const frameW = state.width * scale;
  const frameH = state.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = cols * frameW;
  canvas.height = rows * frameH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  targetFrames.forEach((frameIdx, i) => {
    const rawFrameCanvas = renderFrameToCanvas(state, frameIdx);
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(
      rawFrameCanvas,
      0, 0, state.width, state.height,
      col * frameW, row * frameH, frameW, frameH
    );
  });

  return canvas;
};

interface PaletteResult {
  indexedPixels: Uint8Array;
  palette: number[];
  transparentIndex: number;
}

const processImageDataToPalette = (
  imgData: Uint8ClampedArray,
  totalPixels: number,
  allowTransparency: boolean
): PaletteResult => {
  let hasTransparent = false;
  const colorFrequency = new Map<number, number>();

  // Scan image data for colors & transparency
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const a = imgData[idx + 3];
    if (a < 128 && allowTransparency) {
      hasTransparent = true;
    } else {
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const rgb = (r << 16) | (g << 8) | b;
      colorFrequency.set(rgb, (colorFrequency.get(rgb) || 0) + 1);
    }
  }

  const transparentIndex = hasTransparent ? 0 : -1;
  const maxOpaqueColors = hasTransparent ? 255 : 256;

  const sortedColors = Array.from(colorFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  const palette: number[] = [];
  if (hasTransparent) {
    palette.push(0x000000); // Index 0 reserved for transparency
  }

  const paletteColorMap = new Map<number, number>();

  if (sortedColors.length <= maxOpaqueColors) {
    // Fits completely in palette
    sortedColors.forEach(rgb => {
      const pIdx = palette.length;
      palette.push(rgb);
      paletteColorMap.set(rgb, pIdx);
    });
  } else {
    // Exceeds max palette size: take top colors and quantify rest
    const topColors = sortedColors.slice(0, maxOpaqueColors);
    topColors.forEach(rgb => {
      const pIdx = palette.length;
      palette.push(rgb);
      paletteColorMap.set(rgb, pIdx);
    });
  }

  // Ensure palette has at least 2 colors for omggif
  while (palette.length < 2) {
    palette.push(0x000000);
  }

  const indexedPixels = new Uint8Array(totalPixels);

  // Helper for nearest color lookup if quantized
  const findNearestPaletteIndex = (rgb: number): number => {
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;

    let minDist = Infinity;
    let bestIdx = hasTransparent ? 1 : 0;

    const startIdx = hasTransparent ? 1 : 0;
    for (let p = startIdx; p < palette.length; p++) {
      const pr = (palette[p] >> 16) & 0xff;
      const pg = (palette[p] >> 8) & 0xff;
      const pb = palette[p] & 0xff;
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (dist < minDist) {
        minDist = dist;
        bestIdx = p;
      }
    }
    return bestIdx;
  };

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const a = imgData[idx + 3];
    if (a < 128 && allowTransparency) {
      indexedPixels[i] = transparentIndex;
    } else {
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const rgb = (r << 16) | (g << 8) | b;

      let pIdx = paletteColorMap.get(rgb);
      if (pIdx === undefined) {
        pIdx = findNearestPaletteIndex(rgb);
        paletteColorMap.set(rgb, pIdx);
      }
      indexedPixels[i] = pIdx;
    }
  }

  return { indexedPixels, palette, transparentIndex };
};

export const generateGifBlob = async (options: ExportGifOptions): Promise<Blob> => {
  const {
    state,
    scale = 1,
    fps = 10,
    loop = 0,
    frameIndices,
    backgroundColor,
    transparent = true,
    onProgress
  } = options;

  const targetFrames = frameIndices && frameIndices.length > 0
    ? frameIndices
    : state.frames.map((_, i) => i);

  const width = state.width * scale;
  const height = state.height * scale;
  const totalPixels = width * height;

  // Centiseconds delay for frame (10 FPS = 10 centiseconds)
  const delayCentiseconds = Math.max(1, Math.round(100 / Math.max(1, fps)));

  // Allocate buffer for GIF encoder
  const maxBufferSize = width * height * targetFrames.length * 5 + 2048;
  const buffer = new Uint8Array(maxBufferSize);
  const writer = new GifWriter(buffer, width, height, { loop });

  for (let f = 0; f < targetFrames.length; f++) {
    const frameIdx = targetFrames[f];
    const rawCanvas = renderFrameToCanvas(state, frameIdx);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = width;
    scaledCanvas.height = height;
    const ctx = scaledCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    ctx.imageSmoothingEnabled = false;

    if (backgroundColor && backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(rawCanvas, 0, 0, state.width, state.height, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height).data;

    const { indexedPixels, palette, transparentIndex } = processImageDataToPalette(
      imgData,
      totalPixels,
      transparent && (!backgroundColor || backgroundColor === 'transparent')
    );

    writer.addFrame(0, 0, width, height, indexedPixels as unknown as number[], {
      delay: delayCentiseconds,
      palette,
      transparent: transparentIndex >= 0 ? transparentIndex : undefined,
      disposal: 2
    });

    if (onProgress) {
      onProgress(Math.round(((f + 1) / targetFrames.length) * 100));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const endPos = writer.end();
  const gifBytes = buffer.subarray(0, endPos);
  return new Blob([gifBytes], { type: 'image/gif' });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
