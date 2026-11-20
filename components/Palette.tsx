import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Plus, Upload, ChevronDown, Check, Sparkles, X } from './Icons';
import { SavedPalette } from '../types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Button, IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Toolbar } from './ui/toolbar';
import { FileInput, FileInputTrigger } from './ui/file-input';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';

interface PaletteSwatchProps {
  color: string;
  idx: number;
  isPrimary: boolean;
  isSecondary: boolean;
  inSelection: boolean;
  isTargetActive: boolean;
  isTouch: boolean;
  onSwatchPointerDown: (idx: number, e: React.PointerEvent<HTMLButtonElement>) => void;
  onSwatchPointerEnter: (idx: number, color: string) => void;
}

const PaletteSwatch: React.FC<PaletteSwatchProps> = ({
  color,
  idx,
  isPrimary,
  isSecondary,
  inSelection,
  isTargetActive,
  isTouch,
  onSwatchPointerDown,
  onSwatchPointerEnter,
}) => {
  const button = (
    <button
      type="button"
      aria-label={`Color ${color.toUpperCase()}`}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-[3px] border border-white/10 transition-transform active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isTouch && 'min-h-10 rounded-md',
        inSelection
          ? 'z-20 scale-105 ring-2 ring-primary shadow-md'
          : isPrimary || isSecondary
            ? 'z-10 ring-1 ring-white/85 ring-inset'
            : 'hover:z-10 hover:ring-1 hover:ring-white/50'
      )}
      style={{ backgroundColor: color }}
      onPointerDown={(e) => {
        if (!isTouch) e.preventDefault();
        onSwatchPointerDown(idx, e);
      }}
      onPointerEnter={() => onSwatchPointerEnter(idx, color)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isPrimary && (
        <div className="absolute top-0 left-0 h-0 w-0 border-t-[8px] border-r-[8px] border-t-primary border-r-transparent" />
      )}
      {isSecondary && (
        <div className="absolute right-0 bottom-0 h-0 w-0 border-b-[8px] border-l-[8px] border-b-white border-l-transparent" />
      )}
      {isTargetActive && (
        <div className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-white mix-blend-difference" />
      )}
    </button>
  );

  if (isTouch) return button;

  return (
    <Tooltip delay={450}>
      <TooltipTrigger render={button} />
      <TooltipContent side="top" className="flex-col items-center gap-0.5">
        <span className="font-mono text-[11px] font-semibold uppercase tabular-nums">{color}</span>
        <span className="text-[10px] text-muted-foreground">L: Primary · R: Secondary</span>
      </TooltipContent>
    </Tooltip>
  );
};

interface PaletteProps {
  width?: number;
  colors: string[];
  palettes: SavedPalette[];
  activePaletteId: string;
  primaryColor: string;
  secondaryColor: string;
  onColorSelect: (color: string, isPrimary: boolean) => void;
  onAddColor: (color: string) => void;
  onSelectPalette: (id: string) => void;
  onImportPalette: (file: File) => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  onColorsSelected?: (colors: string[]) => void;
  shadingRamp?: string[];
  density?: 'compact' | 'touch';
}

export const Palette: React.FC<PaletteProps> = ({
  colors,
  palettes,
  activePaletteId,
  primaryColor,
  secondaryColor,
  onColorSelect,
  onAddColor,
  onSelectPalette,
  onImportPalette,
  onColorsSelected,
  shadingRamp,
  density = 'compact',
}) => {
  const isTouch = density === 'touch';
  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');
  const [rampMode, setRampMode] = useState(false);
  const [localRamp, setLocalRamp] = useState<string[]>(shadingRamp || []);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);

  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (shadingRamp) setLocalRamp(shadingRamp);
  }, [shadingRamp]);

  const latestRef = useRef({
    isDragging,
    selectionStart,
    selectionEnd,
    colors,
    target,
    rampMode,
    localRamp,
    onColorSelect,
    onColorsSelected,
  });

  useLayoutEffect(() => {
    latestRef.current = {
      isDragging,
      selectionStart,
      selectionEnd,
      colors,
      target,
      rampMode,
      localRamp,
      onColorSelect,
      onColorsSelected,
    };
  });

  const activePalette = palettes.find((p) => p.id === activePaletteId);

  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalPointerUp = () => {
      const {
        selectionStart: sStart,
        selectionEnd: sEnd,
        colors: curColors,
        onColorsSelected: onSel,
      } = latestRef.current;
      latestRef.current.isDragging = false;
      setIsDragging(false);
      if (sStart !== null && sEnd !== null && sStart !== sEnd) {
        const start = Math.min(sStart, sEnd);
        const end = Math.max(sStart, sEnd);
        const ramp = curColors.slice(start, end + 1);
        setLocalRamp(ramp);
        onSel?.(ramp);
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDragging]);

  const handlePointerDown = (idx: number, e: React.PointerEvent<HTMLButtonElement>) => {
    const {
      selectionStart: sStart,
      colors: curColors,
      target: activeSlot,
      rampMode: isRampEdit,
      localRamp: curRamp,
      onColorSelect: onSelect,
      onColorsSelected: onSel,
    } = latestRef.current;
    const picked = curColors[idx];
    if (!picked) return;

    if (isRampEdit && e.button === 0) {
      const nextRamp = curRamp.includes(picked)
        ? curRamp.filter((c) => c !== picked)
        : [...curRamp, picked];
      setLocalRamp(nextRamp);
      onSel?.(nextRamp);
      return;
    }

    if (e.button === 0) {
      if (e.shiftKey && sStart !== null) {
        latestRef.current.selectionEnd = idx;
        setSelectionEnd(idx);
        const start = Math.min(sStart, idx);
        const end = Math.max(sStart, idx);
        if (onSel && end > start) {
          const ramp = curColors.slice(start, end + 1);
          setLocalRamp(ramp);
          onSel(ramp);
        }
      } else {
        latestRef.current.selectionStart = idx;
        latestRef.current.selectionEnd = idx;
        if (!isTouch) {
          latestRef.current.isDragging = true;
          setIsDragging(true);
        }
        setSelectionStart(idx);
        setSelectionEnd(idx);
        // On touch or when Secondary slot is explicitly selected, respect activeSlot
        onSelect(picked, isTouch ? activeSlot === 'primary' : true);
        if (!isTouch) setTarget('primary');
      }
    } else if (e.button === 2) {
      onSelect(picked, false);
      setTarget('secondary');
    }
  };

  const handlePointerEnter = (idx: number, color: string) => {
    setHoveredHex(color.toUpperCase());
    if (latestRef.current.isDragging && latestRef.current.selectionStart !== null) {
      latestRef.current.selectionEnd = idx;
      setSelectionEnd(idx);
    }
  };

  const primaryLower = primaryColor.toLowerCase();
  const secondaryLower = secondaryColor.toLowerCase();
  const selMin =
    selectionStart !== null && selectionEnd !== null
      ? Math.min(selectionStart, selectionEnd)
      : -1;
  const selMax =
    selectionStart !== null && selectionEnd !== null
      ? Math.max(selectionStart, selectionEnd)
      : -1;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card font-sans select-none">
      {/* Header Toolbar */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-1 border-b border-border bg-background/50 px-2',
          isTouch ? 'h-12 gap-1.5' : 'h-8'
        )}
      >
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-1 items-center justify-between rounded-md border border-input bg-background px-2 font-medium text-foreground transition-colors hover:border-border-strong hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
                  isTouch ? 'h-9 text-xs' : 'h-6 text-[11px]'
                )}
              >
                <span className="truncate">{activePalette?.name || 'Palette'}</span>
                <ChevronDown size={12} className="ml-1 shrink-0 text-muted-foreground" />
              </button>
            }
          />
          <PopoverContent
            align="start"
            className="flex max-h-[300px] w-56 flex-col gap-1 overflow-y-auto p-1.5"
          >
            {palettes.map((p) => (
              <PopoverClose
                key={p.id}
                render={
                  <button
                    type="button"
                    onClick={() => onSelectPalette(p.id)}
                    className={cn(
                      'group w-full rounded-md border p-2 text-left transition-colors cursor-pointer',
                      activePaletteId === p.id
                        ? 'border-primary/40 bg-primary/15'
                        : 'border-transparent hover:bg-accent'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between px-0.5">
                      <span
                        className={cn(
                          'truncate text-xs font-medium',
                          activePaletteId === p.id ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {p.name}
                      </span>
                      {activePaletteId === p.id && <Check size={12} className="shrink-0 text-primary" />}
                    </div>
                    <div className="flex h-1.5 w-full overflow-hidden rounded-xs bg-background">
                      {p.colors.slice(0, 12).map((c, i) => (
                        <div key={i} style={{ backgroundColor: c }} className="h-full flex-1" />
                      ))}
                    </div>
                  </button>
                }
              />
            ))}
          </PopoverContent>
        </Popover>

        <Toolbar aria-label="Palette actions" className="gap-0.5">
          {onColorsSelected && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    pressed={rampMode}
                    onPressedChange={setRampMode}
                    variant="tint"
                    size={isTouch ? 'touch' : 'icon-sm'}
                    aria-label="Edit Shading Ink Ramp"
                    className={cn(!isTouch && 'h-6 w-6')}
                  />
                }
              >
                <Sparkles size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">Tap Swatches to Build Shading Ramp</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  type="button"
                  variant="ghost"
                  size={isTouch ? 'touch' : 'xs'}
                  aria-label="Add Primary Color to Palette"
                  onClick={() => onAddColor(primaryColor)}
                />
              }
            >
              <Plus size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Add Primary Color</TooltipContent>
          </Tooltip>

          <FileInput
            accept=".png,.gpl,.ase"
            onValueChange={(files) => {
              if (files[0]) onImportPalette(files[0]);
            }}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <FileInputTrigger
                    render={
                      <IconButton
                        type="button"
                        variant="ghost"
                        size={isTouch ? 'touch' : 'xs'}
                        aria-label="Import Palette"
                      />
                    }
                  >
                    <Upload size={isTouch ? 15 : 12} />
                  </FileInputTrigger>
                }
              />
              <TooltipContent side="top">Import Palette (.gpl, .ase, .png)</TooltipContent>
            </Tooltip>
          </FileInput>
        </Toolbar>
      </div>

      {/* Touch Primary/Secondary Target Selector */}
      {isTouch && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/30 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTarget('primary')}
              aria-pressed={target === 'primary'}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer',
                target === 'primary'
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border bg-background text-muted-foreground'
              )}
            >
              <span
                className="h-4 w-4 rounded-sm border border-border-strong"
                style={{ backgroundColor: primaryColor }}
              />
              <span>Primary</span>
            </button>
            <button
              type="button"
              onClick={() => setTarget('secondary')}
              aria-pressed={target === 'secondary'}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer',
                target === 'secondary'
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border bg-background text-muted-foreground'
              )}
            >
              <span
                className="h-4 w-4 rounded-sm border border-border-strong"
                style={{ backgroundColor: secondaryColor }}
              />
              <span>Secondary</span>
            </button>
          </div>
          <span className="font-mono text-[11px] uppercase text-muted-foreground tabular-nums">
            {target === 'primary' ? primaryColor : secondaryColor}
          </span>
        </div>
      )}

      {/* Interactive Shading Ramp Bar */}
      {(rampMode || localRamp.length > 1) && onColorsSelected && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-background/40 px-2 py-1.5">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Ramp</span>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
            {localRamp.length === 0 ? (
              <span className="text-[11px] text-muted-foreground/75">
                Tap swatches to add shading stops
              </span>
            ) : (
              localRamp.map((c, idx) => (
                <button
                  key={`${c}-${idx}`}
                  type="button"
                  aria-label={`Remove ${c} from shading ramp`}
                  onClick={() => {
                    const next = localRamp.filter((_, i) => i !== idx);
                    setLocalRamp(next);
                    onColorsSelected(next);
                  }}
                  className={cn(
                    'shrink-0 rounded-xs border border-white/25 transition-transform hover:scale-110 cursor-pointer',
                    isTouch ? 'h-6 w-6' : 'h-4 w-4'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))
            )}
          </div>
          {localRamp.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setLocalRamp([]);
                onColorsSelected([]);
              }}
              aria-label="Clear shading ramp"
            >
              <X size={11} />
            </Button>
          )}
        </div>
      )}

      {/* Swatch Grid */}
      <ScrollArea className="min-h-0 flex-1 bg-canvas/40">
        <div
          className={cn(
            'grid content-start p-1.5',
            isTouch
              ? 'grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5 p-2.5'
              : 'grid-cols-[repeat(auto-fill,minmax(20px,1fr))] gap-0.5'
          )}
          onPointerLeave={() => setHoveredHex(null)}
        >
          {colors.map((color, idx) => {
            const colorLower = color.toLowerCase();
            const isPrimary = primaryLower === colorLower;
            const isSecondary = secondaryLower === colorLower;
            const inSelection =
              (selMin !== -1 && idx >= selMin && idx <= selMax) ||
              (rampMode && localRamp.some((c) => c.toLowerCase() === colorLower));
            const isTargetActive =
              (target === 'primary' && isPrimary) || (target === 'secondary' && isSecondary);

            return (
              <PaletteSwatch
                key={`${color}-${idx}`}
                color={color}
                idx={idx}
                isPrimary={isPrimary}
                isSecondary={isSecondary}
                inSelection={inSelection}
                isTargetActive={isTargetActive}
                isTouch={isTouch}
                onSwatchPointerDown={handlePointerDown}
                onSwatchPointerEnter={handlePointerEnter}
              />
            );
          })}
        </div>
      </ScrollArea>

      {/* Compact Footer Hex Readout */}
      {!isTouch && (
        <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-card px-2 font-mono text-[10px] text-muted-foreground tabular-nums">
          <span>{hoveredHex ?? primaryColor.toUpperCase()}</span>
          <span>{colors.length} colors</span>
        </div>
      )}
    </div>
  );
};