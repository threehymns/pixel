
import React, { useState, useEffect, useRef } from 'react';
import { ProjectState, ToolType } from '../types';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { Timeline } from './Timeline';
import { Preview } from './Preview';
import { HistoryPanel } from './HistoryPanel'; 
import { LayersPanel } from './LayersPanel'; 
import { Menubar } from './Menubar';
import { TabStrip } from './TabStrip';
import { Home } from './Home';
import { FileTree } from './FileTree';
import { StatusBar } from './StatusBar';
import { ToolButton } from './ToolButton';
import { ColorPicker } from './ColorPicker';
import { Allotment } from 'allotment';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './Popover';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { 
  Pencil, Eraser, PaintBucket, Pipette, 
  Grid, Eye, Download, Undo, Redo, 
  Square, Circle,
  BoxSelect, Lasso, Wand2, MousePointer2, Scissors,
  Minus, Sparkles, Settings, Droplets, Zap, X, Plus, Palette as PaletteIcon, 
  Waves, FlipHorizontal, FlipVertical, Hand, ChevronDown, ArrowRightLeft,
  FolderOpen, Layers, Clock, Play
} from './Icons';
import { PlaySquare, Move } from 'lucide-react';
import { CustomSlider } from './ui/slider';
import { CustomCheckbox } from './ui/checkbox';
import { SELECTION_TOOLS } from '../constants';
import { DragZonePosition } from '../hooks/useLayout';

interface DesktopLayoutProps {
  state: ProjectState;
  updateState: (s: ProjectState, config?: any) => void;
  commands: any[];
  project: any;
  canvasTools: any;
  fileSystem: any;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  statusMessage: { text: string, type: 'info' | 'error' | 'success' };
  mousePos: any;
  dragStartPos: any;
  setMousePos: (pos: any) => void;
  setDragStartPos: (pos: any) => void;
  onScalePixels: (selection: Set<number>, srcBox: any, destBox: any) => void;
  selectionSize: any;
  layout: any;
}

const FloatingWindow: React.FC<{
  pane: any;
  metadata: { title: string; icon: React.ReactNode };
  updateFloatingPanePosition: (id: string, x: number, y: number) => void;
  handleDragStart: (e: React.DragEvent, paneId: string, sourceSlot: string) => void;
  handleDragEnd: () => void;
  handleClosePane: (paneId: string) => void;
  renderPaneContent: (paneId: string) => React.ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({
  pane,
  metadata,
  updateFloatingPanePosition,
  handleDragStart,
  handleDragEnd,
  handleClosePane,
  renderPaneContent,
  onContextMenu
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking buttons or inputs inside
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - pane.x,
      y: e.clientY - pane.y
    });
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const nextX = e.clientX - dragOffset.x;
      const nextY = e.clientY - dragOffset.y;
      updateFloatingPanePosition(pane.id, nextX, nextY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, pane.id, updateFloatingPanePosition]);

  return (
    <div
      className="absolute z-50 bg-card rounded-lg shadow-2xl border border-border/40 flex flex-col overflow-hidden pointer-events-auto select-none"
      style={{
        left: pane.x,
        top: pane.y,
        width: pane.width || 280,
        height: pane.height || 320,
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={onContextMenu}
        className="h-7 px-2 bg-secondary/80 border-b border-border/30 flex items-center justify-between cursor-move active:cursor-grabbing shrink-0"
      >
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, pane.id, 'floating')}
          onDragEnd={handleDragEnd}
          className="flex items-center space-x-1.5 text-[10.5px] font-medium text-foreground/90 cursor-grab active:cursor-grabbing hover:bg-secondary/50 px-1.5 py-0.5 rounded select-none border border-transparent hover:border-border/30"
          title="Right-click for tab options, or drag back to a dock slot"
        >
          <span className="text-muted-foreground">{metadata.icon}</span>
          <span>{metadata.title}</span>
        </div>

        <button
          onClick={() => handleClosePane(pane.id)}
          className="p-0.5 hover:bg-accent hover:text-foreground rounded text-muted-foreground/50 hover:text-muted-foreground transition-all"
          title="Dock/Close Window"
        >
          <X size={11} />
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-background/5 p-0 overflow-hidden relative">
        {renderPaneContent(pane.id)}
      </div>
    </div>
  );
};

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  state,
  updateState,
  commands,
  project,
  canvasTools,
  fileSystem,
  handleFileChange,
  fileInputRef,
  statusMessage,
  mousePos,
  dragStartPos,
  setMousePos,
  setDragStartPos,
  onScalePixels,
  selectionSize,
  layout
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const [lastSelectionTool, setLastSelectionTool] = useState<ToolType>('rect-select');
  const [lastShapeTool, setLastShapeTool] = useState<ToolType>('rect');
  const [lastEffectTool, setLastEffectTool] = useState<ToolType>('blur');
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number, y: number, paneId: string, slotId: 'left' | 'right' | 'bottom' | 'floating', groupId?: string } | null>(null);

  const {
    slots,
    floatingPanes,
    draggedPane,
    dragOverSlot,
    dragOverIndex,
    dragOverZone,
    togglePaneVisibility,
    handleDragStart,
    handleDragOver,
    handleDragOverBody,
    handleDragOverTabBar,
    handleDragOverTab,
    handleDragEnd,
    clearDragOverState,
    handleDrop,
    unsplitSlot,
    splitGroup,
    handleSelectTab,
    handleClosePane,
    handleCloseOtherPanesInGroup,
    handleCloseAllPanesInSlot,
    handleAddPaneToGroup,
    handleAddPaneToSlot,
    floatPane,
    updateFloatingPanePosition,
    setSlotVisibility
  } = layout;

  const PANE_METADATA: Record<string, { title: string, icon: React.ReactNode }> = {
    'file-tree': { title: 'File Tree', icon: <FolderOpen size={14} /> },
    'palette': { title: 'Colors & Palette', icon: <PaletteIcon size={14} /> },
    'layers': { title: 'Layers', icon: <Layers size={14} /> },
    'history': { title: 'History', icon: <Clock size={14} /> },
    'timeline': { title: 'Timeline', icon: <PlaySquare size={14} /> },
    'preview': { title: 'Preview', icon: <Play size={14} /> }
  };

  const isPreviewDocked = Object.values(slots).some((s: any) => 
    s.visible && s.groups.some((g: any) => g.panes.includes('preview'))
  );
  const shouldShowFloatingPreview = !isPreviewDocked && showPreview;

  const renderPaneContent = (paneId: string) => {
    switch (paneId) {
      case 'file-tree':
        return (
          <FileTree 
            rootHandle={fileSystem.rootHandle}
            onOpenFolder={fileSystem.openFolder}
            onFileOpen={project.loadProjectFromFile}
            onResizeStart={() => {}} 
            width={0} 
          />
        );
      case 'palette':
        return (
          <Palette 
            width={0} 
            colors={state.palette} 
            palettes={state.paletteLibrary} 
            activePaletteId={state.activePaletteId}
            primaryColor={state.primaryColor} 
            secondaryColor={state.secondaryColor}
            onColorSelect={(c, p) => p ? updateState({...state, primaryColor: c}) : updateState({...state, secondaryColor: c})}
            onAddColor={(c) => {
              const updatedLibrary = state.paletteLibrary.map(p => p.id === state.activePaletteId ? { ...p, colors: [...p.colors, c] } : p);
              updateState({ ...state, paletteLibrary: updatedLibrary, palette: [...state.palette, c] });
            }}
            onSelectPalette={project.selectPalette} 
            onImportPalette={project.importPalette} 
            onResizeStart={() => {}} 
            onColorsSelected={(selectedColors) => {
                updateState({...state, shades: selectedColors, inkType: 'shading'});
            }}
          />
        );
      case 'layers':
        return (
          <LayersPanel 
              state={state} 
              onSelectLayers={(ids, active) => updateState({...state, selectedLayerIds: ids, activeLayerId: active})}
              onUpdateLayer={project.updateLayer} 
              onAddLayer={project.addLayer} 
              onDuplicateLayer={project.duplicateLayer}
              onDeleteLayer={project.deleteLayer} 
              onDuplicateSelectedLayers={project.duplicateSelectedLayers}
              onDeleteSelectedLayers={project.deleteSelectedLayers} 
              onReorderLayers={project.reorderLayers}
              className="flex-1 w-full h-full"
          />
        );
      case 'history':
        return (
          <HistoryPanel 
            history={project.history} 
            historyIndex={project.historyIndex} 
            onJumpToHistory={project.jumpToHistory} 
            className="flex-1 w-full h-full" 
          />
        );
      case 'timeline':
        return (
          <Timeline 
            state={state} 
            onSelectFrames={(indices, active, layerId) => {
              const nextState = {
                ...state,
                selectedFrameIndices: indices,
                activeFrameIndex: active
              };
              if (layerId) {
                nextState.activeLayerId = layerId;
                nextState.selectedLayerIds = [layerId];
              }
              updateState(nextState);
            }}
            onAddFrame={project.addFrame} 
            onDuplicateFrame={project.duplicateFrame} 
            onDeleteFrame={project.deleteFrame}
            onDuplicateSelectedFrames={project.duplicateSelectedFrames} 
            onDeleteSelectedFrames={project.deleteSelectedFrames}
            onInsertFrame={project.insertFrame}
            onTweenFrames={project.tweenFrames} 
            onSelectLayer={(id) => updateState({...state, activeLayerId: id, selectedLayerIds: [id]})}
            onAddLayer={project.addLayer} 
            onToggleLayerVisibility={(id) => updateState({...state, layers: state.layers.map(l => l.id===id?{...l, visible:!l.visible}:l)})}
            onToggleLayerLock={(id) => updateState({...state, layers: state.layers.map(l => l.id===id?{...l, locked:!l.locked}:l)})}
            onReorderLayers={project.reorderLayers} 
            onReorderFrames={project.reorderFrames}
          />
        );
      case 'preview':
        return (
          <Preview 
            width={0} 
            state={state} 
            onClose={() => handleClosePane('preview')} 
            isFloating={false} 
          />
        );
      default:
        return null;
    }
  };

  const slotTabListRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getIndicatorLeftPos = (slotId: 'left' | 'right' | 'bottom', groupId?: string) => {
    if (!dragOverIndex || dragOverIndex.slotId !== slotId || dragOverZone?.position !== 'tab-bar') return null;
    if (groupId && dragOverIndex.groupId !== groupId) return null;
    const key = `${slotId}-${groupId || ''}`;
    const container = slotTabListRefs.current[key];
    if (!container) return null;

    const tabs = Array.from(container.querySelectorAll('[data-tab-id]')) as HTMLElement[];
    if (tabs.length === 0) return 4;

    const idx = dragOverIndex.index;
    if (idx <= 0) {
      return tabs[0].offsetLeft;
    } else if (idx >= tabs.length) {
      const last = tabs[tabs.length - 1];
      return last.offsetLeft + last.offsetWidth;
    } else {
      const prev = tabs[idx - 1];
      const curr = tabs[idx];
      return Math.round((prev.offsetLeft + prev.offsetWidth + curr.offsetLeft) / 2);
    }
  };

  const renderSlotContainer = (slotId: 'left' | 'right' | 'bottom') => {
    const slot = slots[slotId];
    if (!slot || !slot.visible || slot.groups.length === 0) return null;

    const closedPanes = Object.keys(PANE_METADATA).filter(
      paneId => !Object.values(slots).some((s: any) => s.groups.some((g: any) => g.panes.includes(paneId))) &&
                !floatingPanes.some((fp: any) => fp.id === paneId)
    );

    const renderGroupContainer = (group: any, groupIndex: number) => {
      const isDragOverSlot = dragOverSlot === slotId;
      const isGroupHover = isDragOverSlot && dragOverZone?.groupId === group.id;
      const isBodyTopHover = isGroupHover && dragOverZone?.position === 'body-top';
      const isBodyBottomHover = isGroupHover && dragOverZone?.position === 'body-bottom';
      const isBodyLeftHover = isGroupHover && dragOverZone?.position === 'body-left';
      const isBodyRightHover = isGroupHover && dragOverZone?.position === 'body-right';
      const indicatorLeft = getIndicatorLeftPos(slotId, group.id);

      return (
        <div 
          key={group.id}
          className={`w-full h-full flex flex-col bg-card select-none overflow-hidden relative border border-border/20 transition-all ${
            isBodyTopHover || isBodyBottomHover || isBodyLeftHover || isBodyRightHover
              ? 'ring-2 ring-primary ring-inset shadow-inner'
              : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!draggedPane) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const relY = e.clientY - rect.top;

            let pos: DragZonePosition = 'body-top';
            if (relY > rect.height * 0.75) {
              pos = 'body-bottom';
            } else if (relX > rect.width * 0.75) {
              pos = 'body-right';
            } else if (relX < rect.width * 0.25) {
              pos = 'body-left';
            } else {
              pos = 'body-top';
            }
            handleDragOverBody(slotId, group.id, pos);
          }}
          onDragLeave={(e) => {
            if (!draggedPane) return;
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              clearDragOverState();
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDrop(e, slotId, group.id);
          }}
        >
          {/* Tab Strip for this group */}
          <div className="h-7 bg-secondary/50 flex items-center justify-between border-b border-border/30 px-1 select-none shrink-0 overflow-hidden relative">
            <div 
              ref={(el) => { slotTabListRefs.current[`${slotId}-${group.id}`] = el; }}
              className="relative flex items-center space-x-0.5 overflow-x-auto h-full max-w-[85%] no-scrollbar"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragOverTabBar(e, slotId, group.id);
              }}
            >
              {group.panes.map((paneId: string, index: number) => {
                const metadata = PANE_METADATA[paneId] || { title: paneId, icon: null };
                const isActive = group.activePaneId === paneId;
                
                return (
                  <div
                    key={paneId}
                    data-tab-id={paneId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, paneId, slotId, group.id)}
                    onDragOver={(e) => handleDragOverTab(e, paneId, slotId, group.id, index)}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTabContextMenu({ x: e.clientX, y: e.clientY, paneId, slotId, groupId: group.id });
                    }}
                    className={`h-full flex items-center px-2 space-x-1.5 text-[10.5px] font-medium cursor-default border-r border-border/20 relative select-none transition-colors border-t-2 ${
                      isActive 
                        ? 'bg-card text-foreground border-t-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30 border-t-transparent'
                    }`}
                    onClick={() => handleSelectTab(slotId, group.id, paneId)}
                    title={`${metadata.title} (Right-click for options)`}
                  >
                    <span className="flex items-center text-muted-foreground select-none pointer-events-none">{metadata.icon}</span>
                    <span className="truncate max-w-[95px] select-none pointer-events-none">{metadata.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClosePane(paneId);
                      }}
                      className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-secondary/80 transition-all ml-0.5 opacity-60 hover:opacity-100"
                      title="Close Tab"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}

              {/* Standalone Drop Line Indicator */}
              {indicatorLeft !== null && (
                <div 
                  className="absolute top-1 bottom-1 w-[2px] bg-primary z-30 pointer-events-none -translate-x-1/2 transition-all duration-75 rounded-full"
                  style={{ left: `${indicatorLeft}px` }}
                />
              )}
            </div>
            
            {/* Slot & Group Actions */}
            <div className="flex items-center space-x-0.5 shrink-0 px-1">
              {closedPanes.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors" title="Add Pane to Group">
                      <Plus size={11} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-48 p-1 flex flex-col gap-0.5 shadow-xl bg-card border border-border rounded-lg text-foreground z-50">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Add Pane to Group
                    </div>
                    <div className="h-[1px] bg-border my-1" />
                    {closedPanes.map(paneId => (
                      <button
                        key={paneId}
                        onClick={() => handleAddPaneToGroup(slotId, group.id, paneId)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-foreground text-xs flex items-center space-x-2 transition-colors"
                      >
                        <span className="text-muted-foreground">{PANE_METADATA[paneId]?.icon}</span>
                        <span>{PANE_METADATA[paneId]?.title}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
              
              {slot.groups.length > 1 && (
                <button 
                  onClick={() => unsplitSlot(slotId)}
                  className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                  title="Unsplit Dock"
                >
                  <ArrowRightLeft size={11} />
                </button>
              )}

              <button 
                onClick={() => setSlotVisibility(slotId, false)}
                className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                title="Collapse Dock"
              >
                <Minus size={11} />
              </button>
            </div>
          </div>

          {/* Content View */}
          <div className="flex-1 min-h-0 relative bg-background/5 p-0 overflow-hidden">
            {renderPaneContent(group.activePaneId)}

            {/* Visual Drop Overlays */}
            {isBodyTopHover && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/70 z-30 pointer-events-none select-none flex flex-col items-center justify-center gap-1.5 backdrop-blur-[1px] animate-in fade-in-50 duration-100">
                <div className="p-2 rounded-full bg-primary/20 text-primary shadow-sm pointer-events-none">
                  <FolderOpen size={18} />
                </div>
                <span className="text-xs font-semibold text-primary tracking-wide pointer-events-none">Drop to add as Tab</span>
              </div>
            )}

            {isBodyBottomHover && (
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-primary/15 border-2 border-dashed border-primary z-30 pointer-events-none select-none flex flex-col items-center justify-center gap-1.5 backdrop-blur-[1px] animate-in fade-in-50 duration-100 rounded-b-md">
                <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-md pointer-events-none">
                  <FlipVertical size={18} />
                </div>
                <span className="text-xs font-bold text-primary tracking-wide pointer-events-none">Drop to Split Below</span>
              </div>
            )}

            {isBodyRightHover && (
              <div className="absolute inset-y-0 right-0 w-1/2 bg-primary/15 border-2 border-dashed border-primary z-30 pointer-events-none select-none flex flex-col items-center justify-center gap-1.5 backdrop-blur-[1px] animate-in fade-in-50 duration-100 rounded-r-md">
                <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-md pointer-events-none">
                  <FlipVertical size={18} className="rotate-90 pointer-events-none" />
                </div>
                <span className="text-xs font-bold text-primary tracking-wide pointer-events-none">Drop to Split Right</span>
              </div>
            )}

            {isBodyLeftHover && (
              <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/15 border-2 border-dashed border-primary z-30 pointer-events-none select-none flex flex-col items-center justify-center gap-1.5 backdrop-blur-[1px] animate-in fade-in-50 duration-100 rounded-l-md">
                <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-md pointer-events-none">
                  <FlipVertical size={18} className="-rotate-90 pointer-events-none" />
                </div>
                <span className="text-xs font-bold text-primary tracking-wide pointer-events-none">Drop to Split Left</span>
              </div>
            )}
          </div>
        </div>
      );
    };

    if (slot.groups.length === 1) {
      return renderGroupContainer(slot.groups[0], 0);
    }

    return (
      <Allotment vertical={slot.splitDirection === 'vertical'} className="w-full h-full">
        {slot.groups.map((group: any, idx: number) => (
          <Allotment.Pane key={group.id} minSize={80}>
            {renderGroupContainer(group, idx)}
          </Allotment.Pane>
        ))}
      </Allotment>
    );
  };

  const { activeProjectId } = project;
  const isHome = activeProjectId === 'home';

  const getToolIcon = (t: ToolType) => {
      switch(t) {
          case 'rect-select': return <BoxSelect size={20} />;
          case 'ellipse-select': return <Circle size={20} />;
          case 'lasso-select': return <Lasso size={20} />;
          case 'poly-lasso-select': return <Scissors size={20} />;
          case 'magic-wand': return <Wand2 size={20} />;
          case 'rect': return <Square size={20} />;
          case 'filled-rect': return <div className="w-5 h-5 bg-current rounded-sm"></div>;
          case 'ellipse': return <Circle size={20} />;
          case 'filled-ellipse': return <div className="w-5 h-5 bg-current rounded-full"></div>;
          case 'blur': return <Droplets size={20} />;
          case 'sharpen': return <Zap size={20} />;
          case 'smudge': return <Hand size={20} />;
          default: return <BoxSelect size={20} />;
      }
  };

  useEffect(() => {
    if (SELECTION_TOOLS.includes(state.tool)) {
      setLastSelectionTool(state.tool);
    }
    if (['rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(state.tool)) {
      setLastShapeTool(state.tool);
    }
    if (['blur', 'sharpen'].includes(state.tool)) {
        setLastEffectTool(state.tool);
    }
  }, [state.tool]);

  const removeShade = (index: number) => {
      const newShades = [...state.shades];
      newShades.splice(index, 1);
      updateState({...state, shades: newShades});
  };

  const addShade = (color: string) => {
      if (state.shades.includes(color)) return;
      updateState({...state, shades: [...state.shades, color]});
  };

  return (
    <div className="flex flex-col h-full">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".aseprite,.ase,.png,.jpg,.jpeg,.gif,.json,.pxa" 
          onChange={handleFileChange} 
        />

        <div className="h-7 bg-card border-b border-border flex items-center px-2 text-xs space-x-4 shrink-0 z-50">
          <Menubar 
              commands={commands} 
              recentProjects={project.recentProjects}
              onOpenRecent={project.loadRecentProject}
              onClearRecent={project.clearRecents}
          />
        </div>

        <TabStrip 
          projects={project.projects} 
          activeProjectId={project.activeProjectId}
          onSelectProject={project.setActiveProjectId}
          onCloseProject={project.closeProject}
          onNewProject={project.createProject}
        />

        {isHome ? (
          <Home onCreateProject={project.createProject} onImportProject={() => fileInputRef.current?.click()} />
        ) : (
          <>
            <div className="h-10 bg-secondary/50 border-b border-border/30 flex items-center px-2 space-x-2 text-xs shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-1 border-r border-border/50 pr-2 shrink-0">
                  <ToolButton active={false} onClick={() => commands.find(c => c.id === 'edit.undo')?.perform()} icon={<Undo size={16} />} label="Undo (Ctrl+Z)" />
                  <ToolButton active={false} onClick={() => commands.find(c => c.id === 'edit.redo')?.perform()} icon={<Redo size={16} />} label="Redo (Ctrl+Y)" />
              </div>
              
              <div className="flex items-center space-x-3 px-2 flex-1 min-w-max">
                  <div className="flex bg-card rounded p-0.5 gap-0.5 ring-1 ring-border shadow-inner shrink-0">
                      <button 
                          onClick={() => updateState({...state, inkType: 'simple'})}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${state.inkType === 'simple' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                          Simple
                      </button>
                      <button 
                          onClick={() => updateState({...state, inkType: 'shading'})}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${state.inkType === 'shading' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                          <Droplets size={10} />
                          Shading
                      </button>
                  </div>

                  {state.inkType === 'shading' && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-background/40 border border-border rounded-md animate-in slide-in-from-left-2 duration-200">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Shades:</span>
                          <div className="flex gap-0.5 bg-background p-0.5 rounded border border-border/50 min-w-[100px] h-6 items-center">
                              {state.shades.map((color, idx) => (
                                  <div 
                                    key={idx} 
                                    draggable
                                    onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', idx.toString()); }}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                                        if (!isNaN(fromIdx) && fromIdx !== idx) {
                                            const newShades = [...state.shades];
                                            const [moved] = newShades.splice(fromIdx, 1);
                                            newShades.splice(idx, 0, moved);
                                            updateState({...state, shades: newShades});
                                        }
                                    }}
                                    className="w-4 h-full relative group cursor-grab active:cursor-grabbing border border-border/20"
                                    style={{ backgroundColor: color }}
                                  >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="absolute inset-0"></div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">{`Step ${idx + 1}: ${color}`}</TooltipContent>
                                      </Tooltip>
                                      <button 
                                        onClick={() => removeShade(idx)}
                                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all z-20"
                                      >
                                          <X size={8} />
                                      </button>
                                  </div>
                              ))}
                              {state.shades.length < 16 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button 
                                        onClick={() => addShade(state.primaryColor)}
                                        className="w-4 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border ml-0.5"
                                      >
                                          <Plus size={10} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Add Primary Color to Shade</TooltipContent>
                                  </Tooltip>
                              )}
                          </div>
                          <Popover>
                              <PopoverTrigger asChild>
                                  <button className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors">
                                      <ChevronDown size={12} />
                                  </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-32 p-1 flex flex-col gap-0.5 shadow-xl bg-card border border-border rounded-lg text-foreground">
                                  <PopoverClose asChild>
                                      <button 
                                          onClick={() => updateState({...state, shades: [...state.shades].reverse()})}
                                          disabled={state.shades.length < 2}
                                          className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-accent text-foreground text-xs disabled:opacity-50"
                                      >
                                          Reverse Shade
                                      </button>
                                  </PopoverClose>
                                  <PopoverClose asChild>
                                      <button 
                                          onClick={() => updateState({...state, shades: []})}
                                          className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-destructive hover:text-destructive-foreground text-muted-foreground text-xs"
                                      >
                                          Clear Shade
                                      </button>
                                  </PopoverClose>
                              </PopoverContent>
                          </Popover>
                      </div>
                  )}

                  <div className="w-[1px] h-4 bg-border mx-1"></div>

                  <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mr-1">Symmetry:</span>
                      <div className="flex bg-card rounded p-0.5 gap-0.5 ring-1 ring-border shadow-inner">
                          <ToolButton 
                            active={state.symmetry.x} 
                            onClick={() => updateState({...state, symmetry: { ...state.symmetry, x: !state.symmetry.x }})} 
                            icon={<FlipHorizontal size={14} />} 
                            label="Horizontal Symmetry" 
                          />
                          <ToolButton 
                            active={state.symmetry.y} 
                            onClick={() => updateState({...state, symmetry: { ...state.symmetry, y: !state.symmetry.y }})} 
                            icon={<FlipVertical size={14} />} 
                            label="Vertical Symmetry" 
                          />
                      </div>
                  </div>

                  <div className="w-[1px] h-4 bg-border mx-1"></div>

                  {['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(state.tool) && (
                      <>
                          <div className="flex items-center gap-2">
                              <span className="text-muted-foreground hidden sm:inline">Size:</span>
                              <CustomSlider
                                  min={1} 
                                  max={10} 
                                  value={state.brushSize} 
                                  onValueChange={(val) => updateState({...state, brushSize: val})} 
                                  className="w-20 sm:w-24" 
                              />
                              <span className="w-4 text-center">{state.brushSize}</span>
                          </div>
                          <div className="flex bg-card rounded p-0.5 ml-2 gap-0.5 ring-1 ring-border shadow-inner">
                              <ToolButton active={state.brushShape === 'square'} onClick={() => updateState({...state, brushShape: 'square'})} icon={<Square size={14} />} label="Square Brush" />
                              <ToolButton active={state.brushShape === 'circle'} onClick={() => updateState({...state, brushShape: 'circle'})} icon={<Circle size={14} />} label="Circle Brush" />
                          </div>
                          {state.tool === 'pencil' && state.inkType === 'simple' && (
                              <div className="flex items-center gap-2 ml-4">
                                  <CustomCheckbox 
                                      id="pixelPerfect" 
                                      checked={state.pixelPerfect} 
                                      onCheckedChange={(checked) => updateState({...state, pixelPerfect: !!checked})}
                                  />
                                  <label htmlFor="pixelPerfect" className="text-muted-foreground cursor-pointer text-[10px] hidden sm:inline">Pixel Perfect</label>
                              </div>
                          )}
                      </>
                  )}
                  {(state.tool === 'bucket' || state.tool === 'magic-wand') && (
                      <div className="flex items-center gap-2">
                          <CustomCheckbox 
                              id="contiguous" 
                              checked={state.fillContiguous} 
                              onCheckedChange={(checked) => updateState({...state, fillContiguous: !!checked})}
                          />
                          <label htmlFor="contiguous" className="text-muted-foreground cursor-pointer text-[10px]">Contiguous</label>
                      </div>
                  )}
                  {state.tool === 'move' && (
                      <div className="flex items-center gap-3">
                          <span className="text-muted-foreground hidden sm:inline">Rotation:</span>
                          <div className="flex bg-card rounded p-0.5 gap-0.5 ring-1 ring-border shadow-inner">
                              <button 
                                onClick={() => updateState({...state, rotationAlgorithm: 'nearest'})}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${state.rotationAlgorithm === 'nearest' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                              >
                                Nearest
                              </button>
                              <button 
                                onClick={() => updateState({...state, rotationAlgorithm: 'rotsprite'})}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${state.rotationAlgorithm === 'rotsprite' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                              >
                                <Sparkles size={10} />
                                RotSprite
                              </button>
                          </div>
                      </div>
                  )}
              </div>

              <div className="flex items-center space-x-1 pl-2 border-l border-border/50 shrink-0">
                  <ToolButton active={isPreviewDocked || showPreview} onClick={() => togglePaneVisibility('preview')} icon={<PlaySquare size={16} />} label="Toggle Preview" />
                  <ToolButton active={state.showGrid} onClick={() => updateState({...state, showGrid: !state.showGrid})} icon={<Grid size={16} />} label="Toggle Grid" />
                  <ToolButton active={state.onionSkin} onClick={() => updateState({...state, onionSkin: !state.onionSkin})} icon={<Eye size={16} />} label="Onion Skin" />
                  <ToolButton active={false} onClick={() => project.openExportDialog ? project.openExportDialog('gif') : project.downloadImage()} icon={<Download size={16} />} label="Export PNG / GIF..." />
              </div>
            </div>

            <div 
              className="flex-1 min-h-0 relative"
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedPane && (dragOverSlot !== null || dragOverZone !== null)) {
                  clearDragOverState();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggedPane) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left - 80;
                const y = e.clientY - rect.top - 15;
                floatPane(draggedPane.paneId, draggedPane.sourceSlot, x, y);
                handleDragEnd();
              }}
            >
              {floatingPanes.map((pane: any) => (
                <FloatingWindow 
                  key={pane.id} 
                  pane={pane}
                  metadata={PANE_METADATA[pane.id] || { title: pane.id, icon: null }}
                  updateFloatingPanePosition={updateFloatingPanePosition}
                  handleDragStart={handleDragStart}
                  handleDragEnd={handleDragEnd}
                  handleClosePane={handleClosePane}
                  renderPaneContent={renderPaneContent}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTabContextMenu({ x: e.clientX, y: e.clientY, paneId: pane.id, slotId: 'floating' });
                  }}
                />
              ))}
              <Allotment vertical>
                <Allotment.Pane>
                  <Allotment>
                    {/* Left Slot containing modular tabs like file-tree / palette */}
                    <Allotment.Pane 
                      visible={slots.left.visible && slots.left.groups.some((g: any) => g.panes.length > 0)} 
                      preferredSize={slots.left.size || 220} 
                      minSize={150} 
                      priority={1 as any}
                    >
                      {renderSlotContainer('left')}
                    </Allotment.Pane>

                    {/* Tool Palette (Static 44px) */}
                    <Allotment.Pane minSize={44} maxSize={44} priority={1 as any}>
                        <div className="w-full h-full bg-card border-r border-border/30 flex flex-col items-center py-2 overflow-y-auto overflow-x-hidden z-50 shadow-lg scrollbar-hide">
                            <div className="flex flex-col gap-1 p-1">
                                <ToolButton active={state.tool === 'pencil'} onClick={() => updateState({...state, tool: 'pencil'})} icon={<Pencil size={18} />} label="Pencil (B)" />
                                <ToolButton active={state.tool === 'eraser'} onClick={() => updateState({...state, tool: 'eraser'})} icon={<Eraser size={18} />} label="Eraser (E)" />
                                
                                <ToolButton active={state.tool === 'line'} onClick={() => updateState({...state, tool: 'line'})} icon={<Minus className="-rotate-45" size={18} />} label="Line (L)" />
                                <Popover>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <button 
                                          className={`p-1.5 rounded-sm transition-all relative group flex items-center justify-center ${['rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(state.tool) ? 'bg-primary text-primary-foreground shadow-inner' : 'text-muted-foreground hover:bg-accent'}`}
                                          onClick={(e) => { if (!['rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(state.tool)) updateState({...state, tool: lastShapeTool}); }}
                                        >
                                          {React.cloneElement(getToolIcon(lastShapeTool) as React.ReactElement, { size: 18 })}
                                          <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-current opacity-50 rounded-tl-sm clip-path-triangle"></div>
                                        </button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={12}>Shape Tools (U)</TooltipContent>
                                  </Tooltip>
                                  <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-40 p-1.5 shadow-xl bg-card border border-border rounded-lg text-foreground">
                                    <PopoverClose asChild>
                                        <button onClick={() => updateState({...state, tool: 'rect'})} className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === 'rect' ? 'bg-primary text-primary-foreground font-medium' : ''}`}>
                                          <Square size={14} /> <span>Rectangle (U)</span>
                                        </button>
                                    </PopoverClose>
                                    <PopoverClose asChild>
                                        <button onClick={() => updateState({...state, tool: 'filled-rect'})} className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === 'filled-rect' ? 'bg-primary text-primary-foreground font-medium' : ''}`}>
                                          <div className="w-3.5 h-3.5 bg-current rounded-sm"></div> <span>Filled Rect (U)</span>
                                        </button>
                                    </PopoverClose>
                                    <PopoverClose asChild>
                                        <button onClick={() => updateState({...state, tool: 'ellipse'})} className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === 'ellipse' ? 'bg-primary text-primary-foreground font-medium' : ''}`}>
                                          <Circle size={14} /> <span>Ellipse (Shift+U)</span>
                                        </button>
                                    </PopoverClose>
                                    <PopoverClose asChild>
                                        <button onClick={() => updateState({...state, tool: 'filled-ellipse'})} className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === 'filled-ellipse' ? 'bg-primary text-primary-foreground font-medium' : ''}`}>
                                          <div className="w-3.5 h-3.5 bg-current rounded-full"></div> <span>Filled Ell (Shift+U)</span>
                                        </button>
                                    </PopoverClose>
                                  </PopoverContent>
                                </Popover>

                                <ToolButton active={state.tool === 'bucket'} onClick={() => updateState({...state, tool: 'bucket'})} icon={<PaintBucket size={18} />} label="Fill (G)" />
                                <ToolButton active={state.tool === 'eyedropper'} onClick={() => updateState({...state, tool: 'eyedropper'})} icon={<Pipette size={18} />} label="Picker (I)" />

                                <ToolButton active={state.tool === 'smudge'} onClick={() => updateState({...state, tool: 'smudge'})} icon={<Hand size={18} />} label="Smudge/Push (S)" />
                                <Popover>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                                <button 
                                                    className={`p-1.5 rounded-sm transition-all relative group flex items-center justify-center ${['blur', 'sharpen'].includes(state.tool) ? 'bg-primary text-primary-foreground shadow-inner' : 'text-muted-foreground hover:bg-accent'}`}
                                                    onClick={() => { if (!['blur', 'sharpen'].includes(state.tool)) updateState({...state, tool: lastEffectTool}); }}
                                                >
                                                    {React.cloneElement(getToolIcon(lastEffectTool) as React.ReactElement, { size: 18 })}
                                                    <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-current opacity-50 rounded-tl-sm clip-path-triangle"></div>
                                                </button>
                                            </PopoverTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" sideOffset={12}>Effect Brushes (R)</TooltipContent>
                                    </Tooltip>
                                    <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-40 p-1.5 shadow-xl bg-card border border-border rounded-lg text-foreground">
                                        <PopoverClose asChild>
                                            <button onClick={() => updateState({...state, tool: 'blur'})} className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === 'blur' ? 'bg-primary text-primary-foreground font-medium' : ''}`}>
                                                <Droplets size={14} /> <span>Blur (R)</span>
                                            </button>
                                        </PopoverClose>
                                        <PopoverClose asChild>
                                            <button onClick={() => updateState({...state, tool: 'sharpen'})} className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === 'sharpen' ? 'bg-primary text-primary-foreground font-medium' : ''}`}>
                                                <Zap size={14} /> <span>Sharpen (Shift+R)</span>
                                            </button>
                                        </PopoverClose>
                                    </PopoverContent>
                                </Popover>

                                <div className="w-full h-[1px] bg-border my-1"></div>

                                <ToolButton active={state.tool === 'move'} onClick={() => updateState({...state, tool: 'move'})} icon={<MousePointer2 size={18} />} label="Move (V)" />
                                <Popover>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <button 
                                          className={`p-1.5 rounded-sm transition-all relative group flex items-center justify-center ${SELECTION_TOOLS.includes(state.tool) ? 'bg-primary text-primary-foreground shadow-inner' : 'text-muted-foreground hover:bg-accent'}`}
                                          onClick={(e) => { if (!SELECTION_TOOLS.includes(state.tool)) updateState({...state, tool: lastSelectionTool}); }}
                                        >
                                          {React.cloneElement(getToolIcon(lastSelectionTool) as React.ReactElement, { size: 18 })}
                                          <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-current opacity-50 rounded-tl-sm clip-path-triangle"></div>
                                        </button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={12}>Selection Tools</TooltipContent>
                                  </Tooltip>
                                  <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-48 p-1.5 shadow-xl bg-card border border-border rounded-lg text-foreground">
                                    {SELECTION_TOOLS.map(t => (
                                        <PopoverClose key={t} asChild>
                                          <button 
                                            onClick={() => updateState({...state, tool: t})}
                                            className={`flex items-center gap-2 p-1.5 rounded hover:bg-accent text-foreground text-xs text-left w-full transition-colors ${state.tool === t ? 'bg-primary text-primary-foreground font-medium' : ''}`}
                                          >
                                            {React.cloneElement(getToolIcon(t) as React.ReactElement, { size: 14 })}
                                            <span className="capitalize">{t.replace('-select', '').replace('poly-', 'Poly ').replace('-', ' ')} Select</span>
                                          </button>
                                        </PopoverClose>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                            </div>

                            <div className="flex-1"></div>

                            {/* Selected Colors */}
                            <div className="relative w-10 h-10 mb-2 shrink-0">
                                {/* Secondary */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button 
                                            className="absolute bottom-0 right-0 w-6 h-6 rounded-sm border border-border overflow-hidden"
                                            style={{ backgroundColor: state.secondaryColor }}
                                        />
                                    </PopoverTrigger>
                                    <PopoverContent side="right" align="end" sideOffset={10} className="p-0 border-none bg-transparent shadow-none">
                                        <ColorPicker color={state.secondaryColor} onChange={(c) => updateState({...state, secondaryColor: c})} />
                                    </PopoverContent>
                                </Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="absolute bottom-0 right-0 w-6 h-6 rounded-sm pointer-events-none"></div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right">Secondary Color</TooltipContent>
                                </Tooltip>
                                
                                {/* Primary */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button 
                                            className="absolute top-0 left-0 w-6 h-6 rounded-sm border border-border overflow-hidden z-10"
                                            style={{ backgroundColor: state.primaryColor }}
                                        />
                                    </PopoverTrigger>
                                    <PopoverContent side="right" align="end" sideOffset={10} className="p-0 border-none bg-transparent shadow-none">
                                        <ColorPicker color={state.primaryColor} onChange={(c) => updateState({...state, primaryColor: c})} />
                                    </PopoverContent>
                                </Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="absolute top-0 left-0 w-6 h-6 rounded-sm pointer-events-none z-10"></div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right">Primary Color</TooltipContent>
                                </Tooltip>

                                {/* Swap Button */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button 
                                        onClick={() => {
                                            const p = state.primaryColor;
                                            updateState({...state, primaryColor: state.secondaryColor, secondaryColor: p});
                                            if (state.inkType === 'shading') {
                                                updateState({...state, primaryColor: state.secondaryColor, secondaryColor: p, shades: [...state.shades].reverse()});
                                            }
                                        }}
                                        className="absolute top-0 right-0 w-4 h-4 bg-card rounded-bl-sm border-b border-l border-border flex items-center justify-center text-muted-foreground hover:text-foreground z-20"
                                    >
                                        <ArrowRightLeft size={8} className="rotate-45" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right">Swap Colors (X)</TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </Allotment.Pane>

                    {/* Central Canvas Zone */}
                    <Allotment.Pane priority={10 as any}>
                        <div className="w-full h-full flex flex-col relative bg-[oklch(0.145_0_0)] min-w-0 overflow-hidden">
                            <Canvas 
                              state={state}
                              onDrawStart={(pos) => { setDragStartPos(pos); canvasTools.handleDrawStart(pos, { shift: false, ctrl: false, alt: false, meta: false }); }}
                              onDraw={canvasTools.handleDraw}
                              onDrawEnd={() => { setDragStartPos(null); canvasTools.handleDrawEnd(); }}
                              onSelectionUpdate={(sel) => updateState({...state, selection: sel}, { action: 'Select Area', tool: state.tool })}
                              onMovePixels={canvasTools.handleMovePixels}
                              onRotatePixels={canvasTools.handleRotatePixels}
                              onScalePixels={onScalePixels}
                              onZoom={(z) => updateState({...state, zoom: z})}
                              onMousePosUpdate={setMousePos}
                            />
                        </div>
                    </Allotment.Pane>

                    {/* Right Slot containing modular tabs like layers / history */}
                    <Allotment.Pane 
                      visible={slots.right.visible && slots.right.groups.some((g: any) => g.panes.length > 0)} 
                      preferredSize={slots.right.size || 250} 
                      minSize={120} 
                      priority={1 as any}
                    >
                      {renderSlotContainer('right')}
                    </Allotment.Pane>
                  </Allotment>
                </Allotment.Pane>
                
                {/* Bottom Slot containing modular tabs like timeline */}
                <Allotment.Pane 
                  visible={slots.bottom.visible && slots.bottom.groups.some((g: any) => g.panes.length > 0)} 
                  preferredSize={slots.bottom.size || 200} 
                  minSize={100} 
                  maxSize={400} 
                  priority={3 as any}
                >
                  {renderSlotContainer('bottom')}
                </Allotment.Pane>
              </Allotment>
            </div>
          </>
        )}

        {shouldShowFloatingPreview && !isHome && (
            <Preview width={0} state={state} onClose={() => setShowPreview(false)} />
        )}

        {tabContextMenu && (
          <div 
            className="fixed inset-0 z-[100] bg-transparent"
            onClick={() => setTabContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setTabContextMenu(null); }}
          >
            <div 
              className="fixed z-[101] min-w-[170px] bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-md p-1 text-xs text-foreground animate-in fade-in-50 zoom-in-95"
              style={{
                left: Math.min(tabContextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 180 : tabContextMenu.x),
                top: Math.min(tabContextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 260 : tabContextMenu.y)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 mb-1 flex items-center justify-between select-none">
                <span>{PANE_METADATA[tabContextMenu.paneId]?.title || tabContextMenu.paneId}</span>
              </div>

              <button
                onClick={() => {
                  handleClosePane(tabContextMenu.paneId);
                  setTabContextMenu(null);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
              >
                <X size={13} className="text-muted-foreground" />
                <span>Close Tab</span>
              </button>

              {tabContextMenu.slotId !== 'floating' && (
                <>
                  {tabContextMenu.groupId && (
                    <button
                      onClick={() => {
                        handleCloseOtherPanesInGroup(tabContextMenu.slotId as 'left' | 'right' | 'bottom', tabContextMenu.groupId!, tabContextMenu.paneId);
                        setTabContextMenu(null);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                    >
                      <Minus size={13} className="text-muted-foreground" />
                      <span>Close Other Tabs</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      handleCloseAllPanesInSlot(tabContextMenu.slotId as 'left' | 'right' | 'bottom');
                      setTabContextMenu(null);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                  >
                    <X size={13} className="text-destructive" />
                    <span className="text-destructive">Close All Tabs in Dock</span>
                  </button>

                  <div className="h-[1px] bg-border/40 my-1" />

                  {tabContextMenu.groupId && (
                    <>
                      <button
                        onClick={() => {
                          splitGroup(tabContextMenu.slotId as 'left' | 'right' | 'bottom', tabContextMenu.groupId!, tabContextMenu.paneId, 'vertical');
                          setTabContextMenu(null);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                      >
                        <FlipVertical size={13} className="text-muted-foreground" />
                        <span>Split Down</span>
                      </button>

                      <button
                        onClick={() => {
                          splitGroup(tabContextMenu.slotId as 'left' | 'right' | 'bottom', tabContextMenu.groupId!, tabContextMenu.paneId, 'horizontal');
                          setTabContextMenu(null);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                      >
                        <FlipVertical size={13} className="text-muted-foreground rotate-90" />
                        <span>Split Right</span>
                      </button>
                    </>
                  )}

                  {slots[tabContextMenu.slotId]?.groups.length > 1 && (
                    <button
                      onClick={() => {
                        unsplitSlot(tabContextMenu.slotId as 'left' | 'right' | 'bottom');
                        setTabContextMenu(null);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                    >
                      <ArrowRightLeft size={13} className="text-muted-foreground" />
                      <span>Unsplit View</span>
                    </button>
                  )}

                  <div className="h-[1px] bg-border/40 my-1" />

                  <button
                    onClick={() => {
                      floatPane(
                        tabContextMenu.paneId,
                        tabContextMenu.slotId,
                        tabContextMenu.groupId,
                        Math.max(20, tabContextMenu.x - 100),
                        Math.max(20, tabContextMenu.y - 30)
                      );
                      setTabContextMenu(null);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                  >
                    <Move size={13} className="text-muted-foreground" />
                    <span>Float Window</span>
                  </button>

                  {(['left', 'right', 'bottom'] as const).filter(s => s !== tabContextMenu.slotId).map(targetSlot => (
                    <button
                      key={targetSlot}
                      onClick={() => {
                        handleAddPaneToSlot(targetSlot, tabContextMenu.paneId);
                        setTabContextMenu(null);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                    >
                      <Move size={13} className="text-muted-foreground" />
                      <span>Move to {targetSlot.charAt(0).toUpperCase() + targetSlot.slice(1)} Dock</span>
                    </button>
                  ))}
                </>
              )}

              {tabContextMenu.slotId === 'floating' && (
                <>
                  <div className="h-[1px] bg-border/40 my-1" />
                  {(['left', 'right', 'bottom'] as const).map(targetSlot => (
                    <button
                      key={targetSlot}
                      onClick={() => {
                        handleAddPaneToSlot(targetSlot, tabContextMenu.paneId);
                        setTabContextMenu(null);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground flex items-center space-x-2 transition-colors select-none"
                    >
                      <Move size={13} className="text-muted-foreground" />
                      <span>Dock to {targetSlot.charAt(0).toUpperCase() + targetSlot.slice(1)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        <StatusBar state={state} isHome={isHome} mousePos={mousePos} dragStartPos={dragStartPos} statusMessage={statusMessage} selectionSize={selectionSize} />
    </div>
  );
};
