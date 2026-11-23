
import { useRef, useLayoutEffect, useCallback } from 'react';
import { ProjectState, PixelGrid, Position, ToolType, Modifiers, PixelValue, PixelHistoryPatch, PixelLayerPatch, SelectionMask } from '../types';
import {
  EMPTY_PIXEL,
  createPixelGrid,
  clonePixelGrid,
  packRGBA,
  encodeIndexedPixel,
  pixelToHex,
  pixelToRgb,
  resolveColorToPixel,
  buildLayerPatch,
  getSelectionBoundingBox,
  bresenhamLine,
  pixelPerfectFilter,
  getIndex,
  floodFillInPlace,
  bresenhamEllipse,
  forEachFilledEllipseSpan,
  rotateSelectionPixels,
  rotateSelectionMask,
  applyConvolution,
  hexToRgb,
  findNearestPaletteIndex,
  scaleSelectionPixels,
  scaleSelectionMask,
  isLayerVisible,
} from '../utils';
import { resolveHydratedPixelGrid } from '../utils/layerBitmapCache';
import {
  publishLiveStroke,
  clearLiveStroke,
  publishLiveShapePreview,
  clearLiveShapePreview,
} from './useLiveStrokeStore';

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

const DITHER_OFFSETS: readonly [number, number, number][] = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

function distributeDitherError(
  localX: number,
  localY: number,
  errW: number,
  errH: number,
  errR: number,
  errG: number,
  errB: number,
  errorBufferR: Float32Array,
  errorBufferG: Float32Array,
  errorBufferB: Float32Array
) {
  for (let i = 0; i < DITHER_OFFSETS.length; i++) {
    const [dx, dy, factor] = DITHER_OFFSETS[i];
    const nx = localX + dx;
    const ny = localY + dy;
    if (nx >= 0 && nx < errW && ny >= 0 && ny < errH) {
      const ni = ny * errW + nx;
      errorBufferR[ni] += errR * factor;
      errorBufferG[ni] += errG * factor;
      errorBufferB[ni] += errB * factor;
    }
  }
}

export function useCanvasTools(
  state: ProjectState,
  updateState: (s: ProjectState, historyConfig?: { action: string; tool?: ToolType; patch?: PixelHistoryPatch }) => void
) {
  const strokeStartDataRef = useRef<PixelGrid | null>(null);
  const activeStrokePixelsRef = useRef<PixelGrid | null>(null);
  const strokeMetaRef = useRef<{ projectId: string; frameIndex: number; layerId: string } | null>(null);
  const strokeDirtyRef = useRef<boolean>(false);
  const strokeBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const lastReplayIndicesRef = useRef<number[]>([]);
  const wasUsingStartBufferRef = useRef<boolean>(false);
  const strokePathRef = useRef<Position[]>([]);
  const originRef = useRef<Position | null>(null);
  const pendingFilledShapeRef = useRef<{
    tool: 'filled-rect' | 'filled-ellipse';
    originX: number;
    originY: number;
    targetX: number;
    targetY: number;
    ctrlKey: boolean;
    colorHex: string;
    isShading: boolean;
  } | null>(null);
  const smudgeReservoirRef = useRef<Map<string, PixelValue>>(new Map());
  const lastSmudgePointRef = useRef<Position | null>(null);
  
  const stateRef = useRef(state);
  const updateStateRef = useRef(updateState);
  useLayoutEffect(() => {
    stateRef.current = state;
    updateStateRef.current = updateState;
  });

  const resolvePixelValue = (hex: string): PixelValue => {
    const { colorMode, palette } = stateRef.current;
    return resolveColorToPixel(hex, colorMode, palette);
  };

  const getShadedValue = (currentVal: PixelValue, moveForward: boolean): PixelValue => {
    if (currentVal === EMPTY_PIXEL) return EMPTY_PIXEL;
    const { shades, palette, colorMode } = stateRef.current;
    if (shades.length < 2) return currentVal;

    const currentHex = pixelToHex(currentVal, palette);
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
        return pIdx === -1 ? currentVal : encodeIndexedPixel(pIdx);
    }
    return resolveColorToPixel(nextHex, 'rgba', palette);
  };

  const handleDrawStart = useCallback((pos: Position, _modifiers: Modifiers) => {
    const { id, activeFrameIndex, activeLayerId, frames, width, height, tool, brushSize, brushShape } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    if (!currentFrame) return;
    // Store immutable reference to the starting layer grid (null if layer is still sparse).
    // Hydrate synchronously if this large photo layer is still finishing background worker decode.
    const basePixels = resolveHydratedPixelGrid(currentFrame.layerData[activeLayerId]);
    strokeStartDataRef.current = basePixels;
    activeStrokePixelsRef.current = null;
    strokeMetaRef.current = { projectId: id, frameIndex: activeFrameIndex, layerId: activeLayerId };
    strokeDirtyRef.current = false;
    strokeBoundsRef.current = null;
    lastReplayIndicesRef.current.length = 0;
    wasUsingStartBufferRef.current = false;
    strokePathRef.current = [];
    originRef.current = null;
    pendingFilledShapeRef.current = null;
    clearLiveShapePreview();
    lastSmudgePointRef.current = { x: pos.x, y: pos.y };

    if (tool === 'smudge') {
      smudgeReservoirRef.current.clear();
      if (basePixels) {
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
              const val = basePixels[idx];
              if (val !== EMPTY_PIXEL) {
                smudgeReservoirRef.current.set(`${rx},${ry}`, val);
              }
            }
          }
        }
      }
    }
  }, []);

  const handleDraw = useCallback((x: number, y: number, modifiers: Modifiers) => {
    const { id, activeFrameIndex, activeLayerId, frames, tool, primaryColor, secondaryColor, width, height, selection, colorMode, palette, inkType, ditheringEnabled, symmetry } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    if (!currentFrame) return;
    
    const isPicking = tool === 'eyedropper' || (tool === 'pencil' && modifiers.alt);
    if (isPicking) {
        let pickedHex: string | null = null;
        const sampleIdx = getIndex(x, y, width);
        for (let i = stateRef.current.layers.length - 1; i >= 0; i--) {
            const l = stateRef.current.layers[i];
            if (!isLayerVisible(l, stateRef.current.layers)) continue;
            const hydratedLayer = resolveHydratedPixelGrid(currentFrame.layerData[l.id]);
            const pxVal = hydratedLayer?.[sampleIdx];
            if (pxVal !== undefined && pxVal !== EMPTY_PIXEL) {
                pickedHex = pixelToHex(pxVal, palette);
                if (pickedHex) break;
            }
        }
        if (pickedHex) {
            if (modifiers.alt && tool === 'eyedropper') {
                updateStateRef.current({...stateRef.current, secondaryColor: pickedHex});
            } else {
                updateStateRef.current({...stateRef.current, primaryColor: pickedHex});
            }
        }
        return;
    }

    if (tool === 'bucket') {
      const basePixels = resolveHydratedPixelGrid(currentFrame.layerData[activeLayerId]);
      const activeColorHex = primaryColor;
      const activeVal = resolvePixelValue(activeColorHex);
      const isContiguous = modifiers.shift ? false : stateRef.current.fillContiguous;
      
      const variants = [{ x, y }];
      if (symmetry.x) variants.push({ x: width - 1 - x, y: y });
      if (symmetry.y) variants.push({ x: x, y: height - 1 - y });
      if (symmetry.x && symmetry.y) variants.push({ x: width - 1 - x, y: height - 1 - y });

      const workingGrid: PixelGrid = basePixels
        ? clonePixelGrid(basePixels)
        : createPixelGrid(width * height);
      let anyChanged = false;

      for (let vi = 0; vi < variants.length; vi++) {
        const v = variants[vi];
        if (inkType === 'shading') {
          const startVal = workingGrid[getIndex(v.x, v.y, width)];
          if (startVal === EMPTY_PIXEL) continue;
          const nextVal = getShadedValue(startVal, !modifiers.ctrl);
          if (nextVal === startVal) continue;
          if (floodFillInPlace(workingGrid, v.x, v.y, nextVal, width, height, isContiguous, selection)) {
            anyChanged = true;
          }
        } else {
          if (floodFillInPlace(workingGrid, v.x, v.y, activeVal, width, height, isContiguous, selection)) {
            anyChanged = true;
          }
        }
      }

      if (!anyChanged) return;
      const layerPatch = buildLayerPatch(activeLayerId, basePixels, workingGrid, width, height);
      if (!layerPatch) return;

      const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: workingGrid } });
      const nextState = { ...stateRef.current, frames: newFrames };
      stateRef.current = nextState;
      updateStateRef.current(nextState, {
        action: inkType === 'shading' ? 'Shading Fill' : 'Bucket Fill',
        tool: 'bucket',
        patch: { frameIndex: activeFrameIndex, layers: [layerPatch] },
      }); 
      return; 
    }

    // Fast path for Filled Rect / Filled Ellipse:
    // Publish a lightweight GPU vector preview during drag (zero 33MB buffer clone and zero per-pixel object allocations)
    // and rasterize with horizontal span fills on pointerup.
    if (tool === 'filled-rect' || tool === 'filled-ellipse') {
      if (!strokeMetaRef.current) {
        strokeStartDataRef.current = resolveHydratedPixelGrid(currentFrame.layerData[activeLayerId]);
        strokeMetaRef.current = { projectId: id, frameIndex: activeFrameIndex, layerId: activeLayerId };
      }
      if (!originRef.current) originRef.current = { x, y };
      let targetX = x;
      let targetY = y;
      if (modifiers.shift) {
        const dx = x - originRef.current.x;
        const dy = y - originRef.current.y;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        targetX = originRef.current.x + dist * Math.sign(dx);
        targetY = originRef.current.y + dist * Math.sign(dy);
      }

      const isShading = inkType === 'shading';
      pendingFilledShapeRef.current = {
        tool,
        originX: originRef.current.x,
        originY: originRef.current.y,
        targetX,
        targetY,
        ctrlKey: modifiers.ctrl,
        colorHex: primaryColor,
        isShading,
      };
      publishLiveShapePreview({
        projectId: id,
        tool,
        left: Math.min(originRef.current.x, targetX),
        top: Math.min(originRef.current.y, targetY),
        right: Math.max(originRef.current.x, targetX),
        bottom: Math.max(originRef.current.y, targetY),
        colorHex: primaryColor,
        isShading,
      });
      return;
    }

    const isShapeTool = ['line', 'rect', 'ellipse'].includes(tool);
    const isPixelPerfectPencil = stateRef.current.pixelPerfect && stateRef.current.brushSize === 1 && !modifiers.shift && tool === 'pencil';
    const isFullStrokeReplay = modifiers.shift || isShapeTool || isPixelPerfectPencil;

    const useStartBuffer = isFullStrokeReplay && ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'blur', 'sharpen'].includes(tool);
    
    // Lazily allocate a single working Uint32Array copy on the first write
    if (!strokeMetaRef.current) {
      strokeStartDataRef.current = resolveHydratedPixelGrid(currentFrame.layerData[activeLayerId]);
      strokeMetaRef.current = { projectId: id, frameIndex: activeFrameIndex, layerId: activeLayerId };
      strokeDirtyRef.current = false;
      strokeBoundsRef.current = null;
      lastReplayIndicesRef.current.length = 0;
      wasUsingStartBufferRef.current = false;
    }
    if (!activeStrokePixelsRef.current) {
      activeStrokePixelsRef.current = strokeStartDataRef.current
        ? clonePixelGrid(strokeStartDataRef.current)
        : createPixelGrid(width * height);
    }

    const layerPixels = activeStrokePixelsRef.current;
    let dirtyMinX = width;
    let dirtyMinY = height;
    let dirtyMaxX = -1;
    let dirtyMaxY = -1;
    let fullRedraw = false;
    let changed = false;

    if (['pencil', 'eraser', 'smudge', 'line', 'rect', 'ellipse', 'blur', 'sharpen'].includes(tool)) {
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
          } else if (tool === 'rect') {
              const left = Math.min(originRef.current.x, targetX);
              const right = Math.max(originRef.current.x, targetX);
              const top = Math.min(originRef.current.y, targetY);
              const bottom = Math.max(originRef.current.y, targetY);
              for (let cx = left; cx <= right; cx++) {
                  pointsToDraw.push({x: cx, y: top});
                  pointsToDraw.push({x: cx, y: bottom});
              }
              for (let cy = top + 1; cy < bottom; cy++) {
                  pointsToDraw.push({x: left, y: cy});
                  pointsToDraw.push({x: right, y: cy});
              }
          } else if (tool === 'ellipse') {
              pointsToDraw = bresenhamEllipse(originRef.current.x, originRef.current.y, targetX, targetY);
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

      // For replay tools (shapes, Shift-line, pixel-perfect), restore only previously touched indices
      // instead of cloning the entire pixel array on every mouse move.
      if (useStartBuffer) {
        const startBuf = strokeStartDataRef.current;
        if (!wasUsingStartBufferRef.current && strokeDirtyRef.current) {
          if (startBuf) {
            layerPixels.set(startBuf);
          } else {
            layerPixels.fill(EMPTY_PIXEL);
          }
          fullRedraw = true;
          lastReplayIndicesRef.current.length = 0;
        } else {
          const prevIndices = lastReplayIndicesRef.current;
          for (let i = 0; i < prevIndices.length; i++) {
            const idx = prevIndices[i];
            layerPixels[idx] = startBuf ? startBuf[idx] : EMPTY_PIXEL;
            const px = idx % width;
            const py = (idx / width) | 0;
            if (px < dirtyMinX) dirtyMinX = px;
            if (px > dirtyMaxX) dirtyMaxX = px;
            if (py < dirtyMinY) dirtyMinY = py;
            if (py > dirtyMaxY) dirtyMaxY = py;
          }
          prevIndices.length = 0;
        }
        wasUsingStartBufferRef.current = true;
      } else {
        wasUsingStartBufferRef.current = false;
      }

      const activeColorHex = modifiers.ctrl && tool === 'pencil' ? secondaryColor : primaryColor;
      const activeVal = resolvePixelValue(activeColorHex);

      const size = stateRef.current.brushSize;
      const radiusSq = (size / 2) * (size / 2);

      const isDitheredConv = (tool === 'blur' || tool === 'sharpen') && colorMode === 'indexed' && ditheringEnabled;
      const isSmudge = tool === 'smudge';
      const smudgeMode = stateRef.current.smudgeMode ?? 'blend';
      const smudgeStrength = stateRef.current.smudgeStrength ?? 0.7;
      const replayIndices = lastReplayIndicesRef.current;

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

          // Brush-scoped error buffers (tens of bytes instead of ~100 MB on 4K canvases)
          let errorBufferR: Float32Array | null = null;
          let errorBufferG: Float32Array | null = null;
          let errorBufferB: Float32Array | null = null;
          let errW = 0;
          let errH = 0;
          let errOx = 0;
          let errOy = 0;
          if (isDitheredConv && right >= left && bottom >= top) {
            errOx = left - 1;
            errOy = top;
            errW = right - left + 3;
            errH = bottom - top + 2;
            const errLen = errW * errH;
            errorBufferR = new Float32Array(errLen);
            errorBufferG = new Float32Array(errLen);
            errorBufferB = new Float32Array(errLen);
          }

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

                  if (drawX < dirtyMinX) dirtyMinX = drawX;
                  if (drawX > dirtyMaxX) dirtyMaxX = drawX;
                  if (drawY < dirtyMinY) dirtyMinY = drawY;
                  if (drawY > dirtyMaxY) dirtyMaxY = drawY;
                  if (useStartBuffer) replayIndices.push(idx);
                  
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
                                  if (srcVal !== EMPTY_PIXEL) {
                                      layerPixels[idx] = srcVal;
                                      if (size === 1 || (Math.abs(relX - dx_vec) > r || Math.abs(relY - dy_vec) > r)) {
                                          layerPixels[srcIdx] = EMPTY_PIXEL;
                                          if (sx < dirtyMinX) dirtyMinX = sx;
                                          if (sx > dirtyMaxX) dirtyMaxX = sx;
                                          if (sy < dirtyMinY) dirtyMinY = sy;
                                          if (sy > dirtyMaxY) dirtyMaxY = sy;
                                      }
                                  }
                              }
                          }
                      } else {
                          // Smart Blend mode
                          const key = `${relX},${relY}`;
                          let carriedVal = smudgeReservoirRef.current.get(key) ?? EMPTY_PIXEL;
                          const canvasVal = layerPixels[idx];

                          if (carriedVal === EMPTY_PIXEL) {
                              if (canvasVal !== EMPTY_PIXEL) {
                                  smudgeReservoirRef.current.set(key, canvasVal);
                                  carriedVal = canvasVal;
                              }
                          }

                          if (carriedVal !== EMPTY_PIXEL) {
                              if (canvasVal === EMPTY_PIXEL) {
                                  // Dragging paint into empty space: deposit carried paint smoothly
                                  layerPixels[idx] = carriedVal;
                              } else {
                                  // Both carried color and canvas color are present -> Smart Color Blend
                                  const rgb1 = pixelToRgb(carriedVal, palette);
                                  const rgb2 = pixelToRgb(canvasVal, palette);
                                  if (rgb1 && rgb2) {
                                      const [r1, g1, b1] = rgb1;
                                      const [r2, g2, b2] = rgb2;

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

                                      const mixedVal: PixelValue = colorMode === 'rgba'
                                          ? packRGBA(mixedR, mixedG, mixedB, 255)
                                          : encodeIndexedPixel(findNearestPaletteIndex(mixedR, mixedG, mixedB, palette));
                                      layerPixels[idx] = mixedVal;

                                      // Reservoir color pickup: brush absorbs some canvas color as it travels
                                      const pickupRate = Math.min(0.65, (1 - blendFactor * 0.4) * 0.45 * falloff);
                                      const carriedR = Math.round(r1 * (1 - pickupRate) + r2 * pickupRate);
                                      const carriedG = Math.round(g1 * (1 - pickupRate) + g2 * pickupRate);
                                      const carriedB = Math.round(b1 * (1 - pickupRate) + b2 * pickupRate);

                                      const nextCarriedVal: PixelValue = colorMode === 'rgba'
                                          ? packRGBA(carriedR, carriedG, carriedB, 255)
                                          : encodeIndexedPixel(findNearestPaletteIndex(carriedR, carriedG, carriedB, palette));
                                      smudgeReservoirRef.current.set(key, nextCarriedVal);
                                  }
                              }
                          }
                      }
                  } else if (tool === 'eraser') {
                      layerPixels[idx] = EMPTY_PIXEL;
                  } else if (isDitheredConv && errorBufferR && errorBufferG && errorBufferB) {
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
                                  if (val !== EMPTY_PIXEL) {
                                      const rgb = pixelToRgb(val, palette);
                                      if (rgb) {
                                          const kw = kernel[ky][kx];
                                          r_conv += rgb[0] * kw;
                                          g_conv += rgb[1] * kw;
                                          b_conv += rgb[2] * kw;
                                          weight += kw;
                                      }
                                  }
                              }
                          }
                      }
                      if (weight > 0) {
                          const localX = drawX - errOx;
                          const localY = drawY - errOy;
                          const errIdx = localY * errW + localX;
                          const targetR = r_conv / weight + errorBufferR[errIdx];
                          const targetG = g_conv / weight + errorBufferG[errIdx];
                          const targetB = b_conv / weight + errorBufferB[errIdx];
                          
                          const paletteIndex = findNearestPaletteIndex(targetR, targetG, targetB, palette);
                          layerPixels[idx] = encodeIndexedPixel(paletteIndex);
                          
                          const [pr, pg, pb] = hexToRgb(palette[paletteIndex]);
                          const errR = targetR - pr;
                          const errG = targetG - pg;
                          const errB = targetB - pb;
                          
                          distributeDitherError(
                              localX, localY, errW, errH,
                              errR, errG, errB,
                              errorBufferR, errorBufferG, errorBufferB
                          );
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
    }

    if (changed) {
      strokeDirtyRef.current = true;
      activeStrokePixelsRef.current = layerPixels;
      const dirtyRect = dirtyMaxX >= dirtyMinX && dirtyMaxY >= dirtyMinY
        ? { minX: dirtyMinX, minY: dirtyMinY, maxX: dirtyMaxX, maxY: dirtyMaxY }
        : null;

      if (fullRedraw) {
        strokeBoundsRef.current = { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
      } else if (dirtyRect) {
        const prevBounds = strokeBoundsRef.current;
        if (!prevBounds) {
          strokeBoundsRef.current = { ...dirtyRect };
        } else {
          if (dirtyRect.minX < prevBounds.minX) prevBounds.minX = dirtyRect.minX;
          if (dirtyRect.minY < prevBounds.minY) prevBounds.minY = dirtyRect.minY;
          if (dirtyRect.maxX > prevBounds.maxX) prevBounds.maxX = dirtyRect.maxX;
          if (dirtyRect.maxY > prevBounds.maxY) prevBounds.maxY = dirtyRect.maxY;
        }
      }

      publishLiveStroke({
        projectId: id,
        frameIndex: activeFrameIndex,
        layerId: activeLayerId,
        pixels: layerPixels,
        dirtyRect,
        fullRedraw,
      });
    }
  }, []);

  const handleDrawEnd = useCallback(() => {
    const meta = strokeMetaRef.current;
    const basePixels = strokeStartDataRef.current;
    const finalPixels = activeStrokePixelsRef.current;
    const bounds = strokeBoundsRef.current;
    const isDirty = strokeDirtyRef.current;
    const pendingShape = pendingFilledShapeRef.current;

    // Reset refs immediately so duplicate pointerUp calls are strictly idempotent
    smudgeReservoirRef.current.clear();
    lastSmudgePointRef.current = null;
    strokeStartDataRef.current = null;
    activeStrokePixelsRef.current = null;
    strokeMetaRef.current = null;
    strokeDirtyRef.current = false;
    strokeBoundsRef.current = null;
    lastReplayIndicesRef.current.length = 0;
    wasUsingStartBufferRef.current = false;
    pendingFilledShapeRef.current = null;
    const hadStroke = strokePathRef.current.length > 0 || originRef.current !== null || pendingShape !== null;
    strokePathRef.current = [];
    originRef.current = null;

    clearLiveStroke();
    clearLiveShapePreview();

    // Span-based rasterization for Filled Rect / Filled Ellipse (instant even across full 4K canvases)
    if (pendingShape) {
      const curState = stateRef.current;
      const { width, height, selection, symmetry, frames } = curState;
      const targetFrameIdx = meta && meta.projectId === curState.id ? meta.frameIndex : curState.activeFrameIndex;
      const targetLayerId = meta && meta.projectId === curState.id ? meta.layerId : curState.activeLayerId;
      const frame = frames[targetFrameIdx];
      if (!frame) return;

      const resolvedBase = basePixels ?? resolveHydratedPixelGrid(frame.layerData[targetLayerId]);
      const workingGrid = resolvedBase ? clonePixelGrid(resolvedBase) : createPixelGrid(width * height);
      const activeVal = resolvePixelValue(pendingShape.colorHex);
      const useShading = pendingShape.isShading;
      const moveForward = !pendingShape.ctrlKey;

      let dirtyMinX = width;
      let dirtyMinY = height;
      let dirtyMaxX = -1;
      let dirtyMaxY = -1;

      const fillSingleSpan = (sy: number, sx0: number, sx1: number) => {
        if (sy < 0 || sy >= height) return;
        const left = sx0 < 0 ? 0 : sx0;
        const right = sx1 >= width ? width - 1 : sx1;
        if (right < left) return;

        if (left < dirtyMinX) dirtyMinX = left;
        if (right > dirtyMaxX) dirtyMaxX = right;
        if (sy < dirtyMinY) dirtyMinY = sy;
        if (sy > dirtyMaxY) dirtyMaxY = sy;

        const rowOff = sy * width;
        if (!selection && !useShading) {
          workingGrid.fill(activeVal, rowOff + left, rowOff + right + 1);
          return;
        }
        for (let cx = left; cx <= right; cx++) {
          const idx = rowOff + cx;
          if (selection && !selection.has(idx)) continue;
          if (useShading) {
            workingGrid[idx] = getShadedValue(workingGrid[idx], moveForward);
          } else {
            workingGrid[idx] = activeVal;
          }
        }
      };

      const fillSpanWithSymmetry = (sy: number, sx0: number, sx1: number) => {
        fillSingleSpan(sy, sx0, sx1);
        if (symmetry.x) {
          fillSingleSpan(sy, width - 1 - sx1, width - 1 - sx0);
        }
        if (symmetry.y) {
          fillSingleSpan(height - 1 - sy, sx0, sx1);
        }
        if (symmetry.x && symmetry.y) {
          fillSingleSpan(height - 1 - sy, width - 1 - sx1, width - 1 - sx0);
        }
      };

      if (pendingShape.tool === 'filled-rect') {
        const left = Math.min(pendingShape.originX, pendingShape.targetX);
        const right = Math.max(pendingShape.originX, pendingShape.targetX);
        const top = Math.min(pendingShape.originY, pendingShape.targetY);
        const bottom = Math.max(pendingShape.originY, pendingShape.targetY);
        for (let sy = top; sy <= bottom; sy++) {
          fillSpanWithSymmetry(sy, left, right);
        }
      } else {
        forEachFilledEllipseSpan(
          pendingShape.originX,
          pendingShape.originY,
          pendingShape.targetX,
          pendingShape.targetY,
          fillSpanWithSymmetry
        );
      }

      if (dirtyMaxX < dirtyMinX || dirtyMaxY < dirtyMinY) return;
      const shapeBounds = { minX: dirtyMinX, minY: dirtyMinY, maxX: dirtyMaxX, maxY: dirtyMaxY };
      const layerPatch = buildLayerPatch(targetLayerId, resolvedBase, workingGrid, width, height, shapeBounds);
      if (!layerPatch) return;

      const prefix = useShading ? 'Shading ' : '';
      const actionName =
        pendingShape.tool === 'filled-rect'
          ? `${prefix}Filled Rectangle`
          : `${prefix}Filled Ellipse`;

      const newFrames = curState.frames.map((f, i) =>
        i !== targetFrameIdx ? f : { ...f, layerData: { ...f.layerData, [targetLayerId]: workingGrid } }
      );
      const nextState = { ...curState, frames: newFrames };
      stateRef.current = nextState;
      updateStateRef.current(nextState, {
        action: actionName,
        tool: pendingShape.tool,
        patch: { frameIndex: targetFrameIdx, layers: [layerPatch] },
      });
      return;
    }

    if (hadStroke && isDirty && finalPixels) {
        const curState = stateRef.current;
        const targetFrameIdx = meta && meta.projectId === curState.id ? meta.frameIndex : curState.activeFrameIndex;
        const targetLayerId = meta && meta.projectId === curState.id ? meta.layerId : curState.activeLayerId;

        const layerPatch = buildLayerPatch(targetLayerId, basePixels, finalPixels, curState.width, curState.height, bounds);
        if (!layerPatch) {
          return;
        }

        let actionName = 'Draw';
        const isShading = curState.inkType === 'shading';
        const prefix = isShading ? 'Shading ' : '';

        if (curState.tool === 'pencil') actionName = `${prefix}Pencil Stroke`;
        else if (curState.tool === 'eraser') actionName = 'Eraser';
        else if (curState.tool === 'smudge') actionName = curState.smudgeMode === 'push' ? 'Push Pixels' : 'Smudge';
        else if (curState.tool === 'line') actionName = `${prefix}Line`;
        else if (curState.tool === 'rect') actionName = `${prefix}Rectangle`;
        else if (curState.tool === 'filled-rect') actionName = `${prefix}Filled Rectangle`;
        else if (curState.tool === 'ellipse') actionName = `${prefix}Ellipse`;
        else if (curState.tool === 'filled-ellipse') actionName = `${prefix}Filled Ellipse`;
        else if (curState.tool === 'blur') actionName = 'Blur Brush';
        else if (curState.tool === 'sharpen') actionName = 'Sharpen Brush';

        const newFrames = curState.frames.map((f, i) =>
          i !== targetFrameIdx ? f : { ...f, layerData: { ...f.layerData, [targetLayerId]: finalPixels } }
        );
        const nextState = { ...curState, frames: newFrames };
        stateRef.current = nextState;
        updateStateRef.current(nextState, {
          action: actionName,
          tool: curState.tool,
          patch: layerPatch ? { frameIndex: targetFrameIdx, layers: [layerPatch] } : undefined,
        });
    }
  }, []);

  const handleMovePixels = useCallback((selection: SelectionMask, offset: Position) => {
    const { activeFrameIndex, selectedLayerIds, frames, width, height } = stateRef.current;
    const oldBox = selection.size > 0 ? getSelectionBoundingBox(selection, width) : null;
    const bounds = oldBox ? {
      minX: Math.max(0, Math.min(oldBox.x, oldBox.x + offset.x)),
      minY: Math.max(0, Math.min(oldBox.y, oldBox.y + offset.y)),
      maxX: Math.min(width - 1, Math.max(oldBox.x + oldBox.w - 1, oldBox.x + oldBox.w - 1 + offset.x)),
      maxY: Math.min(height - 1, Math.max(oldBox.y + oldBox.h - 1, oldBox.y + oldBox.h - 1 + offset.y)),
    } : undefined;
    const layerPatches: PixelLayerPatch[] = [];
    
    const newFrames = frames.map((f, i) => {
      if (i !== activeFrameIndex) return f;
      const newLayerData = { ...f.layerData };
      selectedLayerIds.forEach(layerId => {
        const basePixels = resolveHydratedPixelGrid(f.layerData[layerId]);
        if (!basePixels) return;
        const updatedPixels = clonePixelGrid(basePixels);
        selection.forEach(idx => { updatedPixels[idx] = EMPTY_PIXEL; });
        selection.forEachCoord((x, y, idx) => {
          const nx = x + offset.x;
          const ny = y + offset.y;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            updatedPixels[ny * width + nx] = basePixels[idx];
          }
        });
        newLayerData[layerId] = updatedPixels;
        const patch = buildLayerPatch(layerId, basePixels, updatedPixels, width, height, bounds);
        if (patch) layerPatches.push(patch);
      });
      return { ...f, layerData: newLayerData };
    });

    const translated = selection.translate(offset.x, offset.y);
    const finalSelection = translated.size > 0 ? translated : null;

    updateStateRef.current(
      { ...stateRef.current, frames: newFrames, selection: finalSelection }, 
      {
        action: `Move Pixels on ${selectedLayerIds.length} Layers`,
        tool: 'move',
        patch: layerPatches.length > 0 ? {
          frameIndex: activeFrameIndex,
          layers: layerPatches,
          selectionBefore: selection,
          selectionAfter: finalSelection,
        } : undefined,
      }
    );
  }, []);

  const handleRotatePixels = useCallback((selection: SelectionMask, angle: number, pivot: Position) => {
      const { activeFrameIndex, selectedLayerIds, frames, width, height, rotationAlgorithm } = stateRef.current;
      const newSelection = rotateSelectionMask(selection, angle, pivot, width, height);
      const finalSelection = newSelection.size > 0 ? newSelection : null;
      const layerPatches: PixelLayerPatch[] = [];

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(layerId => {
              const basePixels = resolveHydratedPixelGrid(f.layerData[layerId]);
              if (!basePixels) return;
              const rotatedPixels = rotateSelectionPixels(selection, basePixels, angle, pivot, width, height, rotationAlgorithm);
              const updatedPixels = clonePixelGrid(basePixels);
              selection.forEach(idx => { updatedPixels[idx] = EMPTY_PIXEL; });
              for (let j = 0; j < rotatedPixels.length; j++) {
                  const rv = rotatedPixels[j];
                  if (rv !== EMPTY_PIXEL) updatedPixels[j] = rv;
              }
              newLayerData[layerId] = updatedPixels;
              const patch = buildLayerPatch(layerId, basePixels, updatedPixels, width, height);
              if (patch) layerPatches.push(patch);
          });
          return { ...f, layerData: newLayerData };
      });
      updateStateRef.current(
          { ...stateRef.current, frames: newFrames, selection: finalSelection },
          {
            action: `Rotate Selection on ${selectedLayerIds.length} Layers`,
            tool: 'move',
            patch: layerPatches.length > 0 ? {
              frameIndex: activeFrameIndex,
              layers: layerPatches,
              selectionBefore: selection,
              selectionAfter: finalSelection,
            } : undefined,
          }
      );
  }, []);

  const handleScalePixels = useCallback((selection: SelectionMask, srcBox: any, destBox: any) => {
    const { activeFrameIndex, selectedLayerIds, frames, width, height } = stateRef.current;
    const newSelection = scaleSelectionMask(selection, srcBox, destBox, width, height);
    const finalSelection = newSelection.size > 0 ? newSelection : null;
    const bounds = {
      minX: Math.max(0, Math.floor(Math.min(srcBox.x, destBox.x))),
      minY: Math.max(0, Math.floor(Math.min(srcBox.y, destBox.y))),
      maxX: Math.min(width - 1, Math.ceil(Math.max(srcBox.x + srcBox.w, destBox.x + destBox.w))),
      maxY: Math.min(height - 1, Math.ceil(Math.max(srcBox.y + srcBox.h, destBox.y + destBox.h))),
    };
    const layerPatches: PixelLayerPatch[] = [];

    const newFrames = frames.map((f, i) => {
      if (i !== activeFrameIndex) return f;
      const newLayerData = { ...f.layerData };
      selectedLayerIds.forEach(layerId => {
        const basePixels = resolveHydratedPixelGrid(f.layerData[layerId]);
        if (!basePixels) return;
        const scaledPixels = scaleSelectionPixels(selection, basePixels, srcBox, destBox, width, height);
        const updatedPixels = clonePixelGrid(basePixels);
        selection.forEach(idx => { updatedPixels[idx] = EMPTY_PIXEL; });
        for (let j = 0; j < scaledPixels.length; j++) {
          const sv = scaledPixels[j];
          if (sv !== EMPTY_PIXEL) updatedPixels[j] = sv;
        }
        newLayerData[layerId] = updatedPixels;
        const patch = buildLayerPatch(layerId, basePixels, updatedPixels, width, height, bounds);
        if (patch) layerPatches.push(patch);
      });
      return { ...f, layerData: newLayerData };
    });
    updateStateRef.current(
      { ...stateRef.current, frames: newFrames, selection: finalSelection },
      {
        action: `Scale Selection on ${selectedLayerIds.length} Layers`,
        tool: 'move',
        patch: layerPatches.length > 0 ? {
          frameIndex: activeFrameIndex,
          layers: layerPatches,
          selectionBefore: selection,
          selectionAfter: finalSelection,
        } : undefined,
      }
    );
  }, []);

  return { handleDrawStart, handleDraw, handleDrawEnd, handleMovePixels, handleRotatePixels, handleScalePixels };
}
