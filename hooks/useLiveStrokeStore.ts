import { PixelGrid } from '../types';

export interface DirtyRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LiveStrokePayload {
  projectId: string;
  frameIndex: number;
  layerId: string;
  pixels: PixelGrid;
  dirtyRect: DirtyRect | null;
  fullRedraw?: boolean;
}

export interface LiveShapePreview {
  projectId: string;
  tool: 'filled-rect' | 'filled-ellipse';
  left: number;
  top: number;
  right: number;
  bottom: number;
  colorHex: string;
  isShading: boolean;
}

type LiveStrokeListener = (payload: LiveStrokePayload | null) => void;
type LiveShapePreviewListener = (preview: LiveShapePreview | null) => void;

let currentLiveStroke: LiveStrokePayload | null = null;
let currentLiveShapePreview: LiveShapePreview | null = null;
const listeners = new Set<LiveStrokeListener>();
const shapePreviewListeners = new Set<LiveShapePreviewListener>();

export const publishLiveStroke = (payload: LiveStrokePayload) => {
  currentLiveStroke = payload;
  listeners.forEach((listener) => listener(payload));
};

export const clearLiveStroke = () => {
  if (currentLiveStroke === null) return;
  currentLiveStroke = null;
  listeners.forEach((listener) => listener(null));
};

export const getLiveStroke = (): LiveStrokePayload | null => currentLiveStroke;

export const subscribeLiveStroke = (listener: LiveStrokeListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const publishLiveShapePreview = (preview: LiveShapePreview) => {
  currentLiveShapePreview = preview;
  shapePreviewListeners.forEach((listener) => listener(preview));
};

export const clearLiveShapePreview = () => {
  if (currentLiveShapePreview === null) return;
  currentLiveShapePreview = null;
  shapePreviewListeners.forEach((listener) => listener(null));
};

export const getLiveShapePreview = (): LiveShapePreview | null => currentLiveShapePreview;

export const subscribeLiveShapePreview = (listener: LiveShapePreviewListener) => {
  shapePreviewListeners.add(listener);
  return () => {
    shapePreviewListeners.delete(listener);
  };
};
