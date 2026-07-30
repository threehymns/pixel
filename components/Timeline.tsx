import React, { useState, useEffect } from "react";
import { ProjectState, FrameTag } from "../types";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Copy,
  Trash2,
  GripVertical,
  FilePlus,
  Sparkles,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "./Icons";
import {
  Tag,
  Check,
  Minus,
  X,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ChevronsRightLeft,
  ChevronsLeftRight,
} from "lucide-react";
import {
  getLayerParentMap,
  isLayerVisible,
  getGroupChildCount,
} from "../utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./ui/popover";
import { AnimationTagPopover } from "./AnimationTagPopover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";



interface TimelineProps {
  state: ProjectState;
  onSelectFrames: (
    indices: number[],
    activeIndex: number,
    layerId?: string,
  ) => void;
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
    position: "before" | "after" | "inside" | "outside" | "root-bottom",
  ) => void;
  onReorderFrames: (fromIndex: number, toIndex: number) => void;
}

interface DragState {
  type: "layer" | "frame";
  id: string;
  overId: string | null;
  position: "before" | "after" | "inside" | "outside" | "root-bottom";
}

interface TagRange {
  from: number;
  to: number;
}

interface ResizingTagState {
  draggedTagId: string;
  mode: "resize-left" | "resize-right" | "move";
  startX: number;
  hasMoved: boolean;
  initialStates: Record<string, TagRange>;
  currentStates: Record<string, TagRange>;
}

interface FrameColumn {
  type: "frame";
  frameIndex: number;
  x: number;
  width: number;
}

interface CollapsedColumn {
  type: "collapsed";
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

/**
 * Calculates multi-track assignment so overlapping tags stack on separate vertical tracks.
 */
const calculateTagTracks = (
  tagsList: FrameTag[],
  resizingState: ResizingTagState | null,
): { trackTags: TrackTag[]; maxTracks: number } => {
  if (!tagsList || tagsList.length === 0)
    return { trackTags: [], maxTracks: 0 };

  const activeTags = tagsList.map((t) => {
    if (
      resizingState &&
      resizingState.hasMoved &&
      resizingState.currentStates[t.id]
    ) {
      const updated = resizingState.currentStates[t.id];
      return {
        ...t,
        from: updated.from,
        to: updated.to,
      };
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
      const overlap = tracks[t].some(
        (r) => !(tag.to < r.from || tag.from > r.to),
      );
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

/**
 * Calculates timeline column layout including visible frames and folded/collapsed tag pillars.
 */
const calculateColumns = (
  totalFrames: number,
  tagsList: FrameTag[],
  collapsedTagIds: Set<string>,
): {
  columns: TimelineColumn[];
  frameXMap: Record<number, { x: number; width: number; isHidden: boolean }>;
  totalWidth: number;
} => {
  const collapsedTagsList = tagsList.filter((t) => collapsedTagIds.has(t.id));
  const sortedCollapsed = collapsedTagsList
    .slice()
    .sort((a, b) => a.from - b.from);

  const columns: TimelineColumn[] = [];
  const frameXMap: Record<
    number,
    { x: number; width: number; isHidden: boolean }
  > = {};

  let currentX = 0;
  let frameIdx = 0;

  while (frameIdx < totalFrames) {
    const colTag = sortedCollapsed.find(
      (t) => frameIdx >= t.from && frameIdx <= t.to,
    );

    if (colTag && frameIdx === colTag.from) {
      const count = colTag.to - colTag.from + 1;
      const pillarWidth = 36;

      columns.push({
        type: "collapsed",
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
        type: "frame",
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

export const Timeline: React.FC<TimelineProps> = ({
  state,
  onSelectFrames,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onDuplicateSelectedFrames,
  onDeleteSelectedFrames,
  onInsertFrame,
  onTweenFrames,
  onSetFrameDuration,
  onAddTag,
  onSaveTag,
  onDeleteTag,
  onOpenTagProperties,
  activeTagPopover,
  onCloseTagPopover,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onUpdateLayer,
  onAddLayer,
  onAddGroupLayer,
  onReorderLayers,
  onReorderFrames,
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tagPopover, setTagPopover] = useState<{
    isOpen: boolean;
    tag: FrameTag;
    isNew: boolean;
  } | null>(null);

  const [resizingTagState, setResizingTagState] =
    useState<ResizingTagState | null>(null);
  const [collapsedTagIds, setCollapsedTagIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Delete key handler for deleting selected tags
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedTagIds.size > 0
      ) {
        if (onDeleteTag) {
          e.preventDefault();
          selectedTagIds.forEach((id) => {
            onDeleteTag(id);
          });
          setSelectedTagIds(new Set());
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTagIds, onDeleteTag]);

  // Mouse drag handler for resizing tag handles or moving tags
  const handleTagMouseDown = (
    e: React.MouseEvent,
    tag: FrameTag,
    mode: "resize-left" | "resize-right" | "move",
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

      (
        Object.entries(resizingTagState.initialStates) as [string, TagRange][]
      ).forEach(([tId, initial]) => {
        let newFrom = initial.from;
        let newTo = initial.to;

        if (resizingTagState.mode === "resize-left") {
          newFrom = Math.max(
            0,
            Math.min(initial.to, initial.from + deltaFrames),
          );
          newTo = initial.to;
        } else if (resizingTagState.mode === "resize-right") {
          newTo = Math.max(
            initial.from,
            Math.min(totalFrames - 1, initial.to + deltaFrames),
          );
          newFrom = initial.from;
        } else if (resizingTagState.mode === "move") {
          const span = initial.to - initial.from;
          newFrom = Math.max(
            0,
            Math.min(totalFrames - 1 - span, initial.from + deltaFrames),
          );
          newTo = newFrom + span;
        }

        nextCurrentStates[tId] = { from: newFrom, to: newTo };
      });

      setResizingTagState((prev) =>
        prev
          ? {
              ...prev,
              hasMoved: prev.hasMoved || isPastThreshold || deltaFrames !== 0,
              currentStates: nextCurrentStates,
            }
          : null,
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizingTagState) {
        if (resizingTagState.hasMoved) {
          (
            Object.entries(resizingTagState.currentStates) as [
              string,
              TagRange,
            ][]
          ).forEach(([tId, updated]) => {
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
          });
        } else {
          // Pure click without dragging
          const clickedId = resizingTagState.draggedTagId;
          const isModifier = e.shiftKey || e.ctrlKey || e.metaKey;

          if (isModifier) {
            setSelectedTagIds((prev) => {
              const next = new Set<string>(prev);
              if (next.has(clickedId)) {
                next.delete(clickedId);
              } else {
                next.add(clickedId);
              }
              return next;
            });
          } else {
            setSelectedTagIds(new Set<string>([clickedId]));
          }
        }
      }
      setResizingTagState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingTagState, state.frames.length, state.tags, onSaveTag]);

  const toggleCollapseTag = (tagId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
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
            id: `tag_${Date.now()}`,
            name: "New Tag",
            from,
            to,
            color: "#3b82f6",
            direction: "forward",
            repeat: 0,
          };
      setTagPopover({
        isOpen: true,
        tag: initialTag,
        isNew: !activeTagPopover.tag,
      });
    }
  }, [activeTagPopover]);

  const handleOpenTagPopover = (
    existingTag?: FrameTag,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    const from =
      state.selectedFrameIndices.length > 0
        ? Math.min(...state.selectedFrameIndices)
        : state.activeFrameIndex;
    const to =
      state.selectedFrameIndices.length > 0
        ? Math.max(...state.selectedFrameIndices)
        : state.activeFrameIndex;
    const tag: FrameTag = existingTag
      ? { ...existingTag }
      : {
          id: `tag_${Date.now()}`,
          name: "New Tag",
          from,
          to,
          color: "#3b82f6",
          direction: "forward",
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
    if (onCloseTagPopover) onCloseTagPopover();
  };

  const handleSaveTagPopover = () => {
    if (!tagPopover) return;
    const tagToSave = tagPopover.tag;
    const validTotal = Math.max(1, state.frames.length);
    const safeFrom = Math.max(
      0,
      Math.min(validTotal - 1, isNaN(tagToSave.from) ? 0 : tagToSave.from),
    );
    const safeTo = Math.max(
      safeFrom,
      Math.min(
        validTotal - 1,
        isNaN(tagToSave.to) ? validTotal - 1 : tagToSave.to,
      ),
    );
    const finalTag: FrameTag = {
      ...tagToSave,
      from: safeFrom,
      to: safeTo,
      name: tagToSave.name.trim() || "Tag",
      color: tagToSave.color || "#3b82f6",
      direction: tagToSave.direction || "forward",
      repeat: tagToSave.repeat ?? 0,
    };

    if (onSaveTag) {
      onSaveTag(finalTag);
    } else if (onAddTag) {
      onAddTag(finalTag.name, finalTag.from, finalTag.to, finalTag.color);
    }
    handleCloseTagPopover();
  };

  const handleFrameClick = (
    e: React.MouseEvent,
    index: number,
    layerId?: string,
  ) => {
    let newSelection = [...state.selectedFrameIndices];

    if (e.shiftKey) {
      const startIdx = state.activeFrameIndex;
      const endIdx = index;
      const range = [];
      for (
        let i = Math.min(startIdx, endIdx);
        i <= Math.max(startIdx, endIdx);
        i++
      ) {
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
    e.dataTransfer.setData("type", "layer");
    e.dataTransfer.setData("id", id);
    setDragState({ type: "layer", id, overId: null, position: "after" });
  };

  const handleLayerDragOver = (e: React.DragEvent, hoveredLayer: any) => {
    if (dragState?.type !== "layer") return;
    e.preventDefault();
    e.stopPropagation();

    if (dragState.id === hoveredLayer.id) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const height = rect.height;
    const relativeY = e.clientY - rect.top;
    const relativeX = e.clientX - rect.left;

    const childLevel = hoveredLayer.childLevel ?? 0;

    let position: "before" | "after" | "inside" | "outside" = "after";

    // Un-nesting check: if item is inside a group and mouse is dragged towards the left margin
    if (hoveredLayer.parentId && relativeX < Math.max(18, childLevel * 10)) {
      position = "outside";
    } else if (hoveredLayer.type === "group") {
      if (relativeY < height * 0.25) {
        position = "before";
      } else if (relativeY > height * 0.75) {
        position = "after";
      } else {
        position = "inside";
      }
    } else {
      if (relativeY < height / 2) {
        position = "before";
      } else {
        position = "after";
      }
    }

    if (
      dragState.overId !== hoveredLayer.id ||
      dragState.position !== position
    ) {
      setDragState({ ...dragState, overId: hoveredLayer.id, position });
    }
  };

  const handleLayerDrop = (e: React.DragEvent, targetId: string) => {
    if (dragState?.type !== "layer") return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.id !== targetId && dragState.overId) {
      onReorderLayers(dragState.id, targetId, dragState.position);
    }
    setDragState(null);
  };

  const handleFrameDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    e.dataTransfer.setData("type", "frame");
    e.dataTransfer.setData("index", index.toString());
    setDragState({
      type: "frame",
      id: index.toString(),
      overId: null,
      position: "after",
    });
  };

  const handleFrameDragOver = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== "frame") return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? "before" : "after";
    if (
      dragState.overId !== index.toString() ||
      dragState.position !== position
    ) {
      setDragState({ ...dragState, overId: index.toString(), position });
    }
  };

  const handleFrameDrop = (e: React.DragEvent, targetIndex: number) => {
    if (dragState?.type !== "frame") return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id);
    if (fromIndex !== targetIndex) {
      let insertIndex = targetIndex;
      if (dragState.position === "after") insertIndex = targetIndex + 1;
      if (fromIndex < insertIndex) insertIndex--;
      onReorderFrames(fromIndex, insertIndex);
    }
    setDragState(null);
  };

  const handleInsertButtonDragOver = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== "frame") return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId !== `insert-${index}`) {
      setDragState({
        ...dragState,
        overId: `insert-${index}`,
        position: "before",
      });
    }
  };

  const handleInsertButtonDrop = (e: React.DragEvent, index: number) => {
    if (dragState?.type !== "frame") return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id);
    let insertIndex = index;
    if (fromIndex < insertIndex) insertIndex--;
    onReorderFrames(fromIndex, insertIndex);
    setDragState(null);
  };

  const handleLayerContainerDragOver = (e: React.DragEvent) => {
    if (dragState?.type !== "layer") return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId !== "root-bottom") {
      setDragState({
        ...dragState,
        overId: "root-bottom",
        position: "root-bottom",
      });
    }
  };

  const handleLayerContainerDrop = (e: React.DragEvent) => {
    if (dragState?.type !== "layer") return;
    e.preventDefault();
    e.stopPropagation();
    if (dragState.overId === "root-bottom") {
      onReorderLayers(dragState.id, "root-bottom", "root-bottom");
    } else if (dragState.overId && dragState.id !== dragState.overId) {
      onReorderLayers(dragState.id, dragState.overId, dragState.position);
    }
    setDragState(null);
  };

  const handleFrameContainerDragOver = (e: React.DragEvent) => {
    if (dragState?.type !== "frame") return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    // Each frame header is min-w-[40px] w-10 (40px)
    const relativeX = e.clientX - rect.left + scrollLeft;

    if (state.frames.length === 0) return;

    const preciseIndex = relativeX / 40;
    let targetIndex = Math.floor(preciseIndex);
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex >= state.frames.length)
      targetIndex = state.frames.length - 1;

    const offset = preciseIndex - targetIndex;
    const position = offset < 0.5 ? "before" : "after";

    if (
      dragState.overId !== targetIndex.toString() ||
      dragState.position !== position
    ) {
      setDragState({ ...dragState, overId: targetIndex.toString(), position });
    }
  };

  const handleFrameContainerDrop = (e: React.DragEvent) => {
    if (dragState?.type !== "frame") return;
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = parseInt(dragState.id);
    const targetIndex = dragState.overId
      ? parseInt(dragState.overId)
      : state.frames.length - 1;
    if (fromIndex !== targetIndex) {
      let insertIndex = targetIndex;
      if (dragState.position === "after") insertIndex = targetIndex + 1;
      if (fromIndex < insertIndex) insertIndex--;
      onReorderFrames(fromIndex, insertIndex);
    }
    setDragState(null);
  };

  const isMultiFrame = state.selectedFrameIndices.length > 1;
  const canTween = state.selectedFrameIndices.length >= 3;

  return (
    <div className="h-full bg-card border-t border-border/30 flex flex-col text-sm select-none">
      {/* Timeline Controls */}
      <div className="h-7 bg-secondary/20 border-b border-border/40 flex items-center px-2 gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onAddFrame}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">New Frame</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() =>
                isMultiFrame ? onDuplicateSelectedFrames() : onDuplicateFrame()
              }
              className={`p-1 hover:text-foreground transition-colors ${isMultiFrame ? "text-primary font-bold" : "text-muted-foreground"}`}
            >
              <Copy size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Duplicate Frame</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() =>
                isMultiFrame ? onDeleteSelectedFrames() : onDeleteFrame()
              }
              className={`p-1 hover:text-destructive transition-colors ${isMultiFrame ? "text-destructive font-bold" : "text-muted-foreground"}`}
            >
              <Trash2 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Delete Frame</TooltipContent>
        </Tooltip>

        <div className="h-3 w-[1px] bg-border mx-1"></div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onTweenFrames}
              disabled={!canTween}
              className={`p-1 transition-all ${canTween ? "text-primary hover:text-primary-foreground hover:bg-primary rounded" : "text-muted-foreground/40 cursor-not-allowed"}`}
            >
              <Sparkles size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Interpolate (Tween) Between Selection
          </TooltipContent>
        </Tooltip>

        <div className="h-3 w-[1px] bg-border mx-1"></div>

        <Popover
          open={tagPopover?.isOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseTagPopover();
          }}
        >
          <PopoverAnchor asChild>
            <div className="inline-flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleOpenTagPopover(undefined, e)}
                    className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${tagPopover?.isOpen ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}
                  >
                    <Tag size={13} className="text-primary" />
                    <span className="text-[11px] font-medium hidden sm:inline">
                      Tag
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Create Animation Tag from Selection
                </TooltipContent>
              </Tooltip>
            </div>
          </PopoverAnchor>

          {tagPopover?.isOpen && (
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={8}
              className="p-0 border-none bg-transparent shadow-none outline-none z-[100]"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <AnimationTagPopover
                isOpen={tagPopover.isOpen}
                tag={tagPopover.tag}
                isNew={tagPopover.isNew}
                totalFrames={state.frames.length}
                frames={state.frames}
                onSave={(savedTag) => {
                  if (onSaveTag) {
                    onSaveTag(savedTag);
                  } else if (onAddTag) {
                    onAddTag(
                      savedTag.name,
                      savedTag.from,
                      savedTag.to,
                      savedTag.color
                    );
                  }
                  handleCloseTagPopover();
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
            </PopoverContent>
          )}
        </Popover>

        <div className="h-3 w-[1px] bg-border mx-1"></div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onAddLayer}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FilePlus size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">New Layer</TooltipContent>
        </Tooltip>
      </div>

      {resizingTagState && resizingTagState.hasMoved && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] bg-popover text-popover-foreground border border-border px-3 py-1.5 rounded-lg shadow-2xl text-xs font-medium flex items-center gap-2 animate-in fade-in zoom-in-95 pointer-events-none">
          <Tag size={13} className="text-primary" />
          <span>
            {Object.keys(resizingTagState.currentStates).length > 1 ? (
              <>
                {resizingTagState.mode === "move" ? "Moving" : "Resizing"}{" "}
                <strong className="text-primary font-mono font-semibold">
                  {Object.keys(resizingTagState.currentStates).length} Selected
                  Tags
                </strong>
              </>
            ) : (
              (() => {
                const firstState = Object.values(
                  resizingTagState.currentStates,
                )[0] as TagRange | undefined;
                return (
                  <>
                    {resizingTagState.mode === "resize-left"
                      ? "Resizing Start: "
                      : resizingTagState.mode === "resize-right"
                        ? "Resizing End: "
                        : "Moving Tag: "}
                    <strong className="text-primary font-mono font-semibold">
                      Frame {firstState ? firstState.from + 1 : 1} -{" "}
                      {firstState ? firstState.to + 1 : 1}
                    </strong>
                    <span className="text-muted-foreground ml-1">
                      ({firstState ? firstState.to - firstState.from + 1 : 1}{" "}
                      frames)
                    </span>
                  </>
                );
              })()
            )}
          </span>
        </div>
      )}

      {(() => {
        const allTags = state.tags || [];
        const { trackTags, maxTracks } = calculateTagTracks(
          allTags,
          resizingTagState,
        );
        const { columns, frameXMap, totalWidth } = calculateColumns(
          state.frames.length,
          allTags,
          collapsedTagIds,
        );
        const tagStripHeight =
          allTags.length > 0 ? Math.max(28, maxTracks * 26 + 6) : 0;
        const totalHeaderHeight = tagStripHeight + 32; // Tag strip + 32px frame numbers

        return (
          <div className="flex flex-1 overflow-hidden">
            {/* Compact Layers Column (Left) */}
            <div
              onDragOver={handleLayerContainerDragOver}
              onDrop={handleLayerContainerDrop}
              style={{ paddingTop: `${totalHeaderHeight}px` }}
              className="w-48 bg-muted border-r border-border/30 flex flex-col overflow-y-auto overflow-x-hidden"
            >
              {(() => {
                const parentMap = getLayerParentMap(state.layers);
                const isCollapsed = (layer: any) => {
                  let curr = layer;
                  while (curr) {
                    const parent =
                      parentMap.get(curr.id) ||
                      (curr.parentId
                        ? state.layers.find((l) => l.id === curr?.parentId)
                        : undefined);
                    if (parent) {
                      if (parent.collapsed) return true;
                      curr = parent;
                    } else {
                      break;
                    }
                  }
                  return false;
                };

                return (
                  <>
                    {state.layers
                      .slice()
                      .reverse()
                      .map((layer) => {
                        if (isCollapsed(layer)) return null;

                        const isDragging =
                          dragState?.type === "layer" &&
                          dragState.id === layer.id;
                        const isOver =
                          dragState?.type === "layer" &&
                          dragState.overId === layer.id;
                        const isActive = state.activeLayerId === layer.id;
                        const isSelected = state.selectedLayerIds.includes(
                          layer.id,
                        );
                        const effectiveVis = isLayerVisible(
                          layer,
                          state.layers,
                          parentMap,
                        );
                        const childLevel = layer.childLevel ?? 0;
                        const isGroup = layer.type === "group";
                        const childCount = isGroup
                          ? getGroupChildCount(layer.id, state.layers)
                          : 0;

                        return (
                          <div
                            key={layer.id}
                            draggable
                            onDragStart={(e) =>
                              handleLayerDragStart(e, layer.id)
                            }
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
                            className={`h-8 flex items-center pr-1.5 gap-1 border-b border-border/20 cursor-pointer group relative transition-colors
                              ${isGroup ? "font-semibold text-foreground/90" : "text-foreground/80"}
                              ${isActive ? "bg-primary/15 font-semibold text-foreground border-b-primary/30" : isSelected ? "bg-secondary/60 text-foreground" : "hover:bg-accent/40 hover:text-foreground"}
                              ${isDragging ? "opacity-30" : ""}
                            `}
                            onClick={() => onSelectLayer(layer.id)}
                          >
                            {isOver && dragState.position === "before" && (
                              <div className="absolute top-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none rounded-full flex items-center shadow-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                              </div>
                            )}
                            {isOver && dragState.position === "after" && (
                              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-50 pointer-events-none rounded-full flex items-center shadow-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                              </div>
                            )}
                            {isOver && dragState.position === "inside" && (
                              <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded z-50 pointer-events-none flex items-center justify-end pr-2">
                                <span className="text-[8.5px] font-bold text-primary bg-background border border-primary/40 px-1 py-0.2 rounded shadow-2xs">
                                  Move Inside Group
                                </span>
                              </div>
                            )}
                            {isOver && dragState.position === "outside" && (
                              <div
                                className="absolute bottom-0 h-[2px] bg-primary z-50 pointer-events-none rounded-full flex items-center shadow-xs"
                                style={{
                                  left: `-${childLevel * 10}px`,
                                  right: 0,
                                }}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                                <span className="absolute right-1 bottom-1 text-[8.5px] font-bold text-primary bg-background border border-primary/40 px-1 py-0.2 rounded shadow-2xs">
                                  Move Outside Group
                                </span>
                              </div>
                            )}

                            {childLevel > 0 && (
                              <div className="absolute left-1 top-0 bottom-0 border-l border-border/40 pointer-events-none" />
                            )}

                            <div className="cursor-grab text-muted-foreground/40 hover:text-foreground shrink-0">
                              <GripVertical size={10} />
                            </div>

                            {isGroup ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onUpdateLayer) {
                                    onUpdateLayer(layer.id, {
                                      collapsed: !layer.collapsed,
                                    });
                                  }
                                }}
                                className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-all shrink-0 mr-0.5"
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerVisibility(layer.id);
                              }}
                              className={`p-0.5 shrink-0 transition-colors ${!layer.visible ? "text-muted-foreground/30" : !effectiveVis ? "text-muted-foreground/30" : isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
                              title={
                                layer.visible && !effectiveVis
                                  ? "Hidden by parent group"
                                  : undefined
                              }
                            >
                              {layer.visible && effectiveVis ? (
                                <Eye size={11} />
                              ) : (
                                <EyeOff size={11} />
                              )}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerLock(layer.id);
                              }}
                              className={`p-0.5 shrink-0 transition-colors ${!layer.locked ? "text-muted-foreground/30" : "text-primary"}`}
                            >
                              {layer.locked ? (
                                <Lock size={10} />
                              ) : (
                                <Unlock size={10} />
                              )}
                            </button>

                            {isGroup && (
                              <span className="text-muted-foreground group-hover:text-foreground shrink-0 mr-0.5 transition-colors">
                                {layer.collapsed ? (
                                  <Folder size={11} />
                                ) : (
                                  <FolderOpen size={11} />
                                )}
                              </span>
                            )}

                            <div className="flex-1 truncate flex items-center gap-1.5 min-w-0">
                              <span
                                className={`truncate text-[10.5px] ${isGroup ? "font-semibold text-foreground" : isActive ? "text-foreground font-semibold" : "text-foreground/80 group-hover:text-foreground transition-colors"}`}
                              >
                                {layer.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {dragState?.type === "layer" &&
                      dragState?.overId === "root-bottom" && (
                        <div className="h-[2px] bg-primary w-full my-1.5 rounded-full relative flex items-center shadow-xs shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary -ml-1" />
                        </div>
                      )}
                  </>
                );
              })()}
            </div>

            {/* Frames Grid (Right) */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  onDragOver={handleFrameContainerDragOver}
                  onDrop={handleFrameContainerDrop}
                  className="flex-1 overflow-x-auto bg-[#171717] relative custom-scrollbar"
                >
                  <div className="flex flex-col min-w-max relative">
                    {/* Insert Buttons Overlay */}
                    <div
                      className="absolute left-0 w-full h-8 pointer-events-none z-30"
                      style={{ top: `${tagStripHeight}px` }}
                    >
                      {Array.from({ length: state.frames.length + 1 }).map(
                        (_, i) => {
                          const isOver =
                            dragState?.type === "frame" &&
                            dragState.overId === `insert-${i}`;
                          const framePos = frameXMap[i] || { x: i * 40 };
                          return (
                            <div
                              key={`insert-${i}`}
                              onDragOver={(e) =>
                                handleInsertButtonDragOver(e, i)
                              }
                              onDrop={(e) => handleInsertButtonDrop(e, i)}
                              className="absolute top-0 bottom-0 w-4 -ml-2 pointer-events-auto group flex items-center justify-center cursor-pointer"
                              style={{ left: framePos.x }}
                            >
                              <div
                                className={`w-[2px] h-full bg-primary transition-opacity ${isOver ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => onInsertFrame(i)}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg hover:scale-125 transition-all"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Insert Frame
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Multi-Track Tag Strip */}
                    {allTags.length > 0 && (
                      <div
                        className="border-b border-border/30 bg-background/60 relative overflow-hidden transition-all cursor-default"
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
                          const isPopoverActive =
                            tagPopover?.isOpen && tagPopover.tag.id === tag.id;
                          const isTagSelected = selectedTagIds.has(tag.id);
                          const color = tag.color || "#3b82f6";
                          const transparentBg =
                            color.startsWith("#") && color.length === 7
                              ? `${color}50`
                              : color;

                          let leftX = startPos.x;
                          let widthX = 36;

                          if (!isCollapsed) {
                            const rightX = endPos.isHidden
                              ? endPos.x
                              : endPos.x + endPos.width;
                            widthX = Math.max(28, rightX - leftX);
                          }

                          const topY = tag.trackIndex * 26 + 3;
                          const legHeight = Math.max(
                            6,
                            tagStripHeight - topY - 23,
                          );
                          const renderTagDirectionIcon = () => {
                            switch (tag.direction) {
                              case "reverse":
                                return <ArrowLeft size={10} />;
                              case "ping-pong":
                                return <ArrowLeftRight size={10} />;
                              case "ping-pong-reverse":
                                return <ArrowRightLeft size={10} />;
                              case "forward":
                              default:
                                return <ArrowRight size={10} />;
                            }
                          };

                          return (
                            <ContextMenu key={tag.id}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className="absolute group/tag select-none overflow-visible"
                                  style={{
                                    left: `${leftX}px`,
                                    top: `${topY}px`,
                                    width: `${widthX}px`,
                                    height: "20px",
                                    zIndex: isTagSelected
                                      ? 40
                                      : isPopoverActive
                                        ? 30
                                        : 10,
                                  }}
                                >
                                  {/* Tag Header Badge - semi-transparent background, fits title snugly with fully rounded corners */}
                                  <div className="flex items-center gap-1 z-20">
                                    <Tooltip delayDuration={300}>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={`rounded-sm inline-flex items-center text-[10px] font-bold text-white shadow-xs transition-all cursor-default w-max max-w-[220px] h-[18px] px-1.5 gap-1 whitespace-nowrap ${
                                            isTagSelected
                                              ? "ring-2 ring-white scale-[1.01] shadow-md brightness-110"
                                              : isPopoverActive
                                                ? "ring-2 ring-amber-300"
                                                : ""
                                          }`}
                                          style={{
                                            backgroundColor: transparentBg,
                                          }}
                                          onMouseDown={(e) =>
                                            handleTagMouseDown(e, tag, "move")
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                          onDoubleClick={(e) =>
                                            handleOpenTagPopover(tag, e)
                                          }
                                          onContextMenu={(e) => {
                                            if (!selectedTagIds.has(tag.id)) {
                                              if (
                                                e.shiftKey ||
                                                e.ctrlKey ||
                                                e.metaKey
                                              ) {
                                                setSelectedTagIds((prev) =>
                                                  new Set(prev).add(tag.id),
                                                );
                                              } else {
                                                setSelectedTagIds(
                                                  new Set([tag.id]),
                                                );
                                              }
                                            }
                                          }}
                                        >
                                          {/* Tag Name & Direction Icon */}
                                          <div className="flex items-center gap-1 pointer-events-none shrink-0 truncate">
                                            <span className="font-bold whitespace-nowrap leading-none truncate">
                                              {tag.name}
                                            </span>
                                            {!isCollapsed &&
                                              tag.direction &&
                                              tag.direction !== "forward" && (
                                                <span
                                                  className="opacity-80 shrink-0 flex items-center justify-center"
                                                  title={`Direction: ${tag.direction}`}
                                                >
                                                  {renderTagDirectionIcon()}
                                                </span>
                                              )}
                                          </div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="text-xs bg-popover text-popover-foreground border border-border z-[100]"
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-bold text-primary">
                                            {tag.name}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground font-mono">
                                            Frames {tag.from + 1} – {tag.to + 1}{" "}
                                            ({tag.to - tag.from + 1}{" "}
                                            {tag.to - tag.from === 0
                                              ? "frame"
                                              : "frames"}
                                            )
                                          </span>
                                          {tag.direction &&
                                            tag.direction !== "forward" && (
                                              <span className="text-[10px] text-muted-foreground capitalize">
                                                Direction: {tag.direction}
                                              </span>
                                            )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>

                                    {/* Collapse / Expand button placed outside the label */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCollapseTag(tag.id, e);
                                      }}
                                      className="opacity-0 group-hover/tag:opacity-100 transition-opacity duration-150 p-0.5 bg-background/80 hover:bg-background border border-border/60 text-muted-foreground hover:text-foreground rounded shadow-xs cursor-pointer shrink-0 z-30"
                                      title={
                                        isCollapsed
                                          ? "Expand tag frames"
                                          : "Collapse tag frames"
                                      }
                                    >
                                      {isCollapsed ? (
                                        <ChevronsLeftRight size={10} />
                                      ) : (
                                        <ChevronsRightLeft size={10} />
                                      )}
                                    </button>
                                  </div>

                                  {/* Left Resize Handle - highlights left bracket leg on hover */}
                                  {!isCollapsed && (
                                    <div
                                      className="absolute -left-1 top-[19px] w-2.5 cursor-ew-resize z-30 group/lh opacity-0 group-hover/tag:opacity-100 flex items-center justify-center"
                                      style={{ height: `${legHeight}px` }}
                                      title="Drag to resize tag start"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleTagMouseDown(
                                          e,
                                          tag,
                                          "resize-left",
                                        );
                                      }}
                                    >
                                      <div className="w-[3px] h-full bg-white opacity-0 group-hover/lh:opacity-100 transition-opacity rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                                    </div>
                                  )}

                                  {/* Right Resize Handle - highlights right bracket leg on hover */}
                                  {!isCollapsed && (
                                    <div
                                      className="absolute top-[19px] w-2.5 cursor-ew-resize z-30 group/rh opacity-0 group-hover/tag:opacity-100 flex items-center justify-center"
                                      style={{
                                        left: `${Math.max(0, widthX - 8)}px`,
                                        height: `${legHeight}px`,
                                      }}
                                      title="Drag to resize tag end"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleTagMouseDown(
                                          e,
                                          tag,
                                          "resize-right",
                                        );
                                      }}
                                    >
                                      <div className="w-[3px] h-full bg-white opacity-0 group-hover/rh:opacity-100 transition-opacity rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                                    </div>
                                  )}

                                  {/* Smoothly rounded Aseprite-style bracket line & legs */}
                                  {(() => {
                                    const r = Math.min(
                                      5,
                                      Math.max(1, (widthX - 2) / 2),
                                    );
                                    const xRight = Math.max(2, widthX - 1);
                                    return (
                                      <svg
                                        className="absolute top-[19px] left-0 pointer-events-none z-20 overflow-visible"
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
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                {selectedTagIds.size <= 1 ? (
                                  <>
                                    <ContextMenuItem
                                      onClick={(e) =>
                                        handleOpenTagPopover(tag, e)
                                      }
                                    >
                                      Edit Tag Properties...
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => toggleCollapseTag(tag.id)}
                                    >
                                      {isCollapsed
                                        ? "Expand / Unfold Frames (+)"
                                        : "Collapse / Fold Frames (-)"}
                                    </ContextMenuItem>
                                    {onSaveTag && (
                                      <ContextMenuItem
                                        onClick={() => {
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
                                          onClick={() => {
                                            onDeleteTag(tag.id);
                                            setSelectedTagIds((prev) => {
                                              const next = new Set(prev);
                                              next.delete(tag.id);
                                              return next;
                                            });
                                            if (tagPopover?.tag.id === tag.id)
                                              handleCloseTagPopover();
                                          }}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          Delete Tag
                                        </ContextMenuItem>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <ContextMenuItem
                                      onClick={() => {
                                        const allCollapsed = Array.from(
                                          selectedTagIds,
                                        ).every((id) =>
                                          collapsedTagIds.has(id),
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
                                      {Array.from(selectedTagIds).every((id) =>
                                        collapsedTagIds.has(id),
                                      )
                                        ? `Expand Frames (${selectedTagIds.size} Tags)`
                                        : `Collapse Frames (${selectedTagIds.size} Tags)`}
                                    </ContextMenuItem>
                                    {onSaveTag && (
                                      <ContextMenuItem
                                        onClick={() => {
                                          const allTagsList = state.tags || [];
                                          selectedTagIds.forEach((id) => {
                                            const t = allTagsList.find(
                                              (x) => x.id === id,
                                            );
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
                                        Duplicate Selected Tags (
                                        {selectedTagIds.size})
                                      </ContextMenuItem>
                                    )}
                                    {onDeleteTag && (
                                      <>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                          onClick={() => {
                                            selectedTagIds.forEach((id) =>
                                              onDeleteTag(id),
                                            );
                                            setSelectedTagIds(new Set());
                                            if (
                                              tagPopover &&
                                              selectedTagIds.has(
                                                tagPopover.tag.id,
                                              )
                                            )
                                              handleCloseTagPopover();
                                          }}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          Delete Selected Tags (
                                          {selectedTagIds.size})
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

                    {/* Header Row for Frame Numbers */}
                    <div
                      className="flex h-8 border-b border-border/30 bg-muted"
                      style={{ width: `${totalWidth}px` }}
                    >
                      {columns.map((col) => {
                        if (col.type === "collapsed") {
                          return (
                            <div
                              key={`col-collapsed-${col.tag.id}`}
                              onClick={(e) => toggleCollapseTag(col.tag.id, e)}
                              className="w-[36px] border-r border-border/40 bg-zinc-900/90 hover:bg-zinc-800 text-amber-400 flex flex-col items-center justify-center cursor-pointer transition-colors relative group shrink-0"
                              title={`Tag "${col.tag.name}" collapsed (${col.count} frames hidden). Click to expand.`}
                            >
                              <span className="text-[9px] font-mono font-bold leading-none">
                                {col.count}
                              </span>
                              <span className="text-[7px] text-muted-foreground uppercase font-semibold scale-90">
                                fold
                              </span>
                            </div>
                          );
                        }

                        const idx = col.frameIndex;
                        const frame = state.frames[idx];
                        const isDragging =
                          dragState?.type === "frame" &&
                          dragState.id === idx.toString();
                        const isOver =
                          dragState?.type === "frame" &&
                          dragState.overId === idx.toString();
                        const isActive = state.activeFrameIndex === idx;
                        const isSelected =
                          state.selectedFrameIndices.includes(idx);
                        const currentDuration = frame?.duration || 100;

                        return (
                          <ContextMenu key={idx}>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable
                                onDragStart={(e) =>
                                  handleFrameDragStart(e, idx)
                                }
                                onDragOver={(e) => {
                                  e.stopPropagation();
                                  handleFrameDragOver(e, idx);
                                }}
                                onDrop={(e) => {
                                  e.stopPropagation();
                                  handleFrameDrop(e, idx);
                                }}
                                onDragEnd={() => setDragState(null)}
                                onClick={(e) => handleFrameClick(e, idx)}
                                className={`min-w-[40px] w-10 border-r border-border/30 flex items-center justify-center text-[10px] cursor-pointer hover:bg-secondary/30 relative shrink-0
                                    ${isActive ? "bg-secondary/60 text-primary font-extrabold shadow-[inset_0_-2px_0_var(--primary)]" : isSelected ? "bg-secondary/40 text-foreground font-bold" : "text-foreground/80 hover:text-foreground font-semibold"}
                                    ${isDragging ? "opacity-30" : ""}
                                    `}
                              >
                                {isOver && dragState.position === "before" && (
                                  <div className="absolute top-0 left-0 h-full w-[2px] bg-primary z-50 pointer-events-none" />
                                )}
                                {isOver && dragState.position === "after" && (
                                  <div className="absolute top-0 right-0 h-full w-[2px] bg-primary z-50 pointer-events-none" />
                                )}
                                {idx + 1}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={() => {
                                  onSelectFrames([idx], idx);
                                  onDuplicateFrame();
                                }}
                              >
                                Duplicate
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => onInsertFrame(idx)}
                              >
                                Insert Before
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => onInsertFrame(idx + 1)}
                              >
                                Insert After
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => {
                                  const val = prompt(
                                    "Enter frame duration (ms):",
                                    currentDuration.toString(),
                                  );
                                  if (val) {
                                    const parsed = parseInt(val, 10);
                                    if (
                                      !isNaN(parsed) &&
                                      parsed > 0 &&
                                      onSetFrameDuration
                                    ) {
                                      onSetFrameDuration(idx, parsed);
                                    }
                                  }
                                }}
                              >
                                Set Duration ({currentDuration}ms)...
                              </ContextMenuItem>
                              {onOpenTagProperties && (
                                <ContextMenuItem
                                  onClick={() => {
                                    const from =
                                      state.selectedFrameIndices.length > 0
                                        ? Math.min(
                                            ...state.selectedFrameIndices,
                                          )
                                        : idx;
                                    const to =
                                      state.selectedFrameIndices.length > 0
                                        ? Math.max(
                                            ...state.selectedFrameIndices,
                                          )
                                        : idx;
                                    onOpenTagProperties({
                                      id: `tag_${Date.now()}`,
                                      name: "New Tag",
                                      from,
                                      to,
                                      color: "#3b82f6",
                                      direction: "forward",
                                    });
                                  }}
                                >
                                  Create Tag from Selection...
                                </ContextMenuItem>
                              )}
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => {
                                  onSelectFrames([idx], idx);
                                  onDeleteFrame();
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>

                    {/* Frame Cells */}
                    <div className="flex flex-col">
                      {(() => {
                        const parentMap = getLayerParentMap(state.layers);
                        const isCollapsed = (layer: any) => {
                          let curr = layer;
                          while (curr) {
                            const parent =
                              parentMap.get(curr.id) ||
                              (curr.parentId
                                ? state.layers.find(
                                    (l) => l.id === curr?.parentId,
                                  )
                                : undefined);
                            if (parent) {
                              if (parent.collapsed) return true;
                              curr = parent;
                            } else {
                              break;
                            }
                          }
                          return false;
                        };

                        return state.layers
                          .slice()
                          .reverse()
                          .map((layer) => {
                            if (isCollapsed(layer)) return null;

                            return (
                              <div
                                key={layer.id}
                                className="flex h-8 border-b border-border/20"
                                style={{ width: `${totalWidth}px` }}
                              >
                                {columns.map((col) => {
                                  if (col.type === "collapsed") {
                                    return (
                                      <div
                                        key={`cell-collapsed-${layer.id}-${col.tag.id}`}
                                        onClick={(e) =>
                                          toggleCollapseTag(col.tag.id, e)
                                        }
                                        className="w-[36px] border-r border-border/30 bg-zinc-950/60 hover:bg-zinc-900/80 flex items-center justify-center cursor-pointer group shrink-0"
                                        title={`Collapsed tag "${col.tag.name}" (${col.count} frames). Click to expand.`}
                                      >
                                        <div className="w-1.5 h-full border-x border-dashed border-amber-500/30 group-hover:border-amber-400/60" />
                                      </div>
                                    );
                                  }

                                  const frameIdx = col.frameIndex;
                                  const frame = state.frames[frameIdx];
                                  const hasContent = frame?.layerData[
                                    layer.id
                                  ]?.some((p) => p !== null);
                                  const isActive =
                                    state.activeFrameIndex === frameIdx &&
                                    state.activeLayerId === layer.id;
                                  const isFrameSelected =
                                    state.selectedFrameIndices.includes(
                                      frameIdx,
                                    );
                                  const isLayerSelected =
                                    state.selectedLayerIds.includes(layer.id);

                                  return (
                                    <div
                                      key={`${layer.id}-${frameIdx}`}
                                      onClick={(e) => {
                                        handleFrameClick(e, frameIdx, layer.id);
                                      }}
                                      className={`min-w-[40px] w-10 border-r border-border/20 flex items-center justify-center cursor-pointer relative transition-colors shrink-0
                                     ${isActive ? "bg-primary/10" : isFrameSelected || isLayerSelected ? "bg-secondary/10" : "hover:bg-white/[0.02]"}
                                  `}
                                    >
                                      {hasContent && (
                                        <div
                                          className={`w-2.5 h-2.5 rounded-full transition-transform ${isActive ? "bg-primary scale-110 shadow-[0_0_8px_rgba(var(--primary),0.5)]" : isFrameSelected || isLayerSelected ? "bg-foreground/80" : "bg-muted-foreground/60"}`}
                                        ></div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={onAddFrame}>
                  New Frame
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        );
      })()}
    </div>
  );
};
