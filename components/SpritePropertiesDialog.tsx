import React, { useState } from 'react';
import { ProjectState, ColorMode } from '../types';
import { X, Check, Settings, Grid, Ratio, Palette } from 'lucide-react';

interface SpritePropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  state: ProjectState;
  onUpdateSpriteProperties: (props: {
    title?: string;
    pixelRatio?: { width: number; height: number };
    transparentIndex?: number;
    colorMode?: ColorMode;
    grid?: { x: number; y: number; width: number; height: number };
  }) => void;
}

export const SpritePropertiesDialog: React.FC<SpritePropertiesDialogProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateSpriteProperties,
}) => {
  const [title, setTitle] = useState(state.title || '');
  const [colorMode, setColorMode] = useState<ColorMode>(state.colorMode || 'rgba');
  const [transparentIndex, setTransparentIndex] = useState<number>(
    state.transparentIndex != null && !isNaN(state.transparentIndex) ? state.transparentIndex : 0
  );
  const [pixelRatioWidth, setPixelRatioWidth] = useState<number>(
    state.pixelRatio?.width && !isNaN(state.pixelRatio.width) ? state.pixelRatio.width : 1
  );
  const [pixelRatioHeight, setPixelRatioHeight] = useState<number>(
    state.pixelRatio?.height && !isNaN(state.pixelRatio.height) ? state.pixelRatio.height : 1
  );
  const [gridX, setGridX] = useState<number>(
    state.grid?.x != null && !isNaN(state.grid.x) ? state.grid.x : 0
  );
  const [gridY, setGridY] = useState<number>(
    state.grid?.y != null && !isNaN(state.grid.y) ? state.grid.y : 0
  );
  const [gridWidth, setGridWidth] = useState<number>(
    state.grid?.width && !isNaN(state.grid.width) ? state.grid.width : 16
  );
  const [gridHeight, setGridHeight] = useState<number>(
    state.grid?.height && !isNaN(state.grid.height) ? state.grid.height : 16
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSpriteProperties({
      title,
      colorMode,
      transparentIndex: isNaN(transparentIndex) ? 0 : transparentIndex,
      pixelRatio: {
        width: Math.max(1, isNaN(pixelRatioWidth) ? 1 : pixelRatioWidth),
        height: Math.max(1, isNaN(pixelRatioHeight) ? 1 : pixelRatioHeight)
      },
      grid: {
        x: isNaN(gridX) ? 0 : gridX,
        y: isNaN(gridY) ? 0 : gridY,
        width: Math.max(1, isNaN(gridWidth) ? 16 : gridWidth),
        height: Math.max(1, isNaN(gridHeight) ? 16 : gridHeight)
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4" onClick={onClose}>
      <form
        className="w-full max-w-[480px] max-h-[90vh] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Sprite Properties</h2>
              <p className="text-[11px] text-muted-foreground">Configure canvas dimensions, color depth, pixel ratio & grid</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold">Sprite Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Project Name..."
            />
          </div>

          {/* Color Mode & Transparent Index */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Palette size={13} className="text-primary" />
                Color Mode
              </label>
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as ColorMode)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="rgba">RGBA (32 bpp)</option>
                <option value="indexed">Indexed (8 bpp)</option>
              </select>
            </div>

            {colorMode === 'indexed' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Transparent Palette Index</label>
                <input
                  type="number"
                  value={isNaN(transparentIndex) ? '' : transparentIndex}
                  onChange={(e) => setTransparentIndex(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  min="0"
                  max={Math.max(0, state.palette.length - 1)}
                />
              </div>
            )}
          </div>

          {/* Pixel Aspect Ratio */}
          <div className="flex flex-col gap-2 p-3 bg-muted/20 border border-border/40 rounded-xl">
            <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Ratio size={14} className="text-primary" />
              Pixel Aspect Ratio (Width : Height)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-12">Width:</span>
                <input
                  type="number"
                  value={isNaN(pixelRatioWidth) ? '' : pixelRatioWidth}
                  onChange={(e) => setPixelRatioWidth(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
                  min="1"
                  max="10"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-12">Height:</span>
                <input
                  type="number"
                  value={isNaN(pixelRatioHeight) ? '' : pixelRatioHeight}
                  onChange={(e) => setPixelRatioHeight(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
                  min="1"
                  max="10"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Standard pixels use 1:1 ratio. Double-wide pixels use 2:1 ratio.</p>
          </div>

          {/* Grid Settings */}
          <div className="flex flex-col gap-2.5 p-3 bg-muted/20 border border-border/40 rounded-xl">
            <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Grid size={14} className="text-primary" />
              Pixel Grid Settings
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14">Grid X:</span>
                <input
                  type="number"
                  value={isNaN(gridX) ? '' : gridX}
                  onChange={(e) => setGridX(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14">Grid Y:</span>
                <input
                  type="number"
                  value={isNaN(gridY) ? '' : gridY}
                  onChange={(e) => setGridY(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14">Width:</span>
                <input
                  type="number"
                  value={isNaN(gridWidth) ? '' : gridWidth}
                  onChange={(e) => setGridWidth(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14">Height:</span>
                <input
                  type="number"
                  value={isNaN(gridHeight) ? '' : gridHeight}
                  onChange={(e) => setGridHeight(parseInt(e.target.value))}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
                  min="1"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-lg">Cancel</button>
          <button type="submit" className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]">
            Apply Changes
          </button>
        </div>
      </form>
    </div>
  );
};
