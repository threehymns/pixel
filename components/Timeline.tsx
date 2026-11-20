import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Allotment } from 'allotment';
import { useMobile } from '../hooks/useMobile';
import { Frame, Layer, FrameTag, PixelGrid } from '../types';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Copy,
  Trash2,
  Sparkles,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Tag,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ChevronsRightLeft,
  ChevronsLeftRight,
} from './Icons';
import { getLayerParentMap, isLayerVisible } from '../utils';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Popover, PopoverContent } from './ui/popover';
import { Button, IconButton } from './ui/button';
import { Toolbar, ToolbarSeparator } from './ui/toolbar';
import { AnimationTagPopover } from './AnimationTagPopover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { cn } from '../lib/utils';

interface TimelineProps {
  layers: Layer[];
  frames: Frame[];
  activeFrameIndex: number;
  activeLayerId: string;
  selectedFrameIndices: number[];
  selectedLayerIds: string[];
  tags?: FrameTag[];
  onSelectFrames: (indices: number[], activeIndex: number, layerId?: string) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onDuplicateSelectedFrames: () => void;
  onDeleteSelectedFrames: () => void;
  onInsertFrame: (index: number) => void;
  onTweenFrames: () => void;
  onSetFrameDuration?: (frameIndex: number, duration: number) => void;
  onAddTag?: (name: string, from: number, to: number, color?: string) => void;
  onSaveTag?: (tag: FrameTag) => void;
  onDeleteTag?: (tagId: string) => void;
  onOpenTagProperties?: (tag?: FrameTag) => void;
  activeTagPopover?: { isOpen: boolean; tag: FrameTag | null };
  onCloseTagPopover?: () => void;
  onPreviewTag?: (tag: FrameTag) => void;
  onRevertTagPreview?: (snapshot: FrameTag | null) => void;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onUpdateLayer?: (id: string, updates: any) => void;
  onAddLayer: () => void;
  onAddGroupLayer?: () => void;
  onReorderLayers: (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom'
  ) => void;
  onReorderFrames: (fromIndex: number, toIndex: number) => void;
  density?: 'compact' | 'touch';
}

interface DragState {
  type: 'layer' | 'frame';
  id: string;
  overId: string | null;
  position: 'before' | 'after' | 'inside' | 'outside' | 'root-bottom';
}

interface TagRange {
  from: number;
  to: number;
}

interface ResizingTagState {
  draggedTagId: string;
  mode: 'resize-left' | 'resize-right' | 'move';
  startX: number;
  hasMoved: boolean;
  initialStates: Record<string, TagRange>;
  currentStates: Record<string, TagRange>;
}

interface FrameColumn {
  type: 'frame';
  frameIndex: number;
  x: number;
  width: number;
}

interface CollapsedColumn {
  type: 'collapsed';
  tag: FrameTag;
  from: number;
  to: number;
  count: number;
  x: number;
  width: number;
}

type TimelineColumn = FrameColumn | CollapsedColumn;

interface TrackTag extends FrameTag {
  trackIndex: number;
}

const calculateTagTracks = (
  tagsList: FrameTag[],
  resizingState: ResizingTagState | null
): { trackTags: TrackTag[]; maxTracks: number } => {
  if (!tagsList || tagsList.length === 0) return { trackTags: [], maxTracks: 0 };

  const activeTags = tagsList.map((t) => {
    if (resizingState && resizingState.hasMoved && resizingState.currentStates[t.id]) {
      const updated = resizingState.currentStates[t.id];
      return { ...t, from: updated.from, to: updated.to };
    }
    return t;
  });

  const sorted = activeTags.slice().sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return b.to - b.from - (a.to - a.from);
  });

  const tracks: { from: number; to: number }[][] = [];
  const trackTags: TrackTag[] = [];

  for (const tag of sorted) {
    let assignedTrack = -1;
    for (let t = 0; t < tracks.length; t++) {
      const overlap = tracks[t].some((r) => !(tag.to < r.from || tag.from > r.to));
      if (!overlap) {
        assignedTrack = t;
        tracks[t].push({ from: tag.from, to: tag.to });
        break;
      }
    }
    if (assignedTrack === -1) {
      assignedTrack = tracks.length;
      tracks.push([{ from: tag.from, to: tag.to }]);
    }
    trackTags.push({ ...tag, trackIndex: assignedTrack });
  }

  return { trackTags, maxTracks: tracks.length };
};

const calculateColumns = (
  totalFrames: number,
  tagsList: FrameTag[],
  collapsedTagIds: Set<string>
): {
  columns: TimelineColumn[];
  frameXMap: Record<number, { x: number; width: number; isHidden: boolean }>;
  totalWidth: number;
} => {
  const collapsedTagsList = tagsList.filter((t) => collapsedTagIds.has(t.id));
  const sortedCollapsed = collapsedTagsList.slice().sort((a, b) => a.from - b.from);

  const columns: TimelineColumn[] = [];
  const frameXMap: Record<number, { x: number; width: number; isHidden: boolean }> = {};

  let currentX = 0;
  let frameIdx = 0;

  while (frameIdx < totalFrames) {
    const colTag = sortedCollapsed.find((t) => frameIdx >= t.from && frameIdx <= t.to);

    if (colTag && frameIdx === colTag.from) {
      const count = colTag.to - colTag.from + 1;
      const pillarWidth = 36;

      columns.push({
        type: 'collapsed',
        tag: colTag,
        from: colTag.from,
        to: colTag.to,
        count,
        x: currentX,
        width: pillarWidth,
      });

      for (let f = colTag.from; f <= colTag.to; f++) {
        frameXMap[f] = { x: currentX, width: 0, isHidden: true };
      }

      currentX += pillarWidth;
      frameIdx = colTag.to + 1;
    } else if (colTag && frameIdx > colTag.from && frameIdx <= colTag.to) {
      frameXMap[frameIdx] = { x: currentX, width: 0, isHidden: true };
      frameIdx++;
    } else {
      const frameWidth = 40;
      columns.push({
        type: 'frame',
        frameIndex: frameIdx,
        x: currentX,
        width: frameWidth,
      });

      frameXMap[frameIdx] = { x: currentX, width: frameWidth, isHidden: false };
      currentX += frameWidth;
      frameIdx++;
    }
  }

  return { columns, frameXMap, totalWidth: currentX };
};

const celContentCache = new WeakMap<PixelGrid, boolean>();

const hasCelContent = (pixels: PixelGrid | undefined): boolean => {
  if (!pixels || pixels.length === 0) return false;
  const cached = celContentCache.get(pixels);
  if (cached !== undefined) return cached;
  let found = false;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] !== null && pixels[i] !== undefined) {
      found = true;
      break;
    }
  }
  celContentCache.set(pixels, found);
  return found;
};

const getTagDirectionIcon = (direction?: FrameTag['direction']) => {
  switch (direction) {
    case 'reverse':
      return <ArrowLeft size={10} />;
    case 'ping-pong':
      return <ArrowLeftRight size={10} />;
    case 'ping-pong-reverse':
      return <ArrowRightLeft size={10} />;
    case 'forward':
    default:
      return <ArrowRight size={10} />;
  }
};

interface TimelineInsertHandleProps {
  index: number;
  left: number;
  isOver: boolean;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onInsertFrame: (index: number) => void;
}

const TimelineInsertHandle: React.FC<TimelineInsertHandleProps> = ({
  index,
  left,
  isOver,
  onDragOver,
  onDrop,
  onInsertFrame,
}) => {
  return (
    <div
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className="group pointer-events-auto absolute top-0 bottom-0 -ml-2 flex w-4 cursor-pointer items-center justify-center"
      style={{ left }}
    >
      <div
        className={`h-full w-0.5 bg-primary transition-opacity ${
          isOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`Insert frame at ${index + 1}`}
              onClick={() => onInsertFrame(index)}
              className="absolute top-1/2 left-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-all group-hover:opacity-100 hover:scale-110"
            >
              <Plus size={10} />
            </button>
          }
        />
        <TooltipContent side="top">Insert Frame</TooltipContent>
      </Tooltip>
    </div>
  );
};

interface TimelineTagItemProps {
  tag: TrackTag;
  leftX: number;
  topY: number;
  widthX: number;
  legHeight: number;
  isCollapsed: boolean;
  isTagSelected: boolean;
  isPopoverOpen: boolean;
  selectedTagCount: number;
  allSelectedCollapsed: boolean;
  hasSaveTag: boolean;
  hasDeleteTag: boolean;
  onRegisterRef: (id: string, el: HTMLDivElement | null) => void;
  onTagMouseDown: (
    e: React.MouseEvent,
    tag: FrameTag,
    mode: 'resize-left' | 'resize-right' | 'move'
  ) => void;
  onOpenTagPopover: (tag: FrameTag, e?: React.MouseEvent | Event) => void;
  onTagContextMenu: (e: React.MouseEvent, tagId: string) => void;
  onToggleCollapse: (tagId: string, e?: React.MouseEvent) => void;
  onDuplicateSingle: (tag: FrameTag) => void;
  onDeleteSingle: (tagId: string) => void;
  onToggleSelectedCollapse: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}

const TimelineTagItem: React.FC<TimelineTagItemProps> = ({
  tag,
  leftX,
  topY,
  widthX,
  legHeight,
  isCollapsed,
  isTagSelected,
  isPopoverOpen,
  selectedTagCount,
  allSelectedCollapsed,
  hasSaveTag,
  hasDeleteTag,
  onRegisterRef,
  onTagMouseDown,
  onOpenTagPopover,
  onTagContextMenu,
  onToggleCollapse,
  onDuplicateSingle,
  onDeleteSingle,
  onToggleSelectedCollapse,
  onDuplicateSelected,
  onDeleteSelected,
}) => {
  const color = tag.color || '#3b82f6';
  const transparentBg = color.startsWith('#') && color.length === 7 ? `${color}48` : color;
  const r = Math.min(5, Math.max(1, (widthX - 2) / 2));
  const xRight = Math.max(2, widthX - 1);
  const bracketPath = `M 1 ${legHeight} V ${1 + r} Q 1 1 ${1 + r} 1 H ${xRight - r} Q ${xRight} 1 ${xRight} ${1 + r} V ${legHeight}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={(el) => onRegisterRef(tag.id, el)}
            className="group/tag absolute overflow-visible select-none"
            style={{
              left: `${leftX}px`,
              top: `${topY}px`,
              width: `${widthX}px`,
              height: '20px',
              zIndex: isTagSelected ? 40 : isPopoverOpen ? 30 : 10,
            }}
          >
            <div className="z-20 flex items-center gap-1">
              <Tooltip delay={300}>
                <TooltipTrigger
                  render={
                    <div
                      className={`inline-flex h-[18px] w-max max-w-[220px] cursor-default items-center gap-1 rounded-sm px-1.5 text-[11px] font-semibold whitespace-nowrap text-white transition-all ${
                        isTagSelected
                          ? 'ring-2 ring-white brightness-110'
                          : isPopoverOpen
                            ? 'ring-2 ring-primary'
                            : ''
                      }`}
                      style={{ backgroundColor: transparentBg }}
                      onMouseDown={(e) => onTagMouseDown(e, tag, 'move')}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => onOpenTagPopover(tag, e)}
                      onContextMenu={(e) => onTagContextMenu(e, tag.id)}
                    >
                      <div className="pointer-events-none flex shrink-0 items-center gap-1 truncate">
                        <span className="truncate leading-none font-semibold whitespace-nowrap">
                          {tag.name}
                        </span>
                        {!isCollapsed && tag.direction && tag.direction !== 'forward' && (
                          <span className="flex shrink-0 items-center justify-center opacity-85">
                            {getTagDirectionIcon(tag.direction)}
                          </span>
                        )}
                      </div>
                    </div>
                  }
                />
                <TooltipContent side="top" className="flex-col items-start gap-0.5">
                  <span className="font-semibold text-foreground">{tag.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    Frames {tag.from + 1} – {tag.to + 1} ({tag.to - tag.from + 1}{' '}
                    {tag.to - tag.from === 0 ? 'frame' : 'frames'})
                  </span>
                </TooltipContent>
              </Tooltip>

              <button
                type="button"
                aria-label={isCollapsed ? 'Expand tag frames' : 'Collapse tag frames'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(tag.id, e);
                }}
                className="z-30 shrink-0 cursor-pointer rounded-sm border border-border bg-card p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/tag:opacity-100 hover:text-foreground"
              >
                {isCollapsed ? <ChevronsLeftRight size={10} /> : <ChevronsRightLeft size={10} />}
              </button>
            </div>

            {!isCollapsed && (
              <div
                className="group/lh absolute -left-1 top-[19px] z-30 flex w-2.5 cursor-ew-resize items-center justify-center opacity-0 group-hover/tag:opacity-100"
                style={{ height: `${legHeight}px` }}
                title="Drag to resize tag start"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onTagMouseDown(e, tag, 'resize-left');
                }}
              >
                <div className="h-full w-[3px] rounded-full bg-white opacity-0 transition-opacity group-hover/lh:opacity-100" />
              </div>
            )}

            {!isCollapsed && (
              <div
                className="group/rh absolute top-[19px] z-30 flex w-2.5 cursor-ew-resize items-center justify-center opacity-0 group-hover/tag:opacity-100"
                style={{
                  left: `${Math.max(0, widthX - 8)}px`,
                  height: `${legHeight}px`,
                }}
                title="Drag to resize tag end"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onTagMouseDown(e, tag, 'resize-right');
                }}
              >
                <div className="h-full w-[3px] rounded-full bg-white opacity-0 transition-opacity group-hover/rh:opacity-100" />
              </div>
            )}

            <svg
              className="pointer-events-none absolute top-[19px] left-0 z-20 overflow-visible"
              style={{
                width: `${Math.max(4, widthX)}px`,
                height: `${legHeight}px`,
              }}
            >
              <path
                d={bracketPath}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        }
      />
      <ContextMenuContent>
        {selectedTagCount <= 1 ? (
          <>
            <ContextMenuItem onSelect={(e) => onOpenTagPopover(tag, e)}>
              Edit Tag Properties...
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onToggleCollapse(tag.id)}>
              {isCollapsed ? 'Expand / Unfold Frames' : 'Collapse / Fold Frames'}
            </ContextMenuItem>
            {hasSaveTag && (
              <ContextMenuItem onSelect={() => onDuplicateSingle(tag)}>
                Duplicate Tag
              </ContextMenuItem>
            )}
            {hasDeleteTag && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem destructive onSelect={() => onDeleteSingle(tag.id)}>
                  Delete Tag
                </ContextMenuItem>
              </>
            )}
          </>
        ) : (
          <>
            <ContextMenuItem onSelect={onToggleSelectedCollapse}>
              {allSelectedCollapsed
                ? `Expand Frames (${selectedTagCount} Tags)`
                : `Collapse Frames (${selectedTagCount} Tags)`}
            </ContextMenuItem>
            {hasSaveTag && (
              <ContextMenuItem onSelect={onDuplicateSelected}>
                Duplicate Selected Tags ({selectedTagCount})
              </ContextMenuItem>
            )}
            {hasDeleteTag && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem destructive onSelect={onDeleteSelected}>
                  Delete Selected Tags ({selectedTagCount})
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

interface TimelineFrameHeaderProps {
  frameIndex: number;
  isCurrent: boolean;
  isSelected: boolean;
  onFrameClick: (e: React.MouseEvent, index: number) => void;
  onDuplicateThisFrame: (index: number) => void;
  onDeleteThisFrame: (index: number) => void;
}

const TimelineFrameHeader: React.FC<TimelineFrameHeaderProps> = ({
  frameIndex,
  isCurrent,
  isSelected,
  onFrameClick,
  onDuplicateThisFrame,
  onDeleteThisFrame,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            onClick={(e) => onFrameClick(e, frameIndex)}
            className={`relative flex w-10 min-w-[40px] shrink-0 cursor-pointer items-center justify-center border-r border-border font-mono text-[11px] tabular-nums transition-colors ${
              isCurrent
                ? 'bg-primary font-semibold text-primary-foreground'
                : isSelected
                  ? 'bg-primary/20 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            }`}
          >
            <span>{frameIndex + 1}</span>
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onDuplicateThisFrame(frameIndex)}>
          Duplicate Frame
        </ContextMenuItem>
        <ContextMenuItem destructive onSelect={() => onDeleteThisFrame(frameIndex)}>
          Delete Frame
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

interface TimelineLayerRowProps {
  layer: Layer;
  isActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
  dropPosition: DragState['position'] | null;
  effectiveVis: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, layer: Layer) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onDragEnd: () => void;
  onSelectLayer: (id: string) => void;
  onUpdateLayer?: (id: string, updates: any) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
}

const TimelineLayerRow: React.FC<TimelineLayerRowProps> = ({
  layer,
  isActive,
  isSelected,
  isDragging,
  dropPosition,
  effectiveVis,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSelectLayer,
  onUpdateLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
}) => {
  const childLevel = layer.childLevel ?? 0;
  const isGroup = layer.type === 'group';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, layer.id)}
      onDragOver={(e) => {
        e.stopPropagation();
        onDragOver(e, layer);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e, layer.id);
      }}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: `${childLevel * 10 + 6}px` }}
      className={`group relative flex h-8 shrink-0 cursor-default items-center gap-1 border-b border-border pr-1.5 transition-colors ${
        isGroup ? 'font-semibold text-foreground' : 'text-foreground/85'
      } ${
        isActive
          ? 'bg-primary/15 font-semibold text-foreground'
          : isSelected
            ? 'bg-secondary/70 text-foreground'
            : 'hover:bg-accent/50 hover:text-foreground'
      } ${isDragging ? 'opacity-30' : ''}`}
      onClick={() => onSelectLayer(layer.id)}
    >
      {dropPosition === 'before' && (
        <div className="pointer-events-none absolute top-0 left-0 z-50 flex h-0.5 w-full items-center rounded-full bg-primary">
          <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
      )}
      {dropPosition === 'after' && (
        <div className="pointer-events-none absolute bottom-0 left-0 z-50 flex h-0.5 w-full items-center rounded-full bg-primary">
          <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
      )}
      {dropPosition === 'inside' && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-end rounded border-2 border-primary bg-primary/15 pr-2">
          <span className="rounded-xs border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-primary">
            Nest in Group
          </span>
        </div>
      )}
      {dropPosition === 'outside' && (
        <div
          className="pointer-events-none absolute bottom-0 z-50 flex h-0.5 items-center rounded-full bg-primary"
          style={{ left: `-${childLevel * 10}px`, right: 0 }}
        >
          <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
      )}

      {childLevel > 0 && (
        <div className="pointer-events-none absolute top-0 bottom-0 left-1 border-l border-border" />
      )}

      {isGroup ? (
        <button
          type="button"
          aria-label={layer.collapsed ? 'Expand group' : 'Collapse group'}
          onClick={(e) => {
            e.stopPropagation();
            if (onUpdateLayer) {
              onUpdateLayer(layer.id, { collapsed: !layer.collapsed });
            }
          }}
          className="mr-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {layer.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </button>
      ) : (
        <div className="w-2.5 shrink-0" />
      )}

      <button
        type="button"
        aria-label={layer.visible && effectiveVis ? 'Hide layer' : 'Show layer'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLayerVisibility(layer.id);
        }}
        className={`shrink-0 p-0.5 transition-colors ${
          !layer.visible || !effectiveVis
            ? 'text-muted-foreground/30'
            : isActive
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
        }`}
        title={layer.visible && !effectiveVis ? 'Hidden by parent group' : undefined}
      >
        {layer.visible && effectiveVis ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>

      <button
        type="button"
        aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLayerLock(layer.id);
        }}
        className={`shrink-0 p-0.5 transition-colors ${
          !layer.locked ? 'text-muted-foreground/35' : 'text-primary'
        }`}
      >
        {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
      </button>

      {isGroup && (
        <span className="mr-0.5 shrink-0 text-muted-foreground group-hover:text-foreground">
          {layer.collapsed ? <Folder size={11} /> : <FolderOpen size={11} />}
        </span>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
        <span
          className={`truncate text-[11px] ${
            isGroup || isActive
              ? 'font-semibold text-foreground'
              : 'text-foreground/85 group-hover:text-foreground'
          }`}
        >
          {layer.name}
        </span>
      </div>
    </div>
  );
};

interface TimelineCelProps {
  layerId: string;
  frameIndex: number;
  hasContent: boolean;
  isActive: boolean;
  isFrameSelected: boolean;
  isLayerSelected: boolean;
  onFrameClick: (e: React.MouseEvent, frameIndex: number, layerId?: string) => void;
}

const TimelineCel: React.FC<TimelineCelProps> = ({
  layerId,
  frameIndex,
  hasContent,
  isActive,
  isFrameSelected,
  isLayerSelected,
  onFrameClick,
}) => {
  return (
    <div
      onClick={(e) => onFrameClick(e, frameIndex, layerId)}
      className={`relative flex w-10 min-w-[40px] shrink-0 cursor-pointer items-center justify-center border-r border-border transition-colors ${
        isActive
          ? 'bg-primary/15'
          : isFrameSelected || isLayerSelected
            ? 'bg-secondary/35'
            : 'hover:bg-accent/25'
      }`}
    >
      {hasContent && (
        <div
          className={`h-2.5 w-2.5 rounded-full transition-transform ${
            isActive
              ? 'scale-110 bg-primary'
              : isFrameSelected || isLayerSelected
                ? 'bg-foreground/85'
                : 'bg-muted-foreground/65'
          }`}
        />
      )}
    </div>
  );
};

interface TimelineCelRowProps {
  layerId: string;
  totalWidth: number;
  columns: TimelineColumn[];
  frames: Frame[];
  activeFrameIndex: number;
  isActiveLayer: boolean;
  selectedFrameSet: Set<number>;
  isLayerSelected: boolean;
  onToggleCollapseTag: (tagId: string, e?: React.MouseEvent) => void;
  onFrameClick: (e: React.MouseEvent, frameIndex: number, layerId?: string) => void;
}

const TimelineCelRow: React.FC<TimelineCelRowProps> = ({
  layerId,
  totalWidth,
  columns,
  frames,
  activeFrameIndex,
  isActiveLayer,
  selectedFrameSet,
  isLayerSelected,
  onToggleCollapseTag,
  onFrameClick,
}) => {
  return (
    <div className="flex h-8 border-b border-border" style={{ width: `${totalWidth + 40}px` }}>
      {columns.map((col) => {
        if (col.type === 'collapsed') {
          return (
            <div
              key={`cell-collapsed-${layerId}-${col.tag.id}`}
              onClick={(e) => onToggleCollapseTag(col.tag.id, e)}
              className="group flex w-[36px] shrink-0 cursor-pointer items-center justify-center border-r border-border bg-background/60 hover:bg-secondary"
              title={`Collapsed tag "${col.tag.name}" (${col.count} frames). Click to expand.`}
            >
              <div className="h-full w-1.5 border-x border-dashed border-primary/40 group-hover:border-primary/80" />
            </div>
          );
        }

        const frameIdx = col.frameIndex;
        const frame = frames[frameIdx];
        const hasContent = hasCelContent(frame?.layerData[layerId]);
        const isActive = isActiveLayer && activeFrameIndex === frameIdx;
        const isFrameSelected = selectedFrameSet.has(frameIdx);

        return (
          <TimelineCel
            key={`${layerId}-${frameIdx}`}
            layerId={layerId}
            frameIndex={frameIdx}
            hasContent={hasContent}
            isActive={isActive}
            isFrameSelected={isFrameSelected}
            isLayerSelected={isLayerSelected}
            onFrameClick={onFrameClick}
          />
        );
      })}

      <div className="pointer-events-none flex w-10 min-w-[40px] shrink-0 items-center justify-center border-r border-border bg-background/20" />
    </div>
  );
};

export const Timeline: React.FC<TimelineProps> = ({
  layers,
  frames,
  activeFrameIndex,
  activeLayerId,
  selectedFrameIndices,
  selectedLayerIds,
  tags,
  onSelectFrames,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onDuplicateSelectedFrames,
  onDeleteSelectedFrames,
  onInsertFrame,
  onTweenFrames,
  onAddTag,
  onSaveTag,
  onDeleteTag,
  onOpenTagProperties,
  activeTagPopover,
  onCloseTagPopover,
  onPreviewTag,
  onRevertTagPreview,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onUpdateLayer,
  onAddLayer,
  onReorderLayers,
  onReorderFrames,
  density = 'compact',
}) => {
  const isTouch = density === 'touch';
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tagPopover, setTagPopover] = useState<{
    isOpen: boolean;
    tag: FrameTag;
    isNew: boolean;
  } | null>(null);

  const [resizingTagState, setResizingTagState] = useState<ResizingTagState | null>(null);
  const [collapsedTagIds, setCollapsedTagIds] = useState<Set<string>>(new Set());
  const isMobile = useMobile();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 192
  );

  const tagRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tagButtonRef = useRef<HTMLButtonElement>(null);

  const selectedFrameSet = new Set(selectedFrameIndices);
  const selectedLayerSet = new Set(selectedLayerIds);

  useEffect(() => {
    setSidebarWidth(isMobile ? 120 : 192);
  }, [isMobile]);

  const framesScrollRef = useRef<HTMLDivElement>(null);
  const layersScrollRef = useRef<HTMLDivElement>(null);
  const headerHorizontalScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef<boolean>(false);

  const handleLayersScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (framesScrollRef.current) {
      framesScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const handleFramesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerHorizontalScrollRef.current) {
      headerHorizontalScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (layersScrollRef.current) {
      layersScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const latestRef = useRef({
    dragState,
    resizingTagState,
    frames,
    tags,
    activeFrameIndex,
    selectedFrameIndices,
    selectedTagIds,
    collapsedTagIds,
    tagPopover,
    onSelectFrames,
    onDuplicateFrame,
    onDeleteFrame,
    onAddTag,
    onSaveTag,
    onDeleteTag,
    onCloseTagPopover,
    onReorderLayers,
    onReorderFrames,
  });

  useLayoutEffect(() => {
    latestRef.current = {
      dragState,
      resizingTagState,
      frames,
      tags,
      activeFrameIndex,
      selectedFrameIndices,
      selectedTagIds,
      collapsedTagIds,
      tagPopover,
      onSelectFrames,
      onDuplicateFrame,
      onDeleteFrame,
      onAddTag,
      onSaveTag,
      onDeleteTag,
      onCloseTagPopover,
      onReorderLayers,
      onReorderFrames,
    };
  });

  const registerTagRef = (id: string, el: HTMLDivElement | null) => {
    if (el) tagRefs.current.set(id, el);
    else tagRefs.current.delete(id);
  };

  useEffect(() => {
    if (selectedTagIds.size === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const { selectedTagIds: curSelected, onDeleteTag: deleteTagFn } = latestRef.current;
      if ((e.key === 'Delete' || e.key === 'Backspace') && curSelected.size > 0) {
        if (deleteTagFn) {
          e.preventDefault();
          curSelected.forEach((id) => {
            deleteTagFn(id);
          });
          setSelectedTagIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTagIds.size > 0]);

  const handleTagMouseDown = (
    e: React.MouseEvent,
    tag: FrameTag,
    mode: 'resize-left' | 'resize-right' | 'move'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const { selectedTagIds: curSelectedTags, tags: curTags } = latestRef.current;
    let targetSelectedIds: string[];
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const next = new Set<string>(curSelectedTags);
      next.add(tag.id);
      setSelectedTagIds(next);
      targetSelectedIds = Array.from(next);
    } else if (!curSelectedTags.has(tag.id)) {
      const next = new Set<string>([tag.id]);
      setSelectedTagIds(next);
      targetSelectedIds = [tag.id];
    } else {
      targetSelectedIds = Array.from(curSelectedTags);
    }

    const allTagsList = curTags || [];
    const initialStates: Record<string, TagRange> = {};
    targetSelectedIds.forEach((id) => {
      const t = allTagsList.find((x) => x.id === id);
      if (t) {
        initialStates[t.id] = { from: t.from, to: t.to };
      }
    });

    const nextResizeState: ResizingTagState = {
      draggedTagId: tag.id,
      mode,
      startX: e.clientX,
      hasMoved: false,
      initialStates,
      currentStates: { ...initialStates },
    };
    latestRef.current.resizingTagState = nextResizeState;
    setResizingTagState(nextResizeState);
  };

  const isResizingTag = resizingTagState !== null;

  useEffect(() => {
    if (!isResizingTag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const curResize = latestRef.current.resizingTagState;
      if (!curResize) return;
      const deltaX = e.clientX - curResize.startX;
      const isPastThreshold = Math.abs(deltaX) > 3;
      const deltaFrames = Math.round(deltaX / 40);
      const totalFrames = latestRef.current.frames.length;

      const nextCurrentStates: Record<string, TagRange> = {};

      (Object.entries(curResize.initialStates) as [string, TagRange][]).forEach(
        ([tId, initial]) => {
          let newFrom = initial.from;
          let newTo = initial.to;

          if (curResize.mode === 'resize-left') {
            newFrom = Math.max(0, Math.min(initial.to, initial.from + deltaFrames));
            newTo = initial.to;
          } else if (curResize.mode === 'resize-right') {
            newTo = Math.max(initial.from, Math.min(totalFrames - 1, initial.to + deltaFrames));
            newFrom = initial.from;
          } else if (curResize.mode === 'move') {
            const span = initial.to - initial.from;
            newFrom = Math.max(0, Math.min(totalFrames - 1 - span, initial.from + deltaFrames));
            newTo = newFrom + span;
          }

          nextCurrentStates[tId] = { from: newFrom, to: newTo };
        }
      );

      const updatedResize: ResizingTagState = {
        ...curResize,
        hasMoved: curResize.hasMoved || isPastThreshold || deltaFrames !== 0,
        currentStates: nextCurrentStates,
      };
      latestRef.current.resizingTagState = updatedResize;
      setResizingTagState(updatedResize);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const curResize = latestRef.current.resizingTagState;
      if (curResize) {
        if (curResize.hasMoved) {
          const allTagsList = latestRef.current.tags || [];
          const saveTagFn = latestRef.current.onSaveTag;
          (Object.entries(curResize.currentStates) as [string, TagRange][]).forEach(
            ([tId, updated]) => {
              const targetTag = allTagsList.find((t) => t.id === tId);
              if (
                targetTag &&
                (updated.from !== targetTag.from || updated.to !== targetTag.to)
              ) {
                if (saveTagFn) {
                  saveTagFn({
                    ...targetTag,
                    from: updated.from,
                    to: updated.to,
                  });
                }
              }
            }
          );
        } else {
          const clickedId = curResize.draggedTagId;
          const isModifier = e.shiftKey || e.ctrlKey || e.metaKey;

          if (isModifier) {
            setSelectedTagIds((prev) => {
              const next = new Set<string>(prev);
              if (next.has(clickedId)) next.delete(clickedId);
              else next.add(clickedId);
              return next;
            });
          } else {
            setSelectedTagIds(new Set<string>([clickedId]));
          }
        }
      }
      latestRef.current.resizingTagState = null;
      setResizingTagState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTag]);

  const toggleCollapseTag = (tagId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  useEffect(() => {
    if (isTouch) return;
    if (activeTagPopover?.isOpen) {
      const { selectedFrameIndices: curSelFrames, activeFrameIndex: curActiveFrame } =
        latestRef.current;
      const from = curSelFrames.length > 0 ? Math.min(...curSelFrames) : curActiveFrame;
      const to = curSelFrames.length > 0 ? Math.max(...curSelFrames) : curActiveFrame;
      const initialTag: FrameTag = activeTagPopover.tag
        ? { ...activeTagPopover.tag }
        : {
            id: `tag-${Date.now()}`,
            name: 'New Tag',
            from,
            to,
            color: '#3b82f6',
            direction: 'forward',
            repeat: 0,
          };
      setTagPopover({
        isOpen: true,
        tag: initialTag,
        isNew: !activeTagPopover.tag,
      });
    }
  }, [activeTagPopover, isTouch]);

  const handleOpenTagPopover = (existingTag?: FrameTag, e?: React.MouseEvent | Event) => {
    if (e && 'stopPropagation' in e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (isTouch && onOpenTagProperties) {
      onOpenTagProperties(existingTag);
      return;
    }
    const {
      selectedFrameIndices: curSelFrames,
      activeFrameIndex: curActiveFrame,
    } = latestRef.current;
    const from = curSelFrames.length > 0 ? Math.min(...curSelFrames) : curActiveFrame;
    const to = curSelFrames.length > 0 ? Math.max(...curSelFrames) : curActiveFrame;

    // Draft new tags locally until explicitly committed via Create Tag
    const tag: FrameTag = existingTag
      ? { ...existingTag }
      : {
          id: `tag-${Date.now()}`,
          name: '',
          from,
          to,
          color: '#3b82f6',
          direction: 'forward',
          repeat: 0,
        };

    setTagPopover({
      isOpen: true,
      tag,
      isNew: !existingTag,
    });
  };

  const handleCloseTagPopover = () => {
    setTagPopover(null);
    if (latestRef.current.onCloseTagPopover) latestRef.current.onCloseTagPopover();
  };

  const handleTagContextMenu = (e: React.MouseEvent, tagId: string) => {
    if (!latestRef.current.selectedTagIds.has(tagId)) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        setSelectedTagIds((prev) => new Set(prev).add(tagId));
      } else {
        setSelectedTagIds(new Set([tagId]));
      }
    }
  };

  const handleDuplicateSingleTag = (tag: FrameTag) => {
    latestRef.current.onSaveTag?.({
      ...tag,
      id: `tag_${Date.now()}`,
      name: `${tag.name} (Copy)`,
    });
  };

  const handleDeleteSingleTag = (tagId: string) => {
    latestRef.current.onDeleteTag?.(tagId);
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
    if (latestRef.current.tagPopover?.tag.id === tagId) handleCloseTagPopover();
  };

  const handleToggleSelectedTagsCollapse = () => {
    const { selectedTagIds: curSelected, collapsedTagIds: curCollapsed } = latestRef.current;
    const allCollapsed = Array.from(curSelected).every((id) => curCollapsed.has(id));
    setCollapsedTagIds((prev) => {
      const next = new Set(prev);
      curSelected.forEach((id) => {
        if (allCollapsed) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleDuplicateSelectedTags = () => {
    const { selectedTagIds: curSelected, tags: curTags, onSaveTag: saveTagFn } = latestRef.current;
    if (!saveTagFn) return;
    const allTagsList = curTags || [];
    curSelected.forEach((id) => {
      const t = allTagsList.find((x) => x.id === id);
      if (t) {
        saveTagFn({
          ...t,
          id: `tag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: `${t.name} (Copy)`,
        });
      }
    });
  };

  const handleDeleteSelectedTags = () => {
    const { selectedTagIds: curSelected, tagPopover: curPopover, onDeleteTag: deleteTagFn } =
      latestRef.current;
    if (!deleteTagFn) return;
    curSelected.forEach((id) => deleteTagFn(id));
    setSelectedTagIds(new Set());
    if (curPopover && curSelected.has(curPopover.tag.id)) {
      handleCloseTagPopover();
    }
  };

  const handleFrameClick = (e: React.MouseEvent, index: number, layerId?: string) => {
    const {
      selectedFrameIndices: curSelected,
      activeFrameIndex: curActive,
      onSelectFrames: selectFramesFn,
    } = latestRef.current;
    let newSelection = [...curSelected];

    if (e.shiftKey) {
      const startIdx = curActive;
      const endIdx = index;
      const range = [];
      for (let i = Math.min(startIdx, endIdx); i <= Math.max(startIdx, endIdx); i++) {
        range.push(i);
      }
      newSelection = Array.from(new Set([...newSelection, ...range]));
    } else if (e.ctrlKey || e.metaKey) {
      if (newSelection.includes(index)) {
        if (newSelection.length > 1) {
          newSelection = newSelection.filter((i) => i !== index);
        }
      } else {
        newSelection.push(index);
      }
    } else {
      newSelection = [index];
    }

    selectFramesFn(newSelection, index, layerId);
  };

  const handleDuplicateThisFrame = (idx: number) => {
    latestRef.current.onSelectFrames([idx], idx);
    latestRef.current.onDuplicateFrame();
  };

  const handleDeleteThisFrame = (idx: number) => {
    latestRef.current.onSelectFrames([idx], idx);
    latestRef.current.onDeleteFrame();
  };

  const handleLayerDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('type', 'layer');
    e.dataTransfer.setData('id', id);
    const nextState: DragState = { type: 'layer', id, overId: null, position: 'after' };
    latestRef.current.dragState = nextState;
    setDragState(nextState);
  };

  const handleLayerDragOver = (e: React.DragEvent, hoveredLayer: Layer) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();

    if (curDrag.id === hoveredLayer.id) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const height = rect.height;
    const relativeY = e.clientY - rect.top;
    const relativeX = e.clientX - rect.left;
    const childLevel = hoveredLayer.childLevel ?? 0;

    let position: 'before' | 'after' | 'inside' | 'outside' = 'after';

    if (hoveredLayer.parentId && relativeX < Math.max(18, childLevel * 10)) {
      position = 'outside';
    } else if (hoveredLayer.type === 'group') {
      if (relativeY < height * 0.25) position = 'before';
      else if (relativeY > height * 0.75) position = 'after';
      else position = 'inside';
    } else {
      position = relativeY < height / 2 ? 'before' : 'after';
    }

    if (curDrag.overId !== hoveredLayer.id || curDrag.position !== position) {
      const nextState: DragState = { ...curDrag, overId: hoveredLayer.id, position };
      latestRef.current.dragState = nextState;
      setDragState(nextState);
    }
  };

  const handleLayerDrop = (e: React.DragEvent, targetId: string) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (curDrag.id !== targetId && curDrag.overId) {
      latestRef.current.onReorderLayers(curDrag.id, targetId, curDrag.position);
    }
    latestRef.current.dragState = null;
    setDragState(null);
  };

  const handleLayerDragEnd = () => {
    latestRef.current.dragState = null;
    setDragState(null);
  };

  const handleInsertButtonDragOver = (e: React.DragEvent, index: number) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    if (curDrag.overId !== `insert-${index}`) {
      const nextState: DragState = {
        ...curDrag,
        overId: `insert-${index}`,
        position: 'before',
      };
      latestRef.current.dragState = nextState;
      setDragState(nextState);
    }
  };

  const handleInsertButtonDrop = (e: React.DragEvent, index: number) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(curDrag.id, 10);
    let insertIndex = index;
    if (fromIndex < insertIndex) insertIndex--;
    latestRef.current.onReorderFrames(fromIndex, insertIndex);
    latestRef.current.dragState = null;
    setDragState(null);
  };

  const handleLayerContainerDragOver = (e: React.DragEvent) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (curDrag.overId !== 'root-bottom') {
      const nextState: DragState = {
        ...curDrag,
        overId: 'root-bottom',
        position: 'root-bottom',
      };
      latestRef.current.dragState = nextState;
      setDragState(nextState);
    }
  };

  const handleLayerContainerDrop = (e: React.DragEvent) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (curDrag.overId === 'root-bottom') {
      latestRef.current.onReorderLayers(curDrag.id, 'root-bottom', 'root-bottom');
    } else if (curDrag.overId && curDrag.id !== curDrag.overId) {
      latestRef.current.onReorderLayers(curDrag.id, curDrag.overId, curDrag.position);
    }
    latestRef.current.dragState = null;
    setDragState(null);
  };

  const handleFrameContainerDragOver = (e: React.DragEvent) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const relativeX = e.clientX - rect.left + scrollLeft;

    const totalFrames = latestRef.current.frames.length;
    if (totalFrames === 0) return;

    const preciseIndex = relativeX / 40;
    let targetIndex = Math.floor(preciseIndex);
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= totalFrames) targetIndex = totalFrames - 1;

    const offset = preciseIndex - targetIndex;
    const position = offset < 0.5 ? 'before' : 'after';

    if (curDrag.overId !== targetIndex.toString() || curDrag.position !== position) {
      const nextState: DragState = { ...curDrag, overId: targetIndex.toString(), position };
      latestRef.current.dragState = nextState;
      setDragState(nextState);
    }
  };

  const handleFrameContainerDrop = (e: React.DragEvent) => {
    const curDrag = latestRef.current.dragState;
    if (curDrag?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(curDrag.id, 10);
    const totalFrames = latestRef.current.frames.length;
    const targetIndex = curDrag.overId ? parseInt(curDrag.overId, 10) : totalFrames - 1;
    if (fromIndex !== targetIndex) {
      let insertIndex = targetIndex;
      if (curDrag.position === 'after') insertIndex = targetIndex + 1;
      if (fromIndex < insertIndex) insertIndex--;
      latestRef.current.onReorderFrames(fromIndex, insertIndex);
    }
    latestRef.current.dragState = null;
    setDragState(null);
  };

  const isMultiFrame = selectedFrameIndices.length > 1;
  const canTween = selectedFrameIndices.length >= 3;

  const allTags = tags || [];
  const { trackTags, maxTracks } = calculateTagTracks(allTags, resizingTagState);
  const { columns, frameXMap, totalWidth } = calculateColumns(
    frames.length,
    allTags,
    collapsedTagIds
  );
  const tagStripHeight = allTags.length > 0 ? Math.max(28, maxTracks * 26 + 6) : 0;
  const totalHeaderHeight = tagStripHeight + 32;

  const parentMap = getLayerParentMap(layers);
  const reversedLayers = layers.slice().reverse();
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

  const activeEditingTag = tagPopover?.isOpen ? tagPopover.tag : null;
  const [tagPopoverAnchor, setTagPopoverAnchor] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!activeEditingTag) {
      setTagPopoverAnchor(null);
      return;
    }
    setTagPopoverAnchor(tagRefs.current.get(activeEditingTag.id) ?? tagButtonRef.current ?? null);
  }, [activeEditingTag, tags]);

  const resizingStateValues = resizingTagState
    ? (Object.values(resizingTagState.currentStates) as TagRange[])
    : [];
  const resizingTagCount = resizingStateValues.length;
  const resizingFirstState = resizingStateValues[0];
  const selectedTagCount = selectedTagIds.size;
  const allSelectedCollapsed =
    selectedTagCount > 0 && Array.from(selectedTagIds).every((id) => collapsedTagIds.has(id));
  const insertIndices = Array.from({ length: frames.length + 1 }, (_, i) => i);

  return (
    <div className="flex h-full flex-col bg-card text-sm select-none">
      {resizingTagState && resizingTagState.hasMoved && (
        <div className="pointer-events-none fixed top-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border-strong bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-2xl">
          <Tag size={13} className="text-primary" />
          <span>
            {resizingTagCount > 1 ? (
              <>
                {resizingTagState.mode === 'move' ? 'Moving' : 'Resizing'}{' '}
                <strong className="font-mono font-semibold text-primary tabular-nums">
                  {resizingTagCount} Selected Tags
                </strong>
              </>
            ) : (
              <>
                {resizingTagState.mode === 'resize-left'
                  ? 'Resizing Start: '
                  : resizingTagState.mode === 'resize-right'
                    ? 'Resizing End: '
                    : 'Moving Tag: '}
                <strong className="font-mono font-semibold text-primary tabular-nums">
                  Frame {resizingFirstState ? resizingFirstState.from + 1 : 1} -{' '}
                  {resizingFirstState ? resizingFirstState.to + 1 : 1}
                </strong>
                <span className="ml-1 font-mono text-muted-foreground tabular-nums">
                  ({resizingFirstState ? resizingFirstState.to - resizingFirstState.from + 1 : 1}{' '}
                  frames)
                </span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Single Shared Popover for Tag Properties */}
      {activeEditingTag && (
        <Popover
          open={!!(tagPopover?.isOpen && tagPopoverAnchor && !isTouch)}
          onOpenChange={(open) => {
            if (!open) handleCloseTagPopover();
          }}
        >
          <PopoverContent
            anchor={tagPopoverAnchor}
            align="end"
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            initialFocus="none"
            className="w-auto p-3.5"
          >
            <AnimationTagPopover
              isOpen={true}
              tag={activeEditingTag}
              isNew={tagPopover?.isNew ?? false}
              totalFrames={frames.length}
              frames={frames}
              onSave={(savedTag) => {
                if (onSaveTag) {
                  onSaveTag(savedTag);
                } else if (onAddTag) {
                  onAddTag(savedTag.name, savedTag.from, savedTag.to, savedTag.color);
                }
              }}
              onPreviewTag={onPreviewTag}
              onRevertPreview={onRevertTagPreview}
              onClose={handleCloseTagPopover}
              onDelete={
                onDeleteTag
                  ? (tagId) => {
                      onDeleteTag(tagId);
                      handleCloseTagPopover();
                    }
                  : undefined
              }
            />
          </PopoverContent>
        </Popover>
      )}

      <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-card select-none">
        {/* Top Header Row */}
        <div
          className="flex shrink-0 overflow-hidden border-b border-border bg-background/50"
          style={{ height: `${totalHeaderHeight}px` }}
        >
          {/* Left Top Controls */}
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-card"
          >
            {tagStripHeight > 0 && (
              <div
                className="flex shrink-0 items-center gap-1.5 border-b border-border bg-background/40 px-2.5 text-[11px] font-medium text-muted-foreground select-none"
                style={{ height: `${tagStripHeight}px` }}
              >
                <Tag size={11} className="shrink-0 text-primary" />
                <span className="truncate">Tags</span>
              </div>
            )}

            <Toolbar
              aria-label="Timeline frame actions"
              className={cn(
                'shrink-0 overflow-hidden px-1.5',
                isTouch ? 'h-11 gap-0.5' : 'h-8 gap-0.5'
              )}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <IconButton
                      type="button"
                      variant="ghost"
                      size={isTouch ? 'sm' : 'xs'}
                      aria-label="Duplicate Frame"
                      onClick={() =>
                        isMultiFrame ? onDuplicateSelectedFrames() : onDuplicateFrame()
                      }
                      className={cn(isMultiFrame && 'text-primary')}
                    />
                  }
                >
                  <Copy size={13} />
                </TooltipTrigger>
                <TooltipContent side="top">Duplicate Frame</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <IconButton
                      type="button"
                      variant="ghost"
                      size={isTouch ? 'sm' : 'xs'}
                      aria-label="Delete Frame"
                      onClick={() => (isMultiFrame ? onDeleteSelectedFrames() : onDeleteFrame())}
                      className={cn(
                        'hover:bg-destructive/15 hover:text-destructive',
                        isMultiFrame && 'text-destructive'
                      )}
                    />
                  }
                >
                  <Trash2 size={13} />
                </TooltipTrigger>
                <TooltipContent side="top">Delete Frame</TooltipContent>
              </Tooltip>

              <ToolbarSeparator className="mx-0.5 h-3.5" />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <IconButton
                      type="button"
                      variant="ghost"
                      size={isTouch ? 'sm' : 'xs'}
                      aria-label="Tween Between Selected Frames"
                      onClick={onTweenFrames}
                      disabled={!canTween}
                      className="text-primary hover:bg-primary hover:text-primary-foreground"
                    />
                  }
                >
                  <Sparkles size={13} />
                </TooltipTrigger>
                <TooltipContent side="top">
                  Interpolate (Tween) Between Selection
                </TooltipContent>
              </Tooltip>

              <ToolbarSeparator className="mx-0.5 h-3.5" />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      ref={tagButtonRef}
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label="Create Animation Tag"
                      onClick={(e) => handleOpenTagPopover(undefined, e)}
                      className="px-1.5"
                    />
                  }
                >
                  <Tag size={12} className="text-primary" />
                  <span className="hidden sm:inline">Tag</span>
                </TooltipTrigger>
                <TooltipContent side="top">Create Animation Tag from Selection</TooltipContent>
              </Tooltip>
            </Toolbar>
          </div>

          {/* Right Top Header (Tag Strip + Frame Ruler) */}
          <div
            ref={headerHorizontalScrollRef}
            className="no-scrollbar flex-1 overflow-hidden bg-canvas"
          >
            <div className="relative flex min-w-full flex-col">
              {/* Insert Frame Hover Handles */}
              <div
                className="pointer-events-none absolute left-0 z-30 h-8 w-full"
                style={{ top: `${tagStripHeight}px` }}
              >
                {insertIndices.map((i) => {
                  const isOver = dragState?.type === 'frame' && dragState.overId === `insert-${i}`;
                  const framePos = frameXMap[i] || { x: i * 40 };
                  return (
                    <TimelineInsertHandle
                      key={`insert-${i}`}
                      index={i}
                      left={framePos.x}
                      isOver={isOver}
                      onDragOver={handleInsertButtonDragOver}
                      onDrop={handleInsertButtonDrop}
                      onInsertFrame={onInsertFrame}
                    />
                  );
                })}
              </div>

              {/* Multi-Track Tag Strip */}
              {allTags.length > 0 && (
                <div
                  className="relative min-w-full cursor-default overflow-hidden border-b border-border bg-background/60"
                  style={{
                    width: `${totalWidth}px`,
                    height: `${tagStripHeight}px`,
                  }}
                  onClick={() => setSelectedTagIds(new Set())}
                >
                  {trackTags.map((tag) => {
                    const startPos = frameXMap[tag.from] || {
                      x: tag.from * 40,
                      width: 40,
                      isHidden: false,
                    };
                    const endPos = frameXMap[tag.to] || {
                      x: tag.to * 40,
                      width: 40,
                      isHidden: false,
                    };
                    const isCollapsed = collapsedTagIds.has(tag.id);
                    const isTagSelected = selectedTagIds.has(tag.id);

                    const leftX = startPos.x;
                    let widthX = 36;
                    if (!isCollapsed) {
                      const rightX = endPos.isHidden ? endPos.x : endPos.x + endPos.width;
                      widthX = Math.max(28, rightX - leftX);
                    }

                    const topY = tag.trackIndex * 26 + 3;
                    const legHeight = Math.max(6, tagStripHeight - topY - 23);
                    const isPopoverOpen = !!(tagPopover?.isOpen && tagPopover.tag.id === tag.id);

                    return (
                      <TimelineTagItem
                        key={tag.id}
                        tag={tag}
                        leftX={leftX}
                        topY={topY}
                        widthX={widthX}
                        legHeight={legHeight}
                        isCollapsed={isCollapsed}
                        isTagSelected={isTagSelected}
                        isPopoverOpen={isPopoverOpen}
                        selectedTagCount={selectedTagCount}
                        allSelectedCollapsed={allSelectedCollapsed}
                        hasSaveTag={Boolean(onSaveTag)}
                        hasDeleteTag={Boolean(onDeleteTag)}
                        onRegisterRef={registerTagRef}
                        onTagMouseDown={handleTagMouseDown}
                        onOpenTagPopover={handleOpenTagPopover}
                        onTagContextMenu={handleTagContextMenu}
                        onToggleCollapse={toggleCollapseTag}
                        onDuplicateSingle={handleDuplicateSingleTag}
                        onDeleteSingle={handleDeleteSingleTag}
                        onToggleSelectedCollapse={handleToggleSelectedTagsCollapse}
                        onDuplicateSelected={handleDuplicateSelectedTags}
                        onDeleteSelected={handleDeleteSelectedTags}
                      />
                    );
                  })}
                </div>
              )}

              {/* Frame Numbers Ruler */}
              <div className="flex h-8 border-b border-border bg-background/40">
                {columns.map((col) => {
                  if (col.type === 'collapsed') {
                    return (
                      <div
                        key={`col-header-collapsed-${col.tag.id}`}
                        onClick={(e) => toggleCollapseTag(col.tag.id, e)}
                        className="flex w-[36px] shrink-0 cursor-pointer items-center justify-center border-r border-border bg-secondary/70 font-mono text-[11px] font-semibold text-primary tabular-nums transition-colors hover:bg-accent"
                        title={`Collapsed tag "${col.tag.name}" (${col.count} frames). Click to expand.`}
                      >
                        <span>{col.count}f</span>
                      </div>
                    );
                  }

                  const idx = col.frameIndex;
                  const frame = frames[idx];
                  const isCurrent = activeFrameIndex === idx;
                  const isSelected = selectedFrameSet.has(idx);

                  return (
                    <TimelineFrameHeader
                      key={frame.id}
                      frameIndex={idx}
                      isCurrent={isCurrent}
                      isSelected={isSelected}
                      onFrameClick={handleFrameClick}
                      onDuplicateThisFrame={handleDuplicateThisFrame}
                      onDeleteThisFrame={handleDeleteThisFrame}
                    />
                  );
                })}

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="New Frame"
                        onClick={onAddFrame}
                        className="flex w-10 min-w-[40px] shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                      >
                        <Plus size={14} />
                      </button>
                    }
                  />
                  <TooltipContent side="top">New Frame</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Allotment Split Area (Synchronized Layer Tracks & Frame Cel Grid) */}
        <div className="h-full w-full min-h-0 flex-1 bg-canvas">
          <Allotment
            key={isMobile ? 'mobile' : 'desktop'}
            defaultSizes={[sidebarWidth, 1000]}
            onChange={(sizes) => {
              const nextWidth = sizes?.[0];
              if (nextWidth) {
                setSidebarWidth((prev) => (Math.abs(nextWidth - prev) > 0.5 ? nextWidth : prev));
              }
            }}
            className="h-full w-full"
          >
            <Allotment.Pane minSize={100} preferredSize={sidebarWidth} priority={1 as any}>
              <div
                ref={layersScrollRef}
                onScroll={handleLayersScroll}
                className="no-scrollbar flex h-full w-full flex-col overflow-x-hidden overflow-y-auto border-r border-border bg-card"
              >
                <div
                  onDragOver={handleLayerContainerDragOver}
                  onDrop={handleLayerContainerDrop}
                  className="flex flex-col"
                >
                  <>
                        {reversedLayers.map((layer) => {
                          if (collapsedLayerIds.has(layer.id)) return null;

                          const isDragging =
                            dragState?.type === 'layer' && dragState.id === layer.id;
                          const dropPosition =
                            dragState?.type === 'layer' && dragState.overId === layer.id
                              ? dragState.position
                              : null;
                          const isActive = activeLayerId === layer.id;
                          const isSelected = selectedLayerSet.has(layer.id);
                          const effectiveVis = isLayerVisible(layer, layers, parentMap);

                          return (
                            <TimelineLayerRow
                              key={layer.id}
                              layer={layer}
                              isActive={isActive}
                              isSelected={isSelected}
                              isDragging={isDragging}
                              dropPosition={dropPosition}
                              effectiveVis={effectiveVis}
                              onDragStart={handleLayerDragStart}
                              onDragOver={handleLayerDragOver}
                              onDrop={handleLayerDrop}
                              onDragEnd={handleLayerDragEnd}
                              onSelectLayer={onSelectLayer}
                              onUpdateLayer={onUpdateLayer}
                              onToggleLayerVisibility={onToggleLayerVisibility}
                              onToggleLayerLock={onToggleLayerLock}
                            />
                          );
                        })}

                        {dragState?.type === 'layer' && dragState?.overId === 'root-bottom' && (
                          <div className="relative my-1.5 flex h-0.5 w-full shrink-0 items-center rounded-full bg-primary">
                            <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={onAddLayer}
                          className="flex h-8 w-full shrink-0 items-center gap-1.5 border-b border-border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                        >
                          <Plus size={12} className="shrink-0" />
                          <span>New Layer</span>
                        </button>
                      </>
                </div>
              </div>
            </Allotment.Pane>

            {/* Frames Cel Grid */}
            <Allotment.Pane priority={2 as any}>
              <ContextMenu>
                <ContextMenuTrigger
                  render={
                    <div
                      ref={framesScrollRef}
                      onScroll={handleFramesScroll}
                      onDragOver={handleFrameContainerDragOver}
                      onDrop={handleFrameContainerDrop}
                      tabIndex={0}
                      className="h-full w-full overflow-x-auto overflow-y-auto bg-canvas outline-none"
                    >
                      <div className="relative flex min-w-max flex-col">
                        {reversedLayers.map((layer) => {
                          if (collapsedLayerIds.has(layer.id)) return null;
                          const isActiveLayer = activeLayerId === layer.id;

                          return (
                            <TimelineCelRow
                              key={layer.id}
                              layerId={layer.id}
                              totalWidth={totalWidth}
                              columns={columns}
                              frames={frames}
                              activeFrameIndex={isActiveLayer ? activeFrameIndex : -1}
                              isActiveLayer={isActiveLayer}
                              selectedFrameSet={selectedFrameSet}
                              isLayerSelected={selectedLayerSet.has(layer.id)}
                              onToggleCollapseTag={toggleCollapseTag}
                              onFrameClick={handleFrameClick}
                            />
                          );
                        })}
                      </div>

                      <div
                        className="pointer-events-none flex h-8 shrink-0 border-b border-border bg-background/20"
                        style={{ width: `${totalWidth + 40}px` }}
                      />
                    </div>
                  }
                />
                <ContextMenuContent>
                  <ContextMenuItem onSelect={onAddFrame}>New Frame</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </div>
  );
};
