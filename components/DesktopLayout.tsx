import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Allotment } from 'allotment';
import { ProjectState, ToolType } from '../types';
import { SELECTION_TOOLS } from '../constants';
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
  Scissors,
  Sparkles,
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
  project: any;
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
  layout: any;
  activeTagPopover?: any;
  onCloseTagPopover?: () => void;
  layerPropertiesState?: { isOpen: boolean; layer: any };
  onCloseLayerProperties?: () => void;
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

  return (
    <div className="flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto border-r border-border bg-card py-2 no-scrollbar">
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

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Shape Tools"
                      onClick={() => {
                        if (!SHAPE_TOOLS.includes(tool)) {
                          onSelectTool(lastShapeTool);
                        }
                      }}
                      className={`relative flex items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        SHAPE_TOOLS.includes(tool)
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
              <span>Shape Tools</span>
              <TooltipShortcut>U</TooltipShortcut>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="flex w-44 flex-col gap-0.5 p-1.5">
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('rect')}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Effect Brushes"
                      onClick={() => {
                        if (!EFFECT_TOOLS.includes(tool)) {
                          onSelectTool(lastEffectTool);
                        }
                      }}
                      className={`relative flex items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        EFFECT_TOOLS.includes(tool)
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
              <span>Effect Brushes</span>
              <TooltipShortcut>R</TooltipShortcut>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="flex w-44 flex-col gap-0.5 p-1.5">
            <PopoverClose
              render={
                <button
                  type="button"
                  onClick={() => onSelectTool('blur')}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Selection Tools"
                      onClick={() => {
                        if (!SELECTION_TOOLS.includes(tool)) {
                          onSelectTool(lastSelectionTool);
                        }
                      }}
                      className={`relative flex items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        SELECTION_TOOLS.includes(tool)
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
              <span>Selection Tools</span>
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
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors ${
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
                      className="absolute right-0 bottom-0 h-6 w-6 rounded-sm border border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  }
                />
              }
            />
            <TooltipContent side="right">Secondary Color</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={10}
            className="w-auto border-none bg-transparent p-0 shadow-none"
          >
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
                      className="absolute top-0 left-0 z-10 h-6 w-6 rounded-sm border border-border-strong shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: primaryColor }}
                    />
                  }
                />
              }
            />
            <TooltipContent side="right">Primary Color</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={10}
            className="w-auto border-none bg-transparent p-0 shadow-none"
          >
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
                className="absolute top-0 right-0 z-20 flex h-4 w-4 items-center justify-center rounded-bl-sm border-b border-l border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
    </div>
  );
};

interface DockPaneContentProps {
  paneId: string;
  state: ProjectState;
  project: any;
  fileSystem: any;
  layerPropertiesState?: { isOpen: boolean; layer: any };
  onCloseLayerProperties?: () => void;
  activeTagPopover?: any;
  onCloseTagPopover?: () => void;
  onPaletteColorSelect: (c: string, isPrimary: boolean) => void;
  onPaletteAddColor: (c: string) => void;
  onPaletteColorsSelected: (selectedColors: string[]) => void;
  onSelectLayers: (ids: string[], active: string) => void;
  onSelectFrames: (indices: number[], active: number, layerId?: string) => void;
  onTimelineSelectLayer: (id: string) => void;
  onTimelineToggleLayerVisibility: (id: string) => void;
  onTimelineToggleLayerLock: (id: string) => void;
  onClosePreview: () => void;
  isFloating?: boolean;
}

const DockPaneContent: React.FC<DockPaneContentProps> = ({
  paneId,
  state,
  project,
  fileSystem,
  layerPropertiesState,
  onCloseLayerProperties,
  activeTagPopover,
  onCloseTagPopover,
  onPaletteColorSelect,
  onPaletteAddColor,
  onPaletteColorsSelected,
  onSelectLayers,
  onSelectFrames,
  onTimelineSelectLayer,
  onTimelineToggleLayerVisibility,
  onTimelineToggleLayerLock,
  onClosePreview,
  isFloating = false,
}) => {
  switch (paneId) {
    case 'file-tree':
      return (
        <FileTree
          rootHandle={fileSystem.rootHandle}
          onOpenFolder={fileSystem.openFolder}
          onFileOpen={project.loadProjectFromFile}
          onResizeStart={NOOP}
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
          onColorSelect={onPaletteColorSelect}
          onAddColor={onPaletteAddColor}
          onSelectPalette={project.selectPalette}
          onImportPalette={project.importPalette}
          onResizeStart={NOOP}
          onColorsSelected={onPaletteColorsSelected}
        />
      );
    case 'layers':
      return (
        <LayersPanel
          layers={state.layers}
          activeFrame={state.frames[state.activeFrameIndex]}
          activeLayerId={state.activeLayerId}
          selectedLayerIds={state.selectedLayerIds}
          palette={state.palette}
          width={state.width}
          height={state.height}
          onSelectLayers={onSelectLayers}
          onUpdateLayer={project.updateLayer}
          onAddLayer={project.addLayer}
          onAddGroupLayer={project.addGroupLayer}
          onGroupSelectedLayers={project.groupSelectedLayers}
          onUngroupSelectedLayers={project.ungroupSelectedLayers}
          onAddLayerToGroup={project.addLayerToGroup}
          onToggleCollapseAllGroups={project.toggleCollapseAllGroups}
          onDuplicateLayer={project.duplicateLayer}
          onDeleteLayer={project.deleteLayer}
          onDuplicateSelectedLayers={project.duplicateSelectedLayers}
          onDeleteSelectedLayers={project.deleteSelectedLayers}
          onReorderLayers={project.reorderLayers}
          onOpenLayerProperties={project.openLayerPropertiesDialog}
          layerPropertiesState={layerPropertiesState}
          onCloseLayerProperties={onCloseLayerProperties}
          className="h-full w-full flex-1"
        />
      );
    case 'history':
      return (
        <HistoryPanel
          history={project.history}
          historyIndex={project.historyIndex}
          onJumpToHistory={project.jumpToHistory}
          className="h-full w-full flex-1"
        />
      );
    case 'timeline':
      return (
        <Timeline
          layers={state.layers}
          frames={state.frames}
          activeFrameIndex={state.activeFrameIndex}
          activeLayerId={state.activeLayerId}
          selectedFrameIndices={state.selectedFrameIndices}
          selectedLayerIds={state.selectedLayerIds}
          tags={state.tags}
          onSelectFrames={onSelectFrames}
          onAddFrame={project.addFrame}
          onDuplicateFrame={project.duplicateFrame}
          onDeleteFrame={project.deleteFrame}
          onDuplicateSelectedFrames={project.duplicateSelectedFrames}
          onDeleteSelectedFrames={project.deleteSelectedFrames}
          onInsertFrame={project.insertFrame}
          onTweenFrames={project.tweenFrames}
          onSetFrameDuration={project.setFrameDuration}
          onAddTag={project.addTag}
          onSaveTag={project.saveTag}
          onDeleteTag={project.deleteTag}
          onOpenTagProperties={project.openTagPropertiesDialog}
          activeTagPopover={activeTagPopover}
          onCloseTagPopover={onCloseTagPopover}
          onSelectLayer={onTimelineSelectLayer}
          onAddLayer={project.addLayer}
          onAddGroupLayer={project.addGroupLayer}
          onUpdateLayer={project.updateLayer}
          onToggleLayerVisibility={onTimelineToggleLayerVisibility}
          onToggleLayerLock={onTimelineToggleLayerLock}
          onReorderLayers={project.reorderLayers}
          onReorderFrames={project.reorderFrames}
        />
      );
    case 'preview':
      return (
        <Preview
          width={0}
          frames={state.frames}
          layers={state.layers}
          palette={state.palette}
          spriteWidth={state.width}
          spriteHeight={state.height}
          activeFrameIndex={state.activeFrameIndex}
          onClose={onClosePreview}
          isFloating={isFloating}
        />
      );
    default:
      return null;
  }
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - pane.x,
      y: e.clientY - pane.y,
    });
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateFloatingPanePosition(pane.id, e.clientX - dragOffset.x, e.clientY - dragOffset.y);
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
      className="pointer-events-auto absolute z-40 flex flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl select-none"
      style={{
        left: pane.x,
        top: pane.y,
        width: pane.width || 280,
        height: pane.height || 320,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        onMouseDown={handleMouseDown}
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
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={12} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-card">{children}</div>
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
  setMousePos,
  setDragStartPos,
  onScalePixels,
  selectionSize,
  layout,
  activeTagPopover,
  onCloseTagPopover,
  layerPropertiesState,
  onCloseLayerProperties,
}) => {
  const tabMenu = useMemo(() => createMenuController<TabMenuPayload>(), []);

  const {
    slots,
    floatingPanes,
    draggedPane,
    dragOverSlot,
    dragOverIndex,
    dragOverZone,
    togglePaneVisibility,
    handleDragStart,
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
    setSlotVisibility,
  } = layout;

  const isPreviewDocked = Object.values(slots).some(
    (s: any) => s.visible && s.groups.some((g: any) => g.panes.includes('preview'))
  );
  const isPreviewFloating = floatingPanes.some((fp: any) => fp.id === 'preview');
  const isPreviewVisible = isPreviewDocked || isPreviewFloating;

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
    handleClosePane('preview');
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
    const currentTool = project.getActiveState().tool;
    updateState((prev) => ({ ...prev, selection: sel }), { action: 'Select Area', tool: currentTool });
  };

  const handleCanvasZoom = (z: number) => {
    updateState((prev) => ({ ...prev, zoom: z }));
  };

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

  const slotTabListRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
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

    const tabs = Array.from(container.querySelectorAll('[data-tab-id]')) as HTMLElement[];
    let left: number;
    if (tabs.length === 0) {
      left = 4;
    } else {
      const idx = dragOverIndex.index;
      if (idx <= 0) {
        left = tabs[0].offsetLeft;
      } else if (idx >= tabs.length) {
        const last = tabs[tabs.length - 1];
        left = last.offsetLeft + last.offsetWidth;
      } else {
        const prev = tabs[idx - 1];
        const curr = tabs[idx];
        left = Math.round((prev.offsetLeft + prev.offsetWidth + curr.offsetLeft) / 2);
      }
    }
    setTabDropIndicator({ key, left });
  }, [dragOverIndex, dragOverZone, slots]);

  const getIndicatorLeftPos = (slotId: 'left' | 'right' | 'bottom', groupId?: string) => {
    if (!tabDropIndicator) return null;
    const key = `${slotId}-${groupId || ''}`;
    return tabDropIndicator.key === key ? tabDropIndicator.left : null;
  };

  const renderSlotContainer = (slotId: 'left' | 'right' | 'bottom') => {
    const slot = slots[slotId];
    if (!slot || !slot.visible || slot.groups.length === 0) return null;

    const closedPanes = Object.keys(PANE_METADATA).filter(
      (paneId) =>
        !Object.values(slots).some((s: any) => s.groups.some((g: any) => g.panes.includes(paneId))) &&
        !floatingPanes.some((fp: any) => fp.id === paneId)
    );

    const renderGroupContainer = (group: any) => {
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
          className={`relative flex h-full w-full flex-col overflow-hidden border border-border bg-card select-none ${
            isBodyTopHover || isBodyBottomHover || isBodyLeftHover || isBodyRightHover
              ? 'ring-2 ring-primary ring-inset'
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
          <div className="relative flex h-7 shrink-0 items-center justify-between overflow-hidden border-b border-border bg-background/60 px-1 select-none">
            <div
              ref={(el) => {
                slotTabListRefs.current[`${slotId}-${group.id}`] = el;
              }}
              className="relative flex h-full max-w-[85%] items-center gap-0.5 overflow-x-auto no-scrollbar"
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
                      tabMenu.open({
                        payload: { paneId, slotId, groupId: group.id },
                        anchor: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    onClick={() => handleSelectTab(slotId, group.id, paneId)}
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
                        handleClosePane(paneId);
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
                            onClick={() => handleAddPaneToGroup(slotId, group.id, paneId)}
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

              {slot.groups.length > 1 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Unsplit dock"
                        onClick={() => unsplitSlot(slotId)}
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
                      onClick={() => setSlotVisibility(slotId, false)}
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
            <DockPaneContent
              paneId={group.activePaneId}
              state={state}
              project={project}
              fileSystem={fileSystem}
              layerPropertiesState={layerPropertiesState}
              onCloseLayerProperties={onCloseLayerProperties}
              activeTagPopover={activeTagPopover}
              onCloseTagPopover={onCloseTagPopover}
              onPaletteColorSelect={handlePaletteColorSelect}
              onPaletteAddColor={handlePaletteAddColor}
              onPaletteColorsSelected={handlePaletteColorsSelected}
              onSelectLayers={handleSelectLayers}
              onSelectFrames={handleSelectFrames}
              onTimelineSelectLayer={handleTimelineSelectLayer}
              onTimelineToggleLayerVisibility={handleTimelineToggleLayerVisibility}
              onTimelineToggleLayerLock={handleTimelineToggleLayerLock}
              onClosePreview={handleClosePreview}
            />

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

    if (slot.groups.length === 1) {
      return renderGroupContainer(slot.groups[0]);
    }

    return (
      <Allotment vertical={slot.splitDirection === 'vertical'} className="h-full w-full">
        {slot.groups.map((group: any) => (
          <Allotment.Pane key={group.id} minSize={80}>
            {renderGroupContainer(group)}
          </Allotment.Pane>
        ))}
      </Allotment>
    );
  };

  const { activeProjectId } = project;
  const isHome = activeProjectId === 'home';
  const activeLayerName = state.layers.find((l) => l.id === state.activeLayerId)?.name;

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
    />
  );

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
          recentProjects={project.recentProjects}
          onOpenRecent={project.loadRecentProject}
          onClearRecent={project.clearRecents}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => commands.find((c) => c.id === 'app.commandPalette')?.perform()}
            className="flex h-6 items-center gap-1.5 rounded-sm border border-border bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CommandIcon size={11} />
            <span>Commands</span>
            <kbd className="font-mono text-[11px] text-muted-foreground/80">Ctrl+K</kbd>
          </button>

          {!isHome && (
            <button
              type="button"
              onClick={() =>
                project.openExportDialog ? project.openExportDialog('gif') : project.downloadImage()
              }
              className="flex h-6 items-center gap-1.5 rounded-sm bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download size={12} />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      <TabStrip
        tabs={project.tabs}
        activeProjectId={project.activeProjectId}
        onSelectProject={project.setActiveProjectId}
        onCloseProject={project.closeProject}
        onNewProject={project.createProject}
      />

      {isHome ? (
        <Home
          onCreateProject={project.createProject}
          onImportProject={() => fileInputRef.current?.click()}
          recentProjects={project.recentProjects}
          onOpenRecent={project.loadRecentProject}
          onClearRecent={project.clearRecents}
        />
      ) : (
        <>
          {/* Contextual Tool Options Strip */}
          <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-background/80 px-2 text-xs no-scrollbar">
            <div className="flex shrink-0 items-center gap-1 border-r border-border pr-2">
              <ToolButton
                active={false}
                onClick={() => commands.find((c) => c.id === 'edit.undo')?.perform()}
                icon={<Undo size={15} />}
                label="Undo"
                shortcut="Ctrl+Z"
                tooltipSide="bottom"
              />
              <ToolButton
                active={false}
                onClick={() => commands.find((c) => c.id === 'edit.redo')?.perform()}
                icon={<Redo size={15} />}
                label="Redo"
                shortcut="Ctrl+Y"
                tooltipSide="bottom"
              />
            </div>

            <div className="flex min-w-max flex-1 items-center gap-3 px-1">
              <SegmentedControl
                value={state.inkType}
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

              {state.inkType === 'shading' && (
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Shades</span>
                  <div className="flex h-5 min-w-[72px] items-center gap-0.5 rounded-sm border border-border bg-background p-0.5">
                    {state.shades.map((color, idx) => (
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
                    {state.shades.length < 16 && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label="Add primary color to shade ramp"
                              onClick={() => addShade(state.primaryColor)}
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
                            disabled={state.shades.length < 2}
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
                    active={state.symmetry.x}
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
                    active={state.symmetry.y}
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

              {BRUSH_OPTION_TOOLS.includes(state.tool) && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Size</span>
                    <CustomSlider
                      min={1}
                      max={10}
                      value={state.brushSize}
                      onValueChange={(val) => updateState((prev) => ({ ...prev, brushSize: val }))}
                      aria-label="Brush size"
                      className="w-24"
                    />
                    <span className="w-5 text-right font-mono text-[11px] text-foreground tabular-nums">
                      {state.brushSize}px
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
                    <ToolButton
                      active={state.brushShape === 'square'}
                      onClick={() => updateState((prev) => ({ ...prev, brushShape: 'square' }))}
                      icon={<Square size={14} />}
                      label="Square Brush"
                      tooltipSide="bottom"
                    />
                    <ToolButton
                      active={state.brushShape === 'circle'}
                      onClick={() => updateState((prev) => ({ ...prev, brushShape: 'circle' }))}
                      icon={<Circle size={14} />}
                      label="Circle Brush"
                      tooltipSide="bottom"
                    />
                  </div>

                  {state.tool === 'pencil' && state.inkType === 'simple' && (
                    <label
                      htmlFor="pixelPerfect"
                      className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <CustomCheckbox
                        id="pixelPerfect"
                        checked={state.pixelPerfect}
                        onCheckedChange={(checked) =>
                          updateState((prev) => ({ ...prev, pixelPerfect: !!checked }))
                        }
                      />
                      <span>Pixel Perfect</span>
                    </label>
                  )}

                  {state.tool === 'smudge' && (
                    <>
                      <div className="h-4 w-px bg-border" />
                      <SegmentedControl
                        value={state.smudgeMode || 'blend'}
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
                          value={Math.round((state.smudgeStrength ?? 0.7) * 100)}
                          onValueChange={(val) =>
                            updateState((prev) => ({ ...prev, smudgeStrength: val / 100 }))
                          }
                          aria-label="Smudge strength"
                          className="w-20"
                        />
                        <span className="w-8 font-mono text-[11px] text-foreground tabular-nums">
                          {Math.round((state.smudgeStrength ?? 0.7) * 100)}%
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}

              {(state.tool === 'bucket' || state.tool === 'magic-wand') && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <label
                    htmlFor="contiguous"
                    className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <CustomCheckbox
                      id="contiguous"
                      checked={state.fillContiguous}
                      onCheckedChange={(checked) =>
                        updateState((prev) => ({ ...prev, fillContiguous: !!checked }))
                      }
                    />
                    <span>Contiguous</span>
                  </label>
                </>
              )}

              {state.tool === 'move' && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Rotation</span>
                    <SegmentedControl
                      value={state.rotationAlgorithm}
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
                active={state.showGrid}
                onClick={() => updateState((prev) => ({ ...prev, showGrid: !prev.showGrid }))}
                icon={<Grid size={15} />}
                label="Toggle Grid"
                shortcut="Shift+G"
                tooltipSide="bottom"
              />
              <ToolButton
                active={state.onionSkin}
                onClick={() => updateState((prev) => ({ ...prev, onionSkin: !prev.onionSkin }))}
                icon={<Eye size={15} />}
                label="Onion Skin"
                shortcut="Alt+O"
                tooltipSide="bottom"
              />
            </div>
          </div>

          {/* Main Workspace Grid */}
          <div
            className="relative min-h-0 flex-1"
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
              floatPane(draggedPane.paneId, draggedPane.sourceSlot, draggedPane.sourceGroupId, x, y);
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  tabMenu.open({
                    payload: { paneId: pane.id, slotId: 'floating' },
                    anchor: { x: e.clientX, y: e.clientY },
                  });
                }}
              >
                <DockPaneContent
                  paneId={pane.id}
                  state={state}
                  project={project}
                  fileSystem={fileSystem}
                  layerPropertiesState={layerPropertiesState}
                  onCloseLayerProperties={onCloseLayerProperties}
                  activeTagPopover={activeTagPopover}
                  onCloseTagPopover={onCloseTagPopover}
                  onPaletteColorSelect={handlePaletteColorSelect}
                  onPaletteAddColor={handlePaletteAddColor}
                  onPaletteColorsSelected={handlePaletteColorsSelected}
                  onSelectLayers={handleSelectLayers}
                  onSelectFrames={handleSelectFrames}
                  onTimelineSelectLayer={handleTimelineSelectLayer}
                  onTimelineToggleLayerVisibility={handleTimelineToggleLayerVisibility}
                  onTimelineToggleLayerLock={handleTimelineToggleLayerLock}
                  onClosePreview={handleClosePreview}
                  isFloating
                />
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
                    {renderSlotContainer('left')}
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
                    {renderSlotContainer('right')}
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
                {renderSlotContainer('bottom')}
              </Allotment.Pane>
            </Allotment>
          </div>
        </>
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
                  <MenuItem value="close-tab" onSelect={() => handleClosePane(ctx.paneId)}>
                    <MenuItemIcon>
                      <X size={13} />
                    </MenuItemIcon>
                    <span>Close Tab</span>
                  </MenuItem>

                  {ctx.slotId !== 'floating' && ctx.groupId && (
                    <MenuItem
                      value="close-others"
                      onSelect={() =>
                        handleCloseOtherPanesInGroup(
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
                        handleCloseAllPanesInSlot(ctx.slotId as 'left' | 'right' | 'bottom')
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
                              splitGroup(
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
                              splitGroup(
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
                                unsplitSlot(ctx.slotId as 'left' | 'right' | 'bottom')
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
                          floatPane(ctx.paneId, ctx.slotId, ctx.groupId, 160, 120)
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
                            onSelect={() => handleAddPaneToSlot(targetSlot, ctx.paneId)}
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
                          onSelect={() => handleAddPaneToSlot(targetSlot, ctx.paneId)}
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
      />
    </div>
  );
};
