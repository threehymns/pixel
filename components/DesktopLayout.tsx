
import React, { useState, useEffect } from 'react';
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
  Waves, FlipHorizontal, FlipVertical, Hand, ChevronDown, ArrowRightLeft
} from './Icons';
import { PlaySquare } from 'lucide-react';
import { CustomSlider } from './ui/slider';
import { CustomCheckbox } from './ui/checkbox';
import { SELECTION_TOOLS } from '../constants';

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
}

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
  selectionSize
}) => {
  const [showFileTree, setShowFileTree] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [lastSelectionTool, setLastSelectionTool] = useState<ToolType>('rect-select');
  const [lastShapeTool, setLastShapeTool] = useState<ToolType>('rect');
  const [lastEffectTool, setLastEffectTool] = useState<ToolType>('blur');

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
          accept=".json,.png,.jpg,.jpeg,.gif" 
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
            <div className="h-10 bg-secondary/50 border-b border-background flex items-center px-2 space-x-2 text-xs shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-1 border-r border-input pr-2 shrink-0">
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
                          <div className="flex gap-0.5 bg-background p-0.5 rounded border border-input min-w-[100px] h-6 items-center">
                              {state.shades.map((color, idx) => (
                                  <div 
                                    key={idx} 
                                    draggable
                                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', idx.toString()); }}
                                    onDragOver={(e) => { e.preventDefault(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                                        if (!isNaN(fromIdx) && fromIdx !== idx) {
                                            const newShades = [...state.shades];
                                            const [moved] = newShades.splice(fromIdx, 1);
                                            newShades.splice(idx, 0, moved);
                                            updateState({...state, shades: newShades});
                                        }
                                    }}
                                    className="w-4 h-full relative group cursor-grab active:cursor-grabbing border border-black/20"
                                    style={{ backgroundColor: color }}
                                    title={`Step ${idx + 1}: ${color}`}
                                  >
                                      <button 
                                        onClick={() => removeShade(idx)}
                                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all z-10"
                                      >
                                          <X size={8} />
                                      </button>
                                  </div>
                              ))}
                              {state.shades.length < 16 && (
                                  <button 
                                    onClick={() => addShade(state.primaryColor)}
                                    className="w-4 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border ml-0.5"
                                    title="Add Primary Color to Shade"
                                  >
                                      <Plus size={10} />
                                  </button>
                              )}
                          </div>
                          <Popover>
                              <PopoverTrigger asChild>
                                  <button className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors">
                                      <ChevronDown size={12} />
                                  </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-32 p-1 flex flex-col gap-0.5 shadow-xl bg-card border-border rounded-lg">
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

              <div className="flex items-center space-x-1 pl-2 border-l border-input shrink-0">
                  <ToolButton active={showPreview} onClick={() => setShowPreview(!showPreview)} icon={<PlaySquare size={16} />} label="Toggle Preview" />
                  <ToolButton active={state.showGrid} onClick={() => updateState({...state, showGrid: !state.showGrid})} icon={<Grid size={16} />} label="Toggle Grid" />
                  <ToolButton active={state.onionSkin} onClick={() => updateState({...state, onionSkin: !state.onionSkin})} icon={<Eye size={16} />} label="Onion Skin" />
                  <ToolButton active={false} onClick={project.downloadImage} icon={<Download size={16} />} label="Export Frame" />
              </div>
            </div>

            <div className="flex-1 min-h-0 relative">
              <Allotment vertical>
                <Allotment.Pane>
                  <Allotment>
                    <Allotment.Pane visible={showFileTree} preferredSize={200} minSize={150} priority={1 as any}>
                        <FileTree 
                          rootHandle={fileSystem.rootHandle}
                          onOpenFolder={fileSystem.openFolder}
                          onFileOpen={project.loadProjectFromFile}
                          onResizeStart={() => {}} 
                          width={0} 
                        />
                     </Allotment.Pane>

                    <Allotment.Pane minSize={44} maxSize={44} priority={1 as any}>
                        <div className="w-full h-full bg-card border-r border-background flex flex-col items-center py-2 overflow-y-auto overflow-x-hidden z-50 shadow-lg scrollbar-hide">
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
                                  <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-40 p-1.5 shadow-xl bg-card border-border rounded-lg">
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
                                    <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-40 p-1.5 shadow-xl bg-card border-border rounded-lg">
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
                                  <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-48 p-1.5 shadow-xl bg-card border-border rounded-lg">
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
                                            className="absolute bottom-0 right-0 w-6 h-6 rounded-sm border border-[#3f3f3f] overflow-hidden"
                                            style={{ backgroundColor: state.secondaryColor }}
                                            title="Secondary Color"
                                        />
                                    </PopoverTrigger>
                                    <PopoverContent side="right" align="end" sideOffset={10} className="p-0 border-none bg-transparent shadow-none">
                                        <ColorPicker color={state.secondaryColor} onChange={(c) => updateState({...state, secondaryColor: c})} />
                                    </PopoverContent>
                                </Popover>
                                
                                {/* Primary */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button 
                                            className="absolute top-0 left-0 w-6 h-6 rounded-sm border border-[#3f3f3f] overflow-hidden z-10"
                                            style={{ backgroundColor: state.primaryColor }}
                                            title="Primary Color"
                                        />
                                    </PopoverTrigger>
                                    <PopoverContent side="right" align="end" sideOffset={10} className="p-0 border-none bg-transparent shadow-none">
                                        <ColorPicker color={state.primaryColor} onChange={(c) => updateState({...state, primaryColor: c})} />
                                    </PopoverContent>
                                </Popover>

                                {/* Swap Button */}
                                <button 
                                    onClick={() => {
                                        const p = state.primaryColor;
                                        updateState({...state, primaryColor: state.secondaryColor, secondaryColor: p});
                                        if (state.inkType === 'shading') {
                                            updateState({...state, primaryColor: state.secondaryColor, secondaryColor: p, shades: [...state.shades].reverse()});
                                        }
                                    }}
                                    className="absolute top-0 right-0 w-4 h-4 bg-card rounded-bl-sm border-b border-l border-[#3f3f3f] flex items-center justify-center text-muted-foreground hover:text-foreground z-20"
                                    title="Swap Colors (X)"
                                >
                                    <ArrowRightLeft size={8} className="rotate-45" />
                                </button>
                            </div>
                        </div>
                    </Allotment.Pane>

                    <Allotment.Pane visible={showPalette} preferredSize={160} minSize={140} priority={1 as any}>
                        <Palette 
                          width={0} colors={state.palette} palettes={state.paletteLibrary} activePaletteId={state.activePaletteId}
                          primaryColor={state.primaryColor} secondaryColor={state.secondaryColor}
                          onColorSelect={(c, p) => p ? updateState({...state, primaryColor: c}) : updateState({...state, secondaryColor: c})}
                          onAddColor={(c) => {
                            const updatedLibrary = state.paletteLibrary.map(p => p.id === state.activePaletteId ? { ...p, colors: [...p.colors, c] } : p);
                            updateState({ ...state, paletteLibrary: updatedLibrary, palette: [...state.palette, c] });
                          }}
                          onSelectPalette={project.selectPalette} onImportPalette={project.importPalette} onResizeStart={() => {}} 
                          onColorsSelected={(selectedColors) => {
                              updateState({...state, shades: selectedColors, inkType: 'shading'});
                          }}
                        />
                    </Allotment.Pane>

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

                    <Allotment.Pane visible={showRightPanel} preferredSize={150} minSize={120} priority={1 as any}>
                      <div className="w-full h-full bg-card border-l border-background shadow-lg flex flex-col relative">
                        <div className="flex-1 flex flex-col min-h-0">
                          <LayersPanel 
                              state={state} onSelectLayers={(ids, active) => updateState({...state, selectedLayerIds: ids, activeLayerId: active})}
                              onUpdateLayer={project.updateLayer} onAddLayer={project.addLayer} onDuplicateLayer={project.duplicateLayer}
                              onDeleteLayer={project.deleteLayer} onDuplicateSelectedLayers={project.duplicateSelectedLayers}
                              onDeleteSelectedLayers={project.deleteSelectedLayers} onReorderLayers={project.reorderLayers}
                              className="flex-1 border-b border-background min-h-[150px]"
                          />
                          <HistoryPanel history={project.history} historyIndex={project.historyIndex} onJumpToHistory={project.jumpToHistory} className="flex-1 min-h-[100px]" />
                        </div>
                      </div>
                    </Allotment.Pane>
                  </Allotment>
                </Allotment.Pane>
                
                <Allotment.Pane visible={showTimeline} preferredSize={200} minSize={100} maxSize={400} priority={3 as any}>
                    <Timeline 
                      state={state} onSelectFrames={(indices, active) => updateState({...state, selectedFrameIndices: indices, activeFrameIndex: active})}
                      onAddFrame={project.addFrame} onDuplicateFrame={project.duplicateFrame} onDeleteFrame={project.deleteFrame}
                      onDuplicateSelectedFrames={project.duplicateSelectedFrames} onDeleteSelectedFrames={project.deleteSelectedFrames}
                      onInsertFrame={project.insertFrame}
                      onTweenFrames={project.tweenFrames} onSelectLayer={(id) => updateState({...state, activeLayerId: id, selectedLayerIds: [id]})}
                      onAddLayer={project.addLayer} onToggleLayerVisibility={(id) => updateState({...state, layers: state.layers.map(l => l.id===id?{...l, visible:!l.visible}:l)})}
                      onToggleLayerLock={(id) => updateState({...state, layers: state.layers.map(l => l.id===id?{...l, locked:!l.locked}:l)})}
                      onReorderLayers={project.reorderLayers} onReorderFrames={project.reorderFrames}
                    />
                </Allotment.Pane>
              </Allotment>
            </div>
          </>
        )}

        {showPreview && !isHome && (
            <Preview width={0} state={state} onClose={() => setShowPreview(false)} />
        )}

        <StatusBar state={state} isHome={isHome} mousePos={mousePos} dragStartPos={dragStartPos} statusMessage={statusMessage} selectionSize={selectionSize} />
    </div>
  );
};
