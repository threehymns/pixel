import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ColorMode } from '../types';
import { DEFAULT_PALETTE, GAMEBOY_PALETTE, ENDESGA_64_PALETTE } from '../constants';
import { X, Link2, Unlink2, ArrowLeftRight, Check } from 'lucide-react';

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

const MIN_DIM = 1;
const MAX_DIM = 1024;

function clampDim(val: number): number {
  if (!Number.isFinite(val)) return 32;
  return Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(val)));
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
  const [widthInput, setWidthInput] = useState('32');
  const [heightInput, setHeightInput] = useState('32');
  const [aspectLocked, setAspectLocked] = useState(false);
  const [lockedRatio, setLockedRatio] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>('indexed');
  const [paletteId, setPaletteId] = useState<string>(ENDESGA_64_PALETTE.id);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset defaults & select title text when opened
  useEffect(() => {
    if (!isOpen) return;
    const defaultTitle = `Untitled-${existingProjectCount + 1}`;
    setTitle(defaultTitle);
    setWidth(32);
    setHeight(32);
    setWidthInput('32');
    setHeightInput('32');
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

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

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

  // Compute proportional frame preview size inside 136x56 stage
  const previewRect = useMemo(() => {
    const maxW = 136;
    const maxH = 56;
    const ratio = width / height;
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

  if (!isOpen) return null;

  const applyDimensions = (nextW: number, nextH: number) => {
    const cw = clampDim(nextW);
    const ch = clampDim(nextH);
    setWidth(cw);
    setHeight(ch);
    setWidthInput(String(cw));
    setHeightInput(String(ch));
  };

  const handleSelectPreset = (preset: CanvasPreset) => {
    applyDimensions(preset.width, preset.height);
    if (aspectLocked) {
      setLockedRatio(preset.width / preset.height);
    }
  };

  const handleToggleAspectLock = () => {
    const next = !aspectLocked;
    setAspectLocked(next);
    if (next) {
      setLockedRatio(width / Math.max(1, height));
    }
  };

  const handleSwapDimensions = () => {
    const nextW = height;
    const nextH = width;
    applyDimensions(nextW, nextH);
    if (aspectLocked) {
      setLockedRatio(nextW / Math.max(1, nextH));
    }
  };

  const handleWidthChange = (raw: string) => {
    const sanitized = raw.replace(/[^0-9]/g, '');
    setWidthInput(sanitized);
    const parsed = parseInt(sanitized, 10);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      const clampedW = clampDim(parsed);
      setWidth(clampedW);
      if (aspectLocked) {
        const linkedH = clampDim(clampedW / lockedRatio);
        setHeight(linkedH);
        setHeightInput(String(linkedH));
      }
    }
  };

  const handleHeightChange = (raw: string) => {
    const sanitized = raw.replace(/[^0-9]/g, '');
    setHeightInput(sanitized);
    const parsed = parseInt(sanitized, 10);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      const clampedH = clampDim(parsed);
      setHeight(clampedH);
      if (aspectLocked) {
        const linkedW = clampDim(clampedH * lockedRatio);
        setWidth(linkedW);
        setWidthInput(String(linkedW));
      }
    }
  };

  const handleWidthBlur = () => {
    const parsed = parseInt(widthInput, 10);
    const clampedW = clampDim(Number.isNaN(parsed) ? width : parsed);
    if (aspectLocked) {
      const linkedH = clampDim(clampedW / lockedRatio);
      applyDimensions(clampedW, linkedH);
    } else {
      setWidth(clampedW);
      setWidthInput(String(clampedW));
    }
  };

  const handleHeightBlur = () => {
    const parsed = parseInt(heightInput, 10);
    const clampedH = clampDim(Number.isNaN(parsed) ? height : parsed);
    if (aspectLocked) {
      const linkedW = clampDim(clampedH * lockedRatio);
      applyDimensions(linkedW, clampedH);
    } else {
      setHeight(clampedH);
      setHeightInput(String(clampedH));
    }
  };

  const handleDimKeyDown = (
    axis: 'w' | 'h',
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = e.shiftKey ? 8 : 1;
    const delta = e.key === 'ArrowUp' ? step : -step;
    if (axis === 'w') {
      const nextW = clampDim(width + delta);
      if (aspectLocked) {
        applyDimensions(nextW, clampDim(nextW / lockedRatio));
      } else {
        setWidth(nextW);
        setWidthInput(String(nextW));
      }
    } else {
      const nextH = clampDim(height + delta);
      if (aspectLocked) {
        applyDimensions(clampDim(nextH * lockedRatio), nextH);
      } else {
        setHeight(nextH);
        setHeightInput(String(nextH));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalW = clampDim(parseInt(widthInput, 10) || width);
    const finalH = clampDim(parseInt(heightInput, 10) || height);
    onCreate({
      width: finalW,
      height: finalH,
      colorMode,
      title: title.trim() || `Untitled-${existingProjectCount + 1}`,
      paletteId,
    });
    onClose();
  };

  const spritePresets = CANVAS_PRESETS.filter((p) => p.group === 'Sprites');
  const displayPresets = CANVAS_PRESETS.filter((p) => p.group === 'Displays');

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-[2px] flex justify-center items-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
    >
      <form
        className="w-full max-w-[600px] max-h-[92vh] bg-card border border-white/[0.1] shadow-[0_24px_64px_rgba(0,0,0,0.65)] rounded-[12px] overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Minimal Figma-style Title Bar */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-white/[0.08] shrink-0">
          <h2
            id="new-project-title"
            className="text-[13px] font-semibold tracking-[-0.01em] text-foreground"
          >
            New project
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Two-Pane Body */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-y-auto sm:overflow-hidden">
          {/* Left Pane: Presets (Desktop sidebar, Mobile horizontal strip) */}
          <aside className="sm:w-[206px] shrink-0 bg-background/55 border-b sm:border-b-0 sm:border-r border-white/[0.08] p-3 flex flex-col gap-3 sm:overflow-y-auto">
            {/* Mobile compact horizontal preset strip */}
            <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {CANVAS_PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`h-8 px-2.5 rounded-[6px] text-[12px] whitespace-nowrap shrink-0 flex items-center gap-1.5 border transition-colors ${
                      isActive
                        ? 'bg-primary/15 border-primary/50 text-foreground font-medium'
                        : 'bg-background/60 border-white/[0.08] text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isActive ? 'text-primary' : 'text-muted-foreground/70'
                      }`}
                    >
                      {preset.width}×{preset.height}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Desktop grouped list */}
            <div className="hidden sm:flex flex-col gap-3.5">
              <div className="flex flex-col gap-0.5">
                <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/80">
                  Sprites
                </div>
                {spritePresets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`h-7 px-2 rounded-[6px] flex items-center justify-between text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'bg-primary/15 text-foreground font-medium'
                          : 'text-foreground/85 hover:bg-white/[0.06] hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{preset.label}</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ml-2 ${
                          isActive ? 'text-primary' : 'text-muted-foreground/75'
                        }`}
                      >
                        {preset.width}×{preset.height}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-white/[0.06] mx-1" />

              <div className="flex flex-col gap-0.5">
                <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/80">
                  Displays
                </div>
                {displayPresets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`h-7 px-2 rounded-[6px] flex items-center justify-between text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'bg-primary/15 text-foreground font-medium'
                          : 'text-foreground/85 hover:bg-white/[0.06] hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{preset.label}</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ml-2 ${
                          isActive ? 'text-primary' : 'text-muted-foreground/75'
                        }`}
                      >
                        {preset.width}×{preset.height}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Pane: Inspector & Live Frame Preview */}
          <div className="flex-1 p-4 sm:p-5 flex flex-col gap-4 sm:overflow-y-auto">
            {/* Live Figma Frame Stage */}
            <div
              className="h-[96px] rounded-[8px] border border-white/[0.07] bg-background/75 relative flex items-center justify-center overflow-hidden select-none"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '12px 12px',
              }}
              aria-hidden="true"
            >
              <div className="relative flex flex-col items-start">
                <span className="text-[10px] leading-none font-medium text-primary/90 mb-1 max-w-[160px] truncate">
                  {title.trim() || `Untitled-${existingProjectCount + 1}`}
                </span>
                <div
                  className="relative border border-primary/90 shadow-sm transition-all duration-150 ease-out"
                  style={{
                    width: `${previewRect.width}px`,
                    height: `${previewRect.height}px`,
                    backgroundImage:
                      'linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {/* Figma Selection Corner Handles */}
                  <span className="absolute -top-[3px] -left-[3px] w-[5px] h-[5px] bg-white border border-primary" />
                  <span className="absolute -top-[3px] -right-[3px] w-[5px] h-[5px] bg-white border border-primary" />
                  <span className="absolute -bottom-[3px] -left-[3px] w-[5px] h-[5px] bg-white border border-primary" />
                  <span className="absolute -bottom-[3px] -right-[3px] w-[5px] h-[5px] bg-white border border-primary" />
                </div>
              </div>

              <div className="absolute bottom-2 right-2.5 flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                <span>
                  {width} × {height} px
                </span>
                <span aria-hidden="true">·</span>
                <span>{aspectRatioLabel}</span>
              </div>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-name-input"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Name
              </label>
              <input
                ref={titleInputRef}
                id="project-name-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Untitled-${existingProjectCount + 1}`}
                className="h-8 w-full bg-background/80 border border-white/[0.1] hover:border-white/[0.18] focus:border-primary rounded-[6px] px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors"
              />
            </div>

            {/* Dimensions (Figma W / Lock / H / Swap) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Dimensions
                </span>
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70">
                  1 – 1024 px
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="flex-1 h-8 flex items-center bg-background/80 border border-white/[0.1] hover:border-white/[0.18] focus-within:border-primary rounded-[6px] px-2.5 gap-2 transition-colors cursor-text">
                  <span className="text-[11px] font-medium text-muted-foreground select-none">
                    W
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Width in pixels"
                    value={widthInput}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    onBlur={handleWidthBlur}
                    onKeyDown={(e) => handleDimKeyDown('w', e)}
                    className="w-full min-w-0 bg-transparent text-[12px] font-mono tabular-nums text-foreground outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleToggleAspectLock}
                  title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  aria-label="Toggle aspect ratio lock"
                  aria-pressed={aspectLocked}
                  className={`w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    aspectLocked
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                  }`}
                >
                  {aspectLocked ? <Link2 size={14} /> : <Unlink2 size={14} />}
                </button>

                <label className="flex-1 h-8 flex items-center bg-background/80 border border-white/[0.1] hover:border-white/[0.18] focus-within:border-primary rounded-[6px] px-2.5 gap-2 transition-colors cursor-text">
                  <span className="text-[11px] font-medium text-muted-foreground select-none">
                    H
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Height in pixels"
                    value={heightInput}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    onBlur={handleHeightBlur}
                    onKeyDown={(e) => handleDimKeyDown('h', e)}
                    className="w-full min-w-0 bg-transparent text-[12px] font-mono tabular-nums text-foreground outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSwapDimensions}
                  title="Swap width and height"
                  aria-label="Swap width and height"
                  className="w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ArrowLeftRight size={13} />
                </button>
              </div>
            </div>

            {/* Color Mode Segmented Control */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Color mode
                </span>
                <span className="text-[11px] text-muted-foreground/75 truncate">
                  {colorMode === 'indexed'
                    ? 'Palette-locked · 8-bit'
                    : 'Full color with alpha · 32-bit'}
                </span>
              </div>
              <div
                className="grid grid-cols-2 p-[3px] bg-background/80 border border-white/[0.08] rounded-[7px]"
                role="radiogroup"
                aria-label="Color mode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={colorMode === 'indexed'}
                  onClick={() => setColorMode('indexed')}
                  className={`h-7 rounded-[5px] text-[12px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    colorMode === 'indexed'
                      ? 'bg-card text-foreground font-medium shadow-xs border border-white/[0.08]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Indexed
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={colorMode === 'rgba'}
                  onClick={() => setColorMode('rgba')}
                  className={`h-7 rounded-[5px] text-[12px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    colorMode === 'rgba'
                      ? 'bg-card text-foreground font-medium shadow-xs border border-white/[0.08]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  RGBA
                </button>
              </div>
            </div>

            {/* Starting Palette Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Palette
              </span>
              <div className="flex flex-col gap-1" role="radiogroup" aria-label="Starting palette">
                {PALETTES.map((pal) => {
                  const isSelected = paletteId === pal.id;
                  // Pick up to 7 evenly distributed swatches for preview
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
                      className={`h-8 px-2.5 rounded-[6px] border flex items-center justify-between gap-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isSelected
                          ? 'bg-primary/10 border-primary/60 text-foreground font-medium'
                          : 'bg-background/60 border-white/[0.07] text-foreground/85 hover:border-white/[0.15] hover:bg-background/85'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center rounded-[3px] overflow-hidden border border-white/[0.1] shrink-0">
                          {previewColors.map((hex, i) => (
                            <span
                              key={i}
                              className="w-2.5 h-3 block"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        <span className="truncate">{pal.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80">
                          {pal.colors.length}
                        </span>
                        <span className="w-3.5 flex items-center justify-center">
                          {isSelected && <Check size={13} className="text-primary" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.08] bg-background/35 flex items-center justify-between gap-3 shrink-0">
          <span className="hidden sm:inline text-[11px] text-muted-foreground/70">
            Enter to create · Esc to cancel
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-[6px] text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-4 rounded-[6px] text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Create
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
