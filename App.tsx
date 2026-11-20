import React, { useState, useRef } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { NewProjectDialog } from './components/NewProjectDialog';
import { CanvasResizeDialog } from './components/CanvasResizeDialog';
import { ReferenceImageDialog } from './components/ReferenceImageDialog';
import { ExportDialog, ExportFormat } from './components/ExportDialog';
import { SpritePropertiesDialog } from './components/SpritePropertiesDialog';
import { LayerPropertiesDialog } from './components/LayerPropertiesDialog';
import { SlicesDialog } from './components/SlicesDialog';
import { OutlineDialog } from './components/OutlineDialog';
import { Layer, FrameTag, ProjectState, ColorMode } from './types';

// Layouts
import { DesktopLayout } from './components/DesktopLayout';
import { MobileLayout } from './components/MobileLayout';

// Hooks
import { useProject, ProjectStateUpdater } from './hooks/useProject';
import { useCanvasTools } from './hooks/useCanvasTools';
import { useAppCommands } from './hooks/useAppCommands';
import { useKeyboard } from './hooks/useKeyboard';
import { useFileSystem } from './hooks/useFileSystem';
import { useMobile } from './hooks/useMobile';
import { useLayout } from './hooks/useLayout';
import { setCursorMousePos, setCursorDragStartPos } from './hooks/useCursorStore';
import { setStatusMessage } from './hooks/useStatusStore';
import { getCoords } from './utils';

export default function App() {
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isResizeCanvasDialogOpen, setIsResizeCanvasDialogOpen] = useState(false);
  const [isReferenceImageDialogOpen, setIsReferenceImageDialogOpen] = useState(false);
  const [isSpritePropertiesOpen, setIsSpritePropertiesOpen] = useState(false);
  const [isSlicesOpen, setIsSlicesOpen] = useState(false);
  const [isOutlineDialogOpen, setIsOutlineDialogOpen] = useState(false);
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
  const openExportDialog = (format: ExportFormat = 'gif') => {
    setExportDialog({ isOpen: true, initialFormat: format });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMobile = useMobile();

  const project = useProject();
  const fileSystem = useFileSystem();
  const layout = useLayout();
  const { state, updateState, getActiveState, getActiveHistoryInfo } = project;

  const updateStateWithStatus = (newState: ProjectStateUpdater, config?: { action: string; tool?: any }) => {
    updateState(newState, config);
    if (config?.action) {
      setStatusMessage({ text: config.action, type: 'info' });
    }
  };

  const canvasTools = useCanvasTools(state, updateStateWithStatus);

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

  const handleOutlinePreview = (previewState: ProjectState) => {
    updateState(previewState);
  };

  const handleOutlineConfirm = (finalState: ProjectState, actionSummary: string) => {
    updateState(finalState, { action: actionSummary });
    setStatusMessage({ text: actionSummary, type: 'success' });
  };

  const handleOutlineCancel = (originalState?: ProjectState) => {
    if (originalState) {
      updateState(originalState);
      return;
    }
    const { history, historyIndex } = getActiveHistoryInfo();
    const entry = history[historyIndex];
    if (entry) {
      updateState(entry.state);
    }
  };

  const openNewProjectDialog = () => setIsNewProjectDialogOpen(true);
  const openResizeDialog = () => setIsResizeCanvasDialogOpen(true);
  const openReferenceImageDialog = () => setIsReferenceImageDialogOpen(true);
  const openSpritePropertiesDialog = () => setIsSpritePropertiesOpen(true);
  const openSlicesDialog = () => setIsSlicesOpen(true);
  const openOutlineDialog = () => setIsOutlineDialogOpen(true);
  const openLayerPropertiesDialog = (layer?: Layer) => {
    const active = getActiveState();
    setLayerPropertiesState({
      isOpen: true,
      layer: layer || active.layers.find(l => l.id === active.activeLayerId) || null,
    });
  };
  const openTagPropertiesDialog = (tag?: FrameTag) => setTagPropertiesState({
    isOpen: true,
    tag: tag || null,
  });
  const closeTagPopover = () => setTagPropertiesState({ isOpen: false, tag: null });
  const closeLayerProperties = () => setLayerPropertiesState({ isOpen: false, layer: null });
  const downloadImage = () => openExportDialog('png');
  const downloadSpriteSheet = () => openExportDialog('spritesheet');
  const downloadGif = () => openExportDialog('gif');
  const openCmdPalette = () => setIsCmdPaletteOpen(true);

  const handleUndoWithStatus = () => {
    const { history, historyIndex } = getActiveHistoryInfo();
    if (historyIndex > 0) {
      const action = history[historyIndex].action;
      project.undo();
      setStatusMessage({ text: `Undid ${action}`, type: 'info' });
    }
  };

  const handleRedoWithStatus = () => {
    const { history, historyIndex } = getActiveHistoryInfo();
    if (historyIndex < history.length - 1) {
      const action = history[historyIndex + 1].action;
      project.redo();
      setStatusMessage({ text: `Redid ${action}`, type: 'info' });
    }
  };

  const handleSetColorModeWithStatus = (mode: ColorMode) => {
    project.setColorMode(mode);
    setStatusMessage({ text: `Changed to ${mode.toUpperCase()} mode`, type: 'info' });
  };

  const commands = useAppCommands({
    state,
    updateState: updateStateWithStatus,
    projectActions: {
      ...project,
      undo: handleUndoWithStatus,
      redo: handleRedoWithStatus,
      setColorMode: handleSetColorModeWithStatus,
      createProject: openNewProjectDialog,
      openResizeDialog,
      openReferenceImageDialog,
      openSpritePropertiesDialog,
      openSlicesDialog,
      openOutlineDialog,
      openLayerPropertiesDialog,
      openTagPropertiesDialog,
      openExportDialog,
      downloadImage,
      downloadSpriteSheet,
      downloadGif,
    },
    fileSystemActions: fileSystem,
    uiActions: {
      toggleFileTree: () => layout.togglePaneVisibility('file-tree'),
      togglePalette: () => layout.togglePaneVisibility('palette'),
      toggleTimeline: () => layout.togglePaneVisibility('timeline'),
      toggleRightPanel: () => layout.togglePaneVisibility('layers'),
    },
    openCmdPalette,
    onOpenProject: handleOpenFile,
  });

  useKeyboard(commands, state, (newState) => updateState(newState), {
    deleteSelectedLayers: project.deleteSelectedLayers,
    deleteSelectedFrames: project.deleteSelectedFrames,
    handleMovePixels: canvasTools.handleMovePixels,
  });

  let selectionSize: { w: number; h: number } | null = null;
  if (state.selection) {
    const selSet = state.selection instanceof Set ? state.selection : new Set<number>(Array.from(state.selection as any));
    if (selSet.size > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selSet.forEach(idx => {
        const { x, y } = getCoords(idx, state.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
      selectionSize = { w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }

  const projectForLayout = {
    ...project,
    createProject: openNewProjectDialog,
    openSpritePropertiesDialog,
    openSlicesDialog,
    openOutlineDialog,
    openLayerPropertiesDialog,
    openTagPropertiesDialog,
    openExportDialog,
    downloadImage,
    downloadSpriteSheet,
    downloadGif,
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
      {isCmdPaletteOpen && (
        <CommandPalette
          isOpen={isCmdPaletteOpen}
          onClose={() => setIsCmdPaletteOpen(false)}
          commands={commands}
        />
      )}

      {isNewProjectDialogOpen && (
        <NewProjectDialog
          isOpen={isNewProjectDialogOpen}
          onClose={() => setIsNewProjectDialogOpen(false)}
          onCreate={project.createProject}
          existingProjectCount={project.projects.length}
        />
      )}

      {isResizeCanvasDialogOpen && (
        <CanvasResizeDialog
          isOpen={isResizeCanvasDialogOpen}
          onClose={() => setIsResizeCanvasDialogOpen(false)}
          currentWidth={state.width}
          currentHeight={state.height}
          onResize={project.resizeCanvas}
        />
      )}

      {isReferenceImageDialogOpen && (
        <ReferenceImageDialog
          isOpen={isReferenceImageDialogOpen}
          onClose={() => setIsReferenceImageDialogOpen(false)}
          referenceImage={state.referenceImage}
          onUpdate={project.setReferenceImage}
        />
      )}

      {exportDialog.isOpen && (
        <ExportDialog
          isOpen={exportDialog.isOpen}
          onClose={() => setExportDialog(prev => ({ ...prev, isOpen: false }))}
          state={state}
          initialFormat={exportDialog.initialFormat}
        />
      )}

      {isSpritePropertiesOpen && (
        <SpritePropertiesDialog
          isOpen={isSpritePropertiesOpen}
          onClose={() => setIsSpritePropertiesOpen(false)}
          state={state}
          onUpdateSpriteProperties={project.updateSpriteProperties}
        />
      )}

      {isSlicesOpen && (
        <SlicesDialog
          isOpen={isSlicesOpen}
          onClose={() => setIsSlicesOpen(false)}
          state={state}
          onUpdateSlices={project.updateSlices}
        />
      )}

      {isOutlineDialogOpen && (
        <OutlineDialog
          isOpen={isOutlineDialogOpen}
          onClose={() => setIsOutlineDialogOpen(false)}
          state={state}
          onPreview={handleOutlinePreview}
          onConfirm={handleOutlineConfirm}
          onCancel={handleOutlineCancel}
        />
      )}

      {isMobile ? (
        <MobileLayout
          state={state}
          updateState={updateState}
          commands={commands}
          project={projectForLayout}
          activeTagPopover={tagPropertiesState}
          onCloseTagPopover={closeTagPopover}
          layerPropertiesState={layerPropertiesState}
          onCloseLayerProperties={closeLayerProperties}
          canvasTools={canvasTools}
          handleFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          setMousePos={setCursorMousePos}
          setDragStartPos={setCursorDragStartPos}
          selectionSize={selectionSize}
          onScalePixels={canvasTools.handleScalePixels}
        />
      ) : (
        <DesktopLayout
          state={state}
          updateState={updateState}
          commands={commands}
          project={projectForLayout}
          activeTagPopover={tagPropertiesState}
          onCloseTagPopover={closeTagPopover}
          layerPropertiesState={layerPropertiesState}
          onCloseLayerProperties={closeLayerProperties}
          canvasTools={canvasTools}
          fileSystem={fileSystem}
          handleFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          setMousePos={setCursorMousePos}
          setDragStartPos={setCursorDragStartPos}
          selectionSize={selectionSize}
          layout={layout}
          onScalePixels={canvasTools.handleScalePixels}
        />
      )}
    </div>
  );
}
