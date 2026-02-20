
import React, { useState } from 'react';
import { ProjectState, ToolType, Command, Position } from '../types';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { LayersPanel } from './LayersPanel';
import { Timeline } from './Timeline';
import { Preview } from './Preview';
import { 
  Menu, Undo, Redo, Share, Plus,
  Pencil, Eraser, PaintBucket, Pipette, MousePointer2,
  Layers, Clock, X, ChevronRight,
  BoxSelect, Square, Circle, Minus, Lasso,
  Check, Play, Droplets, Zap,
  Grid, Eye, Hand, FlipHorizontal, FlipVertical,
  Settings, Waves, ChevronUp, ChevronDown, Wand2,
  Sparkles
} from './Icons';
import { SELECTION_TOOLS } from '../constants';

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
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-3 z-20 pointer-events-none safe-top">
        <div className="pointer-events-auto flex items-center gap-2">
           <button 
            onClick={() => setActivePanel('menu')} 
            className="w-10 h-10 bg-card/90 backdrop-blur-md border border-border rounded-full flex items-center justify-center shadow-lg text-foreground active:scale-90 transition-transform"
            aria-label="Menu"
           >
             <Menu size={20} />
           </button>
           <div className="flex gap-1 bg-card/90 backdrop-blur-md border border-border rounded-full p-1 shadow-lg">
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
           <div className="flex gap-1 bg-card/90 backdrop-blur-md border border-border rounded-full p-1 shadow-lg mr-1">
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
            className="w-10 h-10 bg-secondary/90 backdrop-blur-md text-foreground border border-border rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
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
                <div className="w-full max-w-sm bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
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
                                <input 
                                    type="range" 
                                    min="1" max="32" 
                                    value={state.brushSize} 
                                    onChange={(e) => updateState({...state, brushSize: parseInt(e.target.value)})}
                                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
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
                    className="flex items-center gap-3 px-4 py-2 bg-card/90 backdrop-blur-xl border border-border rounded-full shadow-lg text-xs font-bold text-foreground active:scale-95 transition-all animate-in slide-in-from-bottom-2"
                >
                    <Settings size={14} className="text-primary" />
                    <span>{getSettingsSummary()}</span>
                    <ChevronUp size={14} className="text-muted-foreground ml-1" />
                </button>
            )}
        </div>

        {/* Bottom Bar: Color, Tools, Panels */}
        <div className="bg-card/95 backdrop-blur-2xl border-t border-border pointer-events-auto">
            {/* Visual Status Indicator */}
            <div className="h-5 flex items-center justify-center bg-background/30 text-[9px] text-muted-foreground/60 border-b border-border/50 uppercase tracking-widest font-bold">
                {statusMessage.text || `${state.width}×${state.height} • ${state.tool}`}
            </div>
            
            <div className="h-16 flex items-center px-4 gap-3">
                {/* Active Color Preview */}
                <button 
                    onClick={() => setActivePanel('palette')} 
                    className="group relative shrink-0 active:scale-90 transition-transform"
                    aria-label="Active Color Palette"
                >
                    <div className="w-11 h-11 rounded-2xl border-2 border-white shadow-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: state.primaryColor }}>
                        {state.inkType === 'shading' && <Droplets size={16} className="text-white/40 mix-blend-difference" />}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-card shadow-lg bg-secondary" style={{ backgroundColor: state.secondaryColor }} />
                </button>

                <div className="w-[1px] h-8 bg-border/60 mx-1 shrink-0"></div>
                
                {/* Scrollable Tool Strip */}
                <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth h-full mask-fade-edges">
                    {tools.map(tool => (
                        <button 
                            key={tool.id} 
                            onClick={() => updateState({ ...state, tool: tool.id })} 
                            className={`shrink-0 flex flex-col items-center justify-center gap-1 min-w-[48px] h-full transition-all ${state.tool === tool.id ? 'text-primary scale-110' : 'text-muted-foreground/70 active:scale-90'}`}
                            aria-label={`Select ${tool.label} Tool`}
                        >
                            <div className={`p-2.5 rounded-2xl transition-all ${state.tool === tool.id ? 'bg-primary/10 shadow-inner' : 'bg-transparent'}`}>
                                {tool.icon}
                            </div>
                            <span className={`text-[8px] font-bold uppercase tracking-tight ${state.tool === tool.id ? 'opacity-100' : 'opacity-0'}`}>{tool.label}</span>
                        </button>
                    ))}
                </div>

                <div className="w-[1px] h-8 bg-border/60 mx-1 shrink-0"></div>

                {/* Bottom Panel Toggles */}
                <div className="flex items-center gap-1 shrink-0">
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
      {activePanel && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={closePanel}>
              <div 
                className="bg-card border-t border-border rounded-t-[2.5rem] shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500 ease-out" 
                onClick={e => e.stopPropagation()}
              >
                  {/* Sheet Drag Handle */}
                  <div className="flex justify-center pt-3 pb-2" onClick={closePanel}>
                    <div className="w-16 h-1.5 bg-muted-foreground/20 rounded-full hover:bg-muted-foreground/40 transition-colors"></div>
                  </div>

                  <div className="h-12 border-b border-border flex items-center justify-between px-6 shrink-0">
                    <span className="font-bold text-foreground text-sm uppercase tracking-widest">{activePanel}</span>
                    <button onClick={closePanel} className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-muted-foreground active:scale-75 transition-transform">
                        <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 relative pb-safe-bottom">
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
                            <Preview state={state} width={0} />
                        </div> 
                      )}
                      {activePanel === 'menu' && (
                          <div className="p-6 flex flex-col gap-6">
                             <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => { project.createProject(); closePanel(); }} className="p-4 rounded-3xl bg-secondary/30 text-foreground flex flex-col items-center gap-3 active:scale-95 transition-transform border border-border">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center"><Plus className="text-primary" size={24}/></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">New Sprite</span>
                                </button>
                                <button onClick={() => { fileInputRef.current?.click(); closePanel(); }} className="p-4 rounded-3xl bg-secondary/30 text-foreground flex flex-col items-center gap-3 active:scale-95 transition-transform border border-border">
                                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center"><Hand className="text-orange-500" size={24}/></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Open File</span>
                                </button>
                                <button onClick={() => { project.saveProject(); closePanel(); }} className="p-4 rounded-3xl bg-secondary/30 text-foreground flex flex-col items-center gap-3 active:scale-95 transition-transform border border-border">
                                    <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center"><Check className="text-green-500" size={24}/></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Save Sprite</span>
                                </button>
                                <button onClick={() => { project.downloadImage(); closePanel(); }} className="p-4 rounded-3xl bg-primary text-primary-foreground flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-lg">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Share size={24}/></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Export PNG</span>
                                </button>
                             </div>

                             <div className="space-y-3">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">Recent Projects</div>
                                <div className="flex flex-col gap-2">
                                    {project.recentProjects.length === 0 ? ( 
                                        <div className="text-center p-8 bg-muted/20 rounded-3xl border border-dashed border-border text-muted-foreground italic text-xs">No recent projects</div> 
                                    ) : (
                                        project.recentProjects.map((p: any) => (
                                            <button key={p.id} onClick={() => { project.loadRecentProject(p); closePanel(); }} className="p-4 text-left rounded-2xl bg-secondary/20 hover:bg-accent text-foreground transition-all flex justify-between items-center group active:bg-primary/10">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="font-bold text-sm">{p.title}</div>
                                                    <div className="text-[10px] text-muted-foreground">{new Date(p.timestamp).toLocaleDateString()}</div>
                                                </div>
                                                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
                                            </button>
                                        ))
                                    )}
                                </div>
                             </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
