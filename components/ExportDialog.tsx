import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProjectState } from '../types';
import {
  renderScaledFrameCanvas,
  renderCustomSpriteSheetCanvas,
  generateGifBlob,
  downloadBlob,
} from '../utils/exportUtils';
import { encodeAseprite } from '../utils/aseprite';
import { ModalShell } from './ui/dialog';
import { Input } from './ui/input';
import { CustomSlider } from './ui/slider';
import { StudioSelect } from './ui/select';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import {
  Download,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ImageIcon,
  Film,
  GridIcon,
  Loader2,
  Layers,
} from './Icons';
import { cn } from '../lib/utils';

export type ExportFormat = 'png' | 'gif' | 'spritesheet' | 'aseprite';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  initialFormat?: ExportFormat;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  state,
  initialFormat = 'gif',
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [scale, setScale] = useState<number>(8);
  const [filename, setFilename] = useState<string>(state.title || 'pixel-art');

  const [bgType, setBgType] = useState<'transparent' | 'color'>('transparent');
  const [bgColor, setBgColor] = useState<string>('#ffffff');

  const [pngFrameIndex, setPngFrameIndex] = useState<number>(state.activeFrameIndex);

  const [fps, setFps] = useState<number>(10);
  const [gifLoop] = useState<number>(0);
  const [frameRange, setFrameRange] = useState<'all' | 'current' | 'selected'>('all');

  const [columns, setColumns] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [previewFrame, setPreviewFrame] = useState<number>(0);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormat(initialFormat);
    setFilename(state.title || 'pixel-art');
    setPngFrameIndex(state.activeFrameIndex);
    setPreviewFrame(0);
    setIsExporting(false);
    setExportProgress(0);
  }, [isOpen, initialFormat, state.title, state.activeFrameIndex]);

  const targetFrames = useMemo(() => {
    if (frameRange === 'current') {
      return [state.activeFrameIndex];
    }
    if (
      frameRange === 'selected' &&
      state.selectedFrameIndices &&
      state.selectedFrameIndices.length > 0
    ) {
      return state.selectedFrameIndices;
    }
    return state.frames.map((_, i) => i);
  }, [frameRange, state.activeFrameIndex, state.selectedFrameIndices, state.frames]);

  useEffect(() => {
    if (!isOpen || format !== 'gif' || !isPlaying || targetFrames.length <= 1) return;

    const intervalMs = 1000 / Math.max(1, fps);
    const timer = setInterval(() => {
      setPreviewFrame((prev) => (prev + 1) % targetFrames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isOpen, format, isPlaying, fps, targetFrames.length]);

  useEffect(() => {
    if (previewFrame >= targetFrames.length) {
      setPreviewFrame(0);
    }
  }, [previewFrame, targetFrames.length]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentBg = bgType === 'transparent' ? null : bgColor;

    if (format === 'png') {
      const rendered = renderScaledFrameCanvas(state, pngFrameIndex, 1, currentBg);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rendered, 0, 0);
    } else if (format === 'gif') {
      const activeIdx = targetFrames[previewFrame] ?? state.activeFrameIndex;
      const rendered = renderScaledFrameCanvas(state, activeIdx, 1, currentBg);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rendered, 0, 0);
    } else if (format === 'spritesheet') {
      const cols = columns > 0 ? columns : targetFrames.length;
      const sheetCanvas = renderCustomSpriteSheetCanvas({
        state,
        scale: 1,
        columns: cols,
        frameIndices: targetFrames,
        backgroundColor: currentBg,
      });
      canvas.width = sheetCanvas.width;
      canvas.height = sheetCanvas.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheetCanvas, 0, 0);
    } else if (format === 'aseprite') {
      const activeIdx = state.activeFrameIndex;
      const rendered = renderScaledFrameCanvas(state, activeIdx, 1, currentBg);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rendered, 0, 0);
    }
  }, [
    isOpen,
    format,
    scale,
    bgType,
    bgColor,
    pngFrameIndex,
    previewFrame,
    targetFrames,
    columns,
    state,
  ]);

  const frameSelectOptions = useMemo(
    () =>
      state.frames.map((_, i) => ({
        value: String(i),
        label: `Frame ${i + 1}${i === state.activeFrameIndex ? ' (Active)' : ''}`,
      })),
    [state.frames, state.activeFrameIndex]
  );

  const getDimensionsText = (): string => {
    const w = state.width * scale;
    const h = state.height * scale;
    if (format === 'spritesheet') {
      const cols = columns > 0 ? columns : targetFrames.length;
      const rows = Math.ceil(targetFrames.length / Math.max(1, cols));
      return `${cols * w} × ${rows * h} px (${targetFrames.length}f)`;
    }
    return `${w} × ${h} px`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const currentBg = bgType === 'transparent' ? null : bgColor;
      const cleanFilename = filename.trim().replace(/\.[^/.]+$/, '') || 'pixel-art';

      if (format === 'png') {
        const rendered = renderScaledFrameCanvas(state, pngFrameIndex, scale, currentBg);
        rendered.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `${cleanFilename}_frame${pngFrameIndex + 1}.png`);
          }
          setIsExporting(false);
          onClose();
        }, 'image/png');
      } else if (format === 'spritesheet') {
        const cols = columns > 0 ? columns : targetFrames.length;
        const sheetCanvas = renderCustomSpriteSheetCanvas({
          state,
          scale,
          columns: cols,
          frameIndices: targetFrames,
          backgroundColor: currentBg,
        });
        sheetCanvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `${cleanFilename}_spritesheet.png`);
          }
          setIsExporting(false);
          onClose();
        }, 'image/png');
      } else if (format === 'gif') {
        const blob = await generateGifBlob({
          state,
          scale,
          fps,
          loop: gifLoop,
          frameIndices: targetFrames,
          backgroundColor: currentBg,
          transparent: bgType === 'transparent',
          onProgress: (pct) => setExportProgress(pct),
        });
        downloadBlob(blob, `${cleanFilename}.gif`);
        setIsExporting(false);
        onClose();
      } else if (format === 'aseprite') {
        const aseBytes = encodeAseprite(state);
        const blob = new Blob([aseBytes.buffer], { type: 'image/x-aseprite' });
        downloadBlob(blob, `${cleanFilename}.aseprite`);
        setIsExporting(false);
        onClose();
      }
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  const getExtension = () => {
    if (format === 'gif') return '.gif';
    if (format === 'aseprite') return '.aseprite';
    return '.png';
  };

  const formatOptions: {
    id: ExportFormat;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'gif', label: 'Animated GIF', desc: 'Looping animation', icon: <Film size={14} /> },
    { id: 'png', label: 'Single Frame', desc: 'Crisp PNG image', icon: <ImageIcon size={14} /> },
    { id: 'spritesheet', label: 'Sprite Sheet', desc: 'Frame grid strip', icon: <GridIcon size={14} /> },
    { id: 'aseprite', label: 'Aseprite (.ase)', desc: 'Layers & slices', icon: <Layers size={14} /> },
  ];

  return (
    <ModalShell
      open={isOpen}
      onClose={() => {
        if (!isExporting) onClose();
      }}
      title="Export Project"
      subtitle="PNG, Animated GIF, Sprite Sheet, or Aseprite"
      maxWidthClassName="max-w-2xl"
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="h-7 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex h-7 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Download {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </>
      }
    >
      {/* Format Selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {formatOptions.map((opt) => {
          const active = format === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFormat(opt.id)}
              className={cn(
                'flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary/70 bg-primary/10 text-foreground'
                  : 'border-border bg-background/50 text-muted-foreground hover:border-border-strong hover:text-foreground'
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span className={active ? 'text-primary' : 'text-muted-foreground'}>
                  {opt.icon}
                </span>
                <span className="text-xs font-medium text-foreground">{opt.label}</span>
              </div>
              <span className="text-[11px] leading-tight text-muted-foreground">{opt.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Settings & Live Preview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Settings Column */}
        <div className="flex flex-col gap-3 md:col-span-7">
          {/* Scale */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Export Scale</span>
              <span className="font-mono text-[11px] font-medium text-primary tabular-nums">
                {scale}× ({state.width * scale}×{state.height * scale} px)
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {[1, 2, 4, 8, 16, 32].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={cn(
                    'h-7 rounded-md border font-mono text-[11px] font-medium transition-colors tabular-nums',
                    scale === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground'
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
            <CustomSlider
              min={1}
              max={32}
              step={1}
              value={scale}
              onValueChange={setScale}
              aria-label="Export scale"
            />
          </div>

          {/* Background */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
            <span className="text-xs font-medium text-foreground">Background</span>
            <SegmentedControl<'transparent' | 'color'>
              value={bgType}
              onValueChange={(next) => next && setBgType(next as 'transparent' | 'color')}
              aria-label="Export background"
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="transparent">
                <span className="checkerboard-alpha h-3 w-3 rounded-xs border border-border-strong" />
                <span>Transparent</span>
              </SegmentedControlItem>
              <SegmentedControlItem value="color">
                <span
                  className="h-3 w-3 rounded-xs border border-border-strong"
                  style={{ backgroundColor: bgColor }}
                />
                <span>Solid Color</span>
              </SegmentedControlItem>
            </SegmentedControl>

            {bgType === 'color' && (
              <div className="flex items-center gap-1.5 pt-1">
                {['#ffffff', '#000000', '#1e293b', '#10b981', '#3b82f6'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Background color ${color}`}
                    onClick={() => setBgColor(color)}
                    className={cn(
                      'h-5 w-5 rounded-md border transition-transform active:scale-95',
                      bgColor === color
                        ? 'scale-105 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : 'border-border-strong'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    aria-label="Custom background color"
                    className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {bgColor}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* GIF Options */}
          {format === 'gif' && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Frame Rate</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {fps} FPS ({Math.round(1000 / fps)}ms)
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[1, 6, 10, 12, 24].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFps(f)}
                    className={cn(
                      'h-7 rounded-md border font-mono text-[11px] font-medium transition-colors tabular-nums',
                      fps === f
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground'
                    )}
                  >
                    {f} FPS
                  </button>
                ))}
              </div>
              <CustomSlider
                min={1}
                max={30}
                step={1}
                value={fps}
                onValueChange={setFps}
                aria-label="GIF frame rate"
              />

              <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                <span className="text-[11px] font-medium text-muted-foreground">Frame Range</span>
                <SegmentedControl<'all' | 'current'>
                  value={frameRange === 'current' ? 'current' : 'all'}
                  onValueChange={(next) => next && setFrameRange(next as 'all' | 'current')}
                  aria-label="GIF frame range"
                >
                  <SegmentedControlIndicator />
                  <SegmentedControlItem value="all">
                    All ({state.frames.length})
                  </SegmentedControlItem>
                  <SegmentedControlItem value="current">
                    Active (#{state.activeFrameIndex + 1})
                  </SegmentedControlItem>
                </SegmentedControl>
              </div>
            </div>
          )}

          {/* PNG Options */}
          {format === 'png' && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-3">
              <span className="text-xs font-medium text-foreground">Frame Selection</span>
              <StudioSelect
                value={String(pngFrameIndex)}
                options={frameSelectOptions}
                onValueChange={(val) => setPngFrameIndex(Number(val))}
                aria-label="Select frame to export"
              />
            </div>
          )}

          {/* Sprite Sheet Options */}
          {format === 'spritesheet' && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Layout Columns</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {columns === 0 ? 'Horizontal Strip' : `${columns} Cols`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[0, 2, 4, 8].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColumns(c)}
                    className={cn(
                      'h-7 rounded-md border font-mono text-[11px] font-medium transition-colors tabular-nums',
                      columns === c
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground'
                    )}
                  >
                    {c === 0 ? 'Strip' : `${c} Cols`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File Name */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="export-filename-input"
              className="text-[11px] font-medium text-muted-foreground"
            >
              File Name
            </label>
            <div className="flex h-8 items-center rounded-md border border-border bg-background px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
              <Input
                id="export-filename-input"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="pixel-art"
                className="h-full border-0 bg-transparent px-0 focus-visible:ring-0"
              />
              <span className="ml-1.5 font-mono text-[11px] font-medium text-muted-foreground">
                {getExtension()}
              </span>
            </div>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="relative flex min-h-[220px] flex-col rounded-lg border border-border bg-background/50 p-3 md:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Live Preview</span>
            <span className="font-mono text-[11px] text-primary tabular-nums">
              {getDimensionsText()}
            </span>
          </div>

          <div className="checkerboard-alpha relative flex min-h-[160px] flex-1 items-center justify-center overflow-hidden rounded-md border border-border p-3">
            <canvas
              ref={previewCanvasRef}
              className="pixelated max-h-[170px] max-w-full object-contain shadow-md"
            />

            {isExporting && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/90 p-3">
                <Loader2 size={22} className="animate-spin text-primary" />
                <span className="text-xs font-medium text-foreground">
                  Generating {format.toUpperCase()}...
                </span>
                {format === 'gif' && (
                  <div className="h-1.5 w-3/4 overflow-hidden rounded-full border border-border bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-100"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                )}
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {exportProgress}%
                </span>
              </div>
            )}
          </div>

          {format === 'gif' && targetFrames.length > 1 && (
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewFrame(
                      (prev) => (prev - 1 + targetFrames.length) % targetFrames.length
                    )
                  }
                  aria-label="Previous frame"
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <SkipBack size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                  className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFrame((prev) => (prev + 1) % targetFrames.length)}
                  aria-label="Next frame"
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <SkipForward size={13} />
                </button>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {previewFrame + 1} / {targetFrames.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
