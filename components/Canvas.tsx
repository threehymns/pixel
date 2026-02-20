
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { ProjectState, Position, Modifiers, PixelGrid, PixelValue } from '../types';
import { 
  drawCheckeredBackground, getIndex, getCoords,
  getRectSelection, getEllipseSelection, getPolygonSelection, getWandSelection,
  hexToRgb, getSelectionBoundingBox, rotateSelectionPixels, scaleSelectionPixels
} from '../utils';

const CURSOR_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2H14V8H10V2ZM10 16H14V22H10V16ZM2 10H8V14H2V10ZM16 10H22V14H16V10ZM10 10H14V14H10V10Z" fill="white"/></svg>`;
const CURSOR_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;

interface CanvasProps {
  state: ProjectState;
  onDrawStart: (pos: Position, modifiers: Modifiers) => void;
  onDraw: (x: number, y: number, modifiers: Modifiers) => void;
  onDrawEnd: () => void;
  onSelectionUpdate: (sel: Set<number> | null) => void;
  onMovePixels: (newSelection: Set<number>, offset: Position) => void;
  onRotatePixels: (newSelection: Set<number>, angle: number, pivot: Position) => void;
  onScalePixels: (newSelection: Set<number>, srcBox: any, destBox: any) => void;
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
  onRotatePixels,
  onScalePixels,
  onZoom,
  onMousePosUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{x: number, y: number}>({ x: -100, y: -100 });
  const touchTimeoutRef = useRef<number | null>(null);
  
  const callbacks = useRef({ onDrawStart, onDraw, onDrawEnd });
  useEffect(() => {
    callbacks.current = { onDrawStart, onDraw, onDrawEnd };
  }, [onDrawStart, onDraw, onDrawEnd]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState<Position | null>(null);
  const [polyPoints, setPolyPoints] = useState<Position[]>([]);
  const [dashOffset, setDashOffset] = useState(0);

  const [isMoving, setIsMoving] = useState(false);
  const [moveStart, setMoveStart] = useState<Position | null>(null);
  const [moveOffset, setMoveOffset] = useState<Position>({x: 0, y: 0});
  const [floatingPixels, setFloatingPixels] = useState<Map<number, PixelValue> | null>(null);

  const [isRotating, setIsRotating] = useState(false);
  const [rotationPivot, setRotationPivot] = useState<Position | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);

  const [isScaling, setIsScaling] = useState(false);
  const [scaleHandle, setScaleHandle] = useState<number | null>(null); // 0-7: TL, TC, TR, RC, BR, BC, BL, LC
  const [initialBox, setInitialBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [currentBox, setCurrentBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);

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
    if (button !== 0 && button !== -1) return; // Support touch (-1 usually or treat as 0)
    
    const coords = getPixelCoords(clientX, clientY);
    if (!coords) return;
    const { x, y } = coords;

    if (state.tool === 'move' && state.selection) {
        const box = getSelectionBoundingBox(state.selection, state.width);
        
        // Rotation Handle Check
        const rotHandleX = box.x + box.w / 2;
        const rotHandleY = box.y - 2;
        if (Math.hypot(x - rotHandleX + 0.5, y - rotHandleY + 0.5) < 1.5) {
            setIsRotating(true);
            setRotationPivot({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
            setRotationAngle(0);
            
            const frame = state.frames[state.activeFrameIndex];
            const layerData = frame.layerData[state.activeLayerId];
            if (layerData) {
              const floats = new Map<number, PixelValue>();
              state.selection.forEach(idx => floats.set(idx, layerData[idx]));
              setFloatingPixels(floats);
            }
            return;
        }

        // Scale Handle Check
        const handles = [
            {x: box.x, y: box.y}, // 0: TL
            {x: box.x + box.w/2, y: box.y}, // 1: TC
            {x: box.x + box.w, y: box.y}, // 2: TR
            {x: box.x + box.w, y: box.y + box.h/2}, // 3: RC
            {x: box.x + box.w, y: box.y + box.h}, // 4: BR
            {x: box.x + box.w/2, y: box.y + box.h}, // 5: BC
            {x: box.x, y: box.y + box.h}, // 6: BL
            {x: box.x, y: box.y + box.h/2} // 7: LC
        ];

        for (let i = 0; i < handles.length; i++) {
            if (Math.hypot(x - handles[i].x + (i===2||i===3||i===4 ? 1:0), y - handles[i].y + (i>=4&&i<=6?1:0)) < 1.2) {
                setIsScaling(true);
                setScaleHandle(i);
                setInitialBox({...box});
                setCurrentBox({...box});
                setMoveStart({x, y});

                const frame = state.frames[state.activeFrameIndex];
                const layerData = frame.layerData[state.activeLayerId];
                if (layerData) {
                  const floats = new Map<number, PixelValue>();
                  state.selection.forEach(idx => floats.set(idx, layerData[idx]));
                  setFloatingPixels(floats);
                }
                return;
            }
        }
    }

    if (state.tool === 'move' && state.selection && state.selection.has(getIndex(x, y, state.width))) {
      setIsMoving(true);
      setMoveStart({x, y});
      setMoveOffset({x: 0, y: 0});
      
      const frame = state.frames[state.activeFrameIndex];
      const layerData = frame.layerData[state.activeLayerId];
      if (layerData) {
        const floats = new Map<number, PixelValue>();
        state.selection.forEach(idx => floats.set(idx, layerData[idx]));
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

    if (isScaling && initialBox && moveStart) {
        let newBox = {...initialBox};
        const dx = x - moveStart.x;
        const dy = y - moveStart.y;

        switch (scaleHandle) {
            case 0: // TL
                newBox.x += dx; newBox.y += dy; newBox.w -= dx; newBox.h -= dy; break;
            case 1: // TC
                newBox.y += dy; newBox.h -= dy; break;
            case 2: // TR
                newBox.y += dy; newBox.w += dx; newBox.h -= dy; break;
            case 3: // RC
                newBox.w += dx; break;
            case 4: // BR
                newBox.w += dx; newBox.h += dy; break;
            case 5: // BC
                newBox.h += dy; break;
            case 6: // BL
                newBox.x += dx; newBox.w -= dx; newBox.h += dy; break;
            case 7: // LC
                newBox.x += dx; newBox.w -= dx; break;
        }

        if (modifiers.shift) {
            const ratio = initialBox.w / initialBox.h;
            if (scaleHandle === 3 || scaleHandle === 7) newBox.h = newBox.w / ratio;
            else if (scaleHandle === 1 || scaleHandle === 5) newBox.w = newBox.h * ratio;
            else {
                const currentRatio = newBox.w / newBox.h;
                if (currentRatio > ratio) newBox.w = newBox.h * ratio;
                else newBox.h = newBox.w / ratio;
            }
        }
        
        if (newBox.w < 1) newBox.w = 1;
        if (newBox.h < 1) newBox.h = 1;
        setCurrentBox(newBox);
        return;
    }

    if (isRotating && rotationPivot) {
        const angle = Math.atan2(y - rotationPivot.y, x - rotationPivot.x) + Math.PI / 2;
        setRotationAngle(angle);
        return;
    }

    if (isMoving && moveStart) {
      setMoveOffset({ x: x - moveStart.x, y: y - moveStart.y });
      return;
    }

    if (isDrawing) {
      if (state.tool === 'lasso-select') {
        setPolyPoints(prev => [...prev, { x, y }]);
      } else if (['rect-select', 'ellipse-select'].includes(state.tool)) {
      } else if (['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(state.tool)) {
        /* FIXED: Changed 'tool' to 'state.tool' to resolve Cannot find name 'tool' error */
        if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
             callbacks.current.onDraw(x, y, modifiers);
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (isScaling && initialBox && currentBox && state.selection) {
        onScalePixels(state.selection, initialBox, currentBox);
        setIsScaling(false);
        setScaleHandle(null);
        setInitialBox(null);
        setCurrentBox(null);
        setFloatingPixels(null);
        return;
    }

    if (isRotating && rotationPivot && state.selection) {
        onRotatePixels(state.selection, rotationAngle, rotationPivot);
        setIsRotating(false);
        setRotationPivot(null);
        setRotationAngle(0);
        setFloatingPixels(null);
        return;
    }

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

         if (state.tool === 'rect-select') newSel = getRectSelection(sx, sy, cx, cy, state.width);
         else if (state.tool === 'ellipse-select') newSel = getEllipseSelection(sx, sy, cx, cy, state.width);
         else if (state.tool === 'lasso-select') newSel = getPolygonSelection(polyPoints, state.width, state.height);
         combineSelection(newSel);
      } else if (['pencil', 'eraser', 'smudge', 'bucket', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(state.tool)) {
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
      case 'subtract': finalSel = new Set([...current]); newSelection.forEach(i => finalSel.delete(i)); break;
      case 'intersect': newSelection.forEach(i => { if (current.has(i)) finalSel.add(i); }); break;
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
        setPan({ x: newPanX, y: newPanY });
        onZoom(newZoom);
    } else {
        const dX = e.deltaX * (e.deltaMode === 1 ? 33 : 1);
        const dY = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
        setPan(prev => ({ x: prev.x - dX, y: prev.y - dY }));
    }
  }, [state.zoom, pan, onZoom]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
     // Cancel any pending draw trigger
     if (touchTimeoutRef.current) {
         window.clearTimeout(touchTimeoutRef.current);
         touchTimeoutRef.current = null;
     }

     if (e.touches.length >= 2) {
         e.preventDefault();
         
         // Abort any current single-finger drawing action immediately
         if (isDrawing) {
            setIsDrawing(false);
            callbacks.current.onDrawEnd();
         }

         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         gestureState.current = { startZoom: state.zoom, startDist: dist, startPan: { ...pan }, startCenter: { x: cx, y: cy } };
     } else if (e.touches.length === 1) {
         e.preventDefault();
         const t = e.touches[0];
         
         // Add a small delay (45ms) to single-finger touch down.
         // This is often enough for the hardware to report a second finger if it's a pinch.
         touchTimeoutRef.current = window.setTimeout(() => {
             handlePointerDown(t.clientX, t.clientY, { shift: false, ctrl: false, alt: false, meta: false }, -1);
             touchTimeoutRef.current = null;
         }, 45);
     }
  }, [state.zoom, pan, isDrawing, handlePointerDown]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
      if (e.touches.length >= 2) {
         e.preventDefault();
         
         // If a second finger lands, cancel the pending draw trigger if it hasn't fired yet
         if (touchTimeoutRef.current) {
            window.clearTimeout(touchTimeoutRef.current);
            touchTimeoutRef.current = null;
         }

         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const cx = (t1.clientX + t2.clientX) / 2;
         const cy = (t1.clientY + t2.clientY) / 2;
         const { startZoom, startDist, startPan, startCenter } = gestureState.current;
         const scaleFactor = dist / Math.max(1, startDist);
         let newZoom = Math.min(Math.max(startZoom * scaleFactor, 0.1), 128);
         const dx = cx - startCenter.x;
         const dy = cy - startCenter.y;
         const rect = containerRef.current!.getBoundingClientRect();
         const mx = startCenter.x - rect.left;
         const my = startCenter.y - rect.top;
         const canvasX = mx - startPan.x;
         const canvasY = my - startPan.y;
         let newPanX = mx - (canvasX / startZoom) * newZoom + dx;
         let newPanY = my - (canvasY / startZoom) * newZoom + dy;
         setPan({ x: newPanX, y: newPanY });
         onZoom(newZoom);
      } else if (e.touches.length === 1) {
          // Only move if we aren't waiting for a potential second finger
          if (!touchTimeoutRef.current) {
             e.preventDefault();
             handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, { shift: false, ctrl: false, alt: false, meta: false });
          }
      }
  }, [onZoom, handlePointerMove]);

  const handleTouchEnd = useCallback((e: TouchEvent) => { 
    if (touchTimeoutRef.current) {
        window.clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
    }
    if (e.touches.length === 0) {
        handlePointerUp(); 
    }
  }, [handlePointerUp]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement('canvas');
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== state.width || offscreen.height !== state.height) {
        offscreen.width = state.width; offscreen.height = state.height;
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
            const val = pixels[i];
            const color = typeof val === 'number' ? state.palette[val] : val;
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
      const shouldSkip = (isMoving || isRotating || isScaling) && isTargetLayer && state.selection;
      for (let i = 0; i < layerPixels.length; i++) {
         if (shouldSkip && state.selection!.has(i)) continue;
         const val = layerPixels[i];
         const color = typeof val === 'number' ? state.palette[val] : val;
         if (color) {
             const [r, g, b] = hexToRgb(color);
             const idx = i * 4;
             data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255; 
         }
      }
    });
    offCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);
    
    if (isScaling && initialBox && currentBox && floatingPixels && state.selection) {
        const tempGrid: PixelGrid = new Array(state.width * state.height).fill(null);
        floatingPixels.forEach((color, idx) => tempGrid[idx] = color);
        const scaledGrid = scaleSelectionPixels(state.selection, tempGrid, initialBox, currentBox, state.width, state.height);
        data.fill(0);
        for (let i = 0; i < scaledGrid.length; i++) {
            const val = scaledGrid[i];
            const color = typeof val === 'number' ? state.palette[val] : val;
            if (color) {
                const [r, g, b] = hexToRgb(color);
                const pIdx = i * 4;
                data[pIdx] = r; data[pIdx+1] = g; data[pIdx+2] = b; data[pIdx+3] = 255;
            }
        }
        offCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);
    } else if (isRotating && rotationPivot && floatingPixels && state.selection) {
        const tempGrid: PixelGrid = new Array(state.width * state.height).fill(null);
        floatingPixels.forEach((color, idx) => tempGrid[idx] = color);
        const rotatedGrid = rotateSelectionPixels(state.selection, tempGrid, rotationAngle, rotationPivot, state.width, state.height, state.rotationAlgorithm);
        data.fill(0);
        for (let i = 0; i < rotatedGrid.length; i++) {
            const val = rotatedGrid[i];
            const color = typeof val === 'number' ? state.palette[val] : val;
            if (color) {
                const [r, g, b] = hexToRgb(color);
                const pIdx = i * 4;
                data[pIdx] = r; data[pIdx+1] = g; data[pIdx+2] = b; data[pIdx+3] = 255;
            }
        }
        offCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreen, 0, 0, state.width * state.zoom, state.height * state.zoom);
    } else if (isMoving && floatingPixels) {
      data.fill(0);
      floatingPixels.forEach((val, idx) => {
         const color = typeof val === 'number' ? state.palette[val] : val;
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= state.width; x++) { ctx.moveTo(x * state.zoom, 0); ctx.lineTo(x * state.zoom, state.height * state.zoom); }
      for (let y = 0; y <= state.height; y++) { ctx.moveTo(0, y * state.zoom); ctx.lineTo(state.width * state.zoom, y * state.zoom); }
      ctx.stroke();
    }

    if (state.symmetry.x || state.symmetry.y) {
        ctx.save(); ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
        if (state.symmetry.x) { const x = (state.width / 2) * state.zoom; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.height * state.zoom); ctx.stroke(); }
        if (state.symmetry.y) { const y = (state.height / 2) * state.zoom; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width * state.zoom, y); ctx.stroke(); }
        ctx.restore();
    }
    
    if (state.selection && state.selection.size > 0) {
      ctx.save();
      const z = state.zoom;
      
      if (isScaling && currentBox) {
          ctx.beginPath();
          ctx.rect(currentBox.x * z, currentBox.y * z, currentBox.w * z, currentBox.h * z);
          ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffset; ctx.stroke();
          ctx.strokeStyle = '#000'; ctx.lineDashOffset = -dashOffset + 4; ctx.stroke();
      } else {
          if (isRotating && rotationPivot) {
            const px = rotationPivot.x * z; const py = rotationPivot.y * z;
            ctx.translate(px, py); ctx.rotate(rotationAngle); ctx.translate(-px, -py);
          }
          
          ctx.beginPath(); ctx.lineWidth = 1;
          const ox = (isMoving && !isRotating) ? moveOffset.x : 0;
          const oy = (isMoving && !isRotating) ? moveOffset.y : 0;
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

      if (state.tool === 'move' && !isMoving) {
          const box = isScaling && currentBox ? currentBox : getSelectionBoundingBox(state.selection, state.width);
          
          if (!isScaling) {
              const hx = (box.x + box.w / 2) * z;
              const hy = (box.y - 1.5) * z;
              ctx.setLineDash([]); ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(hx, box.y * z); ctx.lineTo(hx, hy); ctx.stroke();
              ctx.fillStyle = isRotating ? 'white' : 'rgba(255,255,255,0.8)';
              ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'black'; ctx.stroke();
          }

          // Render Transformation Handles
          const hs = 3; // Handle half-size in pixels
          const handles = [
              {x: box.x, y: box.y}, // TL
              {x: box.x + box.w/2, y: box.y}, // TC
              {x: box.x + box.w, y: box.y}, // TR
              {x: box.x + box.w, y: box.y + box.h/2}, // RC
              {x: box.x + box.w, y: box.y + box.h}, // BR
              {x: box.x + box.w/2, y: box.y + box.h}, // BC
              {x: box.x, y: box.y + box.h}, // BL
              {x: box.x, y: box.y + box.h/2} // LC
          ];

          ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.setLineDash([]);
          handles.forEach(h => {
              ctx.fillRect(h.x * z - hs, h.y * z - hs, hs*2, hs*2);
              ctx.strokeRect(h.x * z - hs, h.y * z - hs, hs*2, hs*2);
          });
      }
      ctx.restore();
    }

    if (isDrawing && startPos && cursorPos) {
        ctx.strokeStyle = 'white'; ctx.setLineDash([4, 4]);
        const x = startPos.x * state.zoom; const y = startPos.y * state.zoom;
        const w = (cursorPos.x - startPos.x + (cursorPos.x >= startPos.x ? 1 : 0)) * state.zoom;
        const h = (cursorPos.y - startPos.y + (cursorPos.y >= startPos.y ? 1 : 0)) * state.zoom;
        if (state.tool === 'rect-select') ctx.strokeRect(Math.min(x, x+w), Math.min(y, y+h), Math.abs(w), Math.abs(h));
        else if (state.tool === 'ellipse-select') { ctx.beginPath(); ctx.ellipse(Math.min(x, x+w) + Math.abs(w)/2, Math.min(y, y+h) + Math.abs(h)/2, Math.abs(w)/2, Math.abs(h)/2, 0, 0, 2 * Math.PI); ctx.stroke(); }
        ctx.setLineDash([]);
    }

    if (polyPoints.length > 0) {
        ctx.strokeStyle = 'white'; ctx.setLineDash([4, 4]); ctx.beginPath();
        const z = state.zoom; ctx.moveTo(polyPoints[0].x * z + z/2, polyPoints[0].y * z + z/2);
        for(let i=1; i<polyPoints.length; i++) ctx.lineTo(polyPoints[i].x * z + z/2, polyPoints[i].y * z + z/2);
        if (cursorPos && (state.tool === 'lasso-select' || state.tool === 'poly-lasso-select')) ctx.lineTo(cursorPos.x * z + z/2, cursorPos.y * z + z/2);
        ctx.stroke(); ctx.setLineDash([]);
    }

    const isBrushTool = ['pencil', 'eraser', 'smudge', 'blur', 'sharpen'].includes(state.tool);
    const isOtherToolWithPreview = ['bucket', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'eyedropper'].includes(state.tool);

    if (cursorPos && !isMoving && !isRotating && !isScaling && (isBrushTool || (!isDrawing && isOtherToolWithPreview))) {
        const { x, y } = cursorPos;
        const size = (state.tool === 'bucket' || state.tool === 'eyedropper') ? 1 : state.brushSize;
        const startOffset = Math.floor(size / 2);
        const radiusSq = Math.pow(size / 2 - 0.1, 2);
        const z = state.zoom;
        const variants = [{ x, y }];
        if (state.symmetry.x) variants.push({ x: state.width - 1 - x, y: y });
        if (state.symmetry.y) variants.push({ x: x, y: state.height - 1 - y });
        if (state.symmetry.x && state.symmetry.y) variants.push({ x: state.width - 1 - x, y: state.height - 1 - y });

        ctx.beginPath();
        variants.forEach(variant => {
            const brushPixels = new Set<number>();
            for (let dx = 0; dx < size; dx++) {
                for (let dy = 0; dy < size; dy++) {
                    let inBrush = true;
                    if (state.brushShape === 'circle' && size > 1 && !['bucket', 'eyedropper'].includes(state.tool)) {
                        const cx = dx - (size - 1) / 2; const cy = dy - (size - 1) / 2;
                        if (cx * cx + cy * cy > radiusSq) inBrush = false;
                    }
                    if (inBrush) {
                        const px = variant.x - startOffset + dx; const py = variant.y - startOffset + dy;
                        if (px >= 0 && px < state.width && py >= 0 && py < state.height) brushPixels.add(getIndex(px, py, state.width));
                    }
                }
            }
            brushPixels.forEach(idx => {
               const { x: px, y: py } = getCoords(idx, state.width);
               if (!brushPixels.has(getIndex(px, py - 1, state.width))) { ctx.moveTo(px * z, py * z); ctx.lineTo((px + 1) * z, py * z); }
               if (!brushPixels.has(getIndex(px, py + 1, state.width))) { ctx.moveTo(px * z, (py + 1) * z); ctx.lineTo((px + 1) * z, (py + 1) * z); }
               if (!brushPixels.has(getIndex(px - 1, py, state.width))) { ctx.moveTo(px * z, py * z); ctx.lineTo(px * z, (py + 1) * z); }
               if (!brushPixels.has(getIndex(px + 1, py, state.width))) { ctx.moveTo((px + 1) * z, py * z); ctx.lineTo((px + 1) * z, (py + 1) * z); }
            });
        });
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }, [state, cursorPos, dashOffset, startPos, polyPoints, isMoving, isDrawing, moveOffset, floatingPixels, isRotating, rotationAngle, rotationPivot, isScaling, currentBox]);

  return (
    <div 
        ref={containerRef}
        className="w-full h-full flex-1 bg-[oklch(0.145_0_0)] overflow-hidden relative shadow-inner border-l border-r border-background touch-none"
        style={{ cursor: 'none' }}
        onMouseEnter={(e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; setShowCursor(true); }}
        onMouseLeave={() => { setShowCursor(false); setCursorPos(null); if (onMousePosUpdate) onMousePosUpdate(null); handlePointerUp(); }}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY, getModifiers(e), e.button)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY, getModifiers(e))}
        onMouseUp={handlePointerUp}
        onDoubleClick={() => { if (state.tool === 'poly-lasso-select' && polyPoints.length > 2) { combineSelection(getPolygonSelection(polyPoints, state.width, state.height)); setPolyPoints([]); } }}
    >
      <canvas
        ref={canvasRef}
        width={state.width * state.zoom}
        height={state.height * state.zoom}
        className="shadow-2xl bg-white pixelated"
        style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'top left', cursor: 'none', pointerEvents: 'none' }}
      />
      {showCursor && (
        <div ref={cursorRef} className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference hidden md:block" style={{ width: '24px', height: '24px', marginLeft: '-12px', marginTop: '-12px', backgroundImage: `url('${CURSOR_URI}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', transform: `translate(${mousePosRef.current.x}px, ${mousePosRef.current.y}px)` }} />
      )}
    </div>
  );
}
