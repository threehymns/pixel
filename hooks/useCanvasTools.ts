
import { useRef } from 'react';
import { ProjectState, PixelGrid, Position, ToolType } from '../types';
import { bresenhamLine, pixelPerfectFilter, getIndex, floodFill, getCoords } from '../utils';

export function useCanvasTools(
  state: ProjectState,
  updateState: (s: ProjectState, historyConfig?: { action: string, tool?: ToolType }) => void
) {
  const strokeStartDataRef = useRef<PixelGrid | null>(null);
  const strokePathRef = useRef<Position[]>([]);

  const handleDrawStart = () => {
    const { activeFrameIndex, activeLayerId, frames } = state;
    const currentFrame = frames[activeFrameIndex];
    const layerData = currentFrame.layerData[activeLayerId];
    strokeStartDataRef.current = layerData ? [...layerData] : new Array(state.width * state.height).fill(null);
    strokePathRef.current = [];
  };

  const handleDraw = (x: number, y: number) => {
    const { activeFrameIndex, activeLayerId, frames, tool, primaryColor, width, height, selection } = state;
    const currentFrame = frames[activeFrameIndex];
    const layerPixels = strokeStartDataRef.current && ['pencil', 'eraser'].includes(tool)
        ? [...strokeStartDataRef.current] 
        : [...(currentFrame.layerData[activeLayerId] || new Array(width * height).fill(null))];
        
    let changed = false;

    if (tool === 'pencil' || tool === 'eraser') {
      const lastPoint = strokePathRef.current.length > 0 
          ? strokePathRef.current[strokePathRef.current.length - 1] 
          : {x, y};
      const newPoints = bresenhamLine(lastPoint.x, lastPoint.y, x, y);
      if (strokePathRef.current.length > 0) strokePathRef.current.push(...newPoints.slice(1));
      else strokePathRef.current.push(...newPoints);
      
      let pointsToDraw = strokePathRef.current;
      if (state.pixelPerfect && state.brushSize === 1) pointsToDraw = pixelPerfectFilter(pointsToDraw);

      const size = state.brushSize;
      const startOffset = Math.floor(size / 2);
      const radiusSq = Math.pow(size / 2 - 0.1, 2);

      pointsToDraw.forEach(pt => {
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                if (state.brushShape === 'circle') {
                    const cx = dx - (size - 1) / 2;
                    const cy = dy - (size - 1) / 2;
                    if (cx * cx + cy * cy > radiusSq) continue;
                }
                const drawX = pt.x - startOffset + dx;
                const drawY = pt.y - startOffset + dy;
                
                if (drawX < 0 || drawX >= width || drawY < 0 || drawY >= height) continue;
                const idx = getIndex(drawX, drawY, width);
                
                if (selection && !selection.has(idx)) continue; // Selection Mask

                if (tool === 'pencil') {
                    if (layerPixels[idx] !== primaryColor) {
                        layerPixels[idx] = primaryColor;
                        changed = true;
                    }
                } else {
                     if (layerPixels[idx] !== null) {
                        layerPixels[idx] = null;
                        changed = true;
                    }
                }
            }
        }
      });
      changed = true; 
    } else if (tool === 'bucket') {
      const filled = floodFill(layerPixels, x, y, primaryColor, width, height, state.fillContiguous);
      if (selection) {
          for(let i=0; i<filled.length; i++) {
              if (!selection.has(i)) filled[i] = layerPixels[i]; // Mask
          }
      }
      if (JSON.stringify(filled) !== JSON.stringify(layerPixels)) {
        const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: filled } });
        // Fill is instantaneous, so we save to history immediately
        updateState({ ...state, frames: newFrames }, { action: 'Bucket Fill', tool: 'bucket' }); 
        return; 
      }
    } else if (tool === 'eyedropper') {
        for (let i = state.layers.length - 1; i >= 0; i--) {
            const l = state.layers[i];
            if (!l.visible) continue;
            const px = currentFrame.layerData[l.id]?.[getIndex(x, y, width)];
            if (px) {
                updateState({...state, primaryColor: px, tool: 'pencil'}); // Picking color is not a history action usually
                return;
            }
        }
    }

    if (changed) {
      const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: layerPixels } });
      updateState({ ...state, frames: newFrames }); // Preview update only (no history)
    }
  };

  const handleDrawEnd = () => {
    // Only save history if we actually drew something
    if (strokePathRef.current.length > 0) {
        let actionName = 'Draw';
        if (state.tool === 'pencil') actionName = 'Pencil Stroke';
        else if (state.tool === 'eraser') actionName = 'Eraser';
        
        updateState(state, { action: actionName, tool: state.tool });
    }
    
    strokeStartDataRef.current = null;
    strokePathRef.current = [];
  };

  const handleMovePixels = (selection: Set<number>, offset: Position) => {
    const { activeFrameIndex, activeLayerId, frames } = state;
    const currentFrame = frames[activeFrameIndex];
    const layerPixels = [...(currentFrame.layerData[activeLayerId] || new Array(state.width * state.height).fill(null))];
    
    // Create new buffer
    const newPixels = [...layerPixels];
    
    // Clear old positions
    selection.forEach(idx => newPixels[idx] = null);
    
    // Write to new positions
    const newSelection = new Set<number>();
    selection.forEach(idx => {
        const {x, y} = getCoords(idx, state.width);
        const nx = x + offset.x;
        const ny = y + offset.y;
        if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
            const nIdx = getIndex(nx, ny, state.width);
            newPixels[nIdx] = layerPixels[idx];
            newSelection.add(nIdx);
        }
    });

    const newFrames = frames.map((f, i) => i !== activeFrameIndex ? f : { ...f, layerData: { ...f.layerData, [activeLayerId]: newPixels } });
    updateState(
        { ...state, frames: newFrames, selection: newSelection }, 
        { action: 'Move Pixels', tool: 'move' }
    );
  };

  return {
    handleDrawStart,
    handleDraw,
    handleDrawEnd,
    handleMovePixels
  };
}
