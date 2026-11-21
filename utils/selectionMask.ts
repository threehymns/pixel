export interface SelectionBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SelectionSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const popcnt32 = (v: number): number => {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

/**
 * Compact, high-performance pixel selection mask backed by either:
 * 1. An O(1) axis-aligned rectangle fast-path (0 bytes for Select All / Rect Select), or
 * 2. A 1-bit-per-pixel Uint32Array bitset (~1.04 MB at 4K vs ~400 MB for Set<number>).
 *
 * Bounds and pixel counts are cached lazily for O(1) repeated queries.
 */
export class SelectionMask {
  readonly width: number;
  readonly height: number;
  private _bits: Uint32Array | null;
  private _rect: SelectionBounds | null;
  private _size: number;
  private _bounds: SelectionBounds | null | undefined;
  private _segments: SelectionSegment[] | null = null;

  constructor(
    width: number,
    height: number,
    options?: {
      bits?: Uint32Array | null;
      rect?: SelectionBounds | null;
      size?: number;
      bounds?: SelectionBounds | null;
    }
  ) {
    this.width = Math.max(1, width | 0);
    this.height = Math.max(1, height | 0);

    if (options?.rect) {
      const rx = Math.max(0, Math.min(this.width, options.rect.x | 0));
      const ry = Math.max(0, Math.min(this.height, options.rect.y | 0));
      const rx2 = Math.max(rx, Math.min(this.width, (options.rect.x + options.rect.w) | 0));
      const ry2 = Math.max(ry, Math.min(this.height, (options.rect.y + options.rect.h) | 0));
      const rw = rx2 - rx;
      const rh = ry2 - ry;
      if (rw > 0 && rh > 0) {
        this._rect = { x: rx, y: ry, w: rw, h: rh };
        this._bits = null;
        this._size = rw * rh;
        this._bounds = this._rect;
      } else {
        this._rect = null;
        this._bits = null;
        this._size = 0;
        this._bounds = null;
      }
      return;
    }

    if (options?.bits) {
      this._bits = options.bits;
      this._rect = null;
      this._size = options.size ?? -1;
      this._bounds = options.bounds;
      return;
    }

    this._bits = null;
    this._rect = null;
    this._size = 0;
    this._bounds = null;
  }

  static empty(width: number, height: number): SelectionMask {
    return new SelectionMask(width, height);
  }

  static full(width: number, height: number): SelectionMask {
    return new SelectionMask(width, height, {
      rect: { x: 0, y: 0, w: width, h: height },
    });
  }

  static fromRect(
    x: number,
    y: number,
    w: number,
    h: number,
    width: number,
    height: number
  ): SelectionMask {
    return new SelectionMask(width, height, {
      rect: { x, y, w, h },
    });
  }

  static fromIndices(
    indices: Iterable<number>,
    width: number,
    height: number
  ): SelectionMask {
    const mask = new SelectionMask(width, height);
    for (const raw of indices) {
      const idx = Number(raw);
      if (Number.isInteger(idx) && idx >= 0 && idx < width * height) {
        mask.add(idx);
      }
    }
    return mask;
  }

  static fromAny(
    raw: unknown,
    width: number,
    height: number
  ): SelectionMask | null {
    if (!raw) return null;
    if (raw instanceof SelectionMask) {
      if (raw.size === 0) return null;
      if (raw.width === width && raw.height === height) return raw;
      // Re-project if dimensions changed
      const out = new SelectionMask(width, height);
      raw.forEachCoord((x, y) => {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          out.addCoord(x, y);
        }
      });
      return out.size > 0 ? out : null;
    }
    if (raw instanceof Set) {
      if (raw.size === 0) return null;
      const out = SelectionMask.fromIndices(raw as Set<number>, width, height);
      return out.size > 0 ? out : null;
    }
    if (Array.isArray(raw)) {
      if (raw.length === 0) return null;
      const out = SelectionMask.fromIndices(raw, width, height);
      return out.size > 0 ? out : null;
    }
    return null;
  }

  get totalPixels(): number {
    return this.width * this.height;
  }

  get wordCount(): number {
    return (this.width * this.height + 31) >>> 5;
  }

  get isRect(): boolean {
    return this._rect !== null;
  }

  get rect(): SelectionBounds | null {
    return this._rect;
  }

  get byteLength(): number {
    return this._bits ? this._bits.byteLength : 64;
  }

  get size(): number {
    if (this._size >= 0) return this._size;
    if (!this._bits) {
      this._size = 0;
      return 0;
    }
    let count = 0;
    const bits = this._bits;
    for (let i = 0; i < bits.length; i++) {
      const w = bits[i];
      if (w !== 0) count += popcnt32(w);
    }
    this._size = count;
    return count;
  }

  get isEmpty(): boolean {
    return this.size === 0;
  }

  private ensureBits(): Uint32Array {
    if (this._bits) return this._bits;
    const bits = new Uint32Array(this.wordCount);
    if (this._rect) {
      const { x: rx, y: ry, w: rw, h: rh } = this._rect;
      const width = this.width;
      const xEnd = rx + rw - 1;
      for (let y = ry; y < ry + rh; y++) {
        SelectionMask.setSpanInBits(bits, y * width + rx, y * width + xEnd);
      }
      this._rect = null;
    }
    this._bits = bits;
    return bits;
  }

  private static setSpanInBits(bits: Uint32Array, startIdx: number, endIdx: number): void {
    if (endIdx < startIdx) return;
    const startWord = startIdx >>> 5;
    const endWord = endIdx >>> 5;
    const startBit = startIdx & 31;
    const endBit = endIdx & 31;

    if (startWord === endWord) {
      const len = endBit - startBit + 1;
      const mask = len === 32 ? 0xffffffff : (((1 << len) - 1) << startBit) >>> 0;
      bits[startWord] |= mask;
      return;
    }

    bits[startWord] |= (0xffffffff << startBit) >>> 0;
    for (let w = startWord + 1; w < endWord; w++) {
      bits[w] = 0xffffffff;
    }
    const endMask = endBit === 31 ? 0xffffffff : ((1 << (endBit + 1)) - 1) >>> 0;
    bits[endWord] |= endMask;
  }

  /**
   * Returns a read-only view of the underlying bitset, materializing it if currently a rect.
   */
  getBits(): Uint32Array {
    return this.ensureBits();
  }

  has(idx: number): boolean {
    const total = this.width * this.height;
    if (idx < 0 || idx >= total) return false;
    if (this._rect) {
      const y = (idx / this.width) | 0;
      const x = idx - y * this.width;
      const r = this._rect;
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    }
    if (!this._bits) return false;
    return ((this._bits[idx >>> 5] >>> (idx & 31)) & 1) !== 0;
  }

  hasCoord(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    if (this._rect) {
      const r = this._rect;
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    }
    if (!this._bits) return false;
    const idx = y * this.width + x;
    return ((this._bits[idx >>> 5] >>> (idx & 31)) & 1) !== 0;
  }

  add(idx: number): void {
    const total = this.width * this.height;
    if (idx < 0 || idx >= total) return;
    if (this._rect) {
      const y = (idx / this.width) | 0;
      const x = idx - y * this.width;
      const r = this._rect;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return;
    }
    const bits = this.ensureBits();
    const wIdx = idx >>> 5;
    const bit = 1 << (idx & 31);
    if ((bits[wIdx] & bit) === 0) {
      bits[wIdx] |= bit;
      if (this._size >= 0) this._size++;
      this._bounds = undefined;
      this._segments = null;
    }
  }

  addCoord(x: number, y: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.add(y * this.width + x);
  }

  /**
   * Fast horizontal span insertion [x0..x1] inclusive on row y.
   */
  addHorizontalSpan(y: number, x0: number, x1: number): void {
    if (y < 0 || y >= this.height) return;
    const left = Math.max(0, x0 | 0);
    const right = Math.min(this.width - 1, x1 | 0);
    if (right < left) return;
    const bits = this.ensureBits();
    const rowOff = y * this.width;
    SelectionMask.setSpanInBits(bits, rowOff + left, rowOff + right);
    this._size = -1;
    this._bounds = undefined;
    this._segments = null;
  }

  delete(idx: number): void {
    const total = this.width * this.height;
    if (idx < 0 || idx >= total) return;
    if (!this._bits && !this._rect) return;
    const bits = this.ensureBits();
    const wIdx = idx >>> 5;
    const bit = 1 << (idx & 31);
    if ((bits[wIdx] & bit) !== 0) {
      bits[wIdx] &= ~bit;
      if (this._size > 0) this._size--;
      this._bounds = undefined;
      this._segments = null;
    }
  }

  clone(): SelectionMask {
    if (this._rect) {
      return new SelectionMask(this.width, this.height, { rect: { ...this._rect } });
    }
    if (!this._bits || this._size === 0) {
      return SelectionMask.empty(this.width, this.height);
    }
    return new SelectionMask(this.width, this.height, {
      bits: new Uint32Array(this._bits),
      size: this._size,
      bounds: this._bounds === undefined ? undefined : this._bounds ? { ...this._bounds } : null,
    });
  }

  forEach(cb: (idx: number) => void): void {
    if (this._rect) {
      const { x: rx, y: ry, w: rw, h: rh } = this._rect;
      const width = this.width;
      for (let y = ry; y < ry + rh; y++) {
        const rowOff = y * width;
        for (let x = rx; x < rx + rw; x++) {
          cb(rowOff + x);
        }
      }
      return;
    }
    const bits = this._bits;
    if (!bits) return;
    for (let wIdx = 0; wIdx < bits.length; wIdx++) {
      let word = bits[wIdx];
      if (word === 0) continue;
      const base = wIdx << 5;
      while (word !== 0) {
        const lowest = (word & -word) >>> 0;
        const bit = 31 - Math.clz32(lowest);
        cb(base + bit);
        word = (word & (word - 1)) >>> 0;
      }
    }
  }

  forEachCoord(cb: (x: number, y: number, idx: number) => void): void {
    if (this._rect) {
      const { x: rx, y: ry, w: rw, h: rh } = this._rect;
      const width = this.width;
      for (let y = ry; y < ry + rh; y++) {
        const rowOff = y * width;
        for (let x = rx; x < rx + rw; x++) {
          cb(x, y, rowOff + x);
        }
      }
      return;
    }
    const bits = this._bits;
    if (!bits) return;
    const width = this.width;
    for (let wIdx = 0; wIdx < bits.length; wIdx++) {
      let word = bits[wIdx];
      if (word === 0) continue;
      const base = wIdx << 5;
      while (word !== 0) {
        const lowest = (word & -word) >>> 0;
        const bit = 31 - Math.clz32(lowest);
        const idx = base + bit;
        const y = (idx / width) | 0;
        cb(idx - y * width, y, idx);
        word = (word & (word - 1)) >>> 0;
      }
    }
  }

  getBoundingBox(): SelectionBounds | null {
    if (this._bounds !== undefined) return this._bounds;
    if (this._rect) {
      this._bounds = this._rect;
      return this._rect;
    }
    const bits = this._bits;
    if (!bits) {
      this._bounds = null;
      return null;
    }

    const width = this.width;
    let minX = width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;

    for (let wIdx = 0; wIdx < bits.length; wIdx++) {
      const word = bits[wIdx];
      if (word === 0) continue;
      const base = wIdx << 5;
      const firstBit = 31 - Math.clz32((word & -word) >>> 0);
      const lastBit = 31 - Math.clz32(word >>> 0);
      const firstIdx = base + firstBit;
      const lastIdx = base + lastBit;
      const yFirst = (firstIdx / width) | 0;
      const yLast = (lastIdx / width) | 0;

      if (yFirst < minY) minY = yFirst;
      if (yLast > maxY) maxY = yLast;

      if (yFirst === yLast) {
        const xFirst = firstIdx - yFirst * width;
        const xLast = lastIdx - yLast * width;
        if (xFirst < minX) minX = xFirst;
        if (xLast > maxX) maxX = xLast;
      } else {
        // Word wraps across a row boundary: check individual set bits
        let w = word;
        while (w !== 0) {
          const lowest = (w & -w) >>> 0;
          const b = 31 - Math.clz32(lowest);
          const idx = base + b;
          const x = idx % width;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          w = (w & (w - 1)) >>> 0;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      this._bounds = null;
      this._size = 0;
      return null;
    }

    this._bounds = {
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
    return this._bounds;
  }

  /**
   * Computes and caches collinear merged border segments for marching-ants rendering.
   * O(1) for rectangular selections; linear scan over tight bounding box with zero sorting for arbitrary masks.
   */
  getMergedSegments(): SelectionSegment[] {
    if (this._segments) return this._segments;
    if (this._rect) {
      const { x, y, w, h } = this._rect;
      this._segments = [
        { x1: x, y1: y, x2: x + w, y2: y },
        { x1: x, y1: y + h, x2: x + w, y2: y + h },
        { x1: x, y1: y, x2: x, y2: y + h },
        { x1: x + w, y1: y, x2: x + w, y2: y + h },
      ];
      return this._segments;
    }

    const box = this.getBoundingBox();
    const bits = this._bits;
    if (!box || !bits) {
      this._segments = [];
      return this._segments;
    }

    const segments: SelectionSegment[] = [];
    const width = this.width;
    const minX = box.x;
    const minY = box.y;
    const maxX = box.x + box.w - 1;
    const maxY = box.y + box.h - 1;
    const boxW = box.w;

    // Track active vertical edges across rows: vertStart[lx] = starting y, or -1 if inactive
    const vertStart = new Int32Array(boxW + 1);
    vertStart.fill(-1);

    // Scan horizontal edges row-by-row (y = minY .. maxY + 1) and vertical edges (y = minY .. maxY)
    for (let y = minY; y <= maxY + 1; y++) {
      const hasAbove = y > minY;
      const hasBelow = y <= maxY;
      const aboveOff = (y - 1) * width;
      const belowOff = y * width;

      let hRunStart = -1;
      let prevBelow = false;

      for (let lx = 0; lx < boxW; lx++) {
        const x = minX + lx;
        const aIdx = aboveOff + x;
        const bIdx = belowOff + x;
        const above = hasAbove && (((bits[aIdx >>> 5] >>> (aIdx & 31)) & 1) !== 0);
        const below = hasBelow && (((bits[bIdx >>> 5] >>> (bIdx & 31)) & 1) !== 0);

        if (above !== below) {
          if (hRunStart === -1) hRunStart = x;
        } else if (hRunStart !== -1) {
          segments.push({ x1: hRunStart, y1: y, x2: x, y2: y });
          hRunStart = -1;
        }

        if (hasBelow) {
          const isVEdge = prevBelow !== below;
          if (isVEdge) {
            if (vertStart[lx] === -1) vertStart[lx] = y;
          } else if (vertStart[lx] !== -1) {
            segments.push({ x1: x, y1: vertStart[lx], x2: x, y2: y });
            vertStart[lx] = -1;
          }
          prevBelow = below;
        }
      }

      if (hRunStart !== -1) {
        segments.push({ x1: hRunStart, y1: y, x2: maxX + 1, y2: y });
      }

      if (hasBelow) {
        // Rightmost vertical boundary at maxX + 1
        if (prevBelow) {
          if (vertStart[boxW] === -1) vertStart[boxW] = y;
        } else if (vertStart[boxW] !== -1) {
          segments.push({ x1: maxX + 1, y1: vertStart[boxW], x2: maxX + 1, y2: y });
          vertStart[boxW] = -1;
        }
      }
    }

    // Flush remaining active vertical segments at bottom edge (maxY + 1)
    const endY = maxY + 1;
    for (let lx = 0; lx <= boxW; lx++) {
      if (vertStart[lx] !== -1) {
        segments.push({ x1: minX + lx, y1: vertStart[lx], x2: minX + lx, y2: endY });
      }
    }

    this._segments = segments;
    return segments;
  }

  union(other: SelectionMask): SelectionMask {
    if (this.isEmpty) return other.clone();
    if (other.isEmpty) return this.clone();
    const a = this.getBits();
    const b = other.getBits();
    const out = new Uint32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      out[i] = (a[i] | b[i]) >>> 0;
    }
    return new SelectionMask(this.width, this.height, { bits: out });
  }

  subtract(other: SelectionMask): SelectionMask {
    if (this.isEmpty || other.isEmpty) return this.clone();
    const a = this.getBits();
    const b = other.getBits();
    const out = new Uint32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      out[i] = (a[i] & ~b[i]) >>> 0;
    }
    return new SelectionMask(this.width, this.height, { bits: out });
  }

  intersect(other: SelectionMask): SelectionMask {
    if (this.isEmpty || other.isEmpty) return SelectionMask.empty(this.width, this.height);
    if (this._rect && other._rect) {
      const rx = Math.max(this._rect.x, other._rect.x);
      const ry = Math.max(this._rect.y, other._rect.y);
      const rx2 = Math.min(this._rect.x + this._rect.w, other._rect.x + other._rect.w);
      const ry2 = Math.min(this._rect.y + this._rect.h, other._rect.y + other._rect.h);
      if (rx2 <= rx || ry2 <= ry) return SelectionMask.empty(this.width, this.height);
      return SelectionMask.fromRect(rx, ry, rx2 - rx, ry2 - ry, this.width, this.height);
    }
    const a = this.getBits();
    const b = other.getBits();
    const out = new Uint32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      out[i] = (a[i] & b[i]) >>> 0;
    }
    return new SelectionMask(this.width, this.height, { bits: out });
  }

  invert(): SelectionMask {
    if (this.isEmpty) return SelectionMask.full(this.width, this.height);
    if (
      this._rect &&
      this._rect.x === 0 &&
      this._rect.y === 0 &&
      this._rect.w === this.width &&
      this._rect.h === this.height
    ) {
      return SelectionMask.empty(this.width, this.height);
    }
    const total = this.width * this.height;
    const src = this.getBits();
    const out = new Uint32Array(src.length);
    const fullWords = total >>> 5;
    for (let i = 0; i < fullWords; i++) {
      out[i] = (~src[i]) >>> 0;
    }
    const remBits = total & 31;
    if (remBits > 0) {
      const tailMask = ((1 << remBits) - 1) >>> 0;
      out[fullWords] = ((~src[fullWords]) & tailMask) >>> 0;
    }
    return new SelectionMask(this.width, this.height, {
      bits: out,
      size: total - this.size,
    });
  }

  translate(dx: number, dy: number): SelectionMask {
    if (this.isEmpty) return SelectionMask.empty(this.width, this.height);
    if (dx === 0 && dy === 0) return this.clone();
    if (this._rect) {
      return SelectionMask.fromRect(
        this._rect.x + dx,
        this._rect.y + dy,
        this._rect.w,
        this._rect.h,
        this.width,
        this.height
      );
    }
    const out = new SelectionMask(this.width, this.height);
    const w = this.width;
    const h = this.height;
    this.forEachCoord((x, y) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        out.add(ny * w + nx);
      }
    });
    return out;
  }

  flip(axis: 'h' | 'v', box?: SelectionBounds): SelectionMask {
    if (this.isEmpty) return SelectionMask.empty(this.width, this.height);
    const b = box ?? this.getBoundingBox();
    if (!b) return SelectionMask.empty(this.width, this.height);
    if (this._rect && b.x === this._rect.x && b.y === this._rect.y && b.w === this._rect.w && b.h === this._rect.h) {
      return this.clone();
    }
    const out = new SelectionMask(this.width, this.height);
    const w = this.width;
    this.forEachCoord((x, y) => {
      const destX = axis === 'h' ? b.x + b.w - 1 - (x - b.x) : x;
      const destY = axis === 'v' ? b.y + b.h - 1 - (y - b.y) : y;
      out.add(destY * w + destX);
    });
    return out;
  }

  toArray(): number[] {
    const arr: number[] = [];
    this.forEach((idx) => arr.push(idx));
    return arr;
  }
}
