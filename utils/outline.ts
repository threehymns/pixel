import { PixelGrid, PixelValue, ProjectState, ColorMode, Layer, Frame } from '../types';
import { getIndex, getCoords, hexToRgb } from '../utils';

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
 * Checks whether two hex colors match (case-insensitive).
 */
const colorMatches = (c1: string | null | undefined, c2: string | null | undefined): boolean => {
  if (!c1 && !c2) return true;
  if (!c1 || !c2) return false;
  return c1.toLowerCase() === c2.toLowerCase();
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
  if (colorMode === 'rgba') return colorHex;
  const lowerHex = colorHex.toLowerCase();
  const idx = palette.findIndex(c => c.toLowerCase() === lowerHex);
  if (idx !== -1) return idx;

  // Find nearest color in palette
  const [r, g, b] = hexToRgb(colorHex);
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = hexToRgb(palette[i]);
    const dist = Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
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
  selection: Set<number> | null
): { resultPixels: PixelGrid; outlineOnlyPixels: PixelGrid; outlineIndices: number[] } => {
  const total = width * height;
  const resultPixels: PixelGrid = [...sourceGrid];
  const outlineOnlyPixels: PixelGrid = new Array(total).fill(null);
  const outlineIndices: number[] = [];

  const resolvedOutlineVal = resolveOutlinePixelValue(options.outlineColor, colorMode, palette);
  const targetBgHex = options.bgMode === 'color' && options.bgColor ? options.bgColor : null;

  // Helper to determine if a pixel at index is considered "background"
  const isBackground = (idx: number): boolean => {
    const val = sourceGrid[idx];
    if (val === null || val === undefined) return true;
    if (targetBgHex) {
      const hex = typeof val === 'number' ? palette[val] : val;
      return colorMatches(hex, targetBgHex);
    }
    return false;
  };

  // Helper to determine if a pixel is considered "foreground"
  // If selection is present and scope is 'selection', foreground to be outlined is restricted to selection
  const isForeground = (idx: number): boolean => {
    if (isBackground(idx)) return false;
    if (options.scope === 'selection' && selection && selection.size > 0) {
      return selection.has(idx);
    }
    return true;
  };

  // Binary mask of current foreground
  let currentFg = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (isForeground(i)) currentFg[i] = 1;
  }

  const offsets = getMatrixOffsets(options.matrix);
  if (offsets.length === 0) {
    return { resultPixels, outlineOnlyPixels, outlineIndices };
  }

  const outsideMask = new Uint8Array(total);
  const insideMask = new Uint8Array(total);

  // --- OUTSIDE OUTLINE ---
  if (options.placement === 'outside' || options.placement === 'both') {
    let frontier = new Uint8Array(currentFg);

    for (let step = 0; step < options.thickness; step++) {
      const nextFrontier = new Uint8Array(total);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          // Must be background and not already marked
          if (!isBackground(idx) || outsideMask[idx]) continue;

          // Check if any neighbor in the matrix was part of the frontier
          for (let k = 0; k < offsets.length; k++) {
            const nx = x - offsets[k][0]; // Direction of source pixel relative to target
            const ny = y - offsets[k][1];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (frontier[nIdx]) {
                outsideMask[idx] = 1;
                nextFrontier[idx] = 1;
                break;
              }
            }
          }
        }
      }
      frontier = nextFrontier;
    }

    for (let i = 0; i < total; i++) {
      if (outsideMask[i]) {
        resultPixels[i] = resolvedOutlineVal;
        outlineOnlyPixels[i] = resolvedOutlineVal;
        outlineIndices.push(i);
      }
    }
  }

  // --- INSIDE OUTLINE ---
  if (options.placement === 'inside' || options.placement === 'both') {
    // Inside outline replaces foreground boundary pixels
    let insideForeground = new Uint8Array(currentFg);

    for (let step = 0; step < options.thickness; step++) {
      const nextFg = new Uint8Array(insideForeground);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!insideForeground[idx] || insideMask[idx]) continue;

          // Check if any neighbor in matrix is background or out-of-bounds
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
            nextFg[idx] = 0; // Removed from subsequent dilation steps
          }
        }
      }
      insideForeground = nextFg;
    }

    for (let i = 0; i < total; i++) {
      if (insideMask[i]) {
        resultPixels[i] = resolvedOutlineVal;
        outlineOnlyPixels[i] = resolvedOutlineVal;
        if (!outsideMask[i]) {
          outlineIndices.push(i);
        }
      }
    }
  }

  return { resultPixels, outlineOnlyPixels, outlineIndices };
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

  let newLayers = [...layers];
  let newActiveLayerId = activeLayerId;
  let targetLayerId = activeLayerId;

  // If creating a new layer
  if (options.targetLayer === 'new') {
    const newId = `layer-outline-${Date.now()}`;
    const baseName = `${activeLayerName} Outline`;
    let name = baseName;
    let counter = 1;
    while (newLayers.some(l => l.name === name)) {
      name = `${baseName} ${counter++}`;
    }

    const activeIdx = layers.findIndex(l => l.id === activeLayerId);
    // For outside outline, inserting right behind the active layer is ideal so original artwork sits on top
    // For inside or both, inserting above ensures outline is visible
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

  const addedOutlineIndices = new Set<number>();

  const newFrames = frames.map((frame, fIdx) => {
    if (!framesToProcess.includes(fIdx)) {
      if (options.targetLayer === 'new') {
        // Initialize empty grid for new layer
        return {
          ...frame,
          layerData: {
            ...frame.layerData,
            [targetLayerId]: new Array(width * height).fill(null)
          }
        };
      }
      return frame;
    }

    const sourceGrid = frame.layerData[activeLayerId] || new Array(width * height).fill(null);
    const { resultPixels, outlineOnlyPixels, outlineIndices } = processOutlineGrid(
      sourceGrid,
      width,
      height,
      options,
      colorMode,
      palette,
      selection
    );

    for (const idx of outlineIndices) {
      addedOutlineIndices.add(idx);
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

  // If a selection exists, expand it to include the newly generated outline pixels
  let newSelection = selection ? new Set(selection) : null;
  if (newSelection && addedOutlineIndices.size > 0) {
    for (const idx of addedOutlineIndices) {
      newSelection.add(idx);
    }
  }

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
