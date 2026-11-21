import { PixelGrid, PixelValue, ProjectState, ColorMode, Layer, Frame, SelectionMask } from '../types';
import {
  EMPTY_PIXEL,
  clonePixelGrid,
  createPixelGrid,
  encodeIndexedPixel,
  findNearestPaletteIndex,
  getPackedColor,
  hexToRgb,
  pixelToHex,
} from './pixelBuffer';
import { SelectionMask as SelectionMaskClass } from './selectionMask';

export type OutlinePlacement = 'outside' | 'inside' | 'both';
export type OutlineShapePreset = 'square' | 'circle' | 'horizontal' | 'vertical' | 'custom';

export interface OutlineMatrix {
  nw: boolean; // North-West (-1, -1)
  n: boolean;  // North      ( 0, -1)
  ne: boolean; // North-East ( 1, -1)
  w: boolean;  // West       (-1,  0)
  e: boolean;  // East       ( 1,  0)
  sw: boolean; // South-West (-1,  1)
  s: boolean;  // South      ( 0,  1)
  se: boolean; // South-East ( 1,  1)
}

export interface OutlineOptions {
  placement: OutlinePlacement;
  matrix: OutlineMatrix;
  thickness: number; // 1 to 10
  outlineColor: string; // Hex color
  bgMode: 'transparent' | 'color';
  bgColor?: string; // Optional background hex color to outline against
  scope: 'canvas' | 'selection';
  targetLayer: 'active' | 'new';
  targetFrames: 'current' | 'all';
}

export const DEFAULT_OUTLINE_MATRIX: OutlineMatrix = {
  nw: false,
  n: true,
  ne: false,
  w: true,
  e: true,
  sw: false,
  s: true,
  se: false
};

export const MATRIX_PRESETS: Record<OutlineShapePreset, OutlineMatrix> = {
  circle: {
    nw: false,
    n: true,
    ne: false,
    w: true,
    e: true,
    sw: false,
    s: true,
    se: false
  },
  square: {
    nw: true,
    n: true,
    ne: true,
    w: true,
    e: true,
    sw: true,
    s: true,
    se: true
  },
  horizontal: {
    nw: false,
    n: false,
    ne: false,
    w: true,
    e: true,
    sw: false,
    s: false,
    se: false
  },
  vertical: {
    nw: false,
    n: true,
    ne: false,
    w: false,
    e: false,
    sw: false,
    s: true,
    se: false
  },
  custom: {
    nw: false,
    n: true,
    ne: false,
    w: true,
    e: true,
    sw: false,
    s: true,
    se: false
  }
};

/**
 * Generates kernel directional steps based on the 3x3 matrix.
 */
export const getMatrixOffsets = (matrix: OutlineMatrix): [number, number][] => {
  const offsets: [number, number][] = [];
  if (matrix.nw) offsets.push([-1, -1]);
  if (matrix.n) offsets.push([0, -1]);
  if (matrix.ne) offsets.push([1, -1]);
  if (matrix.w) offsets.push([-1, 0]);
  if (matrix.e) offsets.push([1, 0]);
  if (matrix.sw) offsets.push([-1, 1]);
  if (matrix.s) offsets.push([0, 1]);
  if (matrix.se) offsets.push([1, 1]);
  return offsets;
};

/**
 * Resolves a color string to a PixelValue compatible with the project's colorMode.
 */
export const resolveOutlinePixelValue = (
  colorHex: string,
  colorMode: ColorMode,
  palette: string[]
): PixelValue => {
  if (colorMode === 'rgba') return getPackedColor(colorHex, 255);
  const lowerHex = colorHex.toLowerCase();
  const idx = palette.findIndex(c => c.toLowerCase() === lowerHex);
  if (idx !== -1) return encodeIndexedPixel(idx);

  const [r, g, b] = hexToRgb(colorHex);
  return encodeIndexedPixel(findNearestPaletteIndex(r, g, b, palette));
};

/**
 * Applies pixel-perfect outline morphology to a single layer's PixelGrid.
 * Returns { resultPixels, outlineOnlyPixels }
 */
export const processOutlineGrid = (
  sourceGrid: PixelGrid,
  width: number,
  height: number,
  options: OutlineOptions,
  colorMode: ColorMode,
  palette: string[],
  selection: SelectionMask | null
): { resultPixels: PixelGrid; outlineOnlyPixels: PixelGrid; outlineMask: SelectionMask | null } => {
  const total = width * height;
  const resultPixels: PixelGrid = clonePixelGrid(sourceGrid);
  const outlineOnlyPixels: PixelGrid = createPixelGrid(total);

  const offsets = getMatrixOffsets(options.matrix);
  if (offsets.length === 0) {
    return { resultPixels, outlineOnlyPixels, outlineMask: null };
  }

  const resolvedOutlineVal = resolveOutlinePixelValue(options.outlineColor, colorMode, palette);
  const targetBgHex = options.bgMode === 'color' && options.bgColor ? options.bgColor.toLowerCase() : null;
  const targetBgRgb = targetBgHex ? (getPackedColor(targetBgHex, 255) & 0x00ffffff) : -1;
  const useSelection = Boolean(options.scope === 'selection' && selection && selection.size > 0);

  const isBackground = (idx: number): boolean => {
    const val = sourceGrid[idx];
    if (val === EMPTY_PIXEL) return true;
    if (targetBgHex) {
      if ((val >>> 24) !== 0) {
        return (val & 0x00ffffff) === targetBgRgb;
      }
      const hex = pixelToHex(val, palette);
      return hex ? hex.toLowerCase() === targetBgHex : true;
    }
    return false;
  };

  // Single pass to build foreground mask & tight foreground bounding box
  const currentFg = new Uint8Array(total);
  let fgMinX = width;
  let fgMinY = height;
  let fgMaxX = -1;
  let fgMaxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOff + x;
      if (isBackground(idx)) continue;
      if (useSelection && !selection!.has(idx)) continue;
      currentFg[idx] = 1;
      if (x < fgMinX) fgMinX = x;
      if (x > fgMaxX) fgMaxX = x;
      if (y < fgMinY) fgMinY = y;
      if (y > fgMaxY) fgMaxY = y;
    }
  }

  if (fgMaxX < fgMinX || fgMaxY < fgMinY) {
    return { resultPixels, outlineOnlyPixels, outlineMask: null };
  }

  const thickness = Math.max(1, options.thickness | 0);
  const roiMinX = Math.max(0, fgMinX - thickness);
  const roiMaxX = Math.min(width - 1, fgMaxX + thickness);
  const roiMinY = Math.max(0, fgMinY - thickness);
  const roiMaxY = Math.min(height - 1, fgMaxY + thickness);

  const needSelectionExpansion = Boolean(selection && selection.size > 0);
  const outlineMask = needSelectionExpansion ? SelectionMaskClass.empty(width, height) : null;

  // Ping-pong two reusable scratch buffers across thickness steps (zero per-step allocations)
  const bufA = new Uint8Array(total);
  const bufB = new Uint8Array(total);
  const outsideMask = options.placement === 'outside' || options.placement === 'both' ? new Uint8Array(total) : null;

  // --- OUTSIDE OUTLINE ---
  if (outsideMask) {
    bufA.set(currentFg);
    let frontier = bufA;
    let nextFrontier = bufB;

    for (let step = 0; step < thickness; step++) {
      // Clear only the ROI in nextFrontier
      for (let y = roiMinY; y <= roiMaxY; y++) {
        nextFrontier.fill(0, y * width + roiMinX, y * width + roiMaxX + 1);
      }

      for (let y = roiMinY; y <= roiMaxY; y++) {
        const rowOff = y * width;
        for (let x = roiMinX; x <= roiMaxX; x++) {
          const idx = rowOff + x;
          if (outsideMask[idx] || !isBackground(idx)) continue;

          for (let k = 0; k < offsets.length; k++) {
            const nx = x - offsets[k][0];
            const ny = y - offsets[k][1];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (frontier[ny * width + nx]) {
                outsideMask[idx] = 1;
                nextFrontier[idx] = 1;
                break;
              }
            }
          }
        }
      }

      const tmp = frontier;
      frontier = nextFrontier;
      nextFrontier = tmp;
    }

    for (let y = roiMinY; y <= roiMaxY; y++) {
      const rowOff = y * width;
      for (let x = roiMinX; x <= roiMaxX; x++) {
        const idx = rowOff + x;
        if (outsideMask[idx]) {
          resultPixels[idx] = resolvedOutlineVal;
          outlineOnlyPixels[idx] = resolvedOutlineVal;
          if (outlineMask) outlineMask.add(idx);
        }
      }
    }
  }

  // --- INSIDE OUTLINE ---
  if (options.placement === 'inside' || options.placement === 'both') {
    const insideMask = new Uint8Array(total);
    bufA.set(currentFg);
    let insideForeground = bufA;
    let nextFg = bufB;

    for (let step = 0; step < thickness; step++) {
      for (let y = fgMinY; y <= fgMaxY; y++) {
        const rowOff = y * width;
        nextFg.set(insideForeground.subarray(rowOff + fgMinX, rowOff + fgMaxX + 1), rowOff + fgMinX);
      }

      for (let y = fgMinY; y <= fgMaxY; y++) {
        const rowOff = y * width;
        for (let x = fgMinX; x <= fgMaxX; x++) {
          const idx = rowOff + x;
          if (!insideForeground[idx] || insideMask[idx]) continue;

          let isBorder = false;
          for (let k = 0; k < offsets.length; k++) {
            const nx = x + offsets[k][0];
            const ny = y + offsets[k][1];
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              isBorder = true;
              break;
            } else {
              const nIdx = ny * width + nx;
              if (!insideForeground[nIdx] || isBackground(nIdx)) {
                isBorder = true;
                break;
              }
            }
          }

          if (isBorder) {
            insideMask[idx] = 1;
            nextFg[idx] = 0;
          }
        }
      }

      const tmp = insideForeground;
      insideForeground = nextFg;
      nextFg = tmp;
    }

    for (let y = fgMinY; y <= fgMaxY; y++) {
      const rowOff = y * width;
      for (let x = fgMinX; x <= fgMaxX; x++) {
        const idx = rowOff + x;
        if (insideMask[idx]) {
          resultPixels[idx] = resolvedOutlineVal;
          outlineOnlyPixels[idx] = resolvedOutlineVal;
          if (outlineMask && (!outsideMask || !outsideMask[idx])) {
            outlineMask.add(idx);
          }
        }
      }
    }
  }

  return { resultPixels, outlineOnlyPixels, outlineMask };
};

/**
 * Applies outline effect across the entire ProjectState according to options.
 * Handles active layer vs new layer, and current frame vs all frames.
 */
export const applyOutlineEffect = (
  state: ProjectState,
  options: OutlineOptions
): {
  newState: ProjectState;
  actionSummary: string;
} => {
  const { width, height, activeLayerId, activeFrameIndex, frames, layers, colorMode, palette, selection } = state;
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const activeLayerName = activeLayer?.name || 'Layer';

  const newLayers = [...layers];
  let newActiveLayerId = activeLayerId;
  let targetLayerId = activeLayerId;

  if (options.targetLayer === 'new') {
    const newId = `layer-outline-${Date.now()}`;
    const baseName = `${activeLayerName} Outline`;
    let name = baseName;
    let counter = 1;
    while (newLayers.some(l => l.name === name)) {
      name = `${baseName} ${counter++}`;
    }

    const activeIdx = layers.findIndex(l => l.id === activeLayerId);
    const insertIdx = options.placement === 'outside' ? Math.max(0, activeIdx) : activeIdx + 1;

    const newLayer: Layer = {
      id: newId,
      name,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      childLevel: activeLayer?.childLevel ?? 0,
      parentId: activeLayer?.parentId ?? null
    };

    newLayers.splice(insertIdx, 0, newLayer);
    targetLayerId = newId;
    newActiveLayerId = newId;
  }

  const framesToProcess = options.targetFrames === 'all'
    ? frames.map((_, i) => i)
    : [activeFrameIndex];

  let expandedSelection: SelectionMask | null = selection ? selection.clone() : null;

  const newFrames: Frame[] = frames.map((frame, fIdx) => {
    if (!framesToProcess.includes(fIdx)) {
      // Leave newly created outline layer sparse on non-processed frames
      return frame;
    }

    const sourceGrid = frame.layerData[activeLayerId];
    if (!sourceGrid) return frame;

    const { resultPixels, outlineOnlyPixels, outlineMask } = processOutlineGrid(
      sourceGrid,
      width,
      height,
      options,
      colorMode,
      palette,
      selection
    );

    if (expandedSelection && outlineMask && outlineMask.size > 0) {
      expandedSelection = expandedSelection.union(outlineMask);
    }

    const newLayerData = { ...frame.layerData };
    if (options.targetLayer === 'new') {
      newLayerData[targetLayerId] = outlineOnlyPixels;
    } else {
      newLayerData[activeLayerId] = resultPixels;
    }

    return {
      ...frame,
      layerData: newLayerData
    };
  });

  const newSelection = expandedSelection && expandedSelection.size > 0 ? expandedSelection : null;

  const placementLabel = options.placement.charAt(0).toUpperCase() + options.placement.slice(1);
  const actionSummary = `Outline (${placementLabel}, ${options.thickness}px)`;

  return {
    newState: {
      ...state,
      layers: newLayers,
      frames: newFrames,
      activeLayerId: newActiveLayerId,
      selectedLayerIds: [newActiveLayerId],
      selection: newSelection
    },
    actionSummary
  };
};
