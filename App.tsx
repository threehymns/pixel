
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Position } from './types';
import { CommandPalette } from './components/CommandPalette';
import { TooltipProvider } from './components/ui/tooltip';
import { NewProjectDialog } from './components/NewProjectDialog';
import { CanvasResizeDialog } from './components/CanvasResizeDialog';
import { ReferenceImageDialog } from './components/ReferenceImageDialog';
import { ExportDialog, ExportFormat } from './components/ExportDialog';
import { SpritePropertiesDialog } from './components/SpritePropertiesDialog';
import { LayerPropertiesDialog } from './components/LayerPropertiesDialog';
import { SlicesDialog } from './components/SlicesDialog';
import { Layer, FrameTag } from './types';

// Layouts
import { DesktopLayout } from './components/DesktopLayout';
import { MobileLayout } from './components/MobileLayout';

// Hooks
import { useProject } from './hooks/useProject';
import { useCanvasTools } from './hooks/useCanvasTools';
import { useAppCommands } from './hooks/useAppCommands';
import { useKeyboard } from './hooks/useKeyboard';
import { useFileSystem } from './hooks/useFileSystem';
import { useMobile } from './hooks/useMobile';
import { useLayout } from './hooks/useLayout';
import { getCoords } from './utils';

export default function App() {
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isResizeCanvasDialogOpen, setIsResizeCanvasDialogOpen] = useState(false);
  const [isReferenceImageDialogOpen, setIsReferenceImageDialogOpen] = useState(false);
  const [isSpritePropertiesOpen, setIsSpritePropertiesOpen] = useState(false);
  const [isSlicesOpen, setIsSlicesOpen] = useState(false);
  const [layerPropertiesState, setLayerPropertiesState] = useState<{ isOpen: boolean; layer: Layer | null }>({
    isOpen: false,
    layer: null,
  });
  const [tagPropertiesState, setTagPropertiesState] = useState<{ isOpen: boolean; tag: FrameTag | null }>({
    isOpen: false,
    tag: null,
  });
  const [exportDialog, setExportDialog] = useState<{ isOpen: boolean; initialFormat: ExportFormat }>({
    isOpen: false,
    initialFormat: 'gif'
  });
  const [mousePos, setMousePos] = useState<Position | null>(null);

  const openExportDialog = (format: ExportFormat = 'gif') => {
    setExportDialog({ isOpen: true, initialFormat: format });
  };
  const [dragStartPos, setDragStartPos] = useState<Position | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'info' | 'error' | 'success' }>({ text: '', type: 'info' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMobile = useMobile();

  const project = useProject();
  const fileSystem = useFileSystem();
  const layout = useLayout();
  const { state, updateState } = project;

  const canvasTools = useCanvasTools(state, (newState, config) => {
    updateState(newState, config);
    if (config?.action) {
      setStatusMessage({ text: config.action, type: 'info' });
    }
  });
  
  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      project.loadProjectFromFile(file);
      setStatusMessage({ text: `Opened ${file.name}`, type: 'success' });
    }
    if (e.target) e.target.value = ''; 
  };

  const commands = useAppCommands({
      state: state,
      updateState: (newState, config) => {
          updateState(newState, config);
          if (config?.action) setStatusMessage({ text: config.action, type: 'info' });
      },
      projectActions: {
        ...project,
        undo: () => {
            const histIdx = project.historyIndex;
            if (histIdx > 0) {
                const action = project.history[histIdx].action;
                project.undo();
                setStatusMessage({ text: `Undid ${action}`, type: 'info' });
            }
        },
        redo: () => {
            const histIdx = project.historyIndex;
            if (histIdx < project.history.length - 1) {
                const action = project.history[histIdx + 1].action;
                project.redo();
                setStatusMessage({ text: `Redid ${action}`, type: 'info' });
            }
        },
        setColorMode: (mode) => {
            project.setColorMode(mode);
            setStatusMessage({ text: `Changed to ${mode.toUpperCase()} mode`, type: 'info' });
        },
        createProject: () => setIsNewProjectDialogOpen(true),
        openResizeDialog: () => setIsResizeCanvasDialogOpen(true),
        openReferenceImageDialog: () => setIsReferenceImageDialogOpen(true),
        openSpritePropertiesDialog: () => setIsSpritePropertiesOpen(true),
        openSlicesDialog: () => setIsSlicesOpen(true),
        openLayerPropertiesDialog: (layer?: Layer) => setLayerPropertiesState({
          isOpen: true,
          layer: layer || project.state.layers.find(l => l.id === project.state.activeLayerId) || null,
        }),
        openTagPropertiesDialog: (tag?: FrameTag) => setTagPropertiesState({
          isOpen: true,
          tag: tag || null,
        }),
        openExportDialog,
        downloadImage: () => openExportDialog('png'),
        downloadSpriteSheet: () => openExportDialog('spritesheet'),
        downloadGif: () => openExportDialog('gif')
      },
      fileSystemActions: fileSystem,
      uiActions: {
        toggleFileTree: () => layout.togglePaneVisibility('file-tree'), 
        togglePalette: () => layout.togglePaneVisibility('palette'), 
        toggleTimeline: () => layout.togglePaneVisibility('timeline'), 
        toggleRightPanel: () => {
          layout.togglePaneVisibility('layers');
        }, 
      },
      openCmdPalette: () => setIsCmdPaletteOpen(true),
      onOpenProject: handleOpenFile
  });

  useKeyboard(commands, state, (newState) => updateState(newState), {
      deleteSelectedLayers: project.deleteSelectedLayers,
      deleteSelectedFrames: project.deleteSelectedFrames,
      handleMovePixels: canvasTools.handleMovePixels
  });

  useEffect(() => {
    setStatusMessage({ text: `${state.tool.charAt(0).toUpperCase() + state.tool.slice(1).replace('-select', ' Select')} tool selected`, type: 'info' });
  }, [state.tool]);

  const selectionSize = useMemo(() => {
    if (!state.selection) return null;
    const selSet = state.selection instanceof Set ? state.selection : new Set<number>(Array.from(state.selection as any));
    if (selSet.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selSet.forEach(idx => {
      const { x, y } = getCoords(idx, state.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    return { w: maxX - minX + 1, h: maxY - minY + 1 };
  }, [state.selection, state.width]);

  const sharedProps = {
      state,
      updateState,
      commands,
      project: {
        ...project,
        createProject: () => setIsNewProjectDialogOpen(true),
        openSpritePropertiesDialog: () => setIsSpritePropertiesOpen(true),
        openSlicesDialog: () => setIsSlicesOpen(true),
        openLayerPropertiesDialog: (layer?: Layer) => setLayerPropertiesState({
          isOpen: true,
          layer: layer || project.state.layers.find(l => l.id === project.state.activeLayerId) || null,
        }),
        openTagPropertiesDialog: (tag?: FrameTag) => setTagPropertiesState({
          isOpen: true,
          tag: tag || null,
        }),
        openExportDialog,
        downloadImage: () => openExportDialog('png'),
        downloadSpriteSheet: () => openExportDialog('spritesheet'),
        downloadGif: () => openExportDialog('gif')
      },
      activeTagPopover: tagPropertiesState,
      onCloseTagPopover: () => setTagPropertiesState({ isOpen: false, tag: null }),
      layerPropertiesState,
      onCloseLayerProperties: () => setLayerPropertiesState({ isOpen: false, layer: null }),
      canvasTools,
      fileSystem,
      handleFileChange,
      fileInputRef,
      statusMessage,
      mousePos,
      dragStartPos,
      setMousePos,
      setDragStartPos,
      selectionSize,
      layout
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
        <CommandPalette 
          isOpen={isCmdPaletteOpen} 
          onClose={() => setIsCmdPaletteOpen(false)} 
          commands={commands} 
        />
        
        <NewProjectDialog
          isOpen={isNewProjectDialogOpen}
          onClose={() => setIsNewProjectDialogOpen(false)}
          onCreate={project.createProject}
        />

        <CanvasResizeDialog
          isOpen={isResizeCanvasDialogOpen}
          onClose={() => setIsResizeCanvasDialogOpen(false)}
          currentWidth={state.width}
          currentHeight={state.height}
          onResize={project.resizeCanvas}
        />

        <ReferenceImageDialog
            isOpen={isReferenceImageDialogOpen}
            onClose={() => setIsReferenceImageDialogOpen(false)}
            referenceImage={state.referenceImage}
            onUpdate={project.setReferenceImage}
        />

        <ExportDialog
          isOpen={exportDialog.isOpen}
          onClose={() => setExportDialog(prev => ({ ...prev, isOpen: false }))}
          state={state}
          initialFormat={exportDialog.initialFormat}
        />

        <SpritePropertiesDialog
          isOpen={isSpritePropertiesOpen}
          onClose={() => setIsSpritePropertiesOpen(false)}
          state={state}
          onUpdateSpriteProperties={project.updateSpriteProperties}
        />


        <SlicesDialog
          isOpen={isSlicesOpen}
          onClose={() => setIsSlicesOpen(false)}
          state={state}
          onUpdateSlices={project.updateSlices}
        />

        {isMobile ? (
          <MobileLayout 
            {...sharedProps} 
            onScalePixels={canvasTools.handleScalePixels}
          />
        ) : (
          <DesktopLayout 
            {...sharedProps} 
            onScalePixels={canvasTools.handleScalePixels}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
