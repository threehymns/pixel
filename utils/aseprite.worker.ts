import {
  encodeAseprite,
  parseAseprite,
  precompressLargeCelsInCache,
  AsepriteEncodeInput,
  AsepriteCompressionLevel,
  CachedEncodedCel,
} from './aseprite';
import { isLittleEndian } from './pixelBuffer';

const WORKER_MAX_CEL_CACHE_ENTRIES = 48;
const WORKER_MAX_CEL_CACHE_BYTES = 96 * 1024 * 1024; // 96 MB byte cap to avoid 500MB-1GB worker bloat on 4K photos
const workerCelCache = new Map<number, CachedEncodedCel>();

type WorkerRequest =
  | {
      id: number;
      type: 'encode';
      payload: AsepriteEncodeInput;
      compressionLevel?: AsepriteCompressionLevel;
      frameGridIds?: Record<string, number>[];
    }
  | {
      id: number;
      type: 'parse';
      buffer: ArrayBuffer;
      filename: string;
    }
  | {
      id: number;
      type: 'decode-image';
      file: Blob;
    };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'encode') {
      const encodeOpts = {
        compressionLevel: msg.compressionLevel,
        frameGridIds: msg.frameGridIds,
        externalCelCache: workerCelCache,
        maxExternalCacheEntries: WORKER_MAX_CEL_CACHE_ENTRIES,
        maxExternalCacheBytes: WORKER_MAX_CEL_CACHE_BYTES,
      };
      await precompressLargeCelsInCache(msg.payload, encodeOpts);
      const encoded = encodeAseprite(msg.payload, encodeOpts);
      // Slice to an exact ArrayBuffer so it can be transferred with zero copy
      const exactBuffer =
        encoded.byteOffset === 0 && encoded.byteLength === encoded.buffer.byteLength
          ? (encoded.buffer as ArrayBuffer)
          : encoded.slice().buffer;
      const cachedGridIds = Array.from(workerCelCache.keys());
      (self as unknown as Worker).postMessage(
        { id: msg.id, ok: true, buffer: exactBuffer, cachedGridIds },
        [exactBuffer]
      );
    } else if (msg.type === 'parse') {
      const state = await parseAseprite(msg.buffer, msg.filename);
      // Collect unique PixelGrid ArrayBuffers to transfer back with zero copy
      const transferables: Transferable[] = [];
      const seenBuffers = new Set<ArrayBufferLike>();
      for (let f = 0; f < state.frames.length; f++) {
        const layerData = state.frames[f].layerData;
        for (const key in layerData) {
          const grid = layerData[key];
          if (grid && grid.buffer && !seenBuffers.has(grid.buffer)) {
            seenBuffers.add(grid.buffer);
            transferables.push(grid.buffer as ArrayBuffer);
          }
        }
      }
      if (state.tilesets) {
        for (const ts of state.tilesets) {
          if (ts.pixels && ts.pixels.buffer && !seenBuffers.has(ts.pixels.buffer)) {
            seenBuffers.add(ts.pixels.buffer);
            transferables.push(ts.pixels.buffer as ArrayBuffer);
          }
        }
      }
      (self as unknown as Worker).postMessage(
        { id: msg.id, ok: true, state },
        transferables
      );
    } else if (msg.type === 'decode-image') {
      if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
        throw new Error('OffscreenCanvas decode not supported in worker');
      }
      const bitmap = await createImageBitmap(msg.file);
      let width = 0;
      let height = 0;
      let imageData: ImageData;
      try {
        width = bitmap.width;
        height = bitmap.height;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Failed to get OffscreenCanvas 2d context');
        ctx.drawImage(bitmap, 0, 0);
        imageData = ctx.getImageData(0, 0, width, height);
      } finally {
        bitmap.close();
      }

      const raw = imageData.data;
      const pixelCount = width * height;
      let outBuffer: ArrayBuffer;

      if (isLittleEndian && raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength) {
        // Zero-copy in-place conversion: Canvas ImageData is already little-endian ABGR.
        // Scrub any zero-alpha pixels in-place to guarantee EMPTY_PIXEL (0) invariant.
        const u32 = new Uint32Array(raw.buffer);
        for (let i = 0; i < pixelCount; i++) {
          if ((u32[i] >>> 24) === 0) {
            u32[i] = 0;
          }
        }
        outBuffer = raw.buffer as ArrayBuffer;
      } else {
        const pixels = new Uint32Array(pixelCount);
        for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
          const a = raw[p + 3];
          if (a !== 0) {
            pixels[i] = ((a << 24) | (raw[p + 2] << 16) | (raw[p + 1] << 8) | raw[p]) >>> 0;
          }
        }
        outBuffer = pixels.buffer as ArrayBuffer;
      }

      (self as unknown as Worker).postMessage(
        { id: msg.id, ok: true, decodedImage: { width, height, buffer: outBuffer } },
        [outBuffer]
      );
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
