import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    setTag({ ...initialTag });
    setRepeatMode((initialTag.repeat ?? 0) === 0 ? 'infinite' : 'custom');
  }, [initialTag]);

  const safeTotal = Math.max(1, totalFrames);
  const safeFrom = Math.max(0, Math.min(safeTotal - 1, isNaN(tag.from) ? 0 : tag.from));
  const safeTo = Math.max(safeFrom, Math.min(safeTotal - 1, isNaN(tag.to) ? safeTotal - 1 : tag.to));
  const frameCount = safeTo - safeFrom + 1;

  // Calculate total duration in milliseconds
  let durationMs = 0;
  for (let i = safeFrom; i <= safeTo; i++) {
    durationMs += frames[i]?.duration || 100;
  }

  const handleSave = () => {
    const finalTag: FrameTag = {
      ...tag,
      from: safeFrom,
      to: safeTo,
      name: tag.name.trim() || 'Tag',
      color: tag.color || '#3b82f6',
      direction: tag.direction || 'forward',
      repeat: repeatMode === 'infinite' ? 0 : (tag.repeat ?? 1),
    };
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
      className="w-72 bg-popover text-popover-foreground border border-border shadow-xl rounded-lg p-3 flex flex-col gap-3 text-xs select-none outline-none"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <div
            className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 shrink-0"
            style={{ backgroundColor: tag.color || '#3b82f6' }}
          />
          <span>{isNew ? 'New Tag' : 'Tag Properties'}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Form Fields Table */}
      <div className="flex flex-col gap-2.5">
        {/* Name */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Name</label>
          <input
            type="text"
            value={tag.name}
            onChange={(e) => setTag({ ...tag, name: e.target.value })}
            placeholder="e.g. Idle, Walk"
            autoFocus
            className="col-span-2 bg-background border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Color Swatches */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Color</label>
          <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
            {TAG_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTag({ ...tag, color: c })}
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
                onChange={(e) => setTag({ ...tag, color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span className="text-[9px] text-muted-foreground font-bold leading-none">+</span>
            </label>
          </div>
        </div>

        {/* Frame Range & Duration */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Frames</label>
          <div className="col-span-2 flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max={safeTotal}
              value={isNaN(tag.from) ? '' : tag.from + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setTag({
                    ...tag,
                    from: Math.max(0, Math.min(safeTotal - 1, val - 1)),
                  });
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
                  setTag({
                    ...tag,
                    to: Math.max(0, Math.min(safeTotal - 1, val - 1)),
                  });
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
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Direction</label>
          <div className="col-span-2 grid grid-cols-4 gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50">
            {directions.map((dir) => {
              const isActive = (tag.direction || 'forward') === dir.id;
              const Icon = dir.icon;
              return (
                <Tooltip key={dir.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setTag({ ...tag, direction: dir.id })}
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
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Repeat</label>
          <div className="col-span-2 flex items-center gap-1.5">
            <div className="flex-1 flex items-center bg-muted/60 p-0.5 rounded-md border border-border/50">
              <button
                type="button"
                onClick={() => {
                  setRepeatMode('infinite');
                  setTag({ ...tag, repeat: 0 });
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
                  if ((tag.repeat ?? 0) === 0) setTag({ ...tag, repeat: 1 });
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
                  setTag({ ...tag, repeat: isNaN(val) ? 1 : Math.max(1, val) });
                }}
                className="w-12 bg-background border border-border rounded-md px-1 py-0.5 text-xs font-mono font-medium text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-1">
        {!isNew && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(tag.id)}
            className="flex items-center gap-1 text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors font-medium text-xs"
            title="Delete tag"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground font-medium rounded-md shadow-xs hover:bg-primary/90 transition-colors text-xs"
          >
            <Check size={13} />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
