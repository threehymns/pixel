import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { Command, Position, ProjectState, SelectionMask, ToolType } from '../types';
import { MAX_BRUSH_SIZE, SELECTION_TOOLS } from '../constants';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { LayersPanel } from './LayersPanel';
import { Timeline } from './Timeline';
import { HistoryPanel } from './HistoryPanel';
import { Preview } from './Preview';
import { ColorPicker } from './ColorPicker';
import { Home } from './Home';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerTitle,
} from './ui/drawer';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { CustomSlider } from './ui/slider';
import { Button, IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Switch } from './ui/switch';
import { Toolbar } from './ui/toolbar';
import { ScrollArea } from './ui/scroll-area';
import {
  ArrowRightLeft,
  BoxSelect,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Command as CommandIcon,
  Crop,
  Download,
  Droplets,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  Grid,
  Hand,
  History as HistoryIcon,
  Home as HomeIcon,
  Image as ImageIcon,
  Lasso,
  Layers,
  Maximize,
  Maximize2,
  Menu as MenuIcon,
  Minus,
  MousePointer2,
  PaintBucket,
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Play,
  Plus,
  Redo,
  Replace,
  Scissors,
  Settings,
  Sliders,
  Sparkles,
  Square,
  Tag,
  Undo,
  Wand2,
  Waves,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from './Icons';

interface MobileTabInfo {
  id: string;
  title: string;
  isDirty?: boolean;
}

interface MobileLayoutProps {
  state: ProjectState;
  updateState: (s: ProjectState | ((prev: ProjectState) => ProjectState), config?: any) => void;
  commands: Command[];
  projectActions: any;
  activeProjectId: string;
  tabs?: MobileTabInfo[];
  recentProjects: any[];
  history: any[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  canvasTools: any;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  mousePos?: Position | null;
  dragStartPos?: Position | null;
  selectionSize: { w: number; h: number } | null;
  setMousePos: (pos: Position | null) => void;
  setDragStartPos: (pos: Position | null) => void;
  onScalePixels: (selection: SelectionMask, srcBox: any, destBox: any) => void;
  activeTagPopover?: any;
  onCloseTagPopover?: () => void;
  layerPropertiesState?: { isOpen: boolean; layer: any };
  onCloseLayerProperties?: () => void;
  fitTrigger?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onZoomFit?: () => void;
  onQuickCreate?: (width: number, height: number) => void;
  onImportFile?: (file: File) => void;
  onPreviewLayer?: (id: string, updates: any) => void;
  onRevertLayerPreview?: (id: string, snapshot: any) => void;
  onPreviewTag?: (tag: any) => void;
  onRevertTagPreview?: (snapshotTag: any) => void;
}

type MobilePanel =
  | 'palette'
  | 'layers'
  | 'timeline'
  | 'history'
  | 'menu'
  | 'preview'
  | 'projects'
  | null;

const PANEL_TITLES: Record<Exclude<MobilePanel, null>, string> = {
  palette: 'Palette',
  layers: 'Layers',
  timeline: 'Timeline',
  history: 'History',
  menu: 'Studio Menu',
  preview: 'Preview',
  projects: 'Open Projects',
};

const MOBILE_TOOLS: { id: ToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'pencil', icon: <Pencil size={18} />, label: 'Pencil' },
  { id: 'eraser', icon: <Eraser size={18} />, label: 'Eraser' },
  { id: 'bucket', icon: <PaintBucket size={18} />, label: 'Fill' },
  { id: 'color-replace', icon: <Replace size={18} />, label: 'Color Replace' },
  { id: 'eyedropper', icon: <Pipette size={18} />, label: 'Picker' },
  { id: 'move', icon: <MousePointer2 size={18} />, label: 'Move' },
  { id: 'rect', icon: <Square size={18} />, label: 'Rectangle' },
  { id: 'filled-rect', icon: <Square size={18} className="fill-current" />, label: 'Filled Rect' },
  { id: 'ellipse', icon: <Circle size={18} />, label: 'Ellipse' },
  { id: 'filled-ellipse', icon: <Circle size={18} className="fill-current" />, label: 'Filled Ellipse' },
  { id: 'line', icon: <Minus size={18} className="-rotate-45" />, label: 'Line' },
  { id: 'smudge', icon: <Hand size={18} />, label: 'Smudge' },
  { id: 'blur', icon: <Droplets size={18} />, label: 'Blur' },
  { id: 'sharpen', icon: <Zap size={18} />, label: 'Sharpen' },
  { id: 'rect-select', icon: <BoxSelect size={18} />, label: 'Rect Select' },
  { id: 'ellipse-select', icon: <Circle size={18} />, label: 'Ellipse Select' },
  { id: 'lasso-select', icon: <Lasso size={18} />, label: 'Lasso Select' },
  { id: 'poly-lasso-select', icon: <Scissors size={18} />, label: 'Poly Lasso' },
  { id: 'magic-wand', icon: <Wand2 size={18} />, label: 'Magic Wand' },
];

const MOBILE_BRUSH_TOOLS: ToolType[] = [
  'pencil',
  'eraser',
  'smudge',
  'line',
  'rect',
  'filled-rect',
  'ellipse',
  'filled-ellipse',
  'blur',
  'sharpen',
  'color-replace',
];

const MOBILE_SELECTION_MODES = [
  { mode: 'replace', label: 'New', icon: <Square size={14} /> },
  { mode: 'add', label: 'Add', icon: <Plus size={14} /> },
  { mode: 'subtract', label: 'Subtract', icon: <Minus size={14} /> },
  { mode: 'intersect', label: 'Intersect', icon: <Waves size={14} /> },
] as const;

const NOOP = () => {};

const MobileWorkspace: React.FC<Omit<MobileLayoutProps, 'handleFileChange'>> = ({
  state,
  updateState,
  commands,
  projectActions,
  activeProjectId,
  tabs = [],
  recentProjects,
  history,
  historyIndex,
  canUndo,
  canRedo,
  canvasTools,
  fileInputRef,
  setMousePos,
  setDragStartPos,
  activeTagPopover,
  onCloseTagPopover,
  layerPropertiesState,
  onCloseLayerProperties,
  onScalePixels,
  fitTrigger,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  onPreviewLayer,
  onRevertLayerPreview,
  onPreviewTag,
  onRevertTagPreview,
}) => {
  const [activePanel, setActivePanel] = useState<MobilePanel>(null);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isDraggingTray, setIsDraggingTray] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const trayRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);
  const dragScale = useTransform(dragY, [-18, 0, 220], [1.005, 1, 0.985]);
  const suppressClickRef = useRef(false);
  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    isDragging: boolean;
    captured: boolean;
  } | null>(null);

  const closePanel = () => setActivePanel(null);

  const handleTrayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-slot="slider-control"], [role="slider"], input[type="range"]')) {
      return;
    }

    dragY.stop();
    suppressClickRef.current = false;
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      isDragging: false,
      captured: false,
    };
  };

  const handleTrayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const rawDeltaY = e.clientY - session.startY;
    const absDeltaX = Math.abs(e.clientX - session.startX);

    if (!session.isDragging) {
      if (Math.abs(rawDeltaY) < 6 && absDeltaX < 6) return;
      if (absDeltaX > Math.abs(rawDeltaY)) {
        dragSessionRef.current = null;
        return;
      }

      session.isDragging = true;
      suppressClickRef.current = true;
      setIsDraggingTray(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        session.captured = true;
      } catch {
        // Ignore if pointer capture is unsupported
      }
    }

    const now = performance.now();
    const dt = now - session.lastTime;
    if (dt > 0) {
      const instantVy = ((e.clientY - session.lastY) / dt) * 1000;
      session.velocityY = session.velocityY * 0.45 + instantVy * 0.55;
      session.lastY = e.clientY;
      session.lastTime = now;
    }

    dragY.set(rawDeltaY < 0 ? Math.max(-18, rawDeltaY * 0.16) : rawDeltaY);
  };

  const handleTrayPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    if (session.captured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    }

    dragSessionRef.current = null;
    setIsDraggingTray(false);

    if (!session.isDragging) return;

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const currentY = dragY.get();
    const trayHeight = trayRef.current?.offsetHeight ?? 200;
    const dismissDistance = Math.min(72, trayHeight * 0.35);
    const timeSinceMove = performance.now() - session.lastTime;
    const vy = timeSinceMove > 90 ? 0 : session.velocityY;

    const shouldDismiss =
      e.type !== 'pointercancel' &&
      ((currentY > dismissDistance && vy >= -80) || (vy > 420 && currentY > 16));

    if (shouldDismiss) {
      if (!shouldReduceMotion) {
        const targetY = currentY + Math.min(80, Math.max(0, vy * 0.06));
        animate(dragY, targetY, { duration: 0.16, ease: [0.22, 1, 0.36, 1] });
      }
      setIsSettingsExpanded(false);
    } else if (shouldReduceMotion) {
      dragY.set(0);
    } else {
      animate(dragY, 0, { type: 'spring', stiffness: 540, damping: 34, mass: 0.8 });
    }
  };

  const isBrushTool = MOBILE_BRUSH_TOOLS.includes(state.tool);
  const isFillTool = state.tool === 'bucket';
  const isMagicWand = state.tool === 'magic-wand';
  const isSelectionTool = SELECTION_TOOLS.includes(state.tool);
  const isMoveTool = state.tool === 'move';
  const hasAnySettings =
    isBrushTool || isFillTool || isMagicWand || isSelectionTool || isMoveTool;

  useEffect(() => {
    if (isSettingsExpanded && hasAnySettings) {
      if (shouldReduceMotion) {
        dragY.set(0);
      } else {
        animate(dragY, 0, { type: 'spring', stiffness: 520, damping: 36, mass: 0.8 });
      }
    }
  }, [isSettingsExpanded, hasAnySettings, dragY, shouldReduceMotion]);

  const toggleSymmetryX = () =>
    updateState((prev) => ({ ...prev, symmetry: { ...prev.symmetry, x: !prev.symmetry.x } }));
  const toggleSymmetryY = () =>
    updateState((prev) => ({ ...prev, symmetry: { ...prev.symmetry, y: !prev.symmetry.y } }));

  const getSettingsSummary = () => {
    if (isBrushTool) return `${state.brushSize}px`;
    if (isFillTool || isMagicWand) return state.fillContiguous ? 'Contig.' : 'Global';
    if (isSelectionTool) return state.selectionMode.slice(0, 3).toUpperCase();
    if (isMoveTool) return state.rotationAlgorithm === 'rotsprite' ? 'RotSprite' : 'Nearest';
    return 'Options';
  };

  const handleSwapColors = () => {
    updateState((prev) => ({
      ...prev,
      primaryColor: prev.secondaryColor,
      secondaryColor: prev.primaryColor,
      ...(prev.inkType === 'shading' ? { shades: [...prev.shades].reverse() } : {}),
    }));
  };

  const handleCanvasDrawStart = (pos: any) => {
    setDragStartPos(pos);
    canvasTools.handleDrawStart(pos, { shift: false, ctrl: false, alt: false, meta: false });
  };

  const handleCanvasDrawEnd = () => {
    setDragStartPos(null);
    canvasTools.handleDrawEnd();
  };

  const handleCanvasSelectionUpdate = (sel: SelectionMask | null) => {
    updateState((prev) => ({ ...prev, selection: sel }), {
      action: 'Select Area',
      tool: projectActions.getActiveState().tool,
    });
  };

  const handleCanvasZoom = (z: number) => {
    updateState((prev) => ({ ...prev, zoom: z }));
  };

  const handleExport = () => {
    if (projectActions.openExportDialog) {
      projectActions.openExportDialog();
    } else {
      projectActions.downloadImage();
    }
  };

  const activeTab = tabs.find((t) => t.id === activeProjectId);
  const projectTitle = activeTab?.title || state.title || 'Untitled';
  const isDirty = Boolean(activeTab?.isDirty);

  return (
    <>
      {/* Docked Top Studio Header (44px+ Touch Targets) */}
      <header className="z-20 flex h-12 shrink-0 items-center justify-between gap-1 border-b border-border bg-card px-1.5 safe-top">
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            variant="ghost"
            size="touch"
            onClick={() => setActivePanel('menu')}
            aria-label="Studio Menu"
            className="text-foreground"
          >
            <MenuIcon size={20} />
          </IconButton>

          <IconButton
            variant="ghost"
            size="touch"
            onClick={projectActions.undo}
            disabled={!canUndo}
            aria-label="Undo"
            className="text-foreground"
          >
            <Undo size={18} />
          </IconButton>

          <IconButton
            variant="ghost"
            size="touch"
            onClick={projectActions.redo}
            disabled={!canRedo}
            aria-label="Redo"
            className="text-foreground"
          >
            <Redo size={18} />
          </IconButton>
        </div>

        {/* Project / Tab & Home Switcher */}
        <button
          type="button"
          onClick={() => setActivePanel('projects')}
          aria-label="Switch open projects or return to Home"
          className="flex h-11 min-w-0 max-w-[160px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[220px]"
        >
          <span className="truncate">{projectTitle}</span>
          {isDirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Unsaved changes"
            />
          )}
          <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <Toggle
            variant="tint"
            size="touch"
            pressed={state.showGrid}
            onPressedChange={(pressed) => updateState((prev) => ({ ...prev, showGrid: pressed }))}
            aria-label="Toggle Grid"
          >
            <Grid size={18} />
          </Toggle>

          <IconButton
            variant="ghost"
            size="touch"
            onClick={() => setActivePanel('preview')}
            aria-label="Preview Animation"
          >
            <Play size={18} />
          </IconButton>

          <Button
            variant="primary"
            size="touch"
            onClick={handleExport}
            aria-label="Export"
            className="ml-0.5 px-3"
          >
            <Download size={14} />
            <span className="hidden xs:inline sm:inline">Export</span>
          </Button>
        </div>
      </header>

      {/* Unobstructed Central Canvas Stage */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
        <Canvas
          projectId={state.id}
          frames={state.frames}
          activeFrameIndex={state.activeFrameIndex}
          layers={state.layers}
          activeLayerId={state.activeLayerId}
          palette={state.palette}
          colorMode={state.colorMode}
          width={state.width}
          height={state.height}
          zoom={state.zoom}
          tool={state.tool}
          brushSize={state.brushSize}
          brushShape={state.brushShape}
          showGrid={state.showGrid}
          onionSkin={state.onionSkin}
          tiled={state.tiled}
          symmetryX={state.symmetry.x}
          symmetryY={state.symmetry.y}
          selection={state.selection}
          selectionMode={state.selectionMode}
          fillContiguous={state.fillContiguous}
          rotationAlgorithm={state.rotationAlgorithm}
          referenceImage={state.referenceImage}
          onDrawStart={handleCanvasDrawStart}
          onDraw={canvasTools.handleDraw}
          onDrawEnd={handleCanvasDrawEnd}
          onSelectionUpdate={handleCanvasSelectionUpdate}
          onMovePixels={canvasTools.handleMovePixels}
          onRotatePixels={canvasTools.handleRotatePixels}
          onScalePixels={onScalePixels}
          onZoom={handleCanvasZoom}
          onMousePosUpdate={setMousePos}
          fitTrigger={fitTrigger}
        />

        {/* Contextual Selection Bar */}
        <AnimatePresence>
          {!isSettingsExpanded && state.selection && state.selection.size > 0 && (
            <motion.div
              key="mobile-selection-bar"
              initial={shouldReduceMotion ? { opacity: 0 } : { y: 'calc(100% + 16px)' }}
              animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0, transition: { duration: 0.08 } }
                  : {
                      y: 'calc(100% + 16px)',
                      transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
                    }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.08 }
                  : { type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }
              }
              className="pointer-events-auto absolute right-3 bottom-3 left-3 z-10 flex justify-center"
            >
              <div className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-card p-1 shadow-xl">
                <Button
                  variant="primary"
                  size="touch"
                  onClick={() => projectActions.openOutlineDialog?.()}
                >
                  <Sparkles size={14} />
                  <span>Outline</span>
                </Button>
                <Button
                  variant="ghost"
                  size="touch"
                  onClick={() => updateState((prev) => ({ ...prev, selection: null }), { action: 'Deselect' })}
                >
                  <X size={14} />
                  <span>Deselect</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Tool Settings Tray */}
        <AnimatePresence>
          {isSettingsExpanded && hasAnySettings && (
            <motion.div
              key="mobile-tool-settings-tray"
              initial={shouldReduceMotion ? { opacity: 0 } : { y: 'calc(100% + 16px)' }}
              animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0, transition: { duration: 0.08 } }
                  : {
                      y: 'calc(100% + 16px)',
                      transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
                    }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.08 }
                  : { type: 'spring', stiffness: 440, damping: 34, mass: 0.85 }
              }
              className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 mx-auto max-w-sm"
            >
              <motion.div
                ref={trayRef}
                style={{ y: dragY, scale: dragScale }}
                onPointerDown={handleTrayPointerDown}
                onPointerMove={handleTrayPointerMove}
                onPointerUp={handleTrayPointerUpOrCancel}
                onPointerCancel={handleTrayPointerUpOrCancel}
                onClickCapture={(e) => {
                  if (suppressClickRef.current) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                }}
                className="pointer-events-auto flex flex-col gap-3 rounded-xl border border-border-strong bg-card p-3.5 shadow-2xl select-none touch-none"
              >
                <button
                  type="button"
                  onClick={() => setIsSettingsExpanded(false)}
                  aria-label="Collapse Tool Settings"
                  className="group mx-auto -my-1.5 flex w-20 cursor-grab items-center justify-center rounded-full py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                >
                  <span
                    className={`h-1 rounded-full transition-all duration-150 ${
                      isDraggingTray
                        ? 'w-11 bg-muted-foreground'
                        : 'w-9 bg-border-strong group-hover:bg-muted-foreground'
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Tool Settings</span>
                </div>

                {isBrushTool && (
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Brush Size
                        </span>
                        <span className="font-mono text-xs text-foreground tabular-nums">
                          {state.brushSize}px
                        </span>
                      </div>
                      <CustomSlider
                        min={1}
                        max={MAX_BRUSH_SIZE}
                        value={state.brushSize}
                        onValueChange={(val) => updateState((prev) => ({ ...prev, brushSize: val }))}
                        aria-label="Brush size"
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">Shape</span>
                        <SegmentedControl
                          value={state.brushShape}
                          onValueChange={(val) => {
                            if (val === 'square' || val === 'circle') {
                              updateState((prev) => ({ ...prev, brushShape: val }));
                            }
                          }}
                        >
                          <SegmentedControlIndicator />
                          <SegmentedControlItem value="square" className="h-11">
                            <Square size={15} />
                          </SegmentedControlItem>
                          <SegmentedControlItem value="circle" className="h-11">
                            <Circle size={15} />
                          </SegmentedControlItem>
                        </SegmentedControl>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Symmetry
                        </span>
                        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-0.5">
                          <Toggle
                            variant="tint"
                            size="touch"
                            pressed={state.symmetry.x}
                            onPressedChange={toggleSymmetryX}
                            aria-label="Horizontal Symmetry"
                            className="w-full"
                          >
                            <FlipHorizontal size={16} />
                          </Toggle>
                          <Toggle
                            variant="tint"
                            size="touch"
                            pressed={state.symmetry.y}
                            onPressedChange={toggleSymmetryY}
                            aria-label="Vertical Symmetry"
                            className="w-full"
                          >
                            <FlipVertical size={16} />
                          </Toggle>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Toggle
                        variant="tint"
                        size="touch"
                        pressed={state.inkType === 'shading'}
                        onPressedChange={(pressed) =>
                          updateState((prev) => ({
                            ...prev,
                            inkType: pressed ? 'shading' : 'simple',
                          }))
                        }
                        className="flex-1 border border-border"
                      >
                        <Droplets size={15} />
                        <span>{state.inkType === 'shading' ? 'Shading Ink' : 'Simple Ink'}</span>
                      </Toggle>

                      {state.tool === 'pencil' && (
                        <Toggle
                          variant="tint"
                          size="touch"
                          pressed={state.pixelPerfect}
                          onPressedChange={(pressed) =>
                            updateState((prev) => ({ ...prev, pixelPerfect: pressed }))
                          }
                          className="flex-1 border border-border"
                        >
                          <Zap size={15} />
                          <span>Pixel Perfect</span>
                        </Toggle>
                      )}
                    </div>

                    {state.tool === 'smudge' && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Smudge Mode
                          </span>
                          <SegmentedControl
                            value={state.smudgeMode || 'blend'}
                            onValueChange={(val) => {
                              if (val === 'blend' || val === 'push') {
                                updateState((prev) => ({ ...prev, smudgeMode: val }));
                              }
                            }}
                            className="w-auto"
                          >
                            <SegmentedControlIndicator />
                            <SegmentedControlItem value="blend" className="h-11 px-3">
                              Blend
                            </SegmentedControlItem>
                            <SegmentedControlItem value="push" className="h-11 px-3">
                              Push
                            </SegmentedControlItem>
                          </SegmentedControl>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Strength
                            </span>
                            <span className="font-mono text-xs text-foreground tabular-nums">
                              {Math.round((state.smudgeStrength ?? 0.7) * 100)}%
                            </span>
                          </div>
                          <CustomSlider
                            min={10}
                            max={100}
                            step={5}
                            value={Math.round((state.smudgeStrength ?? 0.7) * 100)}
                            onValueChange={(val) =>
                              updateState((prev) => ({ ...prev, smudgeStrength: val / 100 }))
                            }
                            aria-label="Smudge strength"
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(isFillTool || isMagicWand) && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Fill Scope
                    </span>
                    <SegmentedControl
                      value={state.fillContiguous ? 'contiguous' : 'global'}
                      onValueChange={(val) =>
                        updateState((prev) => ({ ...prev, fillContiguous: val === 'contiguous' }))
                      }
                    >
                      <SegmentedControlIndicator />
                      <SegmentedControlItem value="contiguous" className="h-11">
                        Contiguous
                      </SegmentedControlItem>
                      <SegmentedControlItem value="global" className="h-11">
                        Global
                      </SegmentedControlItem>
                    </SegmentedControl>
                  </div>
                )}

                {isMoveTool && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Rotation Algorithm
                    </span>
                    <SegmentedControl
                      value={state.rotationAlgorithm}
                      onValueChange={(val) => {
                        if (val === 'nearest' || val === 'rotsprite') {
                          updateState((prev) => ({ ...prev, rotationAlgorithm: val }));
                        }
                      }}
                    >
                      <SegmentedControlIndicator />
                      <SegmentedControlItem value="nearest" className="h-11">
                        Nearest
                      </SegmentedControlItem>
                      <SegmentedControlItem value="rotsprite" className="h-11">
                        RotSprite
                      </SegmentedControlItem>
                    </SegmentedControl>
                  </div>
                )}

                {isSelectionTool && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Selection Mode
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MOBILE_SELECTION_MODES.map((m) => (
                        <Toggle
                          key={m.mode}
                          variant="solid"
                          size="touch"
                          pressed={state.selectionMode === m.mode}
                          onPressedChange={() =>
                            updateState((prev) => ({ ...prev, selectionMode: m.mode as any }))
                          }
                          className="w-full border border-border"
                        >
                          {m.icon}
                          <span>{m.label}</span>
                        </Toggle>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Docked Two-Row Bottom Bar (44px+ Touch Targets) */}
      <footer className="z-20 shrink-0 border-t border-border bg-card pb-safe">
        {/* Row 1: Scrollable Drawing Tool Strip */}
        <Toolbar
          aria-label="Drawing tools"
          className="flex h-13 items-center gap-1 overflow-x-auto border-b border-border bg-background/40 px-2 no-scrollbar"
        >
          {MOBILE_TOOLS.map((tool) => (
            <Toggle
              key={tool.id}
              variant="solid"
              size="touch"
              pressed={state.tool === tool.id}
              onPressedChange={() => updateState((prev) => ({ ...prev, tool: tool.id }))}
              aria-label={tool.label}
              className="px-0"
            >
              {tool.icon}
            </Toggle>
          ))}
        </Toolbar>

        {/* Row 2: Color Swatches, Tool Options & Panel Drawers */}
        <div className="flex h-14 items-center justify-between gap-1.5 px-2">
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Primary Color"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ backgroundColor: state.primaryColor }}
                  />
                }
              >
                {state.inkType === 'shading' && (
                  <Droplets size={15} className="text-white/75 mix-blend-difference" />
                )}
              </PopoverTrigger>
              <PopoverContent side="top" align="start" sideOffset={10} className="w-auto p-3">
                <ColorPicker
                  color={state.primaryColor}
                  onChange={(c) => updateState((prev) => ({ ...prev, primaryColor: c }))}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Secondary Color"
                    className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ backgroundColor: state.secondaryColor }}
                  />
                }
              />
              <PopoverContent side="top" align="start" sideOffset={10} className="w-auto p-3">
                <ColorPicker
                  color={state.secondaryColor}
                  onChange={(c) => updateState((prev) => ({ ...prev, secondaryColor: c }))}
                />
              </PopoverContent>
            </Popover>

            <IconButton
              variant="outline"
              size="touch"
              onClick={handleSwapColors}
              aria-label="Swap Colors"
            >
              <ArrowRightLeft size={15} />
            </IconButton>

            {hasAnySettings && (
              <Toggle
                variant="tint"
                size="touch"
                pressed={isSettingsExpanded}
                onPressedChange={setIsSettingsExpanded}
                aria-label="Tool Settings"
                aria-expanded={isSettingsExpanded}
                className="border border-border px-2.5"
              >
                <Sliders size={14} className="text-primary" />
                <span className="font-mono text-[11px] tabular-nums">{getSettingsSummary()}</span>
                {isSettingsExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </Toggle>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <Toggle
              variant="tint"
              size="touch"
              pressed={activePanel === 'palette'}
              onPressedChange={(p) => setActivePanel(p ? 'palette' : null)}
              aria-label="Palette"
              className="px-0"
            >
              <PaletteIcon size={20} />
            </Toggle>
            <Toggle
              variant="tint"
              size="touch"
              pressed={activePanel === 'layers'}
              onPressedChange={(p) => setActivePanel(p ? 'layers' : null)}
              aria-label="Layers"
              className="px-0"
            >
              <Layers size={20} />
            </Toggle>
            <Toggle
              variant="tint"
              size="touch"
              pressed={activePanel === 'timeline'}
              onPressedChange={(p) => setActivePanel(p ? 'timeline' : null)}
              aria-label="Timeline"
              className="px-0"
            >
              <Clock size={20} />
            </Toggle>
            <Toggle
              variant="tint"
              size="touch"
              pressed={activePanel === 'history'}
              onPressedChange={(p) => setActivePanel(p ? 'history' : null)}
              aria-label="History"
              className="px-0"
            >
              <HistoryIcon size={20} />
            </Toggle>
          </div>
        </div>
      </footer>

      {/* Native @ui-sdk/react Drawer for Mobile Panels, Studio Menu & Project Switcher */}
      <Drawer
        open={activePanel !== null}
        onOpenChange={(open) => {
          if (!open) setActivePanel(null);
        }}
        side="bottom"
        snapPoints={[0.58, 0.9]}
        defaultSnapPoint={0.58}
      >
        <DrawerBackdrop />
        <DrawerContent
          initialFocus="content"
          className="h-[90dvh] max-h-[90dvh] w-full rounded-t-xl border-t"
        >
          <DrawerHandle />

          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
            <DrawerTitle className="text-sm font-semibold text-foreground">
              {activePanel ? PANEL_TITLES[activePanel] : ''}
            </DrawerTitle>
            <DrawerClose
              render={
                <IconButton variant="ghost" size="touch" aria-label="Close panel">
                  <X size={18} />
                </IconButton>
              }
            />
          </div>

          <DrawerDescription className="sr-only">
            {activePanel ? `${PANEL_TITLES[activePanel]} controls` : 'Panel controls'}
          </DrawerDescription>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-safe">
            {activePanel === 'palette' && (
              <Palette
                density="touch"
                width={0}
                colors={state.palette}
                palettes={state.paletteLibrary}
                activePaletteId={state.activePaletteId}
                primaryColor={state.primaryColor}
                secondaryColor={state.secondaryColor}
                shadingRamp={state.shades}
                onColorSelect={(c, p) =>
                  updateState((prev) =>
                    p ? { ...prev, primaryColor: c } : { ...prev, secondaryColor: c }
                  )
                }
                onAddColor={(c) => {
                  updateState((prev) => ({
                    ...prev,
                    paletteLibrary: prev.paletteLibrary.map((p) =>
                      p.id === prev.activePaletteId ? { ...p, colors: [...p.colors, c] } : p
                    ),
                    palette: [...prev.palette, c],
                  }));
                }}
                onSelectPalette={projectActions.selectPalette}
                onImportPalette={projectActions.importPalette}
                onResizeStart={NOOP}
                onColorsSelected={(selectedColors) => {
                  updateState((prev) => ({ ...prev, shades: selectedColors, inkType: 'shading' }));
                }}
              />
            )}

            {activePanel === 'layers' && (
              <LayersPanel
                density="touch"
                layers={state.layers}
                activeFrame={state.frames[state.activeFrameIndex]}
                activeLayerId={state.activeLayerId}
                selectedLayerIds={state.selectedLayerIds}
                palette={state.palette}
                width={state.width}
                height={state.height}
                onSelectLayers={(ids, active) =>
                  updateState((prev) => ({ ...prev, selectedLayerIds: ids, activeLayerId: active }))
                }
                onUpdateLayer={projectActions.updateLayer}
                onPreviewLayer={onPreviewLayer}
                onRevertLayerPreview={onRevertLayerPreview}
                onAddLayer={projectActions.addLayer}
                onAddGroupLayer={projectActions.addGroupLayer}
                onGroupSelectedLayers={projectActions.groupSelectedLayers}
                onUngroupSelectedLayers={projectActions.ungroupSelectedLayers}
                onAddLayerToGroup={projectActions.addLayerToGroup}
                onToggleCollapseAllGroups={projectActions.toggleCollapseAllGroups}
                onDuplicateLayer={projectActions.duplicateLayer}
                onDeleteLayer={projectActions.deleteLayer}
                onDuplicateSelectedLayers={projectActions.duplicateSelectedLayers}
                onDeleteSelectedLayers={projectActions.deleteSelectedLayers}
                onReorderLayers={projectActions.reorderLayers}
                onOpenLayerProperties={projectActions.openLayerPropertiesDialog}
                layerPropertiesState={layerPropertiesState}
                onCloseLayerProperties={onCloseLayerProperties}
                className="h-full w-full flex-1"
              />
            )}

            {activePanel === 'timeline' && (
              <Timeline
                density="touch"
                layers={state.layers}
                frames={state.frames}
                activeFrameIndex={state.activeFrameIndex}
                activeLayerId={state.activeLayerId}
                selectedFrameIndices={state.selectedFrameIndices}
                selectedLayerIds={state.selectedLayerIds}
                tags={state.tags}
                onSelectFrames={(indices, active, layerId) => {
                  updateState((prev) => ({
                    ...prev,
                    selectedFrameIndices: indices,
                    activeFrameIndex: active,
                    ...(layerId ? { activeLayerId: layerId, selectedLayerIds: [layerId] } : {}),
                  }));
                }}
                onAddFrame={projectActions.addFrame}
                onDuplicateFrame={projectActions.duplicateFrame}
                onDeleteFrame={projectActions.deleteFrame}
                onDuplicateSelectedFrames={projectActions.duplicateSelectedFrames}
                onDeleteSelectedFrames={projectActions.deleteSelectedFrames}
                onInsertFrame={projectActions.insertFrame}
                onTweenFrames={projectActions.tweenFrames}
                onSetFrameDuration={projectActions.setFrameDuration}
                onAddTag={projectActions.addTag}
                onSaveTag={projectActions.saveTag}
                onDeleteTag={projectActions.deleteTag}
                onOpenTagProperties={projectActions.openTagPropertiesDialog}
                activeTagPopover={activeTagPopover}
                onCloseTagPopover={onCloseTagPopover}
                onPreviewTag={onPreviewTag}
                onRevertTagPreview={onRevertTagPreview}
                onSelectLayer={(id) =>
                  updateState((prev) => ({ ...prev, activeLayerId: id, selectedLayerIds: [id] }))
                }
                onAddLayer={projectActions.addLayer}
                onAddGroupLayer={projectActions.addGroupLayer}
                onUpdateLayer={projectActions.updateLayer}
                onToggleLayerVisibility={(id) =>
                  updateState((prev) => ({
                    ...prev,
                    layers: prev.layers.map((l) =>
                      l.id === id ? { ...l, visible: !l.visible } : l
                    ),
                  }))
                }
                onToggleLayerLock={(id) =>
                  updateState((prev) => ({
                    ...prev,
                    layers: prev.layers.map((l) =>
                      l.id === id ? { ...l, locked: !l.locked } : l
                    ),
                  }))
                }
                onReorderLayers={projectActions.reorderLayers}
                onReorderFrames={projectActions.reorderFrames}
              />
            )}

            {activePanel === 'history' && (
              <HistoryPanel
                density="touch"
                history={history}
                historyIndex={historyIndex}
                onJumpToHistory={projectActions.jumpToHistory}
                className="h-full w-full flex-1"
              />
            )}

            {activePanel === 'preview' && (
              <Preview
                density="touch"
                frames={state.frames}
                layers={state.layers}
                palette={state.palette}
                spriteWidth={state.width}
                spriteHeight={state.height}
                activeFrameIndex={state.activeFrameIndex}
                width={0}
              />
            )}

            {activePanel === 'projects' && (
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-4 p-4">
                  <Button
                    variant="outline"
                    size="touch"
                    onClick={() => {
                      projectActions.setActiveProjectId('home');
                      closePanel();
                    }}
                    className="w-full justify-start"
                  >
                    <HomeIcon size={16} className="text-primary" />
                    <span>Home Dashboard</span>
                  </Button>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Open Sprites ({tabs.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {tabs.map((tab) => {
                        const isActive = tab.id === activeProjectId;
                        return (
                          <div
                            key={tab.id}
                            className={`flex min-h-11 items-center gap-1 rounded-lg border px-2 transition-colors ${
                              isActive
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-border bg-background'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                projectActions.setActiveProjectId(tab.id);
                                closePanel();
                              }}
                              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 px-1.5 text-left text-xs font-medium text-foreground"
                            >
                              <span className="truncate">{tab.title}</span>
                              {tab.isDirty && (
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                                  aria-label="Unsaved changes"
                                />
                              )}
                            </button>
                            <IconButton
                              variant="ghost"
                              size="touch"
                              aria-label={`Close ${tab.title}`}
                              onClick={() => projectActions.closeProject(tab.id)}
                            >
                              <X size={15} />
                            </IconButton>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="touch"
                      onClick={() => {
                        projectActions.createProject();
                        closePanel();
                      }}
                    >
                      <Plus size={16} />
                      <span>New Sprite</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="touch"
                      onClick={() => {
                        fileInputRef.current?.click();
                        closePanel();
                      }}
                    >
                      <FolderOpen size={16} />
                      <span>Open File</span>
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}

            {activePanel === 'menu' && (
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-5 p-4">
                  {/* Zoom & View Controls */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Canvas View
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {state.width}×{state.height} · {Math.round(state.zoom * 100)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <Button
                        variant="outline"
                        size="touch"
                        onClick={() => onZoomOut?.()}
                        aria-label="Zoom out"
                      >
                        <ZoomOut size={15} />
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        onClick={() => onZoomReset?.()}
                        aria-label="Reset zoom to 100%"
                        className="font-mono tabular-nums"
                      >
                        100%
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        onClick={() => onZoomIn?.()}
                        aria-label="Zoom in"
                      >
                        <ZoomIn size={15} />
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        onClick={() => {
                          onZoomFit?.();
                          closePanel();
                        }}
                        aria-label="Fit canvas to screen"
                      >
                        <Maximize size={15} />
                        <span>Fit</span>
                      </Button>
                    </div>

                    <div className="divide-y divide-border rounded-lg border border-border bg-background">
                      <div className="flex min-h-11 items-center justify-between px-3 py-2">
                        <span className="text-xs font-medium text-foreground">Pixel Grid</span>
                        <Switch
                          checked={state.showGrid}
                          onCheckedChange={(checked) =>
                            updateState((prev) => ({ ...prev, showGrid: checked }))
                          }
                          aria-label="Toggle Pixel Grid"
                        />
                      </div>
                      <div className="flex min-h-11 items-center justify-between px-3 py-2">
                        <span className="text-xs font-medium text-foreground">Onion Skin</span>
                        <Switch
                          checked={state.onionSkin}
                          onCheckedChange={(checked) =>
                            updateState((prev) => ({ ...prev, onionSkin: checked }))
                          }
                          aria-label="Toggle Onion Skin"
                        />
                      </div>
                      <div className="flex min-h-11 items-center justify-between px-3 py-2">
                        <span className="text-xs font-medium text-foreground">Tiled View</span>
                        <Switch
                          checked={state.tiled}
                          onCheckedChange={(checked) =>
                            updateState((prev) => ({ ...prev, tiled: checked }))
                          }
                          aria-label="Toggle Tiled View"
                        />
                      </div>
                    </div>
                  </div>

                  {/* File & Export */}
                  <div className="space-y-2">
                    <span className="px-0.5 text-xs font-semibold text-muted-foreground">
                      File &amp; Export
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          projectActions.createProject();
                          closePanel();
                        }}
                      >
                        <Plus size={16} className="text-muted-foreground" />
                        <span>New Canvas</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          fileInputRef.current?.click();
                          closePanel();
                        }}
                      >
                        <FolderOpen size={16} className="text-muted-foreground" />
                        <span>Open File</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          projectActions.saveProject();
                          closePanel();
                        }}
                      >
                        <Check size={16} className="text-muted-foreground" />
                        <span>Save Project</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          handleExport();
                          closePanel();
                        }}
                      >
                        <Download size={16} />
                        <span>Export...</span>
                      </Button>
                    </div>
                  </div>

                  {/* Canvas & Tools */}
                  <div className="space-y-2">
                    <span className="px-0.5 text-xs font-semibold text-muted-foreground">
                      Tools &amp; Effects
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          closePanel();
                          commands.find((c) => c.id === 'app.commandPalette')?.perform();
                        }}
                      >
                        <CommandIcon size={16} className="text-primary" />
                        <span>Commands</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          closePanel();
                          projectActions.openOutlineDialog?.();
                        }}
                      >
                        <Sparkles size={16} className="text-primary" />
                        <span>Outline FX...</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="col-span-2 justify-start"
                        onClick={() => {
                          closePanel();
                          commands.find((c) => c.id === 'view.referenceImage')?.perform();
                        }}
                      >
                        <ImageIcon size={16} className="text-muted-foreground" />
                        <span>Reference Image...</span>
                      </Button>
                    </div>
                  </div>

                  {/* Sprite & Properties */}
                  <div className="space-y-2">
                    <span className="px-0.5 text-xs font-semibold text-muted-foreground">
                      Sprite &amp; Properties
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          projectActions.openSpritePropertiesDialog?.();
                          closePanel();
                        }}
                      >
                        <Settings size={16} className="text-primary" />
                        <span>Sprite Properties</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          projectActions.openSlicesDialog?.();
                          closePanel();
                        }}
                      >
                        <Crop size={16} className="text-primary" />
                        <span>Slice Manager</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          commands.find((c) => c.id === 'sprite.resize')?.perform();
                          closePanel();
                        }}
                      >
                        <Maximize2 size={16} className="text-muted-foreground" />
                        <span>Resize Canvas</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="justify-start"
                        onClick={() => {
                          projectActions.openLayerPropertiesDialog?.();
                          closePanel();
                        }}
                      >
                        <Layers size={16} className="text-muted-foreground" />
                        <span>Layer Properties</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="touch"
                        className="col-span-2 justify-start"
                        onClick={() => {
                          projectActions.openTagPropertiesDialog?.();
                          closePanel();
                        }}
                      >
                        <Tag size={16} className="text-primary" />
                        <span>New Animation Tag...</span>
                      </Button>
                    </div>
                  </div>

                  {/* Recent Projects */}
                  <div className="space-y-2">
                    <span className="px-0.5 text-xs font-semibold text-muted-foreground">
                      Recent Projects
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {recentProjects.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                          No recent projects
                        </div>
                      ) : (
                        recentProjects.map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              projectActions.loadRecentProject(p);
                              closePanel();
                            }}
                            className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors active:bg-accent"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-foreground">
                                {p.title}
                              </div>
                              <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                {p.width}×{p.height} ·{' '}
                                {new Date(p.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  state,
  updateState,
  commands,
  projectActions,
  activeProjectId,
  tabs = [],
  recentProjects,
  history,
  historyIndex,
  canUndo,
  canRedo,
  canvasTools,
  fileInputRef,
  handleFileChange,
  selectionSize,
  setMousePos,
  setDragStartPos,
  activeTagPopover,
  onCloseTagPopover,
  layerPropertiesState,
  onCloseLayerProperties,
  onScalePixels,
  fitTrigger,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  onQuickCreate,
  onImportFile,
  onPreviewLayer,
  onRevertLayerPreview,
  onPreviewTag,
  onRevertTagPreview,
}) => {
  const isHome = activeProjectId === 'home';
  const handleImportProject = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`relative flex h-dvh flex-col overflow-hidden bg-background ${
        isHome ? '' : 'overscroll-none'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".aseprite,.ase,.png,.jpg,.jpeg,.gif,.json,.pxa"
        onChange={handleFileChange}
      />

      {isHome ? (
        <Home
          onCreateProject={projectActions.createProject}
          onImportProject={handleImportProject}
          onImportFile={onImportFile}
          onQuickCreate={onQuickCreate}
          recentProjects={recentProjects}
          onOpenRecent={projectActions.loadRecentProject}
          onClearRecent={projectActions.clearRecents}
        />
      ) : (
        <MobileWorkspace
          state={state}
          updateState={updateState}
          commands={commands}
          projectActions={projectActions}
          activeProjectId={activeProjectId}
          tabs={tabs}
          recentProjects={recentProjects}
          history={history}
          historyIndex={historyIndex}
          canUndo={canUndo}
          canRedo={canRedo}
          canvasTools={canvasTools}
          fileInputRef={fileInputRef}
          selectionSize={selectionSize}
          setMousePos={setMousePos}
          setDragStartPos={setDragStartPos}
          activeTagPopover={activeTagPopover}
          onCloseTagPopover={onCloseTagPopover}
          layerPropertiesState={layerPropertiesState}
          onCloseLayerProperties={onCloseLayerProperties}
          onScalePixels={onScalePixels}
          fitTrigger={fitTrigger}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
          onZoomFit={onZoomFit}
          onPreviewLayer={onPreviewLayer}
          onRevertLayerPreview={onRevertLayerPreview}
          onPreviewTag={onPreviewTag}
          onRevertTagPreview={onRevertTagPreview}
        />
      )}
    </div>
  );
};
