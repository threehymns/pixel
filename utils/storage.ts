import { ProjectState, RecentProject } from '../types';
import { encodeAseprite, parseAseprite } from './aseprite';

const DB_NAME = 'pixelforge_db';
const DB_VERSION = 1;
const STORE_RECENTS = 'recents_meta';
const STORE_BLOBS = 'project_blobs';
const MAX_RECENTS = 10;

interface StoredBlobRecord {
  id: string;
  title: string;
  asepriteBinary: Uint8Array;
  updatedAt: number;
  extra?: {
    paletteLibrary?: any[];
    activePaletteId?: string;
    primaryColor?: string;
    secondaryColor?: string;
    symmetry?: { x: boolean; y: boolean };
    inkType?: string;
    shades?: string[];
    tool?: string;
    brushSize?: number;
    brushShape?: 'square' | 'circle';
    zoom?: number;
    activeLayerId?: string;
    activeFrameIndex?: number;
    originalLayerIds?: string[];
    originalFrameIds?: string[];
    colorMode?: 'indexed' | 'rgba';
  };
}

// In-memory fallback if IndexedDB is blocked or unavailable in the environment
const memoryRecents = new Map<string, RecentProject>();
const memoryBlobs = new Map<string, StoredBlobRecord>();

let isIndexedDBAvailable: boolean | null = null;

function checkIDBAvailability(): boolean {
  if (isIndexedDBAvailable !== null) return isIndexedDBAvailable;
  try {
    if (typeof window === 'undefined' || !window.indexedDB) {
      isIndexedDBAvailable = false;
      return false;
    }
    isIndexedDBAvailable = true;
    return true;
  } catch {
    isIndexedDBAvailable = false;
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!checkIDBAvailability()) {
      return reject(new Error('IndexedDB not supported or accessible'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_RECENTS)) {
          const recentsStore = db.createObjectStore(STORE_RECENTS, { keyPath: 'id' });
          recentsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB blocked'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Saves project to IndexedDB:
 * 1. Serializes pixel data into compressed .aseprite binary (deflated cels).
 * 2. Stores binary in project_blobs store.
 * 3. Stores lightweight metadata (id, title, width, height, timestamp) in recents store.
 * 4. Trims recents list to MAX_RECENTS and purges old blobs.
 */
export async function saveRecentProject(project: ProjectState): Promise<RecentProject> {
  const metadata: RecentProject = {
    id: project.id,
    title: project.title,
    width: project.width,
    height: project.height,
    timestamp: Date.now()
  };

  try {
    // Compress to .aseprite binary
    const asepriteBinary = encodeAseprite(project);

    const blobRecord: StoredBlobRecord = {
      id: project.id,
      title: project.title,
      asepriteBinary,
      updatedAt: metadata.timestamp,
      extra: {
        paletteLibrary: project.paletteLibrary,
        activePaletteId: project.activePaletteId,
        primaryColor: project.primaryColor,
        secondaryColor: project.secondaryColor,
        symmetry: project.symmetry,
        inkType: project.inkType,
        shades: project.shades,
        tool: project.tool,
        brushSize: project.brushSize,
        brushShape: project.brushShape,
        zoom: project.zoom,
        activeLayerId: project.activeLayerId,
        activeFrameIndex: project.activeFrameIndex,
        originalLayerIds: project.layers.map(l => l.id),
        originalFrameIds: project.frames.map(f => f.id),
        colorMode: project.colorMode
      }
    };

    if (checkIDBAvailability()) {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_RECENTS, STORE_BLOBS], 'readwrite');
        const recentsStore = tx.objectStore(STORE_RECENTS);
        const blobsStore = tx.objectStore(STORE_BLOBS);

        recentsStore.put(metadata);
        blobsStore.put(blobRecord);

        // Fetch all recents to prune excess
        const getAllReq = recentsStore.getAll();
        getAllReq.onsuccess = () => {
          const allRecents: RecentProject[] = getAllReq.result || [];
          if (allRecents.length > MAX_RECENTS) {
            allRecents.sort((a, b) => b.timestamp - a.timestamp);
            const toRemove = allRecents.slice(MAX_RECENTS);
            for (const item of toRemove) {
              recentsStore.delete(item.id);
              blobsStore.delete(item.id);
            }
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } else {
      memoryRecents.set(metadata.id, metadata);
      memoryBlobs.set(blobRecord.id, blobRecord);
    }
  } catch (err) {
    console.warn('Failed to save project to IndexedDB, using memory fallback:', err);
    memoryRecents.set(metadata.id, metadata);
  }

  return metadata;
}

/**
 * Retrieves the list of recent projects metadata from IndexedDB.
 */
export async function getRecentProjects(): Promise<RecentProject[]> {
  if (!checkIDBAvailability()) {
    return Array.from(memoryRecents.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_RECENTS, 'readonly');
      const store = tx.objectStore(STORE_RECENTS);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: RecentProject[] = req.result || [];
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items.slice(0, MAX_RECENTS));
      };

      req.onerror = () => {
        console.warn('Failed to query recents from IndexedDB:', req.error);
        resolve(Array.from(memoryRecents.values()).sort((a, b) => b.timestamp - a.timestamp));
      };
    });
  } catch (err) {
    console.warn('IndexedDB unavailable when getting recents:', err);
    return Array.from(memoryRecents.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

/**
 * Loads and reconstructs a full ProjectState from its compressed .aseprite binary.
 */
export async function loadRecentProjectState(id: string): Promise<ProjectState | null> {
  let record: StoredBlobRecord | null = null;

  if (checkIDBAvailability()) {
    try {
      const db = await openDB();
      record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const store = tx.objectStore(STORE_BLOBS);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('IndexedDB failed to load project blob:', err);
    }
  }

  if (!record) {
    record = memoryBlobs.get(id) || null;
  }

  if (!record || !record.asepriteBinary) {
    return null;
  }

  try {
    // Decompress and parse the .aseprite binary
    const parsed = await parseAseprite(record.asepriteBinary.buffer, record.title);

    // Ensure the original project ID and title are preserved
    parsed.id = record.id;
    parsed.title = record.title;

    // Restore original layer IDs and rewire frame.layerData
    if (record.extra?.originalLayerIds && record.extra.originalLayerIds.length === parsed.layers.length) {
      const oldLayerIds = parsed.layers.map(l => l.id);
      const newLayerIds = record.extra.originalLayerIds;
      
      parsed.layers.forEach((layer, idx) => {
        layer.id = newLayerIds[idx];
      });

      parsed.frames.forEach(frame => {
        const remappedData: Record<string, any> = {};
        oldLayerIds.forEach((oldId, idx) => {
          if (frame.layerData[oldId]) {
            remappedData[newLayerIds[idx]] = frame.layerData[oldId];
          }
        });
        frame.layerData = remappedData;
      });

      if (record.extra.activeLayerId && newLayerIds.includes(record.extra.activeLayerId)) {
        parsed.activeLayerId = record.extra.activeLayerId;
        parsed.selectedLayerIds = [record.extra.activeLayerId];
      }
    }

    // Restore original frame IDs
    if (record.extra?.originalFrameIds && record.extra.originalFrameIds.length === parsed.frames.length) {
      parsed.frames.forEach((frame, idx) => {
        frame.id = record.extra!.originalFrameIds![idx];
      });
      if (typeof record.extra.activeFrameIndex === 'number' && record.extra.activeFrameIndex < parsed.frames.length) {
        parsed.activeFrameIndex = record.extra.activeFrameIndex;
        parsed.selectedFrameIndices = [record.extra.activeFrameIndex];
      }
    }

    // Restore any extra preserved properties
    if (record.extra) {
      if (record.extra.paletteLibrary) parsed.paletteLibrary = record.extra.paletteLibrary;
      if (record.extra.activePaletteId) parsed.activePaletteId = record.extra.activePaletteId;
      if (record.extra.primaryColor) parsed.primaryColor = record.extra.primaryColor;
      if (record.extra.secondaryColor) parsed.secondaryColor = record.extra.secondaryColor;
      if (record.extra.symmetry) parsed.symmetry = record.extra.symmetry;
      if (record.extra.inkType) parsed.inkType = record.extra.inkType as any;
      if (record.extra.shades) parsed.shades = record.extra.shades;
      if (record.extra.tool) parsed.tool = record.extra.tool as any;
      if (record.extra.brushSize) parsed.brushSize = record.extra.brushSize;
      if (record.extra.brushShape) parsed.brushShape = record.extra.brushShape;
      if (record.extra.zoom) parsed.zoom = record.extra.zoom;
      if (record.extra.colorMode) parsed.colorMode = record.extra.colorMode;
    }

    parsed.selection = null;
    parsed.fileHandle = undefined;

    return parsed;
  } catch (err) {
    console.error('Failed to parse aseprite binary for recent project:', err);
    return null;
  }
}

/**
 * Clears all recent projects and their binary files from IndexedDB.
 */
export async function clearAllRecents(): Promise<void> {
  memoryRecents.clear();
  memoryBlobs.clear();

  if (!checkIDBAvailability()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_RECENTS, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_RECENTS).clear();
      tx.objectStore(STORE_BLOBS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to clear recents in IndexedDB:', err);
  }
}

/**
 * Deletes a single recent project and its binary file.
 */
export async function deleteRecentProject(id: string): Promise<void> {
  memoryRecents.delete(id);
  memoryBlobs.delete(id);

  if (!checkIDBAvailability()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_RECENTS, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_RECENTS).delete(id);
      tx.objectStore(STORE_BLOBS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete recent project in IndexedDB:', err);
  }
}
