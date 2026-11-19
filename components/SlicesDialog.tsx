import React, { useState, useEffect } from 'react';
import { Slice, SliceKey, ProjectState } from '../types';
import { Crop, Plus, Trash2, Shield, Crosshair, Check, Layers } from './Icons';
import { ModalShell } from './ui/dialog';
import { CustomCheckbox } from './ui/checkbox';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

interface SlicesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onUpdateSlices: (slices: Slice[]) => void;
}

export const SlicesDialog: React.FC<SlicesDialogProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateSlices,
}) => {
  const [slices, setSlices] = useState<Slice[]>(state.slices || []);
  const [editingSlice, setEditingSlice] = useState<Slice | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('#ef4444');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [w, setW] = useState(16);
  const [h, setH] = useState(16);

  const [useCenter, setUseCenter] = useState(false);
  const [cx, setCx] = useState(4);
  const [cy, setCy] = useState(4);
  const [cw, setCw] = useState(8);
  const [ch, setCh] = useState(8);

  const [usePivot, setUsePivot] = useState(false);
  const [px, setPx] = useState(8);
  const [py, setPy] = useState(8);

  const [userText, setUserText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSlices(state.slices || []);
    setEditingSlice(null);
  }, [isOpen, state.slices]);

  const startEdit = (s: Slice) => {
    setEditingSlice(s);
    setName(s.name);
    setColor(s.color || '#ef4444');
    const key = s.keys[0] || { x: 0, y: 0, w: 16, h: 16 };
    setX(key.x);
    setY(key.y);
    setW(key.w);
    setH(key.h);

    if (key.center) {
      setUseCenter(true);
      setCx(key.center.x);
      setCy(key.center.y);
      setCw(key.center.w);
      setCh(key.center.h);
    } else {
      setUseCenter(false);
      setCx(2);
      setCy(2);
      setCw(Math.max(1, key.w - 4));
      setCh(Math.max(1, key.h - 4));
    }

    if (key.pivot) {
      setUsePivot(true);
      setPx(key.pivot.x);
      setPy(key.pivot.y);
    } else {
      setUsePivot(false);
      setPx(Math.floor(key.w / 2));
      setPy(Math.floor(key.h / 2));
    }

    setUserText(s.userData?.text || '');
  };

  const handleStartAdd = () => {
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
    startEdit(newSlice);
  };

  const buildUpdatedSlices = (): { nextSlices: Slice[]; updatedSlice: Slice | null } => {
    if (!editingSlice) return { nextSlices: slices, updatedSlice: null };

    const key: SliceKey = {
      frameIndex: state.activeFrameIndex,
      x: Math.max(0, isNaN(x) ? 0 : x),
      y: Math.max(0, isNaN(y) ? 0 : y),
      w: Math.max(1, isNaN(w) ? 1 : w),
      h: Math.max(1, isNaN(h) ? 1 : h),
      center: useCenter
        ? {
            x: isNaN(cx) ? 0 : cx,
            y: isNaN(cy) ? 0 : cy,
            w: Math.max(1, isNaN(cw) ? 1 : cw),
            h: Math.max(1, isNaN(ch) ? 1 : ch),
          }
        : undefined,
      pivot: usePivot
        ? {
            x: isNaN(px) ? 0 : px,
            y: isNaN(py) ? 0 : py,
          }
        : undefined,
    };

    const updatedSlice: Slice = {
      ...editingSlice,
      name: name.trim() || 'Slice',
      color,
      keys: [key],
      userData: userText ? { text: userText } : undefined,
    };

    const exists = slices.some((s) => s.id === updatedSlice.id);
    const nextSlices = exists
      ? slices.map((s) => (s.id === updatedSlice.id ? updatedSlice : s))
      : [...slices, updatedSlice];

    return { nextSlices, updatedSlice };
  };

  const handleSaveSlice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { nextSlices, updatedSlice } = buildUpdatedSlices();
    if (!updatedSlice) return;
    setSlices(nextSlices);
    setEditingSlice(updatedSlice);
  };

  const handleDeleteSlice = (id: string) => {
    const newSlices = slices.filter((s) => s.id !== id);
    setSlices(newSlices);
    if (editingSlice?.id === id) setEditingSlice(null);
  };

  const handleApply = () => {
    const { nextSlices } = buildUpdatedSlices();
    onUpdateSlices(nextSlices);
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Slices Manager"
      subtitle="UI regions, 9-patch borders, and pivot points"
      maxWidthClassName="max-w-2xl"
      bodyClassName="flex flex-col gap-4 md:flex-row"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-7 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex h-7 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Check size={13} />
            <span>Apply Slices</span>
          </button>
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
          <button
            type="button"
            onClick={handleStartAdd}
            className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={12} />
            <span>New</span>
          </button>
        </div>

        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
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
              const isSelected = editingSlice?.id === s.id;
              const key = s.keys[0] || { x: 0, y: 0, w: 0, h: 0 };
              return (
                <div
                  key={s.id}
                  onClick={() => startEdit(s)}
                  className={cn(
                    'group flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2 transition-colors',
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
                      <span className="truncate text-xs font-medium">{s.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {key.w}×{key.h} at ({key.x}, {key.y})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlice(s.id);
                    }}
                    className="rounded-sm p-1 text-muted-foreground opacity-70 transition-colors hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Slice Form */}
      <div className="flex min-w-0 flex-1 flex-col">
        {editingSlice ? (
          <form onSubmit={handleSaveSlice} className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Slice Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Slice name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Color</label>
                <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label="Slice color"
                    className="h-4 w-4 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="truncate font-mono text-[11px] uppercase text-muted-foreground">
                    {color}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">Bounds (px)</span>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { label: 'X', value: x, setter: setX },
                    { label: 'Y', value: y, setter: setY },
                    { label: 'W', value: w, setter: setW },
                    { label: 'H', value: h, setter: setH },
                  ] as const
                ).map((field) => (
                  <label key={field.label} className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {field.label}
                    </span>
                    <Input
                      type="number"
                      value={isNaN(field.value) ? '' : field.value}
                      onChange={(e) => field.setter(parseInt(e.target.value, 10))}
                      className="h-7 px-1.5 text-center font-mono tabular-nums"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-2.5">
              <label className="flex cursor-pointer items-center gap-2">
                <CustomCheckbox checked={useCenter} onCheckedChange={setUseCenter} />
                <Shield size={12} className="shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">9-Patch Center Slice</span>
              </label>
              {useCenter && (
                <div className="grid grid-cols-4 gap-2 border-t border-border pt-2">
                  {(
                    [
                      { label: 'CX', value: cx, setter: setCx },
                      { label: 'CY', value: cy, setter: setCy },
                      { label: 'CW', value: cw, setter: setCw },
                      { label: 'CH', value: ch, setter: setCh },
                    ] as const
                  ).map((field) => (
                    <label key={field.label} className="flex flex-col gap-1">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {field.label}
                      </span>
                      <Input
                        type="number"
                        value={isNaN(field.value) ? '' : field.value}
                        onChange={(e) => field.setter(parseInt(e.target.value, 10))}
                        className="h-7 px-1.5 text-center font-mono tabular-nums"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-2.5">
              <label className="flex cursor-pointer items-center gap-2">
                <CustomCheckbox checked={usePivot} onCheckedChange={setUsePivot} />
                <Crosshair size={12} className="shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Pivot Position</span>
              </label>
              {usePivot && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-muted-foreground">PX</span>
                    <Input
                      type="number"
                      value={isNaN(px) ? '' : px}
                      onChange={(e) => setPx(parseInt(e.target.value, 10))}
                      className="h-7 px-1.5 text-center font-mono tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-muted-foreground">PY</span>
                    <Input
                      type="number"
                      value={isNaN(py) ? '' : py}
                      onChange={(e) => setPy(parseInt(e.target.value, 10))}
                      className="h-7 px-1.5 text-center font-mono tabular-nums"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Metadata / Notes
              </label>
              <Input
                type="text"
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                placeholder="Engine tag or notes..."
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
              >
                <Check size={12} />
                <span>Update Slice</span>
              </button>
            </div>
          </form>
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
