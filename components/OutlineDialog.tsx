import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectState } from '../types';
import {
  OutlineOptions,
  OutlineMatrix,
  OutlinePlacement,
  OutlineShapePreset,
  DEFAULT_OUTLINE_MATRIX,
  MATRIX_PRESETS,
  applyOutlineEffect,
} from '../utils/outline';
import {
  X,
  RotateCcw,
  ArrowUpLeft,
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ArrowDownLeft,
  ArrowDown,
  ArrowDownRight,
} from './Icons';
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { CustomSlider } from './ui/slider';
import { CustomCheckbox } from './ui/checkbox';
import { StudioSelect } from './ui/select';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

interface OutlineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onPreview: (previewState: ProjectState) => void;
  onConfirm: (finalState: ProjectState, actionSummary: string) => void;
  onCancel: (originalState?: ProjectState) => void;
}

const BG_MODE_OPTIONS = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'color', label: 'Solid Color' },
] as const;

export const OutlineDialog: React.FC<OutlineDialogProps> = ({
  isOpen,
  onClose,
  state,
  onPreview,
  onConfirm,
  onCancel,
}) => {
  const [placement, setPlacement] = useState<OutlinePlacement>('outside');
  const [matrix, setMatrix] = useState<OutlineMatrix>(DEFAULT_OUTLINE_MATRIX);
  const [shapePreset, setShapePreset] = useState<OutlineShapePreset>('circle');
  const [thickness, setThickness] = useState<number>(1);
  const [outlineColor, setOutlineColor] = useState<string>(state.primaryColor || '#000000');
  const [bgMode, setBgMode] = useState<'transparent' | 'color'>('transparent');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [targetLayer, setTargetLayer] = useState<'active' | 'new'>('active');
  const [targetFrames, setTargetFrames] = useState<'current' | 'all'>('current');
  const [limitToSelection, setLimitToSelection] = useState<boolean>(
    !!state.selection && state.selection.size > 0
  );
  const [livePreview, setLivePreview] = useState<boolean>(true);

  const originalStateRef = useRef<ProjectState>(state);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const isConfirmedRef = useRef(false);
  const hasPreviewAppliedRef = useRef(false);
  const lastPreviewHashRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      originalStateRef.current = state;
      isConfirmedRef.current = false;
      hasPreviewAppliedRef.current = false;
      lastPreviewHashRef.current = '';
      setOutlineColor(state.primaryColor || '#000000');
      setLimitToSelection(!!state.selection && state.selection.size > 0);
    } else {
      if (!isConfirmedRef.current && hasPreviewAppliedRef.current) {
        onCancelRef.current(originalStateRef.current);
        hasPreviewAppliedRef.current = false;
      }
      lastPreviewHashRef.current = '';
    }
  }, [isOpen]);

  const outlineOptions = useMemo<OutlineOptions>(
    () => ({
      placement,
      matrix,
      thickness,
      outlineColor,
      bgMode,
      bgColor: bgMode === 'color' ? bgColor : undefined,
      scope: limitToSelection ? 'selection' : 'canvas',
      targetLayer,
      targetFrames,
    }),
    [
      placement,
      matrix,
      thickness,
      outlineColor,
      bgMode,
      bgColor,
      limitToSelection,
      targetLayer,
      targetFrames,
    ]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (!livePreview) {
      if (lastPreviewHashRef.current !== 'reverted') {
        lastPreviewHashRef.current = 'reverted';
        onPreviewRef.current(originalStateRef.current);
        hasPreviewAppliedRef.current = false;
      }
      return;
    }

    const previewHash = `${placement}:${matrix.nw ? 1 : 0}${matrix.n ? 1 : 0}${matrix.ne ? 1 : 0}${matrix.w ? 1 : 0}${matrix.e ? 1 : 0}${matrix.sw ? 1 : 0}${matrix.s ? 1 : 0}${matrix.se ? 1 : 0}:${thickness}:${outlineColor}:${bgMode}:${bgColor}:${limitToSelection ? 1 : 0}:${targetLayer}:${targetFrames}`;

    if (lastPreviewHashRef.current === previewHash) {
      return;
    }
    lastPreviewHashRef.current = previewHash;

    try {
      const { newState } = applyOutlineEffect(originalStateRef.current, outlineOptions);
      hasPreviewAppliedRef.current = true;
      onPreviewRef.current(newState);
    } catch (e) {
      console.warn('Outline preview failed', e);
    }
  }, [isOpen, outlineOptions, livePreview]);

  const handlePresetSelect = (preset: OutlineShapePreset) => {
    setShapePreset(preset);
    setMatrix({ ...MATRIX_PRESETS[preset] });
  };

  const toggleDirection = (dir: keyof OutlineMatrix) => {
    const updated = { ...matrix, [dir]: !matrix[dir] };
    setMatrix(updated);
    setShapePreset('custom');
  };

  const handleInvertMatrix = () => {
    setMatrix({
      nw: !matrix.nw,
      n: !matrix.n,
      ne: !matrix.ne,
      w: !matrix.w,
      e: !matrix.e,
      sw: !matrix.sw,
      s: !matrix.s,
      se: !matrix.se,
    });
    setShapePreset('custom');
  };

  const handleReset = () => {
    setPlacement('outside');
    setMatrix(DEFAULT_OUTLINE_MATRIX);
    setShapePreset('circle');
    setThickness(1);
    setOutlineColor(originalStateRef.current.primaryColor || '#000000');
    setBgMode('transparent');
    setTargetLayer('active');
    setTargetFrames('current');
    setLimitToSelection(
      !!originalStateRef.current.selection && originalStateRef.current.selection.size > 0
    );
  };

  const handleCancel = () => {
    if (!isConfirmedRef.current && hasPreviewAppliedRef.current) {
      onCancelRef.current(originalStateRef.current);
      hasPreviewAppliedRef.current = false;
    }
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    isConfirmedRef.current = true;
    hasPreviewAppliedRef.current = false;
    const { newState, actionSummary } = applyOutlineEffect(originalStateRef.current, outlineOptions);
    onConfirmRef.current(newState, actionSummary);
    onClose();
  };

  const hasSelection = !!state.selection && state.selection.size > 0;
  const isAnimated = state.frames.length > 1;
  const paletteSwatches = state.palette.slice(0, 8);

  const directions: { key: keyof OutlineMatrix; label: string; icon: React.ReactNode }[] = [
    { key: 'nw', label: 'North-West', icon: <ArrowUpLeft size={12} /> },
    { key: 'n', label: 'North', icon: <ArrowUp size={12} /> },
    { key: 'ne', label: 'North-East', icon: <ArrowUpRight size={12} /> },
    { key: 'w', label: 'West', icon: <ArrowLeft size={12} /> },
  ];
  const directionsRight: { key: keyof OutlineMatrix; label: string; icon: React.ReactNode }[] = [
    { key: 'e', label: 'East', icon: <ArrowRight size={12} /> },
    { key: 'sw', label: 'South-West', icon: <ArrowDownLeft size={12} /> },
    { key: 's', label: 'South', icon: <ArrowDown size={12} /> },
    { key: 'se', label: 'South-East', icon: <ArrowDownRight size={12} /> },
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleCancel();
      }}
    >
      <DialogBackdrop />
      <DialogContent className="max-w-xs">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Outline FX</DialogTitle>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close Outline FX"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={14} />
            </button>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 text-xs">
            {/* Placement */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Placement</span>
              <SegmentedControl<OutlinePlacement>
                value={placement}
                onValueChange={(next) => next && setPlacement(next as OutlinePlacement)}
                aria-label="Outline placement"
              >
                <SegmentedControlIndicator />
                <SegmentedControlItem value="outside">Outside</SegmentedControlItem>
                <SegmentedControlItem value="inside">Inside</SegmentedControlItem>
                <SegmentedControlItem value="both">Both</SegmentedControlItem>
              </SegmentedControl>
            </div>

            {/* Shape & Direction */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Shape & Direction
                </span>
                <button
                  type="button"
                  onClick={handleInvertMatrix}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RotateCcw size={10} />
                  <span>Invert</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-background p-0.5">
                {(
                  [
                    { id: 'circle', label: 'Cross' },
                    { id: 'square', label: 'Square' },
                    { id: 'horizontal', label: 'Horiz' },
                    { id: 'vertical', label: 'Vert' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={cn(
                      'h-6 rounded-sm text-[11px] font-medium transition-colors',
                      shapePreset === preset.id
                        ? 'border border-border-strong bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex justify-center pt-1">
                <div className="grid h-24 w-24 grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
                  {directions.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      aria-label={d.label}
                      aria-pressed={matrix[d.key]}
                      onClick={() => toggleDirection(d.key)}
                      className={cn(
                        'flex items-center justify-center rounded-sm transition-colors',
                        matrix[d.key]
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {d.icon}
                    </button>
                  ))}
                  <div className="pointer-events-none flex items-center justify-center rounded-sm border border-border bg-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
                  </div>
                  {directionsRight.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      aria-label={d.label}
                      aria-pressed={matrix[d.key]}
                      onClick={() => toggleDirection(d.key)}
                      className={cn(
                        'flex items-center justify-center rounded-sm transition-colors',
                        matrix[d.key]
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {d.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Thickness */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Thickness</span>
                <span className="font-mono text-[11px] text-foreground tabular-nums">
                  {thickness} px
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CustomSlider
                  min={1}
                  max={8}
                  step={1}
                  value={thickness}
                  onValueChange={setThickness}
                  aria-label="Outline thickness"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={thickness}
                  aria-label="Thickness pixels"
                  onChange={(e) =>
                    setThickness(Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1)))
                  }
                  className="h-7 w-12 px-1 text-center font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Color */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Color</span>
                <button
                  type="button"
                  onClick={() => setOutlineColor(state.primaryColor)}
                  className="text-[11px] text-primary hover:underline"
                >
                  Use Active
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {paletteSwatches.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => setOutlineColor(c)}
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-full border transition-transform',
                        outlineColor.toLowerCase() === c.toLowerCase()
                          ? 'scale-110 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-card'
                          : 'border-border-strong hover:scale-105'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label
                    className="relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong text-[11px] text-muted-foreground hover:border-foreground"
                    title="Custom color"
                  >
                    <input
                      type="color"
                      value={outlineColor}
                      onChange={(e) => setOutlineColor(e.target.value)}
                      aria-label="Custom outline color"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    +
                  </label>
                </div>
                <Input
                  type="text"
                  value={outlineColor}
                  aria-label="Outline hex color"
                  onChange={(e) => setOutlineColor(e.target.value)}
                  className="h-7 w-20 shrink-0 px-1.5 text-center font-mono text-[11px] uppercase"
                />
              </div>
            </div>

            {/* Background */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Background</span>
              <div className="flex items-center gap-1.5">
                <StudioSelect<'transparent' | 'color'>
                  value={bgMode}
                  options={BG_MODE_OPTIONS}
                  onValueChange={(v) => setBgMode(v)}
                  className="h-7 w-28 text-[11px]"
                  aria-label="Outline background mode"
                />
                {bgMode === 'color' && (
                  <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border-strong">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      aria-label="Outline background color"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span className="block h-full w-full" style={{ backgroundColor: bgColor }} />
                  </label>
                )}
              </div>
            </div>

            {/* Target Layer */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Target Layer</span>
              <SegmentedControl<'active' | 'new'>
                value={targetLayer}
                onValueChange={(next) => next && setTargetLayer(next as 'active' | 'new')}
                aria-label="Target layer"
              >
                <SegmentedControlIndicator />
                <SegmentedControlItem value="active">Active Layer</SegmentedControlItem>
                <SegmentedControlItem value="new">New Layer</SegmentedControlItem>
              </SegmentedControl>
            </div>

            {/* Target Frames */}
            {isAnimated && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Target Frames</span>
                <SegmentedControl<'current' | 'all'>
                  value={targetFrames}
                  onValueChange={(next) => next && setTargetFrames(next as 'current' | 'all')}
                  aria-label="Target frames"
                >
                  <SegmentedControlIndicator />
                  <SegmentedControlItem value="current">Current Frame</SegmentedControlItem>
                  <SegmentedControlItem value="all">All Frames</SegmentedControlItem>
                </SegmentedControl>
              </div>
            )}

            {/* Options */}
            <div className="flex flex-col gap-2 border-t border-border pt-2">
              {hasSelection && (
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-foreground select-none">
                  <CustomCheckbox
                    checked={limitToSelection}
                    onCheckedChange={setLimitToSelection}
                  />
                  <span>Selected pixels only</span>
                </label>
              )}

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground select-none">
                  <CustomCheckbox checked={livePreview} onCheckedChange={setLivePreview} />
                  <span>Live preview</span>
                </label>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={handleCancel}
              className="h-7 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-7 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Apply
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
