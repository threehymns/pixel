
import { useRef, useEffect } from 'react';
import { ProjectState, PixelGrid, Position, ToolType, Modifiers, PixelValue } from '../types';
import { bresenhamLine, pixelPerfectFilter, getIndex, floodFill, getCoords, bresenhamEllipse, getFilledEllipse, rotateSelectionPixels, rotateSelectionMask, applyConvolution, hexToRgb, findNearestPaletteIndex, rgbToHex, scaleSelectionPixels, scaleSelectionMask, isLayerVisible } from '../utils';

export function useCanvasTools(
  state: ProjectState,
  updateState: (s: ProjectState, historyConfig?: { action: string, tool?: ToolType }) => void
) {
  const strokeStartDataRef = useRef<PixelGrid | null>(null);
  const strokePathRef = useRef<Position[]>([]);
  const originRef = useRef<Position | null>(null);
  
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const resolvePixelValue = (hex: string): string | number => {
    if (stateRef.current.colorMode === 'rgba') return hex;
    const idx = stateRef.current.palette.findIndex(c => c.toLowerCase() === hex.toLowerCase());
    return idx === -1 ? 0 : idx;
  };

  const getShadedValue = (currentVal: PixelValue, moveForward: boolean): PixelValue => {
    if (currentVal === null) return null;
    const { shades, palette, colorMode } = stateRef.current;
    if (shades.length < 2) return currentVal;

    const currentHex = typeof currentVal === 'number' ? palette[currentVal] : currentVal;
    if (!currentHex) return currentVal;

    const lowerHex = currentHex.toLowerCase();
    const shadeIndex = shades.findIndex(s => s.toLowerCase() === lowerHex);

    if (shadeIndex === -1) return currentVal;

    let nextIndex = moveForward ? shadeIndex + 1 : shadeIndex - 1;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= shades.length) nextIndex = shades.length - 1;

    const nextHex = shades[nextIndex];
    if (colorMode === 'indexed') {
        const pIdx = palette.findIndex(p => p.toLowerCase() === nextHex.toLowerCase());
        return pIdx === -1 ? currentVal : pIdx;
    }
    return nextHex;
  };

  const handleDrawStart = (pos: Position, modifiers: Modifiers) => {
    const { activeFrameIndex, activeLayerId, frames } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    if (!currentFrame) return;
    const layerData = currentFrame.layerData[activeLayerId];
    strokeStartDataRef.current = layerData ? [...layerData] : new Array(stateRef.current.width * stateRef.current.height).fill(null);
    strokePathRef.current = [];
    originRef.current = null;
  };

  const handleDraw = (x: number, y: number, modifiers: Modifiers) => {
    const { activeFrameIndex, activeLayerId, frames, tool, primaryColor, secondaryColor, width, height, selection, colorMode, palette, inkType, ditheringEnabled, symmetry } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    if (!currentFrame) return;
    
    const isPicking = tool === 'eyedropper' || (tool === 'pencil' && modifiers.alt);
    if (isPicking) {
        let pickedHex: string | null = null;
        for (let i = stateRef.current.layers.length - 1; i >= 0; i--) {
            const l = stateRef.current.layers[i];
            if (!isLayerVisible(l, stateRef.current.layers)) continue;
            const pxVal = currentFrame.layerData[l.id]?.[getIndex(x, y, width)];
            if (pxVal !== null && pxVal !== undefined) {
                pickedHex = typeof pxVal === 'number' ? palette[pxVal] : pxVal;
                if (pickedHex) break;
            }
        }
        if (pickedHex) {
            if (modifiers.alt && tool === 'eyedropper') {
                updateState({...stateRef.current, secondaryColor: pickedHex});
            } else {
                updateState({...stateRef.current, primaryColor: pickedHex});
            }
        }
        return;
    }

    const useStartBuffer = ['pencil', 'eraser', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(tool);
    
    const layerPixels = (useStartBuffer && strokeStartDataRef.current)
        ? [...strokeStartDataRef.current] 
        : [...(currentFrame.layerData[activeLayerId] || new Array(width * height).fill(null))];
        
    let changed = false;

    if (['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(tool)) {
      if (!originRef.current) originRef.current = {x, y};

      let pointsToDraw: Position[] = [];
      
      if (modifiers.shift || ['line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) {
          let targetX = x;
          let targetY = y;
          if (modifiers.shift && ['line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) {
              const dx = x - originRef.current.x;
              const dy = y - originRef.current.y;
              const dist = Math.max(Math.abs(dx), Math.abs(dy));
              targetX = originRef.current.x + dist * Math.sign(dx);
              targetY = originRef.current.y + dist * Math.sign(dy);
          }

          if (tool === 'line' || (tool !== 'rect' && tool !== 'filled-rect' && tool !== 'ellipse' && tool !== 'filled-ellipse')) {
              pointsToDraw = bresenhamLine(originRef.current.x, originRef.current.y, targetX, targetY);
          } else if (tool === 'rect' || tool === 'filled-rect') {
              const left = Math.min(originRef.current.x, targetX);
              const right = Math.max(originRef.current.x, targetX);
              const top = Math.min(originRef.current.y, targetY);
              const bottom = Math.max(originRef.current.y, targetY);
              
              if (tool === 'rect') {
                  for (let cx = left; cx <= right; cx++) {
                      pointsToDraw.push({x: cx, y: top});
                      pointsToDraw.push({x: cx, y: bottom});
                  }
                  for (let cy = top + 1; cy < bottom; cy++) {
                      pointsToDraw.push({x: left, y: cy});
                      pointsToDraw.push({x: right, y: cy});
                  }
              } else {
                  for (let cy = top; cy <= bottom; cy++) {
                      for (let cx = left; cx <= right; cx++) {
                          pointsToDraw.push({x: cx, y: cy});
                      }
                  }
              }
          } else if (tool === 'ellipse') {
              pointsToDraw = bresenhamEllipse(originRef.current.x, originRef.current.y, targetX, targetY);
          } else if (tool === 'filled-ellipse') {
              pointsToDraw = getFilledEllipse(originRef.current.x, originRef.current.y, targetX, targetY);
          }
      } else {
          const lastPoint = strokePathRef.current.length > 0 ? strokePathRef.current[strokePathRef.current.length - 1] : {x, y};
          const newPoints = bresenhamLine(lastPoint.x, lastPoint.y, x, y);
          if (strokePathRef.current.length > 0) strokePathRef.current.push(...newPoints.slice(1));
          else strokePathRef.current.push(...newPoints);
          pointsToDraw = strokePathRef.current;
      }
      
      if (stateRef.current.pixelPerfect && stateRef.current.brushSize === 1 && !modifiers.shift && tool === 'pencil') {
          pointsToDraw = pixelPerfectFilter(pointsToDraw);
      }

      const activeColorHex = modifiers.ctrl && tool === 'pencil' ? secondaryColor : primaryColor;
      const activeVal = resolvePixelValue(activeColorHex);

      const size = stateRef.current.brushSize;
      const startOffset = Math.floor(size / 2);
      const radiusSq = Math.pow(size / 2, 2);

      const BLUR_KERNEL = [
        [1/9, 1/9, 1/9],
        [1/9, 1/9, 1/9],
        [1/9, 1/9, 1/9]
      ];
      
      const SHARPEN_KERNEL = [
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
      ];

      // Bolt Optimization: Lazily allocate error buffers only when dithered blur/sharpen is active
      // to avoid allocating megabytes of Float32Arrays on every mouse move event during drawing.
      let errorBufferR: Float32Array | null = null;
      let errorBufferG: Float32Array | null = null;
      let errorBufferB: Float32Array | null = null;

      pointsToDraw.forEach((pt, pointIdxInStroke) => {
        const variants = [{ x: pt.x, y: pt.y }];
        if (symmetry.x) variants.push({ x: width - 1 - pt.x, y: pt.y });
        if (symmetry.y) variants.push({ x: pt.x, y: height - 1 - pt.y });
        if (symmetry.x && symmetry.y) variants.push({ x: width - 1 - pt.x, y: height - 1 - pt.y });

        const lastPt = pointIdxInStroke > 0 ? pointsToDraw[pointIdxInStroke - 1] : originRef.current;
        const dx_vec = pt.x - (lastPt?.x ?? pt.x);
        const dy_vec = pt.y - (lastPt?.y ?? pt.y);

        // Snapshot before this segment point to allow "smearing" across the canvas
        const smudgeBase = tool === 'smudge' ? [...layerPixels] : null;

        variants.forEach(variant => {
          // Optimization: Only iterate the brush area
          const r = size / 2;
          const left = Math.floor(variant.x - r);
          const right = Math.ceil(variant.x + r);
          const top = Math.floor(variant.y - r);
          const bottom = Math.ceil(variant.y + r);

          for (let drawY = top; drawY <= bottom; drawY++) {
              for (let drawX = left; drawX <= right; drawX++) {
                  if (drawX < 0 || drawX >= width || drawY < 0 || drawY >= height) continue;
                  
                  const relX = drawX - variant.x;
                  const relY = drawY - variant.y;
                  const distSq = relX * relX + relY * relY;
                  
                  // Check if inside brush
                  let inBrush = true;
                  if (stateRef.current.brushShape === 'circle') {
                      if (distSq > radiusSq) inBrush = false;
                  } else {
                      if (Math.abs(relX) > r || Math.abs(relY) > r) inBrush = false;
                  }

                  if (!inBrush) continue;

                  const idx = getIndex(drawX, drawY, width);
                  if (selection && !selection.has(idx)) continue;
                  
                  if (['pencil', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) { 
                      if (inkType === 'shading') {
                          layerPixels[idx] = getShadedValue(layerPixels[idx], !modifiers.ctrl);
                      } else {
                          layerPixels[idx] = activeVal; 
                      }
                  } else if (tool === 'smudge' && smudgeBase) {
                      // IMPROVED WARP/PUSH ALGORITHM
                      // Calculate falloff: Pixels in center move more than pixels at edge
                      const dist = Math.sqrt(distSq);
                      const normDist = Math.max(0, Math.min(1, dist / r));
                      
                      // Quadratic falloff for smooth warping effect
                      const falloff = Math.pow(1 - normDist, 2);
                      
                      // Displacement vector
                      const sx = Math.round(drawX - dx_vec * falloff);
                      const sy = Math.round(drawY - dy_vec * falloff);
                      
                      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                          const srcIdx = getIndex(sx, sy, width);
                          layerPixels[idx] = smudgeBase[srcIdx];
                      }
                  } else if (tool === 'eraser') {
                      layerPixels[idx] = null;
                  } else if ((tool === 'blur' || tool === 'sharpen') && colorMode === 'indexed' && ditheringEnabled) {
                      if (!errorBufferR || !errorBufferG || !errorBufferB) {
                          errorBufferR = new Float32Array(width * height);
                          errorBufferG = new Float32Array(width * height);
                          errorBufferB = new Float32Array(width * height);
                      }
                      const kernel = tool === 'blur' ? BLUR_KERNEL : SHARPEN_KERNEL;
                      
                      let r_conv = 0, g_conv = 0, b_conv = 0, weight = 0;
                      const kSize = kernel.length;
                      const kHalf = Math.floor(kSize / 2);
                      for (let ky = 0; ky < kSize; ky++) {
                          for (let kx = 0; kx < kSize; kx++) {
                              const nx = drawX + kx - kHalf;
                              const ny = drawY + ky - kHalf;
                              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                  const val = layerPixels[getIndex(nx, ny, width)];
                                  if (val !== null) {
                                      const hex = typeof val === 'number' ? palette[val] : val;
                                      const [pr, pg, pb] = hexToRgb(hex);
                                      const kw = kernel[ky][kx];
                                      r_conv += pr * kw;
                                      g_conv += pg * kw;
                                      b_conv += pb * kw;
                                      weight += kw;
                                  }
                              }
                          }
                      }
                      if (weight > 0) {
                          const targetR = r_conv / weight + errorBufferR[idx];
                          const targetG = g_conv / weight + errorBufferG[idx];
                          const targetB = b_conv / weight + errorBufferB[idx];
                          
                          const paletteIndex = findNearestPaletteIndex(targetR, targetG, targetB, palette);
                          layerPixels[idx] = paletteIndex;
                          
                          const [pr, pg, pb] = hexToRgb(palette[paletteIndex]);
                          const errR = targetR - pr;
                          const errG = targetG - pg;
                          const errB = targetB - pb;
                          
                          const distribute = (ndx: number, ndy: number, factor: number) => {
                              const nnx = drawX + ndx;
                              const nny = drawY + ndy;
                              if (nnx >= 0 && nnx < width && nny >= 0 && nny < height) {
                                  const ni = getIndex(nnx, nny, width);
                                  errorBufferR[ni] += errR * factor;
                                  errorBufferG[ni] += errG * factor;
                                  errorBufferB[ni] += errB * factor;
                              }
                          };
                          distribute(1, 0, 7/16); distribute(-1, 1, 3/16); distribute(0, 1, 5/16); distribute(1, 1, 1/16);
                      }
                  } else if (tool === 'blur') {
                      layerPixels[idx] = applyConvolution(drawX, drawY, layerPixels, width, height, BLUR_KERNEL, palette, colorMode);
                  } else if (tool === 'sharpen') {
                      layerPixels[idx] = applyConvolution(drawX, drawY, layerPixels, width, height, SHARPEN_KERNEL, palette, colorMode);
                  }
              }
          }
        });
      });
      changed = true; 
    } else if (tool === 'bucket') {
      const activeColorHex = primaryColor;
      const activeVal = resolvePixelValue(activeColorHex);
      const isContiguous = modifiers.shift ? false : stateRef.current.fillContiguous;
      
      const variants = [{ x, y }];
      if (symmetry.x) variants.push({ x: width - 1 - x, y: y });
      if (symmetry.y) variants.push({ x: x, y: height - 1 - y });
      if (symmetry.x && symmetry.y) variants.push({ x: width - 1 - x, y: height - 1 - y });

      let currentGrid = [...layerPixels];
      variants.forEach(v => {
          let filled;
          if (inkType === 'shading') {
              const startVal = currentGrid[getIndex(v.x, v.y, width)];
              if (startVal === null) return;
              const nextVal = getShadedValue(startVal, !modifiers.ctrl);
              if (nextVal === startVal) return;
              filled = floodFill(currentGrid, v.x, v.y, nextVal, width, height, isContiguous);
          } else {
              filled = floodFill(currentGrid, v.x, v.y, activeVal, width, height, isContiguous);
          }
          
          if (selection) {
              for(let i=0; i<filled.length; i++) { if (!selection.has(i)) filled[i] = currentGrid[i]; }
          }
          currentGrid = filled;
      });

      const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: currentGrid } });
      updateState({ ...stateRef.current, frames: newFrames }, { action: inkType === 'shading' ? 'Shading Fill' : 'Bucket Fill', tool: 'bucket' }); 
      return; 
    }

    if (changed) {
      const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: layerPixels } });
      updateState({ ...stateRef.current, frames: newFrames });
    }
  };

  const handleDrawEnd = () => {
    if (strokePathRef.current.length > 0 || originRef.current) {
        let actionName = 'Draw';
        const isShading = stateRef.current.inkType === 'shading';
        const prefix = isShading ? 'Shading ' : '';

        if (stateRef.current.tool === 'pencil') actionName = `${prefix}Pencil Stroke`;
        else if (stateRef.current.tool === 'eraser') actionName = 'Eraser';
        else if (stateRef.current.tool === 'smudge') actionName = 'Warp/Push';
        else if (stateRef.current.tool === 'line') actionName = `${prefix}Line`;
        else if (stateRef.current.tool === 'rect') actionName = `${prefix}Rectangle`;
        else if (stateRef.current.tool === 'filled-rect') actionName = `${prefix}Filled Rectangle`;
        else if (stateRef.current.tool === 'ellipse') actionName = `${prefix}Ellipse`;
        else if (stateRef.current.tool === 'filled-ellipse') actionName = `${prefix}Filled Ellipse`;
        else if (stateRef.current.tool === 'blur') actionName = 'Blur Brush';
        else if (stateRef.current.tool === 'sharpen') actionName = 'Sharpen Brush';
        
        updateState(stateRef.current, { action: actionName, tool: stateRef.current.tool });
    }
    strokeStartDataRef.current = null;
    strokePathRef.current = [];
    originRef.current = null;
  };

  const handleMovePixels = (selection: Set<number>, offset: Position) => {
    const { activeFrameIndex, selectedLayerIds, frames, width, height } = stateRef.current;
    
    const newFrames = frames.map((f, i) => {
      if (i !== activeFrameIndex) return f;
      const newLayerData = { ...f.layerData };
      selectedLayerIds.forEach(layerId => {
        const layerPixels = [...(f.layerData[layerId] || new Array(width * height).fill(null))];
        const updatedPixels = [...layerPixels];
        selection.forEach(idx => updatedPixels[idx] = null);
        selection.forEach(idx => {
          const { x, y } = getCoords(idx, width);
          const nx = x + offset.x; const ny = y + offset.y;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            updatedPixels[getIndex(nx, ny, width)] = layerPixels[idx];
          }
        });
        newLayerData[layerId] = updatedPixels;
      });
      return { ...f, layerData: newLayerData };
    });

    const newSelection = new Set<number>();
    selection.forEach(idx => {
      const { x, y } = getCoords(idx, width);
      const nx = x + offset.x; const ny = y + offset.y;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) newSelection.add(getIndex(nx, ny, width));
    });

    updateState(
      { ...stateRef.current, frames: newFrames, selection: newSelection }, 
      { action: `Move Pixels on ${selectedLayerIds.length} Layers`, tool: 'move' }
    );
  };

  const handleRotatePixels = (selection: Set<number>, angle: number, pivot: Position) => {
      const { activeFrameIndex, selectedLayerIds, frames, width, height, rotationAlgorithm } = stateRef.current;
      const newSelection = rotateSelectionMask(selection, angle, pivot, width, height);
      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(layerId => {
              const layerPixels = [...(f.layerData[layerId] || new Array(width * height).fill(null))];
              const rotatedPixels = rotateSelectionPixels(selection, layerPixels, angle, pivot, width, height, rotationAlgorithm);
              const updatedPixels = [...layerPixels];
              selection.forEach(idx => updatedPixels[idx] = null);
              for (let j = 0; j < rotatedPixels.length; j++) {
                  if (rotatedPixels[j] !== null) updatedPixels[j] = rotatedPixels[j]!;
              }
              newLayerData[layerId] = updatedPixels;
          });
          return { ...f, layerData: newLayerData };
      });
      updateState(
          { ...stateRef.current, frames: newFrames, selection: newSelection.size > 0 ? newSelection : null },
          { action: `Rotate Selection on ${selectedLayerIds.length} Layers`, tool: 'move' }
      );
  };

  const handleScalePixels = (selection: Set<number>, srcBox: any, destBox: any) => {
    const { activeFrameIndex, selectedLayerIds, frames, width, height } = stateRef.current;
    const newSelection = scaleSelectionMask(selection, srcBox, destBox, width, height);
    const newFrames = frames.map((f, i) => {
      if (i !== activeFrameIndex) return f;
      const newLayerData = { ...f.layerData };
      selectedLayerIds.forEach(layerId => {
        const layerPixels = [...(f.layerData[layerId] || new Array(width * height).fill(null))];
        const scaledPixels = scaleSelectionPixels(selection, layerPixels, srcBox, destBox, width, height);
        const updatedPixels = [...layerPixels];
        selection.forEach(idx => updatedPixels[idx] = null);
        for (let j = 0; j < scaledPixels.length; j++) {
          if (scaledPixels[j] !== null) updatedPixels[j] = scaledPixels[j]!;
        }
        newLayerData[layerId] = updatedPixels;
      });
      return { ...f, layerData: newLayerData };
    });
    updateState(
      { ...stateRef.current, frames: newFrames, selection: newSelection.size > 0 ? newSelection : null },
      { action: `Scale Selection on ${selectedLayerIds.length} Layers`, tool: 'move' }
    );
  };

  return { handleDrawStart, handleDraw, handleDrawEnd, handleMovePixels, handleRotatePixels, handleScalePixels };
}
