import React, { useState, useEffect } from 'react';
import { ProjectState, ColorMode } from '../types';
import { ModalShell } from './ui/dialog';
import { Input } from './ui/input';
import { StudioSelect } from './ui/select';
import { Grid, Ratio, Palette } from './Icons';

interface SpritePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onUpdateSpriteProperties: (props: {
    title?: string;
    pixelRatio?: { width: number; height: number };
    transparentIndex?: number;
    colorMode?: ColorMode;
    grid?: { x: number; y: number; width: number; height: number };
  }) => void;
}

const COLOR_MODE_OPTIONS = [
  { value: 'rgba' as ColorMode, label: 'RGBA (32 bpp)' },
  { value: 'indexed' as ColorMode, label: 'Indexed (8 bpp)' },
] as const;

export const SpritePropertiesDialog: React.FC<SpritePropertiesDialogProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateSpriteProperties,
}) => {
  const [title, setTitle] = useState(state.title || '');
  const [colorMode, setColorMode] = useState<ColorMode>(state.colorMode || 'rgba');
  const [transparentIndex, setTransparentIndex] = useState<number>(
    state.transparentIndex != null && !isNaN(state.transparentIndex) ? state.transparentIndex : 0
  );
  const [pixelRatioWidth, setPixelRatioWidth] = useState<number>(
    state.pixelRatio?.width && !isNaN(state.pixelRatio.width) ? state.pixelRatio.width : 1
  );
  const [pixelRatioHeight, setPixelRatioHeight] = useState<number>(
    state.pixelRatio?.height && !isNaN(state.pixelRatio.height) ? state.pixelRatio.height : 1
  );
  const [gridX, setGridX] = useState<number>(
    state.grid?.x != null && !isNaN(state.grid.x) ? state.grid.x : 0
  );
  const [gridY, setGridY] = useState<number>(
    state.grid?.y != null && !isNaN(state.grid.y) ? state.grid.y : 0
  );
  const [gridWidth, setGridWidth] = useState<number>(
    state.grid?.width && !isNaN(state.grid.width) ? state.grid.width : 16
  );
  const [gridHeight, setGridHeight] = useState<number>(
    state.grid?.height && !isNaN(state.grid.height) ? state.grid.height : 16
  );

  useEffect(() => {
    if (!isOpen) return;
    setTitle(state.title || '');
    setColorMode(state.colorMode || 'rgba');
    setTransparentIndex(
      state.transparentIndex != null && !isNaN(state.transparentIndex) ? state.transparentIndex : 0
    );
    setPixelRatioWidth(
      state.pixelRatio?.width && !isNaN(state.pixelRatio.width) ? state.pixelRatio.width : 1
    );
    setPixelRatioHeight(
      state.pixelRatio?.height && !isNaN(state.pixelRatio.height) ? state.pixelRatio.height : 1
    );
    setGridX(state.grid?.x != null && !isNaN(state.grid.x) ? state.grid.x : 0);
    setGridY(state.grid?.y != null && !isNaN(state.grid.y) ? state.grid.y : 0);
    setGridWidth(state.grid?.width && !isNaN(state.grid.width) ? state.grid.width : 16);
    setGridHeight(state.grid?.height && !isNaN(state.grid.height) ? state.grid.height : 16);
  }, [isOpen, state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSpriteProperties({
      title,
      colorMode,
      transparentIndex: isNaN(transparentIndex) ? 0 : transparentIndex,
      pixelRatio: {
        width: Math.max(1, isNaN(pixelRatioWidth) ? 1 : pixelRatioWidth),
        height: Math.max(1, isNaN(pixelRatioHeight) ? 1 : pixelRatioHeight),
      },
      grid: {
        x: isNaN(gridX) ? 0 : gridX,
        y: isNaN(gridY) ? 0 : gridY,
        width: Math.max(1, isNaN(gridWidth) ? 16 : gridWidth),
        height: Math.max(1, isNaN(gridHeight) ? 16 : gridHeight),
      },
    });
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Sprite Properties"
      subtitle="Color depth, pixel aspect ratio, and grid"
      maxWidthClassName="max-w-md"
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
            type="submit"
            form="sprite-properties-form"
            className="h-7 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Apply Changes
          </button>
        </>
      }
    >
      <form id="sprite-properties-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sprite-title-input"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Sprite Title
          </label>
          <Input
            id="sprite-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project Name..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Palette size={12} />
              <span>Color Mode</span>
            </span>
            <StudioSelect<ColorMode>
              value={colorMode}
              options={COLOR_MODE_OPTIONS}
              onValueChange={setColorMode}
              aria-label="Color mode"
            />
          </div>

          {colorMode === 'indexed' && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="transparent-idx-input"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Transparent Index
              </label>
              <Input
                id="transparent-idx-input"
                type="number"
                value={isNaN(transparentIndex) ? '' : transparentIndex}
                onChange={(e) => setTransparentIndex(parseInt(e.target.value, 10))}
                min={0}
                max={Math.max(0, state.palette.length - 1)}
                className="font-mono tabular-nums"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Ratio size={13} className="text-muted-foreground" />
            <span>Pixel Aspect Ratio</span>
          </span>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-muted-foreground">Width</span>
              <Input
                type="number"
                value={isNaN(pixelRatioWidth) ? '' : pixelRatioWidth}
                onChange={(e) => setPixelRatioWidth(parseInt(e.target.value, 10))}
                min={1}
                max={10}
                className="h-7 font-mono tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-muted-foreground">Height</span>
              <Input
                type="number"
                value={isNaN(pixelRatioHeight) ? '' : pixelRatioHeight}
                onChange={(e) => setPixelRatioHeight(parseInt(e.target.value, 10))}
                min={1}
                max={10}
                className="h-7 font-mono tabular-nums"
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Standard square pixels use 1:1. Double-wide pixels use 2:1.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Grid size={13} className="text-muted-foreground" />
            <span>Pixel Grid</span>
          </span>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-muted-foreground">Grid X</span>
              <Input
                type="number"
                value={isNaN(gridX) ? '' : gridX}
                onChange={(e) => setGridX(parseInt(e.target.value, 10))}
                className="h-7 font-mono tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-muted-foreground">Grid Y</span>
              <Input
                type="number"
                value={isNaN(gridY) ? '' : gridY}
                onChange={(e) => setGridY(parseInt(e.target.value, 10))}
                className="h-7 font-mono tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-muted-foreground">Width</span>
              <Input
                type="number"
                value={isNaN(gridWidth) ? '' : gridWidth}
                onChange={(e) => setGridWidth(parseInt(e.target.value, 10))}
                min={1}
                className="h-7 font-mono tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-muted-foreground">Height</span>
              <Input
                type="number"
                value={isNaN(gridHeight) ? '' : gridHeight}
                onChange={(e) => setGridHeight(parseInt(e.target.value, 10))}
                min={1}
                className="h-7 font-mono tabular-nums"
              />
            </label>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
