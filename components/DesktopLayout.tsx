import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Allotment } from 'allotment';
import { ProjectState, ToolType } from '../types';
import { MAX_BRUSH_SIZE, SELECTION_TOOLS } from '../constants';
import { DragZonePosition } from '../hooks/useLayout';
import { ProjectStateUpdater } from '../hooks/useProject';
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
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIcon,
  MenuSeparator,
  createMenuController,
} from './ui/menu';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from './ui/tooltip';
import { CustomSlider } from './ui/slider';
import { CustomCheckbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Toolbar } from './ui/toolbar';
import {
  ArrowRightLeft,
  BoxSelect,
  ChevronDown,
  Circle,
  Clock,
  Command as CommandIcon,
  Download,
  Droplets,
  Eraser,
  Eye,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  Grid,
  Hand,
  Lasso,
  Layers,
  Minus,
  MousePointer2,
  Move,
  PaintBucket,
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Play,
  PlaySquare,
  Plus,
  Redo,
  Replace,
  Scissors,
  Square,
  Undo,
  Wand2,
  X,
  Zap,
} from './Icons';

const NOOP = () => {};

const SHAPE_TOOLS: ToolType[] = ['rect', 'filled-rect', 'ellipse', 'filled-ellipse'];
const EFFECT_TOOLS: ToolType[] = ['blur', 'sharpen'];
const BRUSH_OPTION_TOOLS: ToolType[] = [
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
const DOCK_SLOTS = ['left', 'right', 'bottom'] as const;

const PANE_METADATA: Record<string, { title: string; icon: React.ReactNode }> = {
  'file-tree': { title: 'Files', icon: <FolderOpen size={13} /> },
  palette: { title: 'Palette', icon: <PaletteIcon size={13} /> },
  layers: { title: 'Layers', icon: <Layers size={13} /> },
  history: { title: 'History', icon: <Clock size={13} /> },
  timeline: { title: 'Timeline', icon: <PlaySquare size={13} /> },
  preview: { title: 'Preview', icon: <Play size={13} /> },
};

const getToolIcon = (t: ToolType, size = 18) => {
  switch (t) {
    case 'rect-select':
      return <BoxSelect size={size} />;
    case 'ellipse-select':
      return <Circle size={size} />;
    case 'lasso-select':
      return <Lasso size={size} />;
    case 'poly-lasso-select':
      return <Scissors size={size} />;
    case 'magic-wand':
      return <Wand2 size={size} />;
    case 'rect':
      return <Square size={size} />;
    case 'filled-rect':
      return <Square size={size} className="fill-current" />;
    case 'ellipse':
      return <Circle size={size} />;
    case 'filled-ellipse':
      return <Circle size={size} className="fill-current" />;
    case 'blur':
      return <Droplets size={size} />;
    case 'sharpen':
      return <Zap size={size} />;
    case 'smudge':
      return <Hand size={size} />;
    default:
      return <BoxSelect size={size} />;
  }
};

interface DesktopLayoutProps {
  state: ProjectState;
  updateState: (s: ProjectStateUpdater, config?: any) => void;
  commands: any[];
  projectActions: any;
  activeProjectId: string;
  tabs: any[];
  recentProjects: any[];
  history: any[];
  historyIndex: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenCommandPalette?: () => void;
  canvasTools: any;
  fileSystem: any;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  mousePos?: any;
  dragStartPos?: any;
  setMousePos: (pos: any) => void;
  setDragStartPos: (pos: any) => void;
  onScalePixels: (selection: Set<number>, srcBox: any, destBox: any) => void;
  selectionSize: any;
  layoutActions: any;
  slots: any;
  floatingPanes: any[];
  draggedPane: { paneId: string; sourceSlot: string; sourceGroupId?: string } | null;
  dragOverSlot: string | null;
  dragOverIndex: { slotId: string; groupId?: string; index: number } | null;
  dragOverZone: { slotId: string; groupId?: string; position: DragZonePosition } | null;
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

interface TabMenuPayload {
  paneId: string;
  slotId: 'left' | 'right' | 'bottom' | 'floating';
  groupId?: string;
}

interface ToolRailProps {
  tool: ToolType;
  primaryColor: string;
  secondaryColor: string;
  onSelectTool: (tool: ToolType) => void;
  onSetPrimaryColor: (color: string) => void;
  onSetSecondaryColor: (color: string) => void;
  onSwapColors: () => void;
}

type ToolFlyoutGroup = 'shapes' | 'effects' | 'selections';

const ToolRail: React.FC<ToolRailProps> = ({
  tool,
  primaryColor,
  secondaryColor,
  onSelectTool,
  onSetPrimaryColor,
  onSetSecondaryColor,
  onSwapColors,
}) => {
  const [prevTool, setPrevTool] = useState<ToolType>(tool);
  const [lastSelectionTool, setLastSelectionTool] = useState<ToolType>('rect-select');
  const [lastShapeTool, setLastShapeTool] = useState<ToolType>('rect');
  const [lastEffectTool, setLastEffectTool] = useState<ToolType>('blur');
  const [openFlyout, setOpenFlyout] = useState<ToolFlyoutGroup | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressNextToggleRef = useRef(false);

  if (tool !== prevTool) {
    setPrevTool(tool);
    if (SELECTION_TOOLS.includes(tool)) {
      setLastSelectionTool(tool);
    }
    if (SHAPE_TOOLS.includes(tool)) {
      setLastShapeTool(tool);
    }
    if (EFFECT_TOOLS.includes(tool)) {
      setLastEffectTool(tool);
    }
  }

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => clearLongPress, []);

  // First click on an inactive grouped tool activates it without opening the flyout;
  // clicking when active, right-clicking, or holding ~300ms opens the flyout.
  const makeFlyoutBindings = (
    group: ToolFlyoutGroup,
    isActive: boolean,
    defaultTool: ToolType
  ) => ({
    open: openFlyout === group,
    onOpenChange: (nextOpen: boolean, details?: { cancel?: () => void }) => {
      if (suppressNextToggleRef.current) {
        suppressNextToggleRef.current = false;
        details?.cancel?.();
        return;
      }
      if (nextOpen) {
        if (!isActive) {
          details?.cancel?.();
          onSelectTool(defaultTool);
          setOpenFlyout(null);
          return;
        }
        setOpenFlyout(group);
      } else {
        setOpenFlyout((curr) => (curr === group ? null : curr));
      }
    },
    triggerProps: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        clearLongPress();
        longPressTimerRef.current = window.setTimeout(() => {
          longPressTimerRef.current = null;
          suppressNextToggleRef.current = true;
          setOpenFlyout(group);
        }, 300);
      },
      onPointerUp: clearLongPress,
      onPointerLeave: clearLongPress,
      onPointerCancel: clearLongPress,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        clearLongPress();
        setOpenFlyout(group);
      },
    },
  });

  const isShapeActive = SHAPE_TOOLS.includes(tool);
  const isEffectActive = EFFECT_TOOLS.includes(tool);
  const isSelectionActive = SELECTION_TOOLS.includes(tool);

  const shapesFlyout = makeFlyoutBindings('shapes', isShapeActive, lastShapeTool);
  const effectsFlyout = makeFlyoutBindings('effects', isEffectActive, lastEffectTool);
  const selectionsFlyout = makeFlyoutBindings('selections', isSelectionActive, lastSelectionTool);

  return (
    <Toolbar
      orientation="vertical"
      aria-label="Drawing tools"
      className="flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto border-r border-border bg-card py-2 no-scrollbar"
    >
      <div className="flex flex-col gap-1 p-1">
        <ToolButton
          active={tool === 'pencil'}
          onClick={() => onSelectTool('pencil')}
          icon={<Pencil size={17} />}
          label="Pencil"
          shortcut="B"
        />
        <ToolButton
          active={tool === 'eraser'}
          onClick={() => onSelectTool('eraser')}
          icon={<Eraser size={17} />}
          label="Eraser"
          shortcut="E"
        />
        <ToolButton
          active={tool === 'line'}
          onClick={() => onSelectTool('line')}
          icon={<Minus size={17} className="-rotate-45" />}
          label="Line"
          shortcut="L"
        />

        <Popover open={shapesFlyout.open} onOpenChange={shapesFlyout.onOpenChange}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Shape Tools"
                      aria-pressed={isShapeActive}
                      {...shapesFlyout.triggerProps}
                      className={`relative flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isShapeActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    />
                  }
                />
              }
            >
              {getToolIcon(lastShapeTool, 17)}
              <span className="clip-path-triangle absolute right-0.5 bottom-0.5 h-1.5 w-1.5 rounded-tl-xs bg-current opacity-60" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span>Shape Tools (hold or right-click for more)</span>
              <TooltipShortcut>U</TooltipShortcut>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="flex w-44 flex-col gap-0.5 p-1.5">
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('rect')}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    tool === 'rect'
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                />
              }
            >
              <Square size={14} />
              <span className="flex-1">Rectangle</span>
              <kbd className="font-mono text-[11px] opacity-70">U</kbd>
            </PopoverClose>
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('filled-rect')}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    tool === 'filled-rect'
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                />
              }
            >
              <Square size={14} className="fill-current" />
              <span className="flex-1">Filled Rect</span>
              <kbd className="font-mono text-[11px] opacity-70">U</kbd>
            </PopoverClose>
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('ellipse')}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    tool === 'ellipse'
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                />
              }
            >
              <Circle size={14} />
              <span className="flex-1">Ellipse</span>
              <kbd className="font-mono text-[11px] opacity-70">⇧U</kbd>
            </PopoverClose>
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('filled-ellipse')}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    tool === 'filled-ellipse'
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                />
              }
            >
              <Circle size={14} className="fill-current" />
              <span className="flex-1">Filled Ellipse</span>
              <kbd className="font-mono text-[11px] opacity-70">⇧U</kbd>
            </PopoverClose>
          </PopoverContent>
        </Popover>

        <ToolButton
          active={tool === 'bucket'}
          onClick={() => onSelectTool('bucket')}
          icon={<PaintBucket size={17} />}
          label="Fill Bucket"
          shortcut="G"
        />
        <ToolButton
          active={tool === 'color-replace'}
          onClick={() => onSelectTool('color-replace')}
          icon={<Replace size={17} />}
          label="Color Replace"
          shortcut="C"
        />
        <ToolButton
          active={tool === 'eyedropper'}
          onClick={() => onSelectTool('eyedropper')}
          icon={<Pipette size={17} />}
          label="Eyedropper"
          shortcut="I"
        />
        <ToolButton
          active={tool === 'smudge'}
          onClick={() => onSelectTool('smudge')}
          icon={<Hand size={17} />}
          label="Smudge / Push"
          shortcut="S"
        />

        <Popover open={effectsFlyout.open} onOpenChange={effectsFlyout.onOpenChange}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Effect Brushes"
                      aria-pressed={isEffectActive}
                      {...effectsFlyout.triggerProps}
                      className={`relative flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isEffectActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    />
                  }
                />
              }
            >
              {getToolIcon(lastEffectTool, 17)}
              <span className="clip-path-triangle absolute right-0.5 bottom-0.5 h-1.5 w-1.5 rounded-tl-xs bg-current opacity-60" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span>Effect Brushes (hold or right-click for more)</span>
              <TooltipShortcut>R</TooltipShortcut>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="flex w-44 flex-col gap-0.5 p-1.5">
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('blur')}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    tool === 'blur'
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                />
              }
            >
              <Droplets size={14} />
              <span className="flex-1">Blur</span>
              <kbd className="font-mono text-[11px] opacity-70">R</kbd>
            </PopoverClose>
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('sharpen')}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                    tool === 'sharpen'
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  }`}
                />
              }
            >
              <Zap size={14} />
              <span className="flex-1">Sharpen</span>
              <kbd className="font-mono text-[11px] opacity-70">⇧R</kbd>
            </PopoverClose>
          </PopoverContent>
        </Popover>

        <div className="my-1 h-px w-full bg-border" />

        <ToolButton
          active={tool === 'move'}
          onClick={() => onSelectTool('move')}
          icon={<MousePointer2 size={17} />}
          label="Move"
          shortcut="V"
        />

        <Popover open={selectionsFlyout.open} onOpenChange={selectionsFlyout.onOpenChange}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Selection Tools"
                      aria-pressed={isSelectionActive}
                      {...selectionsFlyout.triggerProps}
                      className={`relative flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelectionActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    />
                  }
                />
              }
            >
              {getToolIcon(lastSelectionTool, 17)}
              <span className="clip-path-triangle absolute right-0.5 bottom-0.5 h-1.5 w-1.5 rounded-tl-xs bg-current opacity-60" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <span>Selection Tools (hold or right-click for more)</span>
              <TooltipShortcut>M</TooltipShortcut>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="flex w-48 flex-col gap-0.5 p-1.5">
            {SELECTION_TOOLS.map((t) => (
              <PopoverClose
                key={t}
                render={
                  <button
                    type="button"
                    onClick={() => onSelectTool(t)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
                      tool === t
                        ? 'bg-primary font-medium text-primary-foreground'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  />
                }
              >
                {getToolIcon(t, 14)}
                <span className="capitalize">
                  {t.replace('-select', '').replace('poly-', 'Poly ').replace('-', ' ')} Select
                </span>
              </PopoverClose>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex-1" />

      {/* Primary / Secondary Swatches & Atomic Swap */}
      <div className="relative mb-2 h-10 w-10 shrink-0">
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Secondary Color"
                      className="absolute right-0 bottom-0 h-6 w-6 cursor-pointer rounded-sm border border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  }
                />
              }
            />
            <TooltipContent side="right">Secondary Color</TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="end" sideOffset={10} className="w-auto p-3">
            <ColorPicker color={secondaryColor} onChange={onSetSecondaryColor} />
          </PopoverContent>
        </Popover>

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Primary Color"
                      className="absolute top-0 left-0 z-10 h-6 w-6 cursor-pointer rounded-sm border border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: primaryColor }}
                    />
                  }
                />
              }
            />
            <TooltipContent side="right">Primary Color</TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="end" sideOffset={10} className="w-auto p-3">
            <ColorPicker color={primaryColor} onChange={onSetPrimaryColor} />
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Swap Primary and Secondary Colors"
                onClick={onSwapColors}
                className="absolute top-0 right-0 z-20 flex h-4 w-4 cursor-pointer items-center justify-center rounded-bl-sm border-b border-l border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            }
          >
            <ArrowRightLeft size={9} className="rotate-45" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <span>Swap Colors</span>
            <TooltipShortcut>X</TooltipShortcut>
          </TooltipContent>
        </Tooltip>
      </div>
    </Toolbar>
  );
};

interface ToolOptionsBarProps {
  tool: ToolType;
  inkType: 'simple' | 'shading';
  shades: string[];
  primaryColor: string;
  symmetryX: boolean;
  symmetryY: boolean;
  brushSize: number;
  brushShape: 'square' | 'circle';
  pixelPerfect: boolean;
  smudgeMode?: 'blend' | 'push';
  smudgeStrength?: number;
  fillContiguous: boolean;
  rotationAlgorithm: 'nearest' | 'rotsprite';
  showGrid: boolean;
  onionSkin: boolean;
  isPreviewVisible: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  updateState: (s: ProjectStateUpdater, config?: any) => void;
  togglePaneVisibility: (paneId: string) => void;
}

const ToolOptionsBar: React.FC<ToolOptionsBarProps> = ({
  tool,
  inkType,
  shades,
  primaryColor,
  symmetryX,
  symmetryY,
  brushSize,
  brushShape,
  pixelPerfect,
  smudgeMode,
  smudgeStrength,
  fillContiguous,
  rotationAlgorithm,
  showGrid,
  onionSkin,
  isPreviewVisible,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  updateState,
  togglePaneVisibility,
}) => {
  const removeShade = (index: number) => {
    updateState((prev) => {
      const newShades = [...prev.shades];
      newShades.splice(index, 1);
      return { ...prev, shades: newShades };
    });
  };

  const addShade = (color: string) => {
    updateState((prev) =>
      prev.shades.includes(color) ? prev : { ...prev, shades: [...prev.shades, color] }
    );
  };

  return (
    <Toolbar
      aria-label="Tool options"
      className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-background/80 px-2 text-xs no-scrollbar"
    >
      <div className="flex shrink-0 items-center gap-1 border-r border-border pr-2">
        <ToolButton
          active={false}
          disabled={!canUndo}
          onClick={onUndo}
          icon={<Undo size={15} />}
          label="Undo"
          shortcut="Ctrl+Z"
          tooltipSide="bottom"
        />
        <ToolButton
          active={false}
          disabled={!canRedo}
          onClick={onRedo}
          icon={<Redo size={15} />}
          label="Redo"
          shortcut="Ctrl+Y"
          tooltipSide="bottom"
        />
      </div>

      <div className="flex min-w-max flex-1 items-center gap-3 px-1">
        <SegmentedControl
          value={inkType}
          onValueChange={(val) => {
            if (val === 'simple' || val === 'shading') {
              updateState((prev) => ({ ...prev, inkType: val }));
            }
          }}
          className="w-auto shrink-0"
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="simple" className="px-2.5 py-0.5 text-[11px]">
            Simple
          </SegmentedControlItem>
          <SegmentedControlItem value="shading" className="px-2.5 py-0.5 text-[11px]">
            <Droplets size={11} />
            Shading
          </SegmentedControlItem>
        </SegmentedControl>

        {inkType === 'shading' && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
            <span className="text-[11px] font-medium text-muted-foreground">Shades</span>
            <div className="flex h-5 min-w-[72px] items-center gap-0.5 rounded-sm border border-border bg-background p-0.5">
              {shades.map((color, idx) => (
                <Tooltip key={`${color}-${idx}`}>
                  <TooltipTrigger
                    render={
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', idx.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (!isNaN(fromIdx) && fromIdx !== idx) {
                            updateState((prev) => {
                              const newShades = [...prev.shades];
                              const [moved] = newShades.splice(fromIdx, 1);
                              newShades.splice(idx, 0, moved);
                              return { ...prev, shades: newShades };
                            });
                          }
                        }}
                        className="group relative h-full w-4 cursor-grab border border-border/40 active:cursor-grabbing"
                        style={{ backgroundColor: color }}
                      />
                    }
                  >
                    <button
                      type="button"
                      aria-label={`Remove shade ${color}`}
                      onClick={() => removeShade(idx)}
                      className="absolute -top-1 -right-1 z-20 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={8} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{`Step ${idx + 1}: ${color}`}</TooltipContent>
                </Tooltip>
              ))}
              {shades.length < 16 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Add primary color to shade ramp"
                        onClick={() => addShade(primaryColor)}
                        className="ml-0.5 flex h-full w-4 items-center justify-center rounded-xs border border-dashed border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      />
                    }
                  >
                    <Plus size={10} />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Add Primary Color</TooltipContent>
                </Tooltip>
              )}
            </div>
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Shade ramp options"
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  />
                }
              >
                <ChevronDown size={12} />
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-36 flex-col gap-0.5 p-1">
                <PopoverClose
                  render={
                    <button
                      type="button"
                      onClick={() =>
                        updateState((prev) => ({ ...prev, shades: [...prev.shades].reverse() }))
                      }
                      disabled={shades.length < 2}
                      className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-45"
                    />
                  }
                >
                  Reverse Ramp
                </PopoverClose>
                <PopoverClose
                  render={
                    <button
                      type="button"
                      onClick={() => updateState((prev) => ({ ...prev, shades: [] }))}
                      className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/15"
                    />
                  }
                >
                  Clear Ramp
                </PopoverClose>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="h-4 w-px bg-border" />

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Symmetry</span>
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
            <ToolButton
              active={symmetryX}
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  symmetry: { ...prev.symmetry, x: !prev.symmetry.x },
                }))
              }
              icon={<FlipHorizontal size={14} />}
              label="Horizontal Symmetry"
              tooltipSide="bottom"
            />
            <ToolButton
              active={symmetryY}
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  symmetry: { ...prev.symmetry, y: !prev.symmetry.y },
                }))
              }
              icon={<FlipVertical size={14} />}
              label="Vertical Symmetry"
              tooltipSide="bottom"
            />
          </div>
        </div>

        {BRUSH_OPTION_TOOLS.includes(tool) && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Size</span>
              <CustomSlider
                min={1}
                max={MAX_BRUSH_SIZE}
                value={brushSize}
                onValueChange={(val) => updateState((prev) => ({ ...prev, brushSize: val }))}
                aria-label="Brush size"
                className="w-24"
              />
              <span className="w-8 text-right font-mono text-[11px] text-foreground tabular-nums">
                {brushSize}px
              </span>
            </div>

            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              <ToolButton
                active={brushShape === 'square'}
                onClick={() => updateState((prev) => ({ ...prev, brushShape: 'square' }))}
                icon={<Square size={14} />}
                label="Square Brush"
                tooltipSide="bottom"
              />
              <ToolButton
                active={brushShape === 'circle'}
                onClick={() => updateState((prev) => ({ ...prev, brushShape: 'circle' }))}
                icon={<Circle size={14} />}
                label="Circle Brush"
                tooltipSide="bottom"
              />
            </div>

            {tool === 'pencil' && inkType === 'simple' && (
              <label
                htmlFor="pixelPerfect"
                className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <CustomCheckbox
                  id="pixelPerfect"
                  checked={pixelPerfect}
                  onCheckedChange={(checked) =>
                    updateState((prev) => ({ ...prev, pixelPerfect: !!checked }))
                  }
                />
                <span>Pixel Perfect</span>
              </label>
            )}

            {tool === 'smudge' && (
              <>
                <div className="h-4 w-px bg-border" />
                <SegmentedControl
                  value={smudgeMode || 'blend'}
                  onValueChange={(val) => {
                    if (val === 'blend' || val === 'push') {
                      updateState((prev) => ({ ...prev, smudgeMode: val }));
                    }
                  }}
                  className="w-auto shrink-0"
                >
                  <SegmentedControlIndicator />
                  <SegmentedControlItem value="blend" className="px-2 py-0.5 text-[11px]">
                    <Droplets size={11} />
                    Blend
                  </SegmentedControlItem>
                  <SegmentedControlItem value="push" className="px-2 py-0.5 text-[11px]">
                    <Hand size={11} />
                    Push
                  </SegmentedControlItem>
                </SegmentedControl>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Strength</span>
                  <CustomSlider
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round((smudgeStrength ?? 0.7) * 100)}
                    onValueChange={(val) =>
                      updateState((prev) => ({ ...prev, smudgeStrength: val / 100 }))
                    }
                    aria-label="Smudge strength"
                    className="w-20"
                  />
                  <span className="w-8 font-mono text-[11px] text-foreground tabular-nums">
                    {Math.round((smudgeStrength ?? 0.7) * 100)}%
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {(tool === 'bucket' || tool === 'magic-wand') && (
          <>
            <div className="h-4 w-px bg-border" />
            <label
              htmlFor="contiguous"
              className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <CustomCheckbox
                id="contiguous"
                checked={fillContiguous}
                onCheckedChange={(checked) =>
                  updateState((prev) => ({ ...prev, fillContiguous: !!checked }))
                }
              />
              <span>Contiguous</span>
            </label>
          </>
        )}

        {tool === 'move' && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Rotation</span>
              <SegmentedControl
                value={rotationAlgorithm}
                onValueChange={(val) => {
                  if (val === 'nearest' || val === 'rotsprite') {
                    updateState((prev) => ({ ...prev, rotationAlgorithm: val }));
                  }
                }}
                className="w-auto shrink-0"
              >
                <SegmentedControlIndicator />
                <SegmentedControlItem value="nearest" className="px-2.5 py-0.5 text-[11px]">
                  Nearest
                </SegmentedControlItem>
                <SegmentedControlItem value="rotsprite" className="px-2.5 py-0.5 text-[11px]">
                  RotSprite
                </SegmentedControlItem>
              </SegmentedControl>
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
        <ToolButton
          active={isPreviewVisible}
          onClick={() => togglePaneVisibility('preview')}
          icon={<PlaySquare size={15} />}
          label="Toggle Preview"
          tooltipSide="bottom"
        />
        <ToolButton
          active={showGrid}
          onClick={() => updateState((prev) => ({ ...prev, showGrid: !prev.showGrid }))}
          icon={<Grid size={15} />}
          label="Toggle Grid"
          shortcut="Shift+G"
          tooltipSide="bottom"
        />
        <ToolButton
          active={onionSkin}
          onClick={() => updateState((prev) => ({ ...prev, onionSkin: !prev.onionSkin }))}
          icon={<Eye size={15} />}
          label="Onion Skin"
          shortcut="Alt+O"
          tooltipSide="bottom"
        />
      </div>
    </Toolbar>
  );
};

interface DockGroupContainerProps {
  slotId: 'left' | 'right' | 'bottom';
  group: { id: string; panes: string[]; activePaneId: string };
  canUnsplit: boolean;
  closedPanes: string[];
  hasDraggedPane: boolean;
  hoverPosition: DragZonePosition | null;
  indicatorLeft: number | null;
  layoutActions: any;
  tabMenu: ReturnType<typeof createMenuController<TabMenuPayload>>;
  onRegisterTabListRef: (key: string, el: HTMLDivElement | null) => void;
  paneContent: React.ReactNode;
}

const DockGroupContainer: React.FC<DockGroupContainerProps> = ({
  slotId,
  group,
  canUnsplit,
  closedPanes,
  hasDraggedPane,
  hoverPosition,
  indicatorLeft,
  layoutActions,
  tabMenu,
  onRegisterTabListRef,
  paneContent,
}) => {
  const isBodyTopHover = hoverPosition === 'body-top';
  const isBodyBottomHover = hoverPosition === 'body-bottom';
  const isBodyLeftHover = hoverPosition === 'body-left';
  const isBodyRightHover = hoverPosition === 'body-right';

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden border border-border bg-card select-none ${
        isBodyTopHover || isBodyBottomHover || isBodyLeftHover || isBodyRightHover
          ? 'ring-2 ring-primary ring-inset'
          : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!hasDraggedPane) return;

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
        }
        layoutActions.handleDragOverBody(slotId, group.id, pos);
      }}
      onDragLeave={(e) => {
        if (!hasDraggedPane) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          layoutActions.clearDragOverState();
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        layoutActions.handleDrop(e, slotId, group.id);
      }}
    >
      <div className="relative flex h-7 shrink-0 items-center justify-between overflow-hidden border-b border-border bg-background/60 px-1 select-none">
        <div
          ref={(el) => onRegisterTabListRef(`${slotId}-${group.id}`, el)}
          className="relative flex h-full max-w-[85%] items-center gap-0.5 overflow-x-auto no-scrollbar"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            layoutActions.handleDragOverTabBar(e, slotId, group.id);
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
                onDragStart={(e) => layoutActions.handleDragStart(e, paneId, slotId, group.id)}
                onDragOver={(e) => layoutActions.handleDragOverTab(e, paneId, slotId, group.id, index)}
                onDragEnd={layoutActions.handleDragEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  tabMenu.open({
                    payload: { paneId, slotId, groupId: group.id },
                    anchor: { x: e.clientX, y: e.clientY },
                  });
                }}
                onClick={() => layoutActions.handleSelectTab(slotId, group.id, paneId)}
                title={`${metadata.title} (Right-click for options)`}
                className={`group relative flex h-full cursor-default items-center gap-1.5 border-t-2 border-r border-r-border/60 px-2 text-[11px] font-medium transition-colors select-none ${
                  isActive
                    ? 'border-t-primary bg-card text-foreground'
                    : 'border-t-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <span className="pointer-events-none flex items-center text-muted-foreground">
                  {metadata.icon}
                </span>
                <span className="pointer-events-none max-w-[95px] truncate">
                  {metadata.title}
                </span>
                <button
                  type="button"
                  aria-label={`Close ${metadata.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    layoutActions.handleClosePane(paneId);
                  }}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground/60 opacity-60 transition-colors hover:bg-accent hover:text-foreground hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          {indicatorLeft !== null && (
            <div
              className="pointer-events-none absolute top-1 bottom-1 z-30 w-0.5 -translate-x-1/2 rounded-full bg-primary"
              style={{ left: `${indicatorLeft}px` }}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 px-1">
          {closedPanes.length > 0 && (
            <Popover>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Add pane to group"
                          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        />
                      }
                    />
                  }
                >
                  <Plus size={12} />
                </TooltipTrigger>
                <TooltipContent side="bottom">Add Pane</TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="flex w-44 flex-col gap-0.5 p-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  Add Pane
                </div>
                <div className="my-0.5 h-px bg-border" />
                {closedPanes.map((paneId) => (
                  <PopoverClose
                    key={paneId}
                    render={
                      <button
                        type="button"
                        onClick={() => layoutActions.handleAddPaneToGroup(slotId, group.id, paneId)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                      />
                    }
                  >
                    <span className="text-muted-foreground">{PANE_METADATA[paneId]?.icon}</span>
                    <span>{PANE_METADATA[paneId]?.title}</span>
                  </PopoverClose>
                ))}
              </PopoverContent>
            </Popover>
          )}

          {canUnsplit && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="Unsplit dock"
                    onClick={() => layoutActions.unsplitSlot(slotId)}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  />
                }
              >
                <ArrowRightLeft size={11} />
              </TooltipTrigger>
              <TooltipContent side="bottom">Unsplit Dock</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Collapse dock"
                  onClick={() => layoutActions.setSlotVisibility(slotId, false)}
                  className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                />
              }
            >
              <Minus size={11} />
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse Dock</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-card">
        {paneContent}

        {isBodyTopHover && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary/80 bg-primary/10 select-none">
            <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-primary border border-primary/40">
              Add as Tab
            </span>
          </div>
        )}

        {isBodyBottomHover && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-1/2 flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary bg-primary/15 select-none">
            <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-primary border border-primary/40">
              Split Below
            </span>
          </div>
        )}

        {isBodyRightHover && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-1/2 flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary bg-primary/15 select-none">
            <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-primary border border-primary/40">
              Split Right
            </span>
          </div>
        )}

        {isBodyLeftHover && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex w-1/2 flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary bg-primary/15 select-none">
            <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-primary border border-primary/40">
              Split Left
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface DockSlotContainerProps {
  slotId: 'left' | 'right' | 'bottom';
  slot: any;
  closedPanes: string[];
  hasDraggedPane: boolean;
  isDragOverSlot: boolean;
  dragOverZone: { slotId: string; groupId?: string; position: DragZonePosition } | null;
  tabDropIndicator: { key: string; left: number } | null;
  layoutActions: any;
  tabMenu: ReturnType<typeof createMenuController<TabMenuPayload>>;
  onRegisterTabListRef: (key: string, el: HTMLDivElement | null) => void;
  primaryPaneContent: React.ReactNode;
  secondaryPaneContent?: React.ReactNode;
  extraPaneContents?: React.ReactNode[] | null;
}

const DockSlotContainer: React.FC<DockSlotContainerProps> = ({
  slotId,
  slot,
  closedPanes,
  hasDraggedPane,
  isDragOverSlot,
  dragOverZone,
  tabDropIndicator,
  layoutActions,
  tabMenu,
  onRegisterTabListRef,
  primaryPaneContent,
  secondaryPaneContent,
  extraPaneContents,
}) => {
  if (!slot || !slot.visible || slot.groups.length === 0) return null;

  const canUnsplit = slot.groups.length > 1;

  if (slot.groups.length === 1) {
    const group = slot.groups[0];
    const hoverPosition =
      isDragOverSlot && dragOverZone?.groupId === group.id ? dragOverZone.position : null;
    const indicatorKey = `${slotId}-${group.id}`;
    const indicatorLeft =
      tabDropIndicator && tabDropIndicator.key === indicatorKey ? tabDropIndicator.left : null;

    return (
      <DockGroupContainer
        slotId={slotId}
        group={group}
        canUnsplit={canUnsplit}
        closedPanes={closedPanes}
        hasDraggedPane={hasDraggedPane}
        hoverPosition={hoverPosition}
        indicatorLeft={indicatorLeft}
        layoutActions={layoutActions}
        tabMenu={tabMenu}
        onRegisterTabListRef={onRegisterTabListRef}
        paneContent={primaryPaneContent}
      />
    );
  }

  return (
    <Allotment vertical={slot.splitDirection === 'vertical'} className="h-full w-full">
      {slot.groups.map((group: any, idx: number) => {
        const hoverPosition =
          isDragOverSlot && dragOverZone?.groupId === group.id ? dragOverZone.position : null;
        const indicatorKey = `${slotId}-${group.id}`;
        const indicatorLeft =
          tabDropIndicator && tabDropIndicator.key === indicatorKey ? tabDropIndicator.left : null;
        const paneContent =
          idx === 0
            ? primaryPaneContent
            : idx === 1
              ? secondaryPaneContent
              : extraPaneContents?.[idx - 2] ?? null;

        return (
          <Allotment.Pane key={group.id} minSize={80}>
            <DockGroupContainer
              slotId={slotId}
              group={group}
              canUnsplit={canUnsplit}
              closedPanes={closedPanes}
              hasDraggedPane={hasDraggedPane}
              hoverPosition={hoverPosition}
              indicatorLeft={indicatorLeft}
              layoutActions={layoutActions}
              tabMenu={tabMenu}
              onRegisterTabListRef={onRegisterTabListRef}
              paneContent={paneContent}
            />
          </Allotment.Pane>
        );
      })}
    </Allotment>
  );
};

const FloatingWindow: React.FC<{
  pane: any;
  metadata: { title: string; icon: React.ReactNode };
  updateFloatingPanePosition: (id: string, x: number, y: number) => void;
  handleDragStart: (e: React.DragEvent, paneId: string, sourceSlot: string) => void;
  handleDragEnd: () => void;
  handleClosePane: (paneId: string) => void;
  children: React.ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({
  pane,
  metadata,
  updateFloatingPanePosition,
  handleDragStart,
  handleDragEnd,
  handleClosePane,
  children,
  onContextMenu,
}) => {
  const storageKey = `floating_pane_size_${pane.id}`;
  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.width >= 180 && parsed.height >= 180) return parsed;
      }
    } catch {
      // Ignore invalid stored dimensions
    }
    return { width: pane.width || 280, height: pane.height || 320 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 280, height: 320 });

  const handleTitlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea, [draggable="true"]')) {
      return;
    }
    setIsDragging(true);
    dragOffsetRef.current = { x: e.clientX - pane.x, y: e.clientY - pane.y };
    e.preventDefault();
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      updateFloatingPanePosition(
        pane.id,
        Math.max(0, e.clientX - dragOffsetRef.current.x),
        Math.max(0, e.clientY - dragOffsetRef.current.y)
      );
    };
    const handlePointerUp = () => setIsDragging(false);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, pane.id, updateFloatingPanePosition]);

  useEffect(() => {
    if (!isResizing) return;
    const handlePointerMove = (e: PointerEvent) => {
      const nextWidth = Math.max(180, Math.min(720, resizeStartRef.current.width + (e.clientX - resizeStartRef.current.x)));
      const nextHeight = Math.max(180, Math.min(720, resizeStartRef.current.height + (e.clientY - resizeStartRef.current.y)));
      setSize({ width: nextWidth, height: nextHeight });
    };
    const handlePointerUp = () => {
      setIsResizing(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(size));
      } catch {
        // Ignore quota errors
      }
    }
  }, [isResizing, size, storageKey]);

  return (
    <div
      className="pointer-events-auto absolute z-40 flex flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl select-none"
      style={{
        left: pane.x,
        top: pane.y,
        width: size.width,
        height: size.height,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        onPointerDown={handleTitlePointerDown}
        onContextMenu={onContextMenu}
        className="flex h-7 shrink-0 cursor-move items-center justify-between border-b border-border bg-muted px-2 active:cursor-grabbing"
      >
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, pane.id, 'floating')}
          onDragEnd={handleDragEnd}
          className="flex cursor-grab items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:border-border hover:bg-accent/60 active:cursor-grabbing"
          title="Right-click for options or drag into a dock"
        >
          <span className="text-muted-foreground">{metadata.icon}</span>
          <span>{metadata.title}</span>
        </div>

        <button
          type="button"
          onClick={() => handleClosePane(pane.id)}
          aria-label={`Close ${metadata.title}`}
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={12} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-card">{children}</div>

      <div
        role="separator"
        aria-label={`Resize ${metadata.title}`}
        onPointerDown={handleResizePointerDown}
        className="absolute right-0 bottom-0 z-10 h-3.5 w-3.5 cursor-nwse-resize"
      >
        <span className="pointer-events-none absolute right-1 bottom-1 h-1.5 w-1.5 border-r-2 border-b-2 border-muted-foreground/50" />
      </div>
    </div>
  );
};

interface DesktopWorkspaceProps {
  state: ProjectState;
  updateState: (s: ProjectStateUpdater, config?: any) => void;
  projectActions: any;
  history: any[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  canvasTools: any;
  fileSystem: any;
  setMousePos: (pos: any) => void;
  setDragStartPos: (pos: any) => void;
  onScalePixels: (selection: Set<number>, srcBox: any, destBox: any) => void;
  layoutActions: any;
  slots: any;
  floatingPanes: any[];
  draggedPane: { paneId: string; sourceSlot: string; sourceGroupId?: string } | null;
  dragOverSlot: string | null;
  dragOverIndex: { slotId: string; groupId?: string; index: number } | null;
  dragOverZone: { slotId: string; groupId?: string; position: DragZonePosition } | null;
  activeTagPopover?: any;
  onCloseTagPopover?: () => void;
  layerPropertiesState?: { isOpen: boolean; layer: any };
  onCloseLayerProperties?: () => void;
  fitTrigger?: number;
  onPreviewLayer?: (id: string, updates: any) => void;
  onRevertLayerPreview?: (id: string, snapshot: any) => void;
  onPreviewTag?: (tag: any) => void;
  onRevertTagPreview?: (snapshotTag: any) => void;
  tabMenu: ReturnType<typeof createMenuController<TabMenuPayload>>;
}

const resolvePaneElement = (
  paneId: string | undefined,
  fileTreeEl: React.ReactNode,
  paletteEl: React.ReactNode,
  layersEl: React.ReactNode,
  historyEl: React.ReactNode,
  timelineEl: React.ReactNode,
  previewEl: React.ReactNode
): React.ReactNode => {
  switch (paneId) {
    case 'file-tree':
      return fileTreeEl;
    case 'palette':
      return paletteEl;
    case 'layers':
      return layersEl;
    case 'history':
      return historyEl;
    case 'timeline':
      return timelineEl;
    case 'preview':
      return previewEl;
    default:
      return null;
  }
};

const DesktopWorkspace: React.FC<DesktopWorkspaceProps> = ({
  state,
  updateState,
  projectActions,
  history,
  historyIndex,
  canUndo,
  canRedo,
  canvasTools,
  fileSystem,
  setMousePos,
  setDragStartPos,
  onScalePixels,
  layoutActions,
  slots,
  floatingPanes,
  draggedPane,
  dragOverSlot,
  dragOverIndex,
  dragOverZone,
  activeTagPopover,
  onCloseTagPopover,
  layerPropertiesState,
  onCloseLayerProperties,
  fitTrigger,
  onPreviewLayer,
  onRevertLayerPreview,
  onPreviewTag,
  onRevertTagPreview,
  tabMenu,
}) => {
  const isPreviewDocked = Object.values(slots).some(
    (s: any) => s.visible && s.groups.some((g: any) => g.panes.includes('preview'))
  );
  const isPreviewFloating = floatingPanes.some((fp: any) => fp.id === 'preview');
  const isPreviewVisible = isPreviewDocked || isPreviewFloating;

  const closedPanes = Object.keys(PANE_METADATA).filter(
    (paneId) =>
      !Object.values(slots).some((s: any) => s.groups.some((g: any) => g.panes.includes(paneId))) &&
      !floatingPanes.some((fp: any) => fp.id === paneId)
  );

  const handleSelectTool = (tool: ToolType) => {
    updateState((prev) => ({ ...prev, tool }));
  };

  const handleSetPrimaryColor = (primaryColor: string) => {
    updateState((prev) => ({ ...prev, primaryColor }));
  };

  const handleSetSecondaryColor = (secondaryColor: string) => {
    updateState((prev) => ({ ...prev, secondaryColor }));
  };

  const handleSwapColors = () => {
    updateState((prev) => ({
      ...prev,
      primaryColor: prev.secondaryColor,
      secondaryColor: prev.primaryColor,
      ...(prev.inkType === 'shading' ? { shades: [...prev.shades].reverse() } : {}),
    }));
  };

  const handlePaletteColorSelect = (c: string, isPrimary: boolean) => {
    updateState((prev) => (isPrimary ? { ...prev, primaryColor: c } : { ...prev, secondaryColor: c }));
  };

  const handlePaletteAddColor = (c: string) => {
    updateState((prev) => ({
      ...prev,
      paletteLibrary: prev.paletteLibrary.map((p) =>
        p.id === prev.activePaletteId ? { ...p, colors: [...p.colors, c] } : p
      ),
      palette: [...prev.palette, c],
    }));
  };

  const handlePaletteColorsSelected = (selectedColors: string[]) => {
    updateState((prev) => ({ ...prev, shades: selectedColors, inkType: 'shading' }));
  };

  const handleSelectLayers = (ids: string[], active: string) => {
    updateState((prev) => ({ ...prev, selectedLayerIds: ids, activeLayerId: active }));
  };

  const handleSelectFrames = (indices: number[], active: number, layerId?: string) => {
    updateState((prev) => ({
      ...prev,
      selectedFrameIndices: indices,
      activeFrameIndex: active,
      ...(layerId ? { activeLayerId: layerId, selectedLayerIds: [layerId] } : {}),
    }));
  };

  const handleTimelineSelectLayer = (id: string) => {
    updateState((prev) => ({ ...prev, activeLayerId: id, selectedLayerIds: [id] }));
  };

  const handleTimelineToggleLayerVisibility = (id: string) => {
    updateState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    }));
  };

  const handleTimelineToggleLayerLock = (id: string) => {
    updateState((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    }));
  };

  const handleClosePreview = () => {
    layoutActions.handleClosePane('preview');
  };

  const handleCanvasDrawStart = (pos: any, modifiers?: any) => {
    setDragStartPos(pos);
    canvasTools.handleDrawStart(
      pos,
      modifiers ?? { shift: false, ctrl: false, alt: false, meta: false }
    );
  };

  const handleCanvasDrawEnd = () => {
    setDragStartPos(null);
    canvasTools.handleDrawEnd();
  };

  const handleCanvasSelectionUpdate = (sel: Set<number> | null) => {
    const currentTool = projectActions.getActiveState().tool;
    updateState((prev) => ({ ...prev, selection: sel }), { action: 'Select Area', tool: currentTool });
  };

  const handleCanvasZoom = (z: number) => {
    updateState((prev) => ({ ...prev, zoom: z }));
  };

  const slotTabListRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const handleRegisterTabListRef = (key: string, el: HTMLDivElement | null) => {
    slotTabListRefs.current[key] = el;
  };
  const [tabDropIndicator, setTabDropIndicator] = useState<{ key: string; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!dragOverIndex || dragOverZone?.position !== 'tab-bar') {
      setTabDropIndicator(null);
      return;
    }
    const key = `${dragOverIndex.slotId}-${dragOverIndex.groupId || ''}`;
    const container = slotTabListRefs.current[key];
    if (!container) {
      setTabDropIndicator(null);
      return;
    }

    const tabEls = Array.from(container.querySelectorAll('[data-tab-id]')) as HTMLElement[];
    let left: number;
    if (tabEls.length === 0) {
      left = 4;
    } else {
      const idx = dragOverIndex.index;
      if (idx <= 0) {
        left = tabEls[0].offsetLeft;
      } else if (idx >= tabEls.length) {
        const last = tabEls[tabEls.length - 1];
        left = last.offsetLeft + last.offsetWidth;
      } else {
        const prev = tabEls[idx - 1];
        const curr = tabEls[idx];
        left = Math.round((prev.offsetLeft + prev.offsetWidth + curr.offsetLeft) / 2);
      }
    }
    setTabDropIndicator({ key, left });
  }, [dragOverIndex, dragOverZone, slots]);

  const hasDraggedPane = draggedPane !== null;
  const activeFrame = state.frames[state.activeFrameIndex];

  // Each panel JSX element is constructed at top-level with narrow props so React Compiler
  // memoizes each panel independently on ONLY the exact state fields it consumes.
  const fileTreeElement = (
    <FileTree
      rootHandle={fileSystem.rootHandle}
      onOpenFolder={fileSystem.openFolder}
      onFileOpen={projectActions.loadProjectFromFile}
      onResizeStart={NOOP}
      width={0}
    />
  );

  const paletteElement = (
    <Palette
      width={0}
      colors={state.palette}
      palettes={state.paletteLibrary}
      activePaletteId={state.activePaletteId}
      primaryColor={state.primaryColor}
      secondaryColor={state.secondaryColor}
      shadingRamp={state.shades}
      onColorSelect={handlePaletteColorSelect}
      onAddColor={handlePaletteAddColor}
      onSelectPalette={projectActions.selectPalette}
      onImportPalette={projectActions.importPalette}
      onResizeStart={NOOP}
      onColorsSelected={handlePaletteColorsSelected}
    />
  );

  const layersElement = (
    <LayersPanel
      layers={state.layers}
      activeFrame={activeFrame}
      activeLayerId={state.activeLayerId}
      selectedLayerIds={state.selectedLayerIds}
      palette={state.palette}
      width={state.width}
      height={state.height}
      onSelectLayers={handleSelectLayers}
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
  );

  const historyElement = (
    <HistoryPanel
      history={history}
      historyIndex={historyIndex}
      onJumpToHistory={projectActions.jumpToHistory}
      className="h-full w-full flex-1"
    />
  );

  const timelineElement = (
    <Timeline
      layers={state.layers}
      frames={state.frames}
      activeFrameIndex={state.activeFrameIndex}
      activeLayerId={state.activeLayerId}
      selectedFrameIndices={state.selectedFrameIndices}
      selectedLayerIds={state.selectedLayerIds}
      tags={state.tags}
      onSelectFrames={handleSelectFrames}
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
      onSelectLayer={handleTimelineSelectLayer}
      onAddLayer={projectActions.addLayer}
      onAddGroupLayer={projectActions.addGroupLayer}
      onUpdateLayer={projectActions.updateLayer}
      onToggleLayerVisibility={handleTimelineToggleLayerVisibility}
      onToggleLayerLock={handleTimelineToggleLayerLock}
      onReorderLayers={projectActions.reorderLayers}
      onReorderFrames={projectActions.reorderFrames}
    />
  );

  const previewElement = (
    <Preview
      width={0}
      frames={state.frames}
      layers={state.layers}
      palette={state.palette}
      spriteWidth={state.width}
      spriteHeight={state.height}
      activeFrameIndex={state.activeFrameIndex}
      onClose={handleClosePreview}
    />
  );

  const leftPrimaryPane = resolvePaneElement(
    slots.left.groups[0]?.activePaneId,
    fileTreeElement,
    paletteElement,
    layersElement,
    historyElement,
    timelineElement,
    previewElement
  );
  const leftSecondaryPane =
    slots.left.groups.length > 1
      ? resolvePaneElement(
          slots.left.groups[1]?.activePaneId,
          fileTreeElement,
          paletteElement,
          layersElement,
          historyElement,
          timelineElement,
          previewElement
        )
      : undefined;
  const leftExtraPanes =
    slots.left.groups.length > 2
      ? slots.left.groups
          .slice(2)
          .map((g: any) =>
            resolvePaneElement(
              g.activePaneId,
              fileTreeElement,
              paletteElement,
              layersElement,
              historyElement,
              timelineElement,
              previewElement
            )
          )
      : null;

  const rightPrimaryPane = resolvePaneElement(
    slots.right.groups[0]?.activePaneId,
    fileTreeElement,
    paletteElement,
    layersElement,
    historyElement,
    timelineElement,
    previewElement
  );
  const rightSecondaryPane =
    slots.right.groups.length > 1
      ? resolvePaneElement(
          slots.right.groups[1]?.activePaneId,
          fileTreeElement,
          paletteElement,
          layersElement,
          historyElement,
          timelineElement,
          previewElement
        )
      : undefined;
  const rightExtraPanes =
    slots.right.groups.length > 2
      ? slots.right.groups
          .slice(2)
          .map((g: any) =>
            resolvePaneElement(
              g.activePaneId,
              fileTreeElement,
              paletteElement,
              layersElement,
              historyElement,
              timelineElement,
              previewElement
            )
          )
      : null;

  const bottomPrimaryPane = resolvePaneElement(
    slots.bottom.groups[0]?.activePaneId,
    fileTreeElement,
    paletteElement,
    layersElement,
    historyElement,
    timelineElement,
    previewElement
  );
  const bottomSecondaryPane =
    slots.bottom.groups.length > 1
      ? resolvePaneElement(
          slots.bottom.groups[1]?.activePaneId,
          fileTreeElement,
          paletteElement,
          layersElement,
          historyElement,
          timelineElement,
          previewElement
        )
      : undefined;
  const bottomExtraPanes =
    slots.bottom.groups.length > 2
      ? slots.bottom.groups
          .slice(2)
          .map((g: any) =>
            resolvePaneElement(
              g.activePaneId,
              fileTreeElement,
              paletteElement,
              layersElement,
              historyElement,
              timelineElement,
              previewElement
            )
          )
      : null;

  const leftTabDropIndicator =
    tabDropIndicator && tabDropIndicator.key.startsWith('left-') ? tabDropIndicator : null;
  const rightTabDropIndicator =
    tabDropIndicator && tabDropIndicator.key.startsWith('right-') ? tabDropIndicator : null;
  const bottomTabDropIndicator =
    tabDropIndicator && tabDropIndicator.key.startsWith('bottom-') ? tabDropIndicator : null;

  const toolRailElement = (
    <ToolRail
      tool={state.tool}
      primaryColor={state.primaryColor}
      secondaryColor={state.secondaryColor}
      onSelectTool={handleSelectTool}
      onSetPrimaryColor={handleSetPrimaryColor}
      onSetSecondaryColor={handleSetSecondaryColor}
      onSwapColors={handleSwapColors}
    />
  );

  const canvasElement = (
    <Canvas
      projectId={state.id}
      frames={state.frames}
      activeFrameIndex={state.activeFrameIndex}
      layers={state.layers}
      activeLayerId={state.activeLayerId}
      palette={state.palette}
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
  );

  return (
    <>
      <ToolOptionsBar
        tool={state.tool}
        inkType={state.inkType}
        shades={state.shades}
        primaryColor={state.inkType === 'shading' ? state.primaryColor : ''}
        symmetryX={state.symmetry.x}
        symmetryY={state.symmetry.y}
        brushSize={state.brushSize}
        brushShape={state.brushShape}
        pixelPerfect={state.pixelPerfect}
        smudgeMode={state.smudgeMode}
        smudgeStrength={state.smudgeStrength}
        fillContiguous={state.fillContiguous}
        rotationAlgorithm={state.rotationAlgorithm}
        showGrid={state.showGrid}
        onionSkin={state.onionSkin}
        isPreviewVisible={isPreviewVisible}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={projectActions.undo}
        onRedo={projectActions.redo}
        updateState={updateState}
        togglePaneVisibility={layoutActions.togglePaneVisibility}
      />

      {/* Main Workspace Grid */}
      <div
        className="relative min-h-0 flex-1"
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedPane && (dragOverSlot !== null || dragOverZone !== null)) {
            layoutActions.clearDragOverState();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!draggedPane) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left - 80;
          const y = e.clientY - rect.top - 15;
          layoutActions.floatPane(draggedPane.paneId, draggedPane.sourceSlot, draggedPane.sourceGroupId, x, y);
          layoutActions.handleDragEnd();
        }}
      >
        {floatingPanes.map((pane: any) => (
          <FloatingWindow
            key={pane.id}
            pane={pane}
            metadata={PANE_METADATA[pane.id] || { title: pane.id, icon: null }}
            updateFloatingPanePosition={layoutActions.updateFloatingPanePosition}
            handleDragStart={layoutActions.handleDragStart}
            handleDragEnd={layoutActions.handleDragEnd}
            handleClosePane={layoutActions.handleClosePane}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              tabMenu.open({
                payload: { paneId: pane.id, slotId: 'floating' },
                anchor: { x: e.clientX, y: e.clientY },
              });
            }}
          >
            {resolvePaneElement(
              pane.id,
              fileTreeElement,
              paletteElement,
              layersElement,
              historyElement,
              timelineElement,
              previewElement
            )}
          </FloatingWindow>
        ))}

        <Allotment vertical>
          <Allotment.Pane>
            <Allotment>
              <Allotment.Pane
                visible={
                  slots.left.visible && slots.left.groups.some((g: any) => g.panes.length > 0)
                }
                preferredSize={slots.left.size || 220}
                minSize={160}
                priority={1 as any}
              >
                <DockSlotContainer
                  slotId="left"
                  slot={slots.left}
                  closedPanes={closedPanes}
                  hasDraggedPane={hasDraggedPane}
                  isDragOverSlot={dragOverSlot === 'left'}
                  dragOverZone={dragOverSlot === 'left' ? dragOverZone : null}
                  tabDropIndicator={leftTabDropIndicator}
                  layoutActions={layoutActions}
                  tabMenu={tabMenu}
                  onRegisterTabListRef={handleRegisterTabListRef}
                  primaryPaneContent={leftPrimaryPane}
                  secondaryPaneContent={leftSecondaryPane}
                  extraPaneContents={leftExtraPanes}
                />
              </Allotment.Pane>

              {/* Left Tool Rail (44px) */}
              <Allotment.Pane minSize={44} maxSize={44} priority={1 as any}>
                {toolRailElement}
              </Allotment.Pane>

              {/* Central Canvas Stage */}
              <Allotment.Pane priority={10 as any}>
                <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-canvas">
                  {canvasElement}
                </div>
              </Allotment.Pane>

              <Allotment.Pane
                visible={
                  slots.right.visible && slots.right.groups.some((g: any) => g.panes.length > 0)
                }
                preferredSize={slots.right.size || 250}
                minSize={160}
                priority={1 as any}
              >
                <DockSlotContainer
                  slotId="right"
                  slot={slots.right}
                  closedPanes={closedPanes}
                  hasDraggedPane={hasDraggedPane}
                  isDragOverSlot={dragOverSlot === 'right'}
                  dragOverZone={dragOverSlot === 'right' ? dragOverZone : null}
                  tabDropIndicator={rightTabDropIndicator}
                  layoutActions={layoutActions}
                  tabMenu={tabMenu}
                  onRegisterTabListRef={handleRegisterTabListRef}
                  primaryPaneContent={rightPrimaryPane}
                  secondaryPaneContent={rightSecondaryPane}
                  extraPaneContents={rightExtraPanes}
                />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>

          <Allotment.Pane
            visible={
              slots.bottom.visible && slots.bottom.groups.some((g: any) => g.panes.length > 0)
            }
            preferredSize={slots.bottom.size || 200}
            minSize={110}
            maxSize={400}
            priority={3 as any}
          >
            <DockSlotContainer
              slotId="bottom"
              slot={slots.bottom}
              closedPanes={closedPanes}
              hasDraggedPane={hasDraggedPane}
              isDragOverSlot={dragOverSlot === 'bottom'}
              dragOverZone={dragOverSlot === 'bottom' ? dragOverZone : null}
              tabDropIndicator={bottomTabDropIndicator}
              layoutActions={layoutActions}
              tabMenu={tabMenu}
              onRegisterTabListRef={handleRegisterTabListRef}
              primaryPaneContent={bottomPrimaryPane}
              secondaryPaneContent={bottomSecondaryPane}
              extraPaneContents={bottomExtraPanes}
            />
          </Allotment.Pane>
        </Allotment>
      </div>
    </>
  );
};

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  state,
  updateState,
  commands,
  projectActions,
  activeProjectId,
  tabs,
  recentProjects,
  history,
  historyIndex,
  canUndo = false,
  canRedo = false,
  onOpenCommandPalette,
  canvasTools,
  fileSystem,
  handleFileChange,
  fileInputRef,
  setMousePos,
  setDragStartPos,
  onScalePixels,
  selectionSize,
  layoutActions,
  slots,
  floatingPanes,
  draggedPane,
  dragOverSlot,
  dragOverIndex,
  dragOverZone,
  activeTagPopover,
  onCloseTagPopover,
  layerPropertiesState,
  onCloseLayerProperties,
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
  const [tabMenu] = useState(() => createMenuController<TabMenuPayload>());

  const handleExportClick = () => {
    if (projectActions.openExportDialog) {
      projectActions.openExportDialog();
    } else {
      projectActions.downloadImage();
    }
  };

  const handleImportProject = () => {
    fileInputRef.current?.click();
  };

  const handleOpenCommandPalette = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      commands.find((c) => c.id === 'app.commandPalette')?.perform();
    }
  };

  const isHome = activeProjectId === 'home';
  const activeLayerName = state.layers.find((l) => l.id === state.activeLayerId)?.name;

  return (
    <div className="flex h-full flex-col bg-background">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".aseprite,.ase,.png,.jpg,.jpeg,.gif,.json,.pxa"
        onChange={handleFileChange}
      />

      {/* Top Menubar Chrome */}
      <div className="z-50 flex h-8 shrink-0 items-center justify-between border-b border-border bg-card px-2 text-xs">
        <Menubar
          commands={commands}
          recentProjects={recentProjects}
          onOpenRecent={projectActions.loadRecentProject}
          onClearRecent={projectActions.clearRecents}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={handleOpenCommandPalette}
            className="text-muted-foreground hover:text-foreground"
          >
            <CommandIcon size={11} />
            <span>Commands</span>
            <kbd className="font-mono text-[11px] text-muted-foreground/80">Ctrl+K</kbd>
          </Button>

          {!isHome && (
            <Button variant="primary" size="xs" onClick={handleExportClick}>
              <Download size={12} />
              <span>Export</span>
            </Button>
          )}
        </div>
      </div>

      <TabStrip
        tabs={tabs}
        activeProjectId={activeProjectId}
        onSelectProject={projectActions.setActiveProjectId}
        onCloseProject={projectActions.closeProject}
        onNewProject={projectActions.createProject}
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
        <DesktopWorkspace
          state={state}
          updateState={updateState}
          projectActions={projectActions}
          history={history}
          historyIndex={historyIndex}
          canUndo={canUndo}
          canRedo={canRedo}
          canvasTools={canvasTools}
          fileSystem={fileSystem}
          setMousePos={setMousePos}
          setDragStartPos={setDragStartPos}
          onScalePixels={onScalePixels}
          layoutActions={layoutActions}
          slots={slots}
          floatingPanes={floatingPanes}
          draggedPane={draggedPane}
          dragOverSlot={dragOverSlot}
          dragOverIndex={dragOverIndex}
          dragOverZone={dragOverZone}
          activeTagPopover={activeTagPopover}
          onCloseTagPopover={onCloseTagPopover}
          layerPropertiesState={layerPropertiesState}
          onCloseLayerProperties={onCloseLayerProperties}
          fitTrigger={fitTrigger}
          onPreviewLayer={onPreviewLayer}
          onRevertLayerPreview={onRevertLayerPreview}
          onPreviewTag={onPreviewTag}
          onRevertTagPreview={onRevertTagPreview}
          tabMenu={tabMenu}
        />
      )}

      {/* Dock Tab Context Menu via @ui-sdk/react MenuController */}
      <Menu controller={tabMenu}>
        <MenuContent<TabMenuPayload> align="start" className="w-52">
          {(menuState) => {
            const ctx = menuState.payload;
            if (!ctx) return null;
            const title = PANE_METADATA[ctx.paneId]?.title || ctx.paneId;

            return (
              <>
                <MenuGroup>
                  <MenuGroupLabel>{title}</MenuGroupLabel>
                  <MenuItem value="close-tab" onSelect={() => layoutActions.handleClosePane(ctx.paneId)}>
                    <MenuItemIcon>
                      <X size={13} />
                    </MenuItemIcon>
                    <span>Close Tab</span>
                  </MenuItem>

                  {ctx.slotId !== 'floating' && ctx.groupId && (
                    <MenuItem
                      value="close-others"
                      onSelect={() =>
                        layoutActions.handleCloseOtherPanesInGroup(
                          ctx.slotId as 'left' | 'right' | 'bottom',
                          ctx.groupId!,
                          ctx.paneId
                        )
                      }
                    >
                      <MenuItemIcon>
                        <Minus size={13} />
                      </MenuItemIcon>
                      <span>Close Other Tabs</span>
                    </MenuItem>
                  )}

                  {ctx.slotId !== 'floating' && (
                    <MenuItem
                      value="close-all-dock"
                      destructive
                      onSelect={() =>
                        layoutActions.handleCloseAllPanesInSlot(ctx.slotId as 'left' | 'right' | 'bottom')
                      }
                    >
                      <MenuItemIcon>
                        <X size={13} className="text-destructive" />
                      </MenuItemIcon>
                      <span>Close All Tabs in Dock</span>
                    </MenuItem>
                  )}
                </MenuGroup>

                {ctx.slotId !== 'floating' && (
                  <>
                    {ctx.groupId && (
                      <>
                        <MenuSeparator />
                        <MenuGroup>
                          <MenuItem
                            value="split-down"
                            onSelect={() =>
                              layoutActions.splitGroup(
                                ctx.slotId as 'left' | 'right' | 'bottom',
                                ctx.groupId!,
                                ctx.paneId,
                                'vertical'
                              )
                            }
                          >
                            <MenuItemIcon>
                              <FlipVertical size={13} />
                            </MenuItemIcon>
                            <span>Split Down</span>
                          </MenuItem>
                          <MenuItem
                            value="split-right"
                            onSelect={() =>
                              layoutActions.splitGroup(
                                ctx.slotId as 'left' | 'right' | 'bottom',
                                ctx.groupId!,
                                ctx.paneId,
                                'horizontal'
                              )
                            }
                          >
                            <MenuItemIcon>
                              <FlipVertical size={13} className="rotate-90" />
                            </MenuItemIcon>
                            <span>Split Right</span>
                          </MenuItem>
                          {slots[ctx.slotId]?.groups.length > 1 && (
                            <MenuItem
                              value="unsplit"
                              onSelect={() =>
                                layoutActions.unsplitSlot(ctx.slotId as 'left' | 'right' | 'bottom')
                              }
                            >
                              <MenuItemIcon>
                                <ArrowRightLeft size={13} />
                              </MenuItemIcon>
                              <span>Unsplit View</span>
                            </MenuItem>
                          )}
                        </MenuGroup>
                      </>
                    )}

                    <MenuSeparator />
                    <MenuGroup>
                      <MenuItem
                        value="float"
                        onSelect={() =>
                          layoutActions.floatPane(ctx.paneId, ctx.slotId, ctx.groupId, 160, 120)
                        }
                      >
                        <MenuItemIcon>
                          <Move size={13} />
                        </MenuItemIcon>
                        <span>Float Window</span>
                      </MenuItem>
                      {DOCK_SLOTS.filter((s) => s !== ctx.slotId).map((targetSlot) => (
                        <MenuItem
                          key={targetSlot}
                          value={`move-${targetSlot}`}
                          onSelect={() => layoutActions.handleAddPaneToSlot(targetSlot, ctx.paneId)}
                        >
                          <MenuItemIcon>
                            <Move size={13} />
                          </MenuItemIcon>
                          <span>
                            Move to {targetSlot.charAt(0).toUpperCase() + targetSlot.slice(1)} Dock
                          </span>
                        </MenuItem>
                      ))}
                    </MenuGroup>
                  </>
                )}

                {ctx.slotId === 'floating' && (
                  <>
                    <MenuSeparator />
                    <MenuGroup>
                      {DOCK_SLOTS.map((targetSlot) => (
                        <MenuItem
                          key={targetSlot}
                          value={`dock-${targetSlot}`}
                          onSelect={() => layoutActions.handleAddPaneToSlot(targetSlot, ctx.paneId)}
                        >
                          <MenuItemIcon>
                            <Move size={13} />
                          </MenuItemIcon>
                          <span>
                            Dock to {targetSlot.charAt(0).toUpperCase() + targetSlot.slice(1)}
                          </span>
                        </MenuItem>
                      ))}
                    </MenuGroup>
                  </>
                )}
              </>
            );
          }}
        </MenuContent>
      </Menu>

      <StatusBar
        tool={state.tool}
        inkType={state.inkType}
        smudgeMode={state.smudgeMode}
        width={state.width}
        height={state.height}
        activeFrameIndex={state.activeFrameIndex}
        frameCount={state.frames.length}
        zoom={state.zoom}
        activeLayerName={activeLayerName}
        isHome={isHome}
        selectionSize={selectionSize}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
        onZoomFit={onZoomFit}
      />
    </div>
  );
};
