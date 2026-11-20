import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ProjectState, ColorMode } from '../types';
import { ModalShell } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Field, FieldLabel, FieldDescription } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { Grid, Ratio, Palette } from './Icons';

export interface SpritePropertiesUpdate {
  title?: string;
  pixelRatio?: { width: number; height: number };
  transparentIndex?: number;
  colorMode?: ColorMode;
  grid?: { x: number; y: number; width: number; height: number };
}

interface SpritePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onUpdateSpriteProperties: (props: SpritePropertiesUpdate) => void;
  onPreviewSpriteProperties?: (props: SpritePropertiesUpdate) => void;
  onRevertPreview?: (snapshot: SpritePropertiesUpdate) => void;
}

export const SpritePropertiesDialog: React.FC<SpritePropertiesDialogProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateSpriteProperties,
  onPreviewSpriteProperties,
  onRevertPreview,
}) => {
  const [title, setTitle] = useState(state.title || '');
  const [colorMode, setColorMode] = useState<ColorMode>(state.colorMode || 'rgba');
  const [transparentIndex, setTransparentIndex] = useState<number>(state.transparentIndex ?? 0);
  const [pixelRatioWidth, setPixelRatioWidth] = useState<number>(state.pixelRatio?.width ?? 1);
  const [pixelRatioHeight, setPixelRatioHeight] = useState<number>(state.pixelRatio?.height ?? 1);
  const [gridX, setGridX] = useState<number>(state.grid?.x ?? 0);
  const [gridY, setGridY] = useState<number>(state.grid?.y ?? 0);
  const [gridWidth, setGridWidth] = useState<number>(state.grid?.width ?? 16);
  const [gridHeight, setGridHeight] = useState<number>(state.grid?.height ?? 16);

  const wasOpenRef = useRef(false);
  const snapshotRef = useRef<SpritePropertiesUpdate | null>(null);
  const isCommittedRef = useRef(false);
  const hasPreviewedRef = useRef(false);
  const onPreviewRef = useRef(onPreviewSpriteProperties);
  const onRevertRef = useRef(onRevertPreview);

  useLayoutEffect(() => {
    onPreviewRef.current = onPreviewSpriteProperties;
    onRevertRef.current = onRevertPreview;
  });

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const justClosed = !isOpen && wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      const snap: SpritePropertiesUpdate = {
        title: state.title || '',
        colorMode: state.colorMode || 'rgba',
        transparentIndex: state.transparentIndex ?? 0,
        pixelRatio: {
          width: state.pixelRatio?.width || 1,
          height: state.pixelRatio?.height || 1,
        },
        grid: {
          x: state.grid?.x ?? 0,
          y: state.grid?.y ?? 0,
          width: state.grid?.width || 16,
          height: state.grid?.height || 16,
        },
      };
      snapshotRef.current = snap;
      isCommittedRef.current = false;
      hasPreviewedRef.current = false;

      setTitle(snap.title ?? '');
      setColorMode(snap.colorMode ?? 'rgba');
      setTransparentIndex(snap.transparentIndex ?? 0);
      setPixelRatioWidth(snap.pixelRatio?.width ?? 1);
      setPixelRatioHeight(snap.pixelRatio?.height ?? 1);
      setGridX(snap.grid?.x ?? 0);
      setGridY(snap.grid?.y ?? 0);
      setGridWidth(snap.grid?.width ?? 16);
      setGridHeight(snap.grid?.height ?? 16);
    } else if (justClosed) {
      if (!isCommittedRef.current && hasPreviewedRef.current && snapshotRef.current) {
        onRevertRef.current?.(snapshotRef.current);
      }
      hasPreviewedRef.current = false;
    }
  }, [isOpen, state]);

  useEffect(() => {
    return () => {
      if (!isCommittedRef.current && hasPreviewedRef.current && snapshotRef.current) {
        onRevertRef.current?.(snapshotRef.current);
      }
    };
  }, []);

  const buildPayload = (): SpritePropertiesUpdate => ({
    title: title.trim() || state.title,
    colorMode,
    transparentIndex: Math.max(0, Math.min(Math.max(0, state.palette.length - 1), transparentIndex)),
    pixelRatio: {
      width: Math.max(1, Math.min(10, Math.round(pixelRatioWidth))),
      height: Math.max(1, Math.min(10, Math.round(pixelRatioHeight))),
    },
    grid: {
      x: Math.round(gridX),
      y: Math.round(gridY),
      width: Math.max(1, Math.round(gridWidth)),
      height: Math.max(1, Math.round(gridHeight)),
    },
  });

  // Live preview visual grid/ratio changes while open
  useEffect(() => {
    if (!isOpen || !snapshotRef.current || !onPreviewRef.current) return;
    hasPreviewedRef.current = true;
    onPreviewRef.current({
      pixelRatio: {
        width: Math.max(1, Math.min(10, Math.round(pixelRatioWidth))),
        height: Math.max(1, Math.min(10, Math.round(pixelRatioHeight))),
      },
      grid: {
        x: Math.round(gridX),
        y: Math.round(gridY),
        width: Math.max(1, Math.round(gridWidth)),
        height: Math.max(1, Math.round(gridHeight)),
      },
    });
  }, [isOpen, pixelRatioWidth, pixelRatioHeight, gridX, gridY, gridWidth, gridHeight]);

  const handleCancel = () => {
    if (!isCommittedRef.current && hasPreviewedRef.current && snapshotRef.current) {
      onRevertRef.current?.(snapshotRef.current);
      hasPreviewedRef.current = false;
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    isCommittedRef.current = true;
    hasPreviewedRef.current = false;
    onUpdateSpriteProperties(buildPayload());
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={handleCancel}
      title="Sprite Properties"
      subtitle="Color depth, pixel aspect ratio, and grid"
      maxWidthClassName="max-w-md"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" form="sprite-properties-form" variant="primary" size="sm">
            Save Changes
          </Button>
        </>
      }
    >
      <form id="sprite-properties-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="sprite-title-input">Sprite Title</FieldLabel>
          <Input
            id="sprite-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project Name..."
          />
        </Field>

        <div className="flex flex-col gap-3">
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel className="flex items-center gap-1.5">
                <Palette size={12} />
                <span>Color Mode</span>
              </FieldLabel>
              <span className="text-[11px] text-muted-foreground">
                {colorMode === 'indexed' ? 'Palette-locked · 8-bit' : 'Full color · 32-bit'}
              </span>
            </div>
            <SegmentedControl<ColorMode>
              value={colorMode}
              onValueChange={(next) => next && setColorMode(next as ColorMode)}
              aria-label="Color mode"
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="indexed">Indexed</SegmentedControlItem>
              <SegmentedControlItem value="rgba">RGBA</SegmentedControlItem>
            </SegmentedControl>
          </Field>

          {colorMode === 'indexed' && (
            <Field>
              <FieldLabel>Transparent Index</FieldLabel>
              <StudioNumberInput
                value={transparentIndex}
                onValueChange={setTransparentIndex}
                min={0}
                max={Math.max(0, state.palette.length - 1)}
                showSteppers
                aria-label="Transparent palette index"
              />
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Ratio size={13} className="text-muted-foreground" />
            <span>Pixel Aspect Ratio</span>
          </span>
          <div className="grid grid-cols-2 gap-3">
            <StudioNumberInput
              value={pixelRatioWidth}
              onValueChange={setPixelRatioWidth}
              min={1}
              max={10}
              prefix="W"
              showSteppers
              aria-label="Pixel aspect width"
            />
            <StudioNumberInput
              value={pixelRatioHeight}
              onValueChange={setPixelRatioHeight}
              min={1}
              max={10}
              prefix="H"
              showSteppers
              aria-label="Pixel aspect height"
            />
          </div>
          <FieldDescription>
            Standard square pixels use 1:1. Double-wide retro pixels use 2:1.
          </FieldDescription>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Grid size={13} className="text-muted-foreground" />
            <span>Pixel Grid</span>
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <StudioNumberInput
              value={gridX}
              onValueChange={setGridX}
              prefix="X"
              aria-label="Grid offset X"
            />
            <StudioNumberInput
              value={gridY}
              onValueChange={setGridY}
              prefix="Y"
              aria-label="Grid offset Y"
            />
            <StudioNumberInput
              value={gridWidth}
              onValueChange={setGridWidth}
              min={1}
              max={512}
              prefix="W"
              aria-label="Grid width"
            />
            <StudioNumberInput
              value={gridHeight}
              onValueChange={setGridHeight}
              min={1}
              max={512}
              prefix="H"
              aria-label="Grid height"
            />
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
