
import React, { useState, useRef } from 'react';
import { ProjectState, Layer } from '../types';
import { Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, Edit2, Check, GripVertical, FilePlus } from './Icons';

interface LayersPanelProps {
  state: ProjectState;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
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
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onReorderLayers,
  className
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
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

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('type', 'layer-panel');
    e.dataTransfer.setData('id', id);
    setDragState({ id, overId: null, position: 'after' });
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragState) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'before' : 'after';
      
      if (dragState.overId !== id || dragState.position !== position) {
        setDragState({ ...dragState, overId: id, position });
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragState && dragState.id !== targetId) {
        onReorderLayers(dragState.id, targetId, dragState.position);
    }
    setDragState(null);
  };

  return (
    <div className={`flex flex-col bg-card select-none ${className}`}>
      <div className="bg-secondary px-2 py-1 text-xs font-bold text-gray-300 flex justify-between items-center border-b border-background">
        <span>Layers</span>
        <div className="flex items-center gap-1">
            <button onClick={onAddLayer} className="p-1 hover:text-white rounded" title="New Layer"><Plus size={12} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {state.layers.slice().reverse().map((layer) => {
            const isDragging = dragState?.id === layer.id;
            const isOver = dragState?.overId === layer.id;
            const isActive = state.activeLayerId === layer.id;

            return (
                <div 
                    key={layer.id}
                    draggable={!editingId}
                    onDragStart={(e) => handleDragStart(e, layer.id)}
                    onDragOver={(e) => handleDragOver(e, layer.id)}
                    onDrop={(e) => handleDrop(e, layer.id)}
                    onDragEnd={() => setDragState(null)}
                    onClick={() => onSelectLayer(layer.id)}
                    onDoubleClick={() => startEditing(layer)}
                    className={`
                        flex items-center gap-2 px-2 py-1 border-b border-border group relative
                        ${isActive ? 'bg-primary/20' : 'hover:bg-muted/50'}
                        ${isDragging ? 'opacity-50' : ''}
                    `}
                >
                    {/* Drop Indicators */}
                    {isOver && dragState.position === 'before' && (
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none"></div>
                    )}
                    {isOver && dragState.position === 'after' && (
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none"></div>
                    )}

                    <div className="cursor-grab text-muted-foreground hover:text-foreground">
                        <GripVertical size={12} />
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
                        className={`p-1 rounded hover:bg-black/20 ${!layer.visible ? 'text-muted-foreground' : 'text-foreground'}`}
                        title="Toggle Visibility"
                    >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }}
                        className={`p-1 rounded hover:bg-black/20 ${!layer.locked ? 'text-muted-foreground opacity-0 group-hover:opacity-100' : 'text-foreground'}`}
                        title="Toggle Lock"
                    >
                        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>

                    <div className="flex-1 min-w-0">
                        {editingId === layer.id ? (
                            <div className="flex items-center gap-1">
                                <input
                                    ref={editInputRef}
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={saveEditing}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditing();
                                        if (e.key === 'Escape') setEditingId(null);
                                    }}
                                    className="w-full bg-input text-foreground px-1 py-0.5 text-xs rounded border border-ring outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <button onMouseDown={saveEditing} className="text-primary hover:text-white"><Check size={12} /></button>
                            </div>
                        ) : (
                            <div className={`truncate text-xs ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                {layer.name}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <button 
                             onClick={(e) => { e.stopPropagation(); onDuplicateLayer(layer.id); }}
                             className="p-1 hover:text-white hover:bg-black/20 rounded"
                             title="Duplicate"
                        >
                            <Copy size={12} />
                        </button>
                         <button 
                             onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                             className="p-1 hover:text-destructive hover:bg-black/20 rounded"
                             title="Delete"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};
