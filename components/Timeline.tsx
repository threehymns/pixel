
import React, { useState } from 'react';
import { ProjectState, Layer } from '../types';
import { Layers, Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, Square, FilePlus, GripVertical } from 'lucide-react';

interface TimelineProps {
  state: ProjectState;
  onSelectFrames: (indices: number[], activeIndex: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onDuplicateSelectedFrames: () => void;
  onDeleteSelectedFrames: () => void;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onAddLayer: () => void;
  onReorderLayers: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onReorderFrames: (fromIndex: number, toIndex: number) => void;
}

interface DragState {
  type: 'layer' | 'frame';
  id: string; // Layer ID or Frame Index (as string)
  overId: string | null;
  position: 'before' | 'after';
}

export const Timeline: React.FC<TimelineProps> = ({
  state,
  onSelectFrames,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onDuplicateSelectedFrames,
  onDeleteSelectedFrames,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onAddLayer,
  onReorderLayers,
  onReorderFrames
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleFrameClick = (e: React.MouseEvent, index: number) => {
      let newSelection = [...state.selectedFrameIndices];

      if (e.shiftKey) {
          const startIdx = state.activeFrameIndex;
          const endIdx = index;
          const range = [];
          for (let i = Math.min(startIdx, endIdx); i <= Math.max(startIdx, endIdx); i++) {
              range.push(i);
          }
          newSelection = Array.from(new Set([...newSelection, ...range]));
      } else if (e.ctrlKey || e.metaKey) {
          if (newSelection.includes(index)) {
              if (newSelection.length > 1) {
                  newSelection = newSelection.filter(i => i !== index);
              }
          } else {
              newSelection.push(index);
          }
      } else {
          newSelection = [index];
      }

      onSelectFrames(newSelection, index);
  };

  const handleDuplicate = () => {
    if (state.selectedFrameIndices.length > 1) {
      onDuplicateSelectedFrames();
    } else {
      onDuplicateFrame();
    }
  };

  const handleDelete = () => {
    if (state.selectedFrameIndices.length > 1) {
      onDeleteSelectedFrames();
    } else {
      onDeleteFrame();
    }
  };

  // --- Layer Drag Handlers ---
  const handleLayerDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('type', 'layer');
    e.dataTransfer.setData('id', id);
    setDragState({ type: 'layer', id, overId: null, position: 'after' });
  };

  const handleLayerDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault(); // Allow drop
    if (dragState?.type !== 'layer') return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    if (dragState.overId !== id || dragState.position !== position) {
      setDragState({ ...dragState, overId: id, position });
    }
  };

  const handleLayerDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragState?.type === 'layer' && dragState.id !== targetId) {
        onReorderLayers(dragState.id, targetId, dragState.position);
    }
    setDragState(null);
  };

  // --- Frame Drag Handlers ---
  const handleFrameDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('type', 'frame');
    e.dataTransfer.setData('index', index.toString());
    setDragState({ type: 'frame', id: index.toString(), overId: null, position: 'after' });
  };

  const handleFrameDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragState?.type !== 'frame') return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    
    if (dragState.overId !== index.toString() || dragState.position !== position) {
      setDragState({ ...dragState, overId: index.toString(), position });
    }
  };

  const handleFrameDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragState?.type === 'frame') {
       const fromIndex = parseInt(dragState.id);
       if (fromIndex !== targetIndex) {
           let insertIndex = targetIndex;
           if (dragState.position === 'after') insertIndex = targetIndex + 1;
           if (fromIndex < insertIndex) insertIndex--;

           onReorderFrames(fromIndex, insertIndex);
       }
    }
    setDragState(null);
  };

  const isMultiFrame = state.selectedFrameIndices.length > 1;

  return (
    <div className="h-48 bg-card border-t border-background flex flex-col text-sm select-none">
      {/* Timeline Controls */}
      <div className="h-8 bg-secondary border-b border-background flex items-center px-2 gap-2">
         <span className="font-bold text-gray-300 mr-2 text-[10px] uppercase tracking-wider">Timeline</span>
         <button onClick={onAddFrame} className="p-1 hover:bg-input rounded" title="New Frame"><Plus size={14} /></button>
         <button 
            onClick={handleDuplicate} 
            className={`p-1 hover:bg-input rounded ${isMultiFrame ? 'text-primary' : ''}`} 
            title={isMultiFrame ? `Duplicate ${state.selectedFrameIndices.length} Frames` : "Duplicate Frame"}
         >
            <Copy size={14} />
         </button>
         <button 
            onClick={handleDelete} 
            className={`p-1 hover:bg-input rounded ${isMultiFrame ? 'text-destructive font-bold' : 'text-destructive/70'}`} 
            title={isMultiFrame ? `Delete ${state.selectedFrameIndices.length} Frames` : "Delete Frame"}
         >
            <Trash2 size={14} />
         </button>
         <div className="h-4 w-[1px] bg-input mx-2"></div>
         <button onClick={onAddLayer} className="p-1 hover:bg-input rounded" title="New Layer"><FilePlus size={14} /></button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Layers List (Left) */}
        <div className="w-48 bg-muted border-r border-background flex flex-col overflow-y-auto">
          {state.layers.slice().reverse().map((layer) => {
             const isDragging = dragState?.type === 'layer' && dragState.id === layer.id;
             const isOver = dragState?.type === 'layer' && dragState.overId === layer.id;
             const isActive = state.activeLayerId === layer.id;
             const isSelected = state.selectedLayerIds.includes(layer.id);
             
             return (
                <div 
                  key={layer.id}
                  draggable
                  onDragStart={(e) => handleLayerDragStart(e, layer.id)}
                  onDragOver={(e) => handleLayerDragOver(e, layer.id)}
                  onDrop={(e) => handleLayerDrop(e, layer.id)}
                  onDragEnd={() => setDragState(null)}
                  className={`h-8 flex items-center px-2 gap-2 border-b border-border cursor-pointer group relative
                    ${isActive ? 'bg-primary text-primary-foreground font-bold' : isSelected ? 'bg-accent/30 text-foreground' : 'text-muted-foreground hover:bg-secondary'}
                    ${isDragging ? 'opacity-50' : ''}
                  `}
                  onClick={() => onSelectLayer(layer.id)}
                >
                  {/* Drop Indicators */}
                  {isOver && dragState.position === 'before' && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none"></div>
                  )}
                  {isOver && dragState.position === 'after' && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none"></div>
                  )}

                  <div className="cursor-grab text-gray-500 hover:text-gray-300">
                     <GripVertical size={12} />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                    className={`p-1 rounded hover:bg-black/20 ${!layer.visible && 'text-gray-500'}`}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                    className={`p-1 rounded hover:bg-black/20 ${!layer.locked && 'opacity-0 group-hover:opacity-50'}`}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <span className="truncate flex-1">{layer.name}</span>
                </div>
            );
          })}
        </div>

        {/* Frames Grid (Right) */}
        <div className="flex-1 overflow-x-auto bg-muted relative">
           <div className="flex flex-col min-w-max">
             {/* Header Row for Frame Numbers */}
             <div className="flex h-6 border-b border-secondary">
                {state.frames.map((_, idx) => {
                  const isDragging = dragState?.type === 'frame' && dragState.id === idx.toString();
                  const isOver = dragState?.type === 'frame' && dragState.overId === idx.toString();
                  const isActive = state.activeFrameIndex === idx;
                  const isSelected = state.selectedFrameIndices.includes(idx);

                  return (
                    <div 
                        key={idx} 
                        draggable
                        onDragStart={(e) => handleFrameDragStart(e, idx)}
                        onDragOver={(e) => handleFrameDragOver(e, idx)}
                        onDrop={(e) => handleFrameDrop(e, idx)}
                        onDragEnd={() => setDragState(null)}
                        onClick={(e) => handleFrameClick(e, idx)}
                        className={`w-8 border-r border-secondary flex items-center justify-center text-[10px] cursor-pointer hover:bg-secondary relative
                        ${isActive ? 'bg-primary text-primary-foreground font-bold' : isSelected ? 'bg-accent/40 text-foreground' : 'text-muted-foreground'}
                        ${isDragging ? 'opacity-50' : ''}
                        `}
                    >
                        {/* Drop Indicators */}
                        {isOver && dragState.position === 'before' && (
                            <div className="absolute top-0 left-0 h-full w-[2px] bg-primary z-50 pointer-events-none"></div>
                        )}
                        {isOver && dragState.position === 'after' && (
                            <div className="absolute top-0 right-0 h-full w-[2px] bg-primary z-50 pointer-events-none"></div>
                        )}
                        {idx + 1}
                    </div>
                  );
                })}
             </div>
             
             {/* Frame Cells */}
             <div className="flex flex-col">
                {state.layers.slice().reverse().map((layer) => (
                  <div key={layer.id} className="flex h-8 border-b border-muted">
                    {state.frames.map((frame, frameIdx) => {
                      const hasContent = frame.layerData[layer.id]?.some(p => p !== null);
                      const isActive = state.activeFrameIndex === frameIdx && state.activeLayerId === layer.id;
                      const isFrameSelected = state.selectedFrameIndices.includes(frameIdx);
                      const isLayerSelected = state.selectedLayerIds.includes(layer.id);
                      
                      return (
                        <div 
                          key={`${layer.id}-${frame.id}`}
                          onClick={(e) => {
                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                handleFrameClick(e, frameIdx);
                            } else {
                                onSelectFrames([frameIdx], frameIdx);
                                onSelectLayer(layer.id);
                            }
                          }}
                          className={`w-8 border-r border-muted flex items-center justify-center cursor-pointer relative
                             ${state.activeFrameIndex === frameIdx ? 'bg-background/40' : ''}
                             ${isActive ? 'bg-primary/20 ring-1 ring-inset ring-primary z-20' : ''}
                             ${(isFrameSelected || isLayerSelected) && !isActive ? 'bg-white/[0.03]' : ''}
                          `}
                        >
                          {hasContent && (
                            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-primary' : isFrameSelected || isLayerSelected ? 'bg-gray-400' : 'bg-gray-600'}`}></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
