import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProjectState } from '../types';
import {
  renderScaledFrameCanvas,
  renderCustomSpriteSheetCanvas,
  generateGifBlob,
  downloadBlob,
} from '../utils/exportUtils';
import { renderFrameToDownsampledCanvas } from '../utils';
import { encodeAsepriteAsync } from '../utils/asepriteWorkerClient';
import { ModalShell } from './ui/dialog';
import { Input } from './ui/input';
import { CustomSlider } from './ui/slider';
import { StudioSelect } from './ui/select';
import { Button, IconButton } from './ui/button';
import { Field, FieldLabel } from './ui/field';
import { Tabs, TabsList, TabsTab, TabsIndicator } from './ui/tabs';
import { ColorSwatchField } from './ui/color-picker';
import { toast } from './ui/toast';
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
  initialFormat,
}) => {
  const resolvedDefaultFormat: ExportFormat =
    initialFormat ?? (state.frames.length > 1 ? 'gif' : 'png');

  const [format, setFormat] = useState<ExportFormat>(resolvedDefaultFormat);
  const [scale, setScale] = useState<number>(() =>
    Math.max(state.width, state.height) >= 512 ? 1 : 8
  );
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
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    const smartDefault: ExportFormat =
      initialFormat ?? (state.frames.length > 1 ? 'gif' : 'png');
    setFormat(smartDefault);
    setScale(Math.max(state.width, state.height) >= 512 ? 1 : 8);
    setFilename(state.title || 'pixel-art');
    setPngFrameIndex(state.activeFrameIndex);
    setPreviewFrame(0);
    setIsExporting(false);
    setExportProgress(0);
  }, [isOpen, initialFormat, state.title, state.activeFrameIndex, state.frames.length, state.width, state.height]);

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

    const currentBg = format === 'aseprite' || bgType === 'transparent' ? null : bgColor;
    const MAX_EXPORT_PREVIEW_DIM = 384;

    const drawDownsampledSingle = (frameIdx: number, bg: string | null) => {
      const rendered = renderFrameToDownsampledCanvas(state, frameIdx, MAX_EXPORT_PREVIEW_DIM);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bg && bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(rendered, 0, 0);
    };

    if (format === 'png') {
      drawDownsampledSingle(pngFrameIndex, currentBg);
    } else if (format === 'gif') {
      const activeIdx = targetFrames[previewFrame] ?? state.activeFrameIndex;
      drawDownsampledSingle(activeIdx, currentBg);
    } else if (format === 'spritesheet') {
      const cols = Math.max(1, columns > 0 ? columns : targetFrames.length);
      const rows = Math.max(1, Math.ceil(targetFrames.length / cols));
      const maxTileDim = Math.max(16, Math.floor(MAX_EXPORT_PREVIEW_DIM / Math.max(cols, rows)));
      const sampleScale = Math.min(1, maxTileDim / Math.max(1, state.width, state.height));
      const tileW = Math.max(1, Math.round(state.width * sampleScale));
      const tileH = Math.max(1, Math.round(state.height * sampleScale));

      canvas.width = cols * tileW;
      canvas.height = rows * tileH;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (currentBg && currentBg !== 'transparent') {
        ctx.fillStyle = currentBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      for (let i = 0; i < targetFrames.length; i++) {
        const tileCanvas = renderFrameToDownsampledCanvas(state, targetFrames[i], maxTileDim);
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.drawImage(tileCanvas, 0, 0, tileCanvas.width, tileCanvas.height, col * tileW, row * tileH, tileW, tileH);
      }
    } else if (format === 'aseprite') {
      drawDownsampledSingle(state.activeFrameIndex, null);
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
    if (format === 'aseprite') {
      return `${state.width} × ${state.height} px · 1× native`;
    }
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

    const currentBg = bgType === 'transparent' ? null : bgColor;
    const cleanFilename = filename.trim().replace(/\.[^/.]+$/, '') || 'pixel-art';
    const cols = columns > 0 ? columns : targetFrames.length;
    const isTransparent = bgType === 'transparent';

    try {
      if (format === 'png') {
        const rendered = renderScaledFrameCanvas(state, pngFrameIndex, scale, currentBg);
        rendered.toBlob((blob) => {
          if (blob) {
            const outName = `${cleanFilename}_frame${pngFrameIndex + 1}.png`;
            downloadBlob(blob, outName);
            toast.success('Exported PNG', { description: outName });
          }
          setIsExporting(false);
          onClose();
        }, 'image/png');
      } else if (format === 'spritesheet') {
        const sheetCanvas = renderCustomSpriteSheetCanvas({
          state,
          scale,
          columns: cols,
          frameIndices: targetFrames,
          backgroundColor: currentBg,
        });
        sheetCanvas.toBlob((blob) => {
          if (blob) {
            const outName = `${cleanFilename}_spritesheet.png`;
            downloadBlob(blob, outName);
            toast.success('Exported Sprite Sheet', { description: outName });
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
          transparent: isTransparent,
          onProgress: (pct) => setExportProgress(pct),
        });
        const outName = `${cleanFilename}.gif`;
        downloadBlob(blob, outName);
        toast.success('Exported Animated GIF', { description: outName });
        setIsExporting(false);
        onClose();
      } else if (format === 'aseprite') {
        const aseBytes = await encodeAsepriteAsync(state);
        const blob = new Blob([aseBytes.buffer as ArrayBuffer], { type: 'image/x-aseprite' });
        const outName = `${cleanFilename}.aseprite`;
        downloadBlob(blob, outName);
        toast.success('Exported Aseprite File', { description: outName });
        setIsExporting(false);
        onClose();
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Unable to encode file.',
      });
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
    icon: React.ReactNode;
  }[] = [
    { id: 'png', label: 'PNG Frame', icon: <ImageIcon size={13} /> },
    { id: 'gif', label: 'Animated GIF', icon: <Film size={13} /> },
    { id: 'spritesheet', label: 'Sprite Sheet', icon: <GridIcon size={13} /> },
    { id: 'aseprite', label: 'Aseprite (.ase)', icon: <Layers size={13} /> },
  ];

  const isRasterExport = format !== 'aseprite';

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
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleExport}
            loading={isExporting}
          >
            {!isExporting && <Download size={13} />}
            <span>{isExporting ? 'Exporting...' : `Download ${format.toUpperCase()}`}</span>
          </Button>
        </>
      }
    >
      <Tabs
        value={format}
        onValueChange={(next) => next && setFormat(next as ExportFormat)}
      >
        <TabsList aria-label="Export format" className="grid w-full grid-cols-2 sm:grid-cols-4">
          {formatOptions.map((opt) => (
            <TabsTab key={opt.id} value={opt.id} className="h-9 gap-1.5">
              {opt.icon}
              <span>{opt.label}</span>
            </TabsTab>
          ))}
          <TabsIndicator className="h-0.5" />
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Settings Column */}
        <div className="flex flex-col gap-3 md:col-span-7">
          {isRasterExport ? (
            <>
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
                        'h-7 rounded-md border font-mono text-[11px] font-medium transition-colors tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      {['#ffffff', '#000000', '#1e293b', '#10b981', '#3b82f6'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Background color ${color}`}
                          onClick={() => setBgColor(color)}
                          className={cn(
                            'h-5 w-5 rounded-md border transition-transform active:scale-95 cursor-pointer',
                            bgColor.toLowerCase() === color.toLowerCase()
                              ? 'scale-105 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                              : 'border-border-strong'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <ColorSwatchField
                      value={bgColor}
                      onChange={setBgColor}
                      label="Custom background color"
                      className="h-7 px-2 text-[11px]"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3.5">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Layers size={14} className="text-primary" />
                <span>Native Aseprite Source Archive</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Exports lossless 1:1 pixel data preserving all layers, blend modes, opacity,
                frames, animation tags, slices, and palette metadata.
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-[11px] font-mono tabular-nums text-muted-foreground">
                <div>{state.layers.length} layers</div>
                <div>{state.frames.length} frames</div>
                <div>{state.tags?.length ?? 0} tags</div>
              </div>
            </div>
          )}

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
                      'h-7 rounded-md border font-mono text-[11px] font-medium transition-colors tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                <FieldLabel>Frame Range</FieldLabel>
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

          {format === 'png' && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-3">
              <FieldLabel>Frame Selection</FieldLabel>
              <StudioSelect
                value={String(pngFrameIndex)}
                options={frameSelectOptions}
                onValueChange={(val) => setPngFrameIndex(Number(val))}
                aria-label="Select frame to export"
              />
            </div>
          )}

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
                      'h-7 rounded-md border font-mono text-[11px] font-medium transition-colors tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

          <Field>
            <FieldLabel htmlFor="export-filename-input">File Name</FieldLabel>
            <div className="flex h-8 items-center rounded-md border border-input bg-background px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
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
          </Field>
        </div>

        {/* Live Preview Column */}
        <div className="relative flex min-h-[220px] flex-col rounded-lg border border-border bg-background/50 p-3 md:col-span-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Live Preview</span>
            <span className="truncate font-mono text-[11px] text-primary tabular-nums">
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
                <IconButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setPreviewFrame(
                      (prev) => (prev - 1 + targetFrames.length) % targetFrames.length
                    )
                  }
                  aria-label="Previous frame"
                >
                  <SkipBack size={13} />
                </IconButton>
                <IconButton
                  type="button"
                  variant="primary"
                  size="xs"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </IconButton>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setPreviewFrame((prev) => (prev + 1) % targetFrames.length)}
                  aria-label="Next frame"
                >
                  <SkipForward size={13} />
                </IconButton>
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
