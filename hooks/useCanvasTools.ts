
import { useRef, useEffect } from 'react';
import { ProjectState, PixelGrid, Position, ToolType, Modifiers, PixelValue } from '../types';
import { bresenhamLine, pixelPerfectFilter, getIndex, floodFill, getCoords, bresenhamEllipse, getFilledEllipse, rotateSelectionPixels, rotateSelectionMask, applyConvolution, hexToRgb, findNearestPaletteIndex, rgbToHex, scaleSelectionPixels, scaleSelectionMask, isLayerVisible } from '../utils';

export function useCanvasTools(
  state: ProjectState,
  updateState: (s: ProjectState, historyConfig?: { action: string, tool?: ToolType }) => void
) {
  const strokeStartDataRef = useRef<PixelGrid | null>(null);
  const activeStrokePixelsRef = useRef<PixelGrid | null>(null);
  const strokePathRef = useRef<Position[]>([]);
  const originRef = useRef<Position | null>(null);
  const smudgeReservoirRef = useRef<Map<string, PixelValue>>(new Map());
  const lastSmudgePointRef = useRef<Position | null>(null);
  
  const stateRef = useRef(state);
  stateRef.current = state;
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
    const { activeFrameIndex, activeLayerId, frames, width, height, tool, brushSize, brushShape } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    if (!currentFrame) return;
    const layerData = currentFrame.layerData[activeLayerId];
    const initialPixels = layerData ? [...layerData] : new Array(width * height).fill(null);
    strokeStartDataRef.current = [...initialPixels];
    activeStrokePixelsRef.current = [...initialPixels];
    strokePathRef.current = [];
    originRef.current = null;
    lastSmudgePointRef.current = { x: pos.x, y: pos.y };

    if (tool === 'smudge') {
      smudgeReservoirRef.current.clear();
      const r = brushSize / 2;
      const radiusSq = r * r;
      const startOffset = Math.floor(brushSize / 2);
      for (let ry = -startOffset; ry <= startOffset; ry++) {
        for (let rx = -startOffset; rx <= startOffset; rx++) {
          const distSq = rx * rx + ry * ry;
          if (brushShape === 'circle' && brushSize > 1 && distSq > radiusSq) continue;
          const sampleX = pos.x + rx;
          const sampleY = pos.y + ry;
          if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
            const idx = getIndex(sampleX, sampleY, width);
            const val = initialPixels[idx];
            if (val !== null && val !== undefined) {
              smudgeReservoirRef.current.set(`${rx},${ry}`, val);
            }
          }
        }
      }
    }
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

    const isShapeTool = ['line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool);
    const isPixelPerfectPencil = stateRef.current.pixelPerfect && stateRef.current.brushSize === 1 && !modifiers.shift && tool === 'pencil';
    const isFullStrokeReplay = modifiers.shift || isShapeTool || isPixelPerfectPencil;

    const useStartBuffer = isFullStrokeReplay && ['pencil', 'eraser', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(tool);
    
    // Ensure activeStrokePixelsRef and strokeStartDataRef are initialized
    if (!activeStrokePixelsRef.current) {
      const layerData = currentFrame.layerData[activeLayerId];
      const initialPixels = layerData ? [...layerData] : new Array(width * height).fill(null);
      strokeStartDataRef.current = [...initialPixels];
      activeStrokePixelsRef.current = [...initialPixels];
    }

    const layerPixels = (useStartBuffer && strokeStartDataRef.current)
        ? [...strokeStartDataRef.current] 
        : activeStrokePixelsRef.current;
        
    let changed = false;

    if (['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(tool)) {
      if (!originRef.current) originRef.current = {x, y};

      let pointsToDraw: Position[] = [];
      
      if (modifiers.shift || isShapeTool) {
          let targetX = x;
          let targetY = y;
          if (modifiers.shift && isShapeTool) {
              const dx = x - originRef.current.x;
              const dy = y - originRef.current.y;
              const dist = Math.max(Math.abs(dx), Math.abs(dy));
              targetX = originRef.current.x + dist * Math.sign(dx);
              targetY = originRef.current.y + dist * Math.sign(dy);
          }

          if (tool === 'line' || (!isShapeTool)) {
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
      } else if (isFullStrokeReplay) {
          if (strokePathRef.current.length > 0) {
              const lastPoint = strokePathRef.current[strokePathRef.current.length - 1];
              if (lastPoint.x === x && lastPoint.y === y) return;
              const newPoints = bresenhamLine(lastPoint.x, lastPoint.y, x, y);
              strokePathRef.current.push(...newPoints.slice(1));
          } else {
              strokePathRef.current.push({ x, y });
          }
          pointsToDraw = strokePathRef.current;
      } else {
          // Fast incremental stroke: only process the new bresenham segment between lastPoint and current {x, y}
          if (strokePathRef.current.length === 0) {
              strokePathRef.current.push({x, y});
              pointsToDraw = [{x, y}];
          } else {
              const lastPoint = strokePathRef.current[strokePathRef.current.length - 1];
              if (lastPoint.x === x && lastPoint.y === y) {
                  return; // Same point, avoid duplicate processing
              }
              const newPoints = bresenhamLine(lastPoint.x, lastPoint.y, x, y);
              const incrementalPoints = newPoints.slice(1);
              strokePathRef.current.push(...incrementalPoints);
              pointsToDraw = incrementalPoints;
          }
      }
      
      if (isPixelPerfectPencil) {
          pointsToDraw = pixelPerfectFilter(pointsToDraw);
      }

      if (pointsToDraw.length === 0) return;

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

      // Optimization: Allocate smudge snapshot once before the points loop instead of on every point
      const isSmudge = tool === 'smudge';
      const smudgeMode = stateRef.current.smudgeMode ?? 'blend';
      const smudgeStrength = stateRef.current.smudgeStrength ?? 0.7;

      pointsToDraw.forEach((pt, pointIdxInStroke) => {
        const variants = [{ x: pt.x, y: pt.y }];
        if (symmetry.x) variants.push({ x: width - 1 - pt.x, y: pt.y });
        if (symmetry.y) variants.push({ x: pt.x, y: height - 1 - pt.y });
        if (symmetry.x && symmetry.y) variants.push({ x: width - 1 - pt.x, y: height - 1 - pt.y });

        const prevPt = lastSmudgePointRef.current ?? (pointIdxInStroke > 0 ? pointsToDraw[pointIdxInStroke - 1] : pt);
        const dx_vec = pt.x - prevPt.x;
        const dy_vec = pt.y - prevPt.y;
        lastSmudgePointRef.current = { x: pt.x, y: pt.y };

        variants.forEach(variant => {
          // Optimization: Only iterate the exact brush bounding box
          const r = size / 2;
          const startOffset = Math.floor(size / 2);
          const left = Math.max(0, variant.x - startOffset);
          const right = Math.min(width - 1, size % 2 === 0 ? variant.x + startOffset - 1 : variant.x + startOffset);
          const top = Math.max(0, variant.y - startOffset);
          const bottom = Math.min(height - 1, size % 2 === 0 ? variant.y + startOffset - 1 : variant.y + startOffset);

          for (let drawY = top; drawY <= bottom; drawY++) {
              for (let drawX = left; drawX <= right; drawX++) {
                  const relX = drawX - variant.x;
                  const relY = drawY - variant.y;
                  const distSq = relX * relX + relY * relY;
                  
                  // Check if inside brush
                  let inBrush = true;
                  if (size > 1) {
                      if (stateRef.current.brushShape === 'circle') {
                          if (distSq > radiusSq) inBrush = false;
                      } else {
                          if (Math.abs(relX) > r || Math.abs(relY) > r) inBrush = false;
                      }
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
                  } else if (isSmudge) {
                      if (smudgeMode === 'push') {
                          if (dx_vec !== 0 || dy_vec !== 0) {
                              const sx = Math.round(drawX - dx_vec);
                              const sy = Math.round(drawY - dy_vec);
                              if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                                  const srcIdx = getIndex(sx, sy, width);
                                  const srcVal = layerPixels[srcIdx];
                                  if (srcVal !== null && srcVal !== undefined) {
                                      layerPixels[idx] = srcVal;
                                      if (size === 1 || (Math.abs(relX - dx_vec) > r || Math.abs(relY - dy_vec) > r)) {
                                          layerPixels[srcIdx] = null;
                                      }
                                  }
                              }
                          }
                      } else {
                          // Smart Blend mode
                          const key = `${relX},${relY}`;
                          let carriedVal = smudgeReservoirRef.current.get(key) ?? null;
                          const canvasVal = layerPixels[idx];

                          if (carriedVal === null) {
                              if (canvasVal !== null && canvasVal !== undefined) {
                                  smudgeReservoirRef.current.set(key, canvasVal);
                                  carriedVal = canvasVal;
                              }
                          }

                          if (carriedVal !== null) {
                              if (canvasVal === null || canvasVal === undefined) {
                                  // Dragging paint into empty space: deposit carried paint smoothly
                                  layerPixels[idx] = carriedVal;
                              } else {
                                  // Both carried color and canvas color are present -> Smart Color Blend
                                  const hex1 = typeof carriedVal === 'number' ? palette[carriedVal] : carriedVal;
                                  const hex2 = typeof canvasVal === 'number' ? palette[canvasVal] : canvasVal;
                                  if (hex1 && hex2) {
                                      const [r1, g1, b1] = hexToRgb(hex1);
                                      const [r2, g2, b2] = hexToRgb(hex2);

                                      let falloff = 1.0;
                                      if (size > 1) {
                                          const dist = Math.sqrt(distSq);
                                          const normDist = Math.min(1, dist / r);
                                          falloff = Math.max(0.25, 1.0 - 0.65 * normDist);
                                      }
                                      const blendFactor = Math.min(1, Math.max(0.08, smudgeStrength * falloff));

                                      const mixedR = Math.round(r2 * (1 - blendFactor) + r1 * blendFactor);
                                      const mixedG = Math.round(g2 * (1 - blendFactor) + g1 * blendFactor);
                                      const mixedB = Math.round(b2 * (1 - blendFactor) + b1 * blendFactor);

                                      let mixedVal: PixelValue;
                                      if (colorMode === 'rgba') {
                                          mixedVal = rgbToHex(mixedR, mixedG, mixedB);
                                      } else {
                                          mixedVal = findNearestPaletteIndex(mixedR, mixedG, mixedB, palette);
                                      }
                                      layerPixels[idx] = mixedVal;

                                      // Reservoir color pickup: brush absorbs some canvas color as it travels
                                      const pickupRate = Math.min(0.65, (1 - blendFactor * 0.4) * 0.45 * falloff);
                                      const carriedR = Math.round(r1 * (1 - pickupRate) + r2 * pickupRate);
                                      const carriedG = Math.round(g1 * (1 - pickupRate) + g2 * pickupRate);
                                      const carriedB = Math.round(b1 * (1 - pickupRate) + b2 * pickupRate);

                                      const nextCarriedVal = colorMode === 'rgba'
                                          ? rgbToHex(carriedR, carriedG, carriedB)
                                          : findNearestPaletteIndex(carriedR, carriedG, carriedB, palette);
                                      smudgeReservoirRef.current.set(key, nextCarriedVal);
                                  }
                              }
                          }
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
      const nextState = { ...stateRef.current, frames: newFrames };
      stateRef.current = nextState;
      updateState(nextState, { action: inkType === 'shading' ? 'Shading Fill' : 'Bucket Fill', tool: 'bucket' }); 
      return; 
    }

    if (changed) {
      activeStrokePixelsRef.current = layerPixels;
      const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: [...layerPixels] } });
      const nextState = { ...stateRef.current, frames: newFrames };
      stateRef.current = nextState;
      updateState(nextState);
    }
  };

  const handleDrawEnd = () => {
    if (strokePathRef.current.length > 0 || originRef.current) {
        let actionName = 'Draw';
        const isShading = stateRef.current.inkType === 'shading';
        const prefix = isShading ? 'Shading ' : '';

        if (stateRef.current.tool === 'pencil') actionName = `${prefix}Pencil Stroke`;
        else if (stateRef.current.tool === 'eraser') actionName = 'Eraser';
        else if (stateRef.current.tool === 'smudge') actionName = stateRef.current.smudgeMode === 'push' ? 'Push Pixels' : 'Smudge';
        else if (stateRef.current.tool === 'line') actionName = `${prefix}Line`;
        else if (stateRef.current.tool === 'rect') actionName = `${prefix}Rectangle`;
        else if (stateRef.current.tool === 'filled-rect') actionName = `${prefix}Filled Rectangle`;
        else if (stateRef.current.tool === 'ellipse') actionName = `${prefix}Ellipse`;
        else if (stateRef.current.tool === 'filled-ellipse') actionName = `${prefix}Filled Ellipse`;
        else if (stateRef.current.tool === 'blur') actionName = 'Blur Brush';
        else if (stateRef.current.tool === 'sharpen') actionName = 'Sharpen Brush';
        
        updateState(stateRef.current, { action: actionName, tool: stateRef.current.tool });
    }
    smudgeReservoirRef.current.clear();
    lastSmudgePointRef.current = null;
    strokeStartDataRef.current = null;
    activeStrokePixelsRef.current = null;
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
