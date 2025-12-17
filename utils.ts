
import { PixelGrid, Position, ProjectState } from './types';

export const getIndex = (x: number, y: number, width: number): number => {
  return y * width + x;
};

export const getCoords = (index: number, width: number): Position => {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
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
  fillColor: string,
  width: number,
  height: number,
  contiguous: boolean = true
): PixelGrid => {
  const newPixels = [...pixels];
  const startIndex = getIndex(startX, startY, width);
  const targetColor = newPixels[startIndex];

  if (targetColor === fillColor) return newPixels;

  if (!contiguous) {
    for (let i = 0; i < newPixels.length; i++) {
      if (newPixels[i] === targetColor) {
        newPixels[i] = fillColor;
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

    if (newPixels[idx] === targetColor) {
      newPixels[idx] = fillColor;

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
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 !== 0) {
        ctx.fillStyle = '#262626';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
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
        
        px.forEach((c, i) => {
            if (c) {
                ctx.fillStyle = c;
                ctx.fillRect(i % state.width, Math.floor(i / state.width), 1, 1);
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
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  
  const w = right - left;
  const h = bottom - top;
  const cx = left + w / 2;
  const cy = top + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const normalizedX = (x - cx) / (rx + 0.5); 
      const normalizedY = (y - cy) / (ry + 0.5);
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        selection.add(getIndex(x, y, width));
      }
    }
  }
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
  const targetColor = pixels[startIndex];

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
           if (!visited.has(nIdx) && pixels[nIdx] === targetColor) {
             visited.add(nIdx);
             queue.push(nIdx);
           }
        }
      }
    }
  } else {
    for(let i=0; i<pixels.length; i++) {
      if(pixels[i] === targetColor) selection.add(i);
    }
  }
  return selection;
};

// --- Color Parsers ---
export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
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

export const extractColorsFromPNG = (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colorSet = new Set<string>();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) colorSet.add(rgbToHex(data[i], data[i+1], data[i+2]));
      }
      resolve(Array.from(colorSet).slice(0, 256));
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
};

export const fileToProjectState = (file: File): Promise<ProjectState> => {
  return new Promise((resolve, reject) => {
    const isJSON = file.name.toLowerCase().endsWith('.json');
    
    if (isJSON) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          // Basic validation
          if (!json.width || !json.height || !json.layers || !json.frames) {
             throw new Error("Invalid project file structure");
          }
          resolve(json as ProjectState);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject("Failed to read file");
      reader.readAsText(file);
      return;
    }

    // Image Import (PNG, JPG, etc)
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Basic safeguard cap, although browsers can handle decent canvas sizes
      const w = img.width;
      const h = img.height;
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject("Canvas context error"); return; }
      
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      
      const colors = new Set<string>();
      const pixelGrid: (string|null)[] = [];
      
      for(let i=0; i<data.length; i+=4) {
         const r = data[i];
         const g = data[i+1];
         const b = data[i+2];
         const a = data[i+3];
         
         if (a < 10) {
           pixelGrid.push(null);
         } else {
           const hex = rgbToHex(r, g, b);
           pixelGrid.push(hex);
           colors.add(hex);
         }
      }
      
      const palette = Array.from(colors).slice(0, 256); // Limit initial palette to 256 colors
      const layerId = 'layer-import';
      
      // Construct a new project state
      const newState: ProjectState = {
        id: 'temp-id', // Will be overwritten by useProject
        title: file.name,
        width: w,
        height: h,
        layers: [{ id: layerId, name: 'Background', visible: true, locked: false }],
        frames: [{ id: 'frame-1', layerData: { [layerId]: pixelGrid } }],
        activeLayerId: layerId,
        activeFrameIndex: 0,
        palette: palette.length > 0 ? palette : ['#000000', '#ffffff'],
        paletteLibrary: [], // Will be populated by useProject defaults
        activePaletteId: '',
        primaryColor: palette[0] || '#000000',
        secondaryColor: palette[1] || '#ffffff',
        tool: 'pencil',
        brushSize: 1,
        brushShape: 'square',
        fillContiguous: true,
        pixelPerfect: false,
        zoom: w > 64 ? 4 : 16,
        onionSkin: false,
        showGrid: false,
        selection: null,
        selectionMode: 'replace'
      };
      
      URL.revokeObjectURL(url);
      resolve(newState);
    };
    img.onerror = () => reject("Failed to load image");
    img.src = url;
  });
};
