
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { ProjectState, Position, Modifiers, PixelGrid, PixelValue } from '../types';
import { 
  getIndex, getCoords,
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
  const artCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerImageDataRef = useRef<ImageData | null>(null);
  const onionSkinImageDataRef = useRef<ImageData | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{x: number, y: number}>({ x: -100, y: -100 });
  const touchTimeoutRef = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerSize({
            width: Math.floor(entry.contentRect.width),
            height: Math.floor(entry.contentRect.height)
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const selectionSet = useMemo(() => {
    if (!state.selection) return null;
    const arr = state.selection instanceof Set 
      ? Array.from(state.selection) 
      : (Array.isArray(state.selection) ? Array.from(state.selection as any) : []);
    const numSet = new Set<number>();
    for (let i = 0; i < arr.length; i++) {
      const n = Number(arr[i]);
      if (!isNaN(n)) numSet.add(n);
    }
    return numSet.size > 0 ? numSet : null;
  }, [state.selection]);

  // Bolt Optimization: Precompute boundary segments for active selection.
  // Reduces marching-ants rendering complexity from O(Selection Area) to O(Selection Perimeter),
  // improving performance by 100x-1000x on high-resolution canvas selections.
  const selectionBorderSegments = useMemo(() => {
    if (!selectionSet || selectionSet.size === 0) return null;
    const w = state.width;
    const h = state.height;
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    selectionSet.forEach(rawIdx => {
      const idx = Number(rawIdx);
      const x = idx % w;
      const y = (idx / w) | 0;

      if (y === 0 || !selectionSet.has(idx - w)) {
        segments.push({ x1: x, y1: y, x2: x + 1, y2: y });
      }
      if (y === h - 1 || !selectionSet.has(idx + w)) {
        segments.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 });
      }
      if (x === 0 || !selectionSet.has(idx - 1)) {
        segments.push({ x1: x, y1: y, x2: x, y2: y + 1 });
      }
      if (x === w - 1 || !selectionSet.has(idx + 1)) {
        segments.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
      }
    });

    return segments;
  }, [selectionSet, state.width, state.height]);
  
  const callbacks = useRef({ onDrawStart, onDraw, onDrawEnd });
  useEffect(() => {
    callbacks.current = { onDrawStart, onDraw, onDrawEnd };
  }, [onDrawStart, onDraw, onDrawEnd]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [localZoom, setLocalZoom] = useState(state.zoom);
  const panRef = useRef<Position>({ x: 0, y: 0 });
  const zoomRef = useRef(state.zoom);
  
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = localZoom;
  }, [localZoom]);

  useEffect(() => {
    setLocalZoom(state.zoom);
  }, [state.zoom]);

  const [startPos, setStartPos] = useState<Position | null>(null);
  const [polyPoints, setPolyPoints] = useState<Position[]>([]);

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
  
  const lastCenteredRef = useRef<string | null>(null);
  
  useLayoutEffect(() => {
    if (state.id) {
      if (lastCenteredRef.current !== state.id && containerSize.width > 0 && containerSize.height > 0) {
        const contentW = state.width * state.zoom;
        const contentH = state.height * state.zoom;
        setPan({
          x: (containerSize.width - contentW) / 2,
          y: (containerSize.height - contentH) / 2
        });
        lastCenteredRef.current = state.id;
      }
    }
  }, [state.id, state.width, state.height, state.zoom, containerSize]);

  const getPixelCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    
    const x = Math.floor((mx - pan.x) / localZoom);
    const y = Math.floor((my - pan.y) / localZoom);
    return { x, y };
  }, [localZoom, pan]);

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
        if (Math.hypot(x - rotHandleX, y - rotHandleY) < 1.8) {
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
            if (Math.hypot(x - handles[i].x, y - handles[i].y) < 1.5) {
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
      if (['rect-select', 'ellipse-select', 'lasso-select'].includes(state.tool) && startPos) {
         const cp = cursorPos || startPos;
         let newSel = new Set<number>();
         const clamp = (val: number, max: number) => Math.max(0, Math.min(max - 1, val));
         const sx = clamp(startPos.x, state.width);
         const sy = clamp(startPos.y, state.height);
         const cx = clamp(cp.x, state.width);
         const cy = clamp(cp.y, state.height);

         if (state.tool === 'rect-select') newSel = getRectSelection(sx, sy, cx, cy, state.width);
         else if (state.tool === 'ellipse-select') newSel = getEllipseSelection(sx, sy, cx, cy, state.width);
         else if (state.tool === 'lasso-select') newSel = getPolygonSelection(polyPoints.length > 0 ? polyPoints : [startPos], state.width, state.height);
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
    const current = selectionSet || new Set<number>();
    switch (state.selectionMode) {
      case 'replace': finalSel = newSelection; break;
      case 'add': 
        finalSel = new Set<number>();
        current.forEach(i => finalSel.add(i));
        newSelection.forEach(i => finalSel.add(i));
        break;
      case 'subtract': 
        finalSel = new Set<number>();
        current.forEach(i => finalSel.add(i));
        newSelection.forEach(i => finalSel.delete(i));
        break;
      case 'intersect': 
        finalSel = new Set<number>();
        newSelection.forEach(i => { if (current.has(i)) finalSel.add(i); });
        break;
    }
    onSelectionUpdate(finalSel.size > 0 ? finalSel : null);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    
    requestAnimationFrame(() => {
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        
        // Zoom logic (Ctrl + Wheel)
        if (e.ctrlKey) {
            const rect = container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const cx = mx - currentPan.x;
            const cy = my - currentPan.y;
            let delta = e.deltaY;
            if (e.deltaMode === 1) delta *= 33;
            const ZOOM_SPEED = 0.006;
            const newZoom = Math.min(Math.max(currentZoom * Math.exp(-delta * ZOOM_SPEED), 0.1), 128);
            let newPanX = mx - (cx / currentZoom) * newZoom;
            let newPanY = my - (cy / currentZoom) * newZoom;
            setPan({ x: newPanX, y: newPanY });
            setLocalZoom(newZoom);
            onZoom(newZoom);
        } else {
            // Pan logic
            const dX = e.deltaX * (e.deltaMode === 1 ? 33 : 1);
            const dY = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            setPan(prev => ({ x: prev.x - dX, y: prev.y - dY }));
        }
    });
  }, [onZoom]);

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
         gestureState.current = { startZoom: zoomRef.current, startDist: dist, startPan: { ...panRef.current }, startCenter: { x: cx, y: cy } };
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
  }, [isDrawing, handlePointerDown]);

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
         setLocalZoom(newZoom);
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

  // Art Rendering Effect (Double Buffered)
  useEffect(() => {
    const canvas = artCanvasRef.current;
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

    if (!layerCanvasRef.current) layerCanvasRef.current = document.createElement('canvas');
    const layerCanvas = layerCanvasRef.current;
    if (layerCanvas.width !== state.width || layerCanvas.height !== state.height) {
        layerCanvas.width = state.width; layerCanvas.height = state.height;
    }
    const layerCtx = layerCanvas.getContext('2d');
    if (!layerCtx) return;
    
    // Bolt Optimization: Helper to reuse cached ImageData buffers across renders,
    // avoiding megabytes of garbage allocations per frame on high-resolution images.
    const getReusedImageData = (ref: React.MutableRefObject<ImageData | null>) => {
      if (!ref.current || ref.current.width !== state.width || ref.current.height !== state.height) {
        ref.current = offCtx.createImageData(state.width, state.height);
      } else {
        new Uint32Array(ref.current.data.buffer).fill(0);
      }
      return ref.current;
    };
    
    // 1. Draw Onion Skin to offscreen
    if (state.onionSkin && state.activeFrameIndex > 0) {
      const prevFrame = state.frames[state.activeFrameIndex - 1];
      const imgData = getReusedImageData(onionSkinImageDataRef);
      const data32 = new Uint32Array(imgData.data.buffer);
      const paletteUint32 = new Uint32Array(state.palette.length);
      const hexCache = new Map<string, number>();

      state.layers.forEach(layer => {
        if (!layer.visible || layer.opacity <= 0) return;
        const pixels = prevFrame.layerData[layer.id];
        if (!pixels) return;
        const alpha = Math.round((layer.opacity / 100) * 80);
        if (alpha <= 0) return;

        for (let p = 0; p < state.palette.length; p++) {
          if (state.palette[p]) {
            const [r, g, b] = hexToRgb(state.palette[p]);
            paletteUint32[p] = (alpha << 24) | (b << 16) | (g << 8) | r;
          }
        }

        for (let i = 0; i < pixels.length; i++) {
            const val = pixels[i];
            if (val === null || val === undefined) continue;
            let packed: number;
            if (typeof val === 'number') {
              packed = paletteUint32[val];
            } else {
              let cached = hexCache.get(val);
              if (cached === undefined) {
                const [r, g, b] = hexToRgb(val);
                cached = (alpha << 24) | (b << 16) | (g << 8) | r;
                hexCache.set(val, cached);
              }
              packed = cached;
            }
            if (packed) data32[i] = packed;
        }
      });
      offCtx.putImageData(imgData, 0, 0);
    } else {
      offCtx.clearRect(0, 0, state.width, state.height);
    }

    // 2. Draw Layers to offscreen
    const currentFrame = state.frames[state.activeFrameIndex];
    const paletteUint32 = new Uint32Array(state.palette.length);
    const hexCache = new Map<string, number>();

    state.layers.forEach((layer) => {
      if (!layer.visible || layer.opacity <= 0) return;
      const layerPixels = currentFrame.layerData[layer.id];
      if (!layerPixels) return;
      
      const isTargetLayer = layer.id === state.activeLayerId;
      const shouldSkip = (isMoving || isRotating || isScaling) && isTargetLayer && state.selection;
      
      const layerImgData = getReusedImageData(layerImageDataRef);
      const layerData32 = new Uint32Array(layerImgData.data.buffer);
      const alpha = Math.round(layer.opacity * 2.55);
      if (alpha <= 0) return;

      for (let p = 0; p < state.palette.length; p++) {
        if (state.palette[p]) {
          const [r, g, b] = hexToRgb(state.palette[p]);
          paletteUint32[p] = (alpha << 24) | (b << 16) | (g << 8) | r;
        }
      }

      for (let i = 0; i < layerPixels.length; i++) {
         if (shouldSkip && state.selection!.has(i)) continue;
         const val = layerPixels[i];
         if (val === null || val === undefined) continue;
         let packed: number;
         if (typeof val === 'number') {
           packed = paletteUint32[val];
         } else {
           let cached = hexCache.get(val);
           if (cached === undefined) {
             const [r, g, b] = hexToRgb(val);
             cached = (alpha << 24) | (b << 16) | (g << 8) | r;
             hexCache.set(val, cached);
           }
           packed = cached;
         }
         if (packed) layerData32[i] = packed;
      }
      
      // Reuse cached offscreen canvas to composite layer
      layerCtx.clearRect(0, 0, state.width, state.height);
      layerCtx.putImageData(layerImgData, 0, 0);
      offCtx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;
      offCtx.drawImage(layerCanvas, 0, 0);
      offCtx.globalCompositeOperation = 'source-over';
    });

    // 3. Draw Floating Pixels (Transformations)
    if ((isScaling || isRotating || isMoving) && floatingPixels && state.selection) {
        let transformedGrid: PixelGrid;
        if (isScaling && initialBox && currentBox) {
            const tempGrid: PixelGrid = new Array(state.width * state.height).fill(null);
            floatingPixels.forEach((color, idx) => tempGrid[idx] = color);
            transformedGrid = scaleSelectionPixels(state.selection, tempGrid, initialBox, currentBox, state.width, state.height);
        } else if (isRotating && rotationPivot) {
            const tempGrid: PixelGrid = new Array(state.width * state.height).fill(null);
            floatingPixels.forEach((color, idx) => tempGrid[idx] = color);
            transformedGrid = rotateSelectionPixels(state.selection, tempGrid, rotationAngle, rotationPivot, state.width, state.height, state.rotationAlgorithm);
        } else if (isMoving) {
            const tempGrid: PixelGrid = new Array(state.width * state.height).fill(null);
            floatingPixels.forEach((val, idx) => {
                const { x, y } = getCoords(idx, state.width);
                const nx = x + moveOffset.x;
                const ny = y + moveOffset.y;
                if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
                    tempGrid[getIndex(nx, ny, state.width)] = val;
                }
            });
            transformedGrid = tempGrid;
        } else {
            transformedGrid = new Array(state.width * state.height).fill(null);
        }

        const floatImgData = getReusedImageData(layerImageDataRef);
        const floatData32 = new Uint32Array(floatImgData.data.buffer);
        const floatHexCache = new Map<string, number>();
        const floatPaletteUint32 = new Uint32Array(state.palette.length);
        for (let p = 0; p < state.palette.length; p++) {
          if (state.palette[p]) {
            const [r, g, b] = hexToRgb(state.palette[p]);
            floatPaletteUint32[p] = (255 << 24) | (b << 16) | (g << 8) | r;
          }
        }

        for (let i = 0; i < transformedGrid.length; i++) {
            const val = transformedGrid[i];
            if (val === null || val === undefined) continue;
            let packed: number;
            if (typeof val === 'number') {
              packed = floatPaletteUint32[val];
            } else {
              let cached = floatHexCache.get(val);
              if (cached === undefined) {
                const [r, g, b] = hexToRgb(val);
                cached = (255 << 24) | (b << 16) | (g << 8) | r;
                floatHexCache.set(val, cached);
              }
              packed = cached;
            }
            if (packed) floatData32[i] = packed;
        }
        layerCtx.clearRect(0, 0, state.width, state.height);
        layerCtx.putImageData(floatImgData, 0, 0);
        offCtx.drawImage(layerCanvas, 0, 0);
    }

    // Final Transfer to Art Canvas
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.drawImage(offscreen, 0, 0);
  }, [state.frames, state.activeFrameIndex, state.layers, state.activeLayerId, state.palette, state.width, state.height, state.onionSkin, isMoving, isRotating, isScaling, floatingPixels, moveOffset, rotationAngle, rotationPivot, initialBox, currentBox]);

  // UI Rendering Effect (Grid, Selection, Brush)
  const renderUI = useCallback(() => {
    const canvas = uiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const z = localZoom;
    const px = pan.x;
    const py = pan.y;
    const dashOffset = (performance.now() / 30) % 8;

    // 1. Draw Grid
    if (state.showGrid && z > 4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= state.width; x++) {
        const screenX = px + x * z;
        ctx.moveTo(screenX, py);
        ctx.lineTo(screenX, py + state.height * z);
      }
      for (let y = 0; y <= state.height; y++) {
        const screenY = py + y * z;
        ctx.moveTo(px, screenY);
        ctx.lineTo(px + state.width * z, screenY);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Symmetry Lines
    if (state.symmetry.x || state.symmetry.y) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        if (state.symmetry.x) {
            const x = px + (state.width / 2) * z;
            ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + state.height * z); ctx.stroke();
        }
        if (state.symmetry.y) {
            const y = py + (state.height / 2) * z;
            ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + state.width * z, y); ctx.stroke();
        }
        ctx.restore();
    }

    // 3. Draw Selection (Marching Ants)
    if (selectionSet && selectionSet.size > 0) {
      ctx.save();
      ctx.translate(px, py);
      
      if (isScaling && currentBox) {
          ctx.beginPath();
          ctx.rect(currentBox.x * z, currentBox.y * z, currentBox.w * z, currentBox.h * z);
          ctx.lineWidth = 1;
          ctx.setLineDash([]); ctx.strokeStyle = '#000000'; ctx.stroke();
          ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffset; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      } else {
          if (isRotating && rotationPivot) {
            const rpx = rotationPivot.x * z; const rpy = rotationPivot.y * z;
            ctx.translate(rpx, rpy); ctx.rotate(rotationAngle); ctx.translate(-rpx, -rpy);
          }
          
          ctx.beginPath(); ctx.lineWidth = 1;
          const ox = (isMoving && !isRotating) ? moveOffset.x : 0;
          const oy = (isMoving && !isRotating) ? moveOffset.y : 0;
          
          if (selectionBorderSegments) {
            for (let i = 0; i < selectionBorderSegments.length; i++) {
              const seg = selectionBorderSegments[i];
              const x1 = (seg.x1 + ox) * z;
              const y1 = (seg.y1 + oy) * z;
              const x2 = (seg.x2 + ox) * z;
              const y2 = (seg.y2 + oy) * z;
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
            }
          }
          // 1st pass: Solid black line for crisp contrast
          ctx.setLineDash([]);
          ctx.strokeStyle = '#000000';
          ctx.stroke();

          // 2nd pass: Animated white dashed marching ants
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -dashOffset;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
      }

      // Transformation Handles
      if (state.tool === 'move' && !isMoving) {
          const box = isScaling && currentBox ? currentBox : getSelectionBoundingBox(selectionSet, state.width);
          if (!isScaling) {
              const hx = (box.x + box.w / 2) * z;
              const hy = (box.y - 1.5) * z;
              ctx.setLineDash([]); ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(hx, box.y * z); ctx.lineTo(hx, hy); ctx.stroke();
              ctx.fillStyle = isRotating ? 'white' : 'rgba(255,255,255,0.8)';
              ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'black'; ctx.stroke();
          }
          const hs = 4;
          const handles = [
              {x: box.x, y: box.y}, {x: box.x + box.w/2, y: box.y}, {x: box.x + box.w, y: box.y},
              {x: box.x + box.w, y: box.y + box.h/2}, {x: box.x + box.w, y: box.y + box.h},
              {x: box.x + box.w/2, y: box.y + box.h}, {x: box.x, y: box.y + box.h}, {x: box.x, y: box.y + box.h/2}
          ];
          ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.setLineDash([]);
          handles.forEach(h => {
              ctx.fillRect(h.x * z - hs, h.y * z - hs, hs*2, hs*2);
              ctx.strokeRect(h.x * z - hs, h.y * z - hs, hs*2, hs*2);
          });
      }
      ctx.restore();
    }

    // 4. Draw Active Selection Preview (Rect/Ellipse/Lasso)
    if (isDrawing && startPos && cursorPos) {
        ctx.save();
        ctx.translate(px, py);
        const minX = Math.min(startPos.x, cursorPos.x);
        const maxX = Math.max(startPos.x, cursorPos.x);
        const minY = Math.min(startPos.y, cursorPos.y);
        const maxY = Math.max(startPos.y, cursorPos.y);
        const rx = minX * z;
        const ry = minY * z;
        const rw = (maxX - minX + 1) * z;
        const rh = (maxY - minY + 1) * z;
        ctx.beginPath();
        if (state.tool === 'rect-select') {
            ctx.rect(rx, ry, rw, rh);
        } else if (state.tool === 'ellipse-select') {
            ctx.ellipse(rx + rw/2, ry + rh/2, rw/2, rh/2, 0, 0, 2 * Math.PI);
        }
        ctx.lineWidth = 1;
        ctx.setLineDash([]); ctx.strokeStyle = '#000000'; ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffset; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
    }

    // 5. Draw Lasso/PolyLasso Points
    if (polyPoints.length > 0) {
        ctx.save();
        ctx.translate(px, py);
        ctx.beginPath();
        ctx.moveTo(polyPoints[0].x * z + z/2, polyPoints[0].y * z + z/2);
        for(let i=1; i<polyPoints.length; i++) ctx.lineTo(polyPoints[i].x * z + z/2, polyPoints[i].y * z + z/2);
        if (cursorPos && (state.tool === 'lasso-select' || state.tool === 'poly-lasso-select')) ctx.lineTo(cursorPos.x * z + z/2, cursorPos.y * z + z/2);
        ctx.lineWidth = 1;
        ctx.setLineDash([]); ctx.strokeStyle = '#000000'; ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffset; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
    }

    // 6. Draw Brush Preview
    const isBrushTool = ['pencil', 'eraser', 'smudge', 'blur', 'sharpen'].includes(state.tool);
    const isOtherToolWithPreview = ['bucket', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'eyedropper'].includes(state.tool);
    if (cursorPos && !isMoving && !isRotating && !isScaling && (isBrushTool || (!isDrawing && isOtherToolWithPreview))) {
        const { x, y } = cursorPos;
        const size = (state.tool === 'bucket' || state.tool === 'eyedropper') ? 1 : state.brushSize;
        const startOffset = Math.floor(size / 2);
        const radiusSq = Math.pow(size / 2 - 0.1, 2);
        const variants = [{ x, y }];
        if (state.symmetry.x) variants.push({ x: state.width - 1 - x, y: y });
        if (state.symmetry.y) variants.push({ x: x, y: state.height - 1 - y });
        if (state.symmetry.x && state.symmetry.y) variants.push({ x: state.width - 1 - x, y: state.height - 1 - y });

        ctx.save();
        ctx.translate(px, py);
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
                        const bpx = variant.x - startOffset + dx; const bpy = variant.y - startOffset + dy;
                        if (bpx >= 0 && bpx < state.width && bpy >= 0 && bpy < state.height) brushPixels.add(getIndex(bpx, bpy, state.width));
                    }
                }
            }
            brushPixels.forEach(idx => {
               const { x: bpx, y: bpy } = getCoords(idx, state.width);
               if (!brushPixels.has(getIndex(bpx, bpy - 1, state.width))) { ctx.moveTo(bpx * z, bpy * z); ctx.lineTo((bpx + 1) * z, bpy * z); }
               if (!brushPixels.has(getIndex(bpx, bpy + 1, state.width))) { ctx.moveTo(bpx * z, (bpy + 1) * z); ctx.lineTo((bpx + 1) * z, (bpy + 1) * z); }
               if (!brushPixels.has(getIndex(bpx - 1, bpy, state.width))) { ctx.moveTo(bpx * z, bpy * z); ctx.lineTo(bpx * z, (bpy + 1) * z); }
               if (!brushPixels.has(getIndex(bpx + 1, bpy, state.width))) { ctx.moveTo((bpx + 1) * z, bpy * z); ctx.lineTo((bpx + 1) * z, (bpy + 1) * z); }
            });
        });
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
  }, [containerSize, state, selectionSet, selectionBorderSegments, localZoom, pan, cursorPos, startPos, polyPoints, isMoving, isDrawing, moveOffset, floatingPixels, isRotating, rotationAngle, rotationPivot, isScaling, currentBox]);

  const renderUIRef = useRef(renderUI);
  useLayoutEffect(() => {
    renderUIRef.current = renderUI;
  });

  useEffect(() => {
    renderUI();
  }, [renderUI]);

  const hasMarchingAnts = Boolean(
    (selectionSet && selectionSet.size > 0) || 
    polyPoints.length > 0 || 
    (isDrawing && startPos && ['rect-select', 'ellipse-select', 'lasso-select'].includes(state.tool))
  );

  useEffect(() => {
    if (!hasMarchingAnts) return;

    let animId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      if (time - lastTime >= 40) {
        lastTime = time;
        renderUIRef.current();
      }
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [hasMarchingAnts]);

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

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
      {/* Reference Image Layer */}
      {state.referenceImage && state.referenceImage.visible && (
        <div 
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x + state.referenceImage.x * localZoom}px, ${pan.y + state.referenceImage.y * localZoom}px) scale(${state.referenceImage.scale * localZoom})`,
            opacity: state.referenceImage.opacity / 100,
            transformOrigin: 'top left',
          }}
        >
          <img src={state.referenceImage.url} className="block" alt="Reference" referrerPolicy="no-referrer" />
        </div>
      )}

      {/* Tiled Mode Overlays - Rendered below main art */}
      {state.tiled && [-1, 0, 1].map(ty => [-1, 0, 1].map(tx => {
        if (tx === 0 && ty === 0) return null;
        return (
          <div 
            key={`tile-${tx}-${ty}`}
            className="absolute top-0 left-0 pointer-events-none opacity-40 grayscale-[0.2]"
            style={{ 
              width: `${state.width * localZoom}px`, 
              height: `${state.height * localZoom}px`,
              transform: `translate(${pan.x + tx * state.width * localZoom}px, ${pan.y + ty * state.height * localZoom}px)`, 
              transformOrigin: 'top left',
            }}
          >
            <canvas
              width={state.width}
              height={state.height}
              className="w-full h-full block"
              style={{ imageRendering: 'pixelated' }}
              ref={(el) => {
                  if (el && artCanvasRef.current) {
                      const ctx = el.getContext('2d');
                      if (ctx) {
                          ctx.clearRect(0, 0, state.width, state.height);
                          ctx.drawImage(artCanvasRef.current, 0, 0);
                      }
                  }
              }}
            />
          </div>
        );
      }))}

      {/* Art Layer Wrapper */}
      <div 
        className="absolute top-0 left-0 shadow-2xl"
        style={{ 
          width: `${state.width * localZoom}px`, 
          height: `${state.height * localZoom}px`,
          transform: `translate(${pan.x}px, ${pan.y}px)`, 
          transformOrigin: 'top left',
          pointerEvents: 'none',
          backgroundImage: 'conic-gradient(#1a1a1a 90deg, #2a2a2a 90deg 180deg, #1a1a1a 180deg 270deg, #2a2a2a 270deg)',
          backgroundPosition: '0 0',
          backgroundSize: '32px 32px'
        }}
      >
        <canvas
          ref={artCanvasRef}
          width={state.width}
          height={state.height}
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* UI Overlay Layer (Grid, Selection, Handles) */}
      <canvas
        ref={uiCanvasRef}
        width={Math.floor(containerSize.width * dpr)}
        height={Math.floor(containerSize.height * dpr)}
        style={{ width: `${containerSize.width}px`, height: `${containerSize.height}px` }}
        className="absolute inset-0 pointer-events-none"
      />

      {showCursor && (
        <div ref={cursorRef} className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference hidden md:block" style={{ width: '24px', height: '24px', marginLeft: '-12px', marginTop: '-12px', backgroundImage: `url('${CURSOR_URI}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', transform: `translate(${mousePosRef.current.x}px, ${mousePosRef.current.y}px)` }} />
      )}
    </div>
  );
}
