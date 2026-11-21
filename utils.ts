
import { PixelGrid, Position, ProjectState, Layer, Frame, SavedPalette, PixelValue, ColorMode } from './types';
import {
  EMPTY_PIXEL,
  isLittleEndian,
  createPixelGrid,
  clonePixelGrid,
  packRGBA,
  encodeIndexedPixel,
  decodeIndexedPixel,
  isPackedRgbaPixel,
  isIndexedPixel,
  hexToRgb,
  getPackedColor,
  rgbToHex,
  packedToHex,
  packedToRgb,
  pixelToHex,
  pixelToRgb,
  resolveColorToPixel,
  getPackedPalette255,
  pixelToPackedImageData,
  findNearestPaletteIndex,
  computeInitialZoom,
  migrateLegacyPixelGrid,
  extractRectPatch,
  applyRectPatch,
  buildLayerPatch,
} from './utils/pixelBuffer';
import { parseAsepriteAsync, decodeImageFileAsync } from './utils/asepriteWorkerClient';
import { SelectionMask, SelectionBounds } from './utils/selectionMask';

export {
  EMPTY_PIXEL,
  createPixelGrid,
  clonePixelGrid,
  packRGBA,
  encodeIndexedPixel,
  decodeIndexedPixel,
  isPackedRgbaPixel,
  isIndexedPixel,
  hexToRgb,
  getPackedColor,
  rgbToHex,
  packedToHex,
  packedToRgb,
  pixelToHex,
  pixelToRgb,
  resolveColorToPixel,
  getPackedPalette255,
  pixelToPackedImageData,
  findNearestPaletteIndex,
  computeInitialZoom,
  migrateLegacyPixelGrid,
  extractRectPatch,
  applyRectPatch,
  buildLayerPatch,
  SelectionMask,
};
export type { SelectionBounds };

export const getIndex = (x: number, y: number, width: number): number => {
  return y * width + x;
};

export const getCoords = (index: number, width: number): Position => {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
};

export const getSelectionBoundingBox = (selection: SelectionMask, _width?: number) => {
  const box = selection.getBoundingBox();
  if (!box) return { x: 0, y: 0, w: 0, h: 0 };
  return box;
};

// Bresenham's Line Algorithm for smooth strokes
export const bresenhamLine = (x0: number, y0: number, x1: number, y1: number): Position[] => {
  const points: Position[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = (x0 < x1) ? 1 : -1;
  let sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
};

/**
 * Alois Zingl's Ellipse Algorithm (Integer arithmetic)
 */
export const bresenhamEllipse = (x0: number, y0: number, x1: number, y1: number): Position[] => {
  const points: Position[] = [];
  
  let a = Math.abs(x1 - x0);
  let b = Math.abs(y1 - y0);
  let b1 = b & 1;
  
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2;

  if (x0 > x1) {
    const temp = x0;
    x0 = x1;
    x1 = temp;
  }
  if (y0 > y1) {
    const temp = y0;
    y0 = y1;
    y1 = temp;
  }

  y0 += Math.floor((b + 1) / 2);
  y1 = y0 - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;

  const pushSymmetric = (px0: number, py0: number, px1: number, py1: number) => {
    points.push({ x: px1, y: py0 });
    points.push({ x: px0, y: py0 });
    points.push({ x: px0, y: py1 });
    points.push({ x: px1, y: py1 });
  };

  do {
    pushSymmetric(x0, y0, x1, y1);
    e2 = 2 * err;
    if (e2 >= dx) {
      x0++;
      x1--;
      err += dx += b1;
    }
    if (e2 <= dy) {
      y0++;
      y1--;
      err += dy += a;
    }
  } while (x0 <= x1);

  while (y0 - y1 < b) {
    points.push({ x: x0 - 1, y: y0 });
    points.push({ x: x1 + 1, y: y0++ });
    points.push({ x: x0 - 1, y: y1 });
    points.push({ x: x1 + 1, y: y1-- });
  }

  return points;
};

/**
 * Filled version of the Alois Zingl's algorithm
 */
export const getFilledEllipse = (x0: number, y0: number, x1: number, y1: number): Position[] => {
  const points: Position[] = [];
  
  let a = Math.abs(x1 - x0);
  let b = Math.abs(y1 - y0);
  let b1 = b & 1;
  
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2;

  if (x0 > x1) {
    const temp = x0;
    x0 = x1;
    x1 = temp;
  }
  if (y0 > y1) {
    const temp = y0;
    y0 = y1;
    y1 = temp;
  }

  y0 += Math.floor((b + 1) / 2);
  y1 = y0 - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;

  const pushHorizontalSpan = (px0: number, px1: number, py: number) => {
    const left = Math.min(px0, px1);
    const right = Math.max(px0, px1);
    for (let x = left; x <= right; x++) {
      points.push({ x, y: py });
    }
  };

  do {
    pushHorizontalSpan(x0, x1, y0);
    pushHorizontalSpan(x0, x1, y1);
    e2 = 2 * err;
    if (e2 >= dx) {
      x0++;
      x1--;
      err += dx += b1;
    }
    if (e2 <= dy) {
      y0++;
      y1--;
      err += dy += a;
    }
  } while (x0 <= x1);

  while (y0 - y1 < b) {
    pushHorizontalSpan(x0 - 1, x1 + 1, y0++);
    pushHorizontalSpan(x0 - 1, x1 + 1, y1--);
  }

  return points;
};

// Pixel Perfect Filter
export const pixelPerfectFilter = (points: Position[]): Position[] => {
  if (points.length < 3) return points;
  const out: Position[] = [points[0]];
  let i = 1;
  
  while (i < points.length - 1) {
    const a = out[out.length - 1]; 
    const b = points[i];
    const c = points[i + 1];

    const dx1 = b.x - a.x;
    const dy1 = b.y - a.y;
    const dx2 = c.x - b.x;
    const dy2 = c.y - b.y;

    const adj1 = (Math.abs(dx1) + Math.abs(dy1) === 1) || (Math.abs(dx1) + Math.abs(dy1) === 0);
    const adj2 = (Math.abs(dx2) + Math.abs(dy2) === 1);
    const perpendicular = (dx1 * dx2 + dy1 * dy2 === 0);

    if (adj1 && adj2 && perpendicular) {
      i += 2; 
      out.push(c);
    } else {
      out.push(b);
      i += 1;
    }
  }
  if (i === points.length - 1) {
      out.push(points[i]);
  }
  return out;
};

/**
 * In-place scanline Flood Fill with inline SelectionMask clipping.
 * Avoids allocating 33MB Int32Array queues and 8MB visited buffers on 4K canvases.
 * Returns true if any pixel was modified.
 */
export const floodFillInPlace = (
  pixels: PixelGrid,
  startX: number,
  startY: number,
  fillValue: PixelValue,
  width: number,
  height: number,
  contiguous: boolean = true,
  selection?: SelectionMask | null
): boolean => {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return false;
  const startIndex = startY * width + startX;
  if (selection && !selection.has(startIndex)) return false;

  const targetValue = pixels[startIndex];
  if (targetValue === fillValue) return false;

  if (!contiguous) {
    let changed = false;
    if (selection) {
      selection.forEach((i) => {
        if (pixels[i] === targetValue) {
          pixels[i] = fillValue;
          changed = true;
        }
      });
    } else {
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] === targetValue) {
          pixels[i] = fillValue;
          changed = true;
        }
      }
    }
    return changed;
  }

  // Span/scanline flood fill: writing fillValue (!== targetValue) serves as the visited marker.
  const stackX: number[] = [startX];
  const stackY: number[] = [startY];

  while (stackX.length > 0) {
    const x = stackX.pop()!;
    const y = stackY.pop()!;
    const rowOff = y * width;

    if (pixels[rowOff + x] !== targetValue) continue;
    if (selection && !selection.has(rowOff + x)) continue;

    let lx = x;
    while (lx > 0) {
      const idx = rowOff + lx - 1;
      if (pixels[idx] !== targetValue || (selection && !selection.has(idx))) break;
      lx--;
    }

    let rx = x;
    while (rx + 1 < width) {
      const idx = rowOff + rx + 1;
      if (pixels[idx] !== targetValue || (selection && !selection.has(idx))) break;
      rx++;
    }

    pixels.fill(fillValue, rowOff + lx, rowOff + rx + 1);

    // Enqueue seed spans on row above and row below
    if (y > 0) {
      const aboveY = y - 1;
      const aboveOff = aboveY * width;
      let inSpan = false;
      for (let sx = lx; sx <= rx; sx++) {
        const idx = aboveOff + sx;
        const match = pixels[idx] === targetValue && (!selection || selection.has(idx));
        if (match) {
          if (!inSpan) {
            stackX.push(sx);
            stackY.push(aboveY);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    }

    if (y + 1 < height) {
      const belowY = y + 1;
      const belowOff = belowY * width;
      let inSpan = false;
      for (let sx = lx; sx <= rx; sx++) {
        const idx = belowOff + sx;
        const match = pixels[idx] === targetValue && (!selection || selection.has(idx));
        if (match) {
          if (!inSpan) {
            stackX.push(sx);
            stackY.push(belowY);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    }
  }

  return true;
};

export const floodFill = (
  pixels: PixelGrid,
  startX: number,
  startY: number,
  fillValue: PixelValue,
  width: number,
  height: number,
  contiguous: boolean = true,
  selection?: SelectionMask | null
): PixelGrid => {
  const newPixels = clonePixelGrid(pixels);
  floodFillInPlace(newPixels, startX, startY, fillValue, width, height, contiguous, selection);
  return newPixels;
};

export const drawCheckeredBackground = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  scale: number
) => {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width * scale, height * scale);
  
  ctx.fillStyle = '#262626';
  ctx.beginPath();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 !== 0) {
        ctx.rect(x * scale, y * scale, scale, scale);
      }
    }
  }
  ctx.fill();
};

// hexToRgb and getPackedColor are re-exported from ./utils/pixelBuffer without unbounded global caches.

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Extracts and merges collinear border segments for an active pixel selection.
 * Reduces marching-ants drawing complexity from O(perimeter) to O(corners),
 * typically cutting segment draw calls by 4x-50x.
 */
export const getMergedSelectionSegments = (
  selection: SelectionMask,
  _width?: number,
  _height?: number
): Segment[] => {
  if (!selection || selection.size === 0) return [];
  return selection.getMergedSegments();
};

export function getLayerParentMap(layers: Layer[]): Map<string, Layer> {
  const parentMap = new Map<string, Layer>();

  // Fast layer lookup map
  const layerById = new Map<string, Layer>();
  for (let i = 0; i < layers.length; i++) {
    layerById.set(layers[i].id, layers[i]);
  }

  // First pass: explicit parentId with O(1) lookup
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (layer.parentId && layer.parentId !== layer.id) {
      const explicitParent = layerById.get(layer.parentId);
      if (explicitParent) {
        parentMap.set(layer.id, explicitParent);
      }
    }
  }

  // Second pass: implicit hierarchy based on UI order for legacy layers without explicit parentId field
  const uiOrder = layers.slice().reverse();
  const groupStack: { layer: Layer; level: number }[] = [];

  for (const layer of uiOrder) {
    if (layer.parentId !== undefined) {
      if (layer.type === 'group') {
        const level = layer.childLevel ?? 0;
        while (groupStack.length > 0 && groupStack[groupStack.length - 1].level >= level) {
          groupStack.pop();
        }
        groupStack.push({ layer, level });
      }
      continue;
    }

    if (parentMap.has(layer.id)) continue;

    const level = layer.childLevel ?? 0;
    while (groupStack.length > 0 && groupStack[groupStack.length - 1].level >= level) {
      groupStack.pop();
    }
    if (groupStack.length > 0 && level > groupStack[groupStack.length - 1].level) {
      const parent = groupStack[groupStack.length - 1].layer;
      if (parent.id !== layer.id) {
        parentMap.set(layer.id, parent);
      }
    }
    if (layer.type === 'group') {
      groupStack.push({ layer, level });
    }
  }

  // Third pass: Cycle detection and breaking
  for (const layer of layers) {
    const visited = new Set<string>();
    let curr: Layer | undefined = layer;
    while (curr) {
      if (visited.has(curr.id)) {
        parentMap.delete(curr.id);
        break;
      }
      visited.add(curr.id);
      curr = parentMap.get(curr.id);
    }
  }

  return parentMap;
}

export function isDescendant(layerId: string, possibleAncestorId: string, layers: Layer[]): boolean {
  if (!layerId || !possibleAncestorId || layerId === possibleAncestorId) return false;
  const parentMap = getLayerParentMap(layers);
  let current: Layer | undefined = layers.find(l => l.id === layerId);
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parent = parentMap.get(current.id) || (current.parentId ? layers.find(l => l.id === current?.parentId) : undefined);
    if (parent) {
      if (parent.id === possibleAncestorId) return true;
      current = parent;
    } else {
      break;
    }
  }

  return false;
}

export function getGroupChildren(groupId: string, layers: Layer[]): Layer[] {
  const children: Layer[] = [];
  const parentMap = getLayerParentMap(layers);

  for (const layer of layers) {
    if (layer.id === groupId) continue;
    let curr: Layer | undefined = layer;
    const visited = new Set<string>();
    while (curr) {
      if (visited.has(curr.id)) break;
      visited.add(curr.id);
      const parent = parentMap.get(curr.id) || (curr.parentId ? layers.find(l => l.id === curr?.parentId) : undefined);
      if (parent?.id === groupId) {
        children.push(layer);
        break;
      }
      curr = parent;
    }
  }

  return children;
}

export function getGroupChildCount(groupId: string, layers: Layer[]): number {
  return getGroupChildren(groupId, layers).filter(l => l.type !== 'group').length;
}

export function isLayerVisible(layer: Layer, layers: Layer[], parentMap?: Map<string, Layer>): boolean {
  if (!layer.visible) return false;

  const map = parentMap || getLayerParentMap(layers);
  let current: Layer | undefined = layer;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parent = map.get(current.id) || (current.parentId ? layers.find(l => l.id === current?.parentId) : undefined);
    if (parent) {
      if (!parent.visible) return false;
      current = parent;
    } else {
      break;
    }
  }

  return true;
}

export function getEffectiveLayerOpacity(layer: Layer, layers: Layer[], parentMap?: Map<string, Layer>): number {
  if (!layer.visible) return 0;

  const map = parentMap || getLayerParentMap(layers);
  let current: Layer | undefined = layer;
  let opacityMult = (layer.opacity ?? 100) / 100;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const parent = map.get(current.id) || (current.parentId ? layers.find(l => l.id === current?.parentId) : undefined);
    if (parent) {
      if (!parent.visible) return 0;
      opacityMult *= (parent.opacity ?? 100) / 100;
      current = parent;
    } else {
      break;
    }
  }

  return Math.round(opacityMult * 100);
}

let scratchLayerCanvas: HTMLCanvasElement | null = null;
let scratchLayerCtx: CanvasRenderingContext2D | null = null;
let scratchLayerImgData: ImageData | null = null;
let scratchLayerData32: Uint32Array | null = null;

let scratchSmallCanvas: HTMLCanvasElement | null = null;
let scratchSmallCtx: CanvasRenderingContext2D | null = null;
let scratchSmallImgData: ImageData | null = null;
let scratchSmallData32: Uint32Array | null = null;

const getCompositeOp = (blendMode: Layer['blendMode']): GlobalCompositeOperation => {
  if (blendMode === 'normal') return 'source-over';
  if (blendMode === 'addition') return 'lighter';
  if (blendMode === 'subtract' || blendMode === 'divide') return 'source-over';
  return blendMode as GlobalCompositeOperation;
};

export const releaseScratchRenderBuffers = (): void => {
  if (scratchLayerCanvas) {
    scratchLayerCanvas.width = 0;
    scratchLayerCanvas.height = 0;
  }
  scratchLayerCanvas = null;
  scratchLayerCtx = null;
  scratchLayerImgData = null;
  scratchLayerData32 = null;
};

export const renderFrameToCanvas = (
    state: Pick<ProjectState, 'width' | 'height' | 'frames' | 'palette' | 'layers'> & { colorMode?: ColorMode },
    frameIndex: number
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return canvas;

    const frame = state.frames[frameIndex];
    if (!frame) return canvas;

    if (!scratchLayerCanvas) {
      scratchLayerCanvas = document.createElement('canvas');
      scratchLayerCtx = scratchLayerCanvas.getContext('2d');
    }
    const layerCanvas = scratchLayerCanvas;
    if (layerCanvas.width !== state.width || layerCanvas.height !== state.height) {
      layerCanvas.width = state.width;
      layerCanvas.height = state.height;
      scratchLayerImgData = null;
      scratchLayerData32 = null;
    }
    const layerCtx = scratchLayerCtx || layerCanvas.getContext('2d');
    if (!layerCtx) return canvas;
    scratchLayerCtx = layerCtx;

    // Reuse scratch ImageData buffer across calls for the same canvas dimensions
    if (!scratchLayerImgData || !scratchLayerData32 || scratchLayerImgData.width !== state.width || scratchLayerImgData.height !== state.height) {
      scratchLayerImgData = layerCtx.createImageData(state.width, state.height);
      scratchLayerData32 = new Uint32Array(scratchLayerImgData.data.buffer);
    }
    const layerImgData = scratchLayerImgData;
    const data32 = scratchLayerData32;
    const paletteUint32 = getPackedPalette255(state.palette);
    const parentMap = getLayerParentMap(state.layers);
    const totalPixels = state.width * state.height;
    const isRgbaMode = state.colorMode === 'rgba';

    for (let lIdx = 0; lIdx < state.layers.length; lIdx++) {
        const l = state.layers[lIdx];
        if (l.type === 'group') continue;
        if (!isLayerVisible(l, state.layers, parentMap)) continue;
        const px = frame.layerData[l.id];
        if (!px) continue;

        const effectiveOpacity = getEffectiveLayerOpacity(l, state.layers, parentMap);
        if (effectiveOpacity <= 0) continue;

        const pxLen = Math.min(px.length, totalPixels);
        if (isRgbaMode) {
            data32.set(px.subarray(0, pxLen));
            if (pxLen < totalPixels) {
                data32.fill(0, pxLen);
            }
        } else {
            data32.fill(0);
            for (let i = 0; i < pxLen; i++) {
                const val = px[i];
                if (val !== 0) {
                    data32[i] = pixelToPackedImageData(val, paletteUint32);
                }
            }
        }

        layerCtx.putImageData(layerImgData, 0, 0);
        ctx.globalAlpha = effectiveOpacity / 100;
        ctx.globalCompositeOperation = getCompositeOp(l.blendMode);
        ctx.drawImage(layerCanvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Release large (>1MP) scratch buffers immediately so 4K renders/exports don't pin 66MB permanently
    if (totalPixels > 1_000_000) {
      releaseScratchRenderBuffers();
    }

    return canvas;
};

/**
 * Renders a frame directly into a bounded display-sized canvas (max dimension <= maxDim)
 * using nearest-neighbor sampling directly from the Uint32Array pixel buffers.
 * Avoids allocating full-resolution 4K offscreen canvases for previews and thumbnails.
 */
export const renderFrameToDownsampledCanvas = (
    state: Pick<ProjectState, 'width' | 'height' | 'frames' | 'palette' | 'layers'> & { colorMode?: ColorMode },
    frameIndex: number,
    maxDim: number = 256
): HTMLCanvasElement => {
    const srcW = Math.max(1, state.width);
    const srcH = Math.max(1, state.height);

    if (srcW <= maxDim && srcH <= maxDim) {
      return renderFrameToCanvas(state, frameIndex);
    }

    const scale = maxDim / Math.max(srcW, srcH);
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const frame = state.frames[frameIndex];
    if (!frame) return canvas;

    if (!scratchSmallCanvas) {
      scratchSmallCanvas = document.createElement('canvas');
      scratchSmallCtx = scratchSmallCanvas.getContext('2d');
    }
    if (scratchSmallCanvas.width !== dstW || scratchSmallCanvas.height !== dstH) {
      scratchSmallCanvas.width = dstW;
      scratchSmallCanvas.height = dstH;
      scratchSmallImgData = null;
      scratchSmallData32 = null;
    }
    const smallCtx = scratchSmallCtx || scratchSmallCanvas.getContext('2d');
    if (!smallCtx) return canvas;
    scratchSmallCtx = smallCtx;

    if (!scratchSmallImgData || !scratchSmallData32 || scratchSmallImgData.width !== dstW || scratchSmallImgData.height !== dstH) {
      scratchSmallImgData = smallCtx.createImageData(dstW, dstH);
      scratchSmallData32 = new Uint32Array(scratchSmallImgData.data.buffer);
    }

    const data32 = scratchSmallData32;
    const paletteUint32 = getPackedPalette255(state.palette);
    const parentMap = getLayerParentMap(state.layers);

    const xMap = new Int32Array(dstW);
    for (let x = 0; x < dstW; x++) {
      xMap[x] = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / dstW));
    }
    const yRowOff = new Int32Array(dstH);
    for (let y = 0; y < dstH; y++) {
      yRowOff[y] = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / dstH)) * srcW;
    }

    for (let lIdx = 0; lIdx < state.layers.length; lIdx++) {
      const l = state.layers[lIdx];
      if (l.type === 'group') continue;
      if (!isLayerVisible(l, state.layers, parentMap)) continue;
      const px = frame.layerData[l.id];
      if (!px) continue;

      const effectiveOpacity = getEffectiveLayerOpacity(l, state.layers, parentMap);
      if (effectiveOpacity <= 0) continue;

      let dstIdx = 0;
      for (let y = 0; y < dstH; y++) {
        const rowOffset = yRowOff[y];
        for (let x = 0; x < dstW; x++) {
          const val = px[rowOffset + xMap[x]];
          data32[dstIdx++] = val === 0 ? 0 : pixelToPackedImageData(val, paletteUint32);
        }
      }

      smallCtx.putImageData(scratchSmallImgData, 0, 0);
      ctx.globalAlpha = effectiveOpacity / 100;
      ctx.globalCompositeOperation = getCompositeOp(l.blendMode);
      ctx.drawImage(scratchSmallCanvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    return canvas;
};

export const renderSpriteSheet = (state: ProjectState): HTMLCanvasElement => {
    const { frames, width, height } = state;
    const canvas = document.createElement('canvas');
    canvas.width = width * frames.length;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    frames.forEach((_, i) => {
        const frameCanvas = renderFrameToCanvas(state, i);
        ctx.drawImage(frameCanvas, i * width, 0);
    });

    return canvas;
};

// --- Selection Algorithms (Backed by compact SelectionMask) ---

export const getRectSelection = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number
): SelectionMask => {
  const left = Math.max(0, Math.min(x0, x1));
  const right = Math.min(width - 1, Math.max(x0, x1));
  const top = Math.max(0, Math.min(y0, y1));
  const bottom = Math.min(height - 1, Math.max(y0, y1));
  if (right < left || bottom < top) return SelectionMask.empty(width, height);
  return SelectionMask.fromRect(left, top, right - left + 1, bottom - top + 1, width, height);
};

export const getEllipseSelection = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number
): SelectionMask => {
  const selection = SelectionMask.empty(width, height);
  let a = Math.abs(x1 - x0);
  let b = Math.abs(y1 - y0);
  let b1 = b & 1;

  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2: number;

  if (x0 > x1) {
    const temp = x0;
    x0 = x1;
    x1 = temp;
  }
  if (y0 > y1) {
    const temp = y0;
    y0 = y1;
    y1 = temp;
  }

  y0 += Math.floor((b + 1) / 2);
  y1 = y0 - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;

  do {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    selection.addHorizontalSpan(y0, left, right);
    selection.addHorizontalSpan(y1, left, right);
    e2 = 2 * err;
    if (e2 >= dx) {
      x0++;
      x1--;
      err += dx += b1;
    }
    if (e2 <= dy) {
      y0++;
      y1--;
      err += dy += a;
    }
  } while (x0 <= x1);

  while (y0 - y1 < b) {
    const left = Math.min(x0 - 1, x1 + 1);
    const right = Math.max(x0 - 1, x1 + 1);
    selection.addHorizontalSpan(y0++, left, right);
    selection.addHorizontalSpan(y1--, left, right);
  }

  return selection;
};

export const getPolygonSelection = (
  points: Position[],
  width: number,
  height: number
): SelectionMask => {
  const selection = SelectionMask.empty(width, height);
  const n = points.length;
  if (n < 3) return selection;

  let minY = height;
  let maxY = 0;
  for (let i = 0; i < n; i++) {
    const py = points[i].y;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));

  const intersections: number[] = [];

  // Scanline polygon rasterizer: O(H * V + area/32) via word-level span fills
  for (let y = minY; y <= maxY; y++) {
    intersections.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;

      if ((yi > y) !== (yj > y)) {
        const ix = xi + ((y - yi) * (xj - xi)) / (yj - yi);
        intersections.push(ix);
      }
    }

    if (intersections.length < 2) continue;
    intersections.sort((a, b) => a - b);

    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const xStart = Math.max(0, Math.ceil(intersections[k]));
      const xEnd = Math.min(width - 1, Math.floor(intersections[k + 1]));
      if (xEnd >= xStart) {
        selection.addHorizontalSpan(y, xStart, xEnd);
      }
    }
  }

  return selection;
};

export const getWandSelection = (
  pixels: PixelGrid | undefined,
  startX: number,
  startY: number,
  width: number,
  height: number,
  contiguous: boolean
): SelectionMask => {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return SelectionMask.empty(width, height);
  }
  // Sparse/empty layer: all pixels are EMPTY_PIXEL
  if (!pixels) {
    return SelectionMask.full(width, height);
  }

  const selection = SelectionMask.empty(width, height);
  const startIndex = startY * width + startX;
  const targetValue = pixels[startIndex];

  if (contiguous) {
    // Scanline magic wand writing directly into the 1-bit SelectionMask (zero 33MB queue / 8MB visited buffers)
    const stackX: number[] = [startX];
    const stackY: number[] = [startY];

    while (stackX.length > 0) {
      const x = stackX.pop()!;
      const y = stackY.pop()!;
      const rowOff = y * width;

      if (pixels[rowOff + x] !== targetValue || selection.has(rowOff + x)) continue;

      let lx = x;
      while (lx > 0 && pixels[rowOff + lx - 1] === targetValue && !selection.has(rowOff + lx - 1)) {
        lx--;
      }

      let rx = x;
      while (rx + 1 < width && pixels[rowOff + rx + 1] === targetValue && !selection.has(rowOff + rx + 1)) {
        rx++;
      }

      selection.addHorizontalSpan(y, lx, rx);

      if (y > 0) {
        const aboveY = y - 1;
        const aboveOff = aboveY * width;
        let inSpan = false;
        for (let sx = lx; sx <= rx; sx++) {
          const idx = aboveOff + sx;
          const match = pixels[idx] === targetValue && !selection.has(idx);
          if (match) {
            if (!inSpan) {
              stackX.push(sx);
              stackY.push(aboveY);
              inSpan = true;
            }
          } else {
            inSpan = false;
          }
        }
      }

      if (y + 1 < height) {
        const belowY = y + 1;
        const belowOff = belowY * width;
        let inSpan = false;
        for (let sx = lx; sx <= rx; sx++) {
          const idx = belowOff + sx;
          const match = pixels[idx] === targetValue && !selection.has(idx);
          if (match) {
            if (!inSpan) {
              stackX.push(sx);
              stackY.push(belowY);
              inSpan = true;
            }
          } else {
            inSpan = false;
          }
        }
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      const rowOff = y * width;
      let runStart = -1;
      for (let x = 0; x < width; x++) {
        if (pixels[rowOff + x] === targetValue) {
          if (runStart === -1) runStart = x;
        } else if (runStart !== -1) {
          selection.addHorizontalSpan(y, runStart, x - 1);
          runStart = -1;
        }
      }
      if (runStart !== -1) {
        selection.addHorizontalSpan(y, runStart, width - 1);
      }
    }
  }

  return selection;
};

// Color parsers (rgbToHex, findNearestPaletteIndex) are re-exported from ./utils/pixelBuffer.

export const parseGPL = async (text: string): Promise<string[]> => {
  const lines = text.split('\n');
  const colors: string[] = [];
  for (const line of lines) {
    if (line.trim() === '#') continue;
    if (line.includes('GIMP Palette')) continue;
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)/);
    if (match) {
      const [_, r, g, b] = match;
      colors.push(rgbToHex(parseInt(r), parseInt(g), parseInt(b)));
    }
  }
  return colors;
};

export const parseASE = async (buffer: ArrayBuffer): Promise<string[]> => {
  const view = new DataView(buffer);
  const colors: string[] = [];
  if (view.getUint32(0, false) !== 0x41534546) throw new Error("Invalid ASE file");

  let offset = 8; 
  const numBlocks = view.getUint32(8, false);
  offset += 4;

  for (let i = 0; i < numBlocks; i++) {
    const blockType = view.getUint16(offset, false);
    offset += 2;
    const blockLength = view.getUint32(offset, false);
    offset += 4;
    const endOfBlock = offset + blockLength;

    if (blockType === 0x0001) { 
      const nameLen = view.getUint16(offset, false);
      offset += 2 + nameLen * 2; 

      const m1 = String.fromCharCode(view.getUint8(offset));
      const m2 = String.fromCharCode(view.getUint8(offset + 1));
      const m3 = String.fromCharCode(view.getUint8(offset + 2));
      offset += 4;

      if (m1 === 'R' && m2 === 'G' && m3 === 'B') {
        const r = view.getFloat32(offset, false);
        const g = view.getFloat32(offset + 4, false);
        const b = view.getFloat32(offset + 8, false);
        colors.push(rgbToHex(r * 255, g * 255, b * 255));
      } else if (m1 === 'G' && m2 === 'r' && m3 === 'a') {
         const g = view.getFloat32(offset, false);
         colors.push(rgbToHex(g * 255, g * 255, g * 255));
      }
    }
    offset = endOfBlock;
  }
  return colors;
};

// --- Project & Palette Utilities ---

const imageDataToPixelGridZeroCopy = (
  imageData: ImageData,
  width: number,
  height: number
): PixelGrid => {
  const raw = imageData.data;
  const pixelCount = width * height;
  if (isLittleEndian && raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength) {
    const u32 = new Uint32Array(raw.buffer, 0, pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      if ((u32[i] >>> 24) === 0) {
        u32[i] = 0;
      }
    }
    return u32;
  }
  const pixels = createPixelGrid(pixelCount);
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    const a = raw[p + 3];
    if (a !== 0) {
      pixels[i] = ((a << 24) | (raw[p + 2] << 16) | (raw[p + 1] << 8) | raw[p]) >>> 0;
    }
  }
  return pixels;
};

const decodeImageFileToPixelGrid = async (
  file: File
): Promise<{ width: number; height: number; pixels: PixelGrid }> => {
  // 1. Fast path: decode off main thread via Worker + OffscreenCanvas with zero-copy ArrayBuffer transfer
  const workerDecoded = await decodeImageFileAsync(file);
  if (workerDecoded) {
    return workerDecoded;
  }

  // 2. Main-thread createImageBitmap fallback (zero extra 33MB buffer copy)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const width = bitmap.width;
        const height = bitmap.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Failed to get canvas context');
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        canvas.width = 0;
        canvas.height = 0;
        return { width, height, pixels: imageDataToPixelGridZeroCopy(imageData, width, height) };
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall back to Object URL + HTMLImageElement (e.g., SVG or unsupported bitmap formats)
    }
  }

  // 3. HTMLImageElement fallback
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = img;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        canvas.width = 0;
        canvas.height = 0;
        resolve({ width, height, pixels: imageDataToPixelGridZeroCopy(imageData, width, height) });
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
};

export const fileToProjectState = async (file: File): Promise<ProjectState> => {
  const fileNameLower = file.name.toLowerCase();

  if (fileNameLower.endsWith('.aseprite') || fileNameLower.endsWith('.ase')) {
    const buffer = await file.arrayBuffer();
    return parseAsepriteAsync(buffer, file.name);
  }

  if (fileNameLower.endsWith('.json') || fileNameLower.endsWith('.pxa')) {
    const text = await file.text();
    const state = JSON.parse(text);
    const width = Math.max(1, Number(state.width) || 32);
    const height = Math.max(1, Number(state.height) || 32);
    const colorMode: ColorMode = state.colorMode === 'indexed' ? 'indexed' : 'rgba';

    state.selection = SelectionMask.fromAny(state.selection, width, height);
    if (Array.isArray(state.frames)) {
      for (const frame of state.frames) {
        if (frame && frame.layerData && typeof frame.layerData === 'object') {
          for (const layerId of Object.keys(frame.layerData)) {
            frame.layerData[layerId] = migrateLegacyPixelGrid(
              frame.layerData[layerId],
              width,
              height,
              colorMode
            );
          }
        }
      }
    }
    if (Array.isArray(state.tilesets)) {
      for (const ts of state.tilesets) {
        if (ts && ts.pixels) {
          const tsW = ts.tileWidth || 1;
          const tsH = (ts.tileHeight || 1) * (ts.tilesCount || 1);
          ts.pixels = migrateLegacyPixelGrid(ts.pixels, tsW, tsH, colorMode);
        }
      }
    }
    if (!state.zoom || state.zoom <= 0) {
      state.zoom = computeInitialZoom(width, height, 32);
    }
    return state as ProjectState;
  }

  const { width, height, pixels } = await decodeImageFileToPixelGrid(file);

  const layerId = `layer-${Date.now()}`;
  const frameId = `frame-${Date.now()}`;

  return {
    id: `project-${Date.now()}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    width,
    height,
    colorMode: 'rgba',
    layers: [{ id: layerId, name: 'Layer 1', visible: true, locked: false, opacity: 100, blendMode: 'normal' }],
    frames: [{ id: frameId, layerData: { [layerId]: pixels } }],
    activeLayerId: layerId,
    selectedLayerIds: [layerId],
    activeFrameIndex: 0,
    selectedFrameIndices: [0],
    palette: [],
    paletteLibrary: [],
    activePaletteId: '',
    primaryColor: '#ffffff',
    secondaryColor: '#000000',

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
    showGrid: false,
    selection: null,
    selectionMode: 'replace',
    tiled: false,
    referenceImage: null,
  };
};

const MAX_EXTRACTED_PALETTE_COLORS = 256;

export const extractColorsFromPNG = async (file: File): Promise<string[]> => {
  const { pixels } = await decodeImageFileToPixelGrid(file);
  const exactColors = new Set<number>();
  let exceededExactCap = false;

  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    if ((pixel >>> 24) !== 0) {
      const rgb = ((pixel & 0xff) << 16) | (((pixel >>> 8) & 0xff) << 8) | ((pixel >>> 16) & 0xff);
      if (!exactColors.has(rgb)) {
        exactColors.add(rgb);
        if (exactColors.size > MAX_EXTRACTED_PALETTE_COLORS) {
          exceededExactCap = true;
          break;
        }
      }
    }
  }

  if (!exceededExactCap) {
    return Array.from(exactColors).map(p =>
      rgbToHex((p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff)
    );
  }

  // Photographic / high-color image: quantize into a 5-bit RGB histogram (32,768 bins)
  // and extract the top 256 most frequent representative colors without unbounded Set memory.
  const counts = new Uint32Array(32768);
  const sumR = new Float64Array(32768);
  const sumG = new Float64Array(32768);
  const sumB = new Float64Array(32768);

  const stride = pixels.length > 2_000_000 ? 2 : 1;
  for (let i = 0; i < pixels.length; i += stride) {
    const pixel = pixels[i];
    if ((pixel >>> 24) === 0) continue;
    const r = pixel & 0xff;
    const g = (pixel >>> 8) & 0xff;
    const b = (pixel >>> 16) & 0xff;
    const bin = ((r >>> 3) << 10) | ((g >>> 3) << 5) | (b >>> 3);
    counts[bin]++;
    sumR[bin] += r;
    sumG[bin] += g;
    sumB[bin] += b;
  }

  const populatedBins: number[] = [];
  for (let bin = 0; bin < 32768; bin++) {
    if (counts[bin] > 0) populatedBins.push(bin);
  }
  populatedBins.sort((a, b) => counts[b] - counts[a]);

  const topCount = Math.min(MAX_EXTRACTED_PALETTE_COLORS, populatedBins.length);
  const result: string[] = new Array(topCount);
  for (let i = 0; i < topCount; i++) {
    const bin = populatedBins[i];
    const c = counts[bin];
    result[i] = rgbToHex(sumR[bin] / c, sumG[bin] / c, sumB[bin] / c);
  }
  return result;
};

// --- RotSprite & Scale Algorithm Helpers ---

const scale2xPass = (pixels: PixelGrid, width: number, height: number): { pixels: PixelGrid, width: number, height: number } => {
  const newWidth = width * 2;
  const newHeight = height * 2;
  const newPixels = createPixelGrid(newWidth * newHeight);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const P = pixels[y * width + x];
      const A = y > 0 ? pixels[(y - 1) * width + x] : P;
      const B = x < width - 1 ? pixels[y * width + (x + 1)] : P;
      const C = x > 0 ? pixels[y * width + (x - 1)] : P;
      const D = y < height - 1 ? pixels[(y + 1) * width + x] : P;

      const p1 = (C === A && C !== D && A !== B) ? A : P;
      const p2 = (A === B && A !== C && B !== D) ? B : P;
      const p3 = (D === C && D !== B && C !== A) ? C : P;
      const p4 = (B === D && B !== A && D !== C) ? D : P;

      newPixels[(y * 2) * newWidth + (x * 2)] = p1;
      newPixels[(y * 2) * newWidth + (x * 2 + 1)] = p2;
      newPixels[(y * 2 + 1) * newWidth + (x * 2)] = p3;
      newPixels[(y * 2 + 1) * newWidth + (x * 2 + 1)] = p4;
    }
  }
  return { pixels: newPixels, width: newWidth, height: newHeight };
};

const MAX_ROTSPRITE_PIXELS = 16_000_000; // 64 MB cap so 4K RotSprite never OOMs

const getSafeRotSpritePasses = (w: number, h: number): number => {
  const area = w * h;
  if (area * 64 <= MAX_ROTSPRITE_PIXELS) return 3; // 8x
  if (area * 16 <= MAX_ROTSPRITE_PIXELS) return 2; // 4x
  if (area * 4 <= MAX_ROTSPRITE_PIXELS) return 1;  // 2x
  return 0; // 1x fallback (nearest-neighbor)
};

export interface RotSpritePrecomputedBuffer {
  pixels: PixelGrid;
  width: number;
  height: number;
  scale: number;
  box: { x: number; y: number; w: number; h: number };
}

/**
 * Precomputes the Scale2x buffer once per rotation gesture with a safe memory cap
 * so large selections on 4K images never exhaust memory.
 */
export const prepareRotSpriteBuffer = (
  selection: SelectionMask,
  layerPixels: PixelGrid,
  width: number
): RotSpritePrecomputedBuffer | null => {
  if (!selection || selection.size === 0) return null;
  const box = selection.getBoundingBox();
  if (!box || box.w <= 0 || box.h <= 0) return null;

  const passes = getSafeRotSpritePasses(box.w, box.h);
  if (passes === 0) return null;

  const subGrid = createPixelGrid(box.w * box.h);
  selection.forEachCoord((x, y, idx) => {
    subGrid[(y - box.y) * box.w + (x - box.x)] = layerPixels[idx];
  });

  let scaled = { pixels: subGrid, width: box.w, height: box.h };
  for (let i = 0; i < passes; i++) {
    scaled = scale2xPass(scaled.pixels, scaled.width, scaled.height);
  }
  return { pixels: scaled.pixels, width: scaled.width, height: scaled.height, scale: 1 << passes, box };
};

export const rotateSelectionPixels = (
    selection: SelectionMask, 
    layerPixels: PixelGrid, 
    angleRad: number, 
    pivot: Position,
    width: number,
    height: number,
    algorithm: 'nearest' | 'rotsprite',
    precomputedScale8x?: RotSpritePrecomputedBuffer | null
): PixelGrid => {
    const newPixels = createPixelGrid(width * height);
    if (!selection || selection.size === 0) return newPixels;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const box = precomputedScale8x ? precomputedScale8x.box : getSelectionBoundingBox(selection, width);
    if (box.w <= 0 || box.h <= 0) return newPixels;

    const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x, y: box.y + box.h },
        { x: box.x + box.w, y: box.y + box.h }
    ];

    let minTargetX = Infinity, maxTargetX = -Infinity;
    let minTargetY = Infinity, maxTargetY = -Infinity;

    for (let i = 0; i < 4; i++) {
        const tx = corners[i].x - pivot.x;
        const ty = corners[i].y - pivot.y;
        const rx = tx * cos - ty * sin + pivot.x;
        const ry = tx * sin + ty * cos + pivot.y;
        if (rx < minTargetX) minTargetX = rx;
        if (rx > maxTargetX) maxTargetX = rx;
        if (ry < minTargetY) minTargetY = ry;
        if (ry > maxTargetY) maxTargetY = ry;
    }

    const minX = Math.max(0, Math.floor(minTargetX) - 1);
    const maxX = Math.min(width - 1, Math.ceil(maxTargetX) + 1);
    const minY = Math.max(0, Math.floor(minTargetY) - 1);
    const maxY = Math.min(height - 1, Math.ceil(maxTargetY) + 1);

    const effectiveRotSprite =
      algorithm === 'rotsprite'
        ? (precomputedScale8x ?? prepareRotSpriteBuffer(selection, layerPixels, width))
        : null;

    if (effectiveRotSprite) {
        const scale = effectiveRotSprite.scale;
        const scaledW = effectiveRotSprite.width;
        const scaledH = effectiveRotSprite.height;
        const scaledPx = effectiveRotSprite.pixels;
        for (let y = minY; y <= maxY; y++) {
            const rowOff = y * width;
            const ty = y + 0.5 - pivot.y;
            for (let x = minX; x <= maxX; x++) {
                const tx = x + 0.5 - pivot.x;
                const srcX_orig = tx * cos + ty * sin + pivot.x;
                const srcY_orig = -tx * sin + ty * cos + pivot.y;
                
                const floorX = Math.floor((srcX_orig - box.x) * scale);
                const floorY = Math.floor((srcY_orig - box.y) * scale);
                
                if (floorX >= 0 && floorX < scaledW && floorY >= 0 && floorY < scaledH) {
                    newPixels[rowOff + x] = scaledPx[floorY * scaledW + floorX];
                }
            }
        }
    } else {
        for (let y = minY; y <= maxY; y++) {
            const rowOff = y * width;
            const ty = y + 0.5 - pivot.y;
            for (let x = minX; x <= maxX; x++) {
                const tx = x + 0.5 - pivot.x;
                const srcX = Math.floor(tx * cos + ty * sin + pivot.x);
                const srcY = Math.floor(-tx * sin + ty * cos + pivot.y);
                
                if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                    const srcIdx = srcY * width + srcX;
                    if (selection.has(srcIdx)) {
                        newPixels[rowOff + x] = layerPixels[srcIdx] ?? EMPTY_PIXEL;
                    }
                }
            }
        }
    }
    return newPixels;
};

export const rotateSelectionMask = (
    selection: SelectionMask,
    angleRad: number,
    pivot: Position,
    width: number,
    height: number
): SelectionMask => {
    const newSelection = SelectionMask.empty(width, height);
    if (!selection || selection.size === 0) return newSelection;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const box = getSelectionBoundingBox(selection, width);
    if (box.w <= 0 || box.h <= 0) return newSelection;

    const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x, y: box.y + box.h },
        { x: box.x + box.w, y: box.y + box.h }
    ];

    let minTargetX = Infinity, maxTargetX = -Infinity;
    let minTargetY = Infinity, maxTargetY = -Infinity;

    for (let i = 0; i < 4; i++) {
        const tx = corners[i].x - pivot.x;
        const ty = corners[i].y - pivot.y;
        const rx = tx * cos - ty * sin + pivot.x;
        const ry = tx * sin + ty * cos + pivot.y;
        if (rx < minTargetX) minTargetX = rx;
        if (rx > maxTargetX) maxTargetX = rx;
        if (ry < minTargetY) minTargetY = ry;
        if (ry > maxTargetY) maxTargetY = ry;
    }

    const minX = Math.max(0, Math.floor(minTargetX) - 1);
    const maxX = Math.min(width - 1, Math.ceil(maxTargetX) + 1);
    const minY = Math.max(0, Math.floor(minTargetY) - 1);
    const maxY = Math.min(height - 1, Math.ceil(maxTargetY) + 1);

    for (let y = minY; y <= maxY; y++) {
        const ty = y + 0.5 - pivot.y;
        let runStart = -1;
        for (let x = minX; x <= maxX; x++) {
            const tx = x + 0.5 - pivot.x;
            const srcX = Math.floor(tx * cos + ty * sin + pivot.x);
            const srcY = Math.floor(-tx * sin + ty * cos + pivot.y);

            const hit =
              srcX >= 0 &&
              srcX < width &&
              srcY >= 0 &&
              srcY < height &&
              selection.has(srcY * width + srcX);

            if (hit) {
              if (runStart === -1) runStart = x;
            } else if (runStart !== -1) {
              newSelection.addHorizontalSpan(y, runStart, x - 1);
              runStart = -1;
            }
        }
        if (runStart !== -1) {
          newSelection.addHorizontalSpan(y, runStart, maxX);
        }
    }
    return newSelection;
};

/**
 * Scales selection pixels using Nearest Neighbor reverse-mapping.
 */
export const scaleSelectionPixels = (
    selection: SelectionMask,
    layerPixels: PixelGrid,
    srcBox: { x: number, y: number, w: number, h: number },
    destBox: { x: number, y: number, w: number, h: number },
    width: number,
    height: number
): PixelGrid => {
    const newPixels = createPixelGrid(width * height);
    if (srcBox.w <= 0 || srcBox.h <= 0 || destBox.w <= 0 || destBox.h <= 0) return newPixels;

    const invDestW = srcBox.w / destBox.w;
    const invDestH = srcBox.h / destBox.h;

    for (let dy = 0; dy < destBox.h; dy++) {
        const targetY = Math.floor(destBox.y + dy);
        if (targetY < 0 || targetY >= height) continue;
        const sy = Math.floor(srcBox.y + dy * invDestH);
        if (sy < srcBox.y || sy >= srcBox.y + srcBox.h) continue;
        const dstRow = targetY * width;
        const srcRow = sy * width;

        for (let dx = 0; dx < destBox.w; dx++) {
            const targetX = Math.floor(destBox.x + dx);
            if (targetX < 0 || targetX >= width) continue;
            const sx = Math.floor(srcBox.x + dx * invDestW);

            if (sx >= srcBox.x && sx < srcBox.x + srcBox.w) {
                const srcIdx = srcRow + sx;
                if (selection.has(srcIdx)) {
                    newPixels[dstRow + targetX] = layerPixels[srcIdx];
                }
            }
        }
    }
    return newPixels;
};

/**
 * Updates selection mask to new bounding box.
 */
export const scaleSelectionMask = (
    selection: SelectionMask,
    srcBox: { x: number, y: number, w: number, h: number },
    destBox: { x: number, y: number, w: number, h: number },
    width: number,
    height: number
): SelectionMask => {
    if (destBox.w <= 0 || destBox.h <= 0 || srcBox.w <= 0 || srcBox.h <= 0) {
      return SelectionMask.empty(width, height);
    }

    if (selection.isRect) {
      const rx = Math.max(0, Math.floor(destBox.x));
      const ry = Math.max(0, Math.floor(destBox.y));
      const rx2 = Math.min(width, Math.floor(destBox.x + destBox.w));
      const ry2 = Math.min(height, Math.floor(destBox.y + destBox.h));
      return SelectionMask.fromRect(rx, ry, Math.max(0, rx2 - rx), Math.max(0, ry2 - ry), width, height);
    }

    const newSelection = SelectionMask.empty(width, height);
    const invDestW = srcBox.w / destBox.w;
    const invDestH = srcBox.h / destBox.h;

    for (let dy = 0; dy < destBox.h; dy++) {
        const targetY = Math.floor(destBox.y + dy);
        if (targetY < 0 || targetY >= height) continue;
        const sy = Math.floor(srcBox.y + dy * invDestH);
        const srcRow = sy * width;

        let runStart = -1;
        let lastX = -2;
        for (let dx = 0; dx < destBox.w; dx++) {
            const targetX = Math.floor(destBox.x + dx);
            if (targetX < 0 || targetX >= width) continue;
            const sx = Math.floor(srcBox.x + dx * invDestW);

            if (selection.has(srcRow + sx)) {
                if (runStart === -1) {
                  runStart = targetX;
                  lastX = targetX;
                } else if (targetX <= lastX + 1) {
                  lastX = targetX;
                } else {
                  newSelection.addHorizontalSpan(targetY, runStart, lastX);
                  runStart = targetX;
                  lastX = targetX;
                }
            }
        }
        if (runStart !== -1) {
          newSelection.addHorizontalSpan(targetY, runStart, lastX);
        }
    }
    return newSelection;
};

export const applyConvolution = (
    x: number, 
    y: number, 
    pixels: PixelGrid, 
    width: number, 
    height: number, 
    kernel: number[][],
    palette: string[],
    colorMode: 'indexed' | 'rgba'
): PixelValue => {
    let r = 0, g = 0, b = 0, weight = 0;
    const kSize = kernel.length;
    const kHalf = Math.floor(kSize / 2);

    for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
            const nx = x + kx - kHalf;
            const ny = y + ky - kHalf;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const val = pixels[getIndex(nx, ny, width)];
                if (val !== EMPTY_PIXEL) {
                    const rgb = pixelToRgb(val, palette);
                    if (rgb) {
                        const kw = kernel[ky][kx];
                        r += rgb[0] * kw;
                        g += rgb[1] * kw;
                        b += rgb[2] * kw;
                        weight += kw;
                    }
                }
            }
        }
    }

    if (weight === 0) return EMPTY_PIXEL;
    
    const finalR = Math.max(0, Math.min(255, Math.round(weight > 0 ? r / weight : r)));
    const finalG = Math.max(0, Math.min(255, Math.round(weight > 0 ? g / weight : g)));
    const finalB = Math.max(0, Math.min(255, Math.round(weight > 0 ? b / weight : b)));

    if (colorMode === 'indexed') {
        return encodeIndexedPixel(findNearestPaletteIndex(finalR, finalG, finalB, palette));
    } else {
        return packRGBA(finalR, finalG, finalB, 255);
    }
};
