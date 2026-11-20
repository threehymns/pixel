import { ProjectState } from '../types';
import { encodeAseprite, parseAseprite, AsepriteEncodeInput } from './aseprite';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (err: unknown) => void;
}

let workerInstance: Worker | null = null;
let workerFailed = false;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (workerInstance) return workerInstance;

  try {
    const w = new Worker(new URL('./aseprite.worker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (event: MessageEvent<any>) => {
      const { id, ok, buffer, state, error } = event.data || {};
      const req = pending.get(id);
      if (!req) return;
      pending.delete(id);
      if (!ok) {
        req.reject(new Error(error || 'Aseprite worker error'));
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

function buildCloneableEncodePayload(state: AsepriteEncodeInput): AsepriteEncodeInput {
  return {
    width: state.width,
    height: state.height,
    colorMode: state.colorMode,
    palette: state.palette,
    paletteNames: state.paletteNames,
    layers: state.layers,
    frames: state.frames,
    tags: state.tags,
    slices: state.slices,
    tilesets: state.tilesets,
    externalFiles: state.externalFiles,
    colorProfile: state.colorProfile,
    transparentIndex: state.transparentIndex,
    grid: state.grid,
    pixelRatio: state.pixelRatio,
    userData: state.userData,
  };
}

/**
 * Encodes a ProjectState to Aseprite binary off the main thread via Web Worker.
 * Automatically falls back to synchronous main-thread encoding if Workers are unavailable.
 */
export async function encodeAsepriteAsync(state: AsepriteEncodeInput): Promise<Uint8Array> {
  const worker = getWorker();
  if (!worker) {
    return encodeAseprite(state);
  }

  const id = nextRequestId++;
  const payload = buildCloneableEncodePayload(state);

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type: 'encode', payload });
    });
  } catch {
    return encodeAseprite(state);
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
  // Keep a cloneable copy only if fallback is needed; transfer the worker copy with zero copy
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
