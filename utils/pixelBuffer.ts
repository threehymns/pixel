import { ColorMode, PixelGrid, PixelLayerPatch, PixelValue } from '../types';
import { MIN_ZOOM } from '../constants';

export const EMPTY_PIXEL: PixelValue = 0;

// Fixed 256-entry hex byte table (zero per-call string array/map allocations)
const HEX_BYTE_TABLE: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0')
);

const IS_LITTLE_ENDIAN = (() => {
  const buf = new ArrayBuffer(4);
  const u32 = new Uint32Array(buf);
  const u8 = new Uint8Array(buf);
  u32[0] = 0x01020304;
  return u8[0] === 0x04;
})();

export const isLittleEndian = IS_LITTLE_ENDIAN;

export const createPixelGrid = (length: number): PixelGrid => new Uint32Array(length);

export const clonePixelGrid = (grid: PixelGrid): PixelGrid => new Uint32Array(grid);

/**
 * Packs RGBA channels into a 32-bit unsigned integer matching little-endian ImageData layout (ABGR).
 * Any visible pixel (a > 0) has (val >>> 24) !== 0 and is guaranteed non-zero.
 */
export const packRGBA = (r: number, g: number, b: number, a: number = 255): PixelValue => {
  const alpha = a & 0xff;
  if (alpha === 0) return EMPTY_PIXEL;
  return (((alpha << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0);
};

export const encodeIndexedPixel = (paletteIndex: number): PixelValue => {
  if (paletteIndex < 0) return EMPTY_PIXEL;
  return ((paletteIndex + 1) & 0x00ffffff) >>> 0;
};

export const decodeIndexedPixel = (val: PixelValue): number => {
  return (val & 0x00ffffff) - 1;
};

export const isPackedRgbaPixel = (val: PixelValue): boolean => {
  return (val >>> 24) !== 0;
};

export const isIndexedPixel = (val: PixelValue): boolean => {
  return val !== 0 && (val >>> 24) === 0;
};

const parseHexNibble = (code: number): number => {
  if (code >= 48 && code <= 57) return code - 48; // '0'-'9'
  if (code >= 97 && code <= 102) return code - 87; // 'a'-'f'
  if (code >= 65 && code <= 70) return code - 55; // 'A'-'F'
  return 0;
};

/**
 * Fast, allocation-free hex color parser (#rrggbb or #rgb).
 * Does not use an unbounded global cache.
 */
export const hexToRgb = (hex: string): [number, number, number] => {
  if (!hex || hex.charCodeAt(0) !== 35) return [0, 0, 0];
  if (hex.length === 7) {
    const r = (parseHexNibble(hex.charCodeAt(1)) << 4) | parseHexNibble(hex.charCodeAt(2));
    const g = (parseHexNibble(hex.charCodeAt(3)) << 4) | parseHexNibble(hex.charCodeAt(4));
    const b = (parseHexNibble(hex.charCodeAt(5)) << 4) | parseHexNibble(hex.charCodeAt(6));
    return [r, g, b];
  }
  if (hex.length === 4) {
    const rN = parseHexNibble(hex.charCodeAt(1));
    const gN = parseHexNibble(hex.charCodeAt(2));
    const bN = parseHexNibble(hex.charCodeAt(3));
    return [(rN << 4) | rN, (gN << 4) | gN, (bN << 4) | bN];
  }
  return [0, 0, 0];
};

/**
 * Parses a hex string directly into packed little-endian ABGR uint32 without allocating tuples or caching globally.
 */
export const getPackedColor = (hex: string, alpha: number = 255): number => {
  const a = alpha & 0xff;
  if (a === 0 || !hex || hex.charCodeAt(0) !== 35) return 0;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 7) {
    r = (parseHexNibble(hex.charCodeAt(1)) << 4) | parseHexNibble(hex.charCodeAt(2));
    g = (parseHexNibble(hex.charCodeAt(3)) << 4) | parseHexNibble(hex.charCodeAt(4));
    b = (parseHexNibble(hex.charCodeAt(5)) << 4) | parseHexNibble(hex.charCodeAt(6));
  } else if (hex.length === 4) {
    const rN = parseHexNibble(hex.charCodeAt(1));
    const gN = parseHexNibble(hex.charCodeAt(2));
    const bN = parseHexNibble(hex.charCodeAt(3));
    r = (rN << 4) | rN;
    g = (gN << 4) | gN;
    b = (bN << 4) | bN;
  }
  return (((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const cr = r <= 0 ? 0 : r >= 255 ? 255 : Math.round(r);
  const cg = g <= 0 ? 0 : g >= 255 ? 255 : Math.round(g);
  const cb = b <= 0 ? 0 : b >= 255 ? 255 : Math.round(b);
  return `#${HEX_BYTE_TABLE[cr]}${HEX_BYTE_TABLE[cg]}${HEX_BYTE_TABLE[cb]}`;
};

export const packedToHex = (packed: number): string => {
  const r = packed & 0xff;
  const g = (packed >>> 8) & 0xff;
  const b = (packed >>> 16) & 0xff;
  return `#${HEX_BYTE_TABLE[r]}${HEX_BYTE_TABLE[g]}${HEX_BYTE_TABLE[b]}`;
};

export const packedToRgb = (packed: number): [number, number, number] => [
  packed & 0xff,
  (packed >>> 8) & 0xff,
  (packed >>> 16) & 0xff,
];

export const pixelToHex = (val: PixelValue, palette: string[]): string | null => {
  if (val === EMPTY_PIXEL) return null;
  if ((val >>> 24) !== 0) {
    return packedToHex(val);
  }
  const idx = val - 1;
  return idx >= 0 && idx < palette.length ? palette[idx] : null;
};

export const pixelToRgb = (val: PixelValue, palette: string[]): [number, number, number] | null => {
  if (val === EMPTY_PIXEL) return null;
  if ((val >>> 24) !== 0) {
    return [val & 0xff, (val >>> 8) & 0xff, (val >>> 16) & 0xff];
  }
  const idx = val - 1;
  const hex = idx >= 0 && idx < palette.length ? palette[idx] : null;
  return hex ? hexToRgb(hex) : null;
};

export const resolveColorToPixel = (
  hex: string,
  colorMode: ColorMode,
  palette: string[]
): PixelValue => {
  if (colorMode === 'rgba') {
    return getPackedColor(hex, 255);
  }
  const lower = hex.toLowerCase();
  for (let i = 0; i < palette.length; i++) {
    if (palette[i]?.toLowerCase() === lower) {
      return encodeIndexedPixel(i);
    }
  }
  if (palette.length === 0) return getPackedColor(hex, 255);
  const [r, g, b] = hexToRgb(hex);
  return encodeIndexedPixel(findNearestPaletteIndex(r, g, b, palette));
};

const PACKED_PALETTE_255_CACHE = new WeakMap<string[], Uint32Array>();

export const getPackedPalette255 = (palette: string[]): Uint32Array => {
  const cached = PACKED_PALETTE_255_CACHE.get(palette);
  if (cached && cached.length === palette.length) return cached;
  const palLen = palette.length;
  const packed = new Uint32Array(palLen);
  for (let p = 0; p < palLen; p++) {
    if (palette[p]) {
      packed[p] = getPackedColor(palette[p], 255);
    }
  }
  PACKED_PALETTE_255_CACHE.set(palette, packed);
  return packed;
};

/**
 * Resolves a self-describing PixelValue to a packed ABGR ImageData uint32 at full pixel alpha.
 */
export const pixelToPackedImageData = (
  val: PixelValue,
  paletteUint32: Uint32Array
): number => {
  if (val === 0) return 0;
  if ((val >>> 24) !== 0) return val;
  const idx = val - 1;
  return idx >= 0 && idx < paletteUint32.length ? paletteUint32[idx] : 0;
};

interface PaletteRgbLookup {
  len: number;
  rgb: Uint8Array;
  lut: Int16Array | null;
}

const PALETTE_RGB_LOOKUP_CACHE = new WeakMap<string[], PaletteRgbLookup>();
const LUT_SIZE = 32 * 32 * 32; // 32,768 entries (64 KB)

const getPaletteRgbLookup = (palette: string[]): PaletteRgbLookup => {
  const cached = PALETTE_RGB_LOOKUP_CACHE.get(palette);
  if (cached && cached.len === palette.length) {
    return cached;
  }
  const len = palette.length;
  const rgb = new Uint8Array(len * 3);
  for (let i = 0; i < len; i++) {
    const hex = palette[i];
    if (hex) {
      const [pr, pg, pb] = hexToRgb(hex);
      const off = i * 3;
      rgb[off] = pr;
      rgb[off + 1] = pg;
      rgb[off + 2] = pb;
    }
  }
  const entry: PaletteRgbLookup = { len, rgb, lut: null };
  PALETTE_RGB_LOOKUP_CACHE.set(palette, entry);
  return entry;
};

/**
 * Weighted RGB distance for perceptual palette color matching.
 * Uses a lazily populated 5-bit/channel (32x32x32 = 64 KB) LUT so both integer
 * and fractional (dithered) RGB lookups run in O(1) without Map overhead.
 */
export const findNearestPaletteIndex = (
  r: number,
  g: number,
  b: number,
  palette: string[]
): number => {
  const len = palette.length;
  if (len === 0) return 0;

  const lookup = getPaletteRgbLookup(palette);
  const cr = r <= 0 ? 0 : r >= 255 ? 255 : (r + 0.5) | 0;
  const cg = g <= 0 ? 0 : g >= 255 ? 255 : (g + 0.5) | 0;
  const cb = b <= 0 ? 0 : b >= 255 ? 255 : (b + 0.5) | 0;

  if (len <= 32767) {
    let lut = lookup.lut;
    if (!lut) {
      lut = new Int16Array(LUT_SIZE);
      lut.fill(-1);
      lookup.lut = lut;
    }
    const r5 = cr >>> 3;
    const g5 = cg >>> 3;
    const b5 = cb >>> 3;
    const lutKey = (r5 << 10) | (g5 << 5) | b5;
    const cachedIdx = lut[lutKey];
    if (cachedIdx >= 0) return cachedIdx;

    // Evaluate perceptual distance at the 5-bit bin center for uniform accuracy
    const qr = (r5 << 3) | (r5 >>> 2);
    const qg = (g5 << 3) | (g5 >>> 2);
    const qb = (b5 << 3) | (b5 >>> 2);

    let minDistance = Infinity;
    let nearestIndex = 0;
    const rgb = lookup.rgb;

    for (let i = 0, off = 0; i < len; i++, off += 3) {
      const dr = qr - rgb[off];
      const dg = qg - rgb[off + 1];
      const db = qb - rgb[off + 2];
      const dist = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
        if (dist === 0) break;
      }
    }

    lut[lutKey] = nearestIndex;
    return nearestIndex;
  }

  let minDistance = Infinity;
  let nearestIndex = 0;
  const rgb = lookup.rgb;

  for (let i = 0, off = 0; i < len; i++, off += 3) {
    const dr = cr - rgb[off];
    const dg = cg - rgb[off + 1];
    const db = cb - rgb[off + 2];
    const dist = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
      if (dist === 0) break;
    }
  }

  return nearestIndex;
};

/**
 * Computes a safe initial zoom level for any canvas dimension, including 4K+ images
 * where integer Math.floor(512 / maxDim) previously produced 0.
 */
export const computeInitialZoom = (width: number, height: number, maxZoom: number = 32): number => {
  const maxDim = Math.max(1, width, height);
  const raw = 512 / maxDim;
  if (raw >= 1) {
    return Math.min(maxZoom, Math.floor(raw));
  }
  return Math.max(MIN_ZOOM, Math.floor(raw * 100) / 100);
};

/**
 * Migrates legacy JSON/PXA (string | number | null)[] pixel arrays or plain number arrays into Uint32Array.
 */
export const migrateLegacyPixelGrid = (
  raw: unknown,
  width: number,
  height: number,
  colorMode: ColorMode
): PixelGrid => {
  const total = Math.max(0, width * height);
  if (raw instanceof Uint32Array) {
    if (raw.length === total) return raw;
    const resized = new Uint32Array(total);
    resized.set(raw.subarray(0, Math.min(raw.length, total)));
    return resized;
  }

  const out = new Uint32Array(total);
  if (!Array.isArray(raw)) return out;

  const len = Math.min(raw.length, total);
  for (let i = 0; i < len; i++) {
    const val = raw[i];
    if (val === null || val === undefined) continue;
    if (typeof val === 'string') {
      out[i] = getPackedColor(val, 255);
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      if (colorMode === 'rgba' && (val >>> 24) !== 0) {
        out[i] = val >>> 0;
      } else if (val >= 0) {
        out[i] = encodeIndexedPixel(val);
      }
    }
  }
  return out;
};

/**
 * Extracts a rectangular sub-buffer from a flat PixelGrid using fast row-wise subarray copies.
 */
export const extractRectPatch = (
  grid: PixelGrid,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number
): Uint32Array => {
  const out = new Uint32Array(w * h);
  for (let row = 0; row < h; row++) {
    const srcStart = (y + row) * width + x;
    out.set(grid.subarray(srcStart, srcStart + w), row * w);
  }
  return out;
};

/**
 * Writes a rectangular sub-buffer into a target PixelGrid in place using fast row-wise copies.
 */
export const applyRectPatch = (
  target: PixelGrid,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  data: Uint32Array
): void => {
  for (let row = 0; row < h; row++) {
    const srcStart = row * w;
    const dstStart = (y + row) * width + x;
    target.set(data.subarray(srcStart, srcStart + w), dstStart);
  }
};

/**
 * Builds a minimal dirty-rect PixelLayerPatch comparing beforeGrid and afterGrid.
 * When bounds are provided, only scans/extracts within those clamped bounds.
 */
export const buildLayerPatch = (
  layerId: string,
  beforeGrid: PixelGrid | null | undefined,
  afterGrid: PixelGrid,
  width: number,
  height: number,
  bounds?: { minX: number; minY: number; maxX: number; maxY: number } | null
): PixelLayerPatch | null => {
  const scanMinX = bounds ? Math.max(0, bounds.minX) : 0;
  const scanMinY = bounds ? Math.max(0, bounds.minY) : 0;
  const scanMaxX = bounds ? Math.min(width - 1, bounds.maxX) : width - 1;
  const scanMaxY = bounds ? Math.min(height - 1, bounds.maxY) : height - 1;

  if (scanMaxX < scanMinX || scanMaxY < scanMinY) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  if (beforeGrid) {
    for (let y = scanMinY; y <= scanMaxY; y++) {
      const rowOff = y * width;
      for (let x = scanMinX; x <= scanMaxX; x++) {
        const idx = rowOff + x;
        if (beforeGrid[idx] !== afterGrid[idx]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } else {
    for (let y = scanMinY; y <= scanMaxY; y++) {
      const rowOff = y * width;
      for (let x = scanMinX; x <= scanMaxX; x++) {
        if (afterGrid[rowOff + x] !== EMPTY_PIXEL) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  return {
    layerId,
    x: minX,
    y: minY,
    w,
    h,
    before: beforeGrid ? extractRectPatch(beforeGrid, width, minX, minY, w, h) : new Uint32Array(w * h),
    after: extractRectPatch(afterGrid, width, minX, minY, w, h),
  };
};
