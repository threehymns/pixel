import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ProjectState, Position } from '../types';
import { 
  drawCheckeredBackground, getIndex, getCoords,
  getRectSelection, getEllipseSelection, getPolygonSelection, getWandSelection
} from '../utils';

interface CanvasProps {
  state: ProjectState;
  onDrawStart: () => void;
  onDraw: (x: number, y: number) => void;
  onDrawEnd: () => void;
  onSelectionUpdate: (sel: Set<number> | null) => void;
  onMovePixels: (newSelection: Set<number>, offset: Position) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  state, 
  onDrawStart, 
  onDraw, 
  onDrawEnd,
  onSelectionUpdate,
  onMovePixels
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  
  // Selection State
  const [startPos, setStartPos] = useState<Position | null>(null);
  const [polyPoints, setPolyPoints] = useState<Position[]>([]);
  const [dashOffset, setDashOffset] = useState(0);

  // Move Tool State
  const [isMoving, setIsMoving] = useState(false);
  const [moveStart, setMoveStart] = useState<Position | null>(null);
  const [moveOffset, setMoveOffset] = useState<Position>({x: 0, y: 0});
  const [floatingPixels, setFloatingPixels] = useState<Map<number, string | null> | null>(null);

  // Marching Ants Animation
  useEffect(() => {
    let animId: number;
    const animate = () => {
      setDashOffset(prev => (prev - 1) % 8);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const getPixelCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = state.zoom;
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);
    return { x, y };
  }, [state.zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const coords = getPixelCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    // Move Tool Logic
    if (state.tool === 'move' && state.selection && state.selection.has(getIndex(x, y, state.width))) {
      setIsMoving(true);
      setMoveStart({x, y});
      setMoveOffset({x: 0, y: 0});
      
      // Capture pixels under selection for preview
      const frame = state.frames[state.activeFrameIndex];
      const layerData = frame.layerData[state.activeLayerId];
      if (layerData) {
        const floats = new Map<number, string | null>();
        state.selection.forEach(idx => {
          floats.set(idx, layerData[idx]);
        });
        setFloatingPixels(floats);
      }
      return;
    }

    // Poly Lasso Logic
    if (state.tool === 'poly-lasso-select') {
      setPolyPoints(prev => [...prev, { x, y }]);
      return;
    }

    // Selection Tools Logic
    if (['rect-select', 'ellipse-select', 'lasso-select'].includes(state.tool)) {
      setIsDrawing(true);
      setStartPos({ x, y });
      if (state.tool === 'lasso-select') setPolyPoints([{x, y}]);
      return;
    }

    // Magic Wand
    if (state.tool === 'magic-wand') {
      if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;
      const frame = state.frames[state.activeFrameIndex];
      const layerData = frame.layerData[state.activeLayerId];
      if (layerData) {
        const newSel = getWandSelection(layerData, x, y, state.width, state.height, state.fillContiguous);
        combineSelection(newSel);
      }
      return;
    }

    // Drawing Tools
    if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
      setIsDrawing(true);
      onDrawStart();
      onDraw(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getPixelCoords(e);
    setCursorPos(coords);
    if (!coords) return;
    const { x, y } = coords;

    if (isMoving && moveStart) {
      setMoveOffset({ x: x - moveStart.x, y: y - moveStart.y });
      return;
    }

    if (isDrawing) {
      if (state.tool === 'lasso-select') {
        setPolyPoints(prev => [...prev, { x, y }]);
      } else if (['rect-select', 'ellipse-select'].includes(state.tool)) {
        // Just trigger render updates via state
      } else if (['pencil', 'eraser'].includes(state.tool)) {
        if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
             onDraw(x, y);
        }
      }
    }
  };

  const combineSelection = (newSelection: Set<number>) => {
    let finalSel = new Set<number>();
    const current = state.selection || new Set<number>();

    switch (state.selectionMode) {
      case 'replace': finalSel = newSelection; break;
      case 'add': finalSel = new Set([...current, ...newSelection]); break;
      case 'subtract': 
        finalSel = new Set([...current]);
        newSelection.forEach(i => finalSel.delete(i));
        break;
      case 'intersect':
        newSelection.forEach(i => { if (current.has(i)) finalSel.add(i); });
        break;
    }
    onSelectionUpdate(finalSel.size > 0 ? finalSel : null);
  };

  const handleMouseUp = () => {
    if (isMoving && moveStart && state.selection && floatingPixels) {
      // Commit move
      onMovePixels(state.selection, moveOffset);
      setIsMoving(false);
      setMoveStart(null);
      setFloatingPixels(null);
      setMoveOffset({x:0, y:0});
      return;
    }

    if (state.tool === 'poly-lasso-select') return;

    if (isDrawing) {
      if (['rect-select', 'ellipse-select', 'lasso-select'].includes(state.tool) && startPos && cursorPos) {
         let newSel = new Set<number>();
         if (state.tool === 'rect-select') {
           newSel = getRectSelection(startPos.x, startPos.y, cursorPos.x, cursorPos.y, state.width);
         } else if (state.tool === 'ellipse-select') {
           newSel = getEllipseSelection(startPos.x, startPos.y, cursorPos.x, cursorPos.y, state.width);
         } else if (state.tool === 'lasso-select') {
           newSel = getPolygonSelection(polyPoints, state.width, state.height);
         }
         combineSelection(newSel);
      } else if (['pencil', 'eraser', 'bucket'].includes(state.tool)) {
        onDrawEnd();
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setPolyPoints([]);
  };

  const handleDoubleClick = () => {
    if (state.tool === 'poly-lasso-select' && polyPoints.length > 2) {
      const newSel = getPolygonSelection(polyPoints, state.width, state.height);
      combineSelection(newSel);
      setPolyPoints([]);
    }
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCheckeredBackground(ctx, state.width, state.height, state.zoom);

    const drawPixels = (pixels: (string | null)[], opacity: number = 1.0, skipIndices: Set<number> | null = null, offset: Position = {x:0,y:0}) => {
      ctx.globalAlpha = opacity;
      pixels.forEach((color, i) => {
        if (color && (!skipIndices || !skipIndices.has(i))) {
          const { x, y } = getCoords(i, state.width);
          ctx.fillStyle = color;
          ctx.fillRect((x + offset.x) * state.zoom, (y + offset.y) * state.zoom, state.zoom, state.zoom);
        }
      });
      ctx.globalAlpha = 1.0;
    };

    // Onion Skin
    if (state.onionSkin && state.activeFrameIndex > 0) {
      const prevFrame = state.frames[state.activeFrameIndex - 1];
      state.layers.forEach(layer => {
        if (layer.visible) {
          const layerPixels = prevFrame.layerData[layer.id];
          if (layerPixels) drawPixels(layerPixels, 0.3);
        }
      });
    }

    // Current Layer
    const currentFrame = state.frames[state.activeFrameIndex];
    state.layers.forEach((layer) => {
      if (!layer.visible) return;
      const layerPixels = currentFrame.layerData[layer.id];
      if (layerPixels) {
        // If moving, skip selected pixels on active layer
        const isTargetLayer = layer.id === state.activeLayerId;
        drawPixels(
           layerPixels, 
           1.0, 
           (isMoving && isTargetLayer) ? state.selection : null
        );
      }
    });

    // Floating Pixels (Move Preview)
    if (isMoving && floatingPixels) {
      floatingPixels.forEach((color, idx) => {
         if (color) {
            const { x, y } = getCoords(idx, state.width);
            ctx.fillStyle = color;
            ctx.fillRect((x + moveOffset.x) * state.zoom, (y + moveOffset.y) * state.zoom, state.zoom, state.zoom);
         }
      });
    }

    // Grid
    if (state.showGrid && state.zoom > 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= state.width; x++) {
        ctx.moveTo(x * state.zoom, 0);
        ctx.lineTo(x * state.zoom, state.height * state.zoom);
      }
      for (let y = 0; y <= state.height; y++) {
        ctx.moveTo(0, y * state.zoom);
        ctx.lineTo(state.width * state.zoom, y * state.zoom);
      }
      ctx.stroke();
    }

    // Selection Marching Ants
    if (state.selection && state.selection.size > 0) {
      ctx.beginPath();
      ctx.lineWidth = 1;
      const z = state.zoom;
      // Draw offset selection if moving
      const ox = isMoving ? moveOffset.x : 0;
      const oy = isMoving ? moveOffset.y : 0;

      state.selection.forEach(idx => {
         const { x, y } = getCoords(idx, state.width);
         const dx = x + ox;
         const dy = y + oy;
         
         // Check neighbors (relative to original selection set)
         // We check adjacent indices in the set.
         // Top
         if (y===0 || !state.selection!.has(idx - state.width)) {
             ctx.moveTo(dx*z, dy*z); ctx.lineTo((dx+1)*z, dy*z);
         }
         // Bottom
         if (y===state.height-1 || !state.selection!.has(idx + state.width)) {
             ctx.moveTo(dx*z, (dy+1)*z); ctx.lineTo((dx+1)*z, (dy+1)*z);
         }
         // Left
         if (x===0 || !state.selection!.has(idx - 1)) {
             ctx.moveTo(dx*z, dy*z); ctx.lineTo(dx*z, (dy+1)*z);
         }
         // Right
         if (x===state.width-1 || !state.selection!.has(idx + 1)) {
             ctx.moveTo((dx+1)*z, dy*z); ctx.lineTo((dx+1)*z, (dy+1)*z);
         }
      });

      ctx.strokeStyle = '#fff';
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -dashOffset;
      ctx.stroke();
      ctx.strokeStyle = '#000';
      ctx.lineDashOffset = -dashOffset + 4;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Drag Shape Preview
    if (isDrawing && startPos && cursorPos) {
        ctx.strokeStyle = 'white';
        ctx.setLineDash([4, 4]);
        const x = startPos.x * state.zoom;
        const y = startPos.y * state.zoom;
        const w = (cursorPos.x - startPos.x + (cursorPos.x >= startPos.x ? 1 : 0)) * state.zoom;
        const h = (cursorPos.y - startPos.y + (cursorPos.y >= startPos.y ? 1 : 0)) * state.zoom;

        if (state.tool === 'rect-select') {
           ctx.strokeRect(Math.min(x, x+w), Math.min(y, y+h), Math.abs(w), Math.abs(h));
        } else if (state.tool === 'ellipse-select') {
           ctx.beginPath();
           ctx.ellipse(Math.min(x, x+w) + Math.abs(w)/2, Math.min(y, y+h) + Math.abs(h)/2, Math.abs(w)/2, Math.abs(h)/2, 0, 0, 2 * Math.PI);
           ctx.stroke();
        }
        ctx.setLineDash([]);
    }
    
    // Poly/Lasso Preview
    if (polyPoints.length > 0) {
        ctx.strokeStyle = 'white';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const z = state.zoom;
        ctx.moveTo(polyPoints[0].x * z + z/2, polyPoints[0].y * z + z/2);
        for(let i=1; i<polyPoints.length; i++) ctx.lineTo(polyPoints[i].x * z + z/2, polyPoints[i].y * z + z/2);
        if (cursorPos && (state.tool === 'lasso-select' || state.tool === 'poly-lasso-select')) {
             ctx.lineTo(cursorPos.x * z + z/2, cursorPos.y * z + z/2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (state.tool === 'poly-lasso-select') {
            ctx.fillStyle = 'yellow';
            polyPoints.forEach(p => ctx.fillRect(p.x*z, p.y*z, z, z));
        }
    }

    // Brush Preview (Only if not selecting or moving)
    if (cursorPos && !isDrawing && !isMoving && ['pencil', 'eraser', 'bucket'].includes(state.tool)) {
        const { x, y } = cursorPos;
        const size = state.brushSize;
        const startOffset = Math.floor(size / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.strokeRect((x - startOffset) * state.zoom, (y - startOffset) * state.zoom, size * state.zoom, size * state.zoom);
    }

  }, [state, cursorPos, dashOffset, startPos, polyPoints, isMoving, moveOffset, floatingPixels]);

  return (
    <div className="flex-1 bg-[oklch(0.145_0_0)] overflow-auto flex items-center justify-center relative p-8 shadow-inner border-l border-r border-background">
      <canvas
        ref={canvasRef}
        width={state.width * state.zoom}
        height={state.height * state.zoom}
        className="shadow-2xl bg-white pixelated"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setCursorPos(null); handleMouseUp(); }}
        onDoubleClick={handleDoubleClick}
        style={{
            cursor: ['rect-select', 'ellipse-select', 'lasso-select', 'poly-lasso-select', 'magic-wand'].includes(state.tool) ? 'crosshair' : (state.tool === 'move' ? 'move' : (state.tool === 'pencil' ? 'none' : 'default'))
        }}
      />
    </div>
  );
}