import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProjectState } from '../types';
import { renderFrameToCanvas } from '../utils';
import { 
  renderScaledFrameCanvas, 
  renderCustomSpriteSheetCanvas, 
  generateGifBlob, 
  downloadBlob 
} from '../utils/exportUtils';
import { CustomSlider } from './ui/slider';
import { 
  X, Download, Play, Pause, SkipBack, SkipForward, 
  Image as ImageIcon, Film, Grid as GridIcon, Check, Sparkles, Loader2 
} from './Icons';

export type ExportFormat = 'png' | 'gif' | 'spritesheet';

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
  initialFormat = 'gif'
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
    if (frameRange === 'selected' && state.selectedFrameIndices && state.selectedFrameIndices.length > 0) {
      return state.selectedFrameIndices;
    }
    return state.frames.map((_, i) => i);
  }, [frameRange, state.activeFrameIndex, state.selectedFrameIndices, state.frames]);

  // Handle animation timer for GIF live preview
  useEffect(() => {
    if (format !== 'gif' || !isPlaying || targetFrames.length <= 1) return;

    const intervalMs = 1000 / Math.max(1, fps);
    const timer = setInterval(() => {
      setPreviewFrame(prev => {
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
        backgroundColor: currentBg
      });
      canvas.width = sheetCanvas.width;
      canvas.height = sheetCanvas.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheetCanvas, 0, 0);
    }
  }, [
    format, scale, bgType, bgColor, pngFrameIndex, 
    previewFrame, targetFrames, columns, state
  ]);

  // Dimensions display
  const getDimensionsText = (): string => {
    const w = state.width * scale;
    const h = state.height * scale;

    if (format === 'spritesheet') {
      const cols = columns > 0 ? columns : targetFrames.length;
      const rows = Math.ceil(targetFrames.length / Math.max(1, cols));
      return `${cols * w} × ${rows * h} px (${targetFrames.length} frames, ${cols}×${rows} grid)`;
    }

    return `${w} × ${h} px (Base ${state.width} × ${state.height})`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const ext = format === 'gif' ? 'gif' : 'png';
      const currentBg = bgType === 'transparent' ? null : bgColor;
      const cleanFilename = filename.trim().replace(/\.[^/.]+$/, "") || 'pixel-art';

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
          backgroundColor: currentBg
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
          onProgress: (pct) => setExportProgress(pct)
        });
        downloadBlob(blob, `${cleanFilename}.gif`);
        setIsExporting(false);
        onClose();
      }
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-border/30 flex items-center justify-between shrink-0 bg-secondary/30">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Export Canvas Project</h2>
              <p className="text-[11px] text-muted-foreground">Save pixel art as high quality PNG or Animated GIF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format Selector Cards */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setFormat('gif')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                format === 'gif'
                  ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary'
                  : 'bg-secondary/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Film size={22} className="mb-1.5" />
              <span className="text-xs font-bold">Animated GIF</span>
              <span className="text-[10px] opacity-70">Looping frame animation</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('png')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                format === 'png'
                  ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary'
                  : 'bg-secondary/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <ImageIcon size={22} className="mb-1.5" />
              <span className="text-xs font-bold">Single Frame (PNG)</span>
              <span className="text-[10px] opacity-70">Single frame image</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('spritesheet')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                format === 'spritesheet'
                  ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary'
                  : 'bg-secondary/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <GridIcon size={22} className="mb-1.5" />
              <span className="text-xs font-bold">Sprite Sheet (PNG)</span>
              <span className="text-[10px] opacity-70">All frames in a grid</span>
            </button>
          </div>

          {/* Main Controls Grid (Left: Settings, Right: Live Preview) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Settings */}
            <div className="space-y-4">
              {/* Output Resolution / Scale */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Export Scale</span>
                  <span className="font-mono text-primary text-[11px] bg-primary/10 px-2 py-0.5 rounded-md">
                    {scale}x ({state.width * scale}×{state.height * scale} px)
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {[1, 2, 4, 8, 16, 32].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScale(s)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        scale === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground'
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
                  className="mt-2"
                />
              </div>

              {/* Background Style */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground block">Background</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBgType('transparent')}
                    className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                      bgType === 'transparent'
                        ? 'bg-primary/10 border-primary text-primary font-bold'
                        : 'bg-secondary/20 border-border/30 text-muted-foreground'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded border border-border bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:6px_6px]" />
                    <span>Transparent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBgType('color')}
                    className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                      bgType === 'color'
                        ? 'bg-primary/10 border-primary text-primary font-bold'
                        : 'bg-secondary/20 border-border/30 text-muted-foreground'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded border border-border shadow-sm" style={{ backgroundColor: bgColor }} />
                    <span>Solid Color</span>
                  </button>
                </div>

                {bgType === 'color' && (
                  <div className="flex items-center space-x-2 pt-1 animate-in fade-in duration-150">
                    {['#ffffff', '#000000', '#1e293b', '#10b981', '#3b82f6'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBgColor(color)}
                        className={`w-6 h-6 rounded-md border shadow-sm transition-transform active:scale-90 ${
                          bgColor === color ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'border-border/40'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                      title="Custom Color"
                    />
                  </div>
                )}
              </div>

              {/* Format-Specific Controls */}
              {format === 'gif' && (
                <div className="space-y-3 pt-2 border-t border-border/30">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span>Frame Rate (FPS)</span>
                      <span className="font-mono text-xs text-muted-foreground">{fps} FPS ({Math.round(1000 / fps)}ms)</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 6, 10, 12, 24].map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFps(f)}
                          className={`py-1 text-[11px] font-bold rounded-md border transition-all ${
                            fps === f
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground'
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
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-foreground block">Frame Range</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setFrameRange('all')}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                          frameRange === 'all'
                            ? 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-secondary/20 border-border/30 text-muted-foreground'
                        }`}
                      >
                        All Frames ({state.frames.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrameRange('current')}
                        className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                          frameRange === 'current'
                            ? 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-secondary/20 border-border/30 text-muted-foreground'
                        }`}
                      >
                        Active Frame (# {state.activeFrameIndex + 1})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {format === 'png' && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <span className="text-xs font-bold text-foreground block">Frame Selection</span>
                  <div className="flex items-center space-x-2">
                    <select
                      value={pngFrameIndex}
                      onChange={(e) => setPngFrameIndex(Number(e.target.value))}
                      className="w-full bg-secondary/40 border border-border/50 rounded-lg px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      {state.frames.map((_, i) => (
                        <option key={i} value={i}>
                          Frame {i + 1} {i === state.activeFrameIndex ? '(Current Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {format === 'spritesheet' && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span>Layout Columns</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {columns === 0 ? 'Horizontal Strip (1 Row)' : `${columns} Columns`}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 2, 4, 8].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColumns(c)}
                        className={`py-1 text-[11px] font-bold rounded-md border transition-all ${
                          columns === c
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {c === 0 ? 'Horizontal' : `${c} Cols`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File Name Input */}
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <span className="text-xs font-bold text-foreground block">File Name</span>
                <div className="flex items-center bg-secondary/40 border border-border/50 rounded-lg px-3 py-1.5 text-xs">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 bg-transparent text-foreground outline-none font-medium"
                    placeholder="Enter file name..."
                  />
                  <span className="text-muted-foreground/60 font-mono text-[11px] ml-2">
                    .{format === 'gif' ? 'gif' : 'png'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Preview */}
            <div className="flex flex-col bg-secondary/20 border border-border/30 rounded-xl p-4 overflow-hidden relative min-h-[260px]">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span>Live Preview</span>
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {getDimensionsText()}
                </span>
              </div>

              {/* Canvas Preview Container */}
              <div className="flex-1 min-h-0 flex items-center justify-center relative rounded-lg border border-border/30 overflow-hidden bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:12px_12px] bg-card/60 p-4">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-[200px] object-contain shadow-lg rounded"
                  style={{ imageRendering: 'pixelated' }}
                />

                {isExporting && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 space-y-3 animate-in fade-in">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span className="text-xs font-bold text-foreground">Generating {format.toUpperCase()}...</span>
                    {format === 'gif' && (
                      <div className="w-3/4 bg-secondary rounded-full h-2 overflow-hidden border border-border/40">
                        <div
                          className="bg-primary h-full transition-all duration-100"
                          style={{ width: `${exportProgress}%` }}
                        />
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground">{exportProgress}% Completed</span>
                  </div>
                )}
              </div>

              {/* Animated GIF Playback Controls */}
              {format === 'gif' && targetFrames.length > 1 && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setPreviewFrame(prev => (prev - 1 + targetFrames.length) % targetFrames.length)}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Previous Frame"
                    >
                      <SkipBack size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                      title={isPlaying ? "Pause Preview" : "Play Preview"}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewFrame(prev => (prev + 1) % targetFrames.length)}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Next Frame"
                    >
                      <SkipForward size={14} />
                    </button>
                  </div>

                  <span className="text-xs font-mono text-muted-foreground">
                    Frame {previewFrame + 1} / {targetFrames.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 px-6 border-t border-border/30 bg-secondary/30 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-muted-foreground flex items-center space-x-1">
            <Sparkles size={12} className="text-primary" />
            <span>Respects active layers, blend modes, and opacity</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
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
