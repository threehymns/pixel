
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ProjectState, Frame, Layer, FrameTag, SavedPalette, PixelGrid, HistoryEntry, PixelHistoryPatch, PixelLayerPatch, ToolType, RecentProject, FileSystemFileHandle, ProjectInstance, ColorMode, PixelValue, Slice } from '../types';
import { INITIAL_STATE, DEFAULT_PALETTE, GAMEBOY_PALETTE, ENDESGA_64_PALETTE } from '../constants';
import {
  EMPTY_PIXEL,
  createPixelGrid,
  clonePixelGrid,
  packRGBA,
  encodeIndexedPixel,
  getPackedColor,
  getPackedPalette255,
  pixelToPackedImageData,
  pixelToRgb,
  resolveColorToPixel,
  computeInitialZoom,
  applyRectPatch,
  buildLayerPatch,
  parseASE,
  parseGPL,
  extractColorsFromPNG,
  fileToProjectState,
  renderFrameToCanvas,
  renderSpriteSheet,
  getCoords,
  getIndex,
  hexToRgb,
  findNearestPaletteIndex,
  getSelectionBoundingBox,
  isDescendant,
  getGroupChildren,
  SelectionMask,
  releaseScratchRenderBuffers,
} from '../utils';
import { encodeAsepriteAsync } from '../utils/asepriteWorkerClient';
import { saveRecentProject, getRecentProjects, loadRecentProjectState, clearAllRecents } from '../utils/storage';
import { applyOutlineEffect, DEFAULT_OUTLINE_MATRIX } from '../utils/outline';
import { toast } from '../components/ui/toast';

interface PersistedDocSignature {
  title: string;
  width: number;
  height: number;
  colorMode: ColorMode;
  frames: Frame[];
  layers: Layer[];
  palette: string[];
  paletteLibrary: SavedPalette[];
  paletteNames?: Record<number, string>;
  tags?: FrameTag[];
  slices?: Slice[];
  tilesets?: ProjectState['tilesets'];
  externalFiles?: ProjectState['externalFiles'];
  colorProfile?: ProjectState['colorProfile'];
  transparentIndex?: number;
  grid?: ProjectState['grid'];
  pixelRatio?: ProjectState['pixelRatio'];
  userData?: ProjectState['userData'];
}

function makeDocSignature(s: ProjectState): PersistedDocSignature {
  return {
    title: s.title,
    width: s.width,
    height: s.height,
    colorMode: s.colorMode,
    frames: s.frames,
    layers: s.layers,
    palette: s.palette,
    paletteLibrary: s.paletteLibrary,
    paletteNames: s.paletteNames,
    tags: s.tags,
    slices: s.slices,
    tilesets: s.tilesets,
    externalFiles: s.externalFiles,
    colorProfile: s.colorProfile,
    transparentIndex: s.transparentIndex,
    grid: s.grid,
    pixelRatio: s.pixelRatio,
    userData: s.userData,
  };
}

function isSameDocSignature(a: PersistedDocSignature, b: PersistedDocSignature): boolean {
  return (
    a.title === b.title &&
    a.width === b.width &&
    a.height === b.height &&
    a.colorMode === b.colorMode &&
    a.frames === b.frames &&
    a.layers === b.layers &&
    a.palette === b.palette &&
    a.paletteLibrary === b.paletteLibrary &&
    a.paletteNames === b.paletteNames &&
    a.tags === b.tags &&
    a.slices === b.slices &&
    a.tilesets === b.tilesets &&
    a.externalFiles === b.externalFiles &&
    a.colorProfile === b.colorProfile &&
    a.transparentIndex === b.transparentIndex &&
    a.grid === b.grid &&
    a.pixelRatio === b.pixelRatio &&
    a.userData === b.userData
  );
}

export type ProjectStateUpdater = ProjectState | ((prev: ProjectState) => ProjectState);

export interface ProjectTabItem {
  id: string;
  title: string;
  isDirty: boolean;
}

function deriveProjectTabs(projects: ProjectInstance[], prevTabs?: ProjectTabItem[]): ProjectTabItem[] {
  if (prevTabs && prevTabs.length === projects.length) {
    let same = true;
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      const prev = prevTabs[i];
      const isDirty = p.historyIndex !== p.lastSavedHistoryIndex;
      if (prev.id !== p.data.id || prev.title !== p.data.title || prev.isDirty !== isDirty) {
        same = false;
        break;
      }
    }
    if (same) return prevTabs;
  }
  return projects.map(p => ({
    id: p.data.id,
    title: p.data.title,
    isDirty: p.historyIndex !== p.lastSavedHistoryIndex,
  }));
}

// UI fields that should not be affected by Undo/Redo
const UI_FIELDS: (keyof ProjectState)[] = [
    'tool',
    'primaryColor',
    'secondaryColor',
    'brushSize',
    'brushShape',
    'fillContiguous',
    'pixelPerfect',
    'zoom',
    'onionSkin',
    'showGrid',
    'selectionMode',
    'activePaletteId',
    'ditheringEnabled',
    'smudgeMode',
    'smudgeStrength'
];

interface PixelPoint {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

const SPATIAL_CELL_SHIFT = 3; // 8x8 cells
const SPATIAL_CELL_SIZE = 1 << SPATIAL_CELL_SHIFT;

/**
 * Builds an exact expanding-ring spatial grid index for fast nearest-neighbor queries.
 * Falls back to a tight linear scan (without Math.pow) for small point clouds.
 */
const createSpatialPointFinder = (list: PixelPoint[]): ((point: { x: number; y: number }) => PixelPoint) => {
  if (list.length <= 64) {
    return (point) => {
      let minDist = Infinity;
      let nearest = list[0];
      const px = point.x;
      const py = point.y;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const dx = px - p.x;
        const dy = py - p.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
          if (dist === 0) break;
        }
      }
      return nearest;
    };
  }

  const grid = new Map<number, PixelPoint[]>();
  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCy = Infinity;
  let maxCy = -Infinity;

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const cx = p.x >> SPATIAL_CELL_SHIFT;
    const cy = p.y >> SPATIAL_CELL_SHIFT;
    if (cx < minCx) minCx = cx;
    if (cx > maxCx) maxCx = cx;
    if (cy < minCy) minCy = cy;
    if (cy > maxCy) maxCy = cy;
    const key = (cx << 16) ^ (cy & 0xffff);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(p);
  }

  return (point) => {
    const px = point.x;
    const py = point.y;
    const cx = px >> SPATIAL_CELL_SHIFT;
    const cy = py >> SPATIAL_CELL_SHIFT;

    let minDist = Infinity;
    let nearest = list[0];

    const maxR = Math.max(
      Math.abs(cx - minCx),
      Math.abs(cx - maxCx),
      Math.abs(cy - minCy),
      Math.abs(cy - maxCy)
    );

    const checkCell = (tx: number, ty: number) => {
      const bucket = grid.get((tx << 16) ^ (ty & 0xffff));
      if (!bucket) return;
      for (let i = 0; i < bucket.length; i++) {
        const p = bucket[i];
        const dx = px - p.x;
        const dy = py - p.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
    };

    for (let r = 0; r <= maxR; r++) {
      if (r === 0) {
        if (cx >= minCx && cx <= maxCx && cy >= minCy && cy <= maxCy) {
          checkCell(cx, cy);
        }
      } else {
        const xStart = Math.max(minCx, cx - r);
        const xEnd = Math.min(maxCx, cx + r);

        const topY = cy - r;
        if (topY >= minCy && topY <= maxCy) {
          for (let tx = xStart; tx <= xEnd; tx++) checkCell(tx, topY);
        }
        const botY = cy + r;
        if (botY >= minCy && botY <= maxCy) {
          for (let tx = xStart; tx <= xEnd; tx++) checkCell(tx, botY);
        }
        const leftX = cx - r;
        if (leftX >= minCx && leftX <= maxCx) {
          const innerYStart = Math.max(minCy, cy - r + 1);
          const innerYEnd = Math.min(maxCy, cy + r - 1);
          for (let ty = innerYStart; ty <= innerYEnd; ty++) checkCell(leftX, ty);
        }
        const rightX = cx + r;
        if (rightX >= minCx && rightX <= maxCx) {
          const innerYStart = Math.max(minCy, cy - r + 1);
          const innerYEnd = Math.min(maxCy, cy + r - 1);
          for (let ty = innerYStart; ty <= innerYEnd; ty++) checkCell(rightX, ty);
        }
      }

      if (minDist === 0) break;
      const nextRingMinDist = r * SPATIAL_CELL_SIZE + 1;
      if (minDist <= nextRingMinDist * nextRingMinDist) break;
    }

    return nearest;
  };
};

function getNextLayerName(layers: Layer[], prefix: string): string {
  const existingNames = new Set(layers.map((l) => l.name));
  let n = 1;
  while (existingNames.has(`${prefix} ${n}`)) {
    n++;
  }
  return `${prefix} ${n}`;
}

async function renderActiveFramePngBlob(state: ProjectState): Promise<Blob> {
  const canvas = renderFrameToCanvas(state, state.activeFrameIndex);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('Failed to render PNG');
  }
  return blob;
}

async function loadAndNormalizeProjectFile(
  file: File,
  handle?: FileSystemFileHandle
): Promise<ProjectState> {
  const newState = await fileToProjectState(file);
  newState.id = `project-${Date.now()}`;

  if (handle) {
    newState.fileHandle = handle;
  }

  if (!newState.paletteLibrary || newState.paletteLibrary.length === 0) {
    newState.paletteLibrary = [ENDESGA_64_PALETTE, DEFAULT_PALETTE, GAMEBOY_PALETTE];
    newState.activePaletteId = ENDESGA_64_PALETTE.id;
  }

  if (!newState.selectedLayerIds) newState.selectedLayerIds = [newState.activeLayerId];
  if (!newState.selectedFrameIndices) newState.selectedFrameIndices = [newState.activeFrameIndex];

  return newState;
}

function applyFloydSteinbergDither(
  sourceGrid: PixelGrid,
  targetGrid: PixelGrid,
  width: number,
  height: number,
  sourcePalette: string[],
  newPalette: string[]
): void {
  const errorBufferR = new Float32Array(width * height);
  const errorBufferG = new Float32Array(width * height);
  const errorBufferB = new Float32Array(width * height);

  const offsets: readonly [number, number, number][] = [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = getIndex(x, y, width);
      const val = sourceGrid[i];
      if (val === EMPTY_PIXEL) continue;

      const rgb = pixelToRgb(val, sourcePalette);
      if (!rgb) continue;

      const curR = Math.max(0, Math.min(255, rgb[0] + errorBufferR[i]));
      const curG = Math.max(0, Math.min(255, rgb[1] + errorBufferG[i]));
      const curB = Math.max(0, Math.min(255, rgb[2] + errorBufferB[i]));

      const paletteIndex = findNearestPaletteIndex(curR, curG, curB, newPalette);
      targetGrid[i] = encodeIndexedPixel(paletteIndex);

      const [pr, pg, pb] = hexToRgb(newPalette[paletteIndex]);
      const errR = curR - pr;
      const errG = curG - pg;
      const errB = curB - pb;

      for (let k = 0; k < offsets.length; k++) {
        const [dx, dy, factor] = offsets[k];
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = getIndex(nx, ny, width);
          errorBufferR[ni] += errR * factor;
          errorBufferG[ni] += errG * factor;
          errorBufferB[ni] += errB * factor;
        }
      }
    }
  }
}

function convertFramesColorMode(
  frames: Frame[],
  width: number,
  height: number,
  targetMode: ColorMode,
  palette: string[],
  ditheringEnabled: boolean
): Frame[] {
  const totalPixels = width * height;
  if (targetMode === 'indexed') {
    if (palette.length === 0) return frames;
    return frames.map(f => {
      const newLayerData: Record<string, PixelGrid> = {};
      Object.keys(f.layerData).forEach(lid => {
        const sourceGrid = f.layerData[lid];
        const targetGrid = createPixelGrid(totalPixels);
        if (!ditheringEnabled) {
          const len = Math.min(sourceGrid.length, totalPixels);
          for (let i = 0; i < len; i++) {
            const val = sourceGrid[i];
            if (val === EMPTY_PIXEL) continue;
            const rgb = pixelToRgb(val, palette);
            if (!rgb) continue;
            targetGrid[i] = encodeIndexedPixel(findNearestPaletteIndex(rgb[0], rgb[1], rgb[2], palette));
          }
        } else {
          applyFloydSteinbergDither(sourceGrid, targetGrid, width, height, palette, palette);
        }
        newLayerData[lid] = targetGrid;
      });
      return { ...f, layerData: newLayerData };
    });
  }

  // Indexed -> RGBA
  const paletteUint32 = getPackedPalette255(palette);
  const fallbackBlack = packRGBA(0, 0, 0, 255);
  return frames.map(f => {
    const newLayerData: Record<string, PixelGrid> = {};
    Object.keys(f.layerData).forEach(lid => {
      const src = f.layerData[lid];
      const dst = createPixelGrid(src.length);
      for (let i = 0; i < src.length; i++) {
        const val = src[i];
        if (val === EMPTY_PIXEL) continue;
        const packed = pixelToPackedImageData(val, paletteUint32);
        dst[i] = packed !== 0 ? packed : fallbackBlack;
      }
      newLayerData[lid] = dst;
    });
    return { ...f, layerData: newLayerData };
  });
}

// --- Patch-Based History Helpers ---

const MAX_HISTORY_ENTRIES = 50;
const MAX_HISTORY_BYTES = 512 * 1024 * 1024; // 512 MB cap to prevent OOM on 4K images

function applyPixelHistoryPatch(
  baseState: ProjectState,
  patch: PixelHistoryPatch,
  direction: 'before' | 'after'
): ProjectState {
  const frameIdx = patch.frameIndex;
  const targetFrame = baseState.frames[frameIdx];
  if (!targetFrame) return baseState;

  const nextLayerData = { ...targetFrame.layerData };
  const totalPixels = baseState.width * baseState.height;

  for (let i = 0; i < patch.layers.length; i++) {
    const lp = patch.layers[i];
    const existing = nextLayerData[lp.layerId];
    const cloned = existing ? clonePixelGrid(existing) : createPixelGrid(totalPixels);
    const data = direction === 'before' ? lp.before : lp.after;
    applyRectPatch(cloned, baseState.width, lp.x, lp.y, lp.w, lp.h, data);
    nextLayerData[lp.layerId] = cloned;
  }

  const nextFrames = baseState.frames.slice();
  nextFrames[frameIdx] = {
    ...targetFrame,
    layerData: nextLayerData,
  };

  let nextSelection = baseState.selection;
  if (direction === 'before' && patch.selectionBefore !== undefined) {
    nextSelection = patch.selectionBefore;
  } else if (direction === 'after' && patch.selectionAfter !== undefined) {
    nextSelection = patch.selectionAfter;
  }

  return {
    ...baseState,
    frames: nextFrames,
    selection: nextSelection,
  };
}

function materializeHistoryState(history: HistoryEntry[], targetIndex: number): ProjectState | null {
  if (targetIndex < 0 || targetIndex >= history.length) return null;

  const targetEntry = history[targetIndex];
  if (targetEntry.kind === 'snapshot' && targetEntry.state) {
    return targetEntry.state;
  }

  let snapIdx = targetIndex;
  while (snapIdx >= 0) {
    const entry = history[snapIdx];
    if (entry.kind === 'snapshot' && entry.state) break;
    snapIdx--;
  }
  if (snapIdx < 0 || !history[snapIdx].state) return null;

  let curState = history[snapIdx].state!;
  for (let i = snapIdx + 1; i <= targetIndex; i++) {
    const entry = history[i];
    if (entry.kind === 'snapshot' && entry.state) {
      curState = entry.state;
    } else if (entry.kind === 'pixel-patch' && entry.patch) {
      curState = applyPixelHistoryPatch(curState, entry.patch, 'after');
    }
  }
  return curState;
}

function estimateHistoryBytes(history: HistoryEntry[]): number {
  const seenGrids = new Set<PixelGrid>();
  let bytes = 0;
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    if (entry.kind === 'pixel-patch' && entry.patch) {
      for (let j = 0; j < entry.patch.layers.length; j++) {
        const lp = entry.patch.layers[j];
        bytes += lp.before.byteLength + lp.after.byteLength;
      }
      if (entry.patch.selectionBefore) bytes += entry.patch.selectionBefore.byteLength;
      if (entry.patch.selectionAfter) bytes += entry.patch.selectionAfter.byteLength;
    } else if (entry.kind === 'snapshot' && entry.state) {
      if (entry.state.selection) bytes += entry.state.selection.byteLength;
      const frames = entry.state.frames;
      for (let f = 0; f < frames.length; f++) {
        const ld = frames[f].layerData;
        for (const lid in ld) {
          const grid = ld[lid];
          if (grid && !seenGrids.has(grid)) {
            seenGrids.add(grid);
            bytes += grid.byteLength;
          }
        }
      }
    }
  }
  return bytes;
}

function shiftHistoryBase(history: HistoryEntry[]): void {
  if (history.length <= 1) return;
  const oldBase = history.shift()!;
  const newBase = history[0];
  if (newBase.kind === 'pixel-patch' && newBase.patch && oldBase.state) {
    const materialized = applyPixelHistoryPatch(oldBase.state, newBase.patch, 'after');
    history[0] = {
      kind: 'snapshot',
      state: materialized,
      action: newBase.action,
      tool: newBase.tool,
      timestamp: newBase.timestamp,
    };
  }
}

/**
 * Helper to merge current UI state into a historical snapshot.
 * This ensures Undo/Redo doesn't change things like tool, colors, or zoom.
 */
function mergeUIState(snapshot: ProjectState, current: ProjectState): ProjectState {
    const merged = { ...snapshot };
    
    // Preserve UI fields from the current state
    UI_FIELDS.forEach(field => {
        (merged as any)[field] = current[field];
    });

    // Attempt to preserve current selection in timeline if still valid
    const hasLayer = snapshot.layers.some(l => l.id === current.activeLayerId);
    if (hasLayer) {
        merged.activeLayerId = current.activeLayerId;
        merged.selectedLayerIds = current.selectedLayerIds.filter(id => 
            snapshot.layers.some(l => l.id === id)
        );
        if (merged.selectedLayerIds.length === 0) merged.selectedLayerIds = [merged.activeLayerId];
    }

    const hasFrame = snapshot.frames.length > current.activeFrameIndex;
    if (hasFrame) {
        merged.activeFrameIndex = current.activeFrameIndex;
        merged.selectedFrameIndices = current.selectedFrameIndices.filter(i => i < snapshot.frames.length);
        if (merged.selectedFrameIndices.length === 0) merged.selectedFrameIndices = [merged.activeFrameIndex];
    }

    return merged;
}

const EMPTY_HISTORY: HistoryEntry[] = [];
const FALLBACK_INSTANCE: ProjectInstance = {
  data: INITIAL_STATE,
  history: EMPTY_HISTORY,
  historyIndex: 0,
  lastSavedHistoryIndex: 0,
};

export function useProject() {
  const [projectStore, setProjectStore] = useState<{ projects: ProjectInstance[]; tabs: ProjectTabItem[] }>({
    projects: [],
    tabs: [],
  });
  const projects = projectStore.projects;
  const tabs = projectStore.tabs;

  const setProjects = (updater: (prev: ProjectInstance[]) => ProjectInstance[]) => {
    setProjectStore(prevStore => {
      const nextProjects = updater(prevStore.projects);
      if (nextProjects === prevStore.projects) return prevStore;
      return {
        projects: nextProjects,
        tabs: deriveProjectTabs(nextProjects, prevStore.tabs),
      };
    });
  };

  const [activeProjectId, setActiveProjectId] = useState<string>('home');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load recents from IndexedDB on mount
  useEffect(() => {
    let isMounted = true;
    getRecentProjects()
      .then(recents => {
        if (isMounted) {
          setRecentProjects(recents);
        }
      })
      .catch(e => {
        console.warn("Failed to load recents from IndexedDB", e);
      });

    // Clean up legacy localStorage item if present
    try {
      localStorage.removeItem('pixel-forge-recents');
    } catch {
      // ignore
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Track the last persisted (or untouched-import) document snapshot per project ID
  // to avoid redundant auto-saves on open, tab switch, or clean close.
  const persistedDocsRef = useRef<Map<string, PersistedDocSignature>>(new Map());

  const addToRecents = (project: ProjectState) => {
    const sig = makeDocSignature(project);
    persistedDocsRef.current.set(project.id, sig);
    // Asynchronously encode to compressed .aseprite binary & store in IndexedDB
    saveRecentProject(project)
      .then(newEntry => {
        setRecentProjects(prev => {
          const filtered = prev.filter(p => p.id !== newEntry.id && p.title !== newEntry.title);
          return [newEntry, ...filtered].slice(0, 10);
        });
      })
      .catch(err => {
        console.warn("Failed to save recent project to IndexedDB:", err);
      });
  };

  const loadRecentProject = async (recent: RecentProject) => {
    // Check if already open by ID
    const existing = latestRef.current.projects.find(p => p.data.id === recent.id);
    if (existing) {
      setActiveProjectId(existing.data.id);
      return;
    }

    const initialData: ProjectState | null = recent.data || null;
    try {
      let loadedState: ProjectState | null = initialData;
      if (!loadedState) {
        loadedState = await loadRecentProjectState(recent.id);
      }

      if (!loadedState) {
        console.warn("Could not retrieve project data for:", recent.title);
        return;
      }

      const newProjectState: ProjectState = { 
        ...loadedState, 
        selection: null, 
        fileHandle: undefined 
      };
      // Already stored in IndexedDB — skip redundant auto-save until edited
      persistedDocsRef.current.set(newProjectState.id, makeDocSignature(newProjectState));
      
      setProjects(prev => [...prev, {
        data: newProjectState,
        history: [{ kind: 'snapshot', state: newProjectState, action: 'Open Recent', timestamp: Date.now() }],
        historyIndex: 0,
        lastSavedHistoryIndex: 0
      }]);
      setActiveProjectId(newProjectState.id);
    } catch (e) {
      console.error("Failed to load recent project", e);
    }
  };

  const clearRecents = () => {
    setRecentProjects([]);
    clearAllRecents().catch(e => console.warn("Failed to clear recents from IndexedDB", e));
  };

  const activeIndex = projects.findIndex(p => p.data.id === activeProjectId);
  const activeInstance = activeIndex >= 0 ? projects[activeIndex] : FALLBACK_INSTANCE;
  const state = activeInstance.data;

  // Keep latest active saveable project and mutable refs synced in useLayoutEffect
  // so all action callbacks remain permanently referentially stable for React Compiler.
  const activeProjectRef = useRef<ProjectState | null>(null);
  const latestRef = useRef({
    state,
    activeProjectId,
    projects,
    activeInstance,
  });
  const isSaveableProject =
    activeProjectId !== 'home' &&
    activeIndex >= 0 &&
    Boolean(state?.id) &&
    state.id !== 'default';
  useLayoutEffect(() => {
    activeProjectRef.current = isSaveableProject ? state : null;
    latestRef.current = {
      state,
      activeProjectId,
      projects,
      activeInstance,
    };
  });

  // Auto-save active project changes to IndexedDB (adaptive debounce) only when actual document
  // content or metadata differs from the last persisted snapshot.
  useEffect(() => {
    if (!isSaveableProject) return;
    const scheduledProjectId = state.id;
    const curSig = makeDocSignature(state);
    const lastSig = persistedDocsRef.current.get(scheduledProjectId);
    if (lastSig && isSameDocSignature(lastSig, curSig)) {
      return;
    }

    const totalPixels = state.width * state.height;
    const delayMs = totalPixels > 2_000_000 ? 5000 : totalPixels > 500_000 ? 3000 : 1500;

    const timer = setTimeout(() => {
      const latestProject = activeProjectRef.current;
      if (!latestProject || latestProject.id !== scheduledProjectId) return;
      const latestSig = makeDocSignature(latestProject);
      const prevPersisted = persistedDocsRef.current.get(scheduledProjectId);
      if (prevPersisted && isSameDocSignature(prevPersisted, latestSig)) return;

      persistedDocsRef.current.set(scheduledProjectId, latestSig);
      saveRecentProject(latestProject)
        .then(newEntry => {
          setRecentProjects(prev => {
            const filtered = prev.filter(p => p.id !== newEntry.id);
            return [newEntry, ...filtered].slice(0, 10);
          });
        })
        .catch(err => {
          console.warn("Auto-saving recent project to IndexedDB failed:", err);
        });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    isSaveableProject,
    activeProjectId,
    state.id,
    state.title,
    state.width,
    state.height,
    state.colorMode,
    state.frames,
    state.layers,
    state.palette,
    state.paletteLibrary,
    state.paletteNames,
    state.tags,
    state.slices,
    state.tilesets,
    state.externalFiles,
    state.colorProfile,
    state.transparentIndex,
    state.grid,
    state.pixelRatio,
    state.userData,
  ]);

  // Save on window unload/hide so last-second unsaved work is never lost.
  // Skip already-persisted documents and very large canvases (>1MP) during unload.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentProject = activeProjectRef.current;
      if (
        currentProject &&
        currentProject.id &&
        currentProject.id !== 'default' &&
        currentProject.width * currentProject.height <= 1_000_000
      ) {
        const curSig = makeDocSignature(currentProject);
        const prevSig = persistedDocsRef.current.get(currentProject.id);
        if (!prevSig || !isSameDocSignature(prevSig, curSig)) {
          persistedDocsRef.current.set(currentProject.id, curSig);
          saveRecentProject(currentProject).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  const createProject = (config?: { width: number, height: number, colorMode: ColorMode, title?: string, paletteId?: string }) => {
    const w = config?.width ?? INITIAL_STATE.width;
    const h = config?.height ?? INITIAL_STATE.height;
    const mode = config?.colorMode ?? INITIAL_STATE.colorMode;
    const title = config?.title?.trim() || `Untitled-${latestRef.current.projects.length + 1}`;
    const chosenPalette = config?.paletteId
      ? INITIAL_STATE.paletteLibrary.find(p => p.id === config.paletteId)
      : undefined;
    
    const id = `project-${Date.now()}`;
    const newProject: ProjectState = {
      ...INITIAL_STATE,
      id,
      title,
      width: w,
      height: h,
      colorMode: mode,
      palette: chosenPalette ? chosenPalette.colors : INITIAL_STATE.palette,
      activePaletteId: chosenPalette ? chosenPalette.id : INITIAL_STATE.activePaletteId,
      primaryColor: chosenPalette ? (chosenPalette.colors[chosenPalette.colors.length - 1] || '#ffffff') : INITIAL_STATE.primaryColor,
      secondaryColor: chosenPalette ? (chosenPalette.colors[0] || '#000000') : INITIAL_STATE.secondaryColor,
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 100, blendMode: 'normal' }],
      selectedLayerIds: ['layer-1'],
      frames: [{ id: 'frame-1', layerData: {} }],
      selectedFrameIndices: [0],
      zoom: computeInitialZoom(w, h, 64),
    };
    
    const initialEntry: HistoryEntry = {
        kind: 'snapshot',
        state: newProject,
        action: 'New Project',
        timestamp: Date.now()
    };

    setProjects(prev => [...prev, {
      data: newProject,
      history: [initialEntry],
      historyIndex: 0,
      lastSavedHistoryIndex: 0
    }]);
    setActiveProjectId(id);
    addToRecents(newProject);
  };

  const loadProjectFromFile = async (file: File, handle?: FileSystemFileHandle): Promise<boolean> => {
    try {
      const newState = await loadAndNormalizeProjectFile(file, handle);

      // For large imports (>2MP, e.g. 4K photos), skip background IndexedDB auto-save
      // until the user actually edits the document.
      if (newState.width * newState.height > 2_000_000) {
        persistedDocsRef.current.set(newState.id, makeDocSignature(newState));
      }

      setProjects(prev => [...prev, {
        data: newState,
        history: [{ kind: 'snapshot', state: newState, action: 'Import File', timestamp: Date.now() }],
        historyIndex: 0,
        lastSavedHistoryIndex: 0
      }]);
      setActiveProjectId(newState.id);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateState = (
      updater: ProjectStateUpdater,
      historyConfig?: { action: string; tool?: ToolType; patch?: PixelHistoryPatch }
  ) => {
    const curActiveId = latestRef.current.activeProjectId;
    if (curActiveId === 'home') return;

    setProjects(prev => prev.map(p => {
      if (p.data.id !== curActiveId) return p;

      const newState = typeof updater === 'function' ? updater(p.data) : updater;
      if (newState === p.data && !historyConfig) return p;

      const cleanSelection = SelectionMask.fromAny(newState.selection, newState.width, newState.height);
      const sanitizedState = newState.selection === cleanSelection
        ? newState
        : { ...newState, selection: cleanSelection };

      let newHistory = p.history;
      let newIndex = p.historyIndex;
      let newLastSavedIndex = p.lastSavedHistoryIndex;

      if (historyConfig) {
        newHistory = p.history.slice(0, p.historyIndex + 1);
        if (historyConfig.patch && historyConfig.patch.layers.length > 0 && newHistory.length > 0) {
          newHistory.push({
            kind: 'pixel-patch',
            patch: historyConfig.patch,
            action: historyConfig.action,
            tool: historyConfig.tool,
            timestamp: Date.now(),
          });
        } else {
          newHistory.push({
            kind: 'snapshot',
            state: sanitizedState,
            action: historyConfig.action,
            tool: historyConfig.tool,
            timestamp: Date.now(),
          });
        }

        while (
          newHistory.length > MAX_HISTORY_ENTRIES ||
          (newHistory.length > 2 && estimateHistoryBytes(newHistory) > MAX_HISTORY_BYTES)
        ) {
          shiftHistoryBase(newHistory);
          if (newLastSavedIndex >= 0) {
            newLastSavedIndex--;
          }
        }
        newIndex = newHistory.length - 1;
      }

      return {
        data: sanitizedState,
        history: newHistory,
        historyIndex: newIndex,
        lastSavedHistoryIndex: newLastSavedIndex
      };
    }));
  };

  const markSaved = () => {
      const curActiveId = latestRef.current.activeProjectId;
      setProjects(prev => prev.map(p => {
          if (p.data.id === curActiveId) {
              return { ...p, lastSavedHistoryIndex: p.historyIndex };
          }
          return p;
      }));
  };

  const saveProjectAs = async () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;

    const isInIframe = window.self !== window.top;

    const performFallbackDownload = async () => {
      const aseBytes = await encodeAsepriteAsync(state);
      const blob = new Blob([aseBytes.buffer as ArrayBuffer], { type: 'image/x-aseprite' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      const titleName = (state.title || 'pixel-art').replace(/\s+/g, '_');
      link.download = titleName.toLowerCase().endsWith('.aseprite') || titleName.toLowerCase().endsWith('.ase')
        ? titleName
        : `${titleName}.aseprite`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    };

    if (isInIframe || typeof (window as any).showSaveFilePicker !== 'function') {
      await performFallbackDownload();
      return;
    }

    const suggestedName = state.title
      ? (state.title.endsWith('.aseprite') ? state.title : `${state.title}.aseprite`)
      : 'pixel-art.aseprite';

    try {
        const options = {
            suggestedName,
            types: [
                {
                    description: 'Aseprite File (*.aseprite, *.ase)',
                    accept: { 'image/x-aseprite': ['.aseprite', '.ase'] }
                },
                {
                    description: 'PNG Image (*.png)',
                    accept: { 'image/png': ['.png'] }
                }
            ]
        };

        // @ts-ignore
        const handle = await window.showSaveFilePicker(options);
        const name = handle.name.toLowerCase();
        
        if (name.endsWith('.png')) {
             const blob = await renderActiveFramePngBlob(state);
             
             const writable = await handle.createWritable();
             await writable.write(blob);
             await writable.close();
             
             const newState = { ...state, title: handle.name, fileHandle: handle };
             updateState(newState, { action: 'Save As PNG' });
             markSaved();
             addToRecents(newState);
        } else {
             const aseBytes = await encodeAsepriteAsync(state);
             const writable = await handle.createWritable();
             await writable.write(aseBytes.buffer as ArrayBuffer);
             await writable.close();

             const newState = { ...state, title: handle.name, fileHandle: handle };
             updateState(newState, { action: 'Save As' });
             markSaved();
             addToRecents(newState);
        }
        
    } catch (e) {
         if ((e as Error).name === 'AbortError') {
             return;
         }
         console.warn("showSaveFilePicker failed or restricted, falling back to standard download", e);
         await performFallbackDownload();
    }
  };

  const saveProject = async () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    if (!state.fileHandle) {
        await saveProjectAs();
        return;
    }

    addToRecents(state);

    const fileHandle = state.fileHandle;
    const name = fileHandle.name.toLowerCase();
    const isImageFile = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    const isProjectFile = name.endsWith('.aseprite') || name.endsWith('.ase') || name.endsWith('.json');

    try {
        if (isImageFile) {
           const blob = await renderActiveFramePngBlob(state);
           
           const writable = await fileHandle.createWritable();
           await writable.write(blob);
           await writable.close();
           markSaved();
           toast.success(`Saved ${fileHandle.name}`);
           return;
        }
        
        if (isProjectFile) {
            const aseBytes = await encodeAsepriteAsync(state);
            const writable = await fileHandle.createWritable();
            await writable.write(aseBytes.buffer as ArrayBuffer);
            await writable.close();
            markSaved();
            toast.success(`Saved ${fileHandle.name}`);
            return;
        }
        await saveProjectAs();
    } catch (e) {
        console.error("Save failed", e);
        toast.error("Failed to save project.");
    }
  };

  const closeProject = (id: string) => {
    const { projects, activeProjectId } = latestRef.current;
    const projToClose = projects.find(p => p.data.id === id);
    if (projToClose && projToClose.data && projToClose.data.id !== 'default') {
      const prevSig = persistedDocsRef.current.get(id);
      const curSig = makeDocSignature(projToClose.data);
      if (!prevSig || !isSameDocSignature(prevSig, curSig)) {
        saveRecentProject(projToClose.data)
          .then(newEntry => {
            setRecentProjects(prev => {
              const filtered = prev.filter(p => p.id !== newEntry.id);
              return [newEntry, ...filtered].slice(0, 10);
            });
          })
          .catch(console.warn);
      }
    }
    persistedDocsRef.current.delete(id);
    releaseScratchRenderBuffers();

    let nextActiveId = activeProjectId;
    if (activeProjectId === id) {
        const idx = projects.findIndex(p => p.data.id === id);
        const remaining = projects.filter(p => p.data.id !== id);
        if (remaining.length > 0) {
            const newIdx = Math.max(0, idx - 1);
            nextActiveId = remaining[newIdx].data.id;
        } else {
            nextActiveId = 'home';
        }
    }
    setProjects(prev => prev.filter(p => p.data.id !== id));
    setActiveProjectId(nextActiveId);
  };

  const switchTab = (direction: 'next' | 'prev') => {
      const { projects, activeProjectId } = latestRef.current;
      if (activeProjectId === 'home') {
          if (projects.length > 0) {
              setActiveProjectId(direction === 'next' ? projects[0].data.id : projects[projects.length - 1].data.id);
          }
          return;
      }
      const idx = projects.findIndex(p => p.data.id === activeProjectId);
      if (idx === -1) return;
      let newIdx = direction === 'next' ? idx + 1 : idx - 1;
      if (newIdx >= projects.length) newIdx = 0;
      if (newIdx < 0) newIdx = projects.length - 1;
      setActiveProjectId(projects[newIdx].data.id);
  };

  const undo = () => {
    const curActiveId = latestRef.current.activeProjectId;
    if (curActiveId === 'home') return;
    setProjects(prev => prev.map(p => {
        if (p.data.id !== curActiveId) return p;
        if (p.historyIndex > 0) {
            const newIndex = p.historyIndex - 1;
            const curEntry = p.history[p.historyIndex];
            const prevEntry = p.history[newIndex];

            let nextData: ProjectState | null = null;
            if (prevEntry.kind === 'snapshot' && prevEntry.state) {
              nextData = mergeUIState(prevEntry.state, p.data);
            } else if (curEntry.kind === 'pixel-patch' && curEntry.patch) {
              nextData = applyPixelHistoryPatch(p.data, curEntry.patch, 'before');
            } else {
              const materialized = materializeHistoryState(p.history, newIndex);
              if (materialized) {
                nextData = mergeUIState(materialized, p.data);
              }
            }

            if (!nextData) return p;
            return { 
                ...p, 
                data: nextData, 
                historyIndex: newIndex 
            };
        }
        return p;
    }));
  };

  const redo = () => {
     const curActiveId = latestRef.current.activeProjectId;
     if (curActiveId === 'home') return;
     setProjects(prev => prev.map(p => {
        if (p.data.id !== curActiveId) return p;
        if (p.historyIndex < p.history.length - 1) {
            const newIndex = p.historyIndex + 1;
            const nextEntry = p.history[newIndex];

            let nextData: ProjectState | null = null;
            if (nextEntry.kind === 'snapshot' && nextEntry.state) {
              nextData = mergeUIState(nextEntry.state, p.data);
            } else if (nextEntry.kind === 'pixel-patch' && nextEntry.patch) {
              nextData = applyPixelHistoryPatch(p.data, nextEntry.patch, 'after');
            } else {
              const materialized = materializeHistoryState(p.history, newIndex);
              if (materialized) {
                nextData = mergeUIState(materialized, p.data);
              }
            }

            if (!nextData) return p;
            return { 
                ...p, 
                data: nextData, 
                historyIndex: newIndex 
            };
        }
        return p;
    }));
  };

  const jumpToHistory = (index: number) => {
    const curActiveId = latestRef.current.activeProjectId;
    if (curActiveId === 'home') return;
    setProjects(prev => prev.map(p => {
      if (p.data.id !== curActiveId) return p;
      if (index >= 0 && index < p.history.length) {
        if (index === p.historyIndex) return p;

        let nextData: ProjectState | null = null;
        const targetEntry = p.history[index];
        if (targetEntry.kind === 'snapshot' && targetEntry.state) {
          nextData = mergeUIState(targetEntry.state, p.data);
        } else if (index === p.historyIndex - 1 && p.history[p.historyIndex].kind === 'pixel-patch' && p.history[p.historyIndex].patch) {
          nextData = applyPixelHistoryPatch(p.data, p.history[p.historyIndex].patch!, 'before');
        } else if (index === p.historyIndex + 1 && targetEntry.kind === 'pixel-patch' && targetEntry.patch) {
          nextData = applyPixelHistoryPatch(p.data, targetEntry.patch, 'after');
        } else {
          const materialized = materializeHistoryState(p.history, index);
          if (materialized) {
            nextData = mergeUIState(materialized, p.data);
          }
        }

        if (!nextData) return p;
        return { 
            ...p, 
            data: nextData, 
            historyIndex: index 
        };
      }
      return p;
    }));
  };

  const restoreCurrentHistoryState = () => {
    const curActiveId = latestRef.current.activeProjectId;
    if (curActiveId === 'home') return;
    setProjects(prev => prev.map(p => {
      if (p.data.id !== curActiveId) return p;
      const materialized = materializeHistoryState(p.history, p.historyIndex);
      if (!materialized) return p;
      return {
        ...p,
        data: mergeUIState(materialized, p.data),
      };
    }));
  };

  const setColorMode = (mode: ColorMode) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home' || state.colorMode === mode) return;

    const newPalette = [...state.palette];
    const newFrames = convertFramesColorMode(
      state.frames,
      state.width,
      state.height,
      mode,
      newPalette,
      state.ditheringEnabled
    );

    updateState(
        { ...state, colorMode: mode, palette: newPalette, frames: newFrames },
        { action: `Switch to ${mode.toUpperCase()} mode${state.ditheringEnabled ? ' (Dithered)' : ''}` }
    );
  };

  const addFrame = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: {} };
    updateState(
        { 
          ...state, 
          frames: [...state.frames, newFrame], 
          activeFrameIndex: state.frames.length,
          selectedFrameIndices: [state.frames.length]
        }, 
        { action: 'Add Frame' }
    );
  };

  const duplicateFrame = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const current = state.frames[state.activeFrameIndex];
    if (!current) return;
    const newData: Record<string, PixelGrid> = {};
    Object.keys(current.layerData).forEach(key => newData[key] = clonePixelGrid(current.layerData[key]));
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: newData };
    const newFrames = [...state.frames]; newFrames.splice(state.activeFrameIndex + 1, 0, newFrame);
    updateState(
        { 
          ...state, 
          frames: newFrames, 
          activeFrameIndex: state.activeFrameIndex + 1,
          selectedFrameIndices: [state.activeFrameIndex + 1]
        }, 
        { action: 'Duplicate Frame' }
    );
  };

  const duplicateSelectedFrames = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selected = [...state.selectedFrameIndices].sort((a, b) => a - b);
    if (selected.length === 0) return;

    const newFrames = [...state.frames];
    const insertedIndices: number[] = [];
    
    // Duplicate each selected frame and insert it right after the block
    const offset = selected[selected.length - 1] + 1;
    selected.forEach((idx, i) => {
        const source = state.frames[idx];
        if (!source) return;
        const newData: Record<string, PixelGrid> = {};
        Object.keys(source.layerData).forEach(key => newData[key] = clonePixelGrid(source.layerData[key]));
        const newFrame: Frame = { id: `frame-${Date.now()}-${i}`, layerData: newData };
        newFrames.splice(offset + i, 0, newFrame);
        insertedIndices.push(offset + i);
    });

    updateState(
        { 
          ...state, 
          frames: newFrames, 
          activeFrameIndex: insertedIndices[0],
          selectedFrameIndices: insertedIndices
        }, 
        { action: `Duplicate ${selected.length} Frames` }
    );
  };

  const deleteFrame = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    if (state.frames.length <= 1) return; 
    updateState(
        { ...state, frames: state.frames.filter((_, i) => i !== state.activeFrameIndex), activeFrameIndex: Math.max(0, state.activeFrameIndex - 1), selectedFrameIndices: [Math.max(0, state.activeFrameIndex - 1)] }, 
        { action: 'Delete Frame' }
    );
  };

  const deleteSelectedFrames = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selected = state.selectedFrameIndices;
    if (selected.length === 0 || selected.length === state.frames.length) return;

    const newFrames = state.frames.filter((_, i) => !selected.includes(i));
    let newActiveIndex = state.activeFrameIndex;
    if (selected.includes(newActiveIndex)) {
        // Move to the frame before the first deleted frame in selection
        const firstSelected = Math.min(...selected);
        newActiveIndex = Math.max(0, firstSelected - 1);
        if (newActiveIndex >= newFrames.length) newActiveIndex = newFrames.length - 1;
    } else {
        newActiveIndex = state.activeFrameIndex - selected.filter(idx => idx < state.activeFrameIndex).length;
    }

    updateState(
        { ...state, frames: newFrames, activeFrameIndex: newActiveIndex, selectedFrameIndices: [newActiveIndex] },
        { action: `Delete ${selected.length} Frames` }
    );
  };

  const insertFrame = (index: number) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: {} };
    const newFrames = [...state.frames];
    newFrames.splice(index, 0, newFrame);
    updateState(
        { 
          ...state, 
          frames: newFrames, 
          activeFrameIndex: index,
          selectedFrameIndices: [index]
        }, 
        { action: 'Insert Frame' }
    );
  };

  const tweenFrames = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selected = [...state.selectedFrameIndices].sort((a, b) => a - b);
    if (selected.length < 3) {
      toast.info("Select 3 or more frames to interpolate between the first and last of the selection.");
      return;
    }

    const startIdx = selected[0];
    const endIdx = selected[selected.length - 1];
    const layerId = state.activeLayerId;
    const width = state.width;
    const height = state.height;
    const palette = state.palette;

    const startPixelsArr = state.frames[startIdx].layerData[layerId];
    const endPixelsArr = state.frames[endIdx].layerData[layerId];

    // 1. Collect all non-empty pixels from start and end frames
    const startList: PixelPoint[] = [];
    if (startPixelsArr) {
      for (let i = 0; i < startPixelsArr.length; i++) {
        const val = startPixelsArr[i];
        if (val !== EMPTY_PIXEL) {
          const rgb = pixelToRgb(val, palette);
          if (rgb) {
            startList.push({ ...getCoords(i, width), r: rgb[0], g: rgb[1], b: rgb[2] });
          }
        }
      }
    }

    const endList: PixelPoint[] = [];
    if (endPixelsArr) {
      for (let i = 0; i < endPixelsArr.length; i++) {
        const val = endPixelsArr[i];
        if (val !== EMPTY_PIXEL) {
          const rgb = pixelToRgb(val, palette);
          if (rgb) {
            endList.push({ ...getCoords(i, width), r: rgb[0], g: rgb[1], b: rgb[2] });
          }
        }
      }
    }

    // Handle empty frames gracefully
    if (startList.length === 0 && endList.length === 0) return;
    
    // Pairs map for interpolation
    const pairs: { s: PixelPoint, e: PixelPoint }[] = [];

    if (startList.length > 0 && endList.length > 0) {
        const findNearestEnd = createSpatialPointFinder(endList);
        const findNearestStart = createSpatialPointFinder(startList);
        for (const s of startList) pairs.push({ s, e: findNearestEnd(s) });
        for (const e of endList) pairs.push({ s: findNearestStart(e), e });
    }

    const newFrames = [...state.frames];

    // 2. Interpolate intermediate selected frames
    for (let i = 1; i < selected.length - 1; i++) {
        const currentFrameIdx = selected[i];
        const t = i / (selected.length - 1); 

        const framePixels = createPixelGrid(width * height);

        for (const pair of pairs) {
            const { s, e } = pair;

            const curX = Math.round(s.x + (e.x - s.x) * t);
            const curY = Math.round(s.y + (e.y - s.y) * t);

            const curR = s.r + (e.r - s.r) * t;
            const curG = s.g + (e.g - s.g) * t;
            const curB = s.b + (e.b - s.b) * t;

            let curVal: PixelValue;
            if (state.colorMode === 'indexed' && palette.length > 0) {
              const nearestIdx = findNearestPaletteIndex(curR, curG, curB, palette);
              curVal = encodeIndexedPixel(nearestIdx);
            } else if (palette.length > 0) {
              const nearestIdx = findNearestPaletteIndex(curR, curG, curB, palette);
              curVal = getPackedColor(palette[nearestIdx], 255);
            } else {
              curVal = packRGBA(Math.round(curR), Math.round(curG), Math.round(curB), 255);
            }

            if (curX >= 0 && curX < width && curY >= 0 && curY < height) {
                framePixels[getIndex(curX, curY, width)] = curVal;
            }
        }

        newFrames[currentFrameIdx] = {
            ...newFrames[currentFrameIdx],
            layerData: {
                ...newFrames[currentFrameIdx].layerData,
                [layerId]: framePixels
            }
        };
    }

    updateState({ ...state, frames: newFrames }, { action: 'Interpolate Frames' });
  };

  const addLayer = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newId = `layer-${Date.now()}`;
    const newName = getNextLayerName(state.layers, 'Layer');
    const activeL = state.layers.find(l => l.id === state.activeLayerId);
    
    let childLevel = 0;
    let parentId: string | null = null;
    let insertIndex = -1;

    const activeIdx = activeL ? state.layers.findIndex(l => l.id === activeL.id) : -1;

    if (activeL) {
      if (activeL.type === 'group') {
        childLevel = (activeL.childLevel ?? 0) + 1;
        parentId = activeL.id;
        insertIndex = activeIdx;
      } else {
        childLevel = activeL.childLevel ?? 0;
        parentId = activeL.parentId ?? null;
        insertIndex = activeIdx + 1;
      }
    }

    const newLayer: Layer = { id: newId, name: newName, visible: true, locked: false, opacity: 100, blendMode: 'normal', childLevel, parentId };
    const newLayers = [...state.layers];
    if (insertIndex >= 0 && insertIndex <= newLayers.length) {
      newLayers.splice(insertIndex, 0, newLayer);
    } else {
      newLayers.push(newLayer);
    }

    if (activeL && activeL.type === 'group') {
      const gIdx = newLayers.findIndex(l => l.id === activeL.id);
      if (gIdx !== -1) {
        newLayers[gIdx] = { ...newLayers[gIdx], collapsed: false };
      }
    }

    updateState(
        { ...state, layers: newLayers, activeLayerId: newId, selectedLayerIds: [newId] }, 
        { action: 'Add Layer' }
    );
  };

  const addGroupLayer = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newId = `group-${Date.now()}`;
    const newGroupName = getNextLayerName(state.layers, 'Group');
    const activeL = state.layers.find(l => l.id === state.activeLayerId);
    const parentId = activeL ? (activeL.parentId ?? null) : null;
    const childLevel = activeL ? (activeL.parentId ? (activeL.childLevel ?? 1) - 1 : 0) : 0;
    const newLayer: Layer = { 
      id: newId, 
      name: newGroupName, 
      visible: true, 
      locked: false, 
      opacity: 100, 
      blendMode: 'normal',
      type: 'group',
      childLevel,
      parentId,
      collapsed: false
    };
    const newLayers = [...state.layers]; const idx = state.layers.findIndex(l => l.id === state.activeLayerId);
    if(idx!==-1) newLayers.splice(idx+1, 0, newLayer); else newLayers.push(newLayer);
    updateState(
        { ...state, layers: newLayers, activeLayerId: newId, selectedLayerIds: [newId] }, 
        { action: 'Add Group' }
    );
  };

  const deleteLayer = (id: string) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    if (state.layers.length <= 1) return; 
    
    const newLayers = state.layers.filter(l => l.id !== id);
    const newFrames = state.frames.map(f => {
        const newLayerData = { ...f.layerData };
        delete newLayerData[id];
        return { ...f, layerData: newLayerData };
    });
    
    let newActiveId = state.activeLayerId;
    if (state.activeLayerId === id) {
        newActiveId = newLayers[0].id;
    }

    updateState(
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: newActiveId, selectedLayerIds: state.selectedLayerIds.filter(sid => sid !== id).length ? state.selectedLayerIds.filter(sid => sid !== id) : [newActiveId] },
        { action: 'Delete Layer' }
    );
  };

  const deleteSelectedLayers = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selected = state.selectedLayerIds;
    if (selected.length === 0 || selected.length === state.layers.length) return;

    const newLayers = state.layers.filter(l => !selected.includes(l.id));
    const newFrames = state.frames.map(f => {
        const newLayerData = { ...f.layerData };
        selected.forEach(id => delete newLayerData[id]);
        return { ...f, layerData: newLayerData };
    });

    let newActiveId = state.activeLayerId;
    if (selected.includes(newActiveId)) {
        newActiveId = newLayers[0].id;
    }

    updateState(
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: newActiveId, selectedLayerIds: [newActiveId] },
        { action: `Delete ${selected.length} Layers` }
    );
  };

  const duplicateLayer = (id: string) => {
     const { activeProjectId, state } = latestRef.current;
     if (activeProjectId === 'home') return;
     const layerIndex = state.layers.findIndex(l => l.id === id);
     if (layerIndex === -1) return;
     
     const sourceLayer = state.layers[layerIndex];
     const newId = `layer-${Date.now()}`;
     const newLayer: Layer = { ...sourceLayer, id: newId, name: `${sourceLayer.name} (Copy)` };
     
     const newLayers = [...state.layers];
     newLayers.splice(layerIndex + 1, 0, newLayer); // Insert above
     
     const newFrames = state.frames.map(f => {
         const src = f.layerData[id];
         if (!src) return f;
         return {
             ...f,
             layerData: {
                 ...f.layerData,
                 [newId]: clonePixelGrid(src),
             },
         };
     });

     updateState(
         { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId, selectedLayerIds: [newId] },
         { action: 'Duplicate Layer' }
     );
  };

  const duplicateSelectedLayers = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selected = [...state.selectedLayerIds];
    if (selected.length === 0) return;

    const newLayers = [...state.layers];
    const newFrames = state.frames.map(f => ({ ...f, layerData: { ...f.layerData } }));
    const duplicatedIds: string[] = [];

    // Duplicate each selected layer
    selected.forEach((id, i) => {
        const layerIndex = newLayers.findIndex(l => l.id === id);
        const sourceLayer = newLayers[layerIndex];
        const newId = `layer-${Date.now()}-${i}`;
        const newLayer: Layer = { ...sourceLayer, id: newId, name: `${sourceLayer.name} (Copy)` };
        newLayers.splice(layerIndex + 1, 0, newLayer);
        duplicatedIds.push(newId);

        newFrames.forEach(f => {
            const src = f.layerData[id];
            if (src) {
                f.layerData[newId] = clonePixelGrid(src);
            }
        });
    });

    updateState(
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: duplicatedIds[0], selectedLayerIds: duplicatedIds },
        { action: `Duplicate ${selected.length} Layers` }
    );
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const newLayers = state.layers.map(l => l.id === id ? { ...l, ...updates } : l);
      const action = updates.name ? 'Rename Layer' : 'Layer Properties';
      updateState(
          { ...state, layers: newLayers },
          { action: action }
      );
  };

  const groupSelectedLayers = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selectedIds = state.selectedLayerIds.length > 0 ? state.selectedLayerIds : [state.activeLayerId];
    if (selectedIds.length === 0) return;

    const selectedLayers = state.layers.filter(l => selectedIds.includes(l.id));
    if (selectedLayers.length === 0) return;

    const indices = selectedLayers.map(l => state.layers.findIndex(layer => layer.id === l.id));
    const highestIndex = Math.max(...indices);
    const highestLayer = state.layers[highestIndex];

    const groupId = `group-${Date.now()}`;
    const groupName = getNextLayerName(state.layers, 'Group');

    const parentId = highestLayer.parentId ?? null;
    const childLevel = highestLayer.childLevel ?? 0;

    const groupLayer: Layer = {
      id: groupId,
      name: groupName,
      type: 'group',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      collapsed: false,
      parentId,
      childLevel
    };

    const nonSelectedLayers = state.layers.filter(l => !selectedIds.includes(l.id));
    let insertIndex = 0;
    const targetAfter = state.layers.slice(highestIndex + 1).find(l => !selectedIds.includes(l.id));
    if (targetAfter) {
      insertIndex = nonSelectedLayers.findIndex(l => l.id === targetAfter.id);
    } else {
      insertIndex = nonSelectedLayers.length;
    }

    const updatedChildren = selectedLayers.map(l => ({
      ...l,
      parentId: groupId,
      childLevel: childLevel + 1
    }));

    const newLayers = [
      ...nonSelectedLayers.slice(0, insertIndex),
      ...updatedChildren,
      groupLayer,
      ...nonSelectedLayers.slice(insertIndex)
    ];

    updateState(
      { ...state, layers: newLayers, activeLayerId: groupId, selectedLayerIds: [groupId] },
      { action: `Grouped ${selectedLayers.length} Layer(s)` }
    );
  };

  const ungroupSelectedLayers = () => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const selectedIds = state.selectedLayerIds.length > 0 ? state.selectedLayerIds : [state.activeLayerId];
    const groupLayersToUngroup = state.layers.filter(l => l.type === 'group' && selectedIds.includes(l.id));

    if (groupLayersToUngroup.length === 0) return;

    let newLayers = [...state.layers];
    const groupIdsToRemove = groupLayersToUngroup.map(g => g.id);

    groupLayersToUngroup.forEach(group => {
      newLayers = newLayers.map(l => {
        if (l.parentId === group.id) {
          return {
            ...l,
            parentId: group.parentId ?? null,
            childLevel: Math.max(0, (l.childLevel ?? 1) - 1)
          };
        }
        return l;
      });
    });

    newLayers = newLayers.filter(l => !groupIdsToRemove.includes(l.id));

    const newFrames = state.frames.map(f => {
      const newLayerData = { ...f.layerData };
      groupIdsToRemove.forEach(gid => delete newLayerData[gid]);
      return { ...f, layerData: newLayerData };
    });

    const activeLayerId = newLayers.length > 0 ? newLayers[0].id : '';

    updateState(
      { ...state, layers: newLayers, frames: newFrames, activeLayerId, selectedLayerIds: [activeLayerId] },
      { action: `Ungrouped ${groupIdsToRemove.length} Group(s)` }
    );
  };

  const addLayerToGroup = (groupId: string) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const group = state.layers.find(l => l.id === groupId);
    if (!group) return;

    const newId = `layer-${Date.now()}`;
    const newLayerName = getNextLayerName(state.layers, 'Layer');

    const newLayer: Layer = {
      id: newId,
      name: newLayerName,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      childLevel: (group.childLevel ?? 0) + 1,
      parentId: group.id
    };

    const groupIndex = state.layers.findIndex(l => l.id === groupId);
    const newLayers = [...state.layers];
    newLayers[groupIndex] = { ...newLayers[groupIndex], collapsed: false };
    newLayers.splice(groupIndex, 0, newLayer);

    updateState(
      { ...state, layers: newLayers, activeLayerId: newId, selectedLayerIds: [newId] },
      { action: `Added Layer to ${group.name}` }
    );
  };

  const toggleCollapseAllGroups = (forceCollapse?: boolean) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const groupLayers = state.layers.filter(l => l.type === 'group');
    if (groupLayers.length === 0) return;

    const shouldCollapse = forceCollapse !== undefined 
      ? forceCollapse 
      : groupLayers.some(g => !g.collapsed);

    const newLayers = state.layers.map(l => l.type === 'group' ? { ...l, collapsed: shouldCollapse } : l);

    updateState(
      { ...state, layers: newLayers },
      { action: shouldCollapse ? 'Collapsed All Groups' : 'Expanded All Groups' }
    );
  };

  const reorderLayers = (dId: string, tId: string, pos: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom') => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;

    const draggedLayer = state.layers.find(l => l.id === dId);
    if (!draggedLayer) return;

    // Collect all descendant layers of dId to move them together as a group
    const childLayers = getGroupChildren(dId, state.layers);
    const memberIds = new Set([dId, ...childLayers.map(l => l.id)]);

    const movedLayers = state.layers.filter(l => memberIds.has(l.id));
    const remainingLayers = state.layers.filter(l => !memberIds.has(l.id));

    const oldChildLevel = draggedLayer.childLevel ?? 0;
    let newChildLevel = 0;
    let newParentId: string | null = null;
    let insertIndex = 0;

    if (tId === 'root-bottom' || pos === 'root-bottom') {
      newParentId = null;
      newChildLevel = 0;
      insertIndex = 0; // index 0 in array = bottom of UI list (bottommost layer)
    } else {
      if (dId === tId || isDescendant(tId, dId, state.layers)) return;

      const targetLayer = state.layers.find(l => l.id === tId);
      if (!targetLayer) return;

      const targetIndexInRemaining = remainingLayers.findIndex(l => l.id === tId);
      if (targetIndexInRemaining === -1) return;

      if (pos === 'inside') {
        if (targetLayer.type === 'group') {
          newParentId = targetLayer.id;
          newChildLevel = (targetLayer.childLevel ?? 0) + 1;
          insertIndex = targetIndexInRemaining;
        } else {
          newParentId = targetLayer.parentId ?? null;
          newChildLevel = targetLayer.childLevel ?? 0;
          insertIndex = targetIndexInRemaining;
        }
      } else if (pos === 'outside') {
        // Place outside the target layer's parent group
        const parentOfTarget = state.layers.find(l => l.id === targetLayer.parentId);
        newParentId = parentOfTarget ? (parentOfTarget.parentId ?? null) : null;
        newChildLevel = parentOfTarget ? (parentOfTarget.childLevel ?? 0) : 0;
        insertIndex = targetIndexInRemaining;
      } else if (pos === 'before') {
        // 'before' in UI order = ABOVE targetLayer in UI list = HIGHER array index
        newParentId = targetLayer.parentId ?? null;
        newChildLevel = targetLayer.childLevel ?? 0;
        insertIndex = targetIndexInRemaining + 1;
      } else { // pos === 'after'
        // 'after' in UI order = BELOW targetLayer in UI list
        if (targetLayer.type === 'group') {
          // Place below the group AND all its descendants at the group's parent level
          newParentId = targetLayer.parentId ?? null;
          newChildLevel = targetLayer.childLevel ?? 0;

          const targetDescendantIds = new Set([targetLayer.id, ...getGroupChildren(targetLayer.id, remainingLayers).map(l => l.id)]);
          let minDescendantIdx = targetIndexInRemaining;
          remainingLayers.forEach((l, idx) => {
            if (targetDescendantIds.has(l.id) && idx < minDescendantIdx) {
              minDescendantIdx = idx;
            }
          });
          insertIndex = minDescendantIdx;
        } else {
          newParentId = targetLayer.parentId ?? null;
          newChildLevel = targetLayer.childLevel ?? 0;
          insertIndex = targetIndexInRemaining;
        }
      }
    }

    const deltaLevel = newChildLevel - oldChildLevel;

    // Update childLevel and parentId for the root dragged layer and its descendants
    const updatedMovedLayers = movedLayers.map(l => {
      if (l.id === dId) {
        return {
          ...l,
          parentId: newParentId,
          childLevel: newChildLevel
        };
      } else {
        return {
          ...l,
          childLevel: Math.max(0, (l.childLevel ?? 0) + deltaLevel)
        };
      }
    });

    const newLayers = [
      ...remainingLayers.slice(0, insertIndex),
      ...updatedMovedLayers,
      ...remainingLayers.slice(insertIndex)
    ];

    if (pos === 'inside' && tId !== 'root-bottom') {
      const gIdx = newLayers.findIndex(l => l.id === tId);
      if (gIdx !== -1 && newLayers[gIdx].type === 'group') {
        newLayers[gIdx] = { ...newLayers[gIdx], collapsed: false };
      }
    }

    updateState(
      { ...state, layers: newLayers },
      { action: `Reordered ${draggedLayer.name}` }
    );
  };

  const reorderFrames = (from: number, to: number) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    if (from === to) return;
    
    const newFrames = [...state.frames]; 
    const [moved] = newFrames.splice(from, 1); 
    newFrames.splice(to, 0, moved);
    
    // Map existing selections to their new positions
    const newSelectedIndices = state.selectedFrameIndices.map(idx => {
        if (idx === from) return to;
        if (from < to && idx > from && idx <= to) return idx - 1;
        if (from > to && idx >= to && idx < from) return idx + 1;
        return idx;
    });

    let newActive = state.activeFrameIndex;
    if (newActive === from) newActive = to;
    else if (from < to && newActive > from && newActive <= to) newActive--;
    else if (from > to && newActive >= to && newActive < from) newActive++;

    updateState(
        { ...state, frames: newFrames, activeFrameIndex: newActive, selectedFrameIndices: newSelectedIndices }, 
        { action: 'Reorder Frames' }
    );
  };

  const importPalette = async (file: File) => {
    const { activeProjectId } = latestRef.current;
    if (activeProjectId === 'home') return;
    try {
      let colors: string[] = [];
      const name = file.name.split('.')[0];
      if (file.name.endsWith('.ase')) {
        const buffer = await file.arrayBuffer();
        colors = await parseASE(buffer);
      } else if (file.name.endsWith('.gpl')) {
        const text = await file.text();
        colors = await parseGPL(text);
      } else if (file.name.endsWith('.png')) {
        colors = await extractColorsFromPNG(file);
      } else {
        toast.error("Unsupported format. Use .ase, .gpl, or .png");
        return;
      }
      if (colors.length === 0) { toast.error("No colors found."); return; }
      const newPalette: SavedPalette = { id: `pal-${Date.now()}`, name: name, colors: colors };
      updateState(
          (prev) => ({ ...prev, paletteLibrary: [...prev.paletteLibrary, newPalette], palette: newPalette.colors, activePaletteId: newPalette.id }),
          { action: `Import Palette: ${name}` }
      );
    } catch (e) { console.error(e); toast.error("Failed to import palette."); }
  };

  const selectPalette = (id: string) => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const selected = state.paletteLibrary.find(p => p.id === id);
      if (selected) updateState({ ...state, palette: selected.colors, activePaletteId: selected.id });
  };

  const resizeCanvas = (newWidth: number, newHeight: number, anchor: string = 'cc') => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      if (newWidth === state.width && newHeight === state.height) return;

      const oldWidth = state.width;
      const oldHeight = state.height;

      const getOffsets = (aw: number, ah: number, nw: number, nh: number, anch: string) => {
          let ox = 0, oy = 0;
          if (anch.includes('l')) ox = 0;
          else if (anch.includes('r')) ox = nw - aw;
          else ox = Math.floor((nw - aw) / 2);

          if (anch.includes('t')) oy = 0;
          else if (anch.includes('b')) oy = nh - ah;
          else oy = Math.floor((nh - ah) / 2);
          
          return { ox, oy };
      };

      const { ox, oy } = getOffsets(oldWidth, oldHeight, newWidth, newHeight, anchor);

      const newFrames = state.frames.map(f => {
          const newLayerData: Record<string, PixelGrid> = {};
          Object.keys(f.layerData).forEach(lid => {
              const oldGrid = f.layerData[lid];
              const newGrid = createPixelGrid(newWidth * newHeight);
              for (let y = 0; y < oldHeight; y++) {
                  const ny = y + oy;
                  if (ny < 0 || ny >= newHeight) continue;
                  const srcXStart = Math.max(0, -ox);
                  const srcXEnd = Math.min(oldWidth, newWidth - ox);
                  if (srcXEnd <= srcXStart) continue;
                  const srcOff = y * oldWidth + srcXStart;
                  const dstOff = ny * newWidth + (srcXStart + ox);
                  newGrid.set(oldGrid.subarray(srcOff, srcOff + (srcXEnd - srcXStart)), dstOff);
              }
              newLayerData[lid] = newGrid;
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, width: newWidth, height: newHeight, frames: newFrames, selection: null },
          { action: `Resize Canvas to ${newWidth}x${newHeight}` }
      );
  };

  const setReferenceImage = (config: ProjectState['referenceImage']) => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      updateState({ ...state, referenceImage: config }, { action: 'Update Reference Image' });
  };

  const setTiled = (tiled: boolean) => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      updateState({ ...state, tiled }, { action: tiled ? 'Enable Tiled Mode' : 'Disable Tiled Mode' });
  };

  const flipPixels = (axis: 'h' | 'v') => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds, selection } = state;
      
      const box = selection 
          ? getSelectionBoundingBox(selection, width) 
          : { x: 0, y: 0, w: width, h: height };

      const layerPatches: PixelLayerPatch[] = [];
      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const basePixels = f.layerData[lId];
              if (!basePixels) return;
              const updatedPixels = clonePixelGrid(basePixels);

              if (selection) {
                  // Clear original selection pixels
                  selection.forEach(idx => { updatedPixels[idx] = EMPTY_PIXEL; });
              }

              for (let y = 0; y < box.h; y++) {
                  for (let x = 0; x < box.w; x++) {
                      const srcX = box.x + x;
                      const srcY = box.y + y;
                      const destX = axis === 'h' ? box.x + box.w - 1 - x : srcX;
                      const destY = axis === 'v' ? box.y + box.h - 1 - y : srcY;

                      const srcIdx = getIndex(srcX, srcY, width);
                      const destIdx = getIndex(destX, destY, width);

                      if (!selection || selection.has(srcIdx)) {
                          const val = basePixels[srcIdx];
                          if (!selection || val !== EMPTY_PIXEL) {
                              updatedPixels[destIdx] = val;
                          }
                      }
                  }
              }
              newLayerData[lId] = updatedPixels;
              const patch = buildLayerPatch(lId, basePixels, updatedPixels, width, height, {
                minX: box.x,
                minY: box.y,
                maxX: box.x + box.w - 1,
                maxY: box.y + box.h - 1,
              });
              if (patch) layerPatches.push(patch);
          });
          return { ...f, layerData: newLayerData };
      });

      const newSelection = selection ? selection.flip(axis, box) : null;

      updateState(
          { ...state, frames: newFrames, selection: newSelection },
          {
            action: `Flip ${axis === 'h' ? 'Horizontal' : 'Vertical'}`,
            patch: layerPatches.length > 0 ? {
              frameIndex: activeFrameIndex,
              layers: layerPatches,
              selectionBefore: selection,
              selectionAfter: newSelection,
            } : undefined,
          }
      );
  };

  const centerContent = () => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds } = state;
      
      const currentFrame = frames[activeFrameIndex];
      let minX = width, minY = height, maxX = -1, maxY = -1;
      let hasPixels = false;

      selectedLayerIds.forEach(lId => {
          const pixels = currentFrame.layerData[lId];
          if (!pixels) return;
          for (let y = 0; y < height; y++) {
              const rowOff = y * width;
              for (let x = 0; x < width; x++) {
                  if (pixels[rowOff + x] !== EMPTY_PIXEL) {
                      if (x < minX) minX = x;
                      if (x > maxX) maxX = x;
                      if (y < minY) minY = y;
                      if (y > maxY) maxY = y;
                      hasPixels = true;
                  }
              }
          }
      });

      if (!hasPixels) return;

      const contentW = maxX - minX + 1;
      const contentH = maxY - minY + 1;
      const targetX = Math.floor((width - contentW) / 2);
      const targetY = Math.floor((height - contentH) / 2);
      const offsetX = targetX - minX;
      const offsetY = targetY - minY;

      if (offsetX === 0 && offsetY === 0) return;

      const patchBounds = {
        minX: Math.min(minX, targetX),
        minY: Math.min(minY, targetY),
        maxX: Math.max(maxX, targetX + contentW - 1),
        maxY: Math.max(maxY, targetY + contentH - 1),
      };
      const layerPatches: PixelLayerPatch[] = [];

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const oldPixels = f.layerData[lId];
              if (!oldPixels) return;
              const newPixels = createPixelGrid(width * height);
              for (let y = minY; y <= maxY; y++) {
                  const ny = y + offsetY;
                  if (ny < 0 || ny >= height) continue;
                  const srcOff = y * width + minX;
                  const dstOff = ny * width + (minX + offsetX);
                  newPixels.set(oldPixels.subarray(srcOff, srcOff + contentW), dstOff);
              }
              newLayerData[lId] = newPixels;
              const patch = buildLayerPatch(lId, oldPixels, newPixels, width, height, patchBounds);
              if (patch) layerPatches.push(patch);
          });
          return { ...f, layerData: newLayerData };
      });

      let newSelection = state.selection;
      if (state.selection) {
          const moved = state.selection.translate(offsetX, offsetY);
          newSelection = moved.size > 0 ? moved : null;
      }

      updateState(
          { ...state, frames: newFrames, selection: newSelection },
          {
            action: 'Center Content',
            patch: layerPatches.length > 0 ? {
              frameIndex: activeFrameIndex,
              layers: layerPatches,
              selectionBefore: state.selection,
              selectionAfter: newSelection,
            } : undefined,
          }
      );
  };

  const generateOutline = () => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const { newState, actionSummary } = applyOutlineEffect(state, {
        placement: 'outside',
        matrix: DEFAULT_OUTLINE_MATRIX,
        thickness: 1,
        outlineColor: state.primaryColor || '#000000',
        bgMode: 'transparent',
        scope: state.selection && state.selection.size > 0 ? 'selection' : 'canvas',
        targetLayer: 'active',
        targetFrames: 'current'
      });
      updateState(newState, { action: actionSummary });
  };

  const strokeSelection = () => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, activeLayerId, selection, primaryColor, colorMode, palette } = state;
      if (!selection || selection.size === 0) return;

      const strokeColor = resolveColorToPixel(primaryColor, colorMode, palette);
      const box = getSelectionBoundingBox(selection, width);
      const layerPatches: PixelLayerPatch[] = [];

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          const pixels = f.layerData[activeLayerId] || createPixelGrid(width * height);
          const newPixels = clonePixelGrid(pixels);
          
          selection.forEach(idx => {
              const { x, y } = getCoords(idx, width);
              const isEdge = x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
                           !selection.has(y * width + (x - 1)) || 
                           !selection.has(y * width + (x + 1)) ||
                           !selection.has((y - 1) * width + x) ||
                           !selection.has((y + 1) * width + x);
              if (isEdge) {
                  newPixels[idx] = strokeColor;
              }
          });
          newLayerData[activeLayerId] = newPixels;
          const patch = buildLayerPatch(activeLayerId, pixels, newPixels, width, height, {
            minX: box.x,
            minY: box.y,
            maxX: box.x + box.w - 1,
            maxY: box.y + box.h - 1,
          });
          if (patch) layerPatches.push(patch);
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, frames: newFrames },
          {
            action: 'Stroke Selection',
            patch: layerPatches.length > 0 ? { frameIndex: activeFrameIndex, layers: layerPatches } : undefined,
          }
      );
  };

  const clearSelection = () => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds, selection } = state;
      if (!selection || selection.size === 0) return;

      const box = getSelectionBoundingBox(selection, width);
      const bounds = { minX: box.x, minY: box.y, maxX: box.x + box.w - 1, maxY: box.y + box.h - 1 };
      const layerPatches: PixelLayerPatch[] = [];

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const basePixels = f.layerData[lId];
              if (!basePixels) return;
              const layerPixels = clonePixelGrid(basePixels);
              selection.forEach(idx => { layerPixels[idx] = EMPTY_PIXEL; });
              newLayerData[lId] = layerPixels;
              const patch = buildLayerPatch(lId, basePixels, layerPixels, width, height, bounds);
              if (patch) layerPatches.push(patch);
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, frames: newFrames },
          {
            action: `Clear Selection`,
            patch: layerPatches.length > 0 ? { frameIndex: activeFrameIndex, layers: layerPatches } : undefined,
          }
      );
  };

  const cropCanvas = () => {
      const { activeProjectId, state } = latestRef.current;
      if (activeProjectId === 'home') return;
      const { frames, width, height, selection } = state;
      if (!selection || selection.size === 0) return;

      const box = getSelectionBoundingBox(selection, width);
      const newFrames = frames.map(f => {
          const newLayerData: Record<string, PixelGrid> = {};
          Object.keys(f.layerData).forEach(lid => {
              const oldGrid = f.layerData[lid];
              const newGrid = createPixelGrid(box.w * box.h);
              for (let y = 0; y < box.h; y++) {
                  const srcY = box.y + y;
                  if (srcY < 0 || srcY >= height) continue;
                  const srcXStart = Math.max(0, box.x);
                  const srcXEnd = Math.min(width, box.x + box.w);
                  if (srcXEnd <= srcXStart) continue;
                  const dstXStart = srcXStart - box.x;
                  const srcOff = srcY * width + srcXStart;
                  newGrid.set(oldGrid.subarray(srcOff, srcOff + (srcXEnd - srcXStart)), y * box.w + dstXStart);
              }
              newLayerData[lid] = newGrid;
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, width: box.w, height: box.h, frames: newFrames, selection: null },
          { action: `Crop Canvas` }
      );
  };

  const downloadImage = () => {
     const { activeProjectId, state } = latestRef.current;
     if (activeProjectId === 'home') return;
     const canvas = renderFrameToCanvas(state, state.activeFrameIndex);
     const filename = `${state.title}.png`;
     canvas.toBlob((blob) => {
       if (!blob) return;
       const url = URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.download = filename;
       link.href = url;
       link.click();
       setTimeout(() => URL.revokeObjectURL(url), 1000);
     }, 'image/png');
  };

  const downloadSpriteSheet = () => {
     const { activeProjectId, state } = latestRef.current;
     if (activeProjectId === 'home') return;
     const canvas = renderSpriteSheet(state);
     const filename = `${state.title}_spritesheet.png`;
     canvas.toBlob((blob) => {
       if (!blob) return;
       const url = URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.download = filename;
       link.href = url;
       link.click();
       setTimeout(() => URL.revokeObjectURL(url), 1000);
     }, 'image/png');
  };

  const setFrameDuration = (frameIndex: number, duration: number) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newFrames = state.frames.map((f, i) => i === frameIndex ? { ...f, duration } : f);
    updateState({ ...state, frames: newFrames }, { action: `Set Frame Duration (${duration}ms)` });
  };

  const addTag = (name: string, from: number, to: number, color?: string) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newTag: FrameTag = {
      id: `tag-${Date.now()}`,
      name,
      from,
      to,
      color: color || '#3b82f6',
      direction: 'forward'
    };
    const newTags = [...(state.tags || []), newTag];
    updateState({ ...state, tags: newTags }, { action: `Add Tag: ${name}` });
  };

  const saveTag = (tag: FrameTag) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const existingTags = state.tags || [];
    const exists = existingTags.some(t => t.id === tag.id);
    const newTags = exists
      ? existingTags.map(t => t.id === tag.id ? tag : t)
      : [...existingTags, tag];
    updateState({ ...state, tags: newTags }, { action: `Save Tag: ${tag.name}` });
  };

  const deleteTag = (tagId: string) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const newTags = (state.tags || []).filter(t => t.id !== tagId);
    updateState({ ...state, tags: newTags }, { action: 'Delete Tag' });
  };

  const updateSpriteProperties = (props: {
    title?: string;
    pixelRatio?: { width: number; height: number };
    transparentIndex?: number;
    colorMode?: ColorMode;
    grid?: { x: number; y: number; width: number; height: number };
  }) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    const nextColorMode = props.colorMode ?? state.colorMode;
    const nextFrames = nextColorMode !== state.colorMode
      ? convertFramesColorMode(
          state.frames,
          state.width,
          state.height,
          nextColorMode,
          state.palette,
          state.ditheringEnabled
        )
      : state.frames;

    updateState({
      ...state,
      title: props.title ?? state.title,
      pixelRatio: props.pixelRatio ?? state.pixelRatio,
      transparentIndex: props.transparentIndex ?? state.transparentIndex,
      colorMode: nextColorMode,
      frames: nextFrames,
      grid: props.grid ?? state.grid,
    }, { action: 'Update Sprite Properties' });
  };

  const updateSlices = (slices: Slice[]) => {
    const { activeProjectId, state } = latestRef.current;
    if (activeProjectId === 'home') return;
    updateState({ ...state, slices }, { action: 'Update Slices' });
  };

  const getActiveState = () => latestRef.current.state;
  const getActiveHistoryInfo = () => {
    const inst = latestRef.current.activeInstance;
    return { history: inst.history, historyIndex: inst.historyIndex };
  };

  const actions = {
    setActiveProjectId,
    loadRecentProject,
    clearRecents,
    createProject,
    loadProjectFromFile,
    saveProject,
    saveProjectAs,
    closeProject,
    switchTab,
    updateState,
    undo,
    redo,
    jumpToHistory,
    restoreCurrentHistoryState,
    setColorMode,
    getActiveState,
    getActiveHistoryInfo,
    addFrame,
    duplicateFrame,
    duplicateSelectedFrames,
    deleteFrame,
    deleteSelectedFrames,
    insertFrame,
    tweenFrames,
    setFrameDuration,
    addTag,
    saveTag,
    deleteTag,
    updateSpriteProperties,
    updateSlices,
    addLayer,
    addGroupLayer,
    groupSelectedLayers,
    ungroupSelectedLayers,
    addLayerToGroup,
    toggleCollapseAllGroups,
    deleteLayer,
    deleteSelectedLayers,
    duplicateLayer,
    duplicateSelectedLayers,
    updateLayer,
    reorderLayers,
    reorderFrames,
    importPalette,
    selectPalette,
    downloadImage,
    downloadSpriteSheet,
    resizeCanvas,
    setReferenceImage,
    setTiled,
    flipPixels,
    clearSelection,
    cropCanvas,
    centerContent,
    generateOutline,
    strokeSelection,
  };

  return {
    actions,
    state,
    projects,
    tabs,
    activeProjectId,
    setActiveProjectId,
    recentProjects,
    loadRecentProject,
    clearRecents,
    createProject,
    loadProjectFromFile,
    saveProject,
    saveProjectAs,
    closeProject,
    switchTab,
    updateState,
    undo,
    redo,
    jumpToHistory,
    restoreCurrentHistoryState,
    setColorMode,
    history: activeInstance.history, 
    historyIndex: activeInstance.historyIndex, 
    getActiveState,
    getActiveHistoryInfo,
    addFrame,
    duplicateFrame,
    duplicateSelectedFrames,
    deleteFrame,
    deleteSelectedFrames,
    insertFrame,
    tweenFrames,
    setFrameDuration,
    addTag,
    saveTag,
    deleteTag,
    updateSpriteProperties,
    updateSlices,
    addLayer,
    addGroupLayer,
    groupSelectedLayers,
    ungroupSelectedLayers,
    addLayerToGroup,
    toggleCollapseAllGroups,
    deleteLayer,
    deleteSelectedLayers,
    duplicateLayer,
    duplicateSelectedLayers,
    updateLayer,
    reorderLayers,
    reorderFrames,
    importPalette,
    selectPalette,
    downloadImage,
    downloadSpriteSheet,
    resizeCanvas,
    setReferenceImage,
    setTiled,
    flipPixels,
    clearSelection,
    cropCanvas,
    centerContent,
    generateOutline,
    strokeSelection,
    canUndo: activeInstance.historyIndex > 0,
    canRedo: activeInstance.historyIndex < activeInstance.history.length - 1
  };
}
