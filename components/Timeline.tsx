
import React, { useState } from 'react';
import { ProjectState } from '../types';
import { Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, GripVertical, FilePlus, Sparkles } from './Icons';

interface TimelineProps {
  state: ProjectState;
  onSelectFrames: (indices: number[], activeIndex: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onDuplicateSelectedFrames: () => void;
  onDeleteSelectedFrames: () => void;
  onTweenFrames: () => void;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onAddLayer: () => void;
  onReorderLayers: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onReorderFrames: (fromIndex: number, toIndex: number) => void;
}

interface DragState {
  type: 'layer' | 'frame';
  id: string; 
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
  onTweenFrames,
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

  const handleLayerDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('type', 'layer');
    e.dataTransfer.setData('id', id);
    setDragState({ type: 'layer', id, overId: null, position: 'after' });
  };

  const handleLayerDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault(); 
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
  const canTween = state.selectedFrameIndices.length >= 3;

  return (
    <div className="h-full bg-card border-t border-background flex flex-col text-sm select-none">
      {/* Timeline Controls */}
      <div className="h-8 bg-[#2a2a2a] border-b border-background flex items-center px-3 gap-1 shrink-0">
         <span className="font-bold text-gray-500 mr-2 text-[10px] uppercase tracking-wider hidden sm:block">Timeline</span>
         <button onClick={onAddFrame} className="p-1 hover:text-white text-gray-400" title="New Frame"><Plus size={14} /></button>
         <button onClick={() => isMultiFrame ? onDuplicateSelectedFrames() : onDuplicateFrame()} className={`p-1 hover:text-white ${isMultiFrame ? 'text-primary' : 'text-gray-400'}`} title="Duplicate Frame"><Copy size={14} /></button>
         <button onClick={() => isMultiFrame ? onDeleteSelectedFrames() : onDeleteFrame()} className={`p-1 hover:text-red-400 ${isMultiFrame ? 'text-red-400 font-bold' : 'text-gray-500'}`} title="Delete Frame"><Trash2 size={14} /></button>
         <div className="h-3 w-[1px] bg-border mx-1"></div>
         <button 
           onClick={onTweenFrames} 
           disabled={!canTween}
           className={`p-1 transition-all ${canTween ? 'text-primary hover:text-primary-foreground hover:bg-primary rounded' : 'text-gray-600 opacity-40 cursor-not-allowed'}`} 
           title="Interpolate (Tween) Between Selection"
         >
           <Sparkles size={14} />
         </button>
         <div className="h-3 w-[1px] bg-border mx-1"></div>
         <button onClick={onAddLayer} className="p-1 hover:text-white text-gray-400" title="New Layer"><FilePlus size={14} /></button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Compact Layers Column (Left) */}
        <div className="w-40 pt-8 bg-muted border-r border-background flex flex-col overflow-y-auto overflow-x-hidden">
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
                  className={`h-8 flex items-center px-1.5 gap-1 border-b border-background cursor-pointer group relative
                    ${isActive ? 'bg-[#1a1a1a] border-primary/20' : isSelected ? 'bg-secondary/20' : 'text-gray-500 hover:bg-secondary/10'}
                    ${isDragging ? 'opacity-30' : ''}
                  `}
                  onClick={() => onSelectLayer(layer.id)}
                >
                  {isOver && dragState.position === 'before' && <div className="absolute top-0 left-0 w-full h-[1px] bg-primary z-50 pointer-events-none" />}
                  {isOver && dragState.position === 'after' && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary z-50 pointer-events-none" />}

                  <div className="cursor-grab text-gray-700 hover:text-gray-500 shrink-0"><GripVertical size={12} /></div>
                  <button onClick={(e) => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }} className={`p-1 shrink-0 ${!layer.visible ? 'text-gray-800' : isActive ? 'text-primary' : 'text-gray-500'}`}>
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onToggleLayerLock(layer.id); }} className={`p-1 shrink-0 ${!layer.locked ? 'text-gray-800' : 'text-orange-500/50'}`}>
                    {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                  </button>
                  <span className={`truncate flex-1 text-[11px] ${isActive ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>{layer.name}</span>
                </div>
            );
          })}
        </div>

        {/* Frames Grid (Right) */}
        <div className="flex-1 overflow-x-auto bg-[#171717] relative custom-scrollbar">
           <div className="flex flex-col min-w-max">
             {/* Header Row for Frame Numbers */}
             <div className="flex h-8 border-b border-background bg-muted">
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
                        className={`min-w-[40px] w-10 border-r border-background flex items-center justify-center text-[10px] cursor-pointer hover:bg-secondary/30 relative
                        ${isActive ? 'bg-[#1a1a1a] text-primary font-bold shadow-[inset_0_-2px_0_var(--primary)]' : isSelected ? 'bg-secondary/40 text-foreground' : 'text-gray-600'}
                        ${isDragging ? 'opacity-30' : ''}
                        `}
                    >
                        {isOver && dragState.position === 'before' && <div className="absolute top-0 left-0 h-full w-[2px] bg-primary z-50 pointer-events-none" />}
                        {isOver && dragState.position === 'after' && <div className="absolute top-0 right-0 h-full w-[2px] bg-primary z-50 pointer-events-none" />}
                        {idx + 1}
                    </div>
                  );
                })}
             </div>
             
             {/* Frame Cells */}
             <div className="flex flex-col">
                {state.layers.slice().reverse().map((layer) => (
                  <div key={layer.id} className="flex h-8 border-b border-background">
                    {state.frames.map((frame, frameIdx) => {
                      const hasContent = frame.layerData[layer.id]?.some(p => p !== null);
                      const isActive = state.activeFrameIndex === frameIdx && state.activeLayerId === layer.id;
                      const isFrameSelected = state.selectedFrameIndices.includes(frameIdx);
                      const isLayerSelected = state.selectedLayerIds.includes(layer.id);
                      
                      return (
                        <div 
                          key={`${layer.id}-${frame.id}`}
                          onClick={(e) => {
                            if (e.shiftKey || e.ctrlKey || e.metaKey) handleFrameClick(e, frameIdx);
                            else { onSelectFrames([frameIdx], frameIdx); onSelectLayer(layer.id); }
                          }}
                          className={`min-w-[40px] w-10 border-r border-background flex items-center justify-center cursor-pointer relative transition-colors
                             ${isActive ? 'bg-primary/10' : (isFrameSelected || isLayerSelected) ? 'bg-secondary/10' : 'hover:bg-white/[0.02]'}
                          `}
                        >
                          {hasContent && (
                            <div className={`w-2.5 h-2.5 rounded-full transition-transform ${isActive ? 'bg-primary scale-110 shadow-[0_0_8px_rgba(var(--primary),0.5)]' : isFrameSelected || isLayerSelected ? 'bg-gray-400' : 'bg-gray-700'}`}></div>
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
