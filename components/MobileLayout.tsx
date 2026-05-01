
import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { ProjectState, ToolType, Command, Position } from '../types';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { LayersPanel } from './LayersPanel';
import { Timeline } from './Timeline';
import { Preview } from './Preview';
import { ColorPicker } from './ColorPicker';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';
import { 
  Menu, Undo, Redo, Share, Plus,
  Pencil, Eraser, PaintBucket, Pipette, MousePointer2,
  Layers, Clock, X, ChevronRight,
  BoxSelect, Square, Circle, Minus, Lasso,
  Check, Play, Droplets, Zap,
  Grid, Eye, Hand, FlipHorizontal, FlipVertical,
  Settings, Waves, ChevronUp, ChevronDown, Wand2,
  Sparkles, ArrowRightLeft, Palette as PaletteIcon
} from './Icons';
import { SELECTION_TOOLS } from '../constants';
import { CustomSlider } from './ui/slider';

interface MobileLayoutProps {
  state: ProjectState;
  updateState: (s: ProjectState, config?: any) => void;
  commands: Command[];
  project: any; 
  canvasTools: any;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  statusMessage: { text: string; type: 'info' | 'error' | 'success' };
  mousePos: Position | null;
  dragStartPos: Position | null;
  selectionSize: { w: number, h: number } | null;
  setMousePos: (pos: Position | null) => void;
  setDragStartPos: (pos: Position | null) => void;
  onScalePixels: (selection: Set<number>, srcBox: any, QUEEN_BOX: any) => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  state,
  updateState,
  commands,
  project,
  canvasTools,
  fileInputRef,
  handleFileChange,
  statusMessage,
  setMousePos,
  setDragStartPos,
  onScalePixels
}) => {
  const [activePanel, setActivePanel] = useState<'palette' | 'layers' | 'timeline' | 'menu' | 'preview' | 'settings' | null>(null);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const tools: { id: ToolType, icon: React.ReactNode, label: string }[] = [
    { id: 'pencil', icon: <Pencil size={22} />, label: 'Pencil' },
    { id: 'smudge', icon: <Hand size={22} />, label: 'Smudge' },
    { id: 'eraser', icon: <Eraser size={22} />, label: 'Eraser' },
    { id: 'blur', icon: <Droplets size={22} />, label: 'Blur' },
    { id: 'sharpen', icon: <Zap size={22} />, label: 'Sharpen' },
    { id: 'bucket', icon: <PaintBucket size={22} />, label: 'Fill' },
    { id: 'eyedropper', icon: <Pipette size={22} />, label: 'Picker' },
    { id: 'move', icon: <MousePointer2 size={22} />, label: 'Move' },
    { id: 'rect', icon: <Square size={22} />, label: 'Rect' },
    { id: 'ellipse', icon: <Circle size={22} />, label: 'Ellipse' },
    { id: 'line', icon: <Minus className="-rotate-45" size={22} />, label: 'Line' },
    { id: 'rect-select', icon: <BoxSelect size={22} />, label: 'Sel Rect' },
    { id: 'lasso-select', icon: <Lasso size={22} />, label: 'Sel Lasso' },
    { id: 'magic-wand', icon: <Wand2 size={22} />, label: 'Wand' },
  ];

  const closePanel = () => setActivePanel(null);

  const isBrushTool = ['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'blur', 'sharpen'].includes(state.tool);
  const isFillTool = state.tool === 'bucket';
  const isMagicWand = state.tool === 'magic-wand';
  const isSelectionTool = SELECTION_TOOLS.includes(state.tool);
  const isMoveTool = state.tool === 'move';

  const hasAnySettings = isBrushTool || isFillTool || isSelectionTool || isMoveTool;

  const toggleSymmetryX = () => updateState({...state, symmetry: { ...state.symmetry, x: !state.symmetry.x }});
  const toggleSymmetryY = () => updateState({...state, symmetry: { ...state.symmetry, y: !state.symmetry.y }});

  const getSettingsSummary = () => {
    if (isBrushTool) return `${state.brushSize}px • ${state.brushShape}`;
    if (isFillTool) return state.fillContiguous ? 'Contiguous' : 'Global';
    if (isSelectionTool) return state.selectionMode.toUpperCase();
    if (isMoveTool) return state.rotationAlgorithm === 'rotsprite' ? 'RotSprite' : 'Nearest';
    return '';
  };

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden touch-none">
      <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".json,.png,.jpg,.jpeg,.gif" 
          onChange={handleFileChange} 
      />

      {/* Top Bar: Minimal Status & Global Actions */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-2 z-20 pointer-events-none safe-top">
        <div className="pointer-events-auto flex items-center gap-2">
           <button 
            onClick={() => setActivePanel('menu')} 
            className="w-10 h-10 bg-card/90 backdrop-blur-md border border-border/30 rounded-full flex items-center justify-center shadow-lg text-foreground active:scale-90 transition-transform"
            aria-label="Menu"
           >
             <Menu size={20} />
           </button>
           <div className="flex gap-1 bg-card/90 backdrop-blur-md border border-border/30 rounded-full p-1 shadow-lg">
             <button 
                onClick={() => commands.find(c => c.id === 'edit.undo')?.perform()} 
                className="p-2 text-foreground hover:text-primary active:scale-75 transition-transform"
                title="Undo"
                aria-label="Undo"
             >
               <Undo size={18} />
             </button>
             <button 
                onClick={() => commands.find(c => c.id === 'edit.redo')?.perform()} 
                className="p-2 text-foreground hover:text-primary active:scale-75 transition-transform"
                title="Redo"
                aria-label="Redo"
             >
               <Redo size={18} />
             </button>
           </div>
        </div>
        
        <div className="pointer-events-auto flex items-center gap-2">
           <div className="flex gap-1 bg-card/90 backdrop-blur-md border border-border/40 rounded-full p-1 shadow-lg mr-1">
                <button 
                    onClick={() => updateState({...state, showGrid: !state.showGrid})}
                    className={`p-2 rounded-full transition-colors ${state.showGrid ? 'text-primary' : 'text-muted-foreground'}`}
                    aria-label="Toggle Grid"
                >
                    <Grid size={16} />
                </button>
                <button 
                    onClick={() => updateState({...state, onionSkin: !state.onionSkin})}
                    className={`p-2 rounded-full transition-colors ${state.onionSkin ? 'text-primary' : 'text-muted-foreground'}`}
                    aria-label="Toggle Onion Skin"
                >
                    <Eye size={16} />
                </button>
           </div>
           <button 
            onClick={() => setActivePanel('preview')} 
            className="w-10 h-10 bg-secondary/90 backdrop-blur-md text-foreground border border-border/30 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            aria-label="Preview"
           >
             <Play size={18} fill="currentColor" />
           </button>
        </div>
      </div>

      {/* Main Drawing Area */}
      <div className="absolute inset-0 z-0 flex flex-col">
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

      {/* Bottom Interface Container */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col pointer-events-none pb-safe">
        
        {/* Contextual Tool Settings Strip (Above Bottom Bar) */}
        <div className="pointer-events-auto px-4 mb-2 flex flex-col items-center gap-2">
            
            {/* Expanded Tool Settings Area */}
            {(isSettingsExpanded && hasAnySettings) && (
                <div className="w-full max-w-sm bg-card/95 backdrop-blur-xl border border-border/30 rounded-2xl shadow-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tool Settings</span>
                        <button onClick={() => setIsSettingsExpanded(false)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronDown size={18}/></button>
                    </div>

                    {isBrushTool && (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Brush Size</span>
                                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{state.brushSize}px</span>
                                </div>
                                <CustomSlider
                                    min={1} 
                                    max={32} 
                                    value={state.brushSize} 
                                    onValueChange={(val) => updateState({...state, brushSize: val})}
                                    className="w-full"
                                />
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Shape</span>
                                    <div className="flex bg-muted rounded-lg p-1">
                                        <button onClick={() => updateState({...state, brushShape: 'square'})} className={`flex-1 flex justify-center py-2 rounded-md ${state.brushShape === 'square' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}><Square size={18} /></button>
                                        <button onClick={() => updateState({...state, brushShape: 'circle'})} className={`flex-1 flex justify-center py-2 rounded-md ${state.brushShape === 'circle' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}><Circle size={18} /></button>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Symmetry</span>
                                    <div className="flex bg-muted rounded-lg p-1">
                                        <button onClick={toggleSymmetryX} className={`flex-1 flex justify-center py-2 rounded-md ${state.symmetry.x ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}><FlipHorizontal size={18} /></button>
                                        <button onClick={toggleSymmetryY} className={`flex-1 flex justify-center py-2 rounded-md ${state.symmetry.y ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}><FlipVertical size={18} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => updateState({...state, inkType: state.inkType === 'shading' ? 'simple' : 'shading'})}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${state.inkType === 'shading' ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-transparent text-muted-foreground'}`}
                                >
                                    <Droplets size={16} /> {state.inkType === 'shading' ? 'SHADING ON' : 'SIMPLE INK'}
                                </button>
                                {state.tool === 'pencil' && (
                                    <button 
                                        onClick={() => updateState({...state, pixelPerfect: !state.pixelPerfect})}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${state.pixelPerfect ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-transparent text-muted-foreground'}`}
                                    >
                                        <Zap size={16} /> PIXEL PERFECT
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {(isFillTool || isMagicWand) && (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Fill Mode</span>
                                <button 
                                    onClick={() => updateState({...state, fillContiguous: !state.fillContiguous})}
                                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${state.fillContiguous ? 'bg-primary border-primary text-primary-foreground shadow-lg' : 'bg-muted border-transparent text-muted-foreground'}`}
                                >
                                    <Check size={16} /> {state.fillContiguous ? 'CONTIGUOUS' : 'GLOBAL (ALL PIXELS)'}
                                </button>
                            </div>
                        </div>
                    )}

                    {isMoveTool && (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Rotation Method</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => updateState({...state, rotationAlgorithm: 'nearest'})}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${state.rotationAlgorithm === 'nearest' ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-transparent text-muted-foreground'}`}
                                    >
                                        NEAREST
                                    </button>
                                    <button 
                                        onClick={() => updateState({...state, rotationAlgorithm: 'rotsprite'})}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${state.rotationAlgorithm === 'rotsprite' ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-transparent text-muted-foreground'}`}
                                    >
                                        <Sparkles size={14} /> ROTSPRITE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isSelectionTool && (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Selection Mode</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { mode: 'replace', label: 'NEW', icon: <Square size={14}/> },
                                        { mode: 'add', label: 'ADD', icon: <Plus size={14}/> },
                                        { mode: 'subtract', label: 'SUBTRACT', icon: <Minus size={14}/> },
                                        { mode: 'intersect', label: 'INTERSECT', icon: <Waves size={14}/> }
                                    ].map(m => (
                                        <button 
                                            key={m.mode} 
                                            onClick={() => updateState({...state, selectionMode: m.mode as any})} 
                                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[10px] font-bold transition-all ${state.selectionMode === m.mode ? 'bg-primary border-primary text-primary-foreground shadow-lg' : 'bg-muted border-transparent text-muted-foreground'}`}
                                        >
                                            {m.icon} {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Compact Tool Settings Bubble */}
            {!isSettingsExpanded && hasAnySettings && (
                <button 
                    onClick={() => setIsSettingsExpanded(true)}
                    className="flex items-center gap-3 px-4 py-2 bg-card/90 backdrop-blur-xl border border-border/30 rounded-full shadow-lg text-xs font-bold text-foreground active:scale-95 transition-all animate-in slide-in-from-bottom-2"
                >
                    <Settings size={14} className="text-primary" />
                    <span>{getSettingsSummary()}</span>
                    <ChevronUp size={14} className="text-muted-foreground ml-1" />
                </button>
            )}
        </div>

        {/* Bottom Bar: Color, Tools, Panels */}
        <div className="bg-card/95 backdrop-blur-2xl border-t border-border/30 pointer-events-auto">
            {/* Visual Status Indicator */}
            <div className="h-5 flex items-center justify-center bg-background/30 text-[9px] text-muted-foreground/60 border-b border-border grayscale-[0.5] uppercase tracking-widest font-bold">
                {statusMessage.text || `${state.width}×${state.height} • ${state.tool}`}
            </div>
            
            <div className="h-16 flex items-center px-4 gap-3">
                {/* Active Color Preview */}
                <div className="relative shrink-0 flex items-center justify-center w-12 h-12">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button 
                                className="absolute inset-0 group active:scale-90 transition-transform z-10"
                                aria-label="Primary Color"
                            >
                                <div className="w-11 h-11 rounded-2xl border-2 border-border shadow-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: state.primaryColor }}>
                                    {state.inkType === 'shading' && <Droplets size={16} className="text-white/40 mix-blend-difference" />}
                                </div>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="start" sideOffset={10} className="p-0 border-none bg-transparent shadow-none">
                            <ColorPicker color={state.primaryColor} onChange={(c) => updateState({...state, primaryColor: c})} />
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <button 
                                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-card shadow-lg z-0" 
                                style={{ backgroundColor: state.secondaryColor }} 
                                aria-label="Secondary Color"
                            />
                        </PopoverTrigger>
                        <PopoverContent side="top" align="start" sideOffset={10} className="p-0 border-none bg-transparent shadow-none">
                            <ColorPicker color={state.secondaryColor} onChange={(c) => updateState({...state, secondaryColor: c})} />
                        </PopoverContent>
                    </Popover>

                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            const p = state.primaryColor;
                            updateState({...state, primaryColor: state.secondaryColor, secondaryColor: p});
                            if (state.inkType === 'shading') {
                                updateState({...state, primaryColor: state.secondaryColor, secondaryColor: p, shades: [...state.shades].reverse()});
                            }
                        }}
                        className="absolute -bottom-2 -right-2 w-6 h-6 bg-card rounded-full border border-border/20 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm z-20 active:scale-90 transition-transform"
                        title="Swap Colors (X)"
                    >
                        <ArrowRightLeft size={10} className="rotate-45" />
                    </button>
                </div>

                <div className="w-[1px] h-8 bg-border/60 mx-1 shrink-0"></div>
                
                {/* Scrollable Tool Strip */}
                <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth h-full mask-fade-edges">
                    <div className="flex items-center gap-3 h-full">
                        {tools.map(tool => (
                            <button 
                                key={tool.id} 
                                onClick={() => updateState({ ...state, tool: tool.id })} 
                                className={`shrink-0 flex items-center justify-center min-w-[36px] h-[26px] rounded-md transition-all ${state.tool === tool.id ? 'bg-primary text-primary-foreground shadow-inner' : 'text-muted-foreground hover:bg-accent active:scale-95'}`}
                                aria-label={`Select ${tool.label} Tool`}
                            >
                                {React.cloneElement(tool.icon as React.ReactElement, { size: 16 })}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-[1px] h-8 bg-border/60 mx-1 shrink-0"></div>

                {/* Bottom Panel Toggles */}
                <div className="flex items-center gap-1 shrink-0">
                    <button 
                        onClick={() => setActivePanel('palette')} 
                        className={`p-2.5 rounded-2xl active:scale-90 transition-all ${activePanel === 'palette' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                        aria-label="Palette Panel"
                    >
                        <PaletteIcon size={22} />
                    </button>
                    <button 
                        onClick={() => setActivePanel('layers')} 
                        className={`p-2.5 rounded-2xl active:scale-90 transition-all ${activePanel === 'layers' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                        aria-label="Layers Panel"
                    >
                        <Layers size={22} />
                    </button>
                    <button 
                        onClick={() => setActivePanel('timeline')} 
                        className={`p-2.5 rounded-2xl active:scale-90 transition-all ${activePanel === 'timeline' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                        aria-label="Timeline Panel"
                    >
                        <Clock size={22} />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Full-Screen Panels (Bottom Sheets) */}
      <Drawer.Root open={!!activePanel} onOpenChange={(open) => !open && closePanel()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-card border-t border-border/30 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden outline-none">
              <div className="h-16 flex items-center justify-between px-3 shrink-0">
                <Drawer.Title className="font-bold text-foreground text-xs uppercase tracking-[0.2em]">{activePanel}</Drawer.Title>
                <button onClick={closePanel} className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded-full text-muted-foreground active:scale-75 transition-transform border border-border/30">
                    <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 relative pb-safe-bottom pt-2">
                  <Drawer.Description className="sr-only">
                    {activePanel} settings and options
                  </Drawer.Description>
                  {activePanel === 'palette' && (
                          <div className="h-[450px]">
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
                          </div>
                      )}
                      {activePanel === 'layers' && (
                          <div className="h-[400px]">
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
                              />
                          </div>
                      )}
                      {activePanel === 'timeline' && (
                          <div className="h-[400px]">
                              <Timeline 
                                state={state} 
                                onSelectFrames={(indices, active) => updateState({...state, selectedFrameIndices: indices, activeFrameIndex: active})}
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
                          </div>
                      )}
                      {activePanel === 'preview' && ( 
                        <div className="h-[450px] flex flex-col bg-card overflow-hidden">
                            <Preview state={state} width={0} isFloating={false} />
                        </div> 
                      )}
                      {activePanel === 'menu' && (
                          <div className="p-4 flex flex-col gap-6">
                             <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { project.createProject(); closePanel(); }} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/5 border border-border/40 active:bg-secondary/20 text-left transition-colors">
                                    <Plus size={20} className="text-muted-foreground/60" />
                                    <span className="text-xs font-medium">New Canvas</span>
                                </button>
                                <button onClick={() => { fileInputRef.current?.click(); closePanel(); }} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/5 border border-border/40 active:bg-secondary/20 text-left transition-colors">
                                    <Hand size={20} className="text-muted-foreground/60" />
                                    <span className="text-xs font-medium">Open Local</span>
                                </button>
                                <button onClick={() => { project.saveProject(); closePanel(); }} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/5 border border-border/40 active:bg-secondary/20 text-left transition-colors">
                                    <Check size={20} className="text-muted-foreground/60" />
                                    <span className="text-xs font-medium">Save Pixel</span>
                                </button>
                                <button onClick={() => { project.downloadImage(); closePanel(); }} className="flex items-center gap-3 p-3 rounded-xl bg-primary text-primary-foreground shadow-sm active:opacity-90 text-left">
                                    <Share size={20} />
                                    <span className="text-xs font-medium">Export PNG</span>
                                </button>
                             </div>
                             
                             <div className="flex flex-col gap-3">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Recent Works</div>
                                <div className="flex flex-col gap-1">
                                    {project.recentProjects.length === 0 ? ( 
                                        <div className="p-8 border border-dashed border-border rounded-xl text-center text-muted-foreground/40 text-xs">
                                            No recent projects
                                        </div> 
                                    ) : (
                                        project.recentProjects.map((p: any) => (
                                            <button 
                                              key={p.id} 
                                              onClick={() => { project.loadRecentProject(p); closePanel(); }} 
                                              className="w-full p-3 text-left rounded-xl hover:bg-secondary/10 active:bg-secondary/20 transition-colors flex items-center justify-between group border border-border/40"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="text-sm font-medium">{p.title}</div>
                                                    <div className="text-[10px] text-muted-foreground/60 font-mono">
                                                      {p.width}x{p.height} • {new Date(p.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                             </div>
                          </div>
                      )}
                  </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
};
