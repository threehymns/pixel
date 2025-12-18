
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { ProjectState, Position, Modifiers } from '../types';
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
  onDrawStart: (pos: Position, modifiers: Modifiers) => void;
  onDraw: (x: number, y: number, modifiers: Modifiers) => void;
  onDrawEnd: () => void;
  onSelectionUpdate: (sel: Set<number> | null) => void;
  onMovePixels: (newSelection: Set<number>, offset: Position) => void;
  onZoom: (zoom: number) => void;
  onMousePosUpdate?: (pos: Position | null) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  state, 
  onDrawStart, 
  onDraw, 
  onDrawEnd,
  onSelectionUpdate,
  onMovePixels,
  onZoom,
  onMousePosUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{x: number, y: number}>({ x: -100, y: -100 });
  
  // Use refs for callbacks to avoid stale closures in event listeners
  const callbacks = useRef({ onDrawStart, onDraw, onDrawEnd });
  useEffect(() => {
    callbacks.current = { onDrawStart, onDraw, onDrawEnd };
  }, [onDrawStart, onDraw, onDrawEnd]);

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
  }, [state.id]);

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

  const getModifiers = (e: React.PointerEvent | React.MouseEvent | TouchEvent): Modifiers => {
    return {
      shift: (e as any).shiftKey || false,
      ctrl: (e as any).ctrlKey || false,
      alt: (e as any).altKey || false,
      meta: (e as any).metaKey || false,
    };
  };

  const handlePointerDown = (clientX: number, clientY: number, modifiers: Modifiers, button: number = 0) => {
    if (button !== 0) return;
    
    const coords = getPixelCoords(clientX, clientY);
    if (!coords) return;
    const { x, y } = coords;

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
      const pos = { x, y };
      setStartPos(pos);
      callbacks.current.onDrawStart(pos, modifiers);
      if (state.tool === 'lasso-select') setPolyPoints([pos]);
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

    if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
      setIsDrawing(true);
      callbacks.current.onDrawStart({x, y}, modifiers);
      callbacks.current.onDraw(x, y, modifiers);
    }
  };

  const handlePointerMove = (clientX: number, clientY: number, modifiers: Modifiers) => {
    updateCustomCursor(clientX, clientY);
    
    const coords = getPixelCoords(clientX, clientY);
    setCursorPos(coords);
    if (onMousePosUpdate) onMousePosUpdate(coords);
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
      } else if (['pencil', 'eraser', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(state.tool)) {
        if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
             callbacks.current.onDraw(x, y, modifiers);
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
      } else if (['pencil', 'eraser', 'bucket', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(state.tool)) {
        callbacks.current.onDrawEnd();
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setPolyPoints([]);
    callbacks.current.onDrawEnd();
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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    if (e.ctrlKey) {
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cx = mx - pan.x;
        const cy = my - pan.y;
        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 33;
        const ZOOM_SPEED = 0.006;
        const newZoom = Math.min(Math.max(state.zoom * Math.exp(-delta * ZOOM_SPEED), 0.1), 128);
        let newPanX = mx - (cx / state.zoom) * newZoom;
        let newPanY = my - (cy / state.zoom) * newZoom;
        if (e.deltaX !== 0) {
            let dx = e.deltaX;
            if (e.deltaMode === 1) dx *= 33;
            newPanX -= dx;
        }
        setPan({ x: newPanX, y: newPanY });
        onZoom(newZoom);
    } else {
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
         e.preventDefault();
         handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, { shift: false, ctrl: false, alt: false, meta: false });
     }
  }, [state.zoom, pan, state.tool, state.width, state.height, state.activeFrameIndex, state.activeLayerId]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
      if (e.touches.length === 2) {
         e.preventDefault();
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         const { startZoom, startDist, startPan, startCenter } = gestureState.current;
         const scaleFactor = dist / Math.max(1, startDist);
         let newZoom = startZoom * scaleFactor;
         newZoom = Math.min(Math.max(newZoom, 0.1), 128);
         const dx = cx - startCenter.x;
         const dy = cy - startCenter.y;
         const rect = containerRef.current!.getBoundingClientRect();
         const mx = startCenter.x - rect.left;
         const my = startCenter.y - rect.top;
         const canvasX = mx - startPan.x;
         const canvasY = my - startPan.y;
         let newPanX = mx - (canvasX / startZoom) * newZoom;
         let newPanY = my - (canvasY / startZoom) * newZoom;
         newPanX += dx;
         newPanY += dy;
         setPan({ x: newPanX, y: newPanY });
         onZoom(newZoom);
      } else if (e.touches.length === 1) {
          e.preventDefault();
          handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, { shift: false, ctrl: false, alt: false, meta: false });
      }
  }, [onZoom]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
      if (e.touches.length === 0) {
          handlePointerUp();
      }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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

  const handleMouseDown = (e: React.MouseEvent) => {
      handlePointerDown(e.clientX, e.clientY, getModifiers(e), e.button);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY, getModifiers(e));
  };

  const handleDoubleClick = () => {
    if (state.tool === 'poly-lasso-select' && polyPoints.length > 2) {
      const newSel = getPolygonSelection(polyPoints, state.width, state.height);
      combineSelection(newSel);
      setPolyPoints([]);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
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
    const imgData = offCtx.createImageData(state.width, state.height);
    const data = imgData.data;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCheckeredBackground(ctx, state.width, state.height, state.zoom);
    if (state.onionSkin && state.activeFrameIndex > 0) {
      const prevFrame = state.frames[state.activeFrameIndex - 1];
      data.fill(0);
      state.layers.forEach(layer => {
        if (!layer.visible) return;
        const pixels = prevFrame.layerData[layer.id];
        if (!pixels) return;
        for (let i = 0; i < pixels.length; i++) {
            const color = pixels[i];
            if (color) {
                const [r, g, b] = hexToRgb(color);
                const idx = i * 4;
                data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255; 
            }
        }
      });
      offCtx.putImageData(imgData, 0, 0);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);
      ctx.globalAlpha = 1.0;
    }
    data.fill(0);
    const currentFrame = state.frames[state.activeFrameIndex];
    state.layers.forEach((layer) => {
      if (!layer.visible) return;
      const layerPixels = currentFrame.layerData[layer.id];
      if (!layerPixels) return;
      const isTargetLayer = layer.id === state.activeLayerId;
      const shouldSkip = isMoving && isTargetLayer && state.selection;
      for (let i = 0; i < layerPixels.length; i++) {
         if (shouldSkip && state.selection!.has(i)) continue;
         const color = layerPixels[i];
         if (color) {
             const [r, g, b] = hexToRgb(color);
             const idx = i * 4;
             data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255; 
         }
      }
    });
    offCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);
    if (isMoving && floatingPixels) {
      data.fill(0);
      floatingPixels.forEach((color, idx) => {
         if (color) {
            const [r, g, b] = hexToRgb(color);
            const pIdx = idx * 4;
            data[pIdx] = r; data[pIdx+1] = g; data[pIdx+2] = b; data[pIdx+3] = 255;
         }
      });
      offCtx.putImageData(imgData, 0, 0);
      const dx = moveOffset.x * state.zoom;
      const dy = moveOffset.y * state.zoom;
      ctx.drawImage(offscreen, 0, 0, state.width, state.height, dx, dy, state.width * state.zoom, state.height * state.zoom);
    }
    if (state.showGrid && state.zoom > 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= state.width; x++) { ctx.moveTo(x * state.zoom, 0); ctx.lineTo(x * state.zoom, state.height * state.zoom); }
      for (let y = 0; y <= state.height; y++) { ctx.moveTo(0, y * state.zoom); ctx.lineTo(state.width * state.zoom, y * state.zoom); }
      ctx.stroke();
    }
    if (state.selection && state.selection.size > 0) {
      ctx.beginPath(); ctx.lineWidth = 1;
      const z = state.zoom;
      const ox = isMoving ? moveOffset.x : 0;
      const oy = isMoving ? moveOffset.y : 0;
      state.selection.forEach(idx => {
         const { x, y } = getCoords(idx, state.width);
         const dx = x + ox; const dy = y + oy;
         if (y===0 || !state.selection!.has(idx - state.width)) { ctx.moveTo(dx*z, dy*z); ctx.lineTo((dx+1)*z, dy*z); }
         if (y===state.height-1 || !state.selection!.has(idx + state.width)) { ctx.moveTo(dx*z, (dy+1)*z); ctx.lineTo((dx + 1)*z, (dy+1)*z); }
         if (x===0 || !state.selection!.has(idx - 1)) { ctx.moveTo(dx*z, dy*z); ctx.lineTo(dx*z, (dy+1)*z); }
         if (x===state.width-1 || !state.selection!.has(idx + 1)) { ctx.moveTo((dx+1)*z, dy*z); ctx.lineTo((dx+1)*z, (dy+1)*z); }
      });
      ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffset; ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.lineDashOffset = -dashOffset + 4; ctx.stroke(); ctx.setLineDash([]);
    }
    if (isDrawing && startPos && cursorPos) {
        ctx.strokeStyle = 'white'; ctx.setLineDash([4, 4]);
        const x = startPos.x * state.zoom; const y = startPos.y * state.zoom;
        const w = (cursorPos.x - startPos.x + (cursorPos.x >= startPos.x ? 1 : 0)) * state.zoom;
        const h = (cursorPos.y - startPos.y + (cursorPos.y >= startPos.y ? 1 : 0)) * state.zoom;
        if (state.tool === 'rect-select') { ctx.strokeRect(Math.min(x, x+w), Math.min(y, y+h), Math.abs(w), Math.abs(h)); }
        else if (state.tool === 'ellipse-select') { ctx.beginPath(); ctx.ellipse(Math.min(x, x+w) + Math.abs(w)/2, Math.min(y, y+h) + Math.abs(h)/2, Math.abs(w)/2, Math.abs(h)/2, 0, 0, 2 * Math.PI); ctx.stroke(); }
        ctx.setLineDash([]);
    }
    if (polyPoints.length > 0) {
        ctx.strokeStyle = 'white'; ctx.setLineDash([4, 4]); ctx.beginPath();
        const z = state.zoom;
        ctx.moveTo(polyPoints[0].x * z + z/2, polyPoints[0].y * z + z/2);
        for(let i=1; i<polyPoints.length; i++) ctx.lineTo(polyPoints[i].x * z + z/2, polyPoints[i].y * z + z/2);
        if (cursorPos && (state.tool === 'lasso-select' || state.tool === 'poly-lasso-select')) { ctx.lineTo(cursorPos.x * z + z/2, cursorPos.y * z + z/2); }
        ctx.stroke(); ctx.setLineDash([]);
        if (state.tool === 'poly-lasso-select') { ctx.fillStyle = 'yellow'; polyPoints.forEach(p => ctx.fillRect(p.x*z, p.y*z, z, z)); }
    }
    if (cursorPos && !isDrawing && !isMoving && ['pencil', 'eraser', 'bucket', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(state.tool)) {
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
        onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; setShowCursor(true); }}
        onMouseLeave={() => { setShowCursor(false); setCursorPos(null); if (onMousePosUpdate) onMousePosUpdate(null); handlePointerUp(); }}
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
        style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'top left', cursor: 'none', pointerEvents: 'none' }}
      />
      {showCursor && (
        <div ref={cursorRef} className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference" style={{ width: '24px', height: '24px', marginLeft: '-12px', marginTop: '-12px', backgroundImage: `url('${CURSOR_URI}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', transform: `translate(${mousePosRef.current.x}px, ${mousePosRef.current.y}px)` }} />
      )}
    </div>
  );
}
