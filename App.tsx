
import React, { useState, useEffect, useRef } from 'react';
import { ToolType } from './types';
import { Canvas } from './components/Canvas';
import { Palette } from './components/Palette';
import { Timeline } from './components/Timeline';
import { Preview } from './components/Preview';
import { HistoryPanel } from './components/HistoryPanel'; 
import { LayersPanel } from './components/LayersPanel'; 
import { Menubar } from './components/Menubar';
import { CommandPalette } from './components/CommandPalette';
import { TabStrip } from './components/TabStrip';
import { Home } from './components/Home';
import { FileTree } from './components/FileTree';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './components/Popover';
import { ToolButton } from './components/ToolButton';
import { SELECTION_TOOLS } from './constants';
import { 
  Pencil, Eraser, PaintBucket, Pipette, 
  Grid, Eye, Download, Undo, Redo, 
  Square, Circle,
  BoxSelect, Lasso, Wand2, MousePointer2, Scissors,
  GripVertical
} from './components/Icons';

// Hooks
import { useLayout } from './hooks/useLayout';
import { useProject } from './hooks/useProject';
import { useCanvasTools } from './hooks/useCanvasTools';
import { useAppCommands } from './hooks/useAppCommands';
import { useKeyboard } from './hooks/useKeyboard';
import { useFileSystem } from './hooks/useFileSystem';

export default function App() {
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [showFileTree, setShowFileTree] = useState(false);
  const [lastSelectionTool, setLastSelectionTool] = useState<ToolType>('rect-select');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom Hooks
  const layout = useLayout();
  const project = useProject();
  const fileSystem = useFileSystem();
  const { state, updateState, activeProjectId } = project;
  const isHome = activeProjectId === 'home';

  const canvasTools = useCanvasTools(state, updateState);
  
  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      project.loadProjectFromFile(file);
    }
    if (e.target) e.target.value = ''; // Reset
  };

  const commands = useAppCommands({
      state: state,
      updateState: updateState,
      projectActions: project,
      fileSystemActions: fileSystem,
      uiActions: {
        toggleFileTree: () => setShowFileTree(prev => !prev)
      },
      openCmdPalette: () => setIsCmdPaletteOpen(true),
      onOpenProject: handleOpenFile
  });

  useKeyboard(commands, state, updateState);

  // Effect: Track Last Selection Tool
  useEffect(() => {
    if (SELECTION_TOOLS.includes(state.tool)) {
      setLastSelectionTool(state.tool);
    }
  }, [state.tool]);

  // UI Helpers
  const getToolIcon = (t: ToolType) => {
      switch(t) {
          case 'rect-select': return <BoxSelect size={20} />;
          case 'ellipse-select': return <Circle size={20} />;
          case 'lasso-select': return <Lasso size={20} />;
          case 'poly-lasso-select': return <Scissors size={20} />;
          case 'magic-wand': return <Wand2 size={20} />;
          default: return <BoxSelect size={20} />;
      }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none">
      <CommandPalette 
        isOpen={isCmdPaletteOpen} 
        onClose={() => setIsCmdPaletteOpen(false)} 
        commands={commands} 
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".json,.png,.jpg,.jpeg,.gif" 
        onChange={handleFileChange} 
      />

      {/* Header & Top Bar */}
      <div className="h-8 bg-card border-b border-background flex items-center px-4 text-xs space-x-4">
        
        <Menubar 
            commands={commands} 
            recentProjects={project.recentProjects}
            onOpenRecent={project.loadRecentProject}
            onClearRecent={project.clearRecents}
        />

        <div className="flex-1"></div>
        {!isHome && <div className="text-muted-foreground">{state.width}x{state.height} px</div>}
      </div>

      {/* Tab Strip */}
      <TabStrip 
        projects={project.projects} 
        activeProjectId={project.activeProjectId}
        onSelectProject={project.setActiveProjectId}
        onCloseProject={project.closeProject}
        onNewProject={project.createProject}
      />

      {isHome ? (
        <Home onCreateProject={project.createProject} onImportProject={handleOpenFile} />
      ) : (
        <>
          <div className="h-10 bg-secondary/50 border-b border-background flex items-center px-2 space-x-2 text-xs">
             <div className="flex items-center space-x-1 border-r border-input pr-2">
                <ToolButton active={false} onClick={project.undo} icon={<Undo size={16} />} label="Undo (Ctrl+Z)" />
                <ToolButton active={false} onClick={project.redo} icon={<Redo size={16} />} label="Redo (Ctrl+Y)" />
             </div>
             {/* Selection Mode Indicators */}
             {SELECTION_TOOLS.includes(state.tool) && (
                 <div className="flex items-center gap-1 px-2 border-r border-input">
                     <span className={`px-2 py-0.5 rounded ${state.selectionMode==='replace'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>New</span>
                     <span className={`px-2 py-0.5 rounded ${state.selectionMode==='add'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Add</span>
                     <span className={`px-2 py-0.5 rounded ${state.selectionMode==='subtract'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Sub</span>
                 </div>
             )}
             
             {/* Tool Options */}
             <div className="flex items-center space-x-3 px-2 flex-1">
                {['pencil', 'eraser'].includes(state.tool) && (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Size:</span>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={state.brushSize} 
                                onChange={(e) => updateState({...state, brushSize: parseInt(e.target.value)})} 
                                className="w-24 h-1 bg-input appearance-none rounded cursor-pointer" 
                                aria-label="Brush Size"
                            />
                            <span className="w-4 text-center">{state.brushSize}</span>
                        </div>
                        <div className="flex bg-input rounded p-0.5 ml-2 gap-0.5">
                            <button onClick={() => updateState({...state, brushShape: 'square'})} className={`p-1 rounded ${state.brushShape === 'square' ? 'bg-primary text-primary-foreground' : 'text-gray-300'}`} title="Square Brush"><Square size={14} /></button>
                            <button onClick={() => updateState({...state, brushShape: 'circle'})} className={`p-1 rounded ${state.brushShape === 'circle' ? 'bg-primary text-primary-foreground' : 'text-gray-300'}`} title="Circle Brush"><Circle size={14} /></button>
                        </div>
                        {state.tool === 'pencil' && (
                             <div className="flex items-center gap-2 ml-4">
                                 <input 
                                    type="checkbox" 
                                    id="pixelPerfect" 
                                    checked={state.pixelPerfect} 
                                    onChange={(e) => updateState({...state, pixelPerfect: e.target.checked})}
                                    className="rounded bg-input border-none text-primary focus:ring-0"
                                 />
                                 <label htmlFor="pixelPerfect" className="text-muted-foreground cursor-pointer">Pixel Perfect</label>
                             </div>
                        )}
                    </>
                )}
                {(state.tool === 'bucket' || state.tool === 'magic-wand') && (
                     <div className="flex items-center gap-2">
                         <input 
                            type="checkbox" 
                            id="contiguous" 
                            checked={state.fillContiguous} 
                            onChange={(e) => updateState({...state, fillContiguous: e.target.checked})}
                            className="rounded bg-input border-none text-primary focus:ring-0"
                         />
                         <label htmlFor="contiguous" className="text-muted-foreground cursor-pointer">Contiguous</label>
                     </div>
                )}
             </div>

             <div className="flex items-center space-x-1 pl-2 border-l border-input">
                 <ToolButton active={state.showGrid} onClick={() => updateState({...state, showGrid: !state.showGrid})} icon={<Grid size={16} />} label="Grid" />
                 <ToolButton active={state.onionSkin} onClick={() => updateState({...state, onionSkin: !state.onionSkin})} icon={<Eye size={16} />} label="Onion Skin" />
                 <ToolButton active={false} onClick={project.downloadImage} icon={<Download size={16} />} label="Export" />
             </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* File Tree Panel */}
            {showFileTree && (
              <FileTree 
                rootHandle={fileSystem.rootHandle}
                onOpenFolder={fileSystem.openFolder}
                onFileOpen={project.loadProjectFromFile}
                width={layout.fileTreeWidth}
                onResizeStart={layout.startFileTreeResize}
              />
            )}

            {/* Sidebar */}
            <div className="w-12 bg-card border-r border-background flex flex-col items-center py-2 space-y-2 overflow-visible z-50">
                <ToolButton active={state.tool === 'pencil'} onClick={() => updateState({...state, tool: 'pencil'})} icon={<Pencil size={20} />} label="Pencil" />
                <ToolButton active={state.tool === 'eraser'} onClick={() => updateState({...state, tool: 'eraser'})} icon={<Eraser size={20} />} label="Eraser" />
                <ToolButton active={state.tool === 'bucket'} onClick={() => updateState({...state, tool: 'bucket'})} icon={<PaintBucket size={20} />} label="Fill" />
                <ToolButton active={state.tool === 'eyedropper'} onClick={() => updateState({...state, tool: 'eyedropper'})} icon={<Pipette size={20} />} label="Picker" />
                
                <div className="w-8 h-[1px] bg-border my-1"></div>
                
                <ToolButton active={state.tool === 'move'} onClick={() => updateState({...state, tool: 'move'})} icon={<MousePointer2 size={20} />} label="Move" />

                {/* Selection Tool Group Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className={`p-1.5 rounded-sm transition-colors relative group ${SELECTION_TOOLS.includes(state.tool) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
                      onClick={(e) => {
                        if (state.tool !== lastSelectionTool) {
                          e.preventDefault(); 
                          updateState({...state, tool: lastSelectionTool});
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const targetId = e.currentTarget.getAttribute('popovertarget');
                        if (targetId) {
                          const popover = document.getElementById(targetId);
                          if (popover && !popover.matches(':popover-open')) {
                             popover.showPopover();
                          }
                        }
                      }}
                    >
                      {getToolIcon(lastSelectionTool)}
                      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-gray-500 rounded-bl-[1px]"></div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="flex flex-col gap-1 w-32 p-1">
                     {SELECTION_TOOLS.map(t => (
                        <PopoverClose key={t} asChild>
                           <button 
                             onClick={() => updateState({...state, tool: t})}
                             className={`flex items-center gap-2 p-2 rounded hover:bg-accent text-foreground text-xs text-left w-full ${state.tool === t ? 'bg-primary text-primary-foreground' : ''}`}
                           >
                             {getToolIcon(t)}
                             <span>{t.replace('-select', '').replace('poly-', 'Poly ').replace('-', ' ')}</span>
                           </button>
                        </PopoverClose>
                     ))}
                  </PopoverContent>
                </Popover>
            </div>

            <Palette 
              width={layout.leftPanelWidth}
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
              onResizeStart={layout.startLeftResize}
            />

            <div className="flex-1 flex flex-col relative bg-[oklch(0.145_0_0)] min-w-0">
                <Canvas 
                  state={state}
                  onDrawStart={canvasTools.handleDrawStart}
                  onDraw={canvasTools.handleDraw}
                  onDrawEnd={canvasTools.handleDrawEnd}
                  onSelectionUpdate={(sel) => updateState({...state, selection: sel}, { action: 'Select Area', tool: state.tool })}
                  onMovePixels={canvasTools.handleMovePixels}
                />
            </div>

            {/* Right Sidebar Container for Preview, Layers, and History */}
            <div 
              className="bg-card border-l border-background shadow-lg flex flex-col relative"
              style={{ width: layout.rightPanelWidth, minWidth: 200, maxWidth: 500 }}
            >
              {/* Resize Handle for the entire right panel */}
              <div 
                  className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary group z-50"
                  onMouseDown={layout.startRightResize}
              >
                  <div className="absolute top-1/2 -translate-y-1/2 -left-2 opacity-0 group-hover:opacity-100 text-muted-foreground pointer-events-none">
                      <GripVertical size={12} />
                  </div>
              </div>

              <Preview 
                width={layout.rightPanelWidth} 
                state={state} 
              />
              
              <div className="flex-1 flex flex-col min-h-0 border-t border-background">
                <LayersPanel 
                    state={state}
                    onSelectLayer={(id) => updateState({...state, activeLayerId: id})}
                    onUpdateLayer={project.updateLayer}
                    onAddLayer={project.addLayer}
                    onDuplicateLayer={project.duplicateLayer}
                    onDeleteLayer={project.deleteLayer}
                    onReorderLayers={project.reorderLayers}
                    className="flex-1 border-b border-background"
                />
                
                <HistoryPanel
                    history={project.history}
                    historyIndex={project.historyIndex}
                    onJumpToHistory={project.jumpToHistory}
                    className="flex-1"
                />
              </div>
            </div>
          </div>

          <Timeline 
            state={state}
            onSelectFrame={(i) => updateState({...state, activeFrameIndex: i})}
            onAddFrame={project.addFrame}
            onDuplicateFrame={project.duplicateFrame}
            onDeleteFrame={project.deleteFrame}
            onSelectLayer={(id) => updateState({...state, activeLayerId: id})}
            onAddLayer={project.addLayer}
            onToggleLayerVisibility={(id) => updateState({...state, layers: state.layers.map(l => l.id===id?{...l, visible:!l.visible}:l)})}
            onToggleLayerLock={(id) => updateState({...state, layers: state.layers.map(l => l.id===id?{...l, locked:!l.locked}:l)})}
            onReorderLayers={project.reorderLayers}
            onReorderFrames={project.reorderFrames}
          />
        </>
      )}
    </div>
  );
}
