import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Allotment } from 'allotment';
import { useMobile } from '../hooks/useMobile';
import { ProjectState, FrameTag, PixelGrid } from '../types';
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
import { AnimationTagPopover } from './AnimationTagPopover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';

interface TimelineProps {
  state: ProjectState;
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

export const Timeline: React.FC<TimelineProps> = React.memo(({
  state,
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
  activeTagPopover,
  onCloseTagPopover,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onUpdateLayer,
  onAddLayer,
  onReorderLayers,
  onReorderFrames,
}) => {
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

  const selectedFrameSet = useMemo(
    () => new Set(state.selectedFrameIndices),
    [state.selectedFrameIndices]
  );
  const selectedLayerSet = useMemo(
    () => new Set(state.selectedLayerIds),
    [state.selectedLayerIds]
  );

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTagIds.size > 0) {
        if (onDeleteTag) {
          e.preventDefault();
          selectedTagIds.forEach((id) => {
            onDeleteTag(id);
          });
          setSelectedTagIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTagIds, onDeleteTag]);

  const handleTagMouseDown = (
    e: React.MouseEvent,
    tag: FrameTag,
    mode: 'resize-left' | 'resize-right' | 'move'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    let targetSelectedIds: string[];
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const next = new Set<string>(selectedTagIds);
      next.add(tag.id);
      setSelectedTagIds(next);
      targetSelectedIds = Array.from(next);
    } else if (!selectedTagIds.has(tag.id)) {
      const next = new Set<string>([tag.id]);
      setSelectedTagIds(next);
      targetSelectedIds = [tag.id];
    } else {
      targetSelectedIds = Array.from(selectedTagIds);
    }

    const allTags = state.tags || [];
    const initialStates: Record<string, TagRange> = {};
    targetSelectedIds.forEach((id) => {
      const t = allTags.find((x) => x.id === id);
      if (t) {
        initialStates[t.id] = { from: t.from, to: t.to };
      }
    });

    setResizingTagState({
      draggedTagId: tag.id,
      mode,
      startX: e.clientX,
      hasMoved: false,
      initialStates,
      currentStates: { ...initialStates },
    });
  };

  useEffect(() => {
    if (!resizingTagState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingTagState.startX;
      const isPastThreshold = Math.abs(deltaX) > 3;
      const deltaFrames = Math.round(deltaX / 40);
      const totalFrames = state.frames.length;

      const nextCurrentStates: Record<string, TagRange> = {};

      (Object.entries(resizingTagState.initialStates) as [string, TagRange][]).forEach(
        ([tId, initial]) => {
          let newFrom = initial.from;
          let newTo = initial.to;

          if (resizingTagState.mode === 'resize-left') {
            newFrom = Math.max(0, Math.min(initial.to, initial.from + deltaFrames));
            newTo = initial.to;
          } else if (resizingTagState.mode === 'resize-right') {
            newTo = Math.max(initial.from, Math.min(totalFrames - 1, initial.to + deltaFrames));
            newFrom = initial.from;
          } else if (resizingTagState.mode === 'move') {
            const span = initial.to - initial.from;
            newFrom = Math.max(0, Math.min(totalFrames - 1 - span, initial.from + deltaFrames));
            newTo = newFrom + span;
          }

          nextCurrentStates[tId] = { from: newFrom, to: newTo };
        }
      );

      setResizingTagState((prev) =>
        prev
          ? {
              ...prev,
              hasMoved: prev.hasMoved || isPastThreshold || deltaFrames !== 0,
              currentStates: nextCurrentStates,
            }
          : null
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizingTagState) {
        if (resizingTagState.hasMoved) {
          (Object.entries(resizingTagState.currentStates) as [string, TagRange][]).forEach(
            ([tId, updated]) => {
              const targetTag = (state.tags || []).find((t) => t.id === tId);
              if (
                targetTag &&
                (updated.from !== targetTag.from || updated.to !== targetTag.to)
              ) {
                if (onSaveTag) {
                  onSaveTag({
                    ...targetTag,
                    from: updated.from,
                    to: updated.to,
                  });
                }
              }
            }
          );
        } else {
          const clickedId = resizingTagState.draggedTagId;
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
      setResizingTagState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTagState, state.frames.length, state.tags, onSaveTag]);

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
    if (activeTagPopover?.isOpen) {
      const from =
        state.selectedFrameIndices.length > 0
          ? Math.min(...state.selectedFrameIndices)
          : state.activeFrameIndex;
      const to =
        state.selectedFrameIndices.length > 0
          ? Math.max(...state.selectedFrameIndices)
          : state.activeFrameIndex;
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
  }, [activeTagPopover]);

  const handleOpenTagPopover = (existingTag?: FrameTag, e?: React.MouseEvent | Event) => {
    if (e && 'stopPropagation' in e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const from =
      state.selectedFrameIndices.length > 0
        ? Math.min(...state.selectedFrameIndices)
        : state.activeFrameIndex;
    const to =
      state.selectedFrameIndices.length > 0
        ? Math.max(...state.selectedFrameIndices)
        : state.activeFrameIndex;

    let tag: FrameTag;
    if (existingTag) {
      tag = { ...existingTag };
    } else {
      tag = {
        id: `tag-${Date.now()}`,
        name: 'New Tag',
        from,
        to,
        color: '#3b82f6',
        direction: 'forward',
        repeat: 0,
      };
      if (onSaveTag) {
        onSaveTag(tag);
      } else if (onAddTag) {
        onAddTag(tag.name, tag.from, tag.to, tag.color);
      }
    }

    setTagPopover({
      isOpen: true,
      tag,
      isNew: false,
    });
  };

  const handleCloseTagPopover = () => {
    setTagPopover(null);
    if (onCloseTagPopover) onCloseTagPopover();
  };

  const handleFrameClick = (e: React.MouseEvent, index: number, layerId?: string) => {
    let newSelection = [...state.selectedFrameIndices];

    if (e.shiftKey) {
      const startIdx = state.activeFrameIndex;
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

    onSelectFrames(newSelection, index, layerId);
  };

  const handleLayerDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('type', 'layer');
    e.dataTransfer.setData('id', id);
    setDragState({ type: 'layer', id, overId: null, position: 'after' });
  };

  const handleLayerDragOver = (e: React.DragEvent, hoveredLayer: any) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();

    if (dragState.id === hoveredLayer.id) return;

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

    if (dragState.overId !== hoveredLayer.id || dragState.position !== position) {
      setDragState({ ...dragState, overId: hoveredLayer.id, position });
    }
  };

  const handleLayerDrop = (e: React.DragEvent, targetId: string) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.id !== targetId && dragState.overId) {
      onReorderLayers(dragState.id, targetId, dragState.position);
    }
    setDragState(null);
  };

  const handleInsertButtonDragOver = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId !== `insert-${index}`) {
      setDragState({
        ...dragState,
        overId: `insert-${index}`,
        position: 'before',
      });
    }
  };

  const handleInsertButtonDrop = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id, 10);
    let insertIndex = index;
    if (fromIndex < insertIndex) insertIndex--;
    onReorderFrames(fromIndex, insertIndex);
    setDragState(null);
  };

  const handleLayerContainerDragOver = (e: React.DragEvent) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId !== 'root-bottom') {
      setDragState({
        ...dragState,
        overId: 'root-bottom',
        position: 'root-bottom',
      });
    }
  };

  const handleLayerContainerDrop = (e: React.DragEvent) => {
    if (dragState?.type !== 'layer') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId === 'root-bottom') {
      onReorderLayers(dragState.id, 'root-bottom', 'root-bottom');
    } else if (dragState.overId && dragState.id !== dragState.overId) {
      onReorderLayers(dragState.id, dragState.overId, dragState.position);
    }
    setDragState(null);
  };

  const handleFrameContainerDragOver = (e: React.DragEvent) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const relativeX = e.clientX - rect.left + scrollLeft;

    if (state.frames.length === 0) return;

    const preciseIndex = relativeX / 40;
    let targetIndex = Math.floor(preciseIndex);
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= state.frames.length) targetIndex = state.frames.length - 1;

    const offset = preciseIndex - targetIndex;
    const position = offset < 0.5 ? 'before' : 'after';

    if (dragState.overId !== targetIndex.toString() || dragState.position !== position) {
      setDragState({ ...dragState, overId: targetIndex.toString(), position });
    }
  };

  const handleFrameContainerDrop = (e: React.DragEvent) => {
    if (dragState?.type !== 'frame') return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id, 10);
    const targetIndex = dragState.overId ? parseInt(dragState.overId, 10) : state.frames.length - 1;
    if (fromIndex !== targetIndex) {
      let insertIndex = targetIndex;
      if (dragState.position === 'after') insertIndex = targetIndex + 1;
      if (fromIndex < insertIndex) insertIndex--;
      onReorderFrames(fromIndex, insertIndex);
    }
    setDragState(null);
  };

  const isMultiFrame = state.selectedFrameIndices.length > 1;
  const canTween = state.selectedFrameIndices.length >= 3;

  const allTags = state.tags || [];
  const { trackTags, maxTracks } = useMemo(
    () => calculateTagTracks(allTags, resizingTagState),
    [allTags, resizingTagState]
  );
  const { columns, frameXMap, totalWidth } = useMemo(
    () => calculateColumns(state.frames.length, allTags, collapsedTagIds),
    [state.frames.length, allTags, collapsedTagIds]
  );
  const tagStripHeight = allTags.length > 0 ? Math.max(28, maxTracks * 26 + 6) : 0;
  const totalHeaderHeight = tagStripHeight + 32;

  const parentMap = useMemo(() => getLayerParentMap(state.layers), [state.layers]);
  const reversedLayers = useMemo(() => state.layers.slice().reverse(), [state.layers]);
  const collapsedLayerIds = useMemo(() => {
    const collapsed = new Set<string>();
    const layerById = new Map(state.layers.map((l) => [l.id, l]));
    for (const layer of state.layers) {
      let curr: typeof layer | undefined = layer;
      const visited = new Set<string>();
      while (curr) {
        if (visited.has(curr.id)) break;
        visited.add(curr.id);
        const parent =
          parentMap.get(curr.id) || (curr.parentId ? layerById.get(curr.parentId) : undefined);
        if (parent) {
          if (parent.collapsed) {
            collapsed.add(layer.id);
            break;
          }
          curr = parent;
        } else {
          break;
        }
      }
    }
    return collapsed;
  }, [state.layers, parentMap]);

  const activeEditingTag = tagPopover?.isOpen ? tagPopover.tag : null;
  const tagPopoverAnchor = activeEditingTag
    ? {
        getBoundingClientRect: () =>
          (tagRefs.current.get(activeEditingTag.id) ?? tagButtonRef.current)?.getBoundingClientRect() ??
          new DOMRect(0, 0, 0, 0),
      }
    : null;

  return (
    <div className="flex h-full flex-col bg-card text-sm select-none">
      {resizingTagState && resizingTagState.hasMoved && (
        <div className="pointer-events-none fixed top-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border-strong bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-2xl">
          <Tag size={13} className="text-primary" />
          <span>
            {Object.keys(resizingTagState.currentStates).length > 1 ? (
              <>
                {resizingTagState.mode === 'move' ? 'Moving' : 'Resizing'}{' '}
                <strong className="font-mono font-semibold text-primary tabular-nums">
                  {Object.keys(resizingTagState.currentStates).length} Selected Tags
                </strong>
              </>
            ) : (
              (() => {
                const firstState = Object.values(resizingTagState.currentStates)[0] as
                  | TagRange
                  | undefined;
                return (
                  <>
                    {resizingTagState.mode === 'resize-left'
                      ? 'Resizing Start: '
                      : resizingTagState.mode === 'resize-right'
                        ? 'Resizing End: '
                        : 'Moving Tag: '}
                    <strong className="font-mono font-semibold text-primary tabular-nums">
                      Frame {firstState ? firstState.from + 1 : 1} -{' '}
                      {firstState ? firstState.to + 1 : 1}
                    </strong>
                    <span className="ml-1 font-mono text-muted-foreground tabular-nums">
                      ({firstState ? firstState.to - firstState.from + 1 : 1} frames)
                    </span>
                  </>
                );
              })()
            )}
          </span>
        </div>
      )}

      {/* Single Shared Popover for Tag Properties */}
      <Popover
        open={!!(tagPopover?.isOpen && activeEditingTag && tagPopoverAnchor)}
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
          {activeEditingTag && (
            <AnimationTagPopover
              isOpen={true}
              tag={activeEditingTag}
              isNew={false}
              totalFrames={state.frames.length}
              frames={state.frames}
              onSave={(savedTag) => {
                if (onSaveTag) {
                  onSaveTag(savedTag);
                } else if (onAddTag) {
                  onAddTag(savedTag.name, savedTag.from, savedTag.to, savedTag.color);
                }
              }}
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
          )}
        </PopoverContent>
      </Popover>

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

            <div className="flex h-8 shrink-0 items-center gap-1 overflow-hidden px-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Duplicate Frame"
                      onClick={() =>
                        isMultiFrame ? onDuplicateSelectedFrames() : onDuplicateFrame()
                      }
                      className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-accent ${
                        isMultiFrame ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Copy size={13} />
                    </button>
                  }
                />
                <TooltipContent side="top">Duplicate Frame</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Delete Frame"
                      onClick={() => (isMultiFrame ? onDeleteSelectedFrames() : onDeleteFrame())}
                      className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-destructive/15 hover:text-destructive ${
                        isMultiFrame ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      <Trash2 size={13} />
                    </button>
                  }
                />
                <TooltipContent side="top">Delete Frame</TooltipContent>
              </Tooltip>

              <div className="mx-0.5 h-3.5 w-px bg-border" />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Tween Between Selected Frames"
                      onClick={onTweenFrames}
                      disabled={!canTween}
                      className="flex h-6 w-6 items-center justify-center rounded-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/35 disabled:hover:bg-transparent"
                    >
                      <Sparkles size={13} />
                    </button>
                  }
                />
                <TooltipContent side="top">
                  Interpolate (Tween) Between Selection
                </TooltipContent>
              </Tooltip>

              <div className="mx-0.5 h-3.5 w-px bg-border" />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      ref={tagButtonRef}
                      type="button"
                      aria-label="Create Animation Tag"
                      onClick={(e) => handleOpenTagPopover(undefined, e)}
                      className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Tag size={12} className="text-primary" />
                      <span className="hidden sm:inline">Tag</span>
                    </button>
                  }
                />
                <TooltipContent side="top">Create Animation Tag from Selection</TooltipContent>
              </Tooltip>
            </div>
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
                {Array.from({ length: state.frames.length + 1 }).map((_, i) => {
                  const isOver = dragState?.type === 'frame' && dragState.overId === `insert-${i}`;
                  const framePos = frameXMap[i] || { x: i * 40 };
                  return (
                    <div
                      key={`insert-${i}`}
                      onDragOver={(e) => handleInsertButtonDragOver(e, i)}
                      onDrop={(e) => handleInsertButtonDrop(e, i)}
                      className="group pointer-events-auto absolute top-0 bottom-0 -ml-2 flex w-4 cursor-pointer items-center justify-center"
                      style={{ left: framePos.x }}
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
                              aria-label={`Insert frame at ${i + 1}`}
                              onClick={() => onInsertFrame(i)}
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
                    const color = tag.color || '#3b82f6';
                    const transparentBg =
                      color.startsWith('#') && color.length === 7 ? `${color}48` : color;

                    const leftX = startPos.x;
                    let widthX = 36;
                    if (!isCollapsed) {
                      const rightX = endPos.isHidden ? endPos.x : endPos.x + endPos.width;
                      widthX = Math.max(28, rightX - leftX);
                    }

                    const topY = tag.trackIndex * 26 + 3;
                    const legHeight = Math.max(6, tagStripHeight - topY - 23);
                    const isPopoverOpen = !!(tagPopover?.isOpen && tagPopover.tag.id === tag.id);

                    const renderTagDirectionIcon = () => {
                      switch (tag.direction) {
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

                    return (
                      <ContextMenu key={tag.id}>
                        <ContextMenuTrigger
                          render={
                            <div
                              ref={(el) => {
                                if (el) tagRefs.current.set(tag.id, el);
                                else tagRefs.current.delete(tag.id);
                              }}
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
                                        onMouseDown={(e) => handleTagMouseDown(e, tag, 'move')}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => handleOpenTagPopover(tag, e)}
                                        onContextMenu={(e) => {
                                          if (!selectedTagIds.has(tag.id)) {
                                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                              setSelectedTagIds((prev) => new Set(prev).add(tag.id));
                                            } else {
                                              setSelectedTagIds(new Set([tag.id]));
                                            }
                                          }
                                        }}
                                      >
                                        <div className="pointer-events-none flex shrink-0 items-center gap-1 truncate">
                                          <span className="truncate leading-none font-semibold whitespace-nowrap">
                                            {tag.name}
                                          </span>
                                          {!isCollapsed &&
                                            tag.direction &&
                                            tag.direction !== 'forward' && (
                                              <span className="flex shrink-0 items-center justify-center opacity-85">
                                                {renderTagDirectionIcon()}
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
                                    toggleCollapseTag(tag.id, e);
                                  }}
                                  className="z-30 shrink-0 cursor-pointer rounded-sm border border-border bg-card p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/tag:opacity-100 hover:text-foreground"
                                >
                                  {isCollapsed ? (
                                    <ChevronsLeftRight size={10} />
                                  ) : (
                                    <ChevronsRightLeft size={10} />
                                  )}
                                </button>
                              </div>

                              {!isCollapsed && (
                                <div
                                  className="group/lh absolute -left-1 top-[19px] z-30 flex w-2.5 cursor-ew-resize items-center justify-center opacity-0 group-hover/tag:opacity-100"
                                  style={{ height: `${legHeight}px` }}
                                  title="Drag to resize tag start"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleTagMouseDown(e, tag, 'resize-left');
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
                                    handleTagMouseDown(e, tag, 'resize-right');
                                  }}
                                >
                                  <div className="h-full w-[3px] rounded-full bg-white opacity-0 transition-opacity group-hover/rh:opacity-100" />
                                </div>
                              )}

                              {(() => {
                                const r = Math.min(5, Math.max(1, (widthX - 2) / 2));
                                const xRight = Math.max(2, widthX - 1);
                                return (
                                  <svg
                                    className="pointer-events-none absolute top-[19px] left-0 z-20 overflow-visible"
                                    style={{
                                      width: `${Math.max(4, widthX)}px`,
                                      height: `${legHeight}px`,
                                    }}
                                  >
                                    <path
                                      d={`M 1 ${legHeight} V ${1 + r} Q 1 1 ${1 + r} 1 H ${xRight - r} Q ${xRight} 1 ${xRight} ${1 + r} V ${legHeight}`}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                );
                              })()}
                            </div>
                          }
                        />
                        <ContextMenuContent>
                          {selectedTagIds.size <= 1 ? (
                            <>
                              <ContextMenuItem onSelect={(e) => handleOpenTagPopover(tag, e)}>
                                Edit Tag Properties...
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => toggleCollapseTag(tag.id)}>
                                {isCollapsed
                                  ? 'Expand / Unfold Frames'
                                  : 'Collapse / Fold Frames'}
                              </ContextMenuItem>
                              {onSaveTag && (
                                <ContextMenuItem
                                  onSelect={() => {
                                    onSaveTag({
                                      ...tag,
                                      id: `tag_${Date.now()}`,
                                      name: `${tag.name} (Copy)`,
                                    });
                                  }}
                                >
                                  Duplicate Tag
                                </ContextMenuItem>
                              )}
                              {onDeleteTag && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    destructive
                                    onSelect={() => {
                                      onDeleteTag(tag.id);
                                      setSelectedTagIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(tag.id);
                                        return next;
                                      });
                                      if (tagPopover?.tag.id === tag.id) handleCloseTagPopover();
                                    }}
                                  >
                                    Delete Tag
                                  </ContextMenuItem>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <ContextMenuItem
                                onSelect={() => {
                                  const allCollapsed = Array.from(selectedTagIds).every((id) =>
                                    collapsedTagIds.has(id)
                                  );
                                  setCollapsedTagIds((prev) => {
                                    const next = new Set(prev);
                                    selectedTagIds.forEach((id) => {
                                      if (allCollapsed) next.delete(id);
                                      else next.add(id);
                                    });
                                    return next;
                                  });
                                }}
                              >
                                {Array.from(selectedTagIds).every((id) => collapsedTagIds.has(id))
                                  ? `Expand Frames (${selectedTagIds.size} Tags)`
                                  : `Collapse Frames (${selectedTagIds.size} Tags)`}
                              </ContextMenuItem>
                              {onSaveTag && (
                                <ContextMenuItem
                                  onSelect={() => {
                                    const allTagsList = state.tags || [];
                                    selectedTagIds.forEach((id) => {
                                      const t = allTagsList.find((x) => x.id === id);
                                      if (t) {
                                        onSaveTag({
                                          ...t,
                                          id: `tag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                          name: `${t.name} (Copy)`,
                                        });
                                      }
                                    });
                                  }}
                                >
                                  Duplicate Selected Tags ({selectedTagIds.size})
                                </ContextMenuItem>
                              )}
                              {onDeleteTag && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    destructive
                                    onSelect={() => {
                                      selectedTagIds.forEach((id) => onDeleteTag(id));
                                      setSelectedTagIds(new Set());
                                      if (tagPopover && selectedTagIds.has(tagPopover.tag.id)) {
                                        handleCloseTagPopover();
                                      }
                                    }}
                                  >
                                    Delete Selected Tags ({selectedTagIds.size})
                                  </ContextMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
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
                  const frame = state.frames[idx];
                  const isCurrent = state.activeFrameIndex === idx;
                  const isSelected = selectedFrameSet.has(idx);

                  return (
                    <ContextMenu key={frame.id}>
                      <ContextMenuTrigger
                        render={
                          <div
                            onClick={(e) => handleFrameClick(e, idx)}
                            className={`relative flex w-10 min-w-[40px] shrink-0 cursor-pointer items-center justify-center border-r border-border font-mono text-[11px] tabular-nums transition-colors ${
                              isCurrent
                                ? 'bg-primary font-semibold text-primary-foreground'
                                : isSelected
                                  ? 'bg-primary/20 font-medium text-foreground'
                                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                            }`}
                          >
                            <span>{idx + 1}</span>
                          </div>
                        }
                      />
                      <ContextMenuContent>
                        <ContextMenuItem
                          onSelect={() => {
                            onSelectFrames([idx], idx);
                            onDuplicateFrame();
                          }}
                        >
                          Duplicate Frame
                        </ContextMenuItem>
                        <ContextMenuItem
                          destructive
                          onSelect={() => {
                            onSelectFrames([idx], idx);
                            onDeleteFrame();
                          }}
                        >
                          Delete Frame
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
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
              if (sizes && sizes[0] && Math.abs(sizes[0] - sidebarWidth) > 0.5) {
                setSidebarWidth(sizes[0]);
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
                            const isOver =
                              dragState?.type === 'layer' && dragState.overId === layer.id;
                            const isActive = state.activeLayerId === layer.id;
                            const isSelected = selectedLayerSet.has(layer.id);
                            const effectiveVis = isLayerVisible(layer, state.layers, parentMap);
                            const childLevel = layer.childLevel ?? 0;
                            const isGroup = layer.type === 'group';

                            return (
                              <div
                                key={layer.id}
                                draggable
                                onDragStart={(e) => handleLayerDragStart(e, layer.id)}
                                onDragOver={(e) => {
                                  e.stopPropagation();
                                  handleLayerDragOver(e, layer);
                                }}
                                onDrop={(e) => {
                                  e.stopPropagation();
                                  handleLayerDrop(e, layer.id);
                                }}
                                onDragEnd={() => setDragState(null)}
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
                                {isOver && dragState.position === 'before' && (
                                  <div className="pointer-events-none absolute top-0 left-0 z-50 flex h-0.5 w-full items-center rounded-full bg-primary">
                                    <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                  </div>
                                )}
                                {isOver && dragState.position === 'after' && (
                                  <div className="pointer-events-none absolute bottom-0 left-0 z-50 flex h-0.5 w-full items-center rounded-full bg-primary">
                                    <div className="-ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                  </div>
                                )}
                                {isOver && dragState.position === 'inside' && (
                                  <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-end rounded border-2 border-primary bg-primary/15 pr-2">
                                    <span className="rounded-xs border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                      Nest in Group
                                    </span>
                                  </div>
                                )}
                                {isOver && dragState.position === 'outside' && (
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
                                    {layer.collapsed ? (
                                      <ChevronRight size={11} />
                                    ) : (
                                      <ChevronDown size={11} />
                                    )}
                                  </button>
                                ) : (
                                  <div className="w-2.5 shrink-0" />
                                )}

                                <button
                                  type="button"
                                  aria-label={
                                    layer.visible && effectiveVis ? 'Hide layer' : 'Show layer'
                                  }
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
                                  title={
                                    layer.visible && !effectiveVis
                                      ? 'Hidden by parent group'
                                      : undefined
                                  }
                                >
                                  {layer.visible && effectiveVis ? (
                                    <Eye size={12} />
                                  ) : (
                                    <EyeOff size={12} />
                                  )}
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
                                    {layer.collapsed ? (
                                      <Folder size={11} />
                                    ) : (
                                      <FolderOpen size={11} />
                                    )}
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

                              return (
                                <div
                                  key={layer.id}
                                  className="flex h-8 border-b border-border"
                                  style={{ width: `${totalWidth + 40}px` }}
                                >
                                  {columns.map((col) => {
                                    if (col.type === 'collapsed') {
                                      return (
                                        <div
                                          key={`cell-collapsed-${layer.id}-${col.tag.id}`}
                                          onClick={(e) => toggleCollapseTag(col.tag.id, e)}
                                          className="group flex w-[36px] shrink-0 cursor-pointer items-center justify-center border-r border-border bg-background/60 hover:bg-secondary"
                                          title={`Collapsed tag "${col.tag.name}" (${col.count} frames). Click to expand.`}
                                        >
                                          <div className="h-full w-1.5 border-x border-dashed border-primary/40 group-hover:border-primary/80" />
                                        </div>
                                      );
                                    }

                                    const frameIdx = col.frameIndex;
                                    const frame = state.frames[frameIdx];
                                    const hasContent = hasCelContent(frame?.layerData[layer.id]);
                                    const isActive =
                                      state.activeFrameIndex === frameIdx &&
                                      state.activeLayerId === layer.id;
                                    const isFrameSelected = selectedFrameSet.has(frameIdx);
                                    const isLayerSelected = selectedLayerSet.has(layer.id);

                                    return (
                                      <div
                                        key={`${layer.id}-${frameIdx}`}
                                        onClick={(e) => handleFrameClick(e, frameIdx, layer.id)}
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
                                  })}

                                  <div className="pointer-events-none flex w-10 min-w-[40px] shrink-0 items-center justify-center border-r border-border bg-background/20" />
                                </div>
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
});
