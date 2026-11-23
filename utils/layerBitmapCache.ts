import { PixelGrid, ProjectState } from '../types';
import { createPixelGrid, isLittleEndian } from './pixelBuffer';
import { decodeImageFileAsync } from './asepriteWorkerClient';

export interface PendingLayerBitmap {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  file: File;
  hydratedGrid: PixelGrid | null;
  released: boolean;
  closed: boolean;
  onHydrated?: (hydrated: PixelGrid) => void;
  notified: boolean;
}

// Placeholder (zero-length) PixelGrid -> pending ImageBitmap entry
const pendingBitmapByPlaceholder = new WeakMap<PixelGrid, PendingLayerBitmap>();

// Hydrated PixelGrid -> original placeholder PixelGrid whose ImageBitmap was already drawn to layerCanvasCache
const placeholderByHydratedGrid = new WeakMap<PixelGrid, PixelGrid>();

function notifyHydrated(entry: PendingLayerBitmap, hydrated: PixelGrid): void {
  if (entry.notified || entry.closed) return;
  const cb = entry.onHydrated;
  if (!cb) return;
  entry.notified = true;
  entry.onHydrated = undefined;
  queueMicrotask(() => {
    if (!entry.closed) {
      cb(hydrated);
    }
  });
}

function finalizeHydration(
  placeholder: PixelGrid,
  entry: PendingLayerBitmap,
  hydrated: PixelGrid
): PixelGrid {
  entry.hydratedGrid = hydrated;
  entry.released = true;
  placeholderByHydratedGrid.set(hydrated, placeholder);
  try {
    entry.bitmap.close();
  } catch {
    // Ignore already-closed bitmap
  }
  notifyHydrated(entry, hydrated);
  return hydrated;
}

function extractBitmapToPixelGridSync(
  bitmap: ImageBitmap,
  width: number,
  height: number
): PixelGrid {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    return createPixelGrid(width * height);
  }
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;

  const raw = imageData.data;
  const pixelCount = width * height;
  if (isLittleEndian && raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength) {
    const u32 = new Uint32Array(raw.buffer);
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
}

/**
 * Creates a lightweight 0-byte placeholder PixelGrid backed by an already-decoded ImageBitmap.
 * Canvas and thumbnail renderers draw the GPU-ready ImageBitmap directly with zero readback,
 * while background worker hydration populates the full Uint32Array off the main thread.
 */
export function createPendingBitmapGrid(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  file: File
): PixelGrid {
  const placeholder = new Uint32Array(0);
  pendingBitmapByPlaceholder.set(placeholder, {
    bitmap,
    width,
    height,
    file,
    hydratedGrid: null,
    released: false,
    closed: false,
    notified: false,
  });
  return placeholder;
}

export function getPendingLayerBitmap(grid: PixelGrid | null | undefined): PendingLayerBitmap | null {
  if (!grid || grid.length !== 0) return null;
  const entry = pendingBitmapByPlaceholder.get(grid);
  if (!entry || entry.released || entry.closed) return null;
  return entry;
}

/**
 * Checks whether a hydrated PixelGrid came directly from a placeholder whose ImageBitmap
 * was already painted into a layer canvas cache (allowing Canvas to skip putImageData).
 */
export function isHydratedReplacementFor(
  hydratedGrid: PixelGrid,
  previousCachedGrid: PixelGrid | null
): boolean {
  if (!previousCachedGrid) return false;
  return placeholderByHydratedGrid.get(hydratedGrid) === previousCachedGrid;
}

/**
 * Returns the real PixelGrid for a layer. If the layer is still backed by a pending ImageBitmap
 * (e.g. user clicked a tool in the first ~150ms after opening a 4K photo), synchronously hydrates
 * it on demand so no tool or export ever sees empty pixels.
 */
export function resolveHydratedPixelGrid(grid: PixelGrid | null | undefined): PixelGrid | null {
  if (!grid) return null;
  if (grid.length > 0) return grid;

  const entry = pendingBitmapByPlaceholder.get(grid);
  if (!entry) return grid;
  if (entry.hydratedGrid) {
    notifyHydrated(entry, entry.hydratedGrid);
    return entry.hydratedGrid;
  }
  if (entry.released || entry.closed) return createPixelGrid(entry.width * entry.height);

  const hydrated = extractBitmapToPixelGridSync(entry.bitmap, entry.width, entry.height);
  return finalizeHydration(grid, entry, hydrated);
}

/**
 * Ensures every layer in a ProjectState has a hydrated PixelGrid (synchronously if still pending).
 */
export function ensureProjectHydrated(state: ProjectState): ProjectState {
  let anyChanged = false;
  const nextFrames = state.frames.map((frame) => {
    let frameChanged = false;
    let nextLayerData: Record<string, PixelGrid> | null = null;
    for (const layerId in frame.layerData) {
      const grid = frame.layerData[layerId];
      if (grid && grid.length === 0 && pendingBitmapByPlaceholder.has(grid)) {
        const hydrated = resolveHydratedPixelGrid(grid);
        if (hydrated && hydrated !== grid) {
          if (!nextLayerData) nextLayerData = { ...frame.layerData };
          nextLayerData[layerId] = hydrated;
          frameChanged = true;
          anyChanged = true;
        }
      }
    }
    return frameChanged && nextLayerData ? { ...frame, layerData: nextLayerData } : frame;
  });
  return anyChanged ? { ...state, frames: nextFrames } : state;
}

/**
 * Kicks off off-main-thread CPU pixel extraction for any pending ImageBitmap layers in a newly opened project.
 * Calls onHydrated with the hydrated PixelGrid once ready (if not already hydrated or released).
 */
export function startBackgroundProjectHydration(
  state: ProjectState,
  onHydrated: (frameIndex: number, layerId: string, placeholder: PixelGrid, hydrated: PixelGrid) => void
): void {
  for (let fIdx = 0; fIdx < state.frames.length; fIdx++) {
    const frame = state.frames[fIdx];
    for (const layerId in frame.layerData) {
      const placeholder = frame.layerData[layerId];
      if (!placeholder || placeholder.length !== 0) continue;
      const entry = pendingBitmapByPlaceholder.get(placeholder);
      if (!entry || entry.closed) continue;

      entry.onHydrated = (hydrated) => onHydrated(fIdx, layerId, placeholder, hydrated);

      if (entry.hydratedGrid) {
        notifyHydrated(entry, entry.hydratedGrid);
        continue;
      }
      if (entry.released) continue;

      decodeImageFileAsync(entry.file)
        .then((decoded) => {
          if (entry.closed) return;
          if (entry.hydratedGrid) {
            notifyHydrated(entry, entry.hydratedGrid);
            return;
          }
          if (entry.released) return;
          const hydrated = decoded
            ? decoded.pixels
            : extractBitmapToPixelGridSync(entry.bitmap, entry.width, entry.height);
          finalizeHydration(placeholder, entry, hydrated);
        })
        .catch(() => {
          if (entry.closed) return;
          if (entry.hydratedGrid) {
            notifyHydrated(entry, entry.hydratedGrid);
            return;
          }
          if (entry.released) return;
          const hydrated = extractBitmapToPixelGridSync(entry.bitmap, entry.width, entry.height);
          finalizeHydration(placeholder, entry, hydrated);
        });
    }
  }
}

/**
 * Releases any still-pending ImageBitmaps when a project is closed before hydration completes.
 */
export function releasePendingProjectBitmaps(state: ProjectState): void {
  for (let fIdx = 0; fIdx < state.frames.length; fIdx++) {
    const layerData = state.frames[fIdx].layerData;
    for (const layerId in layerData) {
      const grid = layerData[layerId];
      if (!grid || grid.length !== 0) continue;
      const entry = pendingBitmapByPlaceholder.get(grid);
      if (entry) {
        entry.closed = true;
        entry.onHydrated = undefined;
        if (!entry.released) {
          entry.released = true;
          try {
            entry.bitmap.close();
          } catch {
            // Ignore already-closed bitmap
          }
        }
      }
    }
  }
}
