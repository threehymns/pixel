import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Layer, LayerBlendMode, Frame, PixelGrid } from '../types';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Copy,
  Trash2,
  GripVertical,
  Settings,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderOutput,
  Search,
  Sliders,
  ChevronsUpDown,
  X,
  Tag,
} from './Icons';
import {
  getPackedPalette255,
  pixelToPackedImageData,
  getLayerParentMap,
  isLayerVisible,
  getGroupChildren,
  isDescendant,
} from '../utils';
import { ENTITY_COLOR_TAGS } from '../constants';
import { CustomSlider } from './ui/slider';
import { StudioSelect } from './ui/select';
import { Input, InputGroup, InputClear } from './ui/input';
import { IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Toolbar } from './ui/toolbar';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from './ui/context-menu';
import { Popover, PopoverArrow, PopoverContent } from './ui/popover';
import { LayerPropertiesDialog } from './LayerPropertiesDialog';
import { cn } from '../lib/utils';

const BLEND_MODE_OPTIONS: { value: LayerBlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
  { value: 'addition', label: 'Addition' },
  { value: 'subtract', label: 'Subtract' },
  { value: 'divide', label: 'Divide' },
];

const THUMB_SIZE = 28;

const computeThumbBox = (width: number, height: number) => {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const scale = Math.min(THUMB_SIZE / safeW, THUMB_SIZE / safeH);
  const dstW = Math.max(1, Math.min(THUMB_SIZE, Math.round(safeW * scale)));
  const dstH = Math.max(1, Math.min(THUMB_SIZE, Math.round(safeH * scale)));
  const dstX = Math.floor((THUMB_SIZE - dstW) / 2);
  const dstY = Math.floor((THUMB_SIZE - dstH) / 2);
  return { dstX, dstY, dstW, dstH };
};

const downsamplePixelsToThumb = (
  pixels: PixelGrid,
  srcW: number,
  srcH: number,
  paletteUint32: Uint32Array,
  target32: Uint32Array,
  dstX: number,
  dstY: number,
  dstW: number,
  dstH: number
) => {
  target32.fill(0);
  const totalSrc = pixels.length;
  for (let ty = 0; ty < dstH; ty++) {
    const sy = Math.min(srcH - 1, Math.floor((ty * srcH) / dstH));
    const srcRow = sy * srcW;
    const dstRow = (dstY + ty) * THUMB_SIZE + dstX;
    for (let tx = 0; tx < dstW; tx++) {
      const sx = Math.min(srcW - 1, Math.floor((tx * srcW) / dstW));
      const srcIdx = srcRow + sx;
      if (srcIdx >= totalSrc) continue;
      const val = pixels[srcIdx];
      if (val !== 0) {
        target32[dstRow + tx] = pixelToPackedImageData(val, paletteUint32);
      }
    }
  }
};

interface LayerThumbnailProps {
  pixels: PixelGrid | undefined;
  palette: string[];
  width: number;
  height: number;
}

const LayerThumbnail: React.FC<LayerThumbnailProps> = ({ pixels, palette, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbImgDataRef = useRef<{ imageData: ImageData; data32: Uint32Array } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!pixels || width <= 0 || height <= 0) {
      ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
      return;
    }

    if (!thumbImgDataRef.current) {
      const imageData = ctx.createImageData(THUMB_SIZE, THUMB_SIZE);
      thumbImgDataRef.current = {
        imageData,
        data32: new Uint32Array(imageData.data.buffer),
      };
    }

    const { imageData, data32 } = thumbImgDataRef.current;
    const paletteUint32 = getPackedPalette255(palette);
    const { dstX, dstY, dstW, dstH } = computeThumbBox(width, height);

    downsamplePixelsToThumb(pixels, width, height, paletteUint32, data32, dstX, dstY, dstW, dstH);
    ctx.putImageData(imageData, 0, 0);
  }, [pixels, palette, width, height]);

  return (
    <div className="checkerboard-alpha relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border">
      <canvas ref={canvasRef} width={THUMB_SIZE} height={THUMB_SIZE} className="pixelated h-full w-full object-contain" />
    </div>
  );
};

interface GroupThumbnailProps {
  groupId: string;
  layers: Layer[];
  activeFrame: Frame | undefined;
  palette: string[];
  width: number;
  height: number;
  collapsed: boolean;
}

interface GroupChildSnapshot {
  id: string;
  visible: boolean;
  opacity: number;
  pixels: PixelGrid | undefined;
}

const GroupThumbnail: React.FC<GroupThumbnailProps> = ({ groupId, layers, activeFrame, palette, width, height, collapsed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgDataRef = useRef<{ imageData: ImageData; data32: Uint32Array } | null>(null);
  const lastDrawnRef = useRef<{
    width: number;
    height: number;
    palette: string[];
    children: GroupChildSnapshot[];
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const children = getGroupChildren(groupId, layers).filter((l) => l.type !== 'group');
    const prev = lastDrawnRef.current;
    if (
      prev &&
      prev.width === width &&
      prev.height === height &&
      prev.palette === palette &&
      prev.children.length === children.length
    ) {
      let unchanged = true;
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        const pc = prev.children[i];
        const pix = activeFrame?.layerData[c.id];
        if (
          pc.id !== c.id ||
          pc.visible !== c.visible ||
          pc.opacity !== (c.opacity ?? 100) ||
          pc.pixels !== pix
        ) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) return;
    }

    lastDrawnRef.current = {
      width,
      height,
      palette,
      children: children.map((c) => ({
        id: c.id,
        visible: c.visible,
        opacity: c.opacity ?? 100,
        pixels: activeFrame?.layerData[c.id],
      })),
    };

    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    if (children.length === 0 || !activeFrame || width <= 0 || height <= 0) return;

    if (!layerCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = THUMB_SIZE;
      c.height = THUMB_SIZE;
      layerCanvasRef.current = c;
    }
    const layerCanvas = layerCanvasRef.current;
    const lCtx = layerCanvas.getContext('2d');
    if (!lCtx) return;

    if (!imgDataRef.current) {
      const imageData = lCtx.createImageData(THUMB_SIZE, THUMB_SIZE);
      imgDataRef.current = {
        imageData,
        data32: new Uint32Array(imageData.data.buffer),
      };
    }

    const { imageData, data32 } = imgDataRef.current;
    const paletteUint32 = getPackedPalette255(palette);
    const { dstX, dstY, dstW, dstH } = computeThumbBox(width, height);

    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.visible) continue;
      const pixels = activeFrame.layerData[child.id];
      if (!pixels) continue;
      const opacity = child.opacity ?? 100;
      if (opacity <= 0) continue;

      downsamplePixelsToThumb(pixels, width, height, paletteUint32, data32, dstX, dstY, dstW, dstH);
      lCtx.putImageData(imageData, 0, 0);
      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(layerCanvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [groupId, layers, activeFrame, palette, width, height]);

  return (
    <div className="checkerboard-alpha relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-primary/40">
      <canvas ref={canvasRef} width={THUMB_SIZE} height={THUMB_SIZE} className="pixelated relative z-10 h-full w-full object-contain" />
      <div className="absolute top-0 right-0 z-20 rounded-bl bg-primary/90 p-0.5 text-primary-foreground">
        {collapsed ? <Folder size={8} /> : <FolderOpen size={8} />}
      </div>
    </div>
  );
};

interface LayersPanelProps {
  layers: Layer[];
  activeFrame: Frame | undefined;
  activeLayerId: string;
  selectedLayerIds: string[];
  palette: string[];
  width: number;
  height: number;
  onSelectLayers: (ids: string[], activeId: string) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: () => void;
  onAddGroupLayer?: () => void;
  onGroupSelectedLayers?: () => void;
  onUngroupSelectedLayers?: () => void;
  onAddLayerToGroup?: (groupId: string) => void;
  onToggleCollapseAllGroups?: (forceCollapse?: boolean) => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateSelectedLayers: () => void;
  onDeleteSelectedLayers: () => void;
  onReorderLayers: (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom'
  ) => void;
  onOpenLayerProperties?: (layer: Layer) => void;
  layerPropertiesState?: { isOpen: boolean; layer: Layer | null };
  onCloseLayerProperties?: () => void;
  onPreviewLayer?: (id: string, updates: Partial<Layer>) => void;
  onRevertLayerPreview?: (id: string, snapshot: Partial<Layer>) => void;
  density?: 'compact' | 'touch';
  className?: string;
}

interface DragState {
  id: string;
  overId: string | null;
  position: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom';
}

interface LayerRowProps {
  layer: Layer;
  pixels: (string | number | null)[] | undefined;
  groupLayers: Layer[] | undefined;
  groupActiveFrame: Frame | undefined;
  palette: string[];
  width: number;
  height: number;
  isActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
  dropPosition: DragState['position'] | null;
  effectiveVis: boolean;
  isEditing: boolean;
  isAnyEditing: boolean;
  editName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onRegisterRowRef: (id: string, el: HTMLDivElement | null) => void;
  onEditNameChange: (name: string) => void;
  onSaveEditing: () => void;
  onCancelEditing: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, layer: Layer) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onLayerClick: (e: React.MouseEvent, id: string) => void;
  onStartEditing: (layer: Layer) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayerToGroup?: (groupId: string) => void;
  onGroupSelectedLayers?: () => void;
  onUngroupSelectedLayers?: () => void;
  onOpenLayerProperties?: (layer: Layer) => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  isTouch: boolean;
}

const LayerRow: React.FC<LayerRowProps> = ({
  layer,
  pixels,
  groupLayers,
  groupActiveFrame,
  palette,
  width,
  height,
  isActive,
  isSelected,
  isDragging,
  dropPosition,
  effectiveVis,
  isEditing,
  isAnyEditing,
  editName,
  editInputRef,
  onRegisterRowRef,
  onEditNameChange,
  onSaveEditing,
  onCancelEditing,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onLayerClick,
  onStartEditing,
  onUpdateLayer,
  onAddLayerToGroup,
  onGroupSelectedLayers,
  onUngroupSelectedLayers,
  onOpenLayerProperties,
  onDuplicateLayer,
  onDeleteLayer,
  isTouch,
}) => {
  const childLevel = Math.min(layer.childLevel ?? 0, 5);
  const isGroup = layer.type === 'group';
  const colorTagObj = ENTITY_COLOR_TAGS.find((t) => t.id === layer.colorTag);
  const showUtilityActions = isTouch || isActive || isSelected || layer.locked;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={(el) => onRegisterRowRef(layer.id, el)}
            role="treeitem"
            aria-level={childLevel + 1}
            aria-expanded={isGroup ? !layer.collapsed : undefined}
            aria-selected={isSelected}
            draggable={!isAnyEditing && !isTouch}
            onDragStart={(e) => onDragStart(e, layer.id)}
            onDragOver={(e) => {
              e.stopPropagation();
              onDragOver(e, layer);
            }}
            onDrop={(e) => {
              e.stopPropagation();
              onDrop(e);
            }}
            onDragEnd={onDragEnd}
            onClick={(e) => onLayerClick(e, layer.id)}
            onDoubleClick={() => onStartEditing(layer)}
            className={cn(
              'group/item relative flex cursor-default items-center gap-1.5 rounded-md border px-2 transition-colors',
              isTouch ? 'min-h-11 py-1' : 'h-9',
              isGroup ? 'font-medium text-foreground' : 'text-foreground/85',
              isActive
                ? 'border-primary/45 bg-primary/15 text-foreground'
                : isSelected
                  ? 'border-border bg-secondary/70 text-foreground'
                  : 'border-transparent hover:bg-accent/50',
              isDragging && 'opacity-35'
            )}
            style={{ marginLeft: `${childLevel * 14}px` }}
          >
            {colorTagObj && (
              <div
                className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-r"
                style={{ backgroundColor: colorTagObj.hex }}
              />
            )}

            {childLevel > 0 && (
              <div className="pointer-events-none absolute top-0 bottom-0 left-0 -ml-2.5 flex items-center">
                <div className="h-full w-px bg-border" />
              </div>
            )}

            {dropPosition === 'before' && (
              <div className="pointer-events-none absolute top-0 right-0 left-0 z-50 flex h-0.5 items-center rounded-full bg-primary">
                <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            )}
            {dropPosition === 'after' && (
              <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-50 flex h-0.5 items-center rounded-full bg-primary">
                <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            )}
            {dropPosition === 'inside' && (
              <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-end rounded-md border-2 border-primary bg-primary/15 pr-2">
                <span className="rounded-xs bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                  Nest in Group
                </span>
              </div>
            )}
            {dropPosition === 'outside' && (
              <div
                className="pointer-events-none absolute bottom-0 z-50 flex h-0.5 items-center rounded-full bg-primary"
                style={{ left: `-${childLevel * 14}px`, right: 0 }}
              >
                <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            )}

            {isGroup ? (
              <button
                type="button"
                aria-label={layer.collapsed ? 'Expand group' : 'Collapse group'}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateLayer(layer.id, { collapsed: !layer.collapsed });
                }}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {layer.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
            ) : (
              <div className="w-3.5 shrink-0" />
            )}

            <button
              type="button"
              aria-label={layer.visible && effectiveVis ? 'Hide layer' : 'Show layer'}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayer(layer.id, { visible: !layer.visible });
              }}
              className={`shrink-0 rounded-sm p-1 transition-colors ${
                !layer.visible || !effectiveVis
                  ? 'text-muted-foreground/35 hover:bg-accent hover:text-muted-foreground'
                  : isActive
                    ? 'text-primary hover:bg-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title={
                layer.visible && !effectiveVis ? 'Hidden by parent group' : undefined
              }
            >
              {layer.visible && effectiveVis ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>

            {isGroup && groupLayers ? (
              <GroupThumbnail
                groupId={layer.id}
                layers={groupLayers}
                activeFrame={groupActiveFrame}
                palette={palette}
                width={width}
                height={height}
                collapsed={!!layer.collapsed}
              />
            ) : (
              <LayerThumbnail
                pixels={pixels}
                palette={palette}
                width={width}
                height={height}
              />
            )}

            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editName}
                  autoFocus
                  onChange={(e) => onEditNameChange(e.target.value)}
                  onBlur={onSaveEditing}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveEditing();
                    if (e.key === 'Escape') onCancelEditing();
                  }}
                  className="w-full rounded-sm border border-primary bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className={`truncate text-[11px] ${
                    isGroup || isActive
                      ? 'font-semibold text-foreground'
                      : 'text-foreground/85 group-hover/item:text-foreground'
                  }`}
                >
                  {layer.name}
                </span>
              )}
            </div>

            <button
              type="button"
              aria-label={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayer(layer.id, { locked: !layer.locked });
              }}
              className={`rounded-sm p-1 transition-opacity ${
                layer.locked
                  ? 'text-primary opacity-100 hover:bg-primary/20'
                  : showUtilityActions
                    ? 'text-muted-foreground/70 opacity-100 hover:bg-accent hover:text-foreground'
                    : 'text-muted-foreground/70 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 hover:bg-accent hover:text-foreground'
              }`}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>

            {onOpenLayerProperties && (
              <button
                type="button"
                aria-label="Layer Properties"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLayerProperties(layer);
                }}
                className={`rounded-sm p-1 text-muted-foreground/70 transition-opacity hover:bg-accent hover:text-foreground ${
                  showUtilityActions
                    ? 'opacity-100'
                    : 'opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100'
                }`}
              >
                <Settings size={12} />
              </button>
            )}

            <div
              className="cursor-grab p-0.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-foreground"
              aria-hidden="true"
            >
              <GripVertical size={12} />
            </div>
          </div>
        }
      />

      <ContextMenuContent>
        {isGroup && onAddLayerToGroup && (
          <ContextMenuItem onSelect={() => onAddLayerToGroup(layer.id)}>
            <Plus size={12} className="text-primary" /> Add Layer Inside Group
          </ContextMenuItem>
        )}
        {onGroupSelectedLayers && (
          <ContextMenuItem onSelect={onGroupSelectedLayers}>
            <FolderPlus size={12} className="text-primary" /> Group Selected (Ctrl+G)
          </ContextMenuItem>
        )}
        {isGroup && onUngroupSelectedLayers && (
          <ContextMenuItem onSelect={onUngroupSelectedLayers}>
            <FolderOutput size={12} /> Ungroup (Ctrl+Shift+G)
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Tag size={12} className="text-primary" /> Color Tag
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-36">
            <ContextMenuItem
              onSelect={() => onUpdateLayer(layer.id, { colorTag: undefined })}
            >
              <span className="h-2.5 w-2.5 rounded-full border border-border bg-transparent" />
              None
            </ContextMenuItem>
            {ENTITY_COLOR_TAGS.map((tag) => (
              <ContextMenuItem
                key={tag.id}
                onSelect={() => onUpdateLayer(layer.id, { colorTag: tag.id })}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tag.hex }}
                />
                {tag.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {onOpenLayerProperties && (
          <ContextMenuItem onSelect={() => onOpenLayerProperties(layer)}>
            <Settings size={12} className="text-muted-foreground" /> Layer Properties...
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => onStartEditing(layer)}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={() => onDuplicateLayer(layer.id)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem destructive onSelect={() => onDeleteLayer(layer.id)}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeFrame,
  activeLayerId,
  selectedLayerIds,
  palette,
  width,
  height,
  onSelectLayers,
  onUpdateLayer,
  onAddLayer,
  onAddGroupLayer,
  onGroupSelectedLayers,
  onUngroupSelectedLayers,
  onAddLayerToGroup,
  onToggleCollapseAllGroups,
  onDuplicateLayer,
  onDeleteLayer,
  onDuplicateSelectedLayers,
  onDeleteSelectedLayers,
  onReorderLayers,
  onOpenLayerProperties,
  layerPropertiesState,
  onCloseLayerProperties,
  onPreviewLayer,
  onRevertLayerPreview,
  density = 'compact',
  className,
}) => {
  const isTouch = density === 'touch';
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const [showOpacity, setShowOpacity] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const latestRef = useRef({
    layers,
    activeLayerId,
    selectedLayerIds,
    editingId,
    editName,
    onSelectLayers,
    onUpdateLayer,
    onReorderLayers,
  });

  useLayoutEffect(() => {
    latestRef.current = {
      layers,
      activeLayerId,
      selectedLayerIds,
      editingId,
      editName,
      onSelectLayers,
      onUpdateLayer,
      onReorderLayers,
    };
  });

  const registerRowRef = (id: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  const startEditing = (layer: Layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEditing = () => {
    const { editingId: curEditingId, editName: curEditName, onUpdateLayer: updateFn } =
      latestRef.current;
    if (curEditingId && curEditName.trim()) {
      updateFn(curEditingId, { name: curEditName.trim() });
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleLayerClick = (e: React.MouseEvent, id: string) => {
    const {
      layers: curLayers,
      activeLayerId: curActiveId,
      selectedLayerIds: curSelectedIds,
      onSelectLayers: selectFn,
    } = latestRef.current;
    let newSelection = [...curSelectedIds];

    if (e.shiftKey) {
      const allIds = curLayers.map((l) => l.id).reverse();
      const startIdx = allIds.indexOf(curActiveId);
      const endIdx = allIds.indexOf(id);
      const range = allIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
      newSelection = Array.from(new Set([...newSelection, ...range]));
    } else if (e.ctrlKey || e.metaKey) {
      if (newSelection.includes(id)) {
        if (newSelection.length > 1) {
          newSelection = newSelection.filter((sid) => sid !== id);
        }
      } else {
        newSelection.push(id);
      }
    } else {
      newSelection = [id];
    }

    selectFn(newSelection, id);
  };

  const getDropTarget = (
    hoveredLayer: Layer,
    clientY: number,
    clientX: number,
    rect: DOMRect
  ): DragState | null => {
    if (!dragStateRef.current) return null;
    const draggedId = dragStateRef.current.id;
    const hoveredId = hoveredLayer.id;

    if (hoveredId === draggedId || isDescendant(hoveredId, draggedId, latestRef.current.layers)) {
      return null;
    }

    const height = rect.height;
    const relativeY = clientY - rect.top;
    const relativeX = clientX - rect.left;
    const childLevel = hoveredLayer.childLevel ?? 0;

    if (hoveredLayer.parentId && relativeX < Math.max(22, childLevel * 14)) {
      return { id: draggedId, overId: hoveredId, position: 'outside' };
    }

    if (hoveredLayer.type === 'group') {
      if (relativeY < height * 0.25) {
        return { id: draggedId, overId: hoveredId, position: 'before' };
      } else if (relativeY > height * 0.75) {
        return { id: draggedId, overId: hoveredId, position: 'after' };
      } else {
        return { id: draggedId, overId: hoveredId, position: 'inside' };
      }
    }

    if (relativeY < height * 0.5) {
      return { id: draggedId, overId: hoveredId, position: 'before' };
    }
    return { id: draggedId, overId: hoveredId, position: 'after' };
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('type', 'layer-panel');
    e.dataTransfer.setData('id', id);
    const newState: DragState = { id, overId: null, position: 'after' };
    setDragState(newState);
    dragStateRef.current = newState;
  };

  const handleDragOver = (e: React.DragEvent, layer: Layer) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newState = getDropTarget(layer, e.clientY, e.clientX, rect);
    if (!newState) {
      if (dragStateRef.current.overId !== null) {
        const resetState = { ...dragStateRef.current, overId: null };
        setDragState(resetState);
        dragStateRef.current = resetState;
      }
      return;
    }
    if (
      dragStateRef.current.overId !== newState.overId ||
      dragStateRef.current.position !== newState.position
    ) {
      setDragState(newState);
      dragStateRef.current = newState;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragStateRef.current.overId && dragStateRef.current.id !== dragStateRef.current.overId) {
      latestRef.current.onReorderLayers(
        dragStateRef.current.id,
        dragStateRef.current.overId,
        dragStateRef.current.position
      );
    }
    setDragState(null);
    dragStateRef.current = null;
  };

  const handleDragEnd = () => {
    setDragState(null);
    dragStateRef.current = null;
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragStateRef.current.overId !== 'root-bottom') {
      const newState: DragState = {
        id: dragStateRef.current.id,
        overId: 'root-bottom',
        position: 'root-bottom',
      };
      setDragState(newState);
      dragStateRef.current = newState;
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragStateRef.current.overId === 'root-bottom' || !dragStateRef.current.overId) {
      latestRef.current.onReorderLayers(dragStateRef.current.id, 'root-bottom', 'root-bottom');
    }
    setDragState(null);
    dragStateRef.current = null;
  };

  const isMultiLayer = selectedLayerIds.length > 1;
  const selectedHasGroup = selectedLayerIds.some(
    (id) => layers.find((l) => l.id === id)?.type === 'group'
  );

  const propsLayer = layerPropertiesState?.layer ?? null;
  const [propsAnchorEl, setPropsAnchorEl] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!layerPropertiesState?.isOpen || !propsLayer) {
      setPropsAnchorEl(null);
      return;
    }
    setPropsAnchorEl(rowRefs.current.get(propsLayer.id) ?? null);
  }, [layerPropertiesState?.isOpen, propsLayer, layers]);

  const parentMap = getLayerParentMap(layers);
  const collapsedLayerIds = new Set<string>();
  const layerById = new Map<string, Layer>(layers.map((l) => [l.id, l]));
  for (const layer of layers) {
    let curr: Layer | undefined = layer;
    const visited = new Set<string>();
    while (curr) {
      if (visited.has(curr.id)) break;
      visited.add(curr.id);
      const parent: Layer | undefined =
        parentMap.get(curr.id) || (curr.parentId ? layerById.get(curr.parentId) : undefined);
      if (parent) {
        if (parent.collapsed) {
          collapsedLayerIds.add(layer.id);
          break;
        }
        curr = parent;
      } else {
        break;
      }
    }
  }

  const selectedLayerSet = new Set(selectedLayerIds);
  const revLayers = layers.slice().reverse();
  const displayLayers = !searchQuery.trim()
    ? revLayers
    : revLayers.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isAnyEditing = editingId !== null;

  return (
    <div className={cn('flex flex-col bg-card select-none', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-border bg-background/50 px-2.5',
          isTouch ? 'h-12' : 'h-8'
        )}
      >
        <span className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
          {isMultiLayer
            ? `${selectedLayerIds.length} selected`
            : `${layers.length} ${layers.length === 1 ? 'layer' : 'layers'}`}
        </span>

        <Toolbar aria-label="Layer actions" className="gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  pressed={showSearch}
                  onPressedChange={(next) => {
                    if (!next) setSearchQuery('');
                    setShowSearch(next);
                  }}
                  variant="tint"
                  size={isTouch ? 'touch' : 'icon-sm'}
                  aria-label="Filter Layers"
                  className={cn(!isTouch && 'h-6 w-6')}
                />
              }
            >
              <Search size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Filter Layers</TooltipContent>
          </Tooltip>

          {onToggleCollapseAllGroups && layers.some((l) => l.type === 'group') && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={isTouch ? 'touch' : 'xs'}
                    aria-label="Expand or Collapse All Groups"
                    onClick={() => onToggleCollapseAllGroups()}
                  />
                }
              >
                <ChevronsUpDown size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">Expand / Collapse Groups</TooltipContent>
            </Tooltip>
          )}

          {onGroupSelectedLayers && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={isTouch ? 'touch' : 'xs'}
                    aria-label={isMultiLayer ? 'Group Selected' : 'New Group'}
                    onClick={onGroupSelectedLayers}
                  />
                }
              >
                <FolderPlus size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">
                {isMultiLayer ? 'Group Selected (Ctrl+G)' : 'New Group'}
              </TooltipContent>
            </Tooltip>
          )}

          {onUngroupSelectedLayers && selectedHasGroup && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={isTouch ? 'touch' : 'xs'}
                    aria-label="Ungroup Selected"
                    onClick={onUngroupSelectedLayers}
                  />
                }
              >
                <FolderOutput size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">Ungroup Selected (Ctrl+Shift+G)</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  pressed={showOpacity}
                  onPressedChange={setShowOpacity}
                  variant="tint"
                  size={isTouch ? 'touch' : 'icon-sm'}
                  aria-label="Blend Mode and Opacity"
                  className={cn(!isTouch && 'h-6 w-6')}
                />
              }
            >
              <Sliders size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Blend Mode &amp; Opacity</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  type="button"
                  variant="ghost"
                  size={isTouch ? 'touch' : 'xs'}
                  aria-label="Duplicate Selected Layer"
                  onClick={() =>
                    isMultiLayer ? onDuplicateSelectedLayers() : onDuplicateLayer(activeLayerId)
                  }
                />
              }
            >
              <Copy size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Duplicate Layer</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  type="button"
                  variant="ghost"
                  size={isTouch ? 'touch' : 'xs'}
                  aria-label="Delete Selected Layer"
                  onClick={() =>
                    isMultiLayer ? onDeleteSelectedLayers() : onDeleteLayer(activeLayerId)
                  }
                  className="hover:bg-destructive/15 hover:text-destructive"
                />
              }
            >
              <Trash2 size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Delete Layer</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  type="button"
                  variant="ghost"
                  size={isTouch ? 'touch' : 'xs'}
                  aria-label="Add New Layer"
                  onClick={onAddLayer}
                  className="text-primary hover:bg-primary/15 hover:text-primary"
                />
              }
            >
              <Plus size={isTouch ? 16 : 14} />
            </TooltipTrigger>
            <TooltipContent side="top">New Layer</TooltipContent>
          </Tooltip>
        </Toolbar>
      </div>

      {showSearch && (
        <div className="border-b border-border bg-background/40 px-2 py-1.5">
          <InputGroup className={cn(isTouch ? 'h-9' : 'h-7')}>
            <Search size={12} className="shrink-0 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter layers..."
              autoFocus
              className="h-full border-0 bg-transparent px-0 text-[11px] focus-visible:ring-0"
            />
            {searchQuery && <InputClear onClick={() => setSearchQuery('')} />}
          </InputGroup>
        </div>
      )}

      {showOpacity && activeLayer && (
        <div className="flex flex-col gap-2 border-b border-border bg-background/40 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Blend</span>
            <StudioSelect<LayerBlendMode>
              value={activeLayer.blendMode || 'normal'}
              options={BLEND_MODE_OPTIONS}
              onValueChange={(mode) => onUpdateLayer(activeLayer.id, { blendMode: mode })}
              className={cn(isTouch ? 'h-8 w-40 text-xs' : 'h-6 w-36 text-[11px]')}
              aria-label="Active layer blend mode"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Opacity</span>
              <span className="font-mono text-[11px] font-medium text-foreground tabular-nums">
                {activeLayer.opacity}%
              </span>
            </div>
            <CustomSlider
              value={activeLayer.opacity}
              onValueChange={(val) => onUpdateLayer(activeLayer.id, { opacity: val })}
              min={0}
              max={100}
              aria-label="Active layer opacity"
              className="h-4"
            />
          </div>
        </div>
      )}

      {/* Single Shared Popover for Layer Properties */}
      <Popover
        open={!!(layerPropertiesState?.isOpen && propsLayer && propsAnchorEl && !isTouch)}
        onOpenChange={(open) => {
          if (!open && onCloseLayerProperties) onCloseLayerProperties();
        }}
      >
        <PopoverContent
          anchor={propsAnchorEl}
          align="center"
          side="left"
          sideOffset={10}
          collisionPadding={16}
          initialFocus="none"
          className="w-auto p-3.5"
        >
          <PopoverArrow />
          {propsLayer && (
            <LayerPropertiesDialog
              isOpen={true}
              onClose={() => onCloseLayerProperties?.()}
              layer={propsLayer}
              onUpdateLayer={onUpdateLayer}
              onPreviewLayer={onPreviewLayer}
              onRevertPreview={onRevertLayerPreview}
              isEmbedded
            />
          )}
        </PopoverContent>
      </Popover>

      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              role="tree"
              aria-label="Layer stack"
              onDragOver={handleContainerDragOver}
              onDrop={handleContainerDrop}
              tabIndex={0}
              className="flex-1 space-y-0.5 overflow-y-auto p-1.5 outline-none"
            >
              <>
                {displayLayers.map((layer) => {
                  if (!searchQuery && collapsedLayerIds.has(layer.id)) return null;

                  const isDragging = dragState?.id === layer.id;
                  const dropPosition =
                    dragState?.overId === layer.id ? dragState.position : null;
                  const isActive = activeLayerId === layer.id;
                  const isSelected = selectedLayerSet.has(layer.id);
                  const effectiveVis = isLayerVisible(layer, layers, parentMap);
                  const isGroup = layer.type === 'group';
                  const isEditing = editingId === layer.id;

                  return (
                    <LayerRow
                      key={layer.id}
                      layer={layer}
                      pixels={isGroup ? undefined : activeFrame?.layerData[layer.id]}
                      groupLayers={isGroup ? layers : undefined}
                      groupActiveFrame={isGroup ? activeFrame : undefined}
                      palette={palette}
                      width={width}
                      height={height}
                      isActive={isActive}
                      isSelected={isSelected}
                      isDragging={isDragging}
                      dropPosition={dropPosition}
                      effectiveVis={effectiveVis}
                      isEditing={isEditing}
                      isAnyEditing={isAnyEditing}
                      editName={isEditing ? editName : ''}
                      editInputRef={editInputRef}
                      onRegisterRowRef={registerRowRef}
                      onEditNameChange={setEditName}
                      onSaveEditing={saveEditing}
                      onCancelEditing={cancelEditing}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onLayerClick={handleLayerClick}
                      onStartEditing={startEditing}
                      onUpdateLayer={onUpdateLayer}
                      onAddLayerToGroup={onAddLayerToGroup}
                      onGroupSelectedLayers={onGroupSelectedLayers}
                      onUngroupSelectedLayers={onUngroupSelectedLayers}
                      onOpenLayerProperties={onOpenLayerProperties}
                      onDuplicateLayer={onDuplicateLayer}
                      onDeleteLayer={onDeleteLayer}
                      isTouch={isTouch}
                    />
                  );
                })}

                    {dragState?.overId === 'root-bottom' && (
                      <div className="relative my-1.5 flex h-0.5 w-full items-center rounded-full bg-primary">
                        <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      </div>
                    )}
                  </>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onSelect={onAddLayer}>New Layer</ContextMenuItem>
          {onAddGroupLayer && <ContextMenuItem onSelect={onAddGroupLayer}>New Group</ContextMenuItem>}
          {onGroupSelectedLayers && (
            <ContextMenuItem onSelect={onGroupSelectedLayers}>Group Selected (Ctrl+G)</ContextMenuItem>
          )}
          {onToggleCollapseAllGroups && (
            <ContextMenuItem onSelect={() => onToggleCollapseAllGroups()}>
              Collapse / Expand All Groups
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};
