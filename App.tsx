import React, { useState, useRef } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { NewProjectDialog } from './components/NewProjectDialog';
import { CanvasResizeDialog } from './components/CanvasResizeDialog';
import { ReferenceImageDialog, ReferenceImageConfig } from './components/ReferenceImageDialog';
import { ExportDialog, ExportFormat } from './components/ExportDialog';
import {
  SpritePropertiesDialog,
  SpritePropertiesUpdate,
} from './components/SpritePropertiesDialog';
import { LayerPropertiesDialog } from './components/LayerPropertiesDialog';
import { AnimationTagDialog } from './components/AnimationTagPopover';
import { SlicesDialog } from './components/SlicesDialog';
import { OutlineDialog } from './components/OutlineDialog';
import { StudioToaster, toast } from './components/ui/toast';
import { StudioConfirmHost } from './components/ui/alert-dialog';
import { Layer, FrameTag, ProjectState, ColorMode, Slice, PixelHistoryPatch, ToolType } from './types';
import { MAX_ZOOM, MIN_ZOOM } from './constants';

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

const EMPTY_COMMANDS: any[] = [];
const CLOSED_LAYER_PROPS = { isOpen: false, layer: null };
const CLOSED_TAG_PROPS = { isOpen: false, tag: null, isNew: false };

interface AppDialogsProps {
  isCmdPaletteOpen: boolean;
  onCloseCmdPalette: () => void;
  commands: any[];
  isNewProjectDialogOpen: boolean;
  onCloseNewProjectDialog: () => void;
  onCreateProject: any;
  existingProjectCount: number;
  isResizeCanvasDialogOpen: boolean;
  onCloseResizeCanvasDialog: () => void;
  onResizeCanvas: any;
  isReferenceImageDialogOpen: boolean;
  onCloseReferenceImageDialog: () => void;
  onSetReferenceImage: (config: ReferenceImageConfig | null) => void;
  onPreviewReferenceImage: (config: ReferenceImageConfig | null) => void;
  onRevertReferenceImage: (snapshot: ReferenceImageConfig | null) => void;
  exportDialog: { isOpen: boolean; initialFormat?: ExportFormat };
  onCloseExportDialog: () => void;
  isSpritePropertiesOpen: boolean;
  onCloseSpriteProperties: () => void;
  onUpdateSpriteProperties: (props: SpritePropertiesUpdate) => void;
  onPreviewSpriteProperties: (props: SpritePropertiesUpdate) => void;
  onRevertSpriteProperties: (snapshot: SpritePropertiesUpdate) => void;
  isSlicesOpen: boolean;
  onCloseSlices: () => void;
  onUpdateSlices: (slices: Slice[]) => void;
  onPreviewSlices: (slices: Slice[]) => void;
  onRevertSlices: (snapshot: Slice[]) => void;
  isOutlineDialogOpen: boolean;
  onCloseOutlineDialog: () => void;
  onOutlinePreview: (previewState: ProjectState) => void;
  onOutlineConfirm: (finalState: ProjectState, actionSummary: string) => void;
  onOutlineCancel: (originalState?: ProjectState) => void;
  showModalLayerProperties: boolean;
  layerPropertiesLayer: Layer | null;
  onCloseLayerProperties: () => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onPreviewLayer: (id: string, updates: Partial<Layer>) => void;
  onRevertLayerPreview: (id: string, snapshot: Partial<Layer>) => void;
  showModalTagProperties: boolean;
  tagPropertiesTag: FrameTag | null;
  tagPropertiesIsNew: boolean;
  onCloseTagProperties: () => void;
  onSaveTag: (tag: FrameTag) => void;
  onDeleteTag: (tagId: string) => void;
  onPreviewTag: (tag: FrameTag) => void;
  onRevertTagPreview: (snapshotTag: FrameTag | null) => void;
  dialogState: ProjectState | null;
}

const AppDialogs: React.FC<AppDialogsProps> = ({
  isCmdPaletteOpen,
  onCloseCmdPalette,
  commands,
  isNewProjectDialogOpen,
  onCloseNewProjectDialog,
  onCreateProject,
  existingProjectCount,
  isResizeCanvasDialogOpen,
  onCloseResizeCanvasDialog,
  onResizeCanvas,
  isReferenceImageDialogOpen,
  onCloseReferenceImageDialog,
  onSetReferenceImage,
  onPreviewReferenceImage,
  onRevertReferenceImage,
  exportDialog,
  onCloseExportDialog,
  isSpritePropertiesOpen,
  onCloseSpriteProperties,
  onUpdateSpriteProperties,
  onPreviewSpriteProperties,
  onRevertSpriteProperties,
  isSlicesOpen,
  onCloseSlices,
  onUpdateSlices,
  onPreviewSlices,
  onRevertSlices,
  isOutlineDialogOpen,
  onCloseOutlineDialog,
  onOutlinePreview,
  onOutlineConfirm,
  onOutlineCancel,
  showModalLayerProperties,
  layerPropertiesLayer,
  onCloseLayerProperties,
  onUpdateLayer,
  onPreviewLayer,
  onRevertLayerPreview,
  showModalTagProperties,
  tagPropertiesTag,
  tagPropertiesIsNew,
  onCloseTagProperties,
  onSaveTag,
  onDeleteTag,
  onPreviewTag,
  onRevertTagPreview,
  dialogState,
}) => {
  return (
    <>
      {isCmdPaletteOpen && (
        <CommandPalette
          isOpen={isCmdPaletteOpen}
          onClose={onCloseCmdPalette}
          commands={commands}
        />
      )}

      {isNewProjectDialogOpen && (
        <NewProjectDialog
          isOpen={isNewProjectDialogOpen}
          onClose={onCloseNewProjectDialog}
          onCreate={onCreateProject}
          existingProjectCount={existingProjectCount}
        />
      )}

      {isResizeCanvasDialogOpen && dialogState && (
        <CanvasResizeDialog
          isOpen={isResizeCanvasDialogOpen}
          onClose={onCloseResizeCanvasDialog}
          currentWidth={dialogState.width}
          currentHeight={dialogState.height}
          onResize={onResizeCanvas}
        />
      )}

      {isReferenceImageDialogOpen && dialogState && (
        <ReferenceImageDialog
          isOpen={isReferenceImageDialogOpen}
          onClose={onCloseReferenceImageDialog}
          referenceImage={dialogState.referenceImage}
          onUpdate={onSetReferenceImage}
          onPreview={onPreviewReferenceImage}
          onRevertPreview={onRevertReferenceImage}
        />
      )}

      {exportDialog.isOpen && dialogState && (
        <ExportDialog
          isOpen={exportDialog.isOpen}
          onClose={onCloseExportDialog}
          state={dialogState}
          initialFormat={exportDialog.initialFormat}
        />
      )}

      {isSpritePropertiesOpen && dialogState && (
        <SpritePropertiesDialog
          isOpen={isSpritePropertiesOpen}
          onClose={onCloseSpriteProperties}
          state={dialogState}
          onUpdateSpriteProperties={onUpdateSpriteProperties}
          onPreviewSpriteProperties={onPreviewSpriteProperties}
          onRevertPreview={onRevertSpriteProperties}
        />
      )}

      {isSlicesOpen && dialogState && (
        <SlicesDialog
          isOpen={isSlicesOpen}
          onClose={onCloseSlices}
          state={dialogState}
          onUpdateSlices={onUpdateSlices}
          onPreviewSlices={onPreviewSlices}
          onRevertPreview={onRevertSlices}
        />
      )}

      {isOutlineDialogOpen && dialogState && (
        <OutlineDialog
          isOpen={isOutlineDialogOpen}
          onClose={onCloseOutlineDialog}
          state={dialogState}
          onPreview={onOutlinePreview}
          onConfirm={onOutlineConfirm}
          onCancel={onOutlineCancel}
        />
      )}

      {showModalLayerProperties && layerPropertiesLayer && (
        <LayerPropertiesDialog
          isOpen={showModalLayerProperties}
          onClose={onCloseLayerProperties}
          layer={layerPropertiesLayer}
          onUpdateLayer={onUpdateLayer}
          onPreviewLayer={onPreviewLayer}
          onRevertPreview={onRevertLayerPreview}
        />
      )}

      {showModalTagProperties && tagPropertiesTag && dialogState && (
        <AnimationTagDialog
          isOpen={showModalTagProperties}
          tag={tagPropertiesTag}
          isNew={tagPropertiesIsNew}
          totalFrames={dialogState.frames.length}
          frames={dialogState.frames}
          onSave={onSaveTag}
          onClose={onCloseTagProperties}
          onDelete={onDeleteTag}
          onPreviewTag={onPreviewTag}
          onRevertPreview={onRevertTagPreview}
        />
      )}
    </>
  );
};

export default function App() {
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isResizeCanvasDialogOpen, setIsResizeCanvasDialogOpen] = useState(false);
  const [isReferenceImageDialogOpen, setIsReferenceImageDialogOpen] = useState(false);
  const [isSpritePropertiesOpen, setIsSpritePropertiesOpen] = useState(false);
  const [isSlicesOpen, setIsSlicesOpen] = useState(false);
  const [isOutlineDialogOpen, setIsOutlineDialogOpen] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  const [layerPropertiesState, setLayerPropertiesState] = useState<{
    isOpen: boolean;
    layer: Layer | null;
  }>(CLOSED_LAYER_PROPS);
  const [tagPropertiesState, setTagPropertiesState] = useState<{
    isOpen: boolean;
    tag: FrameTag | null;
    isNew: boolean;
  }>(CLOSED_TAG_PROPS);
  const [exportDialog, setExportDialog] = useState<{
    isOpen: boolean;
    initialFormat?: ExportFormat;
  }>({
    isOpen: false,
    initialFormat: undefined,
  });

  const openExportDialog = (format?: ExportFormat) => {
    setExportDialog({ isOpen: true, initialFormat: format });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTagIdRef = useRef<string | null>(null);

  const isMobile = useMobile();

  const project = useProject();
  const fileSystem = useFileSystem();
  const layout = useLayout();
  const {
    actions: projectActions,
    state,
    projects,
    tabs,
    activeProjectId,
    recentProjects,
    history,
    historyIndex,
    canUndo,
    canRedo,
  } = project;
  const { actions: layoutActions } = layout;
  const { updateState, getActiveState, getActiveHistoryInfo } = projectActions;

  const updateStateWithStatus = (
    newState: ProjectStateUpdater,
    config?: { action: string; tool?: ToolType; patch?: PixelHistoryPatch }
  ) => {
    updateState(newState, config);
    if (config?.action) {
      setStatusMessage({ text: config.action, type: 'info' });
    }
  };

  const canvasTools = useCanvasTools(state, updateStateWithStatus);

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (file: File) => {
    projectActions.loadProjectFromFile(file);
    setStatusMessage({ text: `Opened ${file.name}`, type: 'success' });
    toast.success(`Opened ${file.name}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleQuickCreate = (width: number, height: number) => {
    projectActions.createProject({
      width,
      height,
      colorMode: 'rgba',
      title: `Untitled-${projects.length + 1}`,
    });
    setStatusMessage({ text: `Created ${width}×${height} canvas`, type: 'success' });
  };

  const handleZoomIn = () => {
    updateState((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, Number((prev.zoom * 1.25).toFixed(2))),
    }));
  };

  const handleZoomOut = () => {
    updateState((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Number((prev.zoom / 1.25).toFixed(2))),
    }));
  };

  const handleZoomReset = () => {
    updateState((prev) => ({ ...prev, zoom: 1 }));
  };

  const handleZoomFit = () => {
    setFitTrigger((n) => n + 1);
  };

  // Non-history live-preview helpers paired with Save/Cancel dialogs
  const handlePreviewLayer = (id: string, updates: Partial<Layer>) => {
    updateState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  const handleRevertLayerPreview = (id: string, snapshot: Partial<Layer>) => {
    updateState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...snapshot } : l)),
    }));
  };

  const handlePreviewSpriteProperties = (props: SpritePropertiesUpdate) => {
    updateState((prev) => ({
      ...prev,
      title: props.title ?? prev.title,
      pixelRatio: props.pixelRatio ?? prev.pixelRatio,
      transparentIndex: props.transparentIndex ?? prev.transparentIndex,
      colorMode: props.colorMode ?? prev.colorMode,
      grid: props.grid ?? prev.grid,
    }));
  };

  const handleRevertSpriteProperties = (snapshot: SpritePropertiesUpdate) => {
    handlePreviewSpriteProperties(snapshot);
  };

  const handlePreviewReferenceImage = (config: ReferenceImageConfig | null) => {
    updateState((prev) => ({ ...prev, referenceImage: config }));
  };

  const handleRevertReferenceImage = (snapshot: ReferenceImageConfig | null) => {
    updateState((prev) => ({ ...prev, referenceImage: snapshot }));
  };

  const handlePreviewSlices = (slices: Slice[]) => {
    updateState((prev) => ({ ...prev, slices }));
  };

  const handleRevertSlices = (snapshot: Slice[]) => {
    updateState((prev) => ({ ...prev, slices: snapshot }));
  };

  const handlePreviewTag = (previewTag: FrameTag) => {
    previewTagIdRef.current = previewTag.id;
    updateState((prev) => {
      const existing = prev.tags || [];
      const exists = existing.some((t) => t.id === previewTag.id);
      return {
        ...prev,
        tags: exists
          ? existing.map((t) => (t.id === previewTag.id ? previewTag : t))
          : [...existing, previewTag],
      };
    });
  };

  const handleRevertTagPreview = (snapshotTag: FrameTag | null) => {
    const previewId = previewTagIdRef.current;
    previewTagIdRef.current = null;
    updateState((prev) => {
      const existing = prev.tags || [];
      if (snapshotTag) {
        return {
          ...prev,
          tags: existing.map((t) => (t.id === snapshotTag.id ? snapshotTag : t)),
        };
      }
      if (previewId) {
        return {
          ...prev,
          tags: existing.filter((t) => t.id !== previewId),
        };
      }
      return prev;
    });
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
    projectActions.restoreCurrentHistoryState();
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
      layer: layer || active.layers.find((l) => l.id === active.activeLayerId) || null,
    });
  };

  const openTagPropertiesDialog = (tag?: FrameTag) => {
    const active = getActiveState();
    const from =
      active.selectedFrameIndices.length > 0
        ? Math.min(...active.selectedFrameIndices)
        : active.activeFrameIndex;
    const to =
      active.selectedFrameIndices.length > 0
        ? Math.max(...active.selectedFrameIndices)
        : active.activeFrameIndex;
    const draft: FrameTag = tag
      ? { ...tag }
      : {
          id: `tag-${Date.now()}`,
          name: '',
          from,
          to,
          color: '#3b82f6',
          direction: 'forward',
          repeat: 0,
        };
    setTagPropertiesState({
      isOpen: true,
      tag: draft,
      isNew: !tag,
    });
  };

  const closeTagPopover = () => setTagPropertiesState(CLOSED_TAG_PROPS);
  const closeLayerProperties = () => setLayerPropertiesState(CLOSED_LAYER_PROPS);
  const closeCmdPalette = () => setIsCmdPaletteOpen(false);
  const closeNewProjectDialog = () => setIsNewProjectDialogOpen(false);
  const closeResizeCanvasDialog = () => setIsResizeCanvasDialogOpen(false);
  const closeReferenceImageDialog = () => setIsReferenceImageDialogOpen(false);
  const closeExportDialog = () => setExportDialog((prev) => ({ ...prev, isOpen: false }));
  const closeSpriteProperties = () => setIsSpritePropertiesOpen(false);
  const closeSlices = () => setIsSlicesOpen(false);
  const closeOutlineDialog = () => setIsOutlineDialogOpen(false);
  const downloadImage = () => openExportDialog('png');
  const downloadSpriteSheet = () => openExportDialog('spritesheet');
  const downloadGif = () => openExportDialog('gif');
  const openCmdPalette = () => setIsCmdPaletteOpen(true);

  const handleUndoWithStatus = () => {
    const { history: activeHistory, historyIndex: activeHistoryIdx } = getActiveHistoryInfo();
    if (activeHistoryIdx > 0) {
      const action = activeHistory[activeHistoryIdx].action;
      projectActions.undo();
      setStatusMessage({ text: `Undid ${action}`, type: 'info' });
    }
  };

  const handleRedoWithStatus = () => {
    const { history: activeHistory, historyIndex: activeHistoryIdx } = getActiveHistoryInfo();
    if (activeHistoryIdx < activeHistory.length - 1) {
      const action = activeHistory[activeHistoryIdx + 1].action;
      projectActions.redo();
      setStatusMessage({ text: `Redid ${action}`, type: 'info' });
    }
  };

  const handleSetColorModeWithStatus = (mode: ColorMode) => {
    projectActions.setColorMode(mode);
    setStatusMessage({ text: `Changed to ${mode.toUpperCase()} mode`, type: 'info' });
  };

  const commands = useAppCommands({
    state,
    updateState: updateStateWithStatus,
    projectActions: {
      ...projectActions,
      canUndo,
      canRedo,
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
      toggleFileTree: () => layoutActions.togglePaneVisibility('file-tree'),
      togglePalette: () => layoutActions.togglePaneVisibility('palette'),
      toggleTimeline: () => layoutActions.togglePaneVisibility('timeline'),
      toggleRightPanel: () => layoutActions.togglePaneVisibility('layers'),
    },
    openCmdPalette,
    onOpenProject: handleOpenFile,
  });

  useKeyboard(commands, state, (newState) => updateState(newState), {
    deleteSelectedLayers: projectActions.deleteSelectedLayers,
    deleteSelectedFrames: projectActions.deleteSelectedFrames,
    handleMovePixels: canvasTools.handleMovePixels,
  });

  let selectionSize: { w: number; h: number } | null = null;
  if (state.selection) {
    const selSet =
      state.selection instanceof Set
        ? state.selection
        : new Set<number>(Array.from(state.selection as any));
    if (selSet.size > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      selSet.forEach((idx) => {
        const { x, y } = getCoords(idx, state.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
      selectionSize = { w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }

  const layoutProjectActions = {
    ...projectActions,
    undo: handleUndoWithStatus,
    redo: handleRedoWithStatus,
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

  // Decouple Layer & Animation Tag editors from docked panels when hidden or on mobile
  const isPaneActiveOnDesktop = (paneId: string) => {
    if (isMobile) return false;
    if (layout.floatingPanes.some((fp) => fp.id === paneId)) return true;
    return Object.values(layout.slots).some(
      (slot: any) => slot.visible && slot.groups.some((g: any) => g.activePaneId === paneId)
    );
  };

  const isLayersPaneVisible = isPaneActiveOnDesktop('layers');
  const isTimelinePaneVisible = isPaneActiveOnDesktop('timeline');
  const showModalLayerProperties = Boolean(
    layerPropertiesState.isOpen && layerPropertiesState.layer && !isLayersPaneVisible
  );
  const showModalTagProperties = Boolean(
    tagPropertiesState.isOpen && tagPropertiesState.tag && !isTimelinePaneVisible
  );

  const hasStateDialogOpen =
    isResizeCanvasDialogOpen ||
    isReferenceImageDialogOpen ||
    exportDialog.isOpen ||
    isSpritePropertiesOpen ||
    isSlicesOpen ||
    isOutlineDialogOpen ||
    showModalTagProperties;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground select-none">
      <StudioToaster />
      <StudioConfirmHost />

      <AppDialogs
        isCmdPaletteOpen={isCmdPaletteOpen}
        onCloseCmdPalette={closeCmdPalette}
        commands={isCmdPaletteOpen ? commands : EMPTY_COMMANDS}
        isNewProjectDialogOpen={isNewProjectDialogOpen}
        onCloseNewProjectDialog={closeNewProjectDialog}
        onCreateProject={projectActions.createProject}
        existingProjectCount={isNewProjectDialogOpen ? projects.length : 0}
        isResizeCanvasDialogOpen={isResizeCanvasDialogOpen}
        onCloseResizeCanvasDialog={closeResizeCanvasDialog}
        onResizeCanvas={projectActions.resizeCanvas}
        isReferenceImageDialogOpen={isReferenceImageDialogOpen}
        onCloseReferenceImageDialog={closeReferenceImageDialog}
        onSetReferenceImage={projectActions.setReferenceImage}
        onPreviewReferenceImage={handlePreviewReferenceImage}
        onRevertReferenceImage={handleRevertReferenceImage}
        exportDialog={exportDialog}
        onCloseExportDialog={closeExportDialog}
        isSpritePropertiesOpen={isSpritePropertiesOpen}
        onCloseSpriteProperties={closeSpriteProperties}
        onUpdateSpriteProperties={projectActions.updateSpriteProperties}
        onPreviewSpriteProperties={handlePreviewSpriteProperties}
        onRevertSpriteProperties={handleRevertSpriteProperties}
        isSlicesOpen={isSlicesOpen}
        onCloseSlices={closeSlices}
        onUpdateSlices={projectActions.updateSlices}
        onPreviewSlices={handlePreviewSlices}
        onRevertSlices={handleRevertSlices}
        isOutlineDialogOpen={isOutlineDialogOpen}
        onCloseOutlineDialog={closeOutlineDialog}
        onOutlinePreview={handleOutlinePreview}
        onOutlineConfirm={handleOutlineConfirm}
        onOutlineCancel={handleOutlineCancel}
        showModalLayerProperties={showModalLayerProperties}
        layerPropertiesLayer={layerPropertiesState.layer}
        onCloseLayerProperties={closeLayerProperties}
        onUpdateLayer={projectActions.updateLayer}
        onPreviewLayer={handlePreviewLayer}
        onRevertLayerPreview={handleRevertLayerPreview}
        showModalTagProperties={showModalTagProperties}
        tagPropertiesTag={tagPropertiesState.tag}
        tagPropertiesIsNew={tagPropertiesState.isNew}
        onCloseTagProperties={closeTagPopover}
        onSaveTag={projectActions.saveTag}
        onDeleteTag={projectActions.deleteTag}
        onPreviewTag={handlePreviewTag}
        onRevertTagPreview={handleRevertTagPreview}
        dialogState={hasStateDialogOpen ? state : null}
      />

      {isMobile ? (
        <MobileLayout
          state={state}
          updateState={updateState}
          commands={commands}
          projectActions={layoutProjectActions}
          activeProjectId={activeProjectId}
          tabs={tabs}
          recentProjects={recentProjects}
          history={history}
          historyIndex={historyIndex}
          canUndo={canUndo}
          canRedo={canRedo}
          activeTagPopover={CLOSED_TAG_PROPS}
          onCloseTagPopover={closeTagPopover}
          layerPropertiesState={CLOSED_LAYER_PROPS}
          onCloseLayerProperties={closeLayerProperties}
          canvasTools={canvasTools}
          handleFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          setMousePos={setCursorMousePos}
          setDragStartPos={setCursorDragStartPos}
          selectionSize={selectionSize}
          onScalePixels={canvasTools.handleScalePixels}
          fitTrigger={fitTrigger}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onZoomFit={handleZoomFit}
          onQuickCreate={handleQuickCreate}
          onImportFile={handleImportFile}
          onPreviewLayer={handlePreviewLayer}
          onRevertLayerPreview={handleRevertLayerPreview}
          onPreviewTag={handlePreviewTag}
          onRevertTagPreview={handleRevertTagPreview}
        />
      ) : (
        <DesktopLayout
          state={state}
          updateState={updateState}
          commands={commands}
          projectActions={layoutProjectActions}
          activeProjectId={activeProjectId}
          tabs={tabs}
          recentProjects={recentProjects}
          history={history}
          historyIndex={historyIndex}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenCommandPalette={openCmdPalette}
          activeTagPopover={isTimelinePaneVisible ? tagPropertiesState : CLOSED_TAG_PROPS}
          onCloseTagPopover={closeTagPopover}
          layerPropertiesState={isLayersPaneVisible ? layerPropertiesState : CLOSED_LAYER_PROPS}
          onCloseLayerProperties={closeLayerProperties}
          canvasTools={canvasTools}
          fileSystem={fileSystem}
          handleFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          setMousePos={setCursorMousePos}
          setDragStartPos={setCursorDragStartPos}
          selectionSize={selectionSize}
          layoutActions={layoutActions}
          slots={layout.slots}
          floatingPanes={layout.floatingPanes}
          draggedPane={layout.draggedPane}
          dragOverSlot={layout.dragOverSlot}
          dragOverIndex={layout.dragOverIndex}
          dragOverZone={layout.dragOverZone}
          onScalePixels={canvasTools.handleScalePixels}
          fitTrigger={fitTrigger}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onZoomFit={handleZoomFit}
          onQuickCreate={handleQuickCreate}
          onImportFile={handleImportFile}
          onPreviewLayer={handlePreviewLayer}
          onRevertLayerPreview={handleRevertLayerPreview}
          onPreviewTag={handlePreviewTag}
          onRevertTagPreview={handleRevertTagPreview}
        />
      )}
    </div>
  );
}
