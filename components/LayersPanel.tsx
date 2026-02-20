import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, Layer } from '../types';
import { Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, Check, GripVertical } from './Icons';

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

  const isMultiLayer = state.selectedLayerIds.length > 1;

  return (
    <div className={`flex flex-col bg-background select-none ${className}`}>
      {/* Refined Compact Header */}
      <div className="bg-[#2a2a2a] px-3 h-8 flex justify-between items-center border-b border-background shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Layers</span>
        <div className="flex items-center gap-1">
            <button 
                onClick={() => isMultiLayer ? onDeleteSelectedLayers() : onDeleteLayer(state.activeLayerId)} 
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                title="Delete Layer"
            >
                <Trash2 size={13} />
            </button>
            <button 
                onClick={() => isMultiLayer ? onDuplicateSelectedLayers() : onDuplicateLayer(state.activeLayerId)} 
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                title="Duplicate Layer"
            >
                <Copy size={13} />
            </button>
            <button onClick={onAddLayer} className="p-1 text-primary hover:text-primary/80 transition-colors" title="Add Layer">
              <Plus size={14} />
            </button>
        </div>
      </div>

      {/* Compact List Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
        {state.layers.slice().reverse().map((layer) => {
            const isDragging = dragState?.id === layer.id;
            const isOver = dragState?.overId === layer.id;
            const isActive = state.activeLayerId === layer.id;
            const isSelected = state.selectedLayerIds.includes(layer.id);

            return (
                <div 
                    key={layer.id}
                    draggable={!editingId}
                    onDragStart={(e) => handleDragStart(e, layer.id)}
                    onDragOver={(e) => handleDragOver(e, layer.id)}
                    onDrop={(e) => handleDrop(e, layer.id)}
                    onDragEnd={() => { setDragState(null); dragStateRef.current = null; }}
                    onClick={(e) => handleLayerClick(e, layer.id)}
                    onDoubleClick={() => startEditing(layer)}
                    className={`
                        flex items-center h-8 gap-2 px-2 rounded-[4px] relative border transition-all cursor-default
                        ${isActive ? 'bg-[#1a1a1a] border-primary/40' : isSelected ? 'bg-secondary/40 border-border/50' : 'bg-transparent border-transparent hover:bg-secondary/20'}
                        ${isDragging ? 'opacity-30' : ''}
                    `}
                >
                    {/* Drop Indicators */}
                    {isOver && dragState?.position === 'before' && (
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none"></div>
                    )}
                    {isOver && dragState?.position === 'after' && (
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none"></div>
                    )}

                    {/* Dragger */}
                    <div className="cursor-grab text-gray-600 hover:text-gray-400">
                        <GripVertical size={12} />
                    </div>

                    {/* Vis Toggle */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
                        className={`p-1 transition-colors ${!layer.visible ? 'text-gray-700' : isActive ? 'text-primary' : 'text-gray-400'}`}
                    >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    
                    {/* Lock Toggle */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }}
                        className={`p-1 transition-colors ${!layer.locked ? 'text-gray-700 hover:text-gray-500' : 'text-orange-500/80'}`}
                    >
                        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>

                    <div className="flex-1 min-w-0">
                        {editingId === layer.id ? (
                            <input
                                ref={editInputRef}
                                value={editName}
                                autoFocus
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={saveEditing}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') setEditingId(null); }}
                                className="w-full bg-input text-foreground px-1 py-0.5 text-[11px] rounded outline-none ring-1 ring-primary"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <div className={`truncate text-[11px] select-none ${isActive ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>
                                {layer.name}
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};
