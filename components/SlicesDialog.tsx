import React, { useState, useEffect } from 'react';
import { Slice, SliceKey, ProjectState } from '../types';
import {
  X,
  Crop,
  Plus,
  Trash2,
  Shield,
  Crosshair,
  Check,
  FileText,
  Layers,
  Palette,
  Info,
} from 'lucide-react';
import { CustomCheckbox } from './ui/checkbox';

interface SlicesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onUpdateSlices: (slices: Slice[]) => void;
}

export const SlicesDialog: React.FC<SlicesDialogProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateSlices,
}) => {
  if (!isOpen) return null;

  const [slices, setSlices] = useState<Slice[]>(state.slices || []);
  const [editingSlice, setEditingSlice] = useState<Slice | null>(null);

  // Form fields for active slice edit
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ef4444');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [w, setW] = useState(16);
  const [h, setH] = useState(16);

  // 9-Patch center bounds
  const [useCenter, setUseCenter] = useState(false);
  const [cx, setCx] = useState(4);
  const [cy, setCy] = useState(4);
  const [cw, setCw] = useState(8);
  const [ch, setCh] = useState(8);

  // Pivot Point
  const [usePivot, setUsePivot] = useState(false);
  const [px, setPx] = useState(8);
  const [py, setPy] = useState(8);

  const [userText, setUserText] = useState('');

  // Keep slices synced if state.slices changes externally
  useEffect(() => {
    setSlices(state.slices || []);
  }, [state.slices]);

  const handleStartAdd = () => {
    const canvasWidth = state?.width || 16;
    const canvasHeight = state?.height || 16;
    const activeIdx = state?.activeFrameIndex || 0;
    const newSlice: Slice = {
      id: `slice_${Date.now()}`,
      name: `Slice ${slices.length + 1}`,
      color: '#ef4444',
      keys: [
        {
          frameIndex: activeIdx,
          x: 0,
          y: 0,
          w: Math.min(16, canvasWidth),
          h: Math.min(16, canvasHeight),
        },
      ],
    };
    startEdit(newSlice);
  };

  const startEdit = (s: Slice) => {
    setEditingSlice(s);
    setName(s.name);
    setColor(s.color || '#ef4444');
    const key = s.keys[0] || { x: 0, y: 0, w: 16, h: 16 };
    setX(key.x);
    setY(key.y);
    setW(key.w);
    setH(key.h);

    if (key.center) {
      setUseCenter(true);
      setCx(key.center.x);
      setCy(key.center.y);
      setCw(key.center.w);
      setCh(key.center.h);
    } else {
      setUseCenter(false);
      setCx(2);
      setCy(2);
      setCw(Math.max(1, key.w - 4));
      setCh(Math.max(1, key.h - 4));
    }

    if (key.pivot) {
      setUsePivot(true);
      setPx(key.pivot.x);
      setPy(key.pivot.y);
    } else {
      setUsePivot(false);
      setPx(Math.floor(key.w / 2));
      setPy(Math.floor(key.h / 2));
    }

    setUserText(s.userData?.text || '');
  };

  const handleSaveSlice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingSlice) return;

    const key: SliceKey = {
      frameIndex: state.activeFrameIndex,
      x: Math.max(0, isNaN(x) ? 0 : x),
      y: Math.max(0, isNaN(y) ? 0 : y),
      w: Math.max(1, isNaN(w) ? 1 : w),
      h: Math.max(1, isNaN(h) ? 1 : h),
      center: useCenter
        ? {
            x: isNaN(cx) ? 0 : cx,
            y: isNaN(cy) ? 0 : cy,
            w: Math.max(1, isNaN(cw) ? 1 : cw),
            h: Math.max(1, isNaN(ch) ? 1 : ch),
          }
        : undefined,
      pivot: usePivot
        ? {
            x: isNaN(px) ? 0 : px,
            y: isNaN(py) ? 0 : py,
          }
        : undefined,
    };

    const updatedSlice: Slice = {
      ...editingSlice,
      name: name.trim() || 'Slice',
      color,
      keys: [key],
      userData: userText ? { text: userText } : undefined,
    };

    const exists = slices.some((s) => s.id === updatedSlice.id);
    const newSlices = exists
      ? slices.map((s) => (s.id === updatedSlice.id ? updatedSlice : s))
      : [...slices, updatedSlice];

    setSlices(newSlices);
    setEditingSlice(updatedSlice);
  };

  const handleDeleteSlice = (id: string) => {
    const newSlices = slices.filter((s) => s.id !== id);
    setSlices(newSlices);
    if (editingSlice?.id === id) setEditingSlice(null);
  };

  const handleApply = () => {
    // If currently editing a slice, save changes first
    if (editingSlice) {
      handleSaveSlice();
    }
    onUpdateSlices(slices);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[620px] max-h-[85vh] bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col text-xs outline-none select-none relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Crop size={15} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground">
                Slices Manager
              </h2>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                Define UI regions, 9-patch borders & pivot points for engine export
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 flex flex-col md:flex-row gap-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Slices List Column */}
          <div className="w-full md:w-5/12 flex flex-col gap-2 border-b md:border-b-0 md:border-r border-border/60 pb-3 md:pb-0 md:pr-4 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers size={13} className="text-primary shrink-0" />
                Slices ({slices.length})
              </span>
              <button
                type="button"
                onClick={handleStartAdd}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] font-medium shadow-xs transition-colors"
                title="Add New Slice"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
              {slices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/60 rounded-xl bg-muted/20 px-3">
                  <Crop size={24} className="text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">No slices created</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Click &quot;New&quot; to add a slice region
                  </p>
                </div>
              ) : (
                slices.map((s) => {
                  const isSelected = editingSlice?.id === s.id;
                  const key = s.keys[0] || { x: 0, y: 0, w: 0, h: 0 };
                  return (
                    <div
                      key={s.id}
                      onClick={() => startEdit(s)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-2xs'
                          : 'bg-muted/30 border-border/40 hover:bg-muted/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-2xs"
                          style={{ backgroundColor: s.color || '#ef4444' }}
                        />
                        <div className="flex flex-col truncate min-w-0">
                          <span className="truncate text-xs font-medium">{s.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {key.w}×{key.h} at ({key.x},{key.y})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSlice(s.id);
                        }}
                        className="opacity-60 group-hover:opacity-100 hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors"
                        title="Delete Slice"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Slice Form Column */}
          <div className="flex-1 flex flex-col min-w-0">
            {editingSlice ? (
              <form onSubmit={handleSaveSlice} className="flex flex-col gap-3">
                {/* Name & Color */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Slice Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background border border-border rounded-md px-2.5 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      placeholder="Slice name"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Color
                    </label>
                    <div className="flex items-center gap-2 bg-background border border-border rounded-md px-2 py-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                      />
                      <span className="text-[10px] font-mono text-muted-foreground uppercase truncate">
                        {color}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bounds (X, Y, W, H) */}
                <div className="flex flex-col gap-1.5 p-2.5 bg-muted/30 border border-border/40 rounded-xl">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Bounds (Pixels)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-mono">X</span>
                      <input
                        type="number"
                        value={isNaN(x) ? '' : x}
                        onChange={(e) => setX(parseInt(e.target.value))}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-mono">Y</span>
                      <input
                        type="number"
                        value={isNaN(y) ? '' : y}
                        onChange={(e) => setY(parseInt(e.target.value))}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-mono">W</span>
                      <input
                        type="number"
                        value={isNaN(w) ? '' : w}
                        onChange={(e) => setW(parseInt(e.target.value))}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        placeholder="16"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground font-mono">H</span>
                      <input
                        type="number"
                        value={isNaN(h) ? '' : h}
                        onChange={(e) => setH(parseInt(e.target.value))}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        placeholder="16"
                      />
                    </div>
                  </div>
                </div>

                {/* 9-Patch Center Slice */}
                <div className="flex flex-col gap-1.5 p-2.5 bg-muted/30 border border-border/40 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <CustomCheckbox
                      checked={useCenter}
                      onCheckedChange={(c) => setUseCenter(!!c)}
                    />
                    <Shield size={12} className="text-primary shrink-0" />
                    <span className="font-medium text-xs text-foreground">
                      9-Patch Center Slice
                    </span>
                  </label>
                  {useCenter && (
                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">CX</span>
                        <input
                          type="number"
                          value={isNaN(cx) ? '' : cx}
                          onChange={(e) => setCx(parseInt(e.target.value))}
                          className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">CY</span>
                        <input
                          type="number"
                          value={isNaN(cy) ? '' : cy}
                          onChange={(e) => setCy(parseInt(e.target.value))}
                          className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">CW</span>
                        <input
                          type="number"
                          value={isNaN(cw) ? '' : cw}
                          onChange={(e) => setCw(parseInt(e.target.value))}
                          className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">CH</span>
                        <input
                          type="number"
                          value={isNaN(ch) ? '' : ch}
                          onChange={(e) => setCh(parseInt(e.target.value))}
                          className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Pivot Position */}
                <div className="flex flex-col gap-1.5 p-2.5 bg-muted/30 border border-border/40 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <CustomCheckbox
                      checked={usePivot}
                      onCheckedChange={(c) => setUsePivot(!!c)}
                    />
                    <Crosshair size={12} className="text-primary shrink-0" />
                    <span className="font-medium text-xs text-foreground">Pivot Position</span>
                  </label>
                  {usePivot && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">PX</span>
                        <input
                          type="number"
                          value={isNaN(px) ? '' : px}
                          onChange={(e) => setPx(parseInt(e.target.value))}
                          className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">PY</span>
                        <input
                          type="number"
                          value={isNaN(py) ? '' : py}
                          onChange={(e) => setPy(parseInt(e.target.value))}
                          className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground text-center outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* User Text / Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Metadata / User Notes
                  </label>
                  <input
                    type="text"
                    value={userText}
                    onChange={(e) => setUserText(e.target.value)}
                    placeholder="Custom slice text or engine tag..."
                    className="bg-background border border-border rounded-md px-2.5 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleSaveSlice()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium rounded-lg text-xs transition-colors"
                  >
                    <Check size={12} />
                    <span>Update Slice Item</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/60 rounded-xl bg-muted/10">
                <Crop size={28} className="text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No slice selected</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[200px]">
                  Select a slice from the list or click &quot;New&quot; to configure region bounds
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-border/60 bg-muted/20 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Info size={12} className="text-primary shrink-0" />
            <span>Slices export natively to Aseprite (.ase) formats</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg shadow-xs hover:bg-primary/90 transition-colors text-xs"
            >
              <Check size={13} />
              <span>Apply Slices</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
