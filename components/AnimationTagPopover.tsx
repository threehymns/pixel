import React, { useState, useEffect, useRef } from 'react';
import { FrameTag, Frame } from '../types';
import {
  Trash2,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  InfinityIcon,
} from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { PopoverArrow } from './ui/popover';
import { Input } from './ui/input';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { cn } from '../lib/utils';

export const TAG_PRESET_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
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
  const safeTo = Math.max(
    safeFrom,
    Math.min(safeTotal - 1, isNaN(tag.to) ? safeTotal - 1 : tag.to)
  );

  let durationMs = 0;
  for (let i = safeFrom; i <= safeTo; i++) {
    durationMs += frames[i]?.duration || 100;
  }

  const updateAndSave = (partialTag: Partial<FrameTag>, newRepeatMode?: 'infinite' | 'custom') => {
    const nextTag = { ...tag, ...partialTag };
    const nextRepeatMode = newRepeatMode !== undefined ? newRepeatMode : repeatMode;

    const rFrom = Math.max(0, Math.min(safeTotal - 1, isNaN(nextTag.from) ? 0 : nextTag.from));
    const rTo = Math.max(
      rFrom,
      Math.min(safeTotal - 1, isNaN(nextTag.to) ? safeTotal - 1 : nextTag.to)
    );

    const finalTag: FrameTag = {
      ...nextTag,
      from: rFrom,
      to: rTo,
      name: nextTag.name,
      color: nextTag.color || '#3b82f6',
      direction: nextTag.direction || 'forward',
      repeat: nextRepeatMode === 'infinite' ? 0 : (nextTag.repeat ?? 1),
    };
    setTag(finalTag);
    onSave(finalTag);
  };

  const directions = [
    { id: 'forward', fullLabel: 'Forward', icon: ArrowRight },
    { id: 'reverse', fullLabel: 'Reverse', icon: ArrowLeft },
    { id: 'ping-pong', fullLabel: 'Ping-Pong', icon: ArrowLeftRight },
    { id: 'ping-pong-reverse', fullLabel: 'Reverse Ping-Pong', icon: ArrowRightLeft },
  ] as const;

  return (
    <div
      className="relative flex w-64 flex-col gap-3 text-xs text-popover-foreground outline-none select-none"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <PopoverArrow />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Name</label>
          <Input
            type="text"
            value={tag.name}
            onChange={(e) => updateAndSave({ name: e.target.value })}
            placeholder="e.g. Idle, Walk"
            autoFocus
            className="h-7"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Color</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {TAG_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Tag color ${c}`}
                onClick={() => updateAndSave({ color: c })}
                className={cn(
                  'h-4 w-4 rounded-full border transition-transform',
                  tag.color === c
                    ? 'scale-110 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-popover'
                    : 'border-border-strong hover:scale-105'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <label
              className="relative flex h-4 w-4 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong text-[11px] text-muted-foreground hover:border-foreground"
              title="Custom color"
            >
              <input
                type="color"
                value={tag.color || '#3b82f6'}
                onChange={(e) => updateAndSave({ color: e.target.value })}
                aria-label="Custom tag color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              +
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Frames</span>
          <div className="flex w-full items-center gap-1.5">
            <Input
              type="number"
              min={1}
              max={safeTotal}
              aria-label="Start frame"
              value={isNaN(tag.from) ? '' : tag.from + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateAndSave({ from: val - 1 });
                }
              }}
              className="h-7 w-14 px-1.5 text-center font-mono tabular-nums"
            />
            <span className="text-[11px] text-muted-foreground">to</span>
            <Input
              type="number"
              min={1}
              max={safeTotal}
              aria-label="End frame"
              value={isNaN(tag.to) ? '' : tag.to + 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateAndSave({ to: val - 1 });
                }
              }}
              className="h-7 w-14 px-1.5 text-center font-mono tabular-nums"
            />
            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
              {durationMs}ms
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Direction</span>
          <SegmentedControl<NonNullable<FrameTag['direction']>>
            value={tag.direction || 'forward'}
            onValueChange={(next) =>
              next && updateAndSave({ direction: next as NonNullable<FrameTag['direction']> })
            }
            aria-label="Tag playback direction"
          >
            <SegmentedControlIndicator />
            {directions.map((dir) => {
              const Icon = dir.icon;
              return (
                <Tooltip key={dir.id}>
                  <TooltipTrigger
                    render={
                      <SegmentedControlItem value={dir.id} aria-label={dir.fullLabel}>
                        <Icon size={12} />
                      </SegmentedControlItem>
                    }
                  />
                  <TooltipContent side="top">{dir.fullLabel}</TooltipContent>
                </Tooltip>
              );
            })}
          </SegmentedControl>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Repeat</span>
          <div className="flex w-full items-center gap-1.5">
            <SegmentedControl<'infinite' | 'custom'>
              value={repeatMode}
              onValueChange={(next) => {
                if (!next) return;
                const mode = next as 'infinite' | 'custom';
                setRepeatMode(mode);
                if (mode === 'infinite') {
                  updateAndSave({ repeat: 0 }, 'infinite');
                } else {
                  const newRepeat = (tag.repeat ?? 0) === 0 ? 1 : tag.repeat;
                  updateAndSave({ repeat: newRepeat }, 'custom');
                }
              }}
              className="flex-1"
              aria-label="Tag repeat mode"
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="infinite">
                <InfinityIcon size={11} />
                <span>Loop</span>
              </SegmentedControlItem>
              <SegmentedControlItem value="custom">Count</SegmentedControlItem>
            </SegmentedControl>

            {repeatMode === 'custom' && (
              <Input
                type="number"
                min={1}
                aria-label="Repeat count"
                value={isNaN(tag.repeat ?? 1) ? '' : tag.repeat}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateAndSave({ repeat: isNaN(val) ? 1 : Math.max(1, val) }, 'custom');
                }}
                className="h-7 w-12 px-1 text-center font-mono tabular-nums"
              />
            )}
          </div>
        </div>
      </div>

      {!isNew && onDelete && (
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
          <button
            type="button"
            onClick={() => {
              isDeletingRef.current = true;
              onDelete(tag.id);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
          >
            <Trash2 size={13} />
            <span>Delete Tag</span>
          </button>
        </div>
      )}
    </div>
  );
};
