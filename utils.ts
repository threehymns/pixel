
import { PixelGrid, Position, ProjectState, Layer, Frame, SavedPalette, PixelValue } from './types';

export const getIndex = (x: number, y: number, width: number): number => {
  return y * width + x;
};

export const getCoords = (index: number, width: number): Position => {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
};

export const getSelectionBoundingBox = (selection: Set<number>, width: number) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selection.forEach(idx => {
    const { x, y } = getCoords(idx, width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
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

// Flood Fill Algorithm (BFS)
export const floodFill = (
  pixels: PixelGrid,
  startX: number,
  startY: number,
  fillValue: string | number,
  width: number,
  height: number,
  contiguous: boolean = true
): PixelGrid => {
  const newPixels = [...pixels];
  const startIndex = getIndex(startX, startY, width);
  const targetValue = newPixels[startIndex];

  if (targetValue === fillValue) return newPixels;

  if (!contiguous) {
    for (let i = 0; i < newPixels.length; i++) {
      if (newPixels[i] === targetValue) {
        newPixels[i] = fillValue;
      }
    }
    return newPixels;
  }

  const queue: number[] = [startIndex];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    visited.add(idx);

    const { x, y } = getCoords(idx, width);
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    if (newPixels[idx] === targetValue) {
      newPixels[idx] = fillValue;

      if (x + 1 < width) queue.push(getIndex(x + 1, y, width));
      if (x - 1 >= 0) queue.push(getIndex(x - 1, y, width));
      if (y + 1 < height) queue.push(getIndex(x, y + 1, width));
      if (y - 1 >= 0) queue.push(getIndex(x, y - 1, width));
    }
  }

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

const HEX_CACHE: Record<string, [number, number, number]> = {};
export const hexToRgb = (hex: string): [number, number, number] => {
  if (HEX_CACHE[hex]) return HEX_CACHE[hex];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rgb: [number, number, number] = [r, g, b];
  HEX_CACHE[hex] = rgb;
  return rgb;
};

export const renderFrameToCanvas = (state: ProjectState, frameIndex: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return canvas;

    const frame = state.frames[frameIndex];
    if (!frame) return canvas;

    state.layers.forEach(l => {
        if (!l.visible) return;
        const px = frame.layerData[l.id];
        if (!px) return;
        
        px.forEach((val, i) => {
            if (val !== null) {
                const color = typeof val === 'number' ? state.palette[val] : val;
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(i % state.width, Math.floor(i / state.width), 1, 1);
                }
            }
        });
    });

    return canvas;
};

// --- Selection Algorithms ---

export const getRectSelection = (x0: number, y0: number, x1: number, y1: number, width: number): Set<number> => {
  const selection = new Set<number>();
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      selection.add(getIndex(x, y, width));
    }
  }
  return selection;
};

export const getEllipseSelection = (x0: number, y0: number, x1: number, y1: number, width: number): Set<number> => {
  const selection = new Set<number>();
  const filledPoints = getFilledEllipse(x0, y0, x1, y1);
  filledPoints.forEach(p => {
    selection.add(getIndex(p.x, p.y, width));
  });
  return selection;
};

export const getPolygonSelection = (points: Position[], width: number, height: number): Set<number> => {
  const selection = new Set<number>();
  if (points.length < 3) return selection;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(width - 1, maxX);
  maxY = Math.min(height - 1, maxY);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) selection.add(getIndex(x, y, width));
    }
  }
  return selection;
};

export const getWandSelection = (
  pixels: PixelGrid,
  startX: number,
  startY: number,
  width: number,
  height: number,
  contiguous: boolean
): Set<number> => {
  const selection = new Set<number>();
  const startIndex = getIndex(startX, startY, width);
  const targetValue = pixels[startIndex];

  if (contiguous) {
    const queue: number[] = [startIndex];
    const visited = new Set<number>();
    visited.add(startIndex);

    while (queue.length > 0) {
      const idx = queue.shift()!;
      selection.add(idx);

      const { x, y } = getCoords(idx, width);
      const neighbors = [
        { nx: x + 1, ny: y },
        { nx: x - 1, ny: y },
        { nx: x, ny: y + 1 },
        { nx: x, ny: y - 1 }
      ];

      for (const {nx, ny} of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
           const nIdx = getIndex(nx, ny, width);
           if (!visited.has(nIdx) && pixels[nIdx] === targetValue) {
             visited.add(nIdx);
             queue.push(nIdx);
           }
        }
      }
    }
  } else {
    for(let i=0; i<pixels.length; i++) {
      if(pixels[i] === targetValue) selection.add(i);
    }
  }
  return selection;
};

// --- Color Parsers ---
export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

/**
 * Weighted RGB distance for better perceptual color matching.
 */
export const findNearestPaletteIndex = (r: number, g: number, b: number, palette: string[]): number => {
    let minDistance = Infinity;
    let nearestIndex = 0;
    
    const wr = 0.3;
    const wg = 0.59;
    const wb = 0.11;

    for (let i = 0; i < palette.length; i++) {
        const [pr, pg, pb] = hexToRgb(palette[i]);
        const dist = wr * Math.pow(r - pr, 2) + wg * Math.pow(g - pg, 2) + wb * Math.pow(b - pb, 2);
        if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = i;
        }
        if (dist === 0) break;
    }
    return nearestIndex;
};

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

export const fileToProjectState = async (file: File): Promise<ProjectState> => {
  if (file.name.toLowerCase().endsWith('.json')) {
    const text = await file.text();
    const state = JSON.parse(text);
    if (state.selection && Array.isArray(state.selection)) {
      state.selection = new Set(state.selection);
    }
    return state as ProjectState;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height).data;
        const pixels: PixelGrid = new Array(width * height).fill(null);

        for (let i = 0; i < width * height; i++) {
          const r = imageData[i * 4];
          const g = imageData[i * 4 + 1];
          const b = imageData[i * 4 + 2];
          const a = imageData[i * 4 + 3];
          if (a > 128) { 
            pixels[i] = rgbToHex(r, g, b);
          }
        }

        const layerId = `layer-${Date.now()}`;
        const frameId = `frame-${Date.now()}`;

        const state: ProjectState = {
          id: `project-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ""), 
          width,
          height,
          colorMode: 'rgba', 
          layers: [{ id: layerId, name: 'Layer 1', visible: true, locked: false }],
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
          zoom: Math.min(32, Math.floor(512 / Math.max(width, height))),
          onionSkin: false,
          showGrid: false,
          selection: null,
          selectionMode: 'replace',
        };
        resolve(state);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export const extractColorsFromPNG = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        const colors = new Set<string>();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { 
            colors.add(rgbToHex(data[i], data[i + 1], data[i + 2]));
          }
        }
        resolve(Array.from(colors));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

// --- RotSprite & Scale Algorithm Helpers ---

const scale2xPass = (pixels: PixelGrid, width: number, height: number): { pixels: PixelGrid, width: number, height: number } => {
  const newWidth = width * 2;
  const newHeight = height * 2;
  const newPixels: PixelGrid = new Array(newWidth * newHeight).fill(null);

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

export const rotateSelectionPixels = (
    selection: Set<number>, 
    layerPixels: PixelGrid, 
    angleRad: number, 
    pivot: Position,
    width: number,
    height: number,
    algorithm: 'nearest' | 'rotsprite'
): PixelGrid => {
    const newPixels = new Array(width * height).fill(null);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    if (algorithm === 'rotsprite') {
        const box = getSelectionBoundingBox(selection, width);
        const subGrid: PixelGrid = new Array(box.w * box.h).fill(null);
        selection.forEach(idx => {
            const { x, y } = getCoords(idx, width);
            subGrid[(y - box.y) * box.w + (x - box.x)] = layerPixels[idx];
        });

        let scaled = { pixels: subGrid, width: box.w, height: box.h };
        for (let i = 0; i < 3; i++) {
            scaled = scale2xPass(scaled.pixels, scaled.width, scaled.height);
        }

        const scale = 8;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tx = x + 0.5 - pivot.x;
                const ty = y + 0.5 - pivot.y;
                
                const srcX_orig = tx * cos + ty * sin + pivot.x;
                const srcY_orig = -tx * sin + ty * cos + pivot.y;
                
                const localX = (srcX_orig - box.x) * scale;
                const localY = (srcY_orig - box.y) * scale;
                
                const floorX = Math.floor(localX);
                const floorY = Math.floor(localY);
                
                if (floorX >= 0 && floorX < scaled.width && floorY >= 0 && floorY < scaled.height) {
                    newPixels[getIndex(x, y, width)] = scaled.pixels[floorY * scaled.width + floorX];
                }
            }
        }
    } else {
        const selectionColors = new Map<number, string | number | null>();
        selection.forEach(idx => selectionColors.set(idx, layerPixels[idx]));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tx = x + 0.5 - pivot.x;
                const ty = y + 0.5 - pivot.y;
                const srcX = Math.floor(tx * cos + ty * sin + pivot.x);
                const srcY = Math.floor(-tx * sin + ty * cos + pivot.y);
                
                if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                    const srcIdx = getIndex(srcX, srcY, width);
                    if (selection.has(srcIdx)) {
                        newPixels[getIndex(x, y, width)] = selectionColors.get(srcIdx) ?? null;
                    }
                }
            }
        }
    }
    return newPixels;
};

export const rotateSelectionMask = (
    selection: Set<number>,
    angleRad: number,
    pivot: Position,
    width: number,
    height: number
): Set<number> => {
    const newSelection = new Set<number>();
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tx = x + 0.5 - pivot.x;
            const ty = y + 0.5 - pivot.y;
            const srcX = Math.floor(tx * cos + ty * sin + pivot.x);
            const srcY = Math.floor(-tx * sin + ty * cos + pivot.y);

            if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                const srcIdx = getIndex(srcX, srcY, width);
                if (selection.has(srcIdx)) {
                    newSelection.add(getIndex(x, y, width));
                }
            }
        }
    }
    return newSelection;
};

/**
 * Scales selection pixels using Nearest Neighbor reverse-mapping.
 */
export const scaleSelectionPixels = (
    selection: Set<number>,
    layerPixels: PixelGrid,
    srcBox: { x: number, y: number, w: number, h: number },
    destBox: { x: number, y: number, w: number, h: number },
    width: number,
    height: number
): PixelGrid => {
    const newPixels = new Array(width * height).fill(null);
    if (srcBox.w <= 0 || srcBox.h <= 0 || destBox.w <= 0 || destBox.h <= 0) return newPixels;

    for (let dy = 0; dy < destBox.h; dy++) {
        for (let dx = 0; dx < destBox.w; dx++) {
            const targetX = Math.floor(destBox.x + dx);
            const targetY = Math.floor(destBox.y + dy);

            if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;

            // Map back to relative source box
            const srcRelX = (dx / destBox.w) * srcBox.w;
            const srcRelY = (dy / destBox.h) * srcBox.h;

            const sx = Math.floor(srcBox.x + srcRelX);
            const sy = Math.floor(srcBox.y + srcRelY);

            if (sx >= srcBox.x && sx < srcBox.x + srcBox.w && sy >= srcBox.y && sy < srcBox.y + srcBox.h) {
                const srcIdx = getIndex(sx, sy, width);
                if (selection.has(srcIdx)) {
                    newPixels[getIndex(targetX, targetY, width)] = layerPixels[srcIdx];
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
    selection: Set<number>,
    srcBox: { x: number, y: number, w: number, h: number },
    destBox: { x: number, y: number, w: number, h: number },
    width: number,
    height: number
): Set<number> => {
    const newSelection = new Set<number>();
    if (destBox.w <= 0 || destBox.h <= 0) return newSelection;

    for (let dy = 0; dy < destBox.h; dy++) {
        for (let dx = 0; dx < destBox.w; dx++) {
            const targetX = Math.floor(destBox.x + dx);
            const targetY = Math.floor(destBox.y + dy);
            if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;

            const srcRelX = (dx / destBox.w) * srcBox.w;
            const srcRelY = (dy / destBox.h) * srcBox.h;
            const sx = Math.floor(srcBox.x + srcRelX);
            const sy = Math.floor(srcBox.y + srcRelY);

            if (selection.has(getIndex(sx, sy, width))) {
                newSelection.add(getIndex(targetX, targetY, width));
            }
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
                if (val !== null) {
                    const hex = typeof val === 'number' ? palette[val] : val;
                    const [pr, pg, pb] = hexToRgb(hex);
                    const kw = kernel[ky][kx];
                    r += pr * kw;
                    g += pg * kw;
                    b += pb * kw;
                    weight += kw;
                }
            }
        }
    }

    if (weight === 0) return null;
    
    const finalR = weight > 0 ? r / weight : r;
    const finalG = weight > 0 ? g / weight : g;
    const finalB = weight > 0 ? b / weight : b;

    if (colorMode === 'indexed') {
        return findNearestPaletteIndex(finalR, finalG, finalB, palette);
    } else {
        return rgbToHex(finalR, finalG, finalB);
    }
};
