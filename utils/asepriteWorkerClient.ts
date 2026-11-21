import { PixelGrid, ProjectState } from '../types';
import {
  encodeAseprite,
  parseAseprite,
  AsepriteEncodeInput,
  AsepriteCompressionLevel,
} from './aseprite';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (err: unknown) => void;
}

interface WorkerCachedCelMeta {
  width: number;
  height: number;
  pxLen: number;
  compressedKey: string;
  compressedLevel: number;
  paletteSig: string;
}

const WORKER_MAX_CEL_CACHE_ENTRIES = 48;

let workerInstance: Worker | null = null;
let workerFailed = false;
let nextRequestId = 1;
let nextGridId = 1;
const pending = new Map<number, PendingRequest>();
const gridIdMap = new WeakMap<PixelGrid, number>();
// Mirrors the worker's bounded LRU cel cache so unchanged 33MB PixelGrids are never re-cloned across postMessage
const knownWorkerCelCache = new Map<number, WorkerCachedCelMeta>();

function getGridId(grid: PixelGrid): number {
  let id = gridIdMap.get(grid);
  if (id === undefined) {
    id = nextGridId++;
    gridIdMap.set(grid, id);
  }
  return id;
}

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (workerInstance) return workerInstance;

  try {
    const w = new Worker(new URL('./aseprite.worker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (event: MessageEvent<any>) => {
      const { id, ok, buffer, state, decodedImage, error } = event.data || {};
      const req = pending.get(id);
      if (!req) return;
      pending.delete(id);
      if (!ok) {
        req.reject(new Error(error || 'Aseprite worker error'));
      } else if (decodedImage !== undefined) {
        req.resolve({
          width: decodedImage.width,
          height: decodedImage.height,
          pixels: new Uint32Array(decodedImage.buffer),
        });
      } else if (buffer !== undefined) {
        req.resolve(new Uint8Array(buffer));
      } else {
        req.resolve(state);
      }
    };
    w.onerror = (err) => {
      console.warn('Aseprite worker encountered an error, falling back to main thread:', err);
      workerFailed = true;
      workerInstance = null;
      knownWorkerCelCache.clear();
      const errObj = new Error('Aseprite worker failed');
      pending.forEach((req) => req.reject(errObj));
      pending.clear();
    };
    workerInstance = w;
    return w;
  } catch (err) {
    console.warn('Unable to spawn Aseprite worker, using main thread:', err);
    workerFailed = true;
    return null;
  }
}

function buildCloneableEncodePayload(
  state: AsepriteEncodeInput,
  compressionLevel: AsepriteCompressionLevel
): {
  payload: AsepriteEncodeInput;
  frameGridIds: Record<string, number>[];
  newlyCachedEntries: { gridId: number; meta: WorkerCachedCelMeta }[];
} {
  const effectivePalette =
    state.palette && state.palette.length > 0 ? state.palette : ['#000000', '#ffffff'];
  const paletteSig = effectivePalette.join(',');
  const isIndexed = state.colorMode === 'indexed';
  const effectiveTransparentIndex =
    state.transparentIndex !== undefined && state.transparentIndex >= 0
      ? state.transparentIndex
      : isIndexed
        ? effectivePalette.length <= 255
          ? 255
          : 0
        : 0;
  const compressedKey = `${isIndexed ? 1 : 0}:${effectiveTransparentIndex}`;

  const frameGridIds: Record<string, number>[] = [];
  const newlyCachedEntries: { gridId: number; meta: WorkerCachedCelMeta }[] = [];
  const sentGridIdsInThisCall = new Set<number>();

  const frames = state.frames.map((frame) => {
    const filteredLayerData: Record<string, PixelGrid> = {};
    const gridIdsForFrame: Record<string, number> = {};

    for (const layerId in frame.layerData) {
      const grid = frame.layerData[layerId];
      if (!grid) continue;
      const gId = getGridId(grid);
      gridIdsForFrame[layerId] = gId;

      const existingMeta = knownWorkerCelCache.get(gId);
      const isWorkerCacheHit = Boolean(
        existingMeta &&
          existingMeta.width === state.width &&
          existingMeta.height === state.height &&
          existingMeta.pxLen === grid.length &&
          existingMeta.compressedKey === compressedKey &&
          existingMeta.compressedLevel >= compressionLevel &&
          existingMeta.paletteSig === paletteSig
      );

      if (isWorkerCacheHit) {
        // Refresh LRU order to stay in lockstep with workerCelCache
        knownWorkerCelCache.delete(gId);
        knownWorkerCelCache.set(gId, existingMeta!);
        continue;
      }

      // If another frame in this same encode call already included this exact gridId,
      // skip duplicating the 33MB buffer in postMessage (worker resolves linked cel by gridId)
      if (sentGridIdsInThisCall.has(gId)) {
        continue;
      }

      sentGridIdsInThisCall.add(gId);
      filteredLayerData[layerId] = grid;
      newlyCachedEntries.push({
        gridId: gId,
        meta: {
          width: state.width,
          height: state.height,
          pxLen: grid.length,
          compressedKey,
          compressedLevel: compressionLevel,
          paletteSig,
        },
      });
    }

    frameGridIds.push(gridIdsForFrame);
    return {
      id: frame.id,
      duration: frame.duration,
      layerData: filteredLayerData,
    };
  });

  return {
    payload: {
      width: state.width,
      height: state.height,
      colorMode: state.colorMode,
      palette: state.palette,
      paletteNames: state.paletteNames,
      layers: state.layers,
      frames,
      tags: state.tags,
      slices: state.slices,
      tilesets: state.tilesets,
      externalFiles: state.externalFiles,
      colorProfile: state.colorProfile,
      transparentIndex: state.transparentIndex,
      grid: state.grid,
      pixelRatio: state.pixelRatio,
      userData: state.userData,
    },
    frameGridIds,
    newlyCachedEntries,
  };
}

/**
 * Encodes a ProjectState to Aseprite binary off the main thread via Web Worker.
 * Tracks worker-cached cels by grid identity so unchanged layers skip structured-cloning & re-compression.
 * Automatically falls back to synchronous main-thread encoding if Workers are unavailable.
 */
export async function encodeAsepriteAsync(
  state: AsepriteEncodeInput,
  options?: { compressionLevel?: AsepriteCompressionLevel }
): Promise<Uint8Array> {
  const compressionLevel: AsepriteCompressionLevel = options?.compressionLevel ?? 6;
  const worker = getWorker();
  if (!worker) {
    return encodeAseprite(state, { compressionLevel });
  }

  const id = nextRequestId++;
  const { payload, frameGridIds, newlyCachedEntries } = buildCloneableEncodePayload(
    state,
    compressionLevel
  );

  // Optimistically update mirrored LRU in the same order the worker will process frames
  for (let i = 0; i < newlyCachedEntries.length; i++) {
    const { gridId, meta } = newlyCachedEntries[i];
    knownWorkerCelCache.delete(gridId);
    knownWorkerCelCache.set(gridId, meta);
    while (knownWorkerCelCache.size > WORKER_MAX_CEL_CACHE_ENTRIES) {
      const oldestKey = knownWorkerCelCache.keys().next().value;
      if (oldestKey === undefined) break;
      knownWorkerCelCache.delete(oldestKey);
    }
  }

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type: 'encode', payload, compressionLevel, frameGridIds });
    });
  } catch {
    knownWorkerCelCache.clear();
    return encodeAseprite(state, { compressionLevel });
  }
}

/**
 * Parses an Aseprite binary buffer off the main thread via Web Worker.
 * Copies/transfers the ArrayBuffer cleanly and falls back to main thread if needed.
 */
export async function parseAsepriteAsync(
  buffer: ArrayBuffer,
  filename = 'imported'
): Promise<ProjectState> {
  const worker = getWorker();
  if (!worker) {
    return parseAseprite(buffer, filename);
  }

  const id = nextRequestId++;
  const workerBuffer = buffer.slice(0);

  try {
    return await new Promise<ProjectState>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type: 'parse', buffer: workerBuffer, filename }, [workerBuffer]);
    });
  } catch {
    return parseAseprite(buffer, filename);
  }
}

/**
 * Decodes an image file (PNG/JPEG/WebP/etc.) off the main thread using createImageBitmap + OffscreenCanvas
 * and transfers the resulting packed Uint32Array PixelGrid back with zero copy.
 * Returns null if worker decoding is unavailable or unsupported (e.g., SVG) so caller can fall back.
 */
export async function decodeImageFileAsync(
  file: Blob
): Promise<{ width: number; height: number; pixels: PixelGrid } | null> {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const worker = getWorker();
  if (!worker) return null;

  const id = nextRequestId++;
  try {
    return await new Promise<{ width: number; height: number; pixels: PixelGrid }>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type: 'decode-image', file });
    });
  } catch {
    return null;
  }
}
