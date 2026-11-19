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

type LiveStrokeListener = (payload: LiveStrokePayload | null) => void;

let currentLiveStroke: LiveStrokePayload | null = null;
const listeners = new Set<LiveStrokeListener>();

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
