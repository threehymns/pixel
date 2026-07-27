
import React, { useState } from 'react';
import { ProjectState } from '../types';
import { Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, GripVertical, FilePlus, Sparkles } from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";

interface TimelineProps {
  state: ProjectState;
  onSelectFrames: (indices: number[], activeIndex: number, layerId?: string) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onDuplicateSelectedFrames: () => void;
  onDeleteSelectedFrames: () => void;
  onInsertFrame: (index: number) => void;
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
  onInsertFrame,
  onTweenFrames,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onAddLayer,
  onReorderLayers,
  onReorderFrames
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handleFrameClick = (e: React.MouseEvent, index: number, layerId?: string) => {
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

      onSelectFrames(newSelection, index, layerId);
  };

  const handleLayerDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('type', 'layer');
    e.dataTransfer.setData('id', id);
    setDragState({ type: 'layer', id, overId: null, position: 'after' });
  };

  const handleLayerDragOver = (e: React.DragEvent, id: string) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    if (dragState.overId !== id || dragState.position !== position) {
      setDragState({ ...dragState, overId: id, position });
    }
  };

  const handleLayerDrop = (e: React.DragEvent, targetId: string) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.id !== targetId) {
        onReorderLayers(dragState.id, targetId, dragState.position);
    }
    setDragState(null);
  };

  const handleFrameDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('type', 'frame');
    e.dataTransfer.setData('index', index.toString());
    setDragState({ type: 'frame', id: index.toString(), overId: null, position: 'after' });
  };

  const handleFrameDragOver = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    if (dragState.overId !== index.toString() || dragState.position !== position) {
      setDragState({ ...dragState, overId: index.toString(), position });
    }
  };

  const handleFrameDrop = (e: React.DragEvent, targetIndex: number) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id);
    if (fromIndex !== targetIndex) {
        let insertIndex = targetIndex;
        if (dragState.position === 'after') insertIndex = targetIndex + 1;
        if (fromIndex < insertIndex) insertIndex--;
        onReorderFrames(fromIndex, insertIndex);
    }
    setDragState(null);
  };

  const handleInsertButtonDragOver = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId !== `insert-${index}`) {
      setDragState({ ...dragState, overId: `insert-${index}`, position: 'before' });
    }
  };

  const handleInsertButtonDrop = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id);
    let insertIndex = index;
    if (fromIndex < insertIndex) insertIndex--;
    onReorderFrames(fromIndex, insertIndex);
    setDragState(null);
  };

  const handleLayerContainerDragOver = (e: React.DragEvent) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const relativeY = e.clientY - rect.top + scrollTop - 32; // -32px line-height pt-8 offset
    
    const reversedLayers = state.layers.slice().reverse();
    if (reversedLayers.length === 0) return;

    const preciseIndex = relativeY / 32; // Each layer is 32px
    let visualIndex = Math.floor(preciseIndex);
    if (visualIndex < 0) visualIndex = 0;
    if (visualIndex >= reversedLayers.length) visualIndex = reversedLayers.length - 1;

    const targetLayer = reversedLayers[visualIndex];
    if (targetLayer) {
      const offset = preciseIndex - visualIndex;
      const position = offset < 0.5 ? 'before' : 'after';
      if (dragState.overId !== targetLayer.id || dragState.position !== position) {
        setDragState({ ...dragState, overId: targetLayer.id, position });
      }
    }
  };

  const handleLayerContainerDrop = (e: React.DragEvent) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId && dragState.id !== dragState.overId) {
        onReorderLayers(dragState.id, dragState.overId, dragState.position);
    }
    setDragState(null);
  };

  const handleFrameContainerDragOver = (e: React.DragEvent) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    // Each frame header is min-w-[40px] w-10 (40px)
    const relativeX = e.clientX - rect.left + scrollLeft;
    
    if (state.frames.length === 0) return;

    const preciseIndex = relativeX / 40;
    let targetIndex = Math.floor(preciseIndex);
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= state.frames.length) targetIndex = state.frames.length - 1;

    const offset = preciseIndex - targetIndex;
    const position = offset < 0.5 ? 'before' : 'after';

    if (dragState.overId !== targetIndex.toString() || dragState.position !== position) {
      setDragState({ ...dragState, overId: targetIndex.toString(), position });
    }
  };

  const handleFrameContainerDrop = (e: React.DragEvent) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id);
    const targetIndex = dragState.overId ? parseInt(dragState.overId) : (state.frames.length - 1);
    if (fromIndex !== targetIndex) {
        let insertIndex = targetIndex;
        if (dragState.position === 'after') insertIndex = targetIndex + 1;
        if (fromIndex < insertIndex) insertIndex--;
        onReorderFrames(fromIndex, insertIndex);
    }
    setDragState(null);
  };

  const isMultiFrame = state.selectedFrameIndices.length > 1;
  const canTween = state.selectedFrameIndices.length >= 3;

  return (
    <div className="h-full bg-card border-t border-border/30 flex flex-col text-sm select-none">
      {/* Timeline Controls */}
      <div className="h-7 bg-secondary/20 border-b border-border/40 flex items-center px-2 gap-1 shrink-0">
         <Tooltip>
           <TooltipTrigger asChild>
             <button onClick={onAddFrame} className="p-1 hover:text-white text-gray-400"><Plus size={14} /></button>
           </TooltipTrigger>
           <TooltipContent side="top">New Frame</TooltipContent>
         </Tooltip>

         <Tooltip>
           <TooltipTrigger asChild>
             <button onClick={() => isMultiFrame ? onDuplicateSelectedFrames() : onDuplicateFrame()} className={`p-1 hover:text-white ${isMultiFrame ? 'text-primary' : 'text-gray-400'}`}><Copy size={14} /></button>
           </TooltipTrigger>
           <TooltipContent side="top">Duplicate Frame</TooltipContent>
         </Tooltip>

         <Tooltip>
           <TooltipTrigger asChild>
             <button onClick={() => isMultiFrame ? onDeleteSelectedFrames() : onDeleteFrame()} className={`p-1 hover:text-red-400 ${isMultiFrame ? 'text-red-400 font-bold' : 'text-gray-500'}`}><Trash2 size={14} /></button>
           </TooltipTrigger>
           <TooltipContent side="top">Delete Frame</TooltipContent>
         </Tooltip>

         <div className="h-3 w-[1px] bg-border mx-1"></div>

         <Tooltip>
           <TooltipTrigger asChild>
             <button 
               onClick={onTweenFrames} 
               disabled={!canTween}
               className={`p-1 transition-all ${canTween ? 'text-primary hover:text-primary-foreground hover:bg-primary rounded' : 'text-gray-600 opacity-40 cursor-not-allowed'}`} 
             >
               <Sparkles size={14} />
             </button>
           </TooltipTrigger>
           <TooltipContent side="top">Interpolate (Tween) Between Selection</TooltipContent>
         </Tooltip>

         <div className="h-3 w-[1px] bg-border mx-1"></div>

         <Tooltip>
           <TooltipTrigger asChild>
             <button onClick={onAddLayer} className="p-1 hover:text-white text-gray-400"><FilePlus size={14} /></button>
           </TooltipTrigger>
           <TooltipContent side="top">New Layer</TooltipContent>
         </Tooltip>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Compact Layers Column (Left) */}
        <div 
          onDragOver={handleLayerContainerDragOver}
          onDrop={handleLayerContainerDrop}
          className="w-40 pt-8 bg-muted border-r border-border/30 flex flex-col overflow-y-auto overflow-x-hidden"
        >
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
                  onDragOver={(e) => { e.stopPropagation(); handleLayerDragOver(e, layer.id); }}
                  onDrop={(e) => { e.stopPropagation(); handleLayerDrop(e, layer.id); }}
                  onDragEnd={() => setDragState(null)}
                  className={`h-8 flex items-center px-1.5 gap-1 border-b border-border/20 cursor-pointer group relative
                    ${isActive ? 'bg-secondary/40 border-primary/20' : isSelected ? 'bg-secondary/20' : 'text-gray-500 hover:bg-secondary/10'}
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
                  <button onClick={(e) => { e.stopPropagation(); onToggleLayerLock(layer.id); }} className={`p-1 shrink-0 ${!layer.locked ? 'text-gray-800' : 'text-primary/50'}`}>
                    {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                  </button>
                  <span className={`truncate flex-1 text-[11px] ${isActive ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>{layer.name}</span>
                </div>
            );
          })}
        </div>

        {/* Frames Grid (Right) */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div 
              onDragOver={handleFrameContainerDragOver}
              onDrop={handleFrameContainerDrop}
              className="flex-1 overflow-x-auto bg-[#171717] relative custom-scrollbar"
            >
               <div className="flex flex-col min-w-max relative">
                 {/* Insert Buttons Overlay */}
                 <div className="absolute top-0 left-0 w-full h-8 pointer-events-none z-30">
                    {Array.from({ length: state.frames.length + 1 }).map((_, i) => {
                      const isOver = dragState?.type === 'frame' && dragState.overId === `insert-${i}`;
                      return (
                        <div 
                          key={`insert-${i}`}
                          onDragOver={(e) => handleInsertButtonDragOver(e, i)}
                          onDrop={(e) => handleInsertButtonDrop(e, i)}
                          className="absolute top-0 bottom-0 w-4 -ml-2 pointer-events-auto group flex items-center justify-center cursor-pointer"
                          style={{ left: i * 40 }}
                        >
                           <div className={`w-[2px] h-full bg-primary transition-opacity ${isOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <button 
                                 onClick={() => onInsertFrame(i)}
                                 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg hover:scale-125 transition-all"
                               >
                                 <Plus size={10} />
                               </button>
                             </TooltipTrigger>
                             <TooltipContent side="top">Insert Frame</TooltipContent>
                           </Tooltip>
                        </div>
                      );
                    })}
                 </div>

                 {/* Header Row for Frame Numbers */}
                 <div className="flex h-8 border-b border-border/30 bg-muted">
                    {state.frames.map((_, idx) => {
                      const isDragging = dragState?.type === 'frame' && dragState.id === idx.toString();
                      const isOver = dragState?.type === 'frame' && dragState.overId === idx.toString();
                      const isActive = state.activeFrameIndex === idx;
                      const isSelected = state.selectedFrameIndices.includes(idx);

                      return (
                        <ContextMenu key={idx}>
                          <ContextMenuTrigger asChild>
                            <div 
                                draggable
                                onDragStart={(e) => handleFrameDragStart(e, idx)}
                                onDragOver={(e) => { e.stopPropagation(); handleFrameDragOver(e, idx); }}
                                onDrop={(e) => { e.stopPropagation(); handleFrameDrop(e, idx); }}
                                onDragEnd={() => setDragState(null)}
                                onClick={(e) => handleFrameClick(e, idx)}
                                className={`min-w-[40px] w-10 border-r border-border/30 flex items-center justify-center text-[10px] cursor-pointer hover:bg-secondary/30 relative
                                ${isActive ? 'bg-secondary/40 text-primary font-bold shadow-[inset_0_-2px_0_var(--primary)]' : isSelected ? 'bg-secondary/40 text-foreground' : 'text-gray-600'}
                                ${isDragging ? 'opacity-30' : ''}
                                `}
                            >
                                {isOver && dragState.position === 'before' && <div className="absolute top-0 left-0 h-full w-[2px] bg-primary z-50 pointer-events-none" />}
                                {isOver && dragState.position === 'after' && <div className="absolute top-0 right-0 h-full w-[2px] bg-primary z-50 pointer-events-none" />}
                                {idx + 1}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => { onSelectFrames([idx], idx); onDuplicateFrame(); }}>Duplicate</ContextMenuItem>
                            <ContextMenuItem onClick={() => onInsertFrame(idx)}>Insert Before</ContextMenuItem>
                            <ContextMenuItem onClick={() => onInsertFrame(idx + 1)}>Insert After</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => { onSelectFrames([idx], idx); onDeleteFrame(); }} className="text-destructive focus:text-destructive">Delete</ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                 </div>
                 
                 {/* Frame Cells */}
                 <div className="flex flex-col">
                    {state.layers.slice().reverse().map((layer) => (
                      <div key={layer.id} className="flex h-8 border-b border-border/20">
                        {state.frames.map((frame, frameIdx) => {
                          const hasContent = frame.layerData[layer.id]?.some(p => p !== null);
                          const isActive = state.activeFrameIndex === frameIdx && state.activeLayerId === layer.id;
                          const isFrameSelected = state.selectedFrameIndices.includes(frameIdx);
                          const isLayerSelected = state.selectedLayerIds.includes(layer.id);
                          
                          return (
                            <div 
                              key={`${layer.id}-${frame.id}`}
                              onClick={(e) => {
                                 handleFrameClick(e, frameIdx, layer.id);
                              }}
                              className={`min-w-[40px] w-10 border-r border-border/20 flex items-center justify-center cursor-pointer relative transition-colors
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
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={onAddFrame}>New Frame</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
};
