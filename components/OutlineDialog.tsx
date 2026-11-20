import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import { Switch } from './ui/switch';
import { StudioSelect } from './ui/select';
import { Button, IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import { ColorSwatchField } from './ui/color-picker';
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
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  const isConfirmedRef = useRef(false);
  const hasPreviewAppliedRef = useRef(false);
  const lastPreviewHashRef = useRef<string>('');

  useLayoutEffect(() => {
    onPreviewRef.current = onPreview;
    onCancelRef.current = onCancel;
    onConfirmRef.current = onConfirm;
  });

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

  useEffect(() => {
    return () => {
      if (!isConfirmedRef.current && hasPreviewAppliedRef.current) {
        onCancelRef.current(originalStateRef.current);
        hasPreviewAppliedRef.current = false;
      }
    };
  }, []);

  const outlineOptions: OutlineOptions = {
    placement,
    matrix,
    thickness,
    outlineColor,
    bgMode,
    bgColor: bgMode === 'color' ? bgColor : undefined,
    scope: limitToSelection ? 'selection' : 'canvas',
    targetLayer,
    targetFrames,
  };

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
    setMatrix({ ...matrix, [dir]: !matrix[dir] });
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
  const paletteSwatches = state.palette.slice(0, 12);

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
            <IconButton
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleCancel}
              aria-label="Close Outline FX"
            >
              <X size={14} />
            </IconButton>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4 text-xs">
            <Field>
              <FieldLabel>Placement</FieldLabel>
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
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Shape & Direction</FieldLabel>
                <Button type="button" variant="ghost" size="xs" onClick={handleInvertMatrix}>
                  <RotateCcw size={10} />
                  <span>Invert</span>
                </Button>
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
                      'h-6 rounded-sm text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                    <Toggle
                      key={d.key}
                      pressed={matrix[d.key]}
                      onPressedChange={() => toggleDirection(d.key)}
                      variant="solid"
                      size="xs"
                      aria-label={d.label}
                      className="h-full w-full p-0 border border-border data-[pressed]:border-primary"
                    >
                      {d.icon}
                    </Toggle>
                  ))}
                  <div className="pointer-events-none flex items-center justify-center rounded-sm border border-border bg-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
                  </div>
                  {directionsRight.map((d) => (
                    <Toggle
                      key={d.key}
                      pressed={matrix[d.key]}
                      onPressedChange={() => toggleDirection(d.key)}
                      variant="solid"
                      size="xs"
                      aria-label={d.label}
                      className="h-full w-full p-0 border border-border data-[pressed]:border-primary"
                    >
                      {d.icon}
                    </Toggle>
                  ))}
                </div>
              </div>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Thickness</FieldLabel>
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
                <StudioNumberInput
                  value={thickness}
                  onValueChange={setThickness}
                  min={1}
                  max={8}
                  aria-label="Thickness pixels"
                  className="w-14 shrink-0"
                  inputClassName="text-center px-1"
                />
              </div>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Outline Color</FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setOutlineColor(state.primaryColor)}
                  className="text-primary hover:text-primary"
                >
                  Use Active
                </Button>
              </div>
              <ColorSwatchField
                value={outlineColor}
                onChange={setOutlineColor}
                presets={paletteSwatches}
                label="Choose outline color"
                className="w-full"
              />
            </Field>

            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Background</FieldLabel>
              <div className="flex items-center gap-1.5">
                <StudioSelect<'transparent' | 'color'>
                  value={bgMode}
                  options={BG_MODE_OPTIONS}
                  onValueChange={(v) => setBgMode(v)}
                  className="h-7 w-28 text-[11px]"
                  aria-label="Outline background mode"
                />
                {bgMode === 'color' && (
                  <ColorSwatchField
                    value={bgColor}
                    onChange={setBgColor}
                    presets={paletteSwatches}
                    label="Outline background color"
                    className="h-7 w-24"
                  />
                )}
              </div>
            </div>

            <Field>
              <FieldLabel>Target Layer</FieldLabel>
              <SegmentedControl<'active' | 'new'>
                value={targetLayer}
                onValueChange={(next) => next && setTargetLayer(next as 'active' | 'new')}
                aria-label="Target layer"
              >
                <SegmentedControlIndicator />
                <SegmentedControlItem value="active">Active Layer</SegmentedControlItem>
                <SegmentedControlItem value="new">New Layer</SegmentedControlItem>
              </SegmentedControl>
            </Field>

            {isAnimated && (
              <Field>
                <FieldLabel>Target Frames</FieldLabel>
                <SegmentedControl<'current' | 'all'>
                  value={targetFrames}
                  onValueChange={(next) => next && setTargetFrames(next as 'current' | 'all')}
                  aria-label="Target frames"
                >
                  <SegmentedControlIndicator />
                  <SegmentedControlItem value="current">Current Frame</SegmentedControlItem>
                  <SegmentedControlItem value="all">All Frames</SegmentedControlItem>
                </SegmentedControl>
              </Field>
            )}

            <div className="flex flex-col gap-2.5 border-t border-border pt-2.5">
              {hasSelection && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground">Selected pixels only</span>
                  <Switch
                    checked={limitToSelection}
                    onCheckedChange={setLimitToSelection}
                    aria-label="Limit outline to selected pixels"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={livePreview}
                    onCheckedChange={setLivePreview}
                    aria-label="Toggle live preview"
                  />
                  <span className="text-xs text-muted-foreground">Live preview</span>
                </div>
                <Button type="button" variant="ghost" size="xs" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Apply Outline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
