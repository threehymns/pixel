import { encodeAseprite, parseAseprite, AsepriteEncodeInput } from './aseprite';

type WorkerRequest =
  | {
      id: number;
      type: 'encode';
      payload: AsepriteEncodeInput;
    }
  | {
      id: number;
      type: 'parse';
      buffer: ArrayBuffer;
      filename: string;
    };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'encode') {
      const encoded = encodeAseprite(msg.payload);
      // Slice to an exact ArrayBuffer so it can be transferred with zero copy
      const exactBuffer =
        encoded.byteOffset === 0 && encoded.byteLength === encoded.buffer.byteLength
          ? (encoded.buffer as ArrayBuffer)
          : encoded.slice().buffer;
      (self as unknown as Worker).postMessage(
        { id: msg.id, ok: true, buffer: exactBuffer },
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
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
