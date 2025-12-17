
import { useState, useCallback } from 'react';
import { FileSystemDirectoryHandle, FileSystemFileHandle } from '../types';

export function useFileSystem() {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const openFolder = useCallback(async () => {
    try {
      // @ts-ignore - showDirectoryPicker is experimental/modern
      const handle = await window.showDirectoryPicker();
      if (handle) {
        setRootHandle(handle);
      }
    } catch (e) {
      // User cancelled or not supported
      if ((e as Error).name !== 'AbortError') {
        console.error("File System Access API error:", e);
        alert("Could not open folder. This feature requires a modern browser like Chrome or Edge.");
      }
    }
  }, []);

  const getFile = useCallback(async (handle: FileSystemFileHandle): Promise<File> => {
    return await handle.getFile();
  }, []);

  return {
    rootHandle,
    openFolder,
    getFile
  };
}
