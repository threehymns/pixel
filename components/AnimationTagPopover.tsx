import React, { useState, useEffect, useRef } from 'react';
import { FrameTag, Frame } from '../types';
import {
  Tag,
  X,
  Check,
  Trash2,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { PopoverArrow } from './ui/popover';

export const TAG_PRESET_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export interface AnimationTagPopoverProps {
  isOpen: boolean;
  tag: FrameTag;
  isNew: boolean;
  totalFrames: number;
  frames: Frame[];
  onSave: (updatedTag: FrameTag) => void;
  onClose: () => void;
  onDelete?: (tagId: string) => void;
}

export const AnimationTagPopover: React.FC<AnimationTagPopoverProps> = ({
  tag: initialTag,
  isNew,
  totalFrames,
  frames,
  onSave,
  onClose,
  onDelete,
}) => {
  const [tag, setTag] = useState<FrameTag>({ ...initialTag });
  const [repeatMode, setRepeatMode] = useState<'infinite' | 'custom'>(() => {
    return (initialTag.repeat ?? 0) === 0 ? 'infinite' : 'custom';
  });

  const tagRef = useRef(tag);
  tagRef.current = tag;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const isDeletingRef = useRef(false);

  useEffect(() => {
    setTag({ ...initialTag });
    setRepeatMode((initialTag.repeat ?? 0) === 0 ? 'infinite' : 'custom');
  }, [initialTag]);

  // When the popover is closed / unmounted, ensure a blank name falls back to 'Tag'
  useEffect(() => {
    return () => {
      if (isDeletingRef.current) return;
      const currentTag = tagRef.current;
      if (!currentTag.name.trim()) {
        onSaveRef.current({
          ...currentTag,
          name: 'Tag',
        });
      }
    };
  }, []);

  const safeTotal = Math.max(1, totalFrames);
  const safeFrom = Math.max(0, Math.min(safeTotal - 1, isNaN(tag.from) ? 0 : tag.from));
  const safeTo = Math.max(safeFrom, Math.min(safeTotal - 1, isNaN(tag.to) ? safeTotal - 1 : tag.to));
  const frameCount = safeTo - safeFrom + 1;

  // Calculate total duration in milliseconds
  let durationMs = 0;
  for (let i = safeFrom; i <= safeTo; i++) {
    durationMs += frames[i]?.duration || 100;
  }

  const updateAndSave = (partialTag: Partial<FrameTag>, newRepeatMode?: 'infinite' | 'custom') => {
    const nextTag = { ...tag, ...partialTag };
    const nextRepeatMode = newRepeatMode !== undefined ? newRepeatMode : repeatMode;
    
    const rFrom = Math.max(0, Math.min(safeTotal - 1, isNaN(nextTag.from) ? 0 : nextTag.from));
    const rTo = Math.max(rFrom, Math.min(safeTotal - 1, isNaN(nextTag.to) ? safeTotal - 1 : nextTag.to));
    
    const finalTag: FrameTag = {
      ...nextTag,
      from: rFrom,
      to: rTo,
      name: nextTag.name, // Keep exactly what they are typing, including empty string
      color: nextTag.color || '#3b82f6',
      direction: nextTag.direction || 'forward',
      repeat: nextRepeatMode === 'infinite' ? 0 : (nextTag.repeat ?? 1),
    };
    setTag(finalTag);
    onSave(finalTag);
  };

  const directions = [
    { id: 'forward', label: 'Fwd', fullLabel: 'Forward', icon: ArrowRight },
    { id: 'reverse', label: 'Rev', fullLabel: 'Reverse', icon: ArrowLeft },
    { id: 'ping-pong', label: 'Ping-Pong', fullLabel: 'Ping-Pong', icon: ArrowLeftRight },
    { id: 'ping-pong-reverse', label: 'Rev P.P.', fullLabel: 'Reverse Ping-Pong', icon: ArrowRightLeft },
  ] as const;

  return (
    <div
      className="w-60 bg-popover text-popover-foreground border border-border shadow-xl rounded-lg p-3 flex flex-col gap-3 text-xs select-none outline-none relative"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <PopoverArrow />
      {/* Form Fields Table */}
      <div className="flex flex-col gap-3">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Name</label>
          <input
            type="text"
            value={tag.name}
            onChange={(e) => updateAndSave({ name: e.target.value })}
            placeholder="e.g. Idle, Walk"
            autoFocus
            className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Color Swatches */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Color</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TAG_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateAndSave({ color: c })}
                className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                  tag.color === c
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-popover scale-110 border-white'
                    : 'border-black/10 dark:border-white/10 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <label className="w-4 h-4 rounded-full border border-dashed border-border hover:border-foreground flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden" title="Custom color">
              <input
                type="color"
                value={tag.color || '#3b82f6'}
                onChange={(e) => updateAndSave({ color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span className="text-[9px] text-muted-foreground font-bold leading-none">+</span>
            </label>
          </div>
        </div>

        {/* Frame Range & Duration */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Frames</label>
          <div className="flex items-center gap-1.5 w-full">
            <input
              type="number"
              min="1"
              max={safeTotal}
              value={isNaN(tag.from) ? '' : tag.from + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateAndSave({ from: val - 1 });
                }
              }}
              className="w-14 bg-background border border-border rounded-md px-1.5 py-1 text-xs font-mono font-medium text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <span className="text-muted-foreground text-[10px]">to</span>
            <input
              type="number"
              min="1"
              max={safeTotal}
              value={isNaN(tag.to) ? '' : tag.to + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateAndSave({ to: val - 1 });
                }
              }}
              className="w-14 bg-background border border-border rounded-md px-1.5 py-1 text-xs font-mono font-medium text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <span className="text-[10px] font-mono text-muted-foreground/80 shrink-0 ml-auto">
              {durationMs}ms
            </span>
          </div>
        </div>

        {/* Direction Segmented Control */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Direction</label>
          <div className="grid grid-cols-4 gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50 w-full">
            {directions.map((dir) => {
              const isActive = (tag.direction || 'forward') === dir.id;
              const Icon = dir.icon;
              return (
                <Tooltip key={dir.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => updateAndSave({ direction: dir.id })}
                      className={`py-1 rounded flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px] bg-popover text-popover-foreground border border-border">
                    {dir.fullLabel}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Repeats / Loop */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Repeat</label>
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 flex items-center bg-muted/60 p-0.5 rounded-md border border-border/50">
              <button
                type="button"
                onClick={() => {
                  setRepeatMode('infinite');
                  updateAndSave({ repeat: 0 }, 'infinite');
                }}
                className={`flex-1 py-0.5 px-1.5 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                  repeatMode === 'infinite'
                    ? 'bg-background text-foreground shadow-xs border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <InfinityIcon size={11} />
                <span>Loop</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepeatMode('custom');
                  const newRepeat = (tag.repeat ?? 0) === 0 ? 1 : tag.repeat;
                  updateAndSave({ repeat: newRepeat }, 'custom');
                }}
                className={`flex-1 py-0.5 px-1.5 rounded text-[11px] font-medium transition-colors text-center ${
                  repeatMode === 'custom'
                    ? 'bg-background text-foreground shadow-xs border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Count
              </button>
            </div>

            {repeatMode === 'custom' && (
              <input
                type="number"
                min="1"
                value={isNaN(tag.repeat ?? 1) ? '' : tag.repeat}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateAndSave({ repeat: isNaN(val) ? 1 : Math.max(1, val) }, 'custom');
                }}
                className="w-12 bg-background border border-border rounded-md px-1 py-0.5 text-xs font-mono font-medium text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {!isNew && onDelete && (
        <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-1">
          <button
            type="button"
            onClick={() => {
              isDeletingRef.current = true;
              onDelete(tag.id);
            }}
            className="flex items-center gap-1 text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors font-medium text-xs"
            title="Delete tag"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
};
