import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { FrameTag, Frame } from '../types';
import { ENTITY_COLOR_TAGS } from '../constants';
import {
  Trash2,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  InfinityIcon,
  Check,
} from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { PopoverArrow } from './ui/popover';
import { ModalShell } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import { ColorSwatchField } from './ui/color-picker';
import { studioConfirm } from './ui/alert-dialog';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { cn } from '../lib/utils';

export const TAG_PRESET_COLORS = ENTITY_COLOR_TAGS.map((t) => t.hex);

export interface AnimationTagPopoverProps {
  isOpen: boolean;
  tag: FrameTag;
  isNew: boolean;
  totalFrames: number;
  frames: Frame[];
  onSave: (updatedTag: FrameTag) => void;
  onClose: () => void;
  onDelete?: (tagId: string) => void;
  onPreviewTag?: (previewTag: FrameTag) => void;
  onRevertPreview?: (snapshotTag: FrameTag | null) => void;
  showArrow?: boolean;
}

export const AnimationTagPopover: React.FC<AnimationTagPopoverProps> = ({
  isOpen,
  tag: initialTag,
  isNew,
  totalFrames,
  frames,
  onSave,
  onClose,
  onDelete,
  onPreviewTag,
  onRevertPreview,
  showArrow = true,
}) => {
  const [tag, setTag] = useState<FrameTag>({ ...initialTag });
  const [repeatMode, setRepeatMode] = useState<'infinite' | 'custom'>(() =>
    (initialTag.repeat ?? 0) === 0 ? 'infinite' : 'custom'
  );

  const snapshotRef = useRef<FrameTag | null>(isNew ? null : { ...initialTag });
  const isCommittedRef = useRef(false);
  const hasPreviewedRef = useRef(false);
  const onPreviewRef = useRef(onPreviewTag);
  const onRevertRef = useRef(onRevertPreview);

  useLayoutEffect(() => {
    onPreviewRef.current = onPreviewTag;
    onRevertRef.current = onRevertPreview;
  });

  useEffect(() => {
    if (!isOpen) return;
    snapshotRef.current = isNew ? null : { ...initialTag };
    isCommittedRef.current = false;
    hasPreviewedRef.current = false;
    setTag({ ...initialTag });
    setRepeatMode((initialTag.repeat ?? 0) === 0 ? 'infinite' : 'custom');
  }, [isOpen, initialTag.id, isNew]);

  useEffect(() => {
    return () => {
      if (!isCommittedRef.current && hasPreviewedRef.current) {
        onRevertRef.current?.(snapshotRef.current);
      }
    };
  }, []);

  const safeTotal = Math.max(1, totalFrames);
  const safeFrom = Math.max(0, Math.min(safeTotal - 1, Number.isFinite(tag.from) ? tag.from : 0));
  const safeTo = Math.max(
    safeFrom,
    Math.min(safeTotal - 1, Number.isFinite(tag.to) ? tag.to : safeTotal - 1)
  );

  let durationMs = 0;
  for (let i = safeFrom; i <= safeTo; i++) {
    durationMs += frames[i]?.duration || 100;
  }

  const normalizeTag = (next: FrameTag, mode: 'infinite' | 'custom'): FrameTag => {
    const rFrom = Math.max(0, Math.min(safeTotal - 1, Number.isFinite(next.from) ? next.from : 0));
    const rTo = Math.max(
      rFrom,
      Math.min(safeTotal - 1, Number.isFinite(next.to) ? next.to : safeTotal - 1)
    );
    return {
      ...next,
      from: rFrom,
      to: rTo,
      name: next.name,
      color: next.color || '#3b82f6',
      direction: next.direction || 'forward',
      repeat: mode === 'infinite' ? 0 : Math.max(1, next.repeat || 1),
    };
  };

  const updateDraft = (patch: Partial<FrameTag>, nextMode?: 'infinite' | 'custom') => {
    const resolvedMode = nextMode ?? repeatMode;
    const normalized = normalizeTag({ ...tag, ...patch }, resolvedMode);
    setTag(normalized);
    if (onPreviewRef.current && !isNew) {
      hasPreviewedRef.current = true;
      onPreviewRef.current(normalized);
    }
  };

  const handleCancel = () => {
    if (!isCommittedRef.current && hasPreviewedRef.current) {
      onRevertRef.current?.(snapshotRef.current);
      hasPreviewedRef.current = false;
    }
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    isCommittedRef.current = true;
    hasPreviewedRef.current = false;
    const finalTag = normalizeTag(
      { ...tag, name: tag.name.trim() || 'Animation' },
      repeatMode
    );
    onSave(finalTag);
    onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = await studioConfirm({
      title: `Delete "${tag.name.trim() || 'Animation'}" tag?`,
      description: 'The animation tag range will be removed. Your frames will remain untouched.',
      confirmLabel: 'Delete Tag',
      destructive: true,
    });
    if (confirmed) {
      isCommittedRef.current = true;
      hasPreviewedRef.current = false;
      onDelete(tag.id);
      onClose();
    }
  };

  const directions = [
    { id: 'forward', fullLabel: 'Forward', icon: ArrowRight },
    { id: 'reverse', fullLabel: 'Reverse', icon: ArrowLeft },
    { id: 'ping-pong', fullLabel: 'Ping-Pong', icon: ArrowLeftRight },
    { id: 'ping-pong-reverse', fullLabel: 'Reverse Ping-Pong', icon: ArrowRightLeft },
  ] as const;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'relative flex flex-col gap-3 text-xs text-popover-foreground outline-none select-none',
        showArrow ? 'w-72 max-w-[calc(100vw-2rem)]' : 'w-full'
      )}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && showArrow) {
          e.preventDefault();
          handleCancel();
        }
      }}
    >
      {showArrow && <PopoverArrow />}

      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="anim-tag-name">Name</FieldLabel>
          <Input
            id="anim-tag-name"
            type="text"
            value={tag.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="e.g. Idle, Walk, Jump"
            autoFocus
            className="h-8"
          />
        </Field>

        <Field>
          <FieldLabel>Color</FieldLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {TAG_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Tag color ${c}`}
                  aria-pressed={tag.color.toLowerCase() === c.toLowerCase()}
                  onClick={() => updateDraft({ color: c })}
                  className={cn(
                    'h-4 w-4 rounded-full border transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tag.color.toLowerCase() === c.toLowerCase()
                      ? 'scale-110 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-popover'
                      : 'border-border-strong hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <ColorSwatchField
              value={tag.color || '#3b82f6'}
              onChange={(hex) => updateDraft({ color: hex })}
              presets={TAG_PRESET_COLORS}
              label="Custom tag color"
              className="h-7 shrink-0 px-1.5 text-[11px]"
            />
          </div>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel>Frames</FieldLabel>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {safeTo - safeFrom + 1}f · {durationMs}ms
            </span>
          </div>
          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
            <StudioNumberInput
              value={safeFrom + 1}
              onValueChange={(val) => updateDraft({ from: val - 1 })}
              min={1}
              max={safeTotal}
              prefix="From"
              aria-label="Start frame"
              inputClassName="px-1.5 text-right"
            />
            <span className="shrink-0 text-[11px] text-muted-foreground">–</span>
            <StudioNumberInput
              value={safeTo + 1}
              onValueChange={(val) => updateDraft({ to: val - 1 })}
              min={1}
              max={safeTotal}
              prefix="To"
              aria-label="End frame"
              inputClassName="px-1.5 text-right"
            />
          </div>
        </Field>

        <Field>
          <FieldLabel>Direction</FieldLabel>
          <SegmentedControl<NonNullable<FrameTag['direction']>>
            value={tag.direction || 'forward'}
            onValueChange={(next) =>
              next && updateDraft({ direction: next as NonNullable<FrameTag['direction']> })
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
        </Field>

        <Field>
          <FieldLabel>Repeat</FieldLabel>
          <div className="flex w-full items-center gap-1.5">
            <SegmentedControl<'infinite' | 'custom'>
              value={repeatMode}
              onValueChange={(next) => {
                if (!next) return;
                const mode = next as 'infinite' | 'custom';
                setRepeatMode(mode);
                if (mode === 'infinite') {
                  updateDraft({ repeat: 0 }, 'infinite');
                } else {
                  const newRepeat = (tag.repeat ?? 0) === 0 ? 1 : tag.repeat;
                  updateDraft({ repeat: newRepeat }, 'custom');
                }
              }}
              className="min-w-0 flex-1"
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
              <StudioNumberInput
                value={Math.max(1, tag.repeat ?? 1)}
                onValueChange={(val) => updateDraft({ repeat: Math.max(1, val) }, 'custom')}
                min={1}
                max={999}
                aria-label="Repeat count"
                className="w-16 shrink-0"
                inputClassName="text-center px-1"
              />
            )}
          </div>
        </Field>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        {!isNew && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            <Check size={12} />
            <span>{isNew ? 'Create Tag' : 'Save Tag'}</span>
          </Button>
        </div>
      </div>
    </form>
  );
};

export interface AnimationTagDialogProps extends Omit<AnimationTagPopoverProps, 'showArrow'> {}

export const AnimationTagDialog: React.FC<AnimationTagDialogProps> = (props) => (
  <ModalShell
    open={props.isOpen}
    onClose={props.onClose}
    title={props.isNew ? 'New Animation Tag' : 'Edit Animation Tag'}
    subtitle="Define a named frame range and playback loop"
    maxWidthClassName="max-w-sm"
  >
    <AnimationTagPopover {...props} showArrow={false} />
  </ModalShell>
);
