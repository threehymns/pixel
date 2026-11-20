import { useSyncExternalStore } from 'react';

export interface StatusMessage {
  text: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

type Listener = () => void;

let currentStatusMessage: StatusMessage = { text: '', type: 'info' };
const listeners = new Set<Listener>();

export const setStatusMessage = (next: StatusMessage) => {
  if (
    currentStatusMessage.text === next.text &&
    currentStatusMessage.type === next.type
  ) {
    return;
  }
  currentStatusMessage = next;
  listeners.forEach((listener) => listener());
};

const subscribeStatusMessage = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getStatusMessageSnapshot = () => currentStatusMessage;

export const useStatusMessage = (): StatusMessage =>
  useSyncExternalStore(
    subscribeStatusMessage,
    getStatusMessageSnapshot,
    getStatusMessageSnapshot
  );
