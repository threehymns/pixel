import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectState } from '../types';
import { 
  OutlineOptions, 
  OutlineMatrix, 
  OutlinePlacement, 
  OutlineShapePreset,
  DEFAULT_OUTLINE_MATRIX, 
  MATRIX_PRESETS, 
  applyOutlineEffect 
} from '../utils/outline';
import { 
  X, 
  RotateCcw,
  ArrowUpLeft,
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ArrowDownLeft,
  ArrowDown,
  ArrowDownRight
} from 'lucide-react';

interface OutlineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onPreview: (previewState: ProjectState) => void;
  onConfirm: (finalState: ProjectState, actionSummary: string) => void;
  onCancel: (originalState?: ProjectState) => void;
}

export const OutlineDialog: React.FC<OutlineDialogProps> = ({
  isOpen,
  onClose,
  state,
  onPreview,
  onConfirm,
  onCancel
}) => {
  const [placement, setPlacement] = useState<OutlinePlacement>('outside');
  const [matrix, setMatrix] = useState<OutlineMatrix>(DEFAULT_OUTLINE_MATRIX);
  const [shapePreset, setShapePreset] = useState<OutlineShapePreset>('circle');
  const [thickness, setThickness] = useState<number>(1);
  const [outlineColor, setOutlineColor] = useState<string>(state.primaryColor || '#000000');
  const [bgMode, setBgMode] = useState<'transparent' | 'color'>('transparent');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [targetLayer, setTargetLayer] = useState<'active' | 'new'>('active');
  const [targetFrames, setTargetFrames] = useState<'current' | 'all'>('current');
  const [limitToSelection, setLimitToSelection] = useState<boolean>(!!state.selection && state.selection.size > 0);
  const [livePreview, setLivePreview] = useState<boolean>(true);

  // Snapshot of original state when dialog was opened
  const originalStateRef = useRef<ProjectState>(state);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const isConfirmedRef = useRef(false);
  const hasPreviewAppliedRef = useRef(false);
  const lastPreviewHashRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      originalStateRef.current = state;
      isConfirmedRef.current = false;
      hasPreviewAppliedRef.current = false;
      lastPreviewHashRef.current = '';
      setOutlineColor(state.primaryColor || '#000000');
      setLimitToSelection(!!state.selection && state.selection.size > 0);
    } else {
      if (!isConfirmedRef.current && hasPreviewAppliedRef.current) {
        onCancelRef.current(originalStateRef.current);
        hasPreviewAppliedRef.current = false;
      }
      lastPreviewHashRef.current = '';
    }
  }, [isOpen]);

  const outlineOptions = useMemo<OutlineOptions>(() => ({
    placement,
    matrix,
    thickness,
    outlineColor,
    bgMode,
    bgColor: bgMode === 'color' ? bgColor : undefined,
    scope: limitToSelection ? 'selection' : 'canvas',
    targetLayer,
    targetFrames
  }), [
    placement,
    matrix,
    thickness,
    outlineColor,
    bgMode,
    bgColor,
    limitToSelection,
    targetLayer,
    targetFrames
  ]);

  // Compute live preview safely without infinite re-render loops
  useEffect(() => {
    if (!isOpen) return;

    if (!livePreview) {
      if (lastPreviewHashRef.current !== 'reverted') {
        lastPreviewHashRef.current = 'reverted';
        onPreviewRef.current(originalStateRef.current);
        hasPreviewAppliedRef.current = false;
      }
      return;
    }

    const previewHash = `${placement}:${matrix.nw ? 1 : 0}${matrix.n ? 1 : 0}${matrix.ne ? 1 : 0}${matrix.w ? 1 : 0}${matrix.e ? 1 : 0}${matrix.sw ? 1 : 0}${matrix.s ? 1 : 0}${matrix.se ? 1 : 0}:${thickness}:${outlineColor}:${bgMode}:${bgColor}:${limitToSelection ? 1 : 0}:${targetLayer}:${targetFrames}`;

    if (lastPreviewHashRef.current === previewHash) {
      return;
    }
    lastPreviewHashRef.current = previewHash;

    try {
      const { newState } = applyOutlineEffect(originalStateRef.current, outlineOptions);
      hasPreviewAppliedRef.current = true;
      onPreviewRef.current(newState);
    } catch (e) {
      console.warn("Outline preview failed", e);
    }
  }, [isOpen, outlineOptions, livePreview]);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: OutlineShapePreset) => {
    setShapePreset(preset);
    setMatrix({ ...MATRIX_PRESETS[preset] });
  };

  const toggleDirection = (dir: keyof OutlineMatrix) => {
    const updated = { ...matrix, [dir]: !matrix[dir] };
    setMatrix(updated);
    setShapePreset('custom');
  };

  const handleInvertMatrix = () => {
    setMatrix({
      nw: !matrix.nw,
      n: !matrix.n,
      ne: !matrix.ne,
      w: !matrix.w,
      e: !matrix.e,
      sw: !matrix.sw,
      s: !matrix.s,
      se: !matrix.se
    });
    setShapePreset('custom');
  };

  const handleReset = () => {
    setPlacement('outside');
    setMatrix(DEFAULT_OUTLINE_MATRIX);
    setShapePreset('circle');
    setThickness(1);
    setOutlineColor(originalStateRef.current.primaryColor || '#000000');
    setBgMode('transparent');
    setTargetLayer('active');
    setTargetFrames('current');
    setLimitToSelection(!!originalStateRef.current.selection && originalStateRef.current.selection.size > 0);
  };

  const handleCancel = () => {
    if (!isConfirmedRef.current && hasPreviewAppliedRef.current) {
      onCancelRef.current(originalStateRef.current);
      hasPreviewAppliedRef.current = false;
    }
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    isConfirmedRef.current = true;
    hasPreviewAppliedRef.current = false;
    const { newState, actionSummary } = applyOutlineEffect(originalStateRef.current, outlineOptions);
    onConfirmRef.current(newState, actionSummary);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleCancel();
    } else if (e.key === 'Enter' && !e.shiftKey && (e.target instanceof HTMLInputElement === false)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasSelection = !!state.selection && state.selection.size > 0;
  const isAnimated = state.frames.length > 1;

  // Swatches: pick representative distinct colors from the active palette
  const paletteSwatches = state.palette.slice(0, 8);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none animate-in fade-in-0 duration-150"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <form 
        className="w-[280px] bg-popover text-popover-foreground border border-border shadow-2xl rounded-lg p-3 flex flex-col gap-2.5 text-xs select-none outline-none relative"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
          <span className="font-semibold text-xs text-foreground">Outline</span>
          <button 
            type="button" 
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
            title="Close (Esc)"
          >
            <X size={13} />
          </button>
        </div>

        {/* Placement */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Placement</label>
          <div className="grid grid-cols-3 gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50 w-full">
            <button
              type="button"
              onClick={() => setPlacement('outside')}
              className={`py-1 rounded text-[11px] font-medium transition-colors ${
                placement === 'outside'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Outside
            </button>
            <button
              type="button"
              onClick={() => setPlacement('inside')}
              className={`py-1 rounded text-[11px] font-medium transition-colors ${
                placement === 'inside'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inside
            </button>
            <button
              type="button"
              onClick={() => setPlacement('both')}
              className={`py-1 rounded text-[11px] font-medium transition-colors ${
                placement === 'both'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Both
            </button>
          </div>
        </div>

        {/* Shape Presets */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-medium text-muted-foreground">Shape & Direction</label>
            <button
              type="button"
              onClick={handleInvertMatrix}
              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              title="Invert matrix"
            >
              <RotateCcw size={9} />
              <span>Invert</span>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50 w-full">
            <button
              type="button"
              onClick={() => handlePresetSelect('circle')}
              className={`py-0.5 rounded text-[10px] font-medium transition-colors text-center ${
                shapePreset === 'circle'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Cross
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('square')}
              className={`py-0.5 rounded text-[10px] font-medium transition-colors text-center ${
                shapePreset === 'square'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Square
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('horizontal')}
              className={`py-0.5 rounded text-[10px] font-medium transition-colors text-center ${
                shapePreset === 'horizontal'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Horiz
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('vertical')}
              className={`py-0.5 rounded text-[10px] font-medium transition-colors text-center ${
                shapePreset === 'vertical'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Vert
            </button>
          </div>

          {/* 3x3 Matrix Grid */}
          <div className="flex justify-center pt-1">
            <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-md border border-border/50 w-24 h-24">
              <button
                type="button"
                onClick={() => toggleDirection('nw')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.nw
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="North-West"
              >
                <ArrowUpLeft size={11} />
              </button>
              <button
                type="button"
                onClick={() => toggleDirection('n')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.n
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="North"
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                onClick={() => toggleDirection('ne')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.ne
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="North-East"
              >
                <ArrowUpRight size={11} />
              </button>

              <button
                type="button"
                onClick={() => toggleDirection('w')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.w
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="West"
              >
                <ArrowLeft size={11} />
              </button>
              <div className="rounded bg-muted/80 flex items-center justify-center border border-border/30 pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
              </div>
              <button
                type="button"
                onClick={() => toggleDirection('e')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.e
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="East"
              >
                <ArrowRight size={11} />
              </button>

              <button
                type="button"
                onClick={() => toggleDirection('sw')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.sw
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="South-West"
              >
                <ArrowDownLeft size={11} />
              </button>
              <button
                type="button"
                onClick={() => toggleDirection('s')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.s
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="South"
              >
                <ArrowDown size={11} />
              </button>
              <button
                type="button"
                onClick={() => toggleDirection('se')}
                className={`rounded flex items-center justify-center transition-colors ${
                  matrix.se
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-background/80 text-muted-foreground/40 hover:bg-background hover:text-foreground border border-border/30'
                }`}
                title="South-East"
              >
                <ArrowDownRight size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Thickness */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-medium text-muted-foreground">Thickness</label>
            <span className="text-[10px] font-mono text-muted-foreground">{thickness}px</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={thickness}
              onChange={(e) => setThickness(parseInt(e.target.value) || 1)}
              className="flex-1 accent-primary h-1 bg-muted rounded cursor-pointer"
            />
            <input
              type="number"
              min="1"
              max="8"
              value={thickness}
              onChange={(e) => setThickness(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
              className="w-11 bg-background border border-border rounded-md px-1 py-0.5 text-xs font-mono font-medium text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-medium text-muted-foreground">Color</label>
            <button
              type="button"
              onClick={() => setOutlineColor(state.primaryColor)}
              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Use Active
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {paletteSwatches.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  onClick={() => setOutlineColor(c)}
                  className={`w-4 h-4 rounded-full border transition-transform cursor-pointer shrink-0 ${
                    outlineColor.toLowerCase() === c.toLowerCase()
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-popover scale-110 border-white'
                      : 'border-black/10 dark:border-white/10 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <label 
                className="w-4 h-4 rounded-full border border-dashed border-border hover:border-foreground flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden shrink-0" 
                title="Custom color"
              >
                <input
                  type="color"
                  value={outlineColor}
                  onChange={(e) => setOutlineColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <span className="text-[9px] text-muted-foreground font-bold leading-none">+</span>
              </label>
            </div>
            <input
              type="text"
              value={outlineColor}
              onChange={(e) => setOutlineColor(e.target.value)}
              className="w-16 bg-background border border-border rounded-md px-1 py-0.5 text-[11px] font-mono uppercase text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary shrink-0"
            />
          </div>
        </div>

        {/* Background Condition */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-[9px] font-medium text-muted-foreground">Background</label>
          <div className="flex items-center gap-1.5">
            <select
              value={bgMode}
              onChange={(e) => setBgMode(e.target.value as any)}
              className="bg-background border border-border rounded-md px-1.5 py-0.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="transparent">Transparent</option>
              <option value="color">Color</option>
            </select>
            {bgMode === 'color' && (
              <label className="w-4 h-4 rounded border border-border cursor-pointer relative overflow-hidden shrink-0" title="Background color">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-full h-full" style={{ backgroundColor: bgColor }} />
              </label>
            )}
          </div>
        </div>

        {/* Target Layer */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-medium text-muted-foreground">Target Layer</label>
          <div className="grid grid-cols-2 gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50 w-full">
            <button
              type="button"
              onClick={() => setTargetLayer('active')}
              className={`py-1 rounded text-[11px] font-medium transition-colors ${
                targetLayer === 'active'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active Layer
            </button>
            <button
              type="button"
              onClick={() => setTargetLayer('new')}
              className={`py-1 rounded text-[11px] font-medium transition-colors ${
                targetLayer === 'new'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              New Layer
            </button>
          </div>
        </div>

        {/* Target Frames (only if animated) */}
        {isAnimated && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-medium text-muted-foreground">Target Frames</label>
            <div className="grid grid-cols-2 gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50 w-full">
              <button
                type="button"
                onClick={() => setTargetFrames('current')}
                className={`py-1 rounded text-[11px] font-medium transition-colors ${
                  targetFrames === 'current'
                    ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Current Frame
              </button>
              <button
                type="button"
                onClick={() => setTargetFrames('all')}
                className={`py-1 rounded text-[11px] font-medium transition-colors ${
                  targetFrames === 'all'
                    ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Frames
              </button>
            </div>
          </div>
        )}

        {/* Selection Scope Option */}
        {hasSelection && (
          <label className="flex items-center gap-1.5 text-[11px] text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={limitToSelection}
              onChange={(e) => setLimitToSelection(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-primary accent-primary"
            />
            <span>Selected pixels only</span>
          </label>
        )}

        {/* Live Preview Toggle & Reset */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={livePreview}
              onChange={(e) => setLivePreview(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-primary accent-primary"
            />
            <span>Live preview</span>
          </label>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
          >
            Reset
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={handleCancel}
            className="px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-muted text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            Apply
          </button>
        </div>
      </form>
    </div>
  );
};

