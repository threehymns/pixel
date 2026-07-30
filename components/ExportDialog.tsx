import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProjectState } from '../types';
import {
  renderScaledFrameCanvas,
  renderCustomSpriteSheetCanvas,
  generateGifBlob,
  downloadBlob,
} from '../utils/exportUtils';
import { encodeAseprite } from '../utils/aseprite';
import { CustomSlider } from './ui/slider';
import {
  X,
  Download,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Image as ImageIcon,
  Film,
  Grid as GridIcon,
  Sparkles,
  Loader2,
  Layers,
  FileCode,
  Check,
} from 'lucide-react';

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
  if (!isOpen) return null;

  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [scale, setScale] = useState<number>(8); // Default 8x scale for crisp pixel art
  const [filename, setFilename] = useState<string>(state.title || 'pixel-art');

  // Background options
  const [bgType, setBgType] = useState<'transparent' | 'color'>('transparent');
  const [bgColor, setBgColor] = useState<string>('#ffffff');

  // Single PNG options
  const [pngFrameIndex, setPngFrameIndex] = useState<number>(state.activeFrameIndex);

  // GIF options
  const [fps, setFps] = useState<number>(10);
  const [gifLoop, setGifLoop] = useState<number>(0); // 0 = infinite
  const [frameRange, setFrameRange] = useState<'all' | 'current' | 'selected'>('all');

  // Sprite Sheet options
  const [columns, setColumns] = useState<number>(0); // 0 = 1 horizontal row

  // Preview state for GIF
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [previewFrame, setPreviewFrame] = useState<number>(0);

  // Export progress
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Target frames calculation based on frameRange
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

  // Handle animation timer for GIF live preview
  useEffect(() => {
    if (format !== 'gif' || !isPlaying || targetFrames.length <= 1) return;

    const intervalMs = 1000 / Math.max(1, fps);
    const timer = setInterval(() => {
      setPreviewFrame((prev) => {
        const next = (prev + 1) % targetFrames.length;
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [format, isPlaying, fps, targetFrames.length]);

  // Keep previewFrame in bounds if targetFrames changes
  useEffect(() => {
    if (previewFrame >= targetFrames.length) {
      setPreviewFrame(0);
    }
  }, [targetFrames.length]);

  // Render Live Preview to preview Canvas
  useEffect(() => {
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

  // Dimensions display
  const getDimensionsText = (): string => {
    const w = state.width * scale;
    const h = state.height * scale;

    if (format === 'spritesheet') {
      const cols = columns > 0 ? columns : targetFrames.length;
      const rows = Math.ceil(targetFrames.length / Math.max(1, cols));
      return `${cols * w} × ${rows * h} px (${targetFrames.length} frames)`;
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div
        className="w-full max-w-[720px] max-h-[88vh] bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col text-xs outline-none select-none relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Download size={15} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground">
                Export Canvas Project
              </h2>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                Export pixel art as PNG, Animated GIF, Sprite Sheet, or Aseprite file
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Format Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setFormat('gif')}
              className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                format === 'gif'
                  ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-2xs'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Film size={15} className={format === 'gif' ? 'text-primary' : ''} />
                <span className="text-xs font-semibold">Animated GIF</span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Looping frame animation
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('png')}
              className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                format === 'png'
                  ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-2xs'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <ImageIcon size={15} className={format === 'png' ? 'text-primary' : ''} />
                <span className="text-xs font-semibold">Single Frame</span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                High quality PNG image
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('spritesheet')}
              className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                format === 'spritesheet'
                  ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-2xs'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <GridIcon
                  size={15}
                  className={format === 'spritesheet' ? 'text-primary' : ''}
                />
                <span className="text-xs font-semibold">Sprite Sheet</span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Grid of frame strip
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('aseprite')}
              className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                format === 'aseprite'
                  ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-2xs'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Layers
                  size={15}
                  className={format === 'aseprite' ? 'text-primary' : ''}
                />
                <span className="text-xs font-semibold">Aseprite (.ase)</span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Native layer & slice data
              </span>
            </button>
          </div>

          {/* Controls & Preview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Column: Settings (7 cols) */}
            <div className="md:col-span-7 flex flex-col gap-3">
              {/* Output Resolution / Scale */}
              <div className="p-2.5 bg-muted/30 border border-border/40 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Export Scale</span>
                  <span className="font-mono text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-md font-semibold">
                    {scale}x ({state.width * scale}×{state.height * scale} px)
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {[1, 2, 4, 8, 16, 32].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScale(s)}
                      className={`py-1 text-[11px] font-mono font-medium rounded-md border transition-all ${
                        scale === s
                          ? 'bg-primary text-primary-foreground border-primary font-bold shadow-2xs'
                          : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                <CustomSlider
                  min={1}
                  max={32}
                  step={1}
                  value={scale}
                  onValueChange={(val) => setScale(val)}
                />
              </div>

              {/* Background Option */}
              <div className="p-2.5 bg-muted/30 border border-border/40 rounded-xl flex flex-col gap-2">
                <span className="text-xs font-medium text-foreground">Background</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBgType('transparent')}
                    className={`flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                      bgType === 'transparent'
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded border border-border bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:5px_5px]" />
                    <span>Transparent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBgType('color')}
                    className={`flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                      bgType === 'color'
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded border border-border shadow-2xs shrink-0"
                      style={{ backgroundColor: bgColor }}
                    />
                    <span>Solid Color</span>
                  </button>
                </div>

                {bgType === 'color' && (
                  <div className="flex items-center gap-1.5 pt-1 animate-in fade-in duration-150">
                    {['#ffffff', '#000000', '#1e293b', '#10b981', '#3b82f6'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBgColor(color)}
                        className={`w-5 h-5 rounded-md border shadow-2xs transition-transform active:scale-95 ${
                          bgColor === color
                            ? 'ring-2 ring-primary ring-offset-1 scale-105'
                            : 'border-border/60'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="flex items-center gap-1 bg-background border border-border rounded-md px-1.5 py-0.5 ml-auto">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                        title="Custom Color"
                      />
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {bgColor}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Format-Specific Options */}
              {format === 'gif' && (
                <div className="p-2.5 bg-muted/30 border border-border/40 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Frame Rate</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {fps} FPS ({Math.round(1000 / fps)}ms)
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 6, 10, 12, 24].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFps(f)}
                        className={`py-1 text-[10px] font-mono font-medium rounded-md border transition-all ${
                          fps === f
                            ? 'bg-primary text-primary-foreground border-primary font-bold shadow-2xs'
                            : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
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
                    onValueChange={(val) => setFps(val)}
                  />

                  <div className="flex flex-col gap-1 pt-1.5 border-t border-border/40">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Frame Range
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFrameRange('all')}
                        className={`py-1 px-2 rounded-md border text-center text-xs font-medium transition-all ${
                          frameRange === 'all'
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        All Frames ({state.frames.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameRange('current')}
                        className={`py-1 px-2 rounded-md border text-center text-xs font-medium transition-all ${
                          frameRange === 'current'
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Active Frame (# {state.activeFrameIndex + 1})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {format === 'png' && (
                <div className="p-2.5 bg-muted/30 border border-border/40 rounded-xl flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Frame Selection</span>
                  <select
                    value={pngFrameIndex}
                    onChange={(e) => setPngFrameIndex(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                  >
                    {state.frames.map((_, i) => (
                      <option key={i} value={i}>
                        Frame {i + 1}{' '}
                        {i === state.activeFrameIndex ? '(Current Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {format === 'spritesheet' && (
                <div className="p-2.5 bg-muted/30 border border-border/40 rounded-xl flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Layout Columns</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {columns === 0 ? 'Horizontal Strip' : `${columns} Cols`}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 2, 4, 8].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColumns(c)}
                        className={`py-1 text-[10px] font-mono font-medium rounded-md border transition-all ${
                          columns === c
                            ? 'bg-primary text-primary-foreground border-primary font-bold shadow-2xs'
                            : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {c === 0 ? 'Strip' : `${c} Cols`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  File Name
                </label>
                <div className="flex items-center bg-background border border-border rounded-md px-2.5 py-1 text-xs">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 bg-transparent text-foreground outline-none font-medium text-xs"
                    placeholder="pixel-art"
                  />
                  <span className="text-muted-foreground/70 font-mono text-[10px] font-semibold ml-1.5">
                    {getExtension()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Preview (5 cols) */}
            <div className="md:col-span-5 flex flex-col bg-muted/20 border border-border/40 rounded-xl p-3 relative min-h-[220px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Live Preview
                </span>
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                  {getDimensionsText()}
                </span>
              </div>

              {/* Canvas Box */}
              <div className="flex-1 min-h-[160px] flex items-center justify-center relative rounded-lg border border-border/50 overflow-hidden bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:10px_10px] bg-background/50 p-2">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-[170px] object-contain shadow-md rounded"
                  style={{ imageRendering: 'pixelated' }}
                />

                {isExporting && (
                  <div className="absolute inset-0 bg-background/85 backdrop-blur-xs flex flex-col items-center justify-center p-3 z-20 space-y-2 animate-in fade-in-0">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      Generating {format.toUpperCase()}...
                    </span>
                    {format === 'gif' && (
                      <div className="w-3/4 bg-muted rounded-full h-1.5 overflow-hidden border border-border/40">
                        <div
                          className="bg-primary h-full transition-all duration-100"
                          style={{ width: `${exportProgress}%` }}
                        />
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {exportProgress}% Completed
                    </span>
                  </div>
                )}
              </div>

              {/* Animation Playback Controls for GIF */}
              {format === 'gif' && targetFrames.length > 1 && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFrame(
                          (prev) => (prev - 1 + targetFrames.length) % targetFrames.length
                        )
                      }
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Previous Frame"
                    >
                      <SkipBack size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
                      title={isPlaying ? 'Pause Preview' : 'Play Preview'}
                    >
                      {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFrame((prev) => (prev + 1) % targetFrames.length)
                      }
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Next Frame"
                    >
                      <SkipForward size={13} />
                    </button>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground">
                    Frame {previewFrame + 1} / {targetFrames.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-border/60 bg-muted/20 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles size={12} className="text-primary shrink-0" />
            <span>Preserves visible layers, blend modes, and pixel scale</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-xs disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg shadow-xs hover:bg-primary/90 transition-colors text-xs disabled:opacity-50"
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
          </div>
        </div>
      </div>
    </div>
  );
};
