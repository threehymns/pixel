import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, Layer } from '../types';
import { Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, Check, GripVertical, Settings, ChevronDown } from './Icons';
import { hexToRgb } from '../utils';
import { CustomSlider } from './ui/slider';
import { LayerBlendMode } from '../types';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

const BLEND_MODES: LayerBlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'];

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";

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

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let i = 0; i < pixels.length; i++) {
      const val = pixels[i];
      const color = typeof val === 'number' ? palette[val] : val;
      if (color) {
        const [r, g, b] = hexToRgb(color);
        const idx = i * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
    }
    const tempCanvas = tempCanvasRef.current;
    if (tempCanvas.width !== width || tempCanvas.height !== height) {
      tempCanvas.width = width;
      tempCanvas.height = height;
    }
    tempCanvas.getContext('2d')?.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    
    const scale = Math.min(canvas.width / width, canvas.height / height);
    const w = width * scale;
    const h = height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    
    ctx.drawImage(tempCanvas, 0, 0, width, height, x, y, w, h);

  }, [pixels, palette, width, height]);

  return (
    <div className="w-8 h-8 rounded-md bg-muted/30 border border-border overflow-hidden shrink-0 relative flex items-center justify-center" style={{ backgroundImage: 'conic-gradient(#1a1a1a 90deg, #2a2a2a 90deg 180deg, #1a1a1a 180deg 270deg, #2a2a2a 270deg)', backgroundSize: '8px 8px' }}>
      <canvas ref={canvasRef} width={32} height={32} className="w-full h-full object-contain" />
    </div>
  );
});

interface LayersPanelProps {
  state: ProjectState;
  onSelectLayers: (ids: string[], activeId: string) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateSelectedLayers: () => void;
  onDeleteSelectedLayers: () => void;
  onReorderLayers: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  className?: string;
}

interface DragState {
  id: string;
  overId: string | null;
  position: 'before' | 'after';
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  state,
  onSelectLayers,
  onUpdateLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onDuplicateSelectedLayers,
  onDeleteSelectedLayers,
  onReorderLayers,
  className
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const [showOpacity, setShowOpacity] = useState(false);
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

  const getDropTarget = (hoveredId: string, clientY: number, rect: DOMRect): DragState | null => {
      if (!dragStateRef.current) return null;
      const midY = rect.top + rect.height / 2;
      const index = state.layers.findIndex(l => l.id === hoveredId);
      if (index === -1) return null;

      if (clientY < midY) {
          return { id: dragStateRef.current.id, overId: hoveredId, position: 'before' };
      } else {
          if (index === 0) {
              return { id: dragStateRef.current.id, overId: hoveredId, position: 'after' };
          } else {
              const layerBelow = state.layers[index - 1];
              return { id: dragStateRef.current.id, overId: layerBelow.id, position: 'before' };
          }
      }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('type', 'layer-panel');
    e.dataTransfer.setData('id', id);
    const newState: DragState = { id, overId: null, position: 'after' };
    setDragState(newState);
    dragStateRef.current = newState;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragStateRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const newState = getDropTarget(id, e.clientY, rect);
      if (newState && (dragStateRef.current.overId !== newState.overId || dragStateRef.current.position !== newState.position)) {
        setDragState(newState);
        dragStateRef.current = newState;
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragStateRef.current && dragStateRef.current.overId && dragStateRef.current.id !== dragStateRef.current.overId) {
        const logicalPosition = dragStateRef.current.position === 'before' ? 'after' : 'before';
        onReorderLayers(dragStateRef.current.id, dragStateRef.current.overId, logicalPosition);
    }
    setDragState(null);
    dragStateRef.current = null;
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragStateRef.current) return;
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const relativeY = e.clientY - rect.top + scrollTop - 4; // Subtract 4px padding-top

    const reversedLayers = state.layers.slice().reverse();
    if (reversedLayers.length === 0) return;

    const preciseIndex = relativeY / 32; // Each layer is h-8 (32px)
    let visualIndex = Math.floor(preciseIndex);
    if (visualIndex < 0) visualIndex = 0;
    if (visualIndex >= reversedLayers.length) visualIndex = reversedLayers.length - 1;

    const targetLayer = reversedLayers[visualIndex];
    if (targetLayer) {
      const offset = preciseIndex - visualIndex;
      const position = offset < 0.5 ? 'before' : 'after';
      
      const newState: DragState = { id: dragStateRef.current.id, overId: targetLayer.id, position };
      setDragState(newState);
      dragStateRef.current = newState;
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragStateRef.current && dragStateRef.current.overId && dragStateRef.current.id !== dragStateRef.current.overId) {
        const logicalPosition = dragStateRef.current.position === 'before' ? 'after' : 'before';
        onReorderLayers(dragStateRef.current.id, dragStateRef.current.overId, logicalPosition);
    }
    setDragState(null);
    dragStateRef.current = null;
  };

  const isMultiLayer = state.selectedLayerIds.length > 1;

  return (
    <div className={`flex flex-col bg-muted/20 select-none ${className}`}>
      {/* Header Toolbar */}
      <div className="px-2 py-1 flex justify-end items-center border-b border-border/40 bg-secondary/20 shrink-0">
        <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => setShowOpacity(!showOpacity)} 
                    className={`p-0.5 transition-colors rounded ${showOpacity ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                    <Settings size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Layer Opacity</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => isMultiLayer ? onDeleteSelectedLayers() : onDeleteLayer(state.activeLayerId)} 
                    className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                    <Trash2 size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete Layer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => isMultiLayer ? onDuplicateSelectedLayers() : onDuplicateLayer(state.activeLayerId)} 
                    className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                    <Copy size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Duplicate Layer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onAddLayer} className="p-0.5 text-primary hover:bg-primary/10 rounded transition-colors">
                  <Plus size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Add Layer</TooltipContent>
            </Tooltip>
        </div>
      </div>

      {showOpacity && activeLayer && (
        <div className="px-2 py-2 border-b border-border bg-accent/20 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-medium text-muted-foreground uppercase">Blend Mode</span>
                    <select 
                        value={activeLayer.blendMode}
                        onChange={(e) => onUpdateLayer(activeLayer.id, { blendMode: e.target.value as LayerBlendMode })}
                        className="bg-background border border-border rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary h-5 capitalize"
                    >
                        {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-medium text-muted-foreground uppercase">Opacity</span>
                    <span className="text-[9px] font-mono">{activeLayer.opacity}%</span>
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

      {/* List Container */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            onDragOver={handleContainerDragOver}
            onDrop={handleContainerDrop}
            className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0"
          >
            {(() => {
              const activeFrame = state.frames[state.activeFrameIndex];
              return state.layers.slice().reverse().map((layer) => {
                const isDragging = dragState?.id === layer.id;
                const isOver = dragState?.overId === layer.id;
                const isActive = state.activeLayerId === layer.id;
                const isSelected = state.selectedLayerIds.includes(layer.id);

                return (
                    <ContextMenu key={layer.id}>
                      <ContextMenuTrigger asChild>
                        <div 
                            draggable={!editingId}
                            onDragStart={(e) => handleDragStart(e, layer.id)}
                            onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, layer.id); }}
                            onDrop={(e) => { e.stopPropagation(); handleDrop(e, layer.id); }}
                            onDragEnd={() => { setDragState(null); dragStateRef.current = null; }}
                            onClick={(e) => handleLayerClick(e, layer.id)}
                            onDoubleClick={() => startEditing(layer)}
                            className={`
                                flex items-center h-8 gap-1.5 px-1.5 rounded-md relative transition-all cursor-default group
                                ${isActive ? 'bg-primary/10 shadow-sm' : isSelected ? 'bg-secondary/40' : 'bg-transparent hover:bg-accent/50'}
                                ${isDragging ? 'opacity-30' : ''}
                            `}
                        >
                            {/* Drop Indicators */}
                            {isOver && dragState?.position === 'before' && (
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none rounded-full"></div>
                            )}
                            {isOver && dragState?.position === 'after' && (
                                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none rounded-full"></div>
                            )}

                            {/* Vis Toggle */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
                                className={`p-0.5 rounded transition-colors ${!layer.visible ? 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent' : isActive ? 'text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                            >
                                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>

                            {/* Thumbnail */}
                            <LayerThumbnail 
                                pixels={activeFrame?.layerData[layer.id]} 
                                palette={state.palette} 
                                width={state.width} 
                                height={state.height} 
                            />

                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                {editingId === layer.id ? (
                                    <input
                                        ref={editInputRef}
                                        value={editName}
                                        autoFocus
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') setEditingId(null); }}
                                        className="w-full bg-background text-foreground px-1 py-0 text-[10px] rounded outline-none border border-primary focus:ring-0"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className={`truncate text-[10px] ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground transition-colors'}`}>
                                        {layer.name}
                                    </div>
                                )}
                            </div>

                            {/* Lock Toggle */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }}
                                className={`p-0.5 rounded transition-colors ${!layer.locked ? 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100' : 'text-primary/80 hover:bg-primary/20 opacity-100'}`}
                            >
                                {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
                            </button>

                            {/* Dragger */}
                            <div className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical size={10} />
                            </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => startEditing(layer)}>Rename</ContextMenuItem>
                        <ContextMenuItem onClick={() => onDuplicateLayer(layer.id)}>Duplicate</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onDeleteLayer(layer.id)} className="text-destructive focus:text-destructive">Delete</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                );
            });
          })()}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onAddLayer}>New Layer</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};
