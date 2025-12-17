
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
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
  onZoom: (zoom: number) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  state, 
  onDrawStart, 
  onDraw, 
  onDrawEnd,
  onSelectionUpdate,
  onMovePixels,
  onZoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interaction State
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

  // Gesture State
  const gestureState = useRef({
      startZoom: state.zoom,
      startDist: 0,
      startCenter: { x: 0, y: 0 },
      startScroll: { x: 0, y: 0 }
  });
  
  // Scroll Restoration for Zoom
  const pendingScrollRef = useRef<{ left: number, top: number } | null>(null);

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

  // Restore scroll after zoom render
  useLayoutEffect(() => {
      if (containerRef.current && pendingScrollRef.current) {
          containerRef.current.scrollLeft = pendingScrollRef.current.left;
          containerRef.current.scrollTop = pendingScrollRef.current.top;
          pendingScrollRef.current = null;
      }
  }, [state.zoom, state.width, state.height]);

  const getPixelCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = state.zoom;
    const x = Math.floor((clientX - rect.left) / scale);
    const y = Math.floor((clientY - rect.top) / scale);
    return { x, y };
  }, [state.zoom]);

  // -- Interaction Logic (Shared Mouse/Touch) --

  const handlePointerDown = (clientX: number, clientY: number, button: number = 0) => {
    if (button !== 0) return; // Only left click or touch
    
    const coords = getPixelCoords(clientX, clientY);
    if (!coords) return;
    const { x, y } = coords;

    // Move Tool Logic
    if (state.tool === 'move' && state.selection && state.selection.has(getIndex(x, y, state.width))) {
      setIsMoving(true);
      setMoveStart({x, y});
      setMoveOffset({x: 0, y: 0});
      
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

    if (state.tool === 'poly-lasso-select') {
      setPolyPoints(prev => [...prev, { x, y }]);
      return;
    }

    if (['rect-select', 'ellipse-select', 'lasso-select'].includes(state.tool)) {
      setIsDrawing(true);
      setStartPos({ x, y });
      if (state.tool === 'lasso-select') setPolyPoints([{x, y}]);
      return;
    }

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

  const handlePointerMove = (clientX: number, clientY: number) => {
    const coords = getPixelCoords(clientX, clientY);
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
        // Rerender trigger
      } else if (['pencil', 'eraser'].includes(state.tool)) {
        if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
             onDraw(x, y);
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (isMoving && moveStart && state.selection && floatingPixels) {
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

  // -- Gesture Event Handlers --

  const handleWheel = useCallback((e: WheelEvent) => {
    // Zoom Logic
    if (e.ctrlKey) {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        // Mouse Position relative to viewport
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Current scroll + Mouse Position = Position in content
        const contentX = container.scrollLeft + mx;
        const contentY = container.scrollTop + my;

        const currentTotalWidth = state.width * state.zoom;
        const currentTotalHeight = state.height * state.zoom;

        // Ratios (0.0 - 1.0)
        const rx = contentX / Math.max(1, currentTotalWidth);
        const ry = contentY / Math.max(1, currentTotalHeight);

        // Calculate New Zoom
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.1 : 0.9;
        let newZoom = state.zoom * factor;
        newZoom = Math.min(Math.max(newZoom, 0.1), 128);

        // Predict New Dimensions
        const newTotalWidth = state.width * newZoom;
        const newTotalHeight = state.height * newZoom;

        // Calculate Desired Scroll to maintain ratio
        // newContentX = newTotalWidth * rx
        // newScrollLeft = newContentX - mx
        const newScrollLeft = (newTotalWidth * rx) - mx;
        const newScrollTop = (newTotalHeight * ry) - my;

        pendingScrollRef.current = { left: newScrollLeft, top: newScrollTop };
        onZoom(newZoom);
    }
    // Pan logic handled natively by overflow: auto
  }, [state.zoom, state.width, state.height, onZoom]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
     if (e.touches.length === 2) {
         e.preventDefault(); // Prevent native browser zoom
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         
         if (containerRef.current) {
            gestureState.current = {
                startZoom: state.zoom,
                startDist: dist,
                startCenter: { x: cx, y: cy },
                startScroll: { x: containerRef.current.scrollLeft, y: containerRef.current.scrollTop }
            };
         }
     } else if (e.touches.length === 1) {
         // Single touch: Drawing
         e.preventDefault(); // Prevent scrolling
         handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
     }
  }, [state.zoom]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
      if (e.touches.length === 2 && containerRef.current) {
         e.preventDefault();
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         
         const { startZoom, startDist, startCenter, startScroll } = gestureState.current;

         // Zoom
         const scaleFactor = dist / Math.max(1, startDist);
         let newZoom = startZoom * scaleFactor;
         newZoom = Math.min(Math.max(newZoom, 0.1), 128);

         // Pan (Drag)
         // Delta of center point
         const dx = cx - startCenter.x;
         const dy = cy - startCenter.y;
         
         // Update Scroll directly for Pan (immediate feedback)
         // Note: We are not updating state for Pan, just scrolling
         containerRef.current.scrollLeft = startScroll.x - dx;
         containerRef.current.scrollTop = startScroll.y - dy;

         // For Zoom, we need to update state, but also correct scroll
         // However, doing both simultaneously (Pan+Zoom) via state + manual scroll is complex.
         // Simple approach: Trigger Zoom state update, rely on calculated scroll correction for zoom
         // But Pan is manual.
         
         // Let's defer Zoom update to prevent thrashing, OR update it.
         // If we update Zoom, container resizes, and we lose our simple Pan math.
         // We will only Zoom if distance changed significantly?
         // OR update both.
         
         // Calculate Zoom Pivot Correction similar to Wheel
         // This is hard to sync with React render cycle for smooth 60fps pinch.
         // Standard web app pinch-zoom on canvas often uses CSS transform for "preview" then commits on end.
         // Given the constraints, let's just update zoom state and rely on our center calculation.
         
         // Recalculate Scroll for Zoom centered at 'cx, cy'
         // We have manual scroll 'startScroll.x - dx'. 
         // Let's just update Zoom. The Pan might feel slightly detached if we don't compensate.
         
         // Actually, simpler 2-finger logic: 
         // 1. Calculate new Zoom.
         // 2. Adjust scroll to keep content center stable.
         
         // Only update if zoom changed enough to avoid jitter?
         if (Math.abs(newZoom - state.zoom) > 0.05) {
             const container = containerRef.current;
             const rect = container.getBoundingClientRect();
             // Center relative to container
             const mx = cx - rect.left;
             const my = cy - rect.top;
             const contentX = container.scrollLeft + mx;
             const contentY = container.scrollTop + my;
             
             const rx = contentX / (state.width * state.zoom);
             const ry = contentY / (state.height * state.zoom);
             
             const newTotalW = state.width * newZoom;
             const newTotalH = state.height * newZoom;
             
             const newScrollLeft = (newTotalW * rx) - mx - dx; // Include pan delta here?
             const newScrollTop = (newTotalH * ry) - my - dy;

             pendingScrollRef.current = { left: newScrollLeft, top: newScrollTop };
             onZoom(newZoom);
             
             // Update gesture start state to current to avoid accumulation errors
             gestureState.current.startZoom = newZoom;
             gestureState.current.startDist = dist;
             // Don't reset center/scroll as that would break the continuous drag reference
             // But resizing breaks the reference frame anyway.
         } else {
             // Just Pan
             containerRef.current.scrollLeft = startScroll.x - dx;
             containerRef.current.scrollTop = startScroll.y - dy;
         }

      } else if (e.touches.length === 1) {
          e.preventDefault();
          handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
  }, [state.zoom, state.width, state.height, onZoom]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
      // Logic to finalize or cleanup
      if (e.touches.length === 0) {
          handlePointerUp();
      }
  }, []);

  // Attach Listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // React's onWheel is passive by default, but we need preventDefault for pinch-zoom
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // -- Mouse Event Wrappers --
  const handleMouseDown = (e: React.MouseEvent) => {
      handlePointerDown(e.clientX, e.clientY, e.button);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
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
          // Use Math.round to prevent sub-pixel blurring gaps if zoom is float
          // But allow float size for smooth zoom.
          // To make it look good, we can slightly overdraw or just accept float.
          // 'fillRect' with floats does sub-pixel AA.
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
    <div 
        ref={containerRef}
        className="flex-1 bg-[oklch(0.145_0_0)] overflow-auto flex items-center justify-center relative p-8 shadow-inner border-l border-r border-background touch-none"
    >
      <canvas
        ref={canvasRef}
        width={state.width * state.zoom}
        height={state.height * state.zoom}
        className="shadow-2xl bg-white pixelated"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { setCursorPos(null); handlePointerUp(); }}
        onDoubleClick={handleDoubleClick}
        style={{
            cursor: ['rect-select', 'ellipse-select', 'lasso-select', 'poly-lasso-select', 'magic-wand'].includes(state.tool) ? 'crosshair' : (state.tool === 'move' ? 'move' : (state.tool === 'pencil' ? 'none' : 'default'))
        }}
      />
    </div>
  );
}
