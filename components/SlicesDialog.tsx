import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Slice, SliceKey, ProjectState } from '../types';
import { ENTITY_COLOR_TAGS } from '../constants';
import { Crop, Plus, Trash2, Shield, Crosshair, Check, Layers } from './Icons';
import { ModalShell } from './ui/dialog';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button, IconButton } from './ui/button';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import { ColorSwatchField } from './ui/color-picker';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';

interface SlicesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onUpdateSlices: (slices: Slice[]) => void;
  onPreviewSlices?: (slices: Slice[]) => void;
  onRevertPreview?: (snapshot: Slice[]) => void;
}

export const SlicesDialog: React.FC<SlicesDialogProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateSlices,
  onPreviewSlices,
  onRevertPreview,
}) => {
  const [slices, setSlices] = useState<Slice[]>(state.slices || []);
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);

  const wasOpenRef = useRef(false);
  const snapshotRef = useRef<Slice[]>(state.slices || []);
  const isCommittedRef = useRef(false);
  const hasPreviewedRef = useRef(false);
  const onPreviewRef = useRef(onPreviewSlices);
  const onRevertRef = useRef(onRevertPreview);

  useLayoutEffect(() => {
    onPreviewRef.current = onPreviewSlices;
    onRevertRef.current = onRevertPreview;
  });

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const justClosed = !isOpen && wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      const initial = (state.slices || []).map((s) => ({
        ...s,
        keys: s.keys.map((k) => ({
          ...k,
          center: k.center ? { ...k.center } : undefined,
          pivot: k.pivot ? { ...k.pivot } : undefined,
        })),
        userData: s.userData ? { ...s.userData } : undefined,
      }));
      snapshotRef.current = initial;
      isCommittedRef.current = false;
      hasPreviewedRef.current = false;
      setSlices(initial);
      setSelectedSliceId(initial[0]?.id ?? null);
    } else if (justClosed) {
      if (!isCommittedRef.current && hasPreviewedRef.current) {
        onRevertRef.current?.(snapshotRef.current);
      }
      hasPreviewedRef.current = false;
    }
  }, [isOpen, state.slices]);

  useEffect(() => {
    return () => {
      if (!isCommittedRef.current && hasPreviewedRef.current) {
        onRevertRef.current?.(snapshotRef.current);
      }
    };
  }, []);

  const commitLocalSlices = (next: Slice[]) => {
    setSlices(next);
    if (onPreviewRef.current) {
      hasPreviewedRef.current = true;
      onPreviewRef.current(next);
    }
  };

  const activeSlice = slices.find((s) => s.id === selectedSliceId) ?? null;
  const activeKey: SliceKey = activeSlice?.keys[0] ?? {
    frameIndex: state.activeFrameIndex,
    x: 0,
    y: 0,
    w: 16,
    h: 16,
  };

  const updateActiveSlice = (updater: (slice: Slice) => Slice) => {
    if (!activeSlice) return;
    const next = slices.map((s) => (s.id === activeSlice.id ? updater(s) : s));
    commitLocalSlices(next);
  };

  const updateActiveKey = (patch: Partial<SliceKey>) => {
    updateActiveSlice((s) => {
      const currentKey = s.keys[0] ?? {
        frameIndex: state.activeFrameIndex,
        x: 0,
        y: 0,
        w: 16,
        h: 16,
      };
      const updatedKey: SliceKey = {
        ...currentKey,
        ...patch,
      };
      return { ...s, keys: [updatedKey, ...s.keys.slice(1)] };
    });
  };

  const handleAddSlice = () => {
    const canvasWidth = state?.width || 16;
    const canvasHeight = state?.height || 16;
    const activeIdx = state?.activeFrameIndex || 0;
    const newSlice: Slice = {
      id: `slice_${Date.now()}`,
      name: `Slice ${slices.length + 1}`,
      color: '#ef4444',
      keys: [
        {
          frameIndex: activeIdx,
          x: 0,
          y: 0,
          w: Math.min(16, canvasWidth),
          h: Math.min(16, canvasHeight),
        },
      ],
    };
    commitLocalSlices([...slices, newSlice]);
    setSelectedSliceId(newSlice.id);
  };

  const handleDeleteSlice = (id: string) => {
    const next = slices.filter((s) => s.id !== id);
    commitLocalSlices(next);
    if (selectedSliceId === id) {
      setSelectedSliceId(next[0]?.id ?? null);
    }
  };

  const handleCancel = () => {
    if (!isCommittedRef.current && hasPreviewedRef.current) {
      onRevertRef.current?.(snapshotRef.current);
      hasPreviewedRef.current = false;
    }
    onClose();
  };

  const handleApply = () => {
    isCommittedRef.current = true;
    hasPreviewedRef.current = false;
    const cleaned = slices.map((s, idx) => ({
      ...s,
      name: s.name.trim() || `Slice ${idx + 1}`,
    }));
    onUpdateSlices(cleaned);
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={handleCancel}
      title="Slices Manager"
      subtitle="UI regions, 9-patch borders, and pivot points"
      maxWidthClassName="max-w-2xl"
      bodyClassName="flex flex-col gap-4 md:flex-row"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleApply}>
            <Check size={13} />
            <span>Save Slices</span>
          </Button>
        </>
      }
    >
      {/* Left List */}
      <div className="flex w-full shrink-0 flex-col gap-2 border-b border-border pb-3 md:w-5/12 md:border-b-0 md:border-r md:pb-0 md:pr-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Layers size={13} className="text-muted-foreground" />
            <span className="tabular-nums">Slices ({slices.length})</span>
          </span>
          <Button type="button" variant="primary" size="xs" onClick={handleAddSlice}>
            <Plus size={12} />
            <span>New</span>
          </Button>
        </div>

        <ScrollArea className="max-h-72 pr-1">
          <div className="flex flex-col gap-1.5">
            {slices.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/40 px-3 py-8 text-center">
                <Crop size={22} className="mb-2 text-muted-foreground/50" />
                <p className="text-xs font-medium text-muted-foreground">No slices created</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                  Click New to define a region
                </p>
              </div>
            ) : (
              slices.map((s) => {
                const isSelected = selectedSliceId === s.id;
                const key = s.keys[0] || { x: 0, y: 0, w: 0, h: 0 };
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedSliceId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSliceId(s.id);
                      }
                    }}
                    className={cn(
                      'group flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'border-primary/70 bg-primary/10 text-foreground'
                        : 'border-border bg-background/50 text-foreground hover:border-border-strong hover:bg-accent/50'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border-strong"
                        style={{ backgroundColor: s.color || '#ef4444' }}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-xs font-medium">{s.name || 'Slice'}</span>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {key.w}×{key.h} at ({key.x}, {key.y})
                        </span>
                      </div>
                    </div>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      aria-label={`Delete ${s.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlice(s.id);
                      }}
                      className="opacity-70 hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Active Slice Inspector (edits auto-sync to working slices list) */}
      <div className="flex min-w-0 flex-1 flex-col">
        {activeSlice ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2.5">
              <Field className="col-span-2">
                <FieldLabel htmlFor="slice-name-input">Slice Name</FieldLabel>
                <Input
                  id="slice-name-input"
                  type="text"
                  value={activeSlice.name}
                  onChange={(e) => updateActiveSlice((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Slice name"
                />
              </Field>
              <Field>
                <FieldLabel>Color</FieldLabel>
                <ColorSwatchField
                  value={activeSlice.color || '#ef4444'}
                  onChange={(hex) => updateActiveSlice((s) => ({ ...s, color: hex }))}
                  presets={ENTITY_COLOR_TAGS.map((t) => t.hex)}
                  label="Slice color"
                  className="w-full"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-2.5">
              <FieldLabel>Bounds (px)</FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StudioNumberInput
                  value={activeKey.x}
                  onValueChange={(v) => updateActiveKey({ x: Math.max(0, Math.round(v)) })}
                  min={0}
                  max={state.width}
                  prefix="X"
                  aria-label="Slice X"
                />
                <StudioNumberInput
                  value={activeKey.y}
                  onValueChange={(v) => updateActiveKey({ y: Math.max(0, Math.round(v)) })}
                  min={0}
                  max={state.height}
                  prefix="Y"
                  aria-label="Slice Y"
                />
                <StudioNumberInput
                  value={activeKey.w}
                  onValueChange={(v) => updateActiveKey({ w: Math.max(1, Math.round(v)) })}
                  min={1}
                  max={state.width}
                  prefix="W"
                  aria-label="Slice Width"
                />
                <StudioNumberInput
                  value={activeKey.h}
                  onValueChange={(v) => updateActiveKey({ h: Math.max(1, Math.round(v)) })}
                  min={1}
                  max={state.height}
                  prefix="H"
                  aria-label="Slice Height"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Shield size={12} className="shrink-0 text-muted-foreground" />
                  <span>9-Patch Center Slice</span>
                </span>
                <Switch
                  checked={!!activeKey.center}
                  onCheckedChange={(checked) =>
                    updateActiveKey({
                      center: checked
                        ? {
                            x: 2,
                            y: 2,
                            w: Math.max(1, activeKey.w - 4),
                            h: Math.max(1, activeKey.h - 4),
                          }
                        : undefined,
                    })
                  }
                  aria-label="Toggle 9-patch center slice"
                />
              </div>
              {activeKey.center && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 sm:grid-cols-4">
                  <StudioNumberInput
                    value={activeKey.center.x}
                    onValueChange={(v) =>
                      updateActiveKey({ center: { ...activeKey.center!, x: Math.round(v) } })
                    }
                    prefix="CX"
                    aria-label="Center slice X"
                  />
                  <StudioNumberInput
                    value={activeKey.center.y}
                    onValueChange={(v) =>
                      updateActiveKey({ center: { ...activeKey.center!, y: Math.round(v) } })
                    }
                    prefix="CY"
                    aria-label="Center slice Y"
                  />
                  <StudioNumberInput
                    value={activeKey.center.w}
                    onValueChange={(v) =>
                      updateActiveKey({
                        center: { ...activeKey.center!, w: Math.max(1, Math.round(v)) },
                      })
                    }
                    min={1}
                    prefix="CW"
                    aria-label="Center slice width"
                  />
                  <StudioNumberInput
                    value={activeKey.center.h}
                    onValueChange={(v) =>
                      updateActiveKey({
                        center: { ...activeKey.center!, h: Math.max(1, Math.round(v)) },
                      })
                    }
                    min={1}
                    prefix="CH"
                    aria-label="Center slice height"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Crosshair size={12} className="shrink-0 text-muted-foreground" />
                  <span>Pivot Position</span>
                </span>
                <Switch
                  checked={!!activeKey.pivot}
                  onCheckedChange={(checked) =>
                    updateActiveKey({
                      pivot: checked
                        ? { x: Math.floor(activeKey.w / 2), y: Math.floor(activeKey.h / 2) }
                        : undefined,
                    })
                  }
                  aria-label="Toggle pivot position"
                />
              </div>
              {activeKey.pivot && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                  <StudioNumberInput
                    value={activeKey.pivot.x}
                    onValueChange={(v) =>
                      updateActiveKey({ pivot: { ...activeKey.pivot!, x: Math.round(v) } })
                    }
                    prefix="PX"
                    aria-label="Pivot X"
                  />
                  <StudioNumberInput
                    value={activeKey.pivot.y}
                    onValueChange={(v) =>
                      updateActiveKey({ pivot: { ...activeKey.pivot!, y: Math.round(v) } })
                    }
                    prefix="PY"
                    aria-label="Pivot Y"
                  />
                </div>
              )}
            </div>

            <Field>
              <FieldLabel htmlFor="slice-notes-input">Metadata / Notes</FieldLabel>
              <Textarea
                id="slice-notes-input"
                value={activeSlice.userData?.text || ''}
                onChange={(e) =>
                  updateActiveSlice((s) => ({
                    ...s,
                    userData: e.target.value ? { ...s.userData, text: e.target.value } : undefined,
                  }))
                }
                placeholder="Engine tag or notes..."
                rows={2}
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/40 p-6 text-center">
            <Crop size={24} className="mb-2 text-muted-foreground/45" />
            <p className="text-xs font-medium text-muted-foreground">No slice selected</p>
            <p className="mt-1 max-w-[210px] text-[11px] text-muted-foreground/80">
              Select a slice on the left or click New to define bounds
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
