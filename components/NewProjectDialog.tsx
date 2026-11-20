import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ColorMode } from '../types';
import {
  DEFAULT_PALETTE,
  GAMEBOY_PALETTE,
  ENDESGA_64_PALETTE,
  MIN_CANVAS_DIM,
  MAX_CANVAS_DIM,
} from '../constants';
import { X, Link2, Unlink2, ArrowLeftRight, Check } from './Icons';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button, IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: {
    width: number;
    height: number;
    colorMode: ColorMode;
    title: string;
    paletteId?: string;
  }) => void;
  existingProjectCount?: number;
}

interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  group: 'Sprites' | 'Displays';
}

const CANVAS_PRESETS: CanvasPreset[] = [
  { id: '16x16', label: 'Micro Icon', width: 16, height: 16, group: 'Sprites' },
  { id: '32x32', label: 'Standard Sprite', width: 32, height: 32, group: 'Sprites' },
  { id: '48x48', label: 'Tile / Prop', width: 48, height: 48, group: 'Sprites' },
  { id: '64x64', label: 'Character', width: 64, height: 64, group: 'Sprites' },
  { id: '128x128', label: 'Large Asset', width: 128, height: 128, group: 'Sprites' },
  { id: '160x144', label: 'Game Boy', width: 160, height: 144, group: 'Displays' },
  { id: '256x224', label: '16-Bit Screen', width: 256, height: 224, group: 'Displays' },
  { id: '320x180', label: 'Pixel HD', width: 320, height: 180, group: 'Displays' },
];

const PALETTES = [ENDESGA_64_PALETTE, DEFAULT_PALETTE, GAMEBOY_PALETTE];

function clampDim(val: number): number {
  if (!Number.isFinite(val)) return 32;
  return Math.max(MIN_CANVAS_DIM, Math.min(MAX_CANVAS_DIM, Math.round(val)));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  existingProjectCount = 0,
}) => {
  const [title, setTitle] = useState(`Untitled-${existingProjectCount + 1}`);
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [aspectLocked, setAspectLocked] = useState(false);
  const [lockedRatio, setLockedRatio] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>('indexed');
  const [paletteId, setPaletteId] = useState<string>(ENDESGA_64_PALETTE.id);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // Only reset form state on false -> true open transition so background count changes never wipe edits
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    setTitle(`Untitled-${existingProjectCount + 1}`);
    setWidth(32);
    setHeight(32);
    setAspectLocked(false);
    setLockedRatio(1);
    setColorMode('indexed');
    setPaletteId(ENDESGA_64_PALETTE.id);

    const frameId = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frameId);
  }, [isOpen, existingProjectCount]);

  const activePresetId = useMemo(() => {
    const match = CANVAS_PRESETS.find((p) => p.width === width && p.height === height);
    return match?.id ?? null;
  }, [width, height]);

  const aspectRatioLabel = useMemo(() => {
    const divisor = gcd(width, height);
    const rw = width / divisor;
    const rh = height / divisor;
    if (rw > 32 || rh > 32) {
      return `${(width / height).toFixed(2)}:1`;
    }
    return `${rw}:${rh}`;
  }, [width, height]);

  const previewRect = useMemo(() => {
    const maxW = 136;
    const maxH = 56;
    const ratio = width / Math.max(1, height);
    let pw = maxW;
    let ph = pw / ratio;
    if (ph > maxH) {
      ph = maxH;
      pw = ph * ratio;
    }
    return {
      width: Math.max(12, Math.round(pw)),
      height: Math.max(12, Math.round(ph)),
    };
  }, [width, height]);

  const handleSelectPreset = (preset: CanvasPreset) => {
    setWidth(preset.width);
    setHeight(preset.height);
    if (aspectLocked) {
      setLockedRatio(preset.width / preset.height);
    }
  };

  const handleToggleAspectLock = (pressed: boolean) => {
    setAspectLocked(pressed);
    if (pressed) {
      setLockedRatio(width / Math.max(1, height));
    }
  };

  const handleSwapDimensions = () => {
    const nextW = height;
    const nextH = width;
    setWidth(nextW);
    setHeight(nextH);
    if (aspectLocked) {
      setLockedRatio(nextW / Math.max(1, nextH));
    }
  };

  const handleWidthChange = (nextVal: number) => {
    const clampedW = clampDim(nextVal);
    setWidth(clampedW);
    if (aspectLocked) {
      setHeight(clampDim(clampedW / lockedRatio));
    }
  };

  const handleHeightChange = (nextVal: number) => {
    const clampedH = clampDim(nextVal);
    setHeight(clampedH);
    if (aspectLocked) {
      setWidth(clampDim(clampedH * lockedRatio));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      width: clampDim(width),
      height: clampDim(height),
      colorMode,
      title: title.trim() || `Untitled-${existingProjectCount + 1}`,
      paletteId,
    });
    onClose();
  };

  const spritePresets = CANVAS_PRESETS.filter((p) => p.group === 'Sprites');
  const displayPresets = CANVAS_PRESETS.filter((p) => p.group === 'Displays');

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogBackdrop />
      <DialogContent className="max-w-[600px]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4">
            <DialogTitle>New Project</DialogTitle>
            <DialogClose
              render={<IconButton variant="ghost" size="xs" aria-label="Close new project dialog" />}
            >
              <X size={14} />
            </DialogClose>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row sm:overflow-hidden">
            <aside className="flex shrink-0 flex-col gap-3 border-b border-border bg-background/60 p-3 sm:w-52 sm:overflow-y-auto sm:border-b-0 sm:border-r">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar sm:hidden">
                {CANVAS_PRESETS.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={cn(
                        'flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'border-primary/60 bg-primary/15 font-medium text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span>{preset.label}</span>
                      <span
                        className={cn(
                          'font-mono text-[11px] tabular-nums',
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {preset.width}×{preset.height}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="hidden flex-col gap-3 sm:flex">
                <div className="flex flex-col gap-0.5">
                  <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                    Sprites
                  </div>
                  {spritePresets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={cn(
                          'flex h-7 items-center justify-between rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-primary/15 font-medium text-foreground'
                            : 'text-foreground/85 hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <span className="truncate">{preset.label}</span>
                        <span
                          className={cn(
                            'ml-2 shrink-0 font-mono text-[11px] tabular-nums',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {preset.width}×{preset.height}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mx-1 h-px bg-border" />

                <div className="flex flex-col gap-0.5">
                  <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                    Displays
                  </div>
                  {displayPresets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={cn(
                          'flex h-7 items-center justify-between rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-primary/15 font-medium text-foreground'
                            : 'text-foreground/85 hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <span className="truncate">{preset.label}</span>
                        <span
                          className={cn(
                            'ml-2 shrink-0 font-mono text-[11px] tabular-nums',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {preset.width}×{preset.height}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="flex flex-1 flex-col gap-4 p-4 sm:overflow-y-auto">
              <div
                className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-canvas select-none"
                aria-hidden="true"
              >
                <div className="relative flex flex-col items-start">
                  <span className="mb-1 max-w-[160px] truncate text-[11px] leading-none font-medium text-primary">
                    {title.trim() || `Untitled-${existingProjectCount + 1}`}
                  </span>
                  <div
                    className="checkerboard-alpha relative border border-primary transition-all duration-150 ease-out"
                    style={{
                      width: `${previewRect.width}px`,
                      height: `${previewRect.height}px`,
                    }}
                  >
                    <span className="absolute -top-[3px] -left-[3px] h-[5px] w-[5px] border border-primary bg-foreground" />
                    <span className="absolute -top-[3px] -right-[3px] h-[5px] w-[5px] border border-primary bg-foreground" />
                    <span className="absolute -bottom-[3px] -left-[3px] h-[5px] w-[5px] border border-primary bg-foreground" />
                    <span className="absolute -bottom-[3px] -right-[3px] h-[5px] w-[5px] border border-primary bg-foreground" />
                  </div>
                </div>

                <div className="absolute bottom-2 right-2.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    {width} × {height} px
                  </span>
                  <span>·</span>
                  <span>{aspectRatioLabel}</span>
                </div>
              </div>

              <Field>
                <FieldLabel htmlFor="project-name-input">Name</FieldLabel>
                <Input
                  ref={titleInputRef}
                  id="project-name-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Untitled-${existingProjectCount + 1}`}
                />
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>Dimensions</FieldLabel>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {MIN_CANVAS_DIM} – {MAX_CANVAS_DIM} px
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StudioNumberInput
                    value={width}
                    onValueChange={handleWidthChange}
                    min={MIN_CANVAS_DIM}
                    max={MAX_CANVAS_DIM}
                    step={1}
                    largeStep={8}
                    prefix="W"
                    aria-label="Width in pixels"
                    className="flex-1"
                  />

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Toggle
                          pressed={aspectLocked}
                          onPressedChange={handleToggleAspectLock}
                          variant="tint"
                          size="icon-md"
                          aria-label="Toggle aspect ratio lock"
                        />
                      }
                    >
                      {aspectLocked ? <Link2 size={14} /> : <Unlink2 size={14} />}
                    </TooltipTrigger>
                    <TooltipContent>
                      {aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                    </TooltipContent>
                  </Tooltip>

                  <StudioNumberInput
                    value={height}
                    onValueChange={handleHeightChange}
                    min={MIN_CANVAS_DIM}
                    max={MAX_CANVAS_DIM}
                    step={1}
                    largeStep={8}
                    prefix="H"
                    aria-label="Height in pixels"
                    className="flex-1"
                  />

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="md"
                          onClick={handleSwapDimensions}
                          aria-label="Swap width and height"
                        />
                      }
                    >
                      <ArrowLeftRight size={13} />
                    </TooltipTrigger>
                    <TooltipContent>Swap width & height</TooltipContent>
                  </Tooltip>
                </div>
              </Field>

              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>Color Mode</FieldLabel>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {colorMode === 'indexed'
                      ? 'Palette-locked · 8-bit'
                      : 'Full color with alpha · 32-bit'}
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

              <Field>
                <FieldLabel>Starting Palette</FieldLabel>
                <div className="flex flex-col gap-1" role="radiogroup" aria-label="Starting palette">
                  {PALETTES.map((pal) => {
                    const isSelected = paletteId === pal.id;
                    const step = Math.max(1, Math.floor(pal.colors.length / 7));
                    const previewColors = pal.colors
                      .filter((_, idx) => idx % step === 0)
                      .slice(0, 7);

                    return (
                      <button
                        key={pal.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setPaletteId(pal.id)}
                        className={cn(
                          'flex h-8 items-center justify-between gap-3 rounded-md border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'border-primary/60 bg-primary/10 font-medium text-foreground'
                            : 'border-border bg-background/60 text-foreground/85 hover:border-border-strong hover:bg-background'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex shrink-0 items-center overflow-hidden rounded-xs border border-border">
                            {previewColors.map((hex, i) => (
                              <span
                                key={`${pal.id}-${i}`}
                                className="block h-3 w-2.5"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          <span className="truncate">{pal.name}</span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            {pal.colors.length}
                          </span>
                          <span className="flex w-3.5 items-center justify-center">
                            {isSelected && <Check size={13} className="text-primary" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </div>

          <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-t border-border bg-muted/30 px-4">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Enter to create · Esc to cancel
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create Sprite
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
