
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  ProjectState,
  Frame,
  Layer,
  ToolType,
  SelectionMode,
  Position,
  Modifiers,
  PixelGrid,
  PixelValue,
} from '../types';
import { 
  getIndex, getCoords,
  getRectSelection, getEllipseSelection, getPolygonSelection, getWandSelection,
  getPackedColor, getMergedSelectionSegments, Segment, getSelectionBoundingBox, rotateSelectionPixels, scaleSelectionPixels,
  getLayerParentMap, isLayerVisible, getEffectiveLayerOpacity, prepareRotSpriteBuffer, RotSpritePrecomputedBuffer
} from '../utils';
import { setLiveZoom } from '../hooks/useCursorStore';
import { subscribeLiveStroke, getLiveStroke, LiveStrokePayload } from '../hooks/useLiveStrokeStore';

const CURSOR_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2H14V8H10V2ZM10 16H14V22H10V16ZM2 10H8V14H2V10ZM16 10H22V14H16V10ZM10 10H14V14H10V10Z" fill="white"/></svg>`;
const CURSOR_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;

interface CachedLayerCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  data32: Uint32Array;
  lastPixels: PixelGrid | null;
  lastOpacity: number;
  lastVisible: boolean;
  lastPalette: string[] | null;
  lastWidth: number;
  lastHeight: number;
}

// Precomputed circle brush boundary contours for instant, allocation-free rendering
const CIRCLE_CONTOUR_CACHE = new Map<number, Segment[]>();

const getCircleContour = (size: number): Segment[] => {
  let cached = CIRCLE_CONTOUR_CACHE.get(size);
  if (cached) return cached;

  if (size <= 1) {
    cached = [
      { x1: 0, y1: 0, x2: 1, y2: 0 },
      { x1: 1, y1: 0, x2: 1, y2: 1 },
      { x1: 0, y1: 1, x2: 1, y2: 1 },
      { x1: 0, y1: 0, x2: 0, y2: 1 }
    ];
    CIRCLE_CONTOUR_CACHE.set(size, cached);
    return cached;
  }

  const radiusSq = Math.pow(size / 2 - 0.1, 2);
  const inCircle: boolean[][] = [];
  for (let dy = 0; dy < size; dy++) {
    inCircle[dy] = [];
    for (let dx = 0; dx < size; dx++) {
      const cx = dx - (size - 1) / 2;
      const cy = dy - (size - 1) / 2;
      inCircle[dy][dx] = (cx * cx + cy * cy <= radiusSq);
    }
  }

  const segments: Segment[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (!inCircle[dy][dx]) continue;
      // Top edge
      if (dy === 0 || !inCircle[dy - 1][dx]) segments.push({ x1: dx, y1: dy, x2: dx + 1, y2: dy });
      // Bottom edge
      if (dy === size - 1 || !inCircle[dy + 1][dx]) segments.push({ x1: dx, y1: dy + 1, x2: dx + 1, y2: dy + 1 });
      // Left edge
      if (dx === 0 || !inCircle[dy][dx - 1]) segments.push({ x1: dx, y1: dy, x2: dx, y2: dy + 1 });
      // Right edge
      if (dx === size - 1 || !inCircle[dy][dx + 1]) segments.push({ x1: dx + 1, y1: dy, x2: dx + 1, y2: dy + 1 });
    }
  }

  CIRCLE_CONTOUR_CACHE.set(size, segments);
  return segments;
};

interface CanvasProps {
  projectId: string;
  frames: Frame[];
  activeFrameIndex: number;
  layers: Layer[];
  activeLayerId: string;
  palette: string[];
  width: number;
  height: number;
  zoom: number;
  tool: ToolType;
  brushSize: number;
  brushShape: 'square' | 'circle';
  showGrid: boolean;
  onionSkin: boolean;
  tiled: boolean;
  symmetryX: boolean;
  symmetryY: boolean;
  selection: Set<number> | null;
  selectionMode: SelectionMode;
  fillContiguous: boolean;
  rotationAlgorithm: 'nearest' | 'rotsprite';
  referenceImage: ProjectState['referenceImage'];
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
  projectId,
  frames,
  activeFrameIndex,
  layers,
  activeLayerId,
  palette,
  width,
  height,
  zoom,
  tool,
  brushSize,
  brushShape,
  showGrid,
  onionSkin,
  tiled,
  symmetryX,
  symmetryY,
  selection,
  selectionMode,
  fillContiguous,
  rotationAlgorithm,
  referenceImage,
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
  const containerRectRef = useRef<DOMRect | null>(null);
  const artCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerImageDataRef = useRef<ImageData | null>(null);
  const onionSkinImageDataRef = useRef<ImageData | null>(null);
  const onionSkinValidRef = useRef<boolean>(false);
  const onionSkinCacheKeyRef = useRef<{
    prevFrame: Frame | null;
    layers: Layer[] | null;
    palette: string[] | null;
    width: number;
    height: number;
  } | null>(null);
  const layerCanvasCacheRef = useRef<Map<string, CachedLayerCanvas>>(new Map());
  const rotSpriteCacheRef = useRef<RotSpritePrecomputedBuffer | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{x: number, y: number}>({ x: -100, y: -100 });
  const touchTimeoutRef = useRef<number | null>(null);
  const liveStateRef = useRef({
    projectId,
    frames,
    activeFrameIndex,
    layers,
    palette,
    width,
    height,
    tiled,
  });
  const renderUIRef = useRef<() => void>(() => {});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const refreshContainerRect = useCallback(() => {
    if (containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    }
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    containerRectRef.current = el.getBoundingClientRect();
    const observer = new ResizeObserver((entries) => {
      containerRectRef.current = el.getBoundingClientRect();
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerSize({
            width: Math.floor(entry.contentRect.width),
            height: Math.floor(entry.contentRect.height)
          });
        }
      }
    });
    observer.observe(el);
    window.addEventListener('resize', refreshContainerRect, { passive: true });
    window.addEventListener('scroll', refreshContainerRect, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refreshContainerRect);
      window.removeEventListener('scroll', refreshContainerRect, true);
    };
  }, [refreshContainerRect]);

  const selectionSet = useMemo(() => {
    if (!selection) return null;
    if (selection instanceof Set) {
      return selection.size > 0 ? selection : null;
    }
    const arr = Array.isArray(selection) ? Array.from(selection as any) : [];
    const numSet = new Set<number>();
    for (let i = 0; i < arr.length; i++) {
      const n = Number(arr[i]);
      if (!isNaN(n)) numSet.add(n);
    }
    return numSet.size > 0 ? numSet : null;
  }, [selection]);

  // Precompute merged boundary segments for active selection.
  // Reduces marching-ants rendering complexity from O(Selection Area) to O(Selection Corners),
  // improving performance by 100x-1000x on high-resolution canvas selections.
  const selectionBorderSegments = useMemo(() => {
    if (!selectionSet || selectionSet.size === 0) return null;
    return getMergedSelectionSegments(selectionSet, width, height);
  }, [selectionSet, width, height]);

  const selectionBoundingBox = useMemo(() => {
    if (!selectionSet || selectionSet.size === 0) return null;
    return getSelectionBoundingBox(selectionSet, width);
  }, [selectionSet, width]);
  
  const callbacks = useRef({ onDrawStart, onDraw, onDrawEnd });
  useEffect(() => {
    callbacks.current = { onDrawStart, onDraw, onDrawEnd };
  }, [onDrawStart, onDraw, onDrawEnd]);

  const [isDrawing, setIsDrawing] = useState(false);
  const cursorPosRef = useRef<Position | null>(null);
  const uiRafIdRef = useRef<number | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [localZoom, setLocalZoom] = useState(zoom);
  const panRef = useRef<Position>({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);

  // Performance refs: coordinate deduplication, palette cache, and debounced zoom commit
  const lastReportedCoordsRef = useRef<Position | null>(null);
  const tileCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const paletteCacheRef = useRef<Map<number, { palette: string[]; buf: Uint32Array }>>(new Map());
  const zoomCommitTimerRef = useRef<number | null>(null);
  const lastCommittedZoomRef = useRef<number>(zoom);
  const prevProjectIdRef = useRef<string>(projectId);
  const onZoomRef = useRef(onZoom);
  useLayoutEffect(() => {
    liveStateRef.current = {
      projectId,
      frames,
      activeFrameIndex,
      layers,
      palette,
      width,
      height,
      tiled,
    };
    onZoomRef.current = onZoom;
  });
  
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = localZoom;
  }, [localZoom]);

  useEffect(() => {
    const projectChanged = prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;
    if (projectChanged || zoom !== lastCommittedZoomRef.current) {
      if (zoomCommitTimerRef.current !== null) {
        window.clearTimeout(zoomCommitTimerRef.current);
        zoomCommitTimerRef.current = null;
      }
      setLiveZoom(null);
      lastCommittedZoomRef.current = zoom;
      zoomRef.current = zoom;
      setLocalZoom(zoom);
    } else if (zoomCommitTimerRef.current === null) {
      zoomRef.current = zoom;
      setLocalZoom(zoom);
    }
  }, [zoom, projectId]);

  useEffect(() => {
    return () => {
      if (zoomCommitTimerRef.current !== null) {
        window.clearTimeout(zoomCommitTimerRef.current);
        zoomCommitTimerRef.current = null;
      }
      setLiveZoom(null);
    };
  }, []);

  const scheduleZoomCommit = useCallback((newZoom: number) => {
    zoomRef.current = newZoom;
    setLocalZoom(newZoom);
    setLiveZoom(newZoom);
    if (zoomCommitTimerRef.current !== null) {
      window.clearTimeout(zoomCommitTimerRef.current);
    }
    zoomCommitTimerRef.current = window.setTimeout(() => {
      zoomCommitTimerRef.current = null;
      lastCommittedZoomRef.current = newZoom;
      onZoomRef.current(newZoom);
      setLiveZoom(null);
    }, 120);
  }, []);

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
      startZoom: zoom,
      startDist: 0,
      startPan: { x: 0, y: 0 },
      startCenter: { x: 0, y: 0 }
  });
  
  const lastCenteredRef = useRef<string | null>(null);
  
  useLayoutEffect(() => {
    if (projectId) {
      if (lastCenteredRef.current !== projectId && containerSize.width > 0 && containerSize.height > 0) {
        const contentW = width * zoom;
        const contentH = height * zoom;
        setPan({
          x: (containerSize.width - contentW) / 2,
          y: (containerSize.height - contentH) / 2
        });
        lastCenteredRef.current = projectId;
      }
    }
  }, [projectId, width, height, zoom, containerSize]);

  const getPixelCoords = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = containerRectRef.current || el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const curPan = panRef.current;
    const curZoom = zoomRef.current;
    
    const x = Math.floor((mx - curPan.x) / curZoom);
    const y = Math.floor((my - curPan.y) / curZoom);
    return { x, y };
  }, []);

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
    refreshContainerRect();
    
    const coords = getPixelCoords(clientX, clientY);
    if (!coords) return;
    const { x, y } = coords;

    if (tool === 'move' && selection && selectionBoundingBox) {
        const box = selectionBoundingBox;
        
        // Rotation Handle Check
        const rotHandleX = box.x + box.w / 2;
        const rotHandleY = box.y - 2;
        if (Math.hypot(x - rotHandleX, y - rotHandleY) < 1.8) {
            setIsRotating(true);
            setRotationPivot({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
            setRotationAngle(0);
            
            const frame = frames[activeFrameIndex];
            if (frame) {
              const layerData = frame.layerData[activeLayerId];
              if (layerData) {
                const floats = new Map<number, PixelValue>();
                selection.forEach(idx => floats.set(idx, layerData[idx]));
                setFloatingPixels(floats);
                rotSpriteCacheRef.current = rotationAlgorithm === 'rotsprite'
                  ? prepareRotSpriteBuffer(selection, layerData, width)
                  : null;
              }
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

                const frame = frames[activeFrameIndex];
                const layerData = frame?.layerData?.[activeLayerId];
                if (layerData) {
                  const floats = new Map<number, PixelValue>();
                  selection.forEach(idx => floats.set(idx, layerData[idx]));
                  setFloatingPixels(floats);
                }
                return;
            }
        }
    }

    if (tool === 'move' && selection && selection.has(getIndex(x, y, width))) {
      setIsMoving(true);
      setMoveStart({x, y});
      setMoveOffset({x: 0, y: 0});
      
      const frame = frames[activeFrameIndex];
      if (frame) {
        const layerData = frame.layerData[activeLayerId];
        if (layerData) {
          const floats = new Map<number, PixelValue>();
          selection.forEach(idx => floats.set(idx, layerData[idx]));
          setFloatingPixels(floats);
        }
      }
      return;
    }

    if (tool === 'poly-lasso-select') {
      setPolyPoints(prev => [...prev, { x, y }]);
      return;
    }

    if (['rect-select', 'ellipse-select', 'lasso-select'].includes(tool)) {
      setIsDrawing(true);
      const pos = { x, y };
      setStartPos(pos);
      callbacks.current.onDrawStart(pos, modifiers);
      if (tool === 'lasso-select') setPolyPoints([pos]);
      return;
    }

    if (tool === 'magic-wand') {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const frame = frames[activeFrameIndex];
      if (frame) {
        const layerData = frame.layerData[activeLayerId];
        if (layerData) {
          const newSel = getWandSelection(layerData, x, y, width, height, fillContiguous);
          combineSelection(newSel);
        }
      }
      return;
    }

    if (x >= 0 && x < width && y >= 0 && y < height) {
      setIsDrawing(true);
      callbacks.current.onDrawStart({x, y}, modifiers);
      callbacks.current.onDraw(x, y, modifiers);
    }
  };

  const scheduleRenderUI = useCallback(() => {
    if (uiRafIdRef.current !== null) return;
    uiRafIdRef.current = requestAnimationFrame(() => {
      uiRafIdRef.current = null;
      renderUIRef.current();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (uiRafIdRef.current !== null) {
        cancelAnimationFrame(uiRafIdRef.current);
        uiRafIdRef.current = null;
      }
    };
  }, []);

  const handlePointerMove = (clientX: number, clientY: number, modifiers: Modifiers) => {
    updateCustomCursor(clientX, clientY);
    const coords = getPixelCoords(clientX, clientY);
    
    // Update cursor ref and schedule UI overlay repaint without triggering a React re-render
    const lastReported = lastReportedCoordsRef.current;
    if (!lastReported || !coords || lastReported.x !== coords.x || lastReported.y !== coords.y) {
      lastReportedCoordsRef.current = coords;
      cursorPosRef.current = coords;
      scheduleRenderUI();
      if (onMousePosUpdate) onMousePosUpdate(coords);
    }
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
      if (tool === 'lasso-select') {
        setPolyPoints(prev => [...prev, { x, y }]);
      } else if (['rect-select', 'ellipse-select'].includes(tool)) {
      } else if (['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(tool)) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          callbacks.current.onDraw(x, y, modifiers);
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (isScaling && initialBox && currentBox && selection) {
        onScalePixels(selection, initialBox, currentBox);
        setIsScaling(false);
        setScaleHandle(null);
        setInitialBox(null);
        setCurrentBox(null);
        setFloatingPixels(null);
        return;
    }

    if (isRotating && rotationPivot && selection) {
        onRotatePixels(selection, rotationAngle, rotationPivot);
        rotSpriteCacheRef.current = null;
        setIsRotating(false);
        setRotationPivot(null);
        setRotationAngle(0);
        setFloatingPixels(null);
        return;
    }

    if (isMoving && moveStart && selection && floatingPixels) {
      onMovePixels(selection, moveOffset);
      setIsMoving(false);
      setMoveStart(null);
      setFloatingPixels(null);
      setMoveOffset({x:0, y:0});
      return;
    }

    if (tool === 'poly-lasso-select') return;

    if (isDrawing) {
      if (['rect-select', 'ellipse-select', 'lasso-select'].includes(tool) && startPos) {
         const cp = cursorPosRef.current || startPos;
         let newSel = new Set<number>();
         const clamp = (val: number, max: number) => Math.max(0, Math.min(max - 1, val));
         const sx = clamp(startPos.x, width);
         const sy = clamp(startPos.y, height);
         const cx = clamp(cp.x, width);
         const cy = clamp(cp.y, height);

         if (tool === 'rect-select') newSel = getRectSelection(sx, sy, cx, cy, width);
         else if (tool === 'ellipse-select') newSel = getEllipseSelection(sx, sy, cx, cy, width);
         else if (tool === 'lasso-select') newSel = getPolygonSelection(polyPoints.length > 0 ? polyPoints : [startPos], width, height);
         combineSelection(newSel);
      }
      setIsDrawing(false);
      setStartPos(null);
      setPolyPoints([]);
      callbacks.current.onDrawEnd();
    }
  };

  const combineSelection = (newSelection: Set<number>) => {
    let finalSel = new Set<number>();
    const current = selectionSet || new Set<number>();
    switch (selectionMode) {
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

  const pointerHandlersRef = useRef({ handlePointerDown, handlePointerMove, handlePointerUp, isDrawing });
  useLayoutEffect(() => {
    pointerHandlersRef.current = { handlePointerDown, handlePointerMove, handlePointerUp, isDrawing };
  });

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    
    requestAnimationFrame(() => {
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        
        // Zoom logic (Ctrl + Wheel)
        if (e.ctrlKey) {
            const rect = containerRectRef.current || container.getBoundingClientRect();
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
            const newPan = { x: newPanX, y: newPanY };
            panRef.current = newPan;
            setPan(newPan);
            scheduleZoomCommit(newZoom);
        } else {
            // Pan logic
            const dX = e.deltaX * (e.deltaMode === 1 ? 33 : 1);
            const dY = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            setPan(prev => {
              const next = { x: prev.x - dX, y: prev.y - dY };
              panRef.current = next;
              return next;
            });
        }
    });
  }, [scheduleZoomCommit]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
     // Cancel any pending draw trigger
     if (touchTimeoutRef.current) {
         window.clearTimeout(touchTimeoutRef.current);
         touchTimeoutRef.current = null;
     }

     if (e.touches.length >= 2) {
         e.preventDefault();
         
         // Abort any current single-finger drawing action immediately
         if (pointerHandlersRef.current.isDrawing) {
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
             pointerHandlersRef.current.handlePointerDown(t.clientX, t.clientY, { shift: false, ctrl: false, alt: false, meta: false }, -1);
             touchTimeoutRef.current = null;
         }, 45);
     }
  }, []);

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
         const rect = containerRectRef.current || containerRef.current!.getBoundingClientRect();
         const mx = startCenter.x - rect.left;
         const my = startCenter.y - rect.top;
         const canvasX = mx - startPan.x;
         const canvasY = my - startPan.y;
         let newPanX = mx - (canvasX / startZoom) * newZoom + dx;
         let newPanY = my - (canvasY / startZoom) * newZoom + dy;
         const newPan = { x: newPanX, y: newPanY };
         panRef.current = newPan;
         setPan(newPan);
         scheduleZoomCommit(newZoom);
      } else if (e.touches.length === 1) {
          // Only move if we aren't waiting for a potential second finger
          if (!touchTimeoutRef.current) {
             e.preventDefault();
             pointerHandlersRef.current.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, { shift: false, ctrl: false, alt: false, meta: false });
          }
      }
  }, [scheduleZoomCommit]);

  const handleTouchEnd = useCallback((e: TouchEvent) => { 
    if (touchTimeoutRef.current) {
        window.clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
    }
    if (e.touches.length === 0) {
        pointerHandlersRef.current.handlePointerUp(); 
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

  const getPaletteForAlpha = useCallback((palette: string[], alpha: number) => {
    let cache = paletteCacheRef.current.get(alpha);
    if (!cache || cache.palette !== palette) {
      const palLen = palette.length;
      const buf = new Uint32Array(palLen);
      for (let p = 0; p < palLen; p++) {
        if (palette[p]) {
          buf[p] = getPackedColor(palette[p], alpha);
        }
      }
      cache = { palette, buf };
      paletteCacheRef.current.set(alpha, cache);
    }
    return cache.buf;
  }, []);

  const syncTiledOverlays = useCallback((sourceCanvas: HTMLCanvasElement, width: number, height: number, tiled: boolean) => {
    if (tiled && tileCanvasesRef.current.size > 0) {
      tileCanvasesRef.current.forEach(tCanvas => {
        if (tCanvas) {
          const tCtx = tCanvas.getContext('2d');
          if (tCtx) {
            tCtx.clearRect(0, 0, width, height);
            tCtx.drawImage(sourceCanvas, 0, 0);
          }
        }
      });
    }
  }, []);

  const currentArtFrame = frames[activeFrameIndex];
  const prevOnionFrame =
    onionSkin && activeFrameIndex > 0 ? (frames[activeFrameIndex - 1] ?? null) : null;
  const isTransformActive = isMoving || isRotating || isScaling;
  const transformActiveLayerId = isTransformActive ? activeLayerId : '';
  const transformSelection = isTransformActive ? selection : null;
  const transformRotationAlgorithm = isRotating ? rotationAlgorithm : 'nearest';
  const transformFloatingPixels = isTransformActive ? floatingPixels : null;
  const transformMoveOffset = isMoving ? moveOffset : null;
  const transformRotationAngle = isRotating ? rotationAngle : 0;
  const transformRotationPivot = isRotating ? rotationPivot : null;
  const transformInitialBox = isScaling ? initialBox : null;
  const transformCurrentBox = isScaling ? currentBox : null;

  // Art Rendering Effect (Double Buffered + Per-Layer & Onion-Skin Cached)
  useEffect(() => {
    const canvas = artCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement('canvas');
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== width || offscreen.height !== height) {
      offscreen.width = width;
      offscreen.height = height;
    }
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    if (!layerCanvasRef.current) layerCanvasRef.current = document.createElement('canvas');
    const layerCanvas = layerCanvasRef.current;
    if (layerCanvas.width !== width || layerCanvas.height !== height) {
      layerCanvas.width = width;
      layerCanvas.height = height;
    }
    const layerCtx = layerCanvas.getContext('2d');
    if (!layerCtx) return;

    if (!currentArtFrame) return;

    const getReusedImageData = (ref: React.MutableRefObject<ImageData | null>) => {
      if (!ref.current || ref.current.width !== width || ref.current.height !== height) {
        ref.current = offCtx.createImageData(width, height);
      } else {
        new Uint32Array(ref.current.data.buffer).fill(0);
      }
      return ref.current;
    };

    const totalPixels = width * height;
    const palLen = palette.length;
    const parentMap = getLayerParentMap(layers);

    // 1. Draw Onion Skin to offscreen (cached across transforms & current-frame edits)
    if (prevOnionFrame) {
      const cacheKey = onionSkinCacheKeyRef.current;
      const isOnionCacheHit =
        onionSkinValidRef.current &&
        onionSkinImageDataRef.current !== null &&
        cacheKey !== null &&
        cacheKey.prevFrame === prevOnionFrame &&
        cacheKey.layers === layers &&
        cacheKey.palette === palette &&
        cacheKey.width === width &&
        cacheKey.height === height;

      if (isOnionCacheHit && onionSkinImageDataRef.current) {
        offCtx.putImageData(onionSkinImageDataRef.current, 0, 0);
      } else {
        const imgData = getReusedImageData(onionSkinImageDataRef);
        const data32 = new Uint32Array(imgData.data.buffer);

        for (let lIdx = 0; lIdx < layers.length; lIdx++) {
          const layer = layers[lIdx];
          if (layer.type === 'group') continue;
          if (!isLayerVisible(layer, layers, parentMap)) continue;
          const pixels = prevOnionFrame.layerData[layer.id];
          if (!pixels) continue;
          const effOpacity = getEffectiveLayerOpacity(layer, layers, parentMap);
          const alpha = Math.round((effOpacity / 100) * 80);
          if (alpha <= 0) continue;

          const paletteUint32 = getPaletteForAlpha(palette, alpha);
          const pxLen = Math.min(pixels.length, totalPixels);
          for (let i = 0; i < pxLen; i++) {
            const val = pixels[i];
            if (val === null || val === undefined) continue;
            if (typeof val === 'number') {
              if (val >= 0 && val < palLen) data32[i] = paletteUint32[val];
            } else {
              data32[i] = getPackedColor(val, alpha);
            }
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        onionSkinValidRef.current = true;
        onionSkinCacheKeyRef.current = {
          prevFrame: prevOnionFrame,
          layers,
          palette,
          width,
          height,
        };
      }
    } else {
      offCtx.clearRect(0, 0, width, height);
      onionSkinValidRef.current = false;
      onionSkinCacheKeyRef.current = null;
    }

    // 2. Draw Layers to offscreen with per-layer rasterization cache
    const activeLive = getLiveStroke();

    for (let lIdx = 0; lIdx < layers.length; lIdx++) {
      const layer = layers[lIdx];
      if (layer.type === 'group') continue;
      if (!isLayerVisible(layer, layers, parentMap)) continue;

      const useLive =
        activeLive &&
        activeLive.projectId === projectId &&
        activeLive.frameIndex === activeFrameIndex &&
        activeLive.layerId === layer.id;
      const layerPixels = useLive ? activeLive.pixels : currentArtFrame.layerData[layer.id];
      if (!layerPixels) continue;

      const isTargetLayer = layer.id === transformActiveLayerId;
      const isFloatingActive =
        isTransformActive && isTargetLayer && Boolean(transformSelection);

      const effOpacity = getEffectiveLayerOpacity(layer, layers, parentMap);
      const alpha = Math.round((effOpacity / 100) * 255);
      if (alpha <= 0) continue;

      let layerCache = layerCanvasCacheRef.current.get(layer.id);
      if (!layerCache || layerCache.lastWidth !== width || layerCache.lastHeight !== height) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const cCtx = c.getContext('2d')!;
        const imgData = cCtx.createImageData(width, height);
        layerCache = {
          canvas: c,
          ctx: cCtx,
          imageData: imgData,
          data32: new Uint32Array(imgData.data.buffer),
          lastPixels: null,
          lastOpacity: -1,
          lastVisible: true,
          lastPalette: null,
          lastWidth: width,
          lastHeight: height,
        };
        layerCanvasCacheRef.current.set(layer.id, layerCache);
      }

      const isDirty =
        isFloatingActive ||
        layerCache.lastPixels !== layerPixels ||
        layerCache.lastOpacity !== alpha ||
        layerCache.lastPalette !== palette;

      if (isDirty) {
        const data32 = layerCache.data32;
        data32.fill(0);

        const paletteUint32 = getPaletteForAlpha(palette, alpha);
        const pxLen = Math.min(layerPixels.length, totalPixels);

        if (isFloatingActive && transformSelection) {
          const sel = transformSelection;
          for (let i = 0; i < pxLen; i++) {
            if (sel.has(i)) continue;
            const val = layerPixels[i];
            if (val === null || val === undefined) continue;
            if (typeof val === 'number') {
              if (val >= 0 && val < palLen) data32[i] = paletteUint32[val];
            } else {
              data32[i] = getPackedColor(val, alpha);
            }
          }
        } else {
          for (let i = 0; i < pxLen; i++) {
            const val = layerPixels[i];
            if (val === null || val === undefined) continue;
            if (typeof val === 'number') {
              if (val >= 0 && val < palLen) data32[i] = paletteUint32[val];
            } else {
              data32[i] = getPackedColor(val, alpha);
            }
          }
        }

        layerCache.ctx.putImageData(layerCache.imageData, 0, 0);
        if (!isFloatingActive) {
          layerCache.lastPixels = layerPixels;
          layerCache.lastOpacity = alpha;
          layerCache.lastPalette = palette;
        } else {
          layerCache.lastPixels = null; // force update when transform ends
        }
      }

      // Composite cached layer canvas to offscreen
      const compositeOp: GlobalCompositeOperation =
        layer.blendMode === 'normal'
          ? 'source-over'
          : layer.blendMode === 'addition'
            ? 'lighter'
            : layer.blendMode === 'subtract' || layer.blendMode === 'divide'
              ? 'source-over'
              : (layer.blendMode as GlobalCompositeOperation);

      offCtx.globalCompositeOperation = compositeOp;
      offCtx.drawImage(layerCache.canvas, 0, 0);
      offCtx.globalCompositeOperation = 'source-over';
    }

    // 3. Draw Floating Pixels (Transformations)
    if (isTransformActive && transformFloatingPixels && transformSelection) {
      let transformedGrid: PixelGrid;
      if (isScaling && transformInitialBox && transformCurrentBox) {
        const tempGrid: PixelGrid = new Array(width * height).fill(null);
        transformFloatingPixels.forEach((color, idx) => (tempGrid[idx] = color));
        transformedGrid = scaleSelectionPixels(
          transformSelection,
          tempGrid,
          transformInitialBox,
          transformCurrentBox,
          width,
          height
        );
      } else if (isRotating && transformRotationPivot) {
        const tempGrid: PixelGrid = new Array(width * height).fill(null);
        transformFloatingPixels.forEach((color, idx) => (tempGrid[idx] = color));
        transformedGrid = rotateSelectionPixels(
          transformSelection,
          tempGrid,
          transformRotationAngle,
          transformRotationPivot,
          width,
          height,
          transformRotationAlgorithm,
          rotSpriteCacheRef.current
        );
      } else if (isMoving && transformMoveOffset) {
        const tempGrid: PixelGrid = new Array(width * height).fill(null);
        transformFloatingPixels.forEach((val, idx) => {
          const { x, y } = getCoords(idx, width);
          const nx = x + transformMoveOffset.x;
          const ny = y + transformMoveOffset.y;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            tempGrid[getIndex(nx, ny, width)] = val;
          }
        });
        transformedGrid = tempGrid;
      } else {
        transformedGrid = new Array(width * height).fill(null);
      }

      const floatImgData = getReusedImageData(layerImageDataRef);
      const floatData32 = new Uint32Array(floatImgData.data.buffer);
      const floatPaletteUint32 = getPaletteForAlpha(palette, 255);
      const floatPxLen = Math.min(transformedGrid.length, totalPixels);

      for (let i = 0; i < floatPxLen; i++) {
        const val = transformedGrid[i];
        if (val === null || val === undefined) continue;
        if (typeof val === 'number') {
          if (val >= 0 && val < palLen) floatData32[i] = floatPaletteUint32[val];
        } else {
          floatData32[i] = getPackedColor(val, 255);
        }
      }
      layerCtx.putImageData(floatImgData, 0, 0);
      offCtx.drawImage(layerCanvas, 0, 0);
    }

    // Final Transfer to Art Canvas
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(offscreen, 0, 0);

    // Synchronize Tiled Overlays if active
    syncTiledOverlays(canvas, width, height, tiled);
  }, [
    projectId,
    currentArtFrame,
    prevOnionFrame,
    activeFrameIndex,
    layers,
    transformActiveLayerId,
    palette,
    width,
    height,
    transformSelection,
    transformRotationAlgorithm,
    isTransformActive,
    isMoving,
    isRotating,
    isScaling,
    transformFloatingPixels,
    transformMoveOffset,
    transformRotationAngle,
    transformRotationPivot,
    transformInitialBox,
    transformCurrentBox,
    tiled,
    getPaletteForAlpha,
    syncTiledOverlays,
  ]);

  // Direct Live-Stroke Dirty-Rect Subscriber (zero React re-renders during brush drag)
  useEffect(() => {
    const handleLiveStroke = (live: LiveStrokePayload | null) => {
      if (!live) return;
      const curState = liveStateRef.current;
      if (live.projectId !== curState.projectId || live.frameIndex !== curState.activeFrameIndex) return;

      const canvas = artCanvasRef.current;
      const offscreen = offscreenCanvasRef.current;
      if (!canvas || !offscreen) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      const offCtx = offscreen.getContext('2d');
      if (!ctx || !offCtx) return;

      const { width, height, layers, palette, tiled } = curState;
      if (offscreen.width !== width || offscreen.height !== height) {
        offscreen.width = width;
        offscreen.height = height;
      }

      const parentMap = getLayerParentMap(layers);
      const targetLayer = layers.find(l => l.id === live.layerId);
      if (!targetLayer || targetLayer.type === 'group' || !isLayerVisible(targetLayer, layers, parentMap)) return;

      const effOpacity = getEffectiveLayerOpacity(targetLayer, layers, parentMap);
      const alpha = Math.round((effOpacity / 100) * 255);
      if (alpha <= 0) return;

      const palLen = palette.length;
      const paletteUint32 = getPaletteForAlpha(palette, alpha);
      const totalPixels = width * height;
      const pixels = live.pixels;

      let layerCache = layerCanvasCacheRef.current.get(live.layerId);
      let needsFullRaster = Boolean(live.fullRedraw || !live.dirtyRect);
      if (!layerCache || layerCache.lastWidth !== width || layerCache.lastHeight !== height) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const cCtx = c.getContext('2d')!;
        const imgData = cCtx.createImageData(width, height);
        layerCache = {
          canvas: c,
          ctx: cCtx,
          imageData: imgData,
          data32: new Uint32Array(imgData.data.buffer),
          lastPixels: null,
          lastOpacity: -1,
          lastVisible: true,
          lastPalette: null,
          lastWidth: width,
          lastHeight: height,
        };
        layerCanvasCacheRef.current.set(live.layerId, layerCache);
        needsFullRaster = true;
      } else if (layerCache.lastOpacity !== alpha || layerCache.lastPalette !== palette || layerCache.lastPixels === null) {
        needsFullRaster = true;
      }

      const data32 = layerCache.data32;
      if (!needsFullRaster && live.dirtyRect) {
        const minX = Math.max(0, live.dirtyRect.minX);
        const minY = Math.max(0, live.dirtyRect.minY);
        const maxX = Math.min(width - 1, live.dirtyRect.maxX);
        const maxY = Math.min(height - 1, live.dirtyRect.maxY);

        for (let py = minY; py <= maxY; py++) {
          const rowOff = py * width;
          for (let px = minX; px <= maxX; px++) {
            const idx = rowOff + px;
            const val = pixels[idx];
            if (val === null || val === undefined) {
              data32[idx] = 0;
            } else if (typeof val === 'number') {
              data32[idx] = (val >= 0 && val < palLen) ? paletteUint32[val] : 0;
            } else {
              data32[idx] = getPackedColor(val, alpha);
            }
          }
        }
        layerCache.ctx.putImageData(
          layerCache.imageData,
          0,
          0,
          minX,
          minY,
          maxX - minX + 1,
          maxY - minY + 1
        );
      } else {
        data32.fill(0);
        const pxLen = Math.min(pixels.length, totalPixels);
        for (let i = 0; i < pxLen; i++) {
          const val = pixels[i];
          if (val === null || val === undefined) continue;
          if (typeof val === 'number') {
            if (val >= 0 && val < palLen) data32[i] = paletteUint32[val];
          } else {
            data32[i] = getPackedColor(val, alpha);
          }
        }
        layerCache.ctx.putImageData(layerCache.imageData, 0, 0);
      }

      layerCache.lastPixels = pixels;
      layerCache.lastOpacity = alpha;
      layerCache.lastPalette = palette;

      // Composite onion skin + cached layers to offscreen
      if (
        onionSkinValidRef.current &&
        onionSkinImageDataRef.current &&
        onionSkinImageDataRef.current.width === width &&
        onionSkinImageDataRef.current.height === height
      ) {
        offCtx.putImageData(onionSkinImageDataRef.current, 0, 0);
      } else {
        offCtx.clearRect(0, 0, width, height);
      }

      const currentFrame = curState.frames[curState.activeFrameIndex];
      for (let lIdx = 0; lIdx < layers.length; lIdx++) {
        const layer = layers[lIdx];
        if (layer.type === 'group') continue;
        if (!isLayerVisible(layer, layers, parentMap)) continue;
        if (layer.id !== live.layerId && !currentFrame?.layerData[layer.id]) continue;
        const cached = layerCanvasCacheRef.current.get(layer.id);
        if (!cached || cached.lastWidth !== width || cached.lastHeight !== height) continue;

        const compositeOp: GlobalCompositeOperation = layer.blendMode === 'normal'
          ? 'source-over'
          : (layer.blendMode === 'addition' ? 'lighter' : (layer.blendMode === 'subtract' || layer.blendMode === 'divide' ? 'source-over' : layer.blendMode as GlobalCompositeOperation));

        offCtx.globalCompositeOperation = compositeOp;
        offCtx.drawImage(cached.canvas, 0, 0);
        offCtx.globalCompositeOperation = 'source-over';
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(offscreen, 0, 0);
      syncTiledOverlays(canvas, width, height, tiled);
    };

    return subscribeLiveStroke(handleLiveStroke);
  }, [getPaletteForAlpha, syncTiledOverlays]);

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
    const cursorPos = cursorPosRef.current;

    // 1. Draw Grid (Viewport-Clipped & Half-Pixel Snapped for crisp lines & faster rendering)
    if (showGrid && z > 4) {
      const cWidth = containerSize.width || canvas.width / dpr;
      const cHeight = containerSize.height || canvas.height / dpr;
      const startX = Math.max(0, Math.floor(-px / z));
      const endX = Math.min(width, Math.ceil((cWidth - px) / z));
      const startY = Math.max(0, Math.floor(-py / z));
      const endY = Math.min(height, Math.ceil((cHeight - py) / z));

      if (startX <= endX && startY <= endY) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x++) {
          const screenX = Math.round(px + x * z) + 0.5;
          ctx.moveTo(screenX, py + startY * z);
          ctx.lineTo(screenX, py + endY * z);
        }
        for (let y = startY; y <= endY; y++) {
          const screenY = Math.round(py + y * z) + 0.5;
          ctx.moveTo(px + startX * z, screenY);
          ctx.lineTo(px + endX * z, screenY);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Draw Symmetry Lines
    if (symmetryX || symmetryY) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        if (symmetryX) {
            const x = px + (width / 2) * z;
            ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + height * z); ctx.stroke();
        }
        if (symmetryY) {
            const y = py + (height / 2) * z;
            ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + width * z, y); ctx.stroke();
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
      if (tool === 'move' && !isMoving) {
          const box = isScaling && currentBox ? currentBox : selectionBoundingBox;
          if (box) {
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
        if (tool === 'rect-select') {
            ctx.rect(rx, ry, rw, rh);
        } else if (tool === 'ellipse-select') {
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
        if (cursorPos && (tool === 'lasso-select' || tool === 'poly-lasso-select')) ctx.lineTo(cursorPos.x * z + z/2, cursorPos.y * z + z/2);
        ctx.lineWidth = 1;
        ctx.setLineDash([]); ctx.strokeStyle = '#000000'; ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffset; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
    }

    // 6. Draw Brush Preview (Optimized with direct rect & contour caching)
    const isBrushTool = ['pencil', 'eraser', 'smudge', 'blur', 'sharpen'].includes(tool);
    const isOtherToolWithPreview = ['bucket', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'eyedropper'].includes(tool);
    if (cursorPos && !isMoving && !isRotating && !isScaling && (isBrushTool || (!isDrawing && isOtherToolWithPreview))) {
        const { x, y } = cursorPos;
        const size = (tool === 'bucket' || tool === 'eyedropper') ? 1 : brushSize;
        const startOffset = Math.floor(size / 2);
        const variants = [{ x, y }];
        if (symmetryX) variants.push({ x: width - 1 - x, y: y });
        if (symmetryY) variants.push({ x: x, y: height - 1 - y });
        if (symmetryX && symmetryY) variants.push({ x: width - 1 - x, y: height - 1 - y });

        ctx.save();
        ctx.translate(px, py);
        ctx.beginPath();
        
        const isSquare = brushShape === 'square' || size <= 1 || ['bucket', 'eyedropper'].includes(tool);

        if (isSquare) {
          variants.forEach(variant => {
            const bx = (variant.x - startOffset) * z;
            const by = (variant.y - startOffset) * z;
            const bw = size * z;
            ctx.rect(bx, by, bw, bw);
          });
        } else {
          const circleSegments = getCircleContour(size);
          variants.forEach(variant => {
            const ox = (variant.x - startOffset) * z;
            const oy = (variant.y - startOffset) * z;
            for (let i = 0; i < circleSegments.length; i++) {
              const seg = circleSegments[i];
              ctx.moveTo(ox + seg.x1 * z, oy + seg.y1 * z);
              ctx.lineTo(ox + seg.x2 * z, oy + seg.y2 * z);
            }
          });
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
  }, [containerSize, showGrid, width, height, symmetryX, symmetryY, tool, brushSize, brushShape, selectionSet, selectionBorderSegments, selectionBoundingBox, localZoom, pan, startPos, polyPoints, isMoving, isDrawing, moveOffset, isRotating, rotationAngle, rotationPivot, isScaling, currentBox]);

  useLayoutEffect(() => {
    renderUIRef.current = renderUI;
  });

  useEffect(() => {
    renderUI();
  }, [renderUI]);

  const hasMarchingAnts = Boolean(
    (selectionSet && selectionSet.size > 0) || 
    polyPoints.length > 0 || 
    (isDrawing && startPos && ['rect-select', 'ellipse-select', 'lasso-select'].includes(tool))
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
        onMouseEnter={(e) => { refreshContainerRect(); mousePosRef.current = { x: e.clientX, y: e.clientY }; setShowCursor(true); }}
        onMouseLeave={() => { setShowCursor(false); cursorPosRef.current = null; lastReportedCoordsRef.current = null; scheduleRenderUI(); if (onMousePosUpdate) onMousePosUpdate(null); handlePointerUp(); }}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY, getModifiers(e), e.button)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY, getModifiers(e))}
        onMouseUp={handlePointerUp}
        onDoubleClick={() => { if (tool === 'poly-lasso-select' && polyPoints.length > 2) { combineSelection(getPolygonSelection(polyPoints, width, height)); setPolyPoints([]); } }}
    >
      {/* Reference Image Layer */}
      {referenceImage && referenceImage.visible && (
        <div 
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x + referenceImage.x * localZoom}px, ${pan.y + referenceImage.y * localZoom}px) scale(${referenceImage.scale * localZoom})`,
            opacity: referenceImage.opacity / 100,
            transformOrigin: 'top left',
          }}
        >
          <img src={referenceImage.url} className="block" alt="Reference" referrerPolicy="no-referrer" />
        </div>
      )}

      {/* Tiled Mode Overlays - Rendered below main art */}
      {tiled && [-1, 0, 1].map(ty => [-1, 0, 1].map(tx => {
        if (tx === 0 && ty === 0) return null;
        return (
          <div 
            key={`tile-${tx}-${ty}`}
            className="absolute top-0 left-0 pointer-events-none opacity-40 grayscale-[0.2]"
            style={{ 
              width: `${width * localZoom}px`, 
              height: `${height * localZoom}px`,
              transform: `translate(${pan.x + tx * width * localZoom}px, ${pan.y + ty * height * localZoom}px)`, 
              transformOrigin: 'top left',
            }}
          >
            <canvas
              width={width}
              height={height}
              className="w-full h-full block"
              style={{ imageRendering: 'pixelated' }}
              ref={(el) => {
                  const key = `${tx}_${ty}`;
                  if (el) {
                    const prevEl = tileCanvasesRef.current.get(key);
                    tileCanvasesRef.current.set(key, el);
                    if (prevEl !== el && artCanvasRef.current) {
                      const ctx = el.getContext('2d');
                      if (ctx) {
                        ctx.clearRect(0, 0, width, height);
                        ctx.drawImage(artCanvasRef.current, 0, 0);
                      }
                    }
                  } else {
                    tileCanvasesRef.current.delete(key);
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
          width: `${width * localZoom}px`, 
          height: `${height * localZoom}px`,
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
          width={width}
          height={height}
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
        <div
          ref={(el) => {
            cursorRef.current = el;
            if (el) {
              el.style.transform = `translate(${mousePosRef.current.x}px, ${mousePosRef.current.y}px)`;
            }
          }}
          className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference hidden md:block"
          style={{
            width: '24px',
            height: '24px',
            marginLeft: '-12px',
            marginTop: '-12px',
            backgroundImage: `url('${CURSOR_URI}')`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
    </div>
  );
}
