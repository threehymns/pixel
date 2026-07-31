
import { useState, useCallback, useEffect } from 'react';
import { ProjectState, Frame, Layer, FrameTag, SavedPalette, PixelGrid, HistoryEntry, ToolType, RecentProject, FileSystemFileHandle, ProjectInstance, ColorMode, PixelValue, Slice } from '../types';
import { INITIAL_STATE, DEFAULT_PALETTE, GAMEBOY_PALETTE, ENDESGA_64_PALETTE } from '../constants';
import { parseASE, parseGPL, extractColorsFromPNG, fileToProjectState, renderFrameToCanvas, renderSpriteSheet, getCoords, getIndex, hexToRgb, rgbToHex, findNearestPaletteIndex, getSelectionBoundingBox, getLayerParentMap, isDescendant, getGroupChildren } from '../utils';
import { encodeAseprite } from '../utils/aseprite';

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
    'ditheringEnabled'
];

/**
 * Finds the nearest color in a palette to the given RGB values.
 * Uses standard Euclidean distance in RGB space.
 */
const findNearestPaletteColor = (r: number, g: number, b: number, palette: string[]): string => {
  const index = findNearestPaletteIndex(r, g, b, palette);
  return palette[index] || '#000000';
};

interface PixelPoint {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Finds the nearest pixel in a list spatially.
 */
const findNearestSpatially = (point: {x: number, y: number}, list: PixelPoint[]): PixelPoint => {
  let minDistance = Infinity;
  let nearest = list[0];
  
  for (const p of list) {
    const dist = Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = p;
    }
    if (dist === 0) break;
  }
  return nearest;
};

export function useProject() {
  const [projects, setProjects] = useState<ProjectInstance[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('home');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load recents from LS on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pixel-forge-recents');
      if (stored) {
        const parsed = JSON.parse(stored);
      const sanitized = parsed.map((p: RecentProject) => ({
             ...p,
             data: {
                 ...p.data,
                 selection: null,
                 fileHandle: undefined, // Do not restore handles from localstorage
                 layers: p.data.layers?.map(l => ({ 
                     ...l, 
                     opacity: l.opacity ?? 100,
                     blendMode: l.blendMode ?? 'normal'
                 })) ?? []
             }
      }));
        setRecentProjects(sanitized);
      }
    } catch (e) {
      console.warn("Failed to load recents", e);
    }
  }, []);

  const saveRecents = useCallback((list: RecentProject[]) => {
      try {
          const cleanList = list.map(r => ({
              ...r,
              data: {
                  ...r.data,
                  selection: null,
                  fileHandle: undefined // Ensure no handle serialization attempts
              }
          }));
          localStorage.setItem('pixel-forge-recents', JSON.stringify(cleanList));
      } catch (e) {
          console.warn("LocalStorage full, cannot save recent project", e);
      }
  }, []);

  const addToRecents = useCallback((project: ProjectState) => {
      setRecentProjects(prev => {
          const filtered = prev.filter(p => p.data.id !== project.id && p.title !== project.title);
          const newEntry: RecentProject = {
              id: project.id,
              title: project.title,
              timestamp: Date.now(),
              data: project
          };
          const newList = [newEntry, ...filtered].slice(0, 5); // Keep max 5
          saveRecents(newList);
          return newList;
      });
  }, [saveRecents]);

  const loadRecentProject = useCallback((recent: RecentProject) => {
      // Check if already open
      const existing = projects.find(p => p.data.id === recent.data.id || p.data.title === recent.title);
      if (existing) {
          setActiveProjectId(existing.data.id);
          return;
      }

      const newProjectState = { ...recent.data, selection: null };
      
      setProjects(prev => [...prev, {
          data: newProjectState,
          history: [{ state: newProjectState, action: 'Open Recent', timestamp: Date.now() }],
          historyIndex: 0,
          lastSavedHistoryIndex: 0
      }]);
      setActiveProjectId(newProjectState.id);
  }, [projects]);

  const clearRecents = useCallback(() => {
      setRecentProjects([]);
      localStorage.removeItem('pixel-forge-recents');
  }, []);

  const activeIndex = projects.findIndex(p => p.data.id === activeProjectId);
  const activeInstance = activeIndex >= 0 ? projects[activeIndex] : {
      data: INITIAL_STATE, 
      history: [],
      historyIndex: 0,
      lastSavedHistoryIndex: 0
  };
  const state = activeInstance.data;

  /**
   * Helper to merge current UI state into a historical snapshot.
   * This ensures Undo/Redo doesn't change things like tool, colors, or zoom.
   */
  const mergeUIState = (snapshot: ProjectState, current: ProjectState): ProjectState => {
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
  };

  const createProject = useCallback((config?: { width: number, height: number, colorMode: ColorMode, title?: string }) => {
    const w = config?.width ?? INITIAL_STATE.width;
    const h = config?.height ?? INITIAL_STATE.height;
    const mode = config?.colorMode ?? INITIAL_STATE.colorMode;
    const title = config?.title ?? `Untitled-${projects.length + 1}`;
    
    const id = `project-${Date.now()}`;
    const newProject: ProjectState = {
      ...INITIAL_STATE,
      id,
      title,
      width: w,
      height: h,
      colorMode: mode,
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 100, blendMode: 'normal' }],
      selectedLayerIds: ['layer-1'],
      frames: [{ id: 'frame-1', layerData: { 'layer-1': new Array(w * h).fill(null) } }],
      selectedFrameIndices: [0],
      zoom: Math.min(64, Math.floor(512 / Math.max(w, h))),
    };
    
    const initialEntry: HistoryEntry = {
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
  }, [projects.length, addToRecents]);

  const loadProjectFromFile = useCallback(async (file: File, handle?: FileSystemFileHandle) => {
    try {
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

      setProjects(prev => [...prev, {
        data: newState,
        history: [{ state: newState, action: 'Import File', timestamp: Date.now() }],
        historyIndex: 0,
        lastSavedHistoryIndex: 0
      }]);
      setActiveProjectId(newState.id);
      addToRecents(newState);
    } catch (e) {
      console.error(e);
      alert("Failed to load project: " + e);
    }
  }, [addToRecents]);

  const updateState = useCallback((
      newState: ProjectState, 
      historyConfig?: { action: string, tool?: ToolType }
  ) => {
    if (activeProjectId === 'home') return;

    let cleanSelection: Set<number> | null = null;
    if (newState.selection) {
      const arr = newState.selection instanceof Set 
        ? Array.from(newState.selection) 
        : (Array.isArray(newState.selection) ? newState.selection : []);
      const numSet = new Set<number>();
      for (let i = 0; i < arr.length; i++) {
        const n = Number(arr[i]);
        if (!isNaN(n)) numSet.add(n);
      }
      cleanSelection = numSet.size > 0 ? numSet : null;
    }
    const sanitizedState = { ...newState, selection: cleanSelection };

    setProjects(prev => prev.map(p => {
      if (p.data.id !== activeProjectId) return p;

      let newHistory = p.history;
      let newIndex = p.historyIndex;

      if (historyConfig) {
        newHistory = p.history.slice(0, p.historyIndex + 1);
        newHistory.push({
            state: sanitizedState,
            action: historyConfig.action,
            tool: historyConfig.tool,
            timestamp: Date.now()
        });
        if (newHistory.length > 50) newHistory.shift(); 
        newIndex = newHistory.length - 1;
      }

      return {
        data: sanitizedState,
        history: newHistory,
        historyIndex: newIndex,
        lastSavedHistoryIndex: p.lastSavedHistoryIndex
      };
    }));
  }, [activeProjectId]);

  const markSaved = useCallback(() => {
      setProjects(prev => prev.map(p => {
          if (p.data.id === activeProjectId) {
              return { ...p, lastSavedHistoryIndex: p.historyIndex };
          }
          return p;
      }));
  }, [activeProjectId]);

  const saveProjectAs = useCallback(async () => {
    if (activeProjectId === 'home') return;

    const isInIframe = window.self !== window.top;

    const performFallbackDownload = () => {
      const aseBytes = encodeAseprite(state);
      const blob = new Blob([aseBytes.buffer], { type: 'image/x-aseprite' });
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
      performFallbackDownload();
      return;
    }

    try {
        const options = {
            suggestedName: state.title ? (state.title.endsWith('.aseprite') ? state.title : `${state.title}.aseprite`) : 'pixel-art.aseprite',
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
             const canvas = renderFrameToCanvas(state, state.activeFrameIndex);
             const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
             if (!blob) throw new Error("Failed to render PNG");
             
             const writable = await handle.createWritable();
             await writable.write(blob);
             await writable.close();
             
             const newState = { ...state, title: handle.name, fileHandle: handle };
             updateState(newState, { action: 'Save As PNG' });
             markSaved();
             addToRecents(newState);
        } else {
             const aseBytes = encodeAseprite(state);
             const writable = await handle.createWritable();
             await writable.write(aseBytes.buffer);
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
         performFallbackDownload();
    }
  }, [state, activeProjectId, updateState, addToRecents, markSaved]);

  const saveProject = useCallback(async () => {
    if (activeProjectId === 'home') return;
    if (!state.fileHandle) {
        await saveProjectAs();
        return;
    }

    addToRecents(state);

    try {
        const name = state.fileHandle.name.toLowerCase();
        
        if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
           const canvas = renderFrameToCanvas(state, state.activeFrameIndex);
           const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
           if (!blob) throw new Error("Failed to render PNG");
           
           const writable = await state.fileHandle.createWritable();
           await writable.write(blob);
           await writable.close();
           markSaved();
           alert(`Saved ${state.fileHandle.name}`);
           return;
        }
        
        if (name.endsWith('.aseprite') || name.endsWith('.ase') || name.endsWith('.json')) {
            const aseBytes = encodeAseprite(state);
            const writable = await state.fileHandle.createWritable();
            await writable.write(aseBytes.buffer);
            await writable.close();
            markSaved();
            alert(`Saved ${state.fileHandle.name}`);
            return;
        }
        await saveProjectAs();
    } catch (e) {
        console.error("Save failed", e);
        alert("Failed to save project.");
    }
  }, [state, activeProjectId, addToRecents, saveProjectAs, markSaved]);

  const closeProject = useCallback((id: string) => {
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
  }, [activeProjectId, projects]);

  const switchTab = useCallback((direction: 'next' | 'prev') => {
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
  }, [activeProjectId, projects]);

  const undo = useCallback(() => {
    if (activeProjectId === 'home') return;
    setProjects(prev => prev.map(p => {
        if (p.data.id !== activeProjectId) return p;
        if (p.historyIndex > 0) {
            const newIndex = p.historyIndex - 1;
            const historicalState = p.history[newIndex].state;
            return { 
                ...p, 
                data: mergeUIState(historicalState, p.data), 
                historyIndex: newIndex 
            };
        }
        return p;
    }));
  }, [activeProjectId]);

  const redo = useCallback(() => {
     if (activeProjectId === 'home') return;
     setProjects(prev => prev.map(p => {
        if (p.data.id !== activeProjectId) return p;
        if (p.historyIndex < p.history.length - 1) {
            const newIndex = p.historyIndex + 1;
            const historicalState = p.history[newIndex].state;
            return { 
                ...p, 
                data: mergeUIState(historicalState, p.data), 
                historyIndex: newIndex 
            };
        }
        return p;
    }));
  }, [activeProjectId]);

  const jumpToHistory = useCallback((index: number) => {
    if (activeProjectId === 'home') return;
    setProjects(prev => prev.map(p => {
      if (p.data.id !== activeProjectId) return p;
      if (index >= 0 && index < p.history.length) {
        const historicalState = p.history[index].state;
        return { 
            ...p, 
            data: mergeUIState(historicalState, p.data), 
            historyIndex: index 
        };
      }
      return p;
    }));
  }, [activeProjectId]);

  const setColorMode = useCallback((mode: ColorMode) => {
    if (activeProjectId === 'home' || state.colorMode === mode) return;

    let newPalette = [...state.palette];
    const width = state.width;
    const height = state.height;
    const ditheringEnabled = state.ditheringEnabled;

    let newFrames = state.frames.map(f => ({ ...f, layerData: { ...f.layerData } }));

    if (mode === 'indexed') {
        // Floyd-Steinberg Dithering conversion if enabled
        newFrames = state.frames.map(f => {
            const newLayerData: Record<string, PixelGrid> = {};
            Object.keys(f.layerData).forEach(lid => {
                const sourceGrid = f.layerData[lid];
                const targetGrid: PixelGrid = new Array(width * height).fill(null);
                
                if (!ditheringEnabled) {
                    // Standard Weighted Mapping
                    targetGrid.fill(null);
                    sourceGrid.forEach((val, i) => {
                        if (val === null) return;
                        const [r, g, b] = hexToRgb(typeof val === 'number' ? newPalette[val] : val);
                        targetGrid[i] = findNearestPaletteIndex(r, g, b, newPalette);
                    });
                } else {
                    // Floyd-Steinberg
                    const errorBufferR = new Float32Array(width * height).fill(0);
                    const errorBufferG = new Float32Array(width * height).fill(0);
                    const errorBufferB = new Float32Array(width * height).fill(0);

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const i = getIndex(x, y, width);
                            const val = sourceGrid[i];
                            if (val === null) continue;

                            const [r, g, b] = hexToRgb(typeof val === 'number' ? newPalette[val] : val);
                            
                            const curR = Math.max(0, Math.min(255, r + errorBufferR[i]));
                            const curG = Math.max(0, Math.min(255, g + errorBufferG[i]));
                            const curB = Math.max(0, Math.min(255, b + errorBufferB[i]));

                            const paletteIndex = findNearestPaletteIndex(curR, curG, curB, newPalette);
                            targetGrid[i] = paletteIndex;

                            const [pr, pg, pb] = hexToRgb(newPalette[paletteIndex]);
                            const errR = curR - pr;
                            const errG = curG - pg;
                            const errB = curB - pb;

                            const distribute = (dx: number, dy: number, factor: number) => {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const ni = getIndex(nx, ny, width);
                                    errorBufferR[ni] += errR * factor;
                                    errorBufferG[ni] += errG * factor;
                                    errorBufferB[ni] += errB * factor;
                                }
                            };

                            distribute(1, 0, 7/16);
                            distribute(-1, 1, 3/16);
                            distribute(0, 1, 5/16);
                            distribute(1, 1, 1/16);
                        }
                    }
                }
                newLayerData[lid] = targetGrid;
            });
            return { ...f, layerData: newLayerData };
        });
    } else {
        // Convert Indexed -> RGBA
        newFrames = state.frames.map(f => {
            const newLayerData: Record<string, PixelGrid> = {};
            Object.keys(f.layerData).forEach(lid => {
                newLayerData[lid] = f.layerData[lid].map(val => {
                    if (val === null) return null;
                    if (typeof val === 'string') return val;
                    return state.palette[val] || '#000000';
                });
            });
            return { ...f, layerData: newLayerData };
        });
    }

    updateState(
        { ...state, colorMode: mode, palette: newPalette, frames: newFrames },
        { action: `Switch to ${mode.toUpperCase()} mode${ditheringEnabled ? ' (Dithered)' : ''}` }
    );
  }, [state, activeProjectId, updateState]);

  const addFrame = useCallback(() => {
    if (activeProjectId === 'home') return;
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: {} };
    state.layers.forEach(l => newFrame.layerData[l.id] = new Array(state.width * state.height).fill(null));
    updateState(
        { 
          ...state, 
          frames: [...state.frames, newFrame], 
          activeFrameIndex: state.frames.length,
          selectedFrameIndices: [state.frames.length]
        }, 
        { action: 'Add Frame' }
    );
  }, [state, updateState, activeProjectId]);

  const duplicateFrame = useCallback(() => {
    if (activeProjectId === 'home') return;
    const current = state.frames[state.activeFrameIndex];
    if (!current) return;
    const newData: Record<string, PixelGrid> = {};
    Object.keys(current.layerData).forEach(key => newData[key] = [...current.layerData[key]]);
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
  }, [state, updateState, activeProjectId]);

  const duplicateSelectedFrames = useCallback(() => {
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
        Object.keys(source.layerData).forEach(key => newData[key] = [...source.layerData[key]]);
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
  }, [state, updateState, activeProjectId]);

  const deleteFrame = useCallback(() => {
    if (activeProjectId === 'home') return;
    if (state.frames.length <= 1) return; 
    updateState(
        { ...state, frames: state.frames.filter((_, i) => i !== state.activeFrameIndex), activeFrameIndex: Math.max(0, state.activeFrameIndex - 1), selectedFrameIndices: [Math.max(0, state.activeFrameIndex - 1)] }, 
        { action: 'Delete Frame' }
    );
  }, [state, updateState, activeProjectId]);

  const deleteSelectedFrames = useCallback(() => {
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
  }, [state, updateState, activeProjectId]);

  const insertFrame = useCallback((index: number) => {
    if (activeProjectId === 'home') return;
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: {} };
    state.layers.forEach(l => newFrame.layerData[l.id] = new Array(state.width * state.height).fill(null));
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
  }, [state, updateState, activeProjectId]);

  const tweenFrames = useCallback(() => {
    if (activeProjectId === 'home') return;
    const selected = [...state.selectedFrameIndices].sort((a, b) => a - b);
    if (selected.length < 3) {
      alert("Select 3 or more frames to interpolate between the first and last of the selection.");
      return;
    }

    const startIdx = selected[0];
    const endIdx = selected[selected.length - 1];
    const layerId = state.activeLayerId;
    const width = state.width;
    const height = state.height;
    const palette = state.palette;

    const startPixelsArr = state.frames[startIdx].layerData[layerId] || [];
    const endPixelsArr = state.frames[endIdx].layerData[layerId] || [];

    // Resolve color helpers
    const getHex = (val: string | number | null): string | null => {
        if (val === null) return null;
        if (typeof val === 'number') return palette[val];
        return val;
    };

    // 1. Collect all non-null pixels from start and end frames
    const startList: PixelPoint[] = [];
    startPixelsArr.forEach((val, i) => {
        const hex = getHex(val);
        if (hex) {
          const [r, g, b] = hexToRgb(hex);
          startList.push({ ...getCoords(i, width), r, g, b });
        }
    });

    const endList: PixelPoint[] = [];
    endPixelsArr.forEach((val, i) => {
        const hex = getHex(val);
        if (hex) {
          const [r, g, b] = hexToRgb(hex);
          endList.push({ ...getCoords(i, width), r, g, b });
        }
    });

    // Handle empty frames gracefully
    if (startList.length === 0 && endList.length === 0) return;
    
    // Pairs map for interpolation
    const pairs: { s: PixelPoint, e: PixelPoint }[] = [];

    if (startList.length > 0 && endList.length > 0) {
        for (const s of startList) pairs.push({ s, e: findNearestSpatially(s, endList) });
        for (const e of endList) pairs.push({ s: findNearestSpatially(e, startList), e });
    }

    const newFrames = [...state.frames];

    // 2. Interpolate intermediate selected frames
    for (let i = 1; i < selected.length - 1; i++) {
        const currentFrameIdx = selected[i];
        const t = i / (selected.length - 1); 

        const framePixels: PixelGrid = new Array(width * height).fill(null);

        for (const pair of pairs) {
            const { s, e } = pair;

            const curX = Math.round(s.x + (e.x - s.x) * t);
            const curY = Math.round(s.y + (e.y - s.y) * t);

            const curR = s.r + (e.r - s.r) * t;
            const curG = s.g + (e.g - s.g) * t;
            const curB = s.b + (e.b - s.b) * t;

            const curHex = findNearestPaletteColor(curR, curG, curB, palette);
            const curVal = state.colorMode === 'indexed' ? palette.indexOf(curHex) : curHex;

            if (curX >= 0 && curX < width && curY >= 0 && curY < height) {
                framePixels[getIndex(curX, curY, width)] = (curVal === -1) ? (palette[0] || '#000000') : curVal;
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
  }, [state, activeProjectId, updateState]);

  const addLayer = useCallback(() => {
    if (activeProjectId === 'home') return;
    const newId = `layer-${Date.now()}`;
    let n = 1; while (state.layers.some(l => l.name === `Layer ${n}`)) n++;
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

    const newLayer: Layer = { id: newId, name: `Layer ${n}`, visible: true, locked: false, opacity: 100, blendMode: 'normal', childLevel, parentId };
    const newFrames = state.frames.map(f => ({ ...f, layerData: { ...f.layerData, [newId]: new Array(state.width * state.height).fill(null) } }));
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
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId, selectedLayerIds: [newId] }, 
        { action: 'Add Layer' }
    );
  }, [state, updateState, activeProjectId]);

  const addGroupLayer = useCallback(() => {
    if (activeProjectId === 'home') return;
    const newId = `group-${Date.now()}`;
    let n = 1; while (state.layers.some(l => l.name === `Group ${n}`)) n++;
    const activeL = state.layers.find(l => l.id === state.activeLayerId);
    const parentId = activeL ? (activeL.parentId ?? null) : null;
    const childLevel = activeL ? (activeL.parentId ? (activeL.childLevel ?? 1) - 1 : 0) : 0;
    const newLayer: Layer = { 
      id: newId, 
      name: `Group ${n}`, 
      visible: true, 
      locked: false, 
      opacity: 100, 
      blendMode: 'normal',
      type: 'group',
      childLevel,
      parentId,
      collapsed: false
    };
    const newFrames = state.frames.map(f => ({ ...f, layerData: { ...f.layerData, [newId]: new Array(state.width * state.height).fill(null) } }));
    const newLayers = [...state.layers]; const idx = state.layers.findIndex(l => l.id === state.activeLayerId);
    if(idx!==-1) newLayers.splice(idx+1, 0, newLayer); else newLayers.push(newLayer);
    updateState(
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId, selectedLayerIds: [newId] }, 
        { action: 'Add Group' }
    );
  }, [state, updateState, activeProjectId]);

  const deleteLayer = useCallback((id: string) => {
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
  }, [state, updateState, activeProjectId]);

  const deleteSelectedLayers = useCallback(() => {
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
  }, [state, updateState, activeProjectId]);

  const duplicateLayer = useCallback((id: string) => {
     if (activeProjectId === 'home') return;
     const layerIndex = state.layers.findIndex(l => l.id === id);
     if (layerIndex === -1) return;
     
     const sourceLayer = state.layers[layerIndex];
     const newId = `layer-${Date.now()}`;
     const newLayer: Layer = { ...sourceLayer, id: newId, name: `${sourceLayer.name} (Copy)` };
     
     const newLayers = [...state.layers];
     newLayers.splice(layerIndex + 1, 0, newLayer); // Insert above
     
     const newFrames = state.frames.map(f => ({
         ...f,
         layerData: {
             ...f.layerData,
             [newId]: f.layerData[id] ? [...f.layerData[id]] : new Array(state.width * state.height).fill(null)
         }
     }));

     updateState(
         { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId, selectedLayerIds: [newId] },
         { action: 'Duplicate Layer' }
     );
  }, [state, updateState, activeProjectId]);

  const duplicateSelectedLayers = useCallback(() => {
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
            f.layerData[newId] = sourceLayer.id in f.layerData ? [...f.layerData[id]] : new Array(state.width * state.height).fill(null);
        });
    });

    updateState(
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: duplicatedIds[0], selectedLayerIds: duplicatedIds },
        { action: `Duplicate ${selected.length} Layers` }
    );
  }, [state, updateState, activeProjectId]);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
      if (activeProjectId === 'home') return;
      const newLayers = state.layers.map(l => l.id === id ? { ...l, ...updates } : l);
      const action = updates.name ? 'Rename Layer' : 'Layer Properties';
      updateState(
          { ...state, layers: newLayers },
          { action: action }
      );
  }, [state, updateState, activeProjectId]);

  const groupSelectedLayers = useCallback(() => {
    if (activeProjectId === 'home') return;
    const selectedIds = state.selectedLayerIds.length > 0 ? state.selectedLayerIds : [state.activeLayerId];
    if (selectedIds.length === 0) return;

    const selectedLayers = state.layers.filter(l => selectedIds.includes(l.id));
    if (selectedLayers.length === 0) return;

    const indices = selectedLayers.map(l => state.layers.findIndex(layer => layer.id === l.id));
    const highestIndex = Math.max(...indices);
    const highestLayer = state.layers[highestIndex];

    const groupId = `group-${Date.now()}`;
    let n = 1; while (state.layers.some(l => l.name === `Group ${n}`)) n++;

    const parentId = highestLayer.parentId ?? null;
    const childLevel = highestLayer.childLevel ?? 0;

    const groupLayer: Layer = {
      id: groupId,
      name: `Group ${n}`,
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

    const newFrames = state.frames.map(f => ({
      ...f,
      layerData: {
        ...f.layerData,
        [groupId]: new Array(state.width * state.height).fill(null)
      }
    }));

    updateState(
      { ...state, layers: newLayers, frames: newFrames, activeLayerId: groupId, selectedLayerIds: [groupId] },
      { action: `Grouped ${selectedLayers.length} Layer(s)` }
    );
  }, [state, activeProjectId, updateState]);

  const ungroupSelectedLayers = useCallback(() => {
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
  }, [state, activeProjectId, updateState]);

  const addLayerToGroup = useCallback((groupId: string) => {
    if (activeProjectId === 'home') return;
    const group = state.layers.find(l => l.id === groupId);
    if (!group) return;

    const newId = `layer-${Date.now()}`;
    let n = 1; while (state.layers.some(l => l.name === `Layer ${n}`)) n++;

    const newLayer: Layer = {
      id: newId,
      name: `Layer ${n}`,
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

    const newFrames = state.frames.map(f => ({
      ...f,
      layerData: {
        ...f.layerData,
        [newId]: new Array(state.width * state.height).fill(null)
      }
    }));

    updateState(
      { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId, selectedLayerIds: [newId] },
      { action: `Added Layer to ${group.name}` }
    );
  }, [state, activeProjectId, updateState]);

  const toggleCollapseAllGroups = useCallback((forceCollapse?: boolean) => {
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
  }, [state, activeProjectId, updateState]);

  const reorderLayers = useCallback((dId: string, tId: string, pos: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom') => {
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
  }, [state, activeProjectId, updateState]);

  const reorderFrames = useCallback((from: number, to: number) => {
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
  }, [state, updateState, activeProjectId]);

  const importPalette = useCallback(async (file: File) => {
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
        alert("Unsupported format. Use .ase, .gpl, or .png");
        return;
      }
      if (colors.length === 0) { alert("No colors found."); return; }
      const newPalette: SavedPalette = { id: `pal-${Date.now()}`, name: name, colors: colors };
      updateState(
          { ...state, paletteLibrary: [...state.paletteLibrary, newPalette], palette: newPalette.colors, activePaletteId: newPalette.id },
          { action: `Import Palette: ${name}` }
      );
    } catch (e) { console.error(e); alert("Failed to import palette."); }
  }, [state, updateState, activeProjectId]);

  const selectPalette = useCallback((id: string) => {
      if (activeProjectId === 'home') return;
      const selected = state.paletteLibrary.find(p => p.id === id);
      if (selected) updateState({ ...state, palette: selected.colors, activePaletteId: selected.id });
  }, [state, updateState, activeProjectId]);

  const resizeCanvas = useCallback((newWidth: number, newHeight: number, anchor: string = 'cc') => {
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
              const newGrid: PixelGrid = new Array(newWidth * newHeight).fill(null);
              for (let y = 0; y < oldHeight; y++) {
                  for (let x = 0; x < oldWidth; x++) {
                      const nx = x + ox;
                      const ny = y + oy;
                      if (nx >= 0 && nx < newWidth && ny >= 0 && ny < newHeight) {
                          newGrid[ny * newWidth + nx] = oldGrid[y * oldWidth + x];
                      }
                  }
              }
              newLayerData[lid] = newGrid;
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, width: newWidth, height: newHeight, frames: newFrames, selection: null },
          { action: `Resize Canvas to ${newWidth}x${newHeight}` }
      );
  }, [state, updateState, activeProjectId]);

  const setReferenceImage = useCallback((config: ProjectState['referenceImage']) => {
      if (activeProjectId === 'home') return;
      updateState({ ...state, referenceImage: config }, { action: 'Update Reference Image' });
  }, [state, activeProjectId, updateState]);

  const setTiled = useCallback((tiled: boolean) => {
      if (activeProjectId === 'home') return;
      updateState({ ...state, tiled }, { action: tiled ? 'Enable Tiled Mode' : 'Disable Tiled Mode' });
  }, [state, activeProjectId, updateState]);

  const flipPixels = useCallback((axis: 'h' | 'v') => {
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds, selection } = state;
      
      const box = selection 
          ? getSelectionBoundingBox(selection, width) 
          : { x: 0, y: 0, w: width, h: height };

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const layerPixels = [...(f.layerData[lId] || new Array(width * height).fill(null))];
              const updatedPixels = [...layerPixels];

              if (selection) {
                  // Clear original selection pixels
                  selection.forEach(idx => updatedPixels[idx] = null);
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
                          if (layerPixels[srcIdx] !== null) {
                              updatedPixels[destIdx] = layerPixels[srcIdx];
                          }
                      }
                  }
              }
              newLayerData[lId] = updatedPixels;
          });
          return { ...f, layerData: newLayerData };
      });

      let newSelection = selection;
      if (selection) {
          newSelection = new Set<number>();
          selection.forEach(idx => {
               const {x, y} = getCoords(idx, width);
               const relX = x - box.x;
               const relY = y - box.y;
               const destX = axis === 'h' ? box.x + box.w - 1 - relX : x;
               const destY = axis === 'v' ? box.y + box.h - 1 - relY : y;
               newSelection!.add(getIndex(destX, destY, width));
          });
      }

      updateState(
          { ...state, frames: newFrames, selection: newSelection },
          { action: `Flip ${axis === 'h' ? 'Horizontal' : 'Vertical'}` }
      );
  }, [state, activeProjectId, updateState]);

  const centerContent = useCallback(() => {
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds } = state;
      
      const currentFrame = frames[activeFrameIndex];
      let minX = width, minY = height, maxX = -1, maxY = -1;
      let hasPixels = false;

      selectedLayerIds.forEach(lId => {
          const pixels = currentFrame.layerData[lId];
          if (!pixels) return;
          for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                  if (pixels[y * width + x] !== null) {
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

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const oldPixels = f.layerData[lId] || new Array(width * height).fill(null);
              const newPixels = new Array(width * height).fill(null);
              for (let y = 0; y < height; y++) {
                  for (let x = 0; x < width; x++) {
                      const val = oldPixels[y * width + x];
                      if (val !== null) {
                          const nx = x + offsetX;
                          const ny = y + offsetY;
                          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                              newPixels[ny * width + nx] = val;
                          }
                      }
                  }
              }
              newLayerData[lId] = newPixels;
          });
          return { ...f, layerData: newLayerData };
      });

      let newSelection = state.selection;
      if (state.selection) {
          newSelection = new Set<number>();
          state.selection.forEach(idx => {
              const { x, y } = getCoords(idx, width);
              const nx = x + offsetX;
              const ny = y + offsetY;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  newSelection!.add(getIndex(nx, ny, width));
              }
          });
      }

      updateState(
          { ...state, frames: newFrames, selection: newSelection },
          { action: 'Center Content' }
      );
  }, [state, activeProjectId, updateState]);

  const generateOutline = useCallback(() => {
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds, primaryColor, colorMode, palette } = state;
      
      const outlineColor = colorMode === 'indexed' 
          ? (palette.findIndex(c => c.toLowerCase() === primaryColor.toLowerCase()) > -1 ? palette.findIndex(c => c.toLowerCase() === primaryColor.toLowerCase()) : 0)
          : primaryColor;

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const pixels = f.layerData[lId] || new Array(width * height).fill(null);
              const newPixels = [...pixels];
              for (let y = 0; y < height; y++) {
                  for (let x = 0; x < width; x++) {
                      const idx = y * width + x;
                      if (pixels[idx] === null) {
                          if ((x > 0 && pixels[y * width + (x - 1)] !== null) ||
                              (x < width - 1 && pixels[y * width + (x + 1)] !== null) ||
                              (y > 0 && pixels[(y - 1) * width + x] !== null) ||
                              (y < height - 1 && pixels[(y + 1) * width + x] !== null)) {
                              newPixels[idx] = outlineColor;
                          }
                      }
                  }
              }
              newLayerData[lId] = newPixels;
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, frames: newFrames },
          { action: 'Generate Outline' }
      );
  }, [state, activeProjectId, updateState]);

  const strokeSelection = useCallback(() => {
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, activeLayerId, selection, primaryColor, colorMode, palette } = state;
      if (!selection || selection.size === 0) return;

      const strokeColor = colorMode === 'indexed' 
          ? (palette.findIndex(c => c.toLowerCase() === primaryColor.toLowerCase()) > -1 ? palette.findIndex(c => c.toLowerCase() === primaryColor.toLowerCase()) : 0)
          : primaryColor;

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          const pixels = f.layerData[activeLayerId] || new Array(width * height).fill(null);
          const newPixels = [...pixels];
          
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
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, frames: newFrames },
          { action: 'Stroke Selection' }
      );
  }, [state, activeProjectId, updateState]);

  const clearSelection = useCallback(() => {
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds, selection } = state;
      if (!selection || selection.size === 0) return;

      const newFrames = frames.map((f, i) => {
          if (i !== activeFrameIndex) return f;
          const newLayerData = { ...f.layerData };
          selectedLayerIds.forEach(lId => {
              const layerPixels = [...(f.layerData[lId] || new Array(width * height).fill(null))];
              selection.forEach(idx => layerPixels[idx] = null);
              newLayerData[lId] = layerPixels;
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, frames: newFrames },
          { action: `Clear Selection` }
      );
  }, [state, activeProjectId, updateState]);

  const cropCanvas = useCallback(() => {
      if (activeProjectId === 'home') return;
      const { frames, width, height, activeFrameIndex, selectedLayerIds, selection } = state;
      if (!selection || selection.size === 0) return;

      const box = getSelectionBoundingBox(selection, width);
      const newFrames = frames.map(f => {
          const newLayerData: Record<string, PixelGrid> = {};
          Object.keys(f.layerData).forEach(lid => {
              const oldGrid = f.layerData[lid];
              const newGrid: PixelGrid = new Array(box.w * box.h).fill(null);
              for (let y = 0; y < box.h; y++) {
                  for (let x = 0; x < box.w; x++) {
                      const srcX = box.x + x;
                      const srcY = box.y + y;
                      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                          newGrid[y * box.w + x] = oldGrid[srcY * width + srcX];
                      }
                  }
              }
              newLayerData[lid] = newGrid;
          });
          return { ...f, layerData: newLayerData };
      });

      updateState(
          { ...state, width: box.w, height: box.h, frames: newFrames, selection: null },
          { action: `Crop Canvas` }
      );
  }, [state, activeProjectId, updateState]);

  const downloadImage = useCallback(() => {
     if (activeProjectId === 'home') return;
     const canvas = renderFrameToCanvas(state, state.activeFrameIndex);
     const link = document.createElement('a'); 
     link.download = `${state.title}.png`; 
     link.href = canvas.toDataURL(); 
     link.click();
  }, [state, activeProjectId]);

  const downloadSpriteSheet = useCallback(() => {
     if (activeProjectId === 'home') return;
     const canvas = renderSpriteSheet(state);
     const link = document.createElement('a'); 
     link.download = `${state.title}_spritesheet.png`; 
     link.href = canvas.toDataURL(); 
     link.click();
  }, [state, activeProjectId]);

  const setFrameDuration = useCallback((frameIndex: number, duration: number) => {
    if (activeProjectId === 'home') return;
    const newFrames = state.frames.map((f, i) => i === frameIndex ? { ...f, duration } : f);
    updateState({ ...state, frames: newFrames }, { action: `Set Frame Duration (${duration}ms)` });
  }, [state, activeProjectId, updateState]);

  const addTag = useCallback((name: string, from: number, to: number, color?: string) => {
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
  }, [state, activeProjectId, updateState]);

  const saveTag = useCallback((tag: FrameTag) => {
    if (activeProjectId === 'home') return;
    const existingTags = state.tags || [];
    const exists = existingTags.some(t => t.id === tag.id);
    const newTags = exists
      ? existingTags.map(t => t.id === tag.id ? tag : t)
      : [...existingTags, tag];
    updateState({ ...state, tags: newTags }, { action: `Save Tag: ${tag.name}` });
  }, [state, activeProjectId, updateState]);

  const deleteTag = useCallback((tagId: string) => {
    if (activeProjectId === 'home') return;
    const newTags = (state.tags || []).filter(t => t.id !== tagId);
    updateState({ ...state, tags: newTags }, { action: 'Delete Tag' });
  }, [state, activeProjectId, updateState]);

  const updateSpriteProperties = useCallback((props: {
    title?: string;
    pixelRatio?: { width: number; height: number };
    transparentIndex?: number;
    colorMode?: ColorMode;
    grid?: { x: number; y: number; width: number; height: number };
  }) => {
    if (activeProjectId === 'home') return;
    updateState({
      ...state,
      title: props.title ?? state.title,
      pixelRatio: props.pixelRatio ?? state.pixelRatio,
      transparentIndex: props.transparentIndex ?? state.transparentIndex,
      colorMode: props.colorMode ?? state.colorMode,
      grid: props.grid ?? state.grid,
    }, { action: 'Update Sprite Properties' });
  }, [state, activeProjectId, updateState]);

  const updateSlices = useCallback((slices: Slice[]) => {
    if (activeProjectId === 'home') return;
    updateState({ ...state, slices }, { action: 'Update Slices' });
  }, [state, activeProjectId, updateState]);

  return {
    state,
    projects,
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
    setColorMode,
    history: activeInstance.history, 
    historyIndex: activeInstance.historyIndex, 
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
