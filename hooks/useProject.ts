
import { useState, useCallback, useEffect } from 'react';
import { ProjectState, Frame, Layer, SavedPalette, PixelGrid, HistoryEntry, ToolType, RecentProject } from '../types';
import { INITIAL_STATE, DEFAULT_PALETTE, GAMEBOY_PALETTE } from '../constants';
import { parseASE, parseGPL, extractColorsFromPNG, fileToProjectState } from '../utils';

interface ProjectInstance {
  data: ProjectState;
  history: HistoryEntry[];
  historyIndex: number;
}

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
        // Basic hydration fix: Sets inside JSON are usually arrays, need to handle if ProjectState uses Sets.
        // ProjectState uses `selection: Set<number> | null`. JSON.parse will make it an array or object.
        // We should convert it back to Set if we want to be strict, but for "opening" a file, 
        // usually selection is cleared. Let's sanitize.
        const sanitized = parsed.map((p: RecentProject) => ({
             ...p,
             data: {
                 ...p.data,
                 selection: null // Clear selection on reload to avoid Set/Array issues
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
          // Serialize. Note: Sets need to be handled if we wanted to persist them, 
          // but for recent files we can drop selection.
          const cleanList = list.map(r => ({
              ...r,
              data: {
                  ...r.data,
                  selection: null // Drop selection
              }
          }));
          localStorage.setItem('pixel-forge-recents', JSON.stringify(cleanList));
      } catch (e) {
          console.warn("LocalStorage full, cannot save recent project", e);
          // Optional: try to remove oldest
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

      // Add to projects
      // We need to clone it to avoid reference issues and ensure clean state
      const newProjectState = { ...recent.data, selection: null };
      
      setProjects(prev => [...prev, {
          data: newProjectState,
          history: [{ state: newProjectState, action: 'Open Recent', timestamp: Date.now() }],
          historyIndex: 0
      }]);
      setActiveProjectId(newProjectState.id);
  }, [projects]);

  const clearRecents = useCallback(() => {
      setRecentProjects([]);
      localStorage.removeItem('pixel-forge-recents');
  }, []);

  // Helper to get active instance
  const activeIndex = projects.findIndex(p => p.data.id === activeProjectId);
  const activeInstance = activeIndex >= 0 ? projects[activeIndex] : {
      data: INITIAL_STATE, // Fallback dummy state to prevent crashes when on Home
      history: [],
      historyIndex: 0
  };
  const state = activeInstance.data;

  // --- Multi-Project Management ---

  const createProject = useCallback(() => {
    const id = `project-${Date.now()}`;
    const newProject: ProjectState = {
      ...INITIAL_STATE,
      id,
      title: `Untitled-${projects.length + 1}`,
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }],
      frames: [{ id: 'frame-1', layerData: { 'layer-1': new Array(INITIAL_STATE.width * INITIAL_STATE.height).fill(null) } }],
    };
    
    const initialEntry: HistoryEntry = {
        state: newProject,
        action: 'New Project',
        timestamp: Date.now()
    };

    setProjects(prev => [...prev, {
      data: newProject,
      history: [initialEntry],
      historyIndex: 0
    }]);
    setActiveProjectId(id);
    addToRecents(newProject);
  }, [projects.length, addToRecents]);

  const loadProjectFromFile = useCallback(async (file: File) => {
    try {
      const newState = await fileToProjectState(file);
      // Ensure unique ID and valid defaults
      newState.id = `project-${Date.now()}`;
      
      if (!newState.paletteLibrary || newState.paletteLibrary.length === 0) {
          newState.paletteLibrary = [DEFAULT_PALETTE, GAMEBOY_PALETTE];
          newState.activePaletteId = DEFAULT_PALETTE.id;
      }

      setProjects(prev => [...prev, {
        data: newState,
        history: [{ state: newState, action: 'Import File', timestamp: Date.now() }],
        historyIndex: 0
      }]);
      setActiveProjectId(newState.id);
      addToRecents(newState);
    } catch (e) {
      console.error(e);
      alert("Failed to load project: " + e);
    }
  }, [addToRecents]);

  const saveProject = useCallback(() => {
    if (activeProjectId === 'home') return;
    
    // Update recents on save to capture latest state
    addToRecents(state);

    const jsonString = JSON.stringify(state, (key, value) => {
        if (key === 'selection' && value instanceof Set) return Array.from(value);
        if (key === 'selection' && value === null) return null;
        return value;
    }, 2);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${state.title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }, [state, activeProjectId, addToRecents]);

  const closeProject = useCallback((id: string) => {
    // Determine new active project BEFORE removing the old one
    let nextActiveId = activeProjectId;
    
    if (activeProjectId === id) {
        // We are closing the active one
        const idx = projects.findIndex(p => p.data.id === id);
        const remaining = projects.filter(p => p.data.id !== id);
        
        if (remaining.length > 0) {
            // Switch to previous one, or first one
            const newIdx = Math.max(0, idx - 1);
            nextActiveId = remaining[newIdx].data.id;
        } else {
            // No projects left
            nextActiveId = 'home';
        }
    }

    setProjects(prev => prev.filter(p => p.data.id !== id));
    setActiveProjectId(nextActiveId);
  }, [activeProjectId, projects]);

  const switchTab = useCallback((direction: 'next' | 'prev') => {
      // If on home, move to first or last
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

  // --- State Updates with History (Scoped to Active Project) ---

  const updateState = useCallback((
      newState: ProjectState, 
      historyConfig?: { action: string, tool?: ToolType }
  ) => {
    if (activeProjectId === 'home') return; // Cannot update state on Home

    setProjects(prev => prev.map(p => {
      if (p.data.id !== activeProjectId) return p;

      let newHistory = p.history;
      let newIndex = p.historyIndex;

      if (historyConfig) {
        newHistory = p.history.slice(0, p.historyIndex + 1);
        newHistory.push({
            state: newState,
            action: historyConfig.action,
            tool: historyConfig.tool,
            timestamp: Date.now()
        });
        if (newHistory.length > 50) newHistory.shift(); // Limit history depth
        newIndex = newHistory.length - 1;
      }

      return {
        data: newState,
        history: newHistory,
        historyIndex: newIndex
      };
    }));
  }, [activeProjectId]);

  const undo = useCallback(() => {
    if (activeProjectId === 'home') return;
    setProjects(prev => prev.map(p => {
        if (p.data.id !== activeProjectId) return p;
        if (p.historyIndex > 0) {
            const newIndex = p.historyIndex - 1;
            return { ...p, data: p.history[newIndex].state, historyIndex: newIndex };
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
            return { ...p, data: p.history[newIndex].state, historyIndex: newIndex };
        }
        return p;
    }));
  }, [activeProjectId]);

  const jumpToHistory = useCallback((index: number) => {
    if (activeProjectId === 'home') return;
    setProjects(prev => prev.map(p => {
      if (p.data.id !== activeProjectId) return p;
      if (index >= 0 && index < p.history.length) {
        return { ...p, data: p.history[index].state, historyIndex: index };
      }
      return p;
    }));
  }, [activeProjectId]);

  // --- Actions ---

  const addFrame = useCallback(() => {
    if (activeProjectId === 'home') return;
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: {} };
    state.layers.forEach(l => newFrame.layerData[l.id] = new Array(state.width * state.height).fill(null));
    updateState(
        { ...state, frames: [...state.frames, newFrame], activeFrameIndex: state.frames.length }, 
        { action: 'Add Frame' }
    );
  }, [state, updateState, activeProjectId]);

  const duplicateFrame = useCallback(() => {
    if (activeProjectId === 'home') return;
    const current = state.frames[state.activeFrameIndex];
    const newData: Record<string, PixelGrid> = {};
    Object.keys(current.layerData).forEach(key => newData[key] = [...current.layerData[key]]);
    const newFrame: Frame = { id: `frame-${Date.now()}`, layerData: newData };
    const newFrames = [...state.frames]; newFrames.splice(state.activeFrameIndex + 1, 0, newFrame);
    updateState(
        { ...state, frames: newFrames, activeFrameIndex: state.activeFrameIndex + 1 }, 
        { action: 'Duplicate Frame' }
    );
  }, [state, updateState, activeProjectId]);

  const deleteFrame = useCallback(() => {
    if (activeProjectId === 'home') return;
    if (state.frames.length <= 1) return;
    updateState(
        { ...state, frames: state.frames.filter((_, i) => i !== state.activeFrameIndex), activeFrameIndex: Math.max(0, state.activeFrameIndex - 1) }, 
        { action: 'Delete Frame' }
    );
  }, [state, updateState, activeProjectId]);

  const addLayer = useCallback(() => {
    if (activeProjectId === 'home') return;
    const newId = `layer-${Date.now()}`;
    let n = 1; while (state.layers.some(l => l.name === `Layer ${n}`)) n++;
    const newLayer: Layer = { id: newId, name: `Layer ${n}`, visible: true, locked: false };
    const newFrames = state.frames.map(f => ({ ...f, layerData: { ...f.layerData, [newId]: new Array(state.width * state.height).fill(null) } }));
    const newLayers = [...state.layers]; const idx = state.layers.findIndex(l => l.id === state.activeLayerId);
    if(idx!==-1) newLayers.splice(idx+1, 0, newLayer); else newLayers.push(newLayer);
    updateState(
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId }, 
        { action: 'Add Layer' }
    );
  }, [state, updateState, activeProjectId]);

  const deleteLayer = useCallback((id: string) => {
    if (activeProjectId === 'home') return;
    if (state.layers.length <= 1) return; // Don't delete last layer
    
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
        { ...state, layers: newLayers, frames: newFrames, activeLayerId: newActiveId },
        { action: 'Delete Layer' }
    );
  }, [state, updateState, activeProjectId]);

  const duplicateLayer = useCallback((id: string) => {
     if (activeProjectId === 'home') return;
     const layerIndex = state.layers.findIndex(l => l.id === id);
     if (layerIndex === -1) return;
     
     const sourceLayer = state.layers[layerIndex];
     const newId = `layer-${Date.now()}`;
     const newLayer = { ...sourceLayer, id: newId, name: `${sourceLayer.name} (Copy)` };
     
     const newLayers = [...state.layers];
     newLayers.splice(layerIndex, 0, newLayer);
     
     const newFrames = state.frames.map(f => ({
         ...f,
         layerData: {
             ...f.layerData,
             [newId]: f.layerData[id] ? [...f.layerData[id]] : new Array(state.width * state.height).fill(null)
         }
     }));

     updateState(
         { ...state, layers: newLayers, frames: newFrames, activeLayerId: newId },
         { action: 'Duplicate Layer' }
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

  const reorderLayers = useCallback((dId: string, tId: string, pos: 'before'|'after') => {
    if (activeProjectId === 'home') return;
    const oI = state.layers.findIndex(l => l.id === dId);
    const tI = state.layers.findIndex(l => l.id === tId);
    if(oI===-1||tI===-1||oI===tI)return;
    const nl = [...state.layers]; const [m] = nl.splice(oI, 1);
    const adjTI = nl.findIndex(l => l.id === tId);
    if(pos==='before') nl.splice(adjTI+1, 0, m); else nl.splice(adjTI, 0, m);
    updateState(
        {...state, layers: nl}, 
        { action: 'Reorder Layers' }
    );
  }, [state, updateState, activeProjectId]);

  const reorderFrames = useCallback((from: number, to: number) => {
    if (activeProjectId === 'home') return;
    if (from === to) return;
    const newFrames = [...state.frames]; const [moved] = newFrames.splice(from, 1); newFrames.splice(to, 0, moved);
    let newActive = state.activeFrameIndex;
    if (newActive === from) newActive = to;
    else if (newActive > from && newActive <= to) newActive--;
    else if (newActive < from && newActive >= to) newActive++;
    updateState(
        { ...state, frames: newFrames, activeFrameIndex: newActive }, 
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

  const downloadImage = useCallback(() => {
     if (activeProjectId === 'home') return;
     const canvas = document.createElement('canvas'); canvas.width = state.width; canvas.height = state.height;
     const ctx = canvas.getContext('2d'); if(!ctx) return;
     const frame = state.frames[state.activeFrameIndex];
     state.layers.forEach(l => { if(!l.visible) return; const px = frame.layerData[l.id]; if(!px) return;
         px.forEach((c, i) => { if(c) { ctx.fillStyle = c; ctx.fillRect(i%state.width, Math.floor(i/state.width), 1, 1); } });
     });
     const link = document.createElement('a'); link.download = `${state.title}.png`; link.href = canvas.toDataURL(); link.click();
  }, [state, activeProjectId]);

  return {
    state, // Exposes the ACTIVE project state
    projects, // List of all projects for the tab strip
    activeProjectId,
    setActiveProjectId,
    
    // Recents
    recentProjects,
    loadRecentProject,
    clearRecents,

    createProject,
    loadProjectFromFile, // Exported
    saveProject, // Exported
    closeProject,
    switchTab,
    
    updateState,
    undo,
    redo,
    jumpToHistory, 
    history: activeInstance.history, 
    historyIndex: activeInstance.historyIndex, 
    addFrame,
    duplicateFrame,
    deleteFrame,
    addLayer,
    deleteLayer,
    duplicateLayer,
    updateLayer,
    reorderLayers,
    reorderFrames,
    importPalette,
    selectPalette,
    downloadImage,
    canUndo: activeInstance.historyIndex > 0,
    canRedo: activeInstance.historyIndex < activeInstance.history.length - 1
  };
}
