
import React, { useMemo } from 'react';
import { ProjectState, Position, ToolType } from '../types';
import { SELECTION_TOOLS } from '../constants';
import { 
  MousePointer2, Layers, Grid, Maximize, 
  ZoomIn, Clock, Info, AlertCircle, AngleIcon
} from './Icons';

interface StatusBarProps {
  state: ProjectState;
  isHome: boolean;
  mousePos: Position | null;
  dragStartPos: Position | null;
  statusMessage: { text: string; type: 'info' | 'error' | 'success' };
  selectionSize: { w: number, h: number } | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  state, 
  isHome, 
  mousePos, 
  dragStartPos,
  statusMessage,
  selectionSize
}) => {
  const dragInfo = useMemo(() => {
    if (!dragStartPos || !mousePos) return null;
    const dx = mousePos.x - dragStartPos.x;
    const dy = mousePos.y - dragStartPos.y;
    
    // Angle: Convert to degrees, pointing right is 0, clockwise.
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    
    return {
      start: dragStartPos,
      end: mousePos,
      dx: Math.abs(dx),
      dy: Math.abs(dy),
      angle: angle.toFixed(1)
    };
  }, [dragStartPos, mousePos]);

  const renderHints = () => {
    if (isHome) {
      return (
        <div className="flex items-center gap-1.5 text-foreground">
          <span className="shrink-0 text-primary">
             <Info size={12} />
          </span>
          <span>PixelForge Studio v1.0.0</span>
        </div>
      );
    }

    if (statusMessage.type === 'error') {
      return (
        <div className="flex items-center gap-1.5 text-destructive font-bold">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{statusMessage.text}</span>
        </div>
      );
    }

    const tool = state.tool;
    const isSelection = SELECTION_TOOLS.includes(tool);
    const isShading = state.inkType === 'shading';

    return (
      <div className="flex items-center gap-4 text-muted-foreground/90 overflow-hidden">
        <div className="flex items-center gap-1.5 text-foreground font-semibold shrink-0">
          <span className="shrink-0 text-primary">
            <Info size={12} />
          </span>
          <span className="uppercase text-[9px] tracking-wider opacity-60">
            {isShading ? 'Shading ' : ''}{tool.replace('-select', '').replace('filled-', 'Filled ')}:
          </span>
        </div>

        <div className="flex gap-3 truncate min-w-0">
          {isSelection ? (
            <>
              <span className="flex gap-1 items-center shrink-0">
                <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift</kbd> Add
              </span>
              <span className="flex gap-1 items-center shrink-0">
                <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Alt+Shift</kbd> Sub
              </span>
              <span className="flex gap-1 items-center shrink-0">
                <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Ctrl+Shift</kbd> Inter
              </span>
            </>
          ) : (
            <>
              {['pencil', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'bucket'].includes(tool) && isShading && (
                  <>
                    <span className="flex gap-1 items-center shrink-0">
                        <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Click</kbd> Next Shade
                    </span>
                    <span className="flex gap-1 items-center shrink-0">
                        <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Ctrl+Click</kbd> Prev Shade
                    </span>
                  </>
              )}
              {tool === 'pencil' && !isShading && (
                <>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift</kbd> Line
                  </span>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Alt</kbd> Picker
                  </span>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Ctrl</kbd> Secondary
                  </span>
                </>
              )}
              {tool === 'smudge' && (
                <span className="flex gap-1 items-center shrink-0">
                  <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Drag</kbd> Push pixels
                </span>
              )}
              {tool === 'line' && !isShading && (
                <>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift</kbd> Snap
                  </span>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Alt</kbd> Picker
                  </span>
                </>
              )}
              {['rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool) && !isShading && (
                <>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift</kbd> Square/Circle
                  </span>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Alt</kbd> Picker
                  </span>
                </>
              )}
              {tool === 'eraser' && (
                <span className="flex gap-1 items-center shrink-0">
                  <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift</kbd> Line
                </span>
              )}
              {tool === 'blur' && (
                <span className="flex gap-1 items-center shrink-0">
                  <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">R</kbd> Soften edges
                </span>
              )}
              {tool === 'sharpen' && (
                <span className="flex gap-1 items-center shrink-0">
                  <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift+R</kbd> Sharpen edges
                </span>
              )}
              {tool === 'bucket' && !isShading && (
                <span className="flex gap-1 items-center shrink-0">
                  <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Shift</kbd> Global
                </span>
              )}
              {tool === 'move' && (
                <>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Arrows</kbd> Nudge
                  </span>
                  <span className="flex gap-1 items-center shrink-0">
                    <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Alt</kbd> Copy
                  </span>
                </>
              )}
              {tool === 'eyedropper' && (
                <span className="flex gap-1 items-center shrink-0">
                  <kbd className="bg-background px-1 rounded-sm text-[9px] border border-border text-foreground font-sans">Alt</kbd> Secondary
                </span>
              )}
              {!['pencil', 'eraser', 'smudge', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'bucket', 'move', 'eyedropper', 'blur', 'sharpen'].includes(tool) && !isSelection && (
                <span className="italic opacity-60">No modifiers</span>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const isFreeformTool = state.tool === 'pencil' || state.tool === 'eraser' || state.tool === 'smudge' || state.tool === 'blur' || state.tool === 'sharpen';

  return (
    <div className="h-7 bg-muted border-t border-background flex items-center px-2 text-[10px] text-muted-foreground select-none overflow-hidden shrink-0">
      <div className="flex-1 min-w-0 mr-4">
        {renderHints()}
      </div>

      {!isHome && (
        <div className="flex items-center h-full">
          {/* Ephemeral Drag Info */}
          {dragInfo && (
            <div className="flex items-center gap-3 mr-2 px-2 py-0.5 text-primary">
              {isFreeformTool ? (
                <>
                  <span className="flex items-center gap-1 font-mono uppercase tracking-tighter">
                    <span className="opacity-70 text-[8px]">START:</span> {dragInfo.start.x},{dragInfo.start.y}
                  </span>
                  <div className="w-[1px] h-3 bg-primary/20" />
                  <span className="flex items-center gap-1 font-mono uppercase tracking-tighter">
                    <span className="opacity-70 text-[8px]">END:</span> {dragInfo.end.x},{dragInfo.end.y}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 font-mono uppercase tracking-tighter">
                    <Maximize size={10} className="opacity-70" /> {dragInfo.dx}×{dragInfo.dy}
                  </span>
                  <div className="w-[1px] h-3 bg-primary/20" />
                  <span className="flex items-center gap-1 font-mono uppercase tracking-tighter">
                    <AngleIcon size={10} className="opacity-70" /> {dragInfo.angle}°
                  </span>
                </>
              )}
            </div>
          )}

          <div className="w-[1px] h-3 bg-border mx-2" />

          <div className="flex items-center gap-1 w-20">
            <MousePointer2 size={10} className="opacity-50" />
            <span className="font-mono">
              {mousePos ? `${mousePos.x}, ${mousePos.y}` : '--, --'}
            </span>
          </div>

          <div className="w-[1px] h-3 bg-border mx-2" />
          <div className="flex items-center gap-1">
            <Maximize size={10} className="opacity-50" />
            <span>{state.width}x{state.height}</span>
          </div>

          {selectionSize && (
            <>
              <div className="w-[1px] h-3 bg-border mx-2" />
              <div className="flex items-center gap-1 text-primary font-medium">
                <span className="opacity-70 font-mono tracking-tighter text-[9px]">SEL:</span>
                <span>{selectionSize.w}x{selectionSize.h}</span>
              </div>
            </>
          )}

          <div className="w-[1px] h-3 bg-border mx-2" />
          <div className="flex items-center gap-1">
            <Clock size={10} className="opacity-50" />
            <span>Frame {state.activeFrameIndex + 1}/{state.frames.length}</span>
          </div>

          <div className="w-[1px] h-3 bg-border mx-2" />
          <div className="flex items-center gap-1 w-12 justify-end">
            <ZoomIn size={10} className="opacity-50" />
            <span>{Math.round(state.zoom * 100)}%</span>
          </div>
          
          <div className="w-[1px] h-3 bg-border mx-2" />
          <div className="flex items-center gap-1 max-w-[100px] truncate">
            <Layers size={10} className="opacity-50" />
            <span className="truncate">{state.layers.find(l => l.id === state.activeLayerId)?.name}</span>
          </div>
        </div>
      )}
    </div>
  );
};
