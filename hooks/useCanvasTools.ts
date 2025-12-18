
import { useRef, useEffect } from 'react';
import { ProjectState, PixelGrid, Position, ToolType, Modifiers } from '../types';
import { bresenhamLine, pixelPerfectFilter, getIndex, floodFill, getCoords, bresenhamEllipse, getFilledEllipse } from '../utils';

export function useCanvasTools(
  state: ProjectState,
  updateState: (s: ProjectState, historyConfig?: { action: string, tool?: ToolType }) => void
) {
  const strokeStartDataRef = useRef<PixelGrid | null>(null);
  const strokePathRef = useRef<Position[]>([]);
  const originRef = useRef<Position | null>(null);
  
  // Track the latest state to avoid stale closures in handleDrawEnd
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleDrawStart = (pos: Position, modifiers: Modifiers) => {
    const { activeFrameIndex, activeLayerId, frames } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    const layerData = currentFrame.layerData[activeLayerId];
    strokeStartDataRef.current = layerData ? [...layerData] : new Array(stateRef.current.width * stateRef.current.height).fill(null);
    strokePathRef.current = [];
    originRef.current = null;
  };

  const handleDraw = (x: number, y: number, modifiers: Modifiers) => {
    const { activeFrameIndex, activeLayerId, frames, tool, primaryColor, secondaryColor, width, height, selection } = stateRef.current;
    const currentFrame = frames[activeFrameIndex];
    
    const isPicking = tool === 'eyedropper' || (tool === 'pencil' && modifiers.alt);
    if (isPicking) {
        let pickedColor: string | null = null;
        for (let i = stateRef.current.layers.length - 1; i >= 0; i--) {
            const l = stateRef.current.layers[i];
            if (!l.visible) continue;
            const px = currentFrame.layerData[l.id]?.[getIndex(x, y, width)];
            if (px) { pickedColor = px; break; }
        }
        if (pickedColor) {
            if (modifiers.alt && tool === 'eyedropper') {
                updateState({...stateRef.current, secondaryColor: pickedColor});
            } else {
                updateState({...stateRef.current, primaryColor: pickedColor});
            }
        }
        return;
    }

    const layerPixels = strokeStartDataRef.current && ['pencil', 'eraser', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)
        ? [...strokeStartDataRef.current] 
        : [...(currentFrame.layerData[activeLayerId] || new Array(width * height).fill(null))];
        
    let changed = false;

    if (['pencil', 'eraser', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) {
      if (!originRef.current) originRef.current = {x, y};

      let pointsToDraw: Position[] = [];
      
      if (modifiers.shift || ['line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) {
          let targetX = x;
          let targetY = y;
          if (modifiers.shift && ['line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) {
              // Standard aspect ratio lock for shapes
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
                  // Outline
                  for (let cx = left; cx <= right; cx++) {
                      pointsToDraw.push({x: cx, y: top});
                      pointsToDraw.push({x: cx, y: bottom});
                  }
                  for (let cy = top + 1; cy < bottom; cy++) {
                      pointsToDraw.push({x: left, y: cy});
                      pointsToDraw.push({x: right, y: cy});
                  }
              } else {
                  // Filled
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

      const activeColor = modifiers.ctrl && tool === 'pencil' ? secondaryColor : primaryColor;
      const size = stateRef.current.brushSize;
      const startOffset = Math.floor(size / 2);
      const radiusSq = Math.pow(size / 2 - 0.1, 2);

      pointsToDraw.forEach(pt => {
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                if (stateRef.current.brushShape === 'circle') {
                    const cx = dx - (size - 1) / 2;
                    const cy = dy - (size - 1) / 2;
                    if (cx * cx + cy * cy > radiusSq) continue;
                }
                const drawX = pt.x - startOffset + dx;
                const drawY = pt.y - startOffset + dy;
                if (drawX < 0 || drawX >= width || drawY < 0 || drawY >= height) continue;
                const idx = getIndex(drawX, drawY, width);
                if (selection && !selection.has(idx)) continue;
                if (['pencil', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) { layerPixels[idx] = activeColor; }
                else { layerPixels[idx] = null; }
            }
        }
      });
      changed = true; 
    } else if (tool === 'bucket') {
      const isContiguous = modifiers.shift ? false : stateRef.current.fillContiguous;
      const filled = floodFill(layerPixels, x, y, primaryColor, width, height, isContiguous);
      if (selection) {
          for(let i=0; i<filled.length; i++) { if (!selection.has(i)) filled[i] = layerPixels[i]; }
      }
      const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: filled } });
      updateState({ ...stateRef.current, frames: newFrames }, { action: 'Bucket Fill', tool: 'bucket' }); 
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
        if (stateRef.current.tool === 'pencil') actionName = 'Pencil Stroke';
        else if (stateRef.current.tool === 'eraser') actionName = 'Eraser';
        else if (stateRef.current.tool === 'line') actionName = 'Line';
        else if (stateRef.current.tool === 'rect') actionName = 'Rectangle';
        else if (stateRef.current.tool === 'filled-rect') actionName = 'Filled Rectangle';
        else if (stateRef.current.tool === 'ellipse') actionName = 'Ellipse';
        else if (stateRef.current.tool === 'filled-ellipse') actionName = 'Filled Ellipse';
        
        updateState(stateRef.current, { action: actionName, tool: stateRef.current.tool });
    }
    strokeStartDataRef.current = null;
    strokePathRef.current = [];
    originRef.current = null;
  };

  const handleMovePixels = (selection: Set<number>, offset: Position) => {
    const { activeFrameIndex, selectedLayerIds, frames, width, height } = stateRef.current;
    
    // Process all selected layers
    const newFrames = frames.map((f, i) => {
      if (i !== activeFrameIndex) return f;
      
      const newLayerData = { ...f.layerData };
      
      selectedLayerIds.forEach(layerId => {
        const layerPixels = [...(f.layerData[layerId] || new Array(width * height).fill(null))];
        const updatedPixels = [...layerPixels];
        
        // Clear original pixels in selection
        selection.forEach(idx => updatedPixels[idx] = null);
        
        // Write pixels to new position
        selection.forEach(idx => {
          const { x, y } = getCoords(idx, width);
          const nx = x + offset.x;
          const ny = y + offset.y;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = getIndex(nx, ny, width);
            updatedPixels[nIdx] = layerPixels[idx];
          }
        });
        
        newLayerData[layerId] = updatedPixels;
      });
      
      return { ...f, layerData: newLayerData };
    });

    // Update selection itself
    const newSelection = new Set<number>();
    selection.forEach(idx => {
      const { x, y } = getCoords(idx, width);
      const nx = x + offset.x;
      const ny = y + offset.y;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        newSelection.add(getIndex(nx, ny, width));
      }
    });

    updateState(
      { ...stateRef.current, frames: newFrames, selection: newSelection }, 
      { action: `Move Pixels on ${selectedLayerIds.length} Layers`, tool: 'move' }
    );
  };

  return { handleDrawStart, handleDraw, handleDrawEnd, handleMovePixels };
}
