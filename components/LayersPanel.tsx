import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, Layer, LayerBlendMode } from '../types';
import { 
  Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, GripVertical, Settings, 
  ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, FolderOutput,
  Layers as LayersIcon, Search, Sliders, ChevronsUpDown, X, Tag
} from 'lucide-react';
import { hexToRgb, getLayerParentMap, isLayerVisible, getGroupChildren, getGroupChildCount, isDescendant } from '../utils';
import { CustomSlider } from './ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from "./ui/context-menu";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { LayerPropertiesDialog } from "./LayerPropertiesDialog";

const BLEND_MODES: LayerBlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 
  'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'addition', 'subtract', 'divide'
];

const COLOR_TAGS = [
  { id: 'red', label: 'Red', hex: '#ef4444', class: 'bg-red-500' },
  { id: 'orange', label: 'Orange', hex: '#f97316', class: 'bg-orange-500' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308', class: 'bg-yellow-500' },
  { id: 'green', label: 'Green', hex: '#22c55e', class: 'bg-green-500' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6', class: 'bg-blue-500' },
  { id: 'purple', label: 'Purple', hex: '#a855f7', class: 'bg-purple-500' },
  { id: 'pink', label: 'Pink', hex: '#ec4899', class: 'bg-pink-500' },
  { id: 'gray', label: 'Gray', hex: '#6b7280', class: 'bg-gray-500' },
];

interface LayerThumbnailProps {
  pixels: (string | number | null)[] | undefined;
  palette: string[];
  width: number;
  height: number;
}

const LayerThumbnail = React.memo<LayerThumbnailProps>(({ pixels, palette, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!pixels) return;

    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
    }
    const tempCanvas = tempCanvasRef.current;
    if (tempCanvas.width !== width || tempCanvas.height !== height) {
      tempCanvas.width = width;
      tempCanvas.height = height;
    }
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imgData = tempCtx.createImageData(width, height);
    const data32 = new Uint32Array(imgData.data.buffer);

    const paletteUint32 = new Uint32Array(palette.length);
    for (let p = 0; p < palette.length; p++) {
      if (palette[p]) {
        const [r, g, b] = hexToRgb(palette[p]);
        paletteUint32[p] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }
    const hexCache = new Map<string, number>();

    for (let i = 0; i < pixels.length; i++) {
      const val = pixels[i];
      if (val === null || val === undefined) continue;
      let packed: number;
      if (typeof val === 'number') {
        packed = paletteUint32[val];
      } else {
        let cached = hexCache.get(val);
        if (cached === undefined) {
          const [r, g, b] = hexToRgb(val);
          cached = (255 << 24) | (b << 16) | (g << 8) | r;
          hexCache.set(val, cached);
        }
        packed = cached;
      }
      if (packed) data32[i] = packed;
    }
    
    tempCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    
    const scale = Math.min(canvas.width / width, canvas.height / height);
    const w = width * scale;
    const h = height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    
    ctx.drawImage(tempCanvas, 0, 0, width, height, x, y, w, h);

  }, [pixels, palette, width, height]);

  return (
    <div className="w-7 h-7 rounded bg-card border border-border/80 overflow-hidden shrink-0 relative flex items-center justify-center shadow-2xs" style={{ backgroundImage: 'conic-gradient(#18181b 90deg, #27272a 90deg 180deg, #18181b 180deg 270deg, #27272a 270deg)', backgroundSize: '8px 8px' }}>
      <canvas ref={canvasRef} width={28} height={28} className="w-full h-full object-contain" />
    </div>
  );
});

interface GroupThumbnailProps {
  groupId: string;
  state: ProjectState;
  collapsed: boolean;
}

const GroupThumbnail: React.FC<GroupThumbnailProps> = ({ groupId, state, collapsed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const children = getGroupChildren(groupId, state.layers).filter(l => l.type !== 'group');
    if (children.length === 0) return;

    const activeFrame = state.frames[state.activeFrameIndex];
    if (!activeFrame) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.width;
    tempCanvas.height = state.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    children.forEach(child => {
      if (!child.visible) return;
      const pixels = activeFrame.layerData[child.id];
      if (!pixels) return;

      const imgData = tempCtx.createImageData(state.width, state.height);
      const data32 = new Uint32Array(imgData.data.buffer);

      for (let i = 0; i < pixels.length; i++) {
        const val = pixels[i];
        if (val === null || val === undefined) continue;
        const color = typeof val === 'number' ? state.palette[val] : val;
        if (!color) continue;
        const [r, g, b] = hexToRgb(color);
        data32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
      
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = state.width;
      layerCanvas.height = state.height;
      const lCtx = layerCanvas.getContext('2d');
      if (lCtx) {
        lCtx.putImageData(imgData, 0, 0);
        tempCtx.globalAlpha = (child.opacity ?? 100) / 100;
        tempCtx.drawImage(layerCanvas, 0, 0);
      }
    });

    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(28 / state.width, 28 / state.height);
    const w = state.width * scale;
    const h = state.height * scale;
    const x = (28 - w) / 2;
    const y = (28 - h) / 2;

    ctx.drawImage(tempCanvas, 0, 0, state.width, state.height, x, y, w, h);
  }, [groupId, state]);

  return (
    <div className="w-7 h-7 rounded bg-card/80 border border-primary/20 overflow-hidden shrink-0 relative flex items-center justify-center shadow-2xs">
      <div className="absolute inset-0" style={{ backgroundImage: 'conic-gradient(#18181b 90deg, #27272a 90deg 180deg, #18181b 180deg 270deg, #27272a 270deg)', backgroundSize: '8px 8px', opacity: 0.3 }} />
      <canvas ref={canvasRef} width={28} height={28} className="w-full h-full object-contain relative z-10" />
      <div className="absolute top-0 right-0 p-0.5 bg-primary/90 text-primary-foreground rounded-bl z-20">
        {collapsed ? <Folder size={8} /> : <FolderOpen size={8} />}
      </div>
    </div>
  );
};

interface LayersPanelProps {
  state: ProjectState;
  onSelectLayers: (ids: string[], activeId: string) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: () => void;
  onAddGroupLayer?: () => void;
  onGroupSelectedLayers?: () => void;
  onUngroupSelectedLayers?: () => void;
  onAddLayerToGroup?: (groupId: string) => void;
  onToggleCollapseAllGroups?: (forceCollapse?: boolean) => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateSelectedLayers: () => void;
  onDeleteSelectedLayers: () => void;
  onReorderLayers: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom') => void;
  onOpenLayerProperties?: (layer: Layer) => void;
  layerPropertiesState?: { isOpen: boolean; layer: Layer | null };
  onCloseLayerProperties?: () => void;
  className?: string;
}

interface DragState {
  id: string;
  overId: string | null;
  position: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom';
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  state,
  onSelectLayers,
  onUpdateLayer,
  onAddLayer,
  onAddGroupLayer,
  onGroupSelectedLayers,
  onUngroupSelectedLayers,
  onAddLayerToGroup,
  onToggleCollapseAllGroups,
  onDuplicateLayer,
  onDeleteLayer,
  onDuplicateSelectedLayers,
  onDeleteSelectedLayers,
  onReorderLayers,
  onOpenLayerProperties,
  layerPropertiesState,
  onCloseLayerProperties,
  className
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const [showOpacity, setShowOpacity] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeLayer = state.layers.find(l => l.id === state.activeLayerId);

  const startEditing = (layer: Layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEditing = () => {
    if (editingId && editName.trim()) {
      onUpdateLayer(editingId, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleLayerClick = (e: React.MouseEvent, id: string) => {
    let newSelection = [...state.selectedLayerIds];
    
    if (e.shiftKey) {
        const allIds = state.layers.map(l => l.id).reverse();
        const startIdx = allIds.indexOf(state.activeLayerId);
        const endIdx = allIds.indexOf(id);
        const range = allIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
        newSelection = Array.from(new Set([...newSelection, ...range]));
    } else if (e.ctrlKey || e.metaKey) {
        if (newSelection.includes(id)) {
            if (newSelection.length > 1) {
                newSelection = newSelection.filter(sid => sid !== id);
            }
        } else {
            newSelection.push(id);
        }
    } else {
        newSelection = [id];
    }
    
    onSelectLayers(newSelection, id);
  };

  const getDropTarget = (hoveredLayer: Layer, clientY: number, clientX: number, rect: DOMRect): DragState | null => {
      if (!dragStateRef.current) return null;
      const draggedId = dragStateRef.current.id;
      const hoveredId = hoveredLayer.id;

      if (hoveredId === draggedId || isDescendant(hoveredId, draggedId, state.layers)) {
        return null;
      }

      const height = rect.height;
      const relativeY = clientY - rect.top;
      const relativeX = clientX - rect.left;

      const childLevel = hoveredLayer.childLevel ?? 0;

      // Un-nesting check: if item is inside a group and mouse is dragged towards the un-indented left margin
      if (hoveredLayer.parentId && relativeX < Math.max(22, childLevel * 14)) {
        return { id: draggedId, overId: hoveredId, position: 'outside' };
      }

      if (hoveredLayer.type === 'group') {
        if (relativeY < height * 0.25) {
          return { id: draggedId, overId: hoveredId, position: 'before' };
        } else if (relativeY > height * 0.75) {
          return { id: draggedId, overId: hoveredId, position: 'after' };
        } else {
          return { id: draggedId, overId: hoveredId, position: 'inside' };
        }
      }

      if (relativeY < height * 0.5) {
        return { id: draggedId, overId: hoveredId, position: 'before' };
      } else {
        return { id: draggedId, overId: hoveredId, position: 'after' };
      }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('type', 'layer-panel');
    e.dataTransfer.setData('id', id);
    const newState: DragState = { id, overId: null, position: 'after' };
    setDragState(newState);
    dragStateRef.current = newState;
  };

  const handleDragOver = (e: React.DragEvent, layer: Layer) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newState = getDropTarget(layer, e.clientY, e.clientX, rect);
    if (!newState) {
      if (dragStateRef.current.overId !== null) {
        const resetState = { ...dragStateRef.current, overId: null };
        setDragState(resetState);
        dragStateRef.current = resetState;
      }
      return;
    }
    if (dragStateRef.current.overId !== newState.overId || dragStateRef.current.position !== newState.position) {
      setDragState(newState);
      dragStateRef.current = newState;
    }
  };

  const handleDrop = (e: React.DragEvent, targetLayer: Layer) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragStateRef.current.overId && dragStateRef.current.id !== dragStateRef.current.overId) {
        onReorderLayers(dragStateRef.current.id, dragStateRef.current.overId, dragStateRef.current.position);
    }
    setDragState(null);
    dragStateRef.current = null;
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragStateRef.current.overId !== 'root-bottom') {
      const newState: DragState = { id: dragStateRef.current.id, overId: 'root-bottom', position: 'root-bottom' };
      setDragState(newState);
      dragStateRef.current = newState;
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragStateRef.current.overId === 'root-bottom' || !dragStateRef.current.overId) {
      onReorderLayers(dragStateRef.current.id, 'root-bottom', 'root-bottom');
    }
    setDragState(null);
    dragStateRef.current = null;
  };

  const isMultiLayer = state.selectedLayerIds.length > 1;
  const selectedHasGroup = state.selectedLayerIds.some(id => state.layers.find(l => l.id === id)?.type === 'group');

  return (
    <div className={`flex flex-col bg-background/50 select-none ${className}`}>
      {/* Figma/Affinity Pro Header Toolbar */}
      <div className="px-2.5 py-1.5 flex justify-between items-center border-b border-border/40 bg-card/50 shrink-0">
        <div className="flex items-center gap-1.5">
        </div>

        <div className="flex items-center gap-0.5">
            {/* Filter Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setShowSearch(!showSearch)} 
                  className={`p-1 rounded transition-colors ${showSearch ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'}`}
                >
                  <Search size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Filter Layers</TooltipContent>
            </Tooltip>

            {/* Expand / Collapse All */}
            {onToggleCollapseAllGroups && state.layers.some(l => l.type === 'group') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => onToggleCollapseAllGroups()} 
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-colors"
                  >
                    <ChevronsUpDown size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Expand / Collapse All Groups</TooltipContent>
              </Tooltip>
            )}

            {/* Group Selected Layers */}
            {onGroupSelectedLayers && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={onGroupSelectedLayers} 
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-colors"
                  >
                    <FolderPlus size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{isMultiLayer ? "Group Selected (Ctrl+G)" : "New Group"}</TooltipContent>
              </Tooltip>
            )}

            {/* Ungroup Selected */}
            {onUngroupSelectedLayers && selectedHasGroup && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={onUngroupSelectedLayers} 
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-colors"
                  >
                    <FolderOutput size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Ungroup Selected (Ctrl+Shift+G)</TooltipContent>
              </Tooltip>
            )}

            {/* Opacity & Blend Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => setShowOpacity(!showOpacity)} 
                    className={`p-1 transition-colors rounded ${showOpacity ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'}`}
                >
                    <Sliders size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Blend Mode & Opacity</TooltipContent>
            </Tooltip>

            {/* Duplicate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => isMultiLayer ? onDuplicateSelectedLayers() : onDuplicateLayer(state.activeLayerId)} 
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-colors"
                >
                    <Copy size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Duplicate Selected</TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => isMultiLayer ? onDeleteSelectedLayers() : onDeleteLayer(state.activeLayerId)} 
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                    <Trash2 size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete Selected</TooltipContent>
            </Tooltip>

            {/* Add Layer */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onAddLayer} className="p-1 text-primary hover:bg-primary/10 rounded transition-colors">
                  <Plus size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Add New Layer</TooltipContent>
            </Tooltip>
        </div>
      </div>

      {/* Filter / Search Input Bar */}
      {showSearch && (
        <div className="px-2 py-1.5 border-b border-border/40 bg-accent/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-150">
          <Search size={12} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter layers by name..."
            className="w-full bg-background/80 text-foreground px-2 py-0.5 text-[10px] rounded border border-border/60 outline-none focus:ring-1 focus:ring-primary font-medium"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground p-0.5">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Opacity & Blend Mode Foldable Toolbar */}
      {showOpacity && activeLayer && (
        <div className="px-2.5 py-2 border-b border-border/40 bg-card/30 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Blend Mode</span>
                    <select 
                        value={activeLayer.blendMode}
                        onChange={(e) => onUpdateLayer(activeLayer.id, { blendMode: e.target.value as LayerBlendMode })}
                        className="bg-background border border-border/80 rounded px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary h-5 capitalize font-medium text-foreground"
                    >
                        {BLEND_MODES.map(m => <option key={m} value={m}>{m.replace('-', ' ')}</option>)}
                    </select>
                </div>
                
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Opacity</span>
                    <span className="text-[9px] font-mono font-medium text-primary">{activeLayer.opacity}%</span>
                </div>
                <CustomSlider
                    value={activeLayer.opacity}
                    onValueChange={(val) => onUpdateLayer(activeLayer.id, { opacity: val })}
                    min={0}
                    max={100}
                    className="h-4"
                />
            </div>
        </div>
      )}

      {/* Layer Tree List Container */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            onDragOver={handleContainerDragOver}
            onDrop={handleContainerDrop}
            className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
          >
            {(() => {
              const activeFrame = state.frames[state.activeFrameIndex];
              const parentMap = getLayerParentMap(state.layers);

              const isCollapsed = (layer: Layer) => {
                let curr: Layer | undefined = layer;
                const visited = new Set<string>();
                while (curr) {
                  if (visited.has(curr.id)) break;
                  visited.add(curr.id);
                  const parent = parentMap.get(curr.id) || (curr.parentId ? state.layers.find(l => l.id === curr?.parentId) : undefined);
                  if (parent) {
                    if (parent.collapsed) return true;
                    curr = parent;
                  } else {
                    break;
                  }
                }
                return false;
              };

              let displayLayers = state.layers.slice().reverse();

              if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                displayLayers = displayLayers.filter(l => l.name.toLowerCase().includes(query));
              }

              return (
                <>
                  {displayLayers.map((layer) => {
                    if (!searchQuery && isCollapsed(layer)) return null;

                    const isDragging = dragState?.id === layer.id;
                    const isOver = dragState?.overId === layer.id;
                    const isActive = state.activeLayerId === layer.id;
                    const isSelected = state.selectedLayerIds.includes(layer.id);
                    const effectiveVis = isLayerVisible(layer, state.layers, parentMap);
                    const childLevel = Math.min(layer.childLevel ?? 0, 5);
                    const isGroup = layer.type === 'group';
                    const childCount = isGroup ? getGroupChildCount(layer.id, state.layers) : 0;
                    const colorTagObj = COLOR_TAGS.find(t => t.id === layer.colorTag);

                    const isPopoverOpen = !!(layerPropertiesState?.isOpen && layerPropertiesState?.layer?.id === layer.id);

                    return (
                      <Popover
                        key={layer.id}
                        open={isPopoverOpen}
                        onOpenChange={(open) => {
                          if (!open && onCloseLayerProperties) onCloseLayerProperties();
                        }}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <PopoverAnchor asChild>
                              <div 
                                  draggable={!editingId}
                            onDragStart={(e) => handleDragStart(e, layer.id)}
                            onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, layer); }}
                            onDrop={(e) => { e.stopPropagation(); handleDrop(e, layer); }}
                            onDragEnd={() => { setDragState(null); dragStateRef.current = null; }}
                            onClick={(e) => handleLayerClick(e, layer.id)}
                            onDoubleClick={() => startEditing(layer)}
                            className={`
                                flex items-center h-8 gap-1.5 px-2 rounded-md relative transition-all cursor-default group/item
                                ${isGroup ? 'font-semibold text-foreground/90' : 'text-foreground/80'}
                                ${isActive ? 'bg-primary/15 shadow-2xs border border-primary/40 text-foreground font-semibold' : isSelected ? 'bg-secondary/60 border border-border/50' : 'bg-transparent border border-transparent hover:bg-accent/40'}
                                ${isDragging ? 'opacity-30' : ''}
                            `}
                            style={{ marginLeft: `${childLevel * 14}px` }}
                        >
                            {/* Color Tag Strip */}
                            {colorTagObj && (
                              <div className={`absolute left-0 top-1 bottom-1 w-1 rounded-r ${colorTagObj.class}`} />
                            )}

                            {/* Tree Guideline for Indented Children */}
                            {childLevel > 0 && (
                              <div className="absolute left-0 top-0 bottom-0 pointer-events-none -ml-2.5 flex items-center">
                                <div className="w-[1px] h-full bg-border/40" />
                              </div>
                            )}

                            {/* Drop Target Lines (Figma Style) */}
                            {isOver && dragState?.position === 'before' && (
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-50 pointer-events-none rounded-full flex items-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                                </div>
                            )}
                            {isOver && dragState?.position === 'after' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-50 pointer-events-none rounded-full flex items-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                                </div>
                            )}
                            {isOver && dragState?.position === 'inside' && (
                                <div className="absolute inset-0 border-2 border-primary/80 bg-primary/10 rounded-md pointer-events-none z-50 flex items-center justify-end pr-2 shadow-xs">
                                  <span className="text-[9px] font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded">
                                    Nest inside Group
                                  </span>
                                </div>
                            )}
                            {isOver && dragState?.position === 'outside' && (
                                <div 
                                  className="absolute bottom-0 h-[2px] bg-primary z-50 pointer-events-none rounded-full flex items-center shadow-xs"
                                  style={{ left: `-${childLevel * 14}px`, right: 0 }}
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                                  <span className="absolute right-1 bottom-1 text-[8.5px] font-bold text-primary bg-background border border-primary/40 px-1 py-0.2 rounded shadow-2xs">
                                    Move Outside Group
                                  </span>
                                </div>
                            )}

                            {/* Collapse/Expand chevron for groups */}
                            {isGroup ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateLayer(layer.id, { collapsed: !layer.collapsed });
                                    }}
                                    className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-all shrink-0"
                                >
                                    {layer.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                </button>
                            ) : (
                              <div className="w-3.5 shrink-0" />
                            )}

                            {/* Vis Toggle */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
                                className={`p-0.5 rounded transition-colors shrink-0 ${!layer.visible ? 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent' : !effectiveVis ? 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent' : isActive ? 'text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                                title={layer.visible && !effectiveVis ? "Hidden by parent group" : undefined}
                            >
                                {layer.visible && effectiveVis ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>

                            {/* Thumbnail or Group Icon */}
                            {isGroup ? (
                                <GroupThumbnail groupId={layer.id} state={state} collapsed={!!layer.collapsed} />
                            ) : (
                                <LayerThumbnail 
                                    pixels={activeFrame?.layerData[layer.id]} 
                                    palette={state.palette} 
                                    width={state.width} 
                                    height={state.height} 
                                />
                            )}

                            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                {editingId === layer.id ? (
                                    <input
                                        ref={editInputRef}
                                        value={editName}
                                        autoFocus
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') setEditingId(null); }}
                                        className="w-full bg-background text-foreground px-1 py-0 text-[10px] rounded outline-none border border-primary focus:ring-0 font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className={`truncate text-[10.5px] ${isGroup ? 'font-semibold text-foreground' : isActive ? 'text-foreground font-semibold' : 'text-foreground/80 group-hover/item:text-foreground transition-colors'}`}>
                                          {layer.name}
                                      </span>

                                    </div>
                                )}
                            </div>

                            {/* Lock Toggle */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }}
                                className={`p-0.5 rounded transition-colors ${!layer.locked ? 'text-muted-foreground/40 hover:text-foreground hover:bg-accent opacity-0 group-hover/item:opacity-100' : 'text-primary hover:bg-primary/20 opacity-100'}`}
                                title={layer.locked ? "Unlock Layer" : "Lock Layer"}
                            >
                                {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                            </button>

                            {/* Settings / Layer Properties button */}
                            {onOpenLayerProperties && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenLayerProperties(layer); }}
                                className="p-0.5 rounded transition-colors text-muted-foreground/40 hover:text-foreground hover:bg-accent opacity-0 group-hover/item:opacity-100"
                                title="Layer Properties"
                              >
                                <Settings size={11} />
                              </button>
                            )}

                            {/* Dragger */}
                            <div className="cursor-grab text-muted-foreground/40 hover:text-foreground p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <GripVertical size={11} />
                            </div>
                        </div>
                      </PopoverAnchor>
                    </ContextMenuTrigger>
                      <ContextMenuContent>
                        {isGroup && onAddLayerToGroup && (
                          <ContextMenuItem onClick={() => onAddLayerToGroup(layer.id)}>
                            <Plus size={12} className="mr-1.5 text-primary" /> Add Layer Inside Group
                          </ContextMenuItem>
                        )}
                        {onGroupSelectedLayers && (
                          <ContextMenuItem onClick={onGroupSelectedLayers}>
                            <FolderPlus size={12} className="mr-1.5 text-primary" /> Group Selected (Ctrl+G)
                          </ContextMenuItem>
                        )}
                        {isGroup && onUngroupSelectedLayers && (
                          <ContextMenuItem onClick={onUngroupSelectedLayers}>
                            <FolderOutput size={12} className="mr-1.5 text-foreground" /> Ungroup (Ctrl+Shift+G)
                          </ContextMenuItem>
                        )}
                        
                        <ContextMenuSeparator />

                        {/* Color Tag Submenu */}
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <Tag size={12} className="mr-1.5 text-primary" /> Color Tag
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-36">
                            <ContextMenuItem onClick={() => onUpdateLayer(layer.id, { colorTag: undefined })}>
                              <span className="w-2.5 h-2.5 rounded-full border border-border mr-2 bg-transparent" /> None
                            </ContextMenuItem>
                            {COLOR_TAGS.map(tag => (
                              <ContextMenuItem key={tag.id} onClick={() => onUpdateLayer(layer.id, { colorTag: tag.id })}>
                                <span className={`w-2.5 h-2.5 rounded-full mr-2 ${tag.class}`} /> {tag.label}
                              </ContextMenuItem>
                            ))}
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        <ContextMenuSeparator />

                        {onOpenLayerProperties && (
                          <ContextMenuItem onClick={() => onOpenLayerProperties(layer)}>
                            <Settings size={12} className="mr-1.5 text-muted-foreground" /> Layer Properties...
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => startEditing(layer)}>Rename</ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicateLayer(layer.id)}>Duplicate</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onDeleteLayer(layer.id)} className="text-destructive focus:text-destructive">Delete</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {isPopoverOpen && (
                      <PopoverContent
                        align="center"
                        side="left"
                        sideOffset={12}
                        collisionPadding={16}
                        className="p-0 border-none bg-transparent shadow-none outline-none z-[100]"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                      <LayerPropertiesDialog
                        isOpen={true}
                        onClose={() => {
                          if (onCloseLayerProperties) onCloseLayerProperties();
                        }}
                        layer={layer}
                        onUpdateLayer={onUpdateLayer}
                        isEmbedded
                      />
                    </PopoverContent>
                  )}
                </Popover>
              );
              })}

              {/* Insertion line at root bottom when dragging past the last item */}
              {dragState?.overId === 'root-bottom' && (
                <div className="h-[2px] bg-primary w-full my-1.5 rounded-full relative flex items-center shadow-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                </div>
              )}
            </>
          );
        })()}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onAddLayer}>New Layer</ContextMenuItem>
          {onAddGroupLayer && <ContextMenuItem onClick={onAddGroupLayer}>New Group</ContextMenuItem>}
          {onGroupSelectedLayers && <ContextMenuItem onClick={onGroupSelectedLayers}>Group Selected (Ctrl+G)</ContextMenuItem>}
          {onToggleCollapseAllGroups && <ContextMenuItem onClick={() => onToggleCollapseAllGroups()}>Collapse / Expand All Groups</ContextMenuItem>}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};
