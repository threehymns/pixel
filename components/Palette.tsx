import React, { useRef, useState, useEffect } from 'react';
import { Plus, Upload, ChevronDown, Check } from './Icons';
import { SavedPalette } from '../types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface PaletteProps {
  width: number;
  colors: string[];
  palettes: SavedPalette[];
  activePaletteId: string;
  primaryColor: string;
  secondaryColor: string;
  onColorSelect: (color: string, isPrimary: boolean) => void;
  onAddColor: (color: string) => void;
  onSelectPalette: (id: string) => void;
  onImportPalette: (file: File) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onColorsSelected?: (colors: string[]) => void;
}

export const Palette: React.FC<PaletteProps> = React.memo(({
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');

  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activePalette = palettes.find((p) => p.id === activePaletteId);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) {
          const start = Math.min(selectionStart, selectionEnd);
          const end = Math.max(selectionStart, selectionEnd);
          if (onColorsSelected) {
            onColorsSelected(colors.slice(start, end + 1));
          }
        }
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDragging, selectionStart, selectionEnd, colors, onColorsSelected]);

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    if (e.button === 0) {
      if (e.shiftKey && selectionStart !== null) {
        setSelectionEnd(idx);
        const start = Math.min(selectionStart, idx);
        const end = Math.max(selectionStart, idx);
        if (onColorsSelected && end > start) {
          onColorsSelected(colors.slice(start, end + 1));
        }
      } else {
        setSelectionStart(idx);
        setSelectionEnd(idx);
        setIsDragging(true);
        onColorSelect(colors[idx], true);
        setTarget('primary');
      }
    } else if (e.button === 2) {
      onColorSelect(colors[idx], false);
      setTarget('secondary');
    }
  };

  const handlePointerEnter = (idx: number) => {
    if (isDragging && selectionStart !== null) {
      setSelectionEnd(idx);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportPalette(e.target.files[0]);
    }
    if (e.target.value) e.target.value = '';
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card font-sans select-none">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-background/50 px-2">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex h-6 min-w-0 flex-1 items-center justify-between rounded-sm border border-border bg-background px-2 text-[11px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="truncate">{activePalette?.name || 'Palette'}</span>
                <ChevronDown size={11} className="ml-1 shrink-0 text-muted-foreground" />
              </button>
            }
          />
          <PopoverContent align="start" className="flex max-h-[300px] w-52 flex-col gap-1 overflow-y-auto p-1.5">
            {palettes.map((p) => (
              <PopoverClose
                key={p.id}
                render={
                  <button
                    type="button"
                    onClick={() => onSelectPalette(p.id)}
                    className={`group w-full rounded-sm border p-1.5 text-left transition-colors ${
                      activePaletteId === p.id
                        ? 'border-primary/40 bg-primary/15'
                        : 'border-transparent hover:bg-accent'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between px-0.5">
                      <span
                        className={`truncate text-[11px] font-medium ${
                          activePaletteId === p.id ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {p.name}
                      </span>
                      {activePaletteId === p.id && <Check size={11} className="shrink-0 text-primary" />}
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

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Add Primary Color to Palette"
                onClick={() => onAddColor(primaryColor)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus size={12} />
              </button>
            }
          />
          <TooltipContent side="top">Add Primary Color</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Import Palette"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Upload size={12} />
              </button>
            }
          />
          <TooltipContent side="top">Import Palette (.gpl, .ase, .png)</TooltipContent>
        </Tooltip>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".png,.gpl,.ase"
          onChange={handleFileChange}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas/40 p-1.5">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(20px,1fr))] content-start gap-0.5">
          {colors.map((color, idx) => {
            const isPrimary = primaryColor.toLowerCase() === color.toLowerCase();
            const isSecondary = secondaryColor.toLowerCase() === color.toLowerCase();

            let inSelection = false;
            if (selectionStart !== null && selectionEnd !== null) {
              const start = Math.min(selectionStart, selectionEnd);
              const end = Math.max(selectionStart, selectionEnd);
              inSelection = idx >= start && idx <= end;
            }

            return (
              <Tooltip key={`${color}-${idx}`}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Color ${color.toUpperCase()}`}
                      className={`group relative aspect-square overflow-hidden rounded-[2px] border border-white/10 transition-transform active:scale-95 ${
                        inSelection
                          ? 'z-20 scale-110 ring-2 ring-primary shadow-md'
                          : isPrimary || isSecondary
                            ? 'z-10 ring-1 ring-white/80 ring-inset'
                            : 'hover:z-10 hover:ring-1 hover:ring-white/50'
                      }`}
                      style={{ backgroundColor: color }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handlePointerDown(idx, e);
                      }}
                      onPointerEnter={() => handlePointerEnter(idx)}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      {isPrimary && (
                        <div className="absolute top-0 left-0 h-0 w-0 border-t-[8px] border-r-[8px] border-t-primary border-r-transparent" />
                      )}
                      {isSecondary && (
                        <div className="absolute right-0 bottom-0 h-0 w-0 border-b-[8px] border-l-[8px] border-b-white border-l-transparent" />
                      )}
                      {((target === 'primary' && isPrimary) || (target === 'secondary' && isSecondary)) && (
                        <div className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-white mix-blend-difference" />
                      )}
                    </button>
                  }
                />
                <TooltipContent side="top" className="flex-col items-center gap-0.5">
                  <span className="font-mono text-[11px] font-semibold text-foreground tabular-nums">
                    {color.toUpperCase()}
                  </span>
                  <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                    L: Primary · R: Secondary
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
});