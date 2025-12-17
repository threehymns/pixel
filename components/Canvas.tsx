
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { ProjectState, Position } from '../types';
import { 
  drawCheckeredBackground, getIndex, getCoords,
  getRectSelection, getEllipseSelection, getPolygonSelection, getWandSelection,
  hexToRgb
} from '../utils';

// Inline Cursor SVG to ensure it loads without 404s
const CURSOR_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2H14V8H10V2ZM10 16H14V22H10V16ZM2 10H8V14H2V10ZM16 10H22V14H16V10ZM10 10H14V14H10V10Z" fill="white"/></svg>`;
const CURSOR_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;

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
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{x: number, y: number}>({ x: -100, y: -100 }); // Track raw mouse pos
  
  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  
  // Viewport State (Pan)
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });

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
      startPan: { x: 0, y: 0 },
      startCenter: { x: 0, y: 0 }
  });
  
  // Center Canvas on Load / Project Change
  useLayoutEffect(() => {
    if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const contentW = state.width * state.zoom;
        const contentH = state.height * state.zoom;
        setPan({
            x: (clientWidth - contentW) / 2,
            y: (clientHeight - contentH) / 2
        });
    }
  }, [state.id]); // Only re-center when project ID changes

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

  const getPixelCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = state.zoom;
    const x = Math.floor((clientX - rect.left) / scale);
    const y = Math.floor((clientY - rect.top) / scale);
    return { x, y };
  }, [state.zoom]);

  const updateCustomCursor = (clientX: number, clientY: number) => {
    mousePosRef.current = { x: clientX, y: clientY };
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${clientX}px, ${clientY}px)`;
    }
  };

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
    updateCustomCursor(clientX, clientY);
    
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
         
         // Clamp coordinates to canvas bounds to avoid wrapping artifacts
         const clamp = (val: number, max: number) => Math.max(0, Math.min(max - 1, val));
         
         const sx = clamp(startPos.x, state.width);
         const sy = clamp(startPos.y, state.height);
         const cx = clamp(cursorPos.x, state.width);
         const cy = clamp(cursorPos.y, state.height);

         if (state.tool === 'rect-select') {
           newSel = getRectSelection(sx, sy, cx, cy, state.width);
         } else if (state.tool === 'ellipse-select') {
           newSel = getEllipseSelection(sx, sy, cx, cy, state.width);
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
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    if (e.ctrlKey) {
        // Zoom (Trackpad Pinch or Ctrl+Wheel)
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Position relative to canvas before zoom
        const cx = mx - pan.x;
        const cy = my - pan.y;

        // Normalize delta
        let delta = e.deltaY;
        // Approximation for deltaMode: 1 (line) ~ 33px
        if (e.deltaMode === 1) delta *= 33;
        
        // Faster zoom sensitivity (Exponential)
        const ZOOM_SPEED = 0.006;
        const newZoom = Math.min(Math.max(state.zoom * Math.exp(-delta * ZOOM_SPEED), 0.1), 128);

        // Calculate new pan to keep mouse over same pixel
        let newPanX = mx - (cx / state.zoom) * newZoom;
        let newPanY = my - (cy / state.zoom) * newZoom;

        // Allow additional horizontal panning if present during pinch
        if (e.deltaX !== 0) {
            let dx = e.deltaX;
            if (e.deltaMode === 1) dx *= 33;
            newPanX -= dx;
        }

        setPan({ x: newPanX, y: newPanY });
        onZoom(newZoom);
    } else {
        // Pan (Trackpad 2-finger scroll or Wheel)
        const dX = e.deltaX * (e.deltaMode === 1 ? 33 : 1);
        const dY = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
        
        setPan(prev => ({ x: prev.x - dX, y: prev.y - dY }));
    }
  }, [state.zoom, pan, onZoom]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
     if (e.touches.length === 2) {
         e.preventDefault();
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         
         gestureState.current = {
            startZoom: state.zoom,
            startDist: dist,
            startPan: { ...pan },
            startCenter: { x: cx, y: cy }
         };
     } else if (e.touches.length === 1) {
         // Single touch: Drawing
         e.preventDefault();
         handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
     }
  }, [state.zoom, pan]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
      if (e.touches.length === 2) {
         e.preventDefault();
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         
         const { startZoom, startDist, startPan, startCenter } = gestureState.current;

         // Zoom
         const scaleFactor = dist / Math.max(1, startDist);
         let newZoom = startZoom * scaleFactor;
         newZoom = Math.min(Math.max(newZoom, 0.1), 128);

         // Pan
         // Current center of fingers - Start center of fingers
         const dx = cx - startCenter.x;
         const dy = cy - startCenter.y;

         // Adjust pan for the zoom (zoom towards center)
         
         // Container Rect
         const rect = containerRef.current!.getBoundingClientRect();
         const mx = startCenter.x - rect.left;
         const my = startCenter.y - rect.top;
         
         const canvasX = mx - startPan.x;
         const canvasY = my - startPan.y;
         
         let newPanX = mx - (canvasX / startZoom) * newZoom;
         let newPanY = my - (canvasY / startZoom) * newZoom;
         
         // Add drag
         newPanX += dx;
         newPanY += dy;

         setPan({ x: newPanX, y: newPanY });
         onZoom(newZoom);

      } else if (e.touches.length === 1) {
          e.preventDefault();
          handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
  }, [onZoom]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
      if (e.touches.length === 0) {
          handlePointerUp();
      }
  }, []);

  // Attach Listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Non-passive listeners to prevent browser default behavior (pinch-to-zoom page, history swipe)
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

    // Ensure offscreen buffer exists and is correct size
    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== state.width || offscreen.height !== state.height) {
        offscreen.width = state.width;
        offscreen.height = state.height;
    }
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Prepare ImageData
    const imgData = offCtx.createImageData(state.width, state.height);
    const data = imgData.data; // Uint8ClampedArray

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCheckeredBackground(ctx, state.width, state.height, state.zoom);

    // --- 1. Onion Skin ---
    if (state.onionSkin && state.activeFrameIndex > 0) {
      const prevFrame = state.frames[state.activeFrameIndex - 1];
      
      data.fill(0); // Clear buffer

      state.layers.forEach(layer => {
        if (!layer.visible) return;
        const pixels = prevFrame.layerData[layer.id];
        if (!pixels) return;

        for (let i = 0; i < pixels.length; i++) {
            const color = pixels[i];
            if (color) {
                const [r, g, b] = hexToRgb(color);
                const idx = i * 4;
                data[idx] = r;
                data[idx+1] = g;
                data[idx+2] = b;
                data[idx+3] = 255; 
            }
        }
      });
      
      offCtx.putImageData(imgData, 0, 0);
      
      ctx.globalAlpha = 0.3;
      ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);
      ctx.globalAlpha = 1.0;
    }

    // --- 2. Active Frame ---
    data.fill(0); // Clear buffer

    const currentFrame = state.frames[state.activeFrameIndex];
    state.layers.forEach((layer) => {
      if (!layer.visible) return;
      const layerPixels = currentFrame.layerData[layer.id];
      if (!layerPixels) return;

      const isTargetLayer = layer.id === state.activeLayerId;
      const shouldSkip = isMoving && isTargetLayer && state.selection;

      for (let i = 0; i < layerPixels.length; i++) {
         if (shouldSkip && state.selection!.has(i)) continue; // Mask moved pixels

         const color = layerPixels[i];
         if (color) {
             const [r, g, b] = hexToRgb(color);
             const idx = i * 4;
             data[idx] = r;
             data[idx+1] = g;
             data[idx+2] = b;
             data[idx+3] = 255; 
         }
      }
    });

    offCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);

    // --- 3. Floating Pixels (Move Tool) ---
    if (isMoving && floatingPixels) {
      data.fill(0); // Clear buffer
      
      floatingPixels.forEach((color, idx) => {
         if (color) {
            const [r, g, b] = hexToRgb(color);
            // Write to buffer at original position (0..width*height)
            const pIdx = idx * 4;
            data[pIdx] = r;
            data[pIdx+1] = g;
            data[pIdx+2] = b;
            data[pIdx+3] = 255;
         }
      });
      offCtx.putImageData(imgData, 0, 0);

      const dx = moveOffset.x * state.zoom;
      const dy = moveOffset.y * state.zoom;
      
      // Draw buffer shifted
      ctx.drawImage(offscreen, 
        0, 0, state.width, state.height,
        dx, dy, state.width * state.zoom, state.height * state.zoom
      );
    }

    // --- 4. Grid ---
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

    // --- 5. Selection Marching Ants ---
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

    // --- 6. Drag Shape Preview ---
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
    
    // --- 7. Poly/Lasso Preview ---
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

    // --- 8. Brush Preview ---
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
        className="flex-1 bg-[oklch(0.145_0_0)] overflow-hidden relative shadow-inner border-l border-r border-background touch-none"
        style={{ cursor: 'none' }}
        onMouseEnter={(e) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            setShowCursor(true);
        }}
        onMouseLeave={() => { setShowCursor(false); setCursorPos(null); handlePointerUp(); }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
    >
      <canvas
        ref={canvasRef}
        width={state.width * state.zoom}
        height={state.height * state.zoom}
        className="shadow-2xl bg-white pixelated"
        style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'top left',
            cursor: 'none',
            pointerEvents: 'none'
        }}
      />
      
      {/* Custom DOM Cursor to achieve blended inversion */}
      {showCursor && (
        <div 
            ref={cursorRef}
            className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
            style={{
                width: '24px',
                height: '24px',
                marginLeft: '-12px',
                marginTop: '-12px',
                backgroundImage: `url('${CURSOR_URI}')`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                transform: `translate(${mousePosRef.current.x}px, ${mousePosRef.current.y}px)`,
            }}
        />
      )}
    </div>
  );
}
