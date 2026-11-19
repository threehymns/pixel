import { useSyncExternalStore } from 'react';
import { Position } from '../types';

type Listener = () => void;

let currentMousePos: Position | null = null;
let currentDragStartPos: Position | null = null;
let currentLiveZoom: number | null = null;

const mouseListeners = new Set<Listener>();
const dragStartListeners = new Set<Listener>();
const zoomListeners = new Set<Listener>();

const emit = (listeners: Set<Listener>) => {
  listeners.forEach((listener) => listener());
};

export const setCursorMousePos = (pos: Position | null) => {
  if (
    currentMousePos === pos ||
    (currentMousePos !== null &&
      pos !== null &&
      currentMousePos.x === pos.x &&
      currentMousePos.y === pos.y)
  ) {
    return;
  }
  currentMousePos = pos;
  emit(mouseListeners);
};

export const setCursorDragStartPos = (pos: Position | null) => {
  if (
    currentDragStartPos === pos ||
    (currentDragStartPos !== null &&
      pos !== null &&
      currentDragStartPos.x === pos.x &&
      currentDragStartPos.y === pos.y)
  ) {
    return;
  }
  currentDragStartPos = pos;
  emit(dragStartListeners);
};

export const setLiveZoom = (zoom: number | null) => {
  if (currentLiveZoom === zoom) return;
  currentLiveZoom = zoom;
  emit(zoomListeners);
};

const subscribeMousePos = (listener: Listener) => {
  mouseListeners.add(listener);
  return () => {
    mouseListeners.delete(listener);
  };
};

const subscribeDragStartPos = (listener: Listener) => {
  dragStartListeners.add(listener);
  return () => {
    dragStartListeners.delete(listener);
  };
};

const subscribeLiveZoom = (listener: Listener) => {
  zoomListeners.add(listener);
  return () => {
    zoomListeners.delete(listener);
  };
};

const getMousePosSnapshot = () => currentMousePos;
const getDragStartPosSnapshot = () => currentDragStartPos;
const getLiveZoomSnapshot = () => currentLiveZoom;

export const useCursorMousePos = (): Position | null =>
  useSyncExternalStore(subscribeMousePos, getMousePosSnapshot, getMousePosSnapshot);

export const useCursorDragStartPos = (): Position | null =>
  useSyncExternalStore(subscribeDragStartPos, getDragStartPosSnapshot, getDragStartPosSnapshot);

export const useLiveZoom = (): number | null =>
  useSyncExternalStore(subscribeLiveZoom, getLiveZoomSnapshot, getLiveZoomSnapshot);
