
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  ProjectState,
  Frame,
  Layer,
  ColorMode,
  ToolType,
  SelectionMode,
  Position,
  Modifiers,
  PixelGrid,
} from '../types';
import { 
  getIndex,
  getRectSelection, getEllipseSelection, getPolygonSelection, getWandSelection,
  getPackedPalette255, pixelToPackedImageData, createRgbaImageDataView,
  getMergedSelectionSegments, Segment, getSelectionBoundingBox,
  getLayerParentMap, isLayerVisible, getEffectiveLayerOpacity, SelectionMask,
} from '../utils';
import {
  getPendingLayerBitmap,
  isHydratedReplacementFor,
  resolveHydratedPixelGrid,
} from '../utils/layerBitmapCache';
import { setLiveZoom } from '../hooks/useCursorStore';
import {
  subscribeLiveStroke,
  getLiveStroke,
  LiveStrokePayload,
  subscribeLiveShapePreview,
  getLiveShapePreview,
} from '../hooks/useLiveStrokeStore';
import { MIN_ZOOM, MAX_ZOOM } from '../constants';

const CURSOR_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2H14V8H10V2ZM10 16H14V22H10V16ZM2 10H8V14H2V10ZM16 10H22V14H16V10ZM10 10H14V14H10V10Z" fill="white"/></svg>`;
const CURSOR_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;

interface CachedLayerCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  lastPixels: PixelGrid | null;
  lastPalette: string[] | null;
  lastColorMode: ColorMode | null;
  lastWidth: number;
  lastHeight: number;
}

interface TransformPreviewCache {
  layerId: string;
  box: { x: number; y: number; w: number; h: number };
  floatCanvas: HTMLCanvasElement;
  bgCanvas: HTMLCanvasElement;
}

const LARGE_CANVAS_PIXELS = 1_000_000;

function releaseCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function uploadPixelsToCanvas(
  targetCtx: CanvasRenderingContext2D,
  pixels: PixelGrid,
  width: number,
  height: number,
  colorMode: ColorMode | string,
  paletteUint32: Uint32Array,
  getScratchImageData: () => ImageData
): void {
  // Zero-copy fast path: RGBA PixelGrid is already little-endian ABGR matching ImageData layout
  if (colorMode === 'rgba') {
    const directImg = createRgbaImageDataView(pixels, width, height);
    if (directImg) {
      targetCtx.putImageData(directImg, 0, 0);
      return;
    }
  }

  const totalPixels = width * height;
  const uploadImg = getScratchImageData();
  const data32 = new Uint32Array(uploadImg.data.buffer);
  const pxLen = Math.min(pixels.length, totalPixels);

  if (colorMode === 'rgba') {
    data32.set(pixels.subarray(0, pxLen));
    if (pxLen < totalPixels) data32.fill(0, pxLen);
  } else {
    data32.fill(0);
    for (let i = 0; i < pxLen; i++) {
      const val = pixels[i];
      if (val !== 0) {
        data32[i] = pixelToPackedImageData(val, paletteUint32);
      }
    }
  }
  targetCtx.putImageData(uploadImg, 0, 0);
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
  colorMode?: ColorMode;
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
  selection: SelectionMask | null;
  selectionMode: SelectionMode;
  fillContiguous: boolean;
  rotationAlgorithm: 'nearest' | 'rotsprite';
  referenceImage: ProjectState['referenceImage'];
  onDrawStart: (pos: Position, modifiers: Modifiers) => void;
  onDraw: (x: number, y: number, modifiers: Modifiers) => void;
  onDrawEnd: () => void;
  onSelectionUpdate: (sel: SelectionMask | null) => void;
  onMovePixels: (newSelection: SelectionMask, offset: Position) => void;
  onRotatePixels: (newSelection: SelectionMask, angle: number, pivot: Position) => void;
  onScalePixels: (newSelection: SelectionMask, srcBox: any, destBox: any) => void;
  onZoom: (zoom: number) => void;
  onMousePosUpdate?: (pos: Position | null) => void;
  fitTrigger?: number;
}

const TILE_OFFSETS = [
  { tx: -1, ty: -1 },
  { tx: 0, ty: -1 },
  { tx: 1, ty: -1 },
  { tx: -1, ty: 0 },
  { tx: 1, ty: 0 },
  { tx: -1, ty: 1 },
  { tx: 0, ty: 1 },
  { tx: 1, ty: 1 },
] as const;

export const Canvas: React.FC<CanvasProps> = ({ 
  projectId,
  frames,
  activeFrameIndex,
  layers,
  activeLayerId,
  palette,
  colorMode = 'rgba',
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
  onMousePosUpdate,
  fitTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const checkerboardRef = useRef<HTMLDivElement>(null);
  const referenceImageElRef = useRef<HTMLDivElement>(null);
  const artCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sharedUploadImageDataRef = useRef<ImageData | null>(null);
  const dirtyUploadImageDataRef = useRef<ImageData | null>(null);
  const onionSkinCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const onionSkinValidRef = useRef<boolean>(false);
  const onionSkinCacheKeyRef = useRef<{
    prevFrame: Frame | null;
    layers: Layer[] | null;
    palette: string[] | null;
    colorMode: ColorMode;
    width: number;
    height: number;
  } | null>(null);
  const layerCanvasCacheRef = useRef<Map<string, CachedLayerCanvas>>(new Map());
  const lastRenderedProjectIdRef = useRef<string>(projectId);
  const transformPreviewRef = useRef<TransformPreviewCache | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{x: number, y: number}>({ x: -100, y: -100 });
  const touchTimeoutRef = useRef<number | null>(null);
  const liveStateRef = useRef({
    projectId,
    frames,
    activeFrameIndex,
    layers,
    palette,
    colorMode,
    width,
    height,
    tiled,
  });
  const renderUIRef = useRef<() => void>(() => {});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerSizeRef = useRef(containerSize);
  const referenceImageRef = useRef(referenceImage);

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

  const selectionMask = useMemo(
    () => SelectionMask.fromAny(selection, width, height),
    [selection, width, height]
  );

  // Precompute merged boundary segments for active selection.
  const selectionBorderSegments = useMemo(() => {
    if (!selectionMask || selectionMask.size === 0) return null;
    return getMergedSelectionSegments(selectionMask, width, height);
  }, [selectionMask, width, height]);

  const selectionBoundingBox = useMemo(() => {
    if (!selectionMask || selectionMask.size === 0) return null;
    return getSelectionBoundingBox(selectionMask, width);
  }, [selectionMask, width]);
  
  const callbacks = useRef({ onDrawStart, onDraw, onDrawEnd });
  useEffect(() => {
    callbacks.current = { onDrawStart, onDraw, onDrawEnd };
  }, [onDrawStart, onDraw, onDrawEnd]);

  const [isDrawing, setIsDrawing] = useState(false);
  const cursorPosRef = useRef<Position | null>(null);
  const uiRafIdRef = useRef<number | null>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [useCustomCursor, setUseCustomCursor] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : true
  );
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [localZoom, setLocalZoom] = useState(zoom);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = (e: MediaQueryListEvent) => setUseCustomCursor(e.matches);
    setUseCustomCursor(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const panRef = useRef<Position>({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);

  // Performance refs: coordinate deduplication, imperative pan/zoom, and debounced settle commit
  const lastReportedCoordsRef = useRef<Position | null>(null);
  const viewportCommitTimerRef = useRef<number | null>(null);
  const pendingZoomCommitRef = useRef<boolean>(false);
  const wheelRafIdRef = useRef<number | null>(null);
  const touchRafIdRef = useRef<number | null>(null);
  const pendingTouchViewportRef = useRef<{ pan: Position; zoom: number } | null>(null);
  const pendingWheelRef = useRef<{
    panDx: number;
    panDy: number;
    zoomDelta: number;
    clientX: number;
    clientY: number;
    hasZoom: boolean;
  }>({ panDx: 0, panDy: 0, zoomDelta: 0, clientX: 0, clientY: 0, hasZoom: false });
  const lastCommittedZoomRef = useRef<number>(zoom);
  const prevProjectIdRef = useRef<string>(projectId);
  const onZoomRef = useRef(onZoom);
  const presentArtViewportRef = useRef<() => void>(() => {});

  // Keep live state refs fresh without clobbering in-flight imperative panRef / zoomRef during gestures
  useLayoutEffect(() => {
    liveStateRef.current = {
      projectId,
      frames,
      activeFrameIndex,
      layers,
      palette,
      colorMode,
      width,
      height,
      tiled,
    };
    containerSizeRef.current = containerSize;
    referenceImageRef.current = referenceImage;
    onZoomRef.current = onZoom;
  });

  const syncViewportDom = useCallback(() => {
    const curPan = panRef.current;
    const curZoom = zoomRef.current;
    const { width: w, height: h } = liveStateRef.current;
    const { width: cw, height: ch } = containerSizeRef.current;

    const checkerEl = checkerboardRef.current;
    if (checkerEl) {
      const spriteLeft = curPan.x;
      const spriteTop = curPan.y;
      const spriteRight = curPan.x + w * curZoom;
      const spriteBottom = curPan.y + h * curZoom;
      const clipLeft = Math.max(0, spriteLeft);
      const clipTop = Math.max(0, spriteTop);
      const clipRight = Math.min(cw, spriteRight);
      const clipBottom = Math.min(ch, spriteBottom);
      if (clipRight > clipLeft && clipBottom > clipTop) {
        checkerEl.style.display = 'block';
        checkerEl.style.width = `${clipRight - clipLeft}px`;
        checkerEl.style.height = `${clipBottom - clipTop}px`;
        checkerEl.style.transform = `translate(${clipLeft}px, ${clipTop}px)`;
        checkerEl.style.backgroundPosition = `${spriteLeft - clipLeft}px ${spriteTop - clipTop}px`;
      } else {
        checkerEl.style.display = 'none';
      }
    }

    const refImg = referenceImageRef.current;
    const refEl = referenceImageElRef.current;
    if (refImg && refImg.visible && refEl) {
      refEl.style.transform = `translate(${curPan.x + refImg.x * curZoom}px, ${curPan.y + refImg.y * curZoom}px) scale(${refImg.scale * curZoom})`;
    }
  }, []);

  useEffect(() => {
    const projectChanged = prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;
    if (projectChanged || zoom !== lastCommittedZoomRef.current) {
      if (viewportCommitTimerRef.current !== null) {
        window.clearTimeout(viewportCommitTimerRef.current);
        viewportCommitTimerRef.current = null;
      }
      pendingZoomCommitRef.current = false;
      setLiveZoom(null);
      lastCommittedZoomRef.current = zoom;
      zoomRef.current = zoom;
      setLocalZoom(zoom);
      syncViewportDom();
      presentArtViewportRef.current();
      renderUIRef.current();
    } else if (viewportCommitTimerRef.current === null) {
      zoomRef.current = zoom;
      setLocalZoom(zoom);
      syncViewportDom();
    }
  }, [zoom, projectId, syncViewportDom]);

  useEffect(() => {
    return () => {
      if (viewportCommitTimerRef.current !== null) {
        window.clearTimeout(viewportCommitTimerRef.current);
        viewportCommitTimerRef.current = null;
      }
      if (wheelRafIdRef.current !== null) {
        cancelAnimationFrame(wheelRafIdRef.current);
        wheelRafIdRef.current = null;
      }
      if (touchRafIdRef.current !== null) {
        cancelAnimationFrame(touchRafIdRef.current);
        touchRafIdRef.current = null;
      }
      setLiveZoom(null);

      // Release all offscreen canvas GPU/backing buffers on unmount
      releaseCanvas(offscreenCanvasRef.current);
      offscreenCanvasRef.current = null;
      releaseCanvas(layerCanvasRef.current);
      layerCanvasRef.current = null;
      releaseCanvas(onionSkinCanvasRef.current);
      onionSkinCanvasRef.current = null;
      sharedUploadImageDataRef.current = null;
      dirtyUploadImageDataRef.current = null;
      if (transformPreviewRef.current) {
        releaseCanvas(transformPreviewRef.current.floatCanvas);
        releaseCanvas(transformPreviewRef.current.bgCanvas);
        transformPreviewRef.current = null;
      }
      layerCanvasCacheRef.current.forEach((entry) => releaseCanvas(entry.canvas));
      layerCanvasCacheRef.current.clear();
    };
  }, []);

  // Imperatively updates pan/zoom DOM + art + UI canvases with zero React re-renders during active gestures,
  // committing React state only once the gesture settles.
  const applyImperativeViewport = useCallback(
    (nextPan: Position, nextZoom: number, zoomChanged: boolean) => {
      panRef.current = nextPan;
      zoomRef.current = nextZoom;

      syncViewportDom();
      presentArtViewportRef.current();
      renderUIRef.current();

      if (zoomChanged) {
        pendingZoomCommitRef.current = true;
        setLiveZoom(nextZoom);
      }

      if (viewportCommitTimerRef.current !== null) {
        window.clearTimeout(viewportCommitTimerRef.current);
      }
      viewportCommitTimerRef.current = window.setTimeout(() => {
        viewportCommitTimerRef.current = null;
        const settledPan = panRef.current;
        const settledZoom = zoomRef.current;
        const shouldCommitZoom = pendingZoomCommitRef.current;
        pendingZoomCommitRef.current = false;

        setPan(settledPan);
        if (shouldCommitZoom) {
          setLocalZoom(settledZoom);
          lastCommittedZoomRef.current = settledZoom;
          onZoomRef.current(settledZoom);
          setLiveZoom(null);
        }
      }, 120);
    },
    [syncViewportDom]
  );

  const [startPos, setStartPos] = useState<Position | null>(null);
  const [polyPoints, setPolyPoints] = useState<Position[]>([]);

  const [isMoving, setIsMoving] = useState(false);
  const [moveStart, setMoveStart] = useState<Position | null>(null);
  const [moveOffset, setMoveOffset] = useState<Position>({x: 0, y: 0});

  const [isRotating, setIsRotating] = useState(false);
  const [rotationPivot, setRotationPivot] = useState<Position | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);

  const [isScaling, setIsScaling] = useState(false);
  const [scaleHandle, setScaleHandle] = useState<number | null>(null); // 0-7: TL, TC, TR, RC, BR, BC, BL, LC
  const [initialBox, setInitialBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [currentBox, setCurrentBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  const releaseTransformPreview = useCallback(() => {
    const tp = transformPreviewRef.current;
    if (tp) {
      releaseCanvas(tp.floatCanvas);
      releaseCanvas(tp.bgCanvas);
      transformPreviewRef.current = null;
    }
  }, []);

  const buildTransformPreview = useCallback(
    (sel: SelectionMask, box: { x: number; y: number; w: number; h: number }) => {
      releaseTransformPreview();
      const frame = frames[activeFrameIndex];
      const layerData = resolveHydratedPixelGrid(frame?.layerData?.[activeLayerId]);
      if (!layerData || box.w <= 0 || box.h <= 0) return;

      const paletteUint32 = getPackedPalette255(palette);

      // 1. Build tightly cropped floating selection canvas (box.w x box.h)
      const floatCanvas = document.createElement('canvas');
      floatCanvas.width = box.w;
      floatCanvas.height = box.h;
      const floatCtx = floatCanvas.getContext('2d');
      if (!floatCtx) return;

      const floatImg = floatCtx.createImageData(box.w, box.h);
      const float32 = new Uint32Array(floatImg.data.buffer);
      const isRgba = colorMode === 'rgba';
      const bx = box.x;
      const by = box.y;
      const bw = box.w;
      sel.forEachCoord((px, py, idx) => {
        const val = layerData[idx];
        if (val !== 0) {
          float32[(py - by) * bw + (px - bx)] = isRgba
            ? val
            : pixelToPackedImageData(val, paletteUint32);
        }
      });
      floatCtx.putImageData(floatImg, 0, 0);

      // 2. Build background canvas (active layer with selected region punched out once)
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = width;
      bgCanvas.height = height;
      const bgCtx = bgCanvas.getContext('2d');
      if (!bgCtx) {
        releaseCanvas(floatCanvas);
        return;
      }

      const cached = layerCanvasCacheRef.current.get(activeLayerId);
      const cacheHit =
        cached &&
        cached.lastWidth === width &&
        cached.lastHeight === height &&
        (cached.lastPixels === layerData || isHydratedReplacementFor(layerData, cached.lastPixels)) &&
        cached.lastColorMode === colorMode &&
        (colorMode !== 'indexed' || cached.lastPalette === palette);

      if (cacheHit) {
        bgCtx.drawImage(cached.canvas, 0, 0);
      } else {
        uploadPixelsToCanvas(bgCtx, layerData, width, height, colorMode, paletteUint32, () =>
          bgCtx.createImageData(width, height)
        );
      }

      if (sel.isRect) {
        bgCtx.clearRect(bx, by, box.w, box.h);
      } else {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = box.w;
        maskCanvas.height = box.h;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          const maskImg = maskCtx.createImageData(box.w, box.h);
          const mask32 = new Uint32Array(maskImg.data.buffer);
          sel.forEachCoord((px, py) => {
            mask32[(py - by) * bw + (px - bx)] = 0xffffffff;
          });
          maskCtx.putImageData(maskImg, 0, 0);
          bgCtx.globalCompositeOperation = 'destination-out';
          bgCtx.drawImage(maskCanvas, bx, by);
          bgCtx.globalCompositeOperation = 'source-over';
        }
        releaseCanvas(maskCanvas);
      }

      transformPreviewRef.current = {
        layerId: activeLayerId,
        box,
        floatCanvas,
        bgCanvas,
      };
    },
    [frames, activeFrameIndex, activeLayerId, palette, colorMode, width, height, releaseTransformPreview]
  );

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
        const centeredPan = {
          x: (containerSize.width - contentW) / 2,
          y: (containerSize.height - contentH) / 2
        };
        panRef.current = centeredPan;
        zoomRef.current = zoom;
        setPan(centeredPan);
        syncViewportDom();
        lastCenteredRef.current = projectId;
      }
    }
  }, [projectId, width, height, zoom, containerSize, syncViewportDom]);

  const lastFitTriggerRef = useRef<number | undefined>(fitTrigger);
  useEffect(() => {
    if (fitTrigger === undefined || fitTrigger === lastFitTriggerRef.current) return;
    lastFitTriggerRef.current = fitTrigger;
    if (containerSize.width <= 0 || containerSize.height <= 0) return;
    const padding = 48;
    const availW = Math.max(64, containerSize.width - padding);
    const availH = Math.max(64, containerSize.height - padding);
    const rawZoom = Math.min(availW / Math.max(1, width), availH / Math.max(1, height));
    const fittedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(rawZoom * 10) / 10));
    const nextPan = {
      x: (containerSize.width - width * fittedZoom) / 2,
      y: (containerSize.height - height * fittedZoom) / 2,
    };
    if (viewportCommitTimerRef.current !== null) {
      window.clearTimeout(viewportCommitTimerRef.current);
      viewportCommitTimerRef.current = null;
    }
    pendingZoomCommitRef.current = false;
    panRef.current = nextPan;
    setPan(nextPan);
    zoomRef.current = fittedZoom;
    setLocalZoom(fittedZoom);
    lastCommittedZoomRef.current = fittedZoom;
    setLiveZoom(null);
    syncViewportDom();
    presentArtViewportRef.current();
    renderUIRef.current();
    onZoomRef.current(fittedZoom);
  }, [fitTrigger, containerSize, width, height, syncViewportDom]);

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

    if (tool === 'move' && selectionMask && selectionBoundingBox) {
        const box = selectionBoundingBox;
        
        // Rotation Handle Check
        const rotHandleX = box.x + box.w / 2;
        const rotHandleY = box.y - 2;
        if (Math.hypot(x - rotHandleX, y - rotHandleY) < 1.8) {
            buildTransformPreview(selectionMask, box);
            setIsRotating(true);
            setRotationPivot({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
            setRotationAngle(0);
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
                buildTransformPreview(selectionMask, box);
                setIsScaling(true);
                setScaleHandle(i);
                setInitialBox({...box});
                setCurrentBox({...box});
                setMoveStart({x, y});
                return;
            }
        }
    }

    if (tool === 'move' && selectionMask && selectionBoundingBox && x >= 0 && x < width && y >= 0 && y < height && selectionMask.has(getIndex(x, y, width))) {
      buildTransformPreview(selectionMask, selectionBoundingBox);
      setIsMoving(true);
      setMoveStart({x, y});
      setMoveOffset({x: 0, y: 0});
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
        const layerData = resolveHydratedPixelGrid(frame.layerData[activeLayerId]) ?? undefined;
        const newSel = getWandSelection(layerData, x, y, width, height, fillContiguous);
        combineSelection(newSel);
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
      } else if (['line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool)) {
        const cx = Math.max(0, Math.min(width - 1, x));
        const cy = Math.max(0, Math.min(height - 1, y));
        callbacks.current.onDraw(cx, cy, modifiers);
      } else if (['pencil', 'eraser', 'smudge', 'blur', 'sharpen', 'color-replace'].includes(tool)) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          callbacks.current.onDraw(x, y, modifiers);
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (isScaling && initialBox && currentBox && selectionMask) {
        onScalePixels(selectionMask, initialBox, currentBox);
        releaseTransformPreview();
        setIsScaling(false);
        setScaleHandle(null);
        setInitialBox(null);
        setCurrentBox(null);
        return;
    }

    if (isRotating && rotationPivot && selectionMask) {
        onRotatePixels(selectionMask, rotationAngle, rotationPivot);
        releaseTransformPreview();
        setIsRotating(false);
        setRotationPivot(null);
        setRotationAngle(0);
        return;
    }

    if (isMoving && moveStart && selectionMask) {
      if (moveOffset.x !== 0 || moveOffset.y !== 0) {
        onMovePixels(selectionMask, moveOffset);
      }
      releaseTransformPreview();
      setIsMoving(false);
      setMoveStart(null);
      setMoveOffset({x:0, y:0});
      return;
    }

    if (tool === 'poly-lasso-select') return;

    if (isDrawing) {
      if (['rect-select', 'ellipse-select', 'lasso-select'].includes(tool) && startPos) {
         const cp = cursorPosRef.current || startPos;
         let newSel = SelectionMask.empty(width, height);
         const clamp = (val: number, max: number) => Math.max(0, Math.min(max - 1, val));
         const sx = clamp(startPos.x, width);
         const sy = clamp(startPos.y, height);
         const cx = clamp(cp.x, width);
         const cy = clamp(cp.y, height);

         if (tool === 'rect-select') newSel = getRectSelection(sx, sy, cx, cy, width, height);
         else if (tool === 'ellipse-select') newSel = getEllipseSelection(sx, sy, cx, cy, width, height);
         else if (tool === 'lasso-select') newSel = getPolygonSelection(polyPoints.length > 0 ? polyPoints : [startPos], width, height);
         combineSelection(newSel);
      }
      setIsDrawing(false);
      setStartPos(null);
      setPolyPoints([]);
      callbacks.current.onDrawEnd();
    }
  };

  const combineSelection = (newSelection: SelectionMask) => {
    let finalSel: SelectionMask;
    const current = selectionMask;
    switch (selectionMode) {
      case 'replace':
        finalSel = newSelection;
        break;
      case 'add':
        finalSel = current ? current.union(newSelection) : newSelection;
        break;
      case 'subtract':
        finalSel = current ? current.subtract(newSelection) : SelectionMask.empty(width, height);
        break;
      case 'intersect':
        finalSel = current ? current.intersect(newSelection) : SelectionMask.empty(width, height);
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

    const pending = pendingWheelRef.current;
    const scale = e.deltaMode === 1 ? 33 : 1;
    if (e.ctrlKey) {
      pending.hasZoom = true;
      pending.zoomDelta += e.deltaY * scale;
      pending.clientX = e.clientX;
      pending.clientY = e.clientY;
    } else {
      pending.panDx += e.deltaX * scale;
      pending.panDy += e.deltaY * scale;
    }

    if (wheelRafIdRef.current !== null) return;

    wheelRafIdRef.current = requestAnimationFrame(() => {
      wheelRafIdRef.current = null;
      const curContainer = containerRef.current;
      if (!curContainer) return;

      const batch = pendingWheelRef.current;
      const panDx = batch.panDx;
      const panDy = batch.panDy;
      const hasZoom = batch.hasZoom;
      const zoomDelta = batch.zoomDelta;
      const clientX = batch.clientX;
      const clientY = batch.clientY;
      batch.panDx = 0;
      batch.panDy = 0;
      batch.zoomDelta = 0;
      batch.hasZoom = false;

      if (hasZoom) {
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        const rect = containerRectRef.current || curContainer.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        const cx = mx - currentPan.x;
        const cy = my - currentPan.y;
        const ZOOM_SPEED = 0.006;
        const newZoom = Math.min(Math.max(currentZoom * Math.exp(-zoomDelta * ZOOM_SPEED), MIN_ZOOM), MAX_ZOOM);
        const newPanX = mx - (cx / currentZoom) * newZoom - panDx;
        const newPanY = my - (cy / currentZoom) * newZoom - panDy;
        applyImperativeViewport({ x: newPanX, y: newPanY }, newZoom, true);
      } else if (panDx !== 0 || panDy !== 0) {
        const prevPan = panRef.current;
        applyImperativeViewport({ x: prevPan.x - panDx, y: prevPan.y - panDy }, zoomRef.current, false);
      }
    });
  }, [applyImperativeViewport]);

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
         const newZoom = Math.min(Math.max(startZoom * scaleFactor, MIN_ZOOM), MAX_ZOOM);
         const dx = cx - startCenter.x;
         const dy = cy - startCenter.y;
         const rect = containerRectRef.current || containerRef.current!.getBoundingClientRect();
         const mx = startCenter.x - rect.left;
         const my = startCenter.y - rect.top;
         const canvasX = mx - startPan.x;
         const canvasY = my - startPan.y;
         const newPanX = mx - (canvasX / startZoom) * newZoom + dx;
         const newPanY = my - (canvasY / startZoom) * newZoom + dy;

         pendingTouchViewportRef.current = { pan: { x: newPanX, y: newPanY }, zoom: newZoom };
         if (touchRafIdRef.current === null) {
           touchRafIdRef.current = requestAnimationFrame(() => {
             touchRafIdRef.current = null;
             const pending = pendingTouchViewportRef.current;
             if (!pending) return;
             pendingTouchViewportRef.current = null;
             applyImperativeViewport(pending.pan, pending.zoom, true);
           });
         }
      } else if (e.touches.length === 1) {
          // Only move if we aren't waiting for a potential second finger
          if (!touchTimeoutRef.current) {
             e.preventDefault();
             pointerHandlersRef.current.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, { shift: false, ctrl: false, alt: false, meta: false });
          }
      }
  }, [applyImperativeViewport]);

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

  // Present the composited offscreen sprite (and GPU tiled mode overlays) onto the viewport-sized artCanvasRef.
  // Panning and zooming only re-run this single GPU drawImage pass without re-compositing layers.
  const presentArtViewport = useCallback(() => {
    const canvas = artCanvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen || offscreen.width === 0 || offscreen.height === 0) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const { width: w, height: h, tiled: isTiled } = liveStateRef.current;
    const dprNow = window.devicePixelRatio || 1;
    const vw = canvas.width / dprNow;
    const vh = canvas.height / dprNow;
    if (vw <= 0 || vh <= 0 || w <= 0 || h <= 0) return;

    const curPan = panRef.current;
    const curZoom = zoomRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dprNow, 0, 0, dprNow, 0, 0);
    ctx.imageSmoothingEnabled = curZoom < 1;

    const drawClippedInstance = (offsetX: number, offsetY: number, alpha: number) => {
      const sx0 = Math.max(0, Math.floor(-offsetX / curZoom));
      const sy0 = Math.max(0, Math.floor(-offsetY / curZoom));
      const sx1 = Math.min(w, Math.ceil((vw - offsetX) / curZoom));
      const sy1 = Math.min(h, Math.ceil((vh - offsetY) / curZoom));
      if (sx1 <= sx0 || sy1 <= sy0) return;

      const sw = sx1 - sx0;
      const sh = sy1 - sy0;
      const dx = offsetX + sx0 * curZoom;
      const dy = offsetY + sy0 * curZoom;
      const dw = sw * curZoom;
      const dh = sh * curZoom;

      ctx.globalAlpha = alpha;
      ctx.drawImage(offscreen, sx0, sy0, sw, sh, dx, dy, dw, dh);
    };

    if (isTiled) {
      const tileW = w * curZoom;
      const tileH = h * curZoom;
      for (let i = 0; i < TILE_OFFSETS.length; i++) {
        const { tx, ty } = TILE_OFFSETS[i];
        drawClippedInstance(curPan.x + tx * tileW, curPan.y + ty * tileH, 0.4);
      }
    }

    drawClippedInstance(curPan.x, curPan.y, 1);
    ctx.globalAlpha = 1;
  }, []);

  useLayoutEffect(() => {
    presentArtViewportRef.current = presentArtViewport;
  });

  const currentArtFrame = frames[activeFrameIndex];
  const prevOnionFrame =
    onionSkin && activeFrameIndex > 0 ? (frames[activeFrameIndex - 1] ?? null) : null;
  const isTransformActive = isMoving || isRotating || isScaling;
  const transformMoveOffset = isMoving ? moveOffset : null;
  const transformRotationAngle = isRotating ? rotationAngle : 0;
  const transformRotationPivot = isRotating ? rotationPivot : null;
  const transformCurrentBox = isScaling ? currentBox : null;

  // Art Rendering Effect (Double Buffered + Per-Layer Canvas Cache + GPU Transform Preview)
  useEffect(() => {
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement('canvas');
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== width || offscreen.height !== height) {
      offscreen.width = width;
      offscreen.height = height;
    }
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    if (!currentArtFrame) return;

    const totalPixels = width * height;
    const isLargeCanvas = totalPixels > LARGE_CANVAS_PIXELS;
    const paletteUint32 = getPackedPalette255(palette);
    const parentMap = getLayerParentMap(layers);

    // On project switch, evict and zero all cached layer canvases immediately to release VRAM
    if (lastRenderedProjectIdRef.current !== projectId) {
      lastRenderedProjectIdRef.current = projectId;
      layerCanvasCacheRef.current.forEach((entry) => releaseCanvas(entry.canvas));
      layerCanvasCacheRef.current.clear();
      sharedUploadImageDataRef.current = null;
      dirtyUploadImageDataRef.current = null;
      releaseCanvas(onionSkinCanvasRef.current);
      onionSkinCanvasRef.current = null;
      onionSkinValidRef.current = false;
      onionSkinCacheKeyRef.current = null;
    } else if (layerCanvasCacheRef.current.size > layers.length) {
      // Prune stale layer caches for deleted layers
      const validIds = new Set<string>();
      for (let i = 0; i < layers.length; i++) validIds.add(layers[i].id);
      for (const [cachedId, entry] of layerCanvasCacheRef.current.entries()) {
        if (!validIds.has(cachedId)) {
          releaseCanvas(entry.canvas);
          layerCanvasCacheRef.current.delete(cachedId);
        }
      }
    }

    const getSharedUploadImageData = (): ImageData => {
      let img = sharedUploadImageDataRef.current;
      if (!img || img.width !== width || img.height !== height) {
        img = offCtx.createImageData(width, height);
        sharedUploadImageDataRef.current = img;
      }
      return img;
    };

    // 1. Draw Onion Skin to offscreen (cached canvas composited with GPU globalAlpha)
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.globalAlpha = 1;
    offCtx.clearRect(0, 0, width, height);

    if (prevOnionFrame) {
      const cacheKey = onionSkinCacheKeyRef.current;
      const isOnionCacheHit =
        onionSkinValidRef.current &&
        onionSkinCanvasRef.current !== null &&
        onionSkinCanvasRef.current.width === width &&
        onionSkinCanvasRef.current.height === height &&
        cacheKey !== null &&
        cacheKey.prevFrame === prevOnionFrame &&
        cacheKey.layers === layers &&
        cacheKey.palette === palette &&
        cacheKey.colorMode === colorMode &&
        cacheKey.width === width &&
        cacheKey.height === height;

      if (!isOnionCacheHit) {
        if (!onionSkinCanvasRef.current) {
          onionSkinCanvasRef.current = document.createElement('canvas');
        }
        const onionCanvas = onionSkinCanvasRef.current;
        if (onionCanvas.width !== width || onionCanvas.height !== height) {
          onionCanvas.width = width;
          onionCanvas.height = height;
        }
        const onionCtx = onionCanvas.getContext('2d');
        if (onionCtx) {
          if (!layerCanvasRef.current) layerCanvasRef.current = document.createElement('canvas');
          const layerCanvas = layerCanvasRef.current;
          if (layerCanvas.width !== width || layerCanvas.height !== height) {
            layerCanvas.width = width;
            layerCanvas.height = height;
          }
          const layerCtx = layerCanvas.getContext('2d');

          onionCtx.globalCompositeOperation = 'source-over';
          onionCtx.globalAlpha = 1;
          onionCtx.clearRect(0, 0, width, height);

          if (layerCtx) {
            for (let lIdx = 0; lIdx < layers.length; lIdx++) {
              const layer = layers[lIdx];
              if (layer.type === 'group') continue;
              if (!isLayerVisible(layer, layers, parentMap)) continue;
              const pixels = prevOnionFrame.layerData[layer.id];
              if (!pixels) continue;
              const effOpacity = getEffectiveLayerOpacity(layer, layers, parentMap);
              if (effOpacity <= 0) continue;

              const pendingBmp = getPendingLayerBitmap(pixels);
              if (pendingBmp) {
                onionCtx.globalAlpha = effOpacity / 100;
                onionCtx.drawImage(pendingBmp.bitmap, 0, 0);
                continue;
              }

              uploadPixelsToCanvas(
                layerCtx,
                pixels,
                width,
                height,
                colorMode,
                paletteUint32,
                getSharedUploadImageData
              );
              onionCtx.globalAlpha = effOpacity / 100;
              onionCtx.drawImage(layerCanvas, 0, 0);
            }
          }
          if (isLargeCanvas) {
            releaseCanvas(layerCanvasRef.current);
            layerCanvasRef.current = null;
          }
          onionCtx.globalAlpha = 1;
          onionSkinValidRef.current = true;
          onionSkinCacheKeyRef.current = {
            prevFrame: prevOnionFrame,
            layers,
            palette,
            colorMode,
            width,
            height,
          };
        }
      }

      if (onionSkinValidRef.current && onionSkinCanvasRef.current) {
        offCtx.globalAlpha = 80 / 255;
        offCtx.drawImage(onionSkinCanvasRef.current, 0, 0);
        offCtx.globalAlpha = 1;
      }
    } else {
      if (onionSkinCanvasRef.current) {
        releaseCanvas(onionSkinCanvasRef.current);
        onionSkinCanvasRef.current = null;
      }
      if (layerCanvasRef.current) {
        releaseCanvas(layerCanvasRef.current);
        layerCanvasRef.current = null;
      }
      onionSkinValidRef.current = false;
      onionSkinCacheKeyRef.current = null;
    }

    // 2. Draw Layers to offscreen with per-layer canvas cache + GPU opacity/blend & transform preview
    const activeLive = getLiveStroke();
    const tp = isTransformActive ? transformPreviewRef.current : null;

    for (let lIdx = 0; lIdx < layers.length; lIdx++) {
      const layer = layers[lIdx];
      if (layer.type === 'group') continue;
      if (!isLayerVisible(layer, layers, parentMap)) continue;

      const effOpacity = getEffectiveLayerOpacity(layer, layers, parentMap);
      if (effOpacity <= 0) continue;

      const compositeOp: GlobalCompositeOperation =
        layer.blendMode === 'normal'
          ? 'source-over'
          : layer.blendMode === 'addition'
            ? 'lighter'
            : layer.blendMode === 'subtract' || layer.blendMode === 'divide'
              ? 'source-over'
              : (layer.blendMode as GlobalCompositeOperation);

      // Fast GPU-composited transform preview for the active layer (zero full-res CPU work during drag)
      if (tp && layer.id === tp.layerId) {
        offCtx.globalAlpha = effOpacity / 100;
        offCtx.globalCompositeOperation = compositeOp;
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(tp.bgCanvas, 0, 0);

        if (isScaling && transformCurrentBox) {
          offCtx.drawImage(
            tp.floatCanvas,
            transformCurrentBox.x,
            transformCurrentBox.y,
            transformCurrentBox.w,
            transformCurrentBox.h
          );
        } else if (isRotating && transformRotationPivot) {
          offCtx.save();
          offCtx.translate(transformRotationPivot.x, transformRotationPivot.y);
          offCtx.rotate(transformRotationAngle);
          offCtx.drawImage(
            tp.floatCanvas,
            tp.box.x - transformRotationPivot.x,
            tp.box.y - transformRotationPivot.y
          );
          offCtx.restore();
        } else if (isMoving && transformMoveOffset) {
          offCtx.drawImage(
            tp.floatCanvas,
            tp.box.x + transformMoveOffset.x,
            tp.box.y + transformMoveOffset.y
          );
        } else {
          offCtx.drawImage(tp.floatCanvas, tp.box.x, tp.box.y);
        }

        offCtx.globalAlpha = 1;
        offCtx.globalCompositeOperation = 'source-over';
        continue;
      }

      const useLive =
        activeLive &&
        activeLive.projectId === projectId &&
        activeLive.frameIndex === activeFrameIndex &&
        activeLive.layerId === layer.id;
      const layerPixels = useLive ? activeLive.pixels : currentArtFrame.layerData[layer.id];
      if (!layerPixels) continue;

      let layerCache = layerCanvasCacheRef.current.get(layer.id);
      if (!layerCache || layerCache.lastWidth !== width || layerCache.lastHeight !== height) {
        if (layerCache) releaseCanvas(layerCache.canvas);
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const cCtx = c.getContext('2d')!;
        layerCache = {
          canvas: c,
          ctx: cCtx,
          lastPixels: null,
          lastPalette: null,
          lastColorMode: null,
          lastWidth: width,
          lastHeight: height,
        };
        layerCanvasCacheRef.current.set(layer.id, layerCache);
      }

      // If background worker hydration just swapped a pending ImageBitmap placeholder for its exact
      // Uint32Array PixelGrid, layerCache.canvas already holds those exact GPU pixels—skip putImageData.
      if (
        layerCache.lastPixels !== layerPixels &&
        layerCache.lastColorMode === colorMode &&
        (colorMode !== 'indexed' || layerCache.lastPalette === palette) &&
        isHydratedReplacementFor(layerPixels, layerCache.lastPixels)
      ) {
        layerCache.lastPixels = layerPixels;
      }

      const isDirty =
        layerCache.lastPixels !== layerPixels ||
        layerCache.lastColorMode !== colorMode ||
        (colorMode === 'indexed' && layerCache.lastPalette !== palette);

      if (isDirty) {
        const pendingBmp = getPendingLayerBitmap(layerPixels);
        if (pendingBmp) {
          layerCache.ctx.clearRect(0, 0, width, height);
          layerCache.ctx.drawImage(pendingBmp.bitmap, 0, 0);
        } else {
          uploadPixelsToCanvas(
            layerCache.ctx,
            layerPixels,
            width,
            height,
            colorMode,
            paletteUint32,
            getSharedUploadImageData
          );
        }
        layerCache.lastPixels = layerPixels;
        layerCache.lastPalette = palette;
        layerCache.lastColorMode = colorMode;
      }

      offCtx.globalAlpha = effOpacity / 100;
      offCtx.globalCompositeOperation = compositeOp;
      offCtx.drawImage(layerCache.canvas, 0, 0);
      offCtx.globalAlpha = 1;
      offCtx.globalCompositeOperation = 'source-over';
    }

    // Release large scratch upload ImageData (>1MP) so we don't keep an idle 33MB CPU buffer around
    if (isLargeCanvas) {
      sharedUploadImageDataRef.current = null;
    }

    // Present composited offscreen canvas to the viewport-sized art canvas
    presentArtViewport();
  }, [
    projectId,
    currentArtFrame,
    prevOnionFrame,
    activeFrameIndex,
    layers,
    palette,
    colorMode,
    width,
    height,
    isTransformActive,
    isMoving,
    isRotating,
    isScaling,
    transformMoveOffset,
    transformRotationAngle,
    transformRotationPivot,
    transformCurrentBox,
    presentArtViewport,
  ]);

  // Lightweight viewport presentation effect on settled pan / zoom / tiled / container resize
  useEffect(() => {
    syncViewportDom();
    presentArtViewport();
    renderUIRef.current();
  }, [pan, localZoom, tiled, containerSize, width, height, referenceImage, syncViewportDom, presentArtViewport]);

  // Direct Live-Stroke Dirty-Rect Subscriber (zero React re-renders & dirty-rect compositing during brush drag)
  useEffect(() => {
    const handleLiveStroke = (live: LiveStrokePayload | null) => {
      if (!live) return;
      const curState = liveStateRef.current;
      if (live.projectId !== curState.projectId || live.frameIndex !== curState.activeFrameIndex) return;

      const offscreen = offscreenCanvasRef.current;
      if (!offscreen) return;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      const { width, height, layers, palette, colorMode: curColorMode } = curState;
      let resizedOffscreen = false;
      if (offscreen.width !== width || offscreen.height !== height) {
        offscreen.width = width;
        offscreen.height = height;
        resizedOffscreen = true;
      }

      const parentMap = getLayerParentMap(layers);
      const targetLayer = layers.find(l => l.id === live.layerId);
      if (!targetLayer || targetLayer.type === 'group' || !isLayerVisible(targetLayer, layers, parentMap)) return;

      const effOpacity = getEffectiveLayerOpacity(targetLayer, layers, parentMap);
      if (effOpacity <= 0) return;

      const paletteUint32 = getPackedPalette255(palette);
      const totalPixels = width * height;
      const pixels = live.pixels;

      let layerCache = layerCanvasCacheRef.current.get(live.layerId);
      let needsFullRaster = Boolean(live.fullRedraw || !live.dirtyRect || resizedOffscreen);
      if (!layerCache || layerCache.lastWidth !== width || layerCache.lastHeight !== height) {
        if (layerCache) releaseCanvas(layerCache.canvas);
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const cCtx = c.getContext('2d')!;
        layerCache = {
          canvas: c,
          ctx: cCtx,
          lastPixels: null,
          lastPalette: null,
          lastColorMode: null,
          lastWidth: width,
          lastHeight: height,
        };
        layerCanvasCacheRef.current.set(live.layerId, layerCache);
        needsFullRaster = true;
      } else if (
        layerCache.lastColorMode !== curColorMode ||
        (curColorMode === 'indexed' && layerCache.lastPalette !== palette) ||
        layerCache.lastPixels === null
      ) {
        needsFullRaster = true;
      }

      let dirtyRegion: { x: number; y: number; w: number; h: number } | undefined;

      if (!needsFullRaster && live.dirtyRect) {
        const minX = Math.max(0, live.dirtyRect.minX);
        const minY = Math.max(0, live.dirtyRect.minY);
        const maxX = Math.min(width - 1, live.dirtyRect.maxX);
        const maxY = Math.min(height - 1, live.dirtyRect.maxY);

        if (maxX >= minX && maxY >= minY) {
          const rw = maxX - minX + 1;
          const rh = maxY - minY + 1;
          dirtyRegion = { x: minX, y: minY, w: rw, h: rh };

          // Upload using a tiny dirty-rect ImageData (a few KB instead of a permanent 33MB per-layer buffer)
          let dirtyImg = dirtyUploadImageDataRef.current;
          if (!dirtyImg || dirtyImg.width < rw || dirtyImg.height < rh) {
            dirtyImg = layerCache.ctx.createImageData(rw, rh);
            dirtyUploadImageDataRef.current = dirtyImg;
          }
          const dirtyData32 = new Uint32Array(dirtyImg.data.buffer);
          const stride = dirtyImg.width;

          if (curColorMode === 'rgba') {
            for (let row = 0; row < rh; row++) {
              const srcStart = (minY + row) * width + minX;
              dirtyData32.set(pixels.subarray(srcStart, srcStart + rw), row * stride);
            }
          } else {
            for (let row = 0; row < rh; row++) {
              const srcRowOff = (minY + row) * width + minX;
              const dstRowOff = row * stride;
              for (let col = 0; col < rw; col++) {
                const val = pixels[srcRowOff + col];
                dirtyData32[dstRowOff + col] = val === 0 ? 0 : pixelToPackedImageData(val, paletteUint32);
              }
            }
          }
          layerCache.ctx.putImageData(dirtyImg, minX, minY, 0, 0, rw, rh);

          // Shrink oversized dirty buffer if it grew large during a previous full-shape drag
          if (dirtyImg.width * dirtyImg.height > 262_144 && rw * rh < 16_384) {
            dirtyUploadImageDataRef.current = null;
          }
        } else {
          return;
        }
      } else {
        uploadPixelsToCanvas(
          layerCache.ctx,
          pixels,
          width,
          height,
          curColorMode,
          paletteUint32,
          () => {
            let uploadImg = sharedUploadImageDataRef.current;
            if (!uploadImg || uploadImg.width !== width || uploadImg.height !== height) {
              uploadImg = layerCache!.ctx.createImageData(width, height);
              if (totalPixels <= LARGE_CANVAS_PIXELS) {
                sharedUploadImageDataRef.current = uploadImg;
              }
            }
            return uploadImg;
          }
        );
      }

      layerCache.lastPixels = pixels;
      layerCache.lastPalette = palette;
      layerCache.lastColorMode = curColorMode;

      const hasValidOnion =
        onionSkinValidRef.current &&
        onionSkinCanvasRef.current !== null &&
        onionSkinCanvasRef.current.width === width &&
        onionSkinCanvasRef.current.height === height;

      const currentFrame = curState.frames[curState.activeFrameIndex];

      // Composite only the dirty sub-rect when available, otherwise full canvas
      if (dirtyRegion) {
        const { x: rx, y: ry, w: rw, h: rh } = dirtyRegion;

        offCtx.globalCompositeOperation = 'source-over';
        offCtx.globalAlpha = 1;
        offCtx.clearRect(rx, ry, rw, rh);

        if (hasValidOnion && onionSkinCanvasRef.current) {
          offCtx.globalAlpha = 80 / 255;
          offCtx.drawImage(onionSkinCanvasRef.current, rx, ry, rw, rh, rx, ry, rw, rh);
          offCtx.globalAlpha = 1;
        }

        for (let lIdx = 0; lIdx < layers.length; lIdx++) {
          const layer = layers[lIdx];
          if (layer.type === 'group') continue;
          if (!isLayerVisible(layer, layers, parentMap)) continue;
          if (layer.id !== live.layerId && !currentFrame?.layerData[layer.id]) continue;
          const layerEffOpacity = getEffectiveLayerOpacity(layer, layers, parentMap);
          if (layerEffOpacity <= 0) continue;

          const cached = layerCanvasCacheRef.current.get(layer.id);
          if (!cached || cached.lastWidth !== width || cached.lastHeight !== height) continue;

          const compositeOp: GlobalCompositeOperation =
            layer.blendMode === 'normal'
              ? 'source-over'
              : layer.blendMode === 'addition'
                ? 'lighter'
                : layer.blendMode === 'subtract' || layer.blendMode === 'divide'
                  ? 'source-over'
                  : (layer.blendMode as GlobalCompositeOperation);

          offCtx.globalAlpha = layerEffOpacity / 100;
          offCtx.globalCompositeOperation = compositeOp;
          offCtx.drawImage(cached.canvas, rx, ry, rw, rh, rx, ry, rw, rh);
          offCtx.globalAlpha = 1;
          offCtx.globalCompositeOperation = 'source-over';
        }
      } else {
        offCtx.globalCompositeOperation = 'source-over';
        offCtx.globalAlpha = 1;
        offCtx.clearRect(0, 0, width, height);

        if (hasValidOnion && onionSkinCanvasRef.current) {
          offCtx.globalAlpha = 80 / 255;
          offCtx.drawImage(onionSkinCanvasRef.current, 0, 0);
          offCtx.globalAlpha = 1;
        }

        for (let lIdx = 0; lIdx < layers.length; lIdx++) {
          const layer = layers[lIdx];
          if (layer.type === 'group') continue;
          if (!isLayerVisible(layer, layers, parentMap)) continue;
          if (layer.id !== live.layerId && !currentFrame?.layerData[layer.id]) continue;
          const layerEffOpacity = getEffectiveLayerOpacity(layer, layers, parentMap);
          if (layerEffOpacity <= 0) continue;

          const cached = layerCanvasCacheRef.current.get(layer.id);
          if (!cached || cached.lastWidth !== width || cached.lastHeight !== height) continue;

          const compositeOp: GlobalCompositeOperation =
            layer.blendMode === 'normal'
              ? 'source-over'
              : layer.blendMode === 'addition'
                ? 'lighter'
                : layer.blendMode === 'subtract' || layer.blendMode === 'divide'
                  ? 'source-over'
                  : (layer.blendMode as GlobalCompositeOperation);

          offCtx.globalAlpha = layerEffOpacity / 100;
          offCtx.globalCompositeOperation = compositeOp;
          offCtx.drawImage(cached.canvas, 0, 0);
          offCtx.globalAlpha = 1;
          offCtx.globalCompositeOperation = 'source-over';
        }
      }

      presentArtViewport();
    };

    return subscribeLiveStroke(handleLiveStroke);
  }, [presentArtViewport]);

  // Subscribe to lightweight live filled-shape vector previews (zero React re-renders during drag)
  useEffect(() => {
    return subscribeLiveShapePreview(() => {
      scheduleRenderUI();
    });
  }, [scheduleRenderUI]);

  // UI Rendering Effect (Grid, Selection, Shape Preview, Brush)
  const renderUI = useCallback(() => {
    const canvas = uiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const z = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;
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
    if (selectionMask && selectionMask.size > 0) {
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

    // 5b. Draw Live Filled-Shape Vector Preview (instant GPU overlay for 4K filled-rect / filled-ellipse)
    const shapePreview = getLiveShapePreview();
    if (shapePreview && shapePreview.projectId === projectId) {
        const rects: { l: number; t: number; r: number; b: number }[] = [
          { l: shapePreview.left, t: shapePreview.top, r: shapePreview.right, b: shapePreview.bottom },
        ];
        if (symmetryX) {
          rects.push({
            l: width - 1 - shapePreview.right,
            t: shapePreview.top,
            r: width - 1 - shapePreview.left,
            b: shapePreview.bottom,
          });
        }
        if (symmetryY) {
          rects.push({
            l: shapePreview.left,
            t: height - 1 - shapePreview.bottom,
            r: shapePreview.right,
            b: height - 1 - shapePreview.top,
          });
        }
        if (symmetryX && symmetryY) {
          rects.push({
            l: width - 1 - shapePreview.right,
            t: height - 1 - shapePreview.bottom,
            r: width - 1 - shapePreview.left,
            b: height - 1 - shapePreview.top,
          });
        }

        ctx.save();
        ctx.translate(px, py);
        ctx.beginPath();
        ctx.rect(0, 0, width * z, height * z);
        ctx.clip();

        ctx.beginPath();
        for (let i = 0; i < rects.length; i++) {
          const item = rects[i];
          const rx = item.l * z;
          const ry = item.t * z;
          const rw = (item.r - item.l + 1) * z;
          const rh = (item.b - item.t + 1) * z;
          if (shapePreview.tool === 'filled-rect') {
            ctx.rect(rx, ry, rw, rh);
          } else {
            ctx.moveTo(rx + rw, ry + rh / 2);
            ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
          }
        }

        ctx.save();
        ctx.globalAlpha = shapePreview.isShading ? 0.25 : 0.65;
        ctx.fillStyle = shapePreview.isShading ? '#ffffff' : shapePreview.colorHex;
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.stroke();
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -dashOffset;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();
    }

    // 6. Draw Brush Preview (Optimized with direct rect & contour caching)
    const isBrushTool = ['pencil', 'eraser', 'smudge', 'blur', 'sharpen', 'color-replace'].includes(tool);
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
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
  }, [projectId, containerSize, showGrid, width, height, symmetryX, symmetryY, tool, brushSize, brushShape, selectionMask, selectionBorderSegments, selectionBoundingBox, startPos, polyPoints, isMoving, isDrawing, moveOffset, isRotating, rotationAngle, rotationPivot, isScaling, currentBox]);

  useLayoutEffect(() => {
    renderUIRef.current = renderUI;
  });

  useEffect(() => {
    renderUI();
  }, [renderUI]);

  const hasMarchingAnts = Boolean(
    (selectionMask && selectionMask.size > 0) || 
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
  const spriteLeft = pan.x;
  const spriteTop = pan.y;
  const spriteRight = pan.x + width * localZoom;
  const spriteBottom = pan.y + height * localZoom;
  const clipLeft = Math.max(0, spriteLeft);
  const clipTop = Math.max(0, spriteTop);
  const clipRight = Math.min(containerSize.width, spriteRight);
  const clipBottom = Math.min(containerSize.height, spriteBottom);
  const hasVisibleSprite = clipRight > clipLeft && clipBottom > clipTop;

  return (
    <div 
        ref={containerRef}
        className="w-full h-full flex-1 bg-canvas overflow-hidden relative shadow-inner border-l border-r border-background touch-none"
        style={{ cursor: showCursor && useCustomCursor ? 'none' : 'crosshair' }}
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
          ref={referenceImageElRef}
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

      {/* Viewport-Clamped Checkerboard Backdrop (imperatively positioned during pan/zoom gestures) */}
      <div
        ref={checkerboardRef}
        className="absolute top-0 left-0 shadow-2xl pointer-events-none"
        style={{
          display: hasVisibleSprite ? 'block' : 'none',
          width: `${Math.max(0, clipRight - clipLeft)}px`,
          height: `${Math.max(0, clipBottom - clipTop)}px`,
          transform: `translate(${clipLeft}px, ${clipTop}px)`,
          transformOrigin: 'top left',
          backgroundImage: 'conic-gradient(var(--checker-a) 90deg, var(--checker-b) 90deg 180deg, var(--checker-a) 180deg 270deg, var(--checker-b) 270deg)',
          backgroundPosition: `${spriteLeft - clipLeft}px ${spriteTop - clipTop}px`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Viewport-Sized Art Canvas (Main Sprite + GPU Tiled Mode Overlays) */}
      <canvas
        ref={artCanvasRef}
        width={Math.floor(containerSize.width * dpr)}
        height={Math.floor(containerSize.height * dpr)}
        style={{ width: `${containerSize.width}px`, height: `${containerSize.height}px` }}
        className="absolute inset-0 pointer-events-none"
      />

      {/* UI Overlay Layer (Grid, Selection, Handles) */}
      <canvas
        ref={uiCanvasRef}
        width={Math.floor(containerSize.width * dpr)}
        height={Math.floor(containerSize.height * dpr)}
        style={{ width: `${containerSize.width}px`, height: `${containerSize.height}px` }}
        className="absolute inset-0 pointer-events-none"
      />

      {showCursor && useCustomCursor && (
        <div
          ref={(el) => {
            cursorRef.current = el;
            if (el) {
              el.style.transform = `translate(${mousePosRef.current.x}px, ${mousePosRef.current.y}px)`;
            }
          }}
          className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
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
