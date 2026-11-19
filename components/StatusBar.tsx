import React, { useMemo } from 'react';
import { ProjectState, Position } from '../types';
import { SELECTION_TOOLS } from '../constants';
import {
  MousePointer2,
  Layers,
  Maximize,
  ZoomIn,
  Clock,
  AlertCircle,
  AngleIcon,
} from './Icons';

interface StatusBarProps {
  state: ProjectState;
  isHome: boolean;
  mousePos: Position | null;
  dragStartPos: Position | null;
  statusMessage: { text: string; type: 'info' | 'error' | 'success' };
  selectionSize: { w: number; h: number } | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  state,
  isHome,
  mousePos,
  dragStartPos,
  statusMessage,
  selectionSize,
}) => {
  const dragInfo = useMemo(() => {
    if (!dragStartPos || !mousePos) return null;
    const dx = mousePos.x - dragStartPos.x;
    const dy = mousePos.y - dragStartPos.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    return {
      start: dragStartPos,
      end: mousePos,
      dx: Math.abs(dx),
      dy: Math.abs(dy),
      angle: angle.toFixed(1),
    };
  }, [dragStartPos, mousePos]);

  if (isHome) {
    return null;
  }

  const renderHints = () => {
    if (statusMessage.type === 'error') {
      return (
        <div className="flex items-center gap-1.5 font-medium text-destructive">
          <AlertCircle size={12} className="shrink-0" />
          <span className="truncate">{statusMessage.text}</span>
        </div>
      );
    }

    const tool = state.tool;
    const isSelection = SELECTION_TOOLS.includes(tool);
    const isShading = state.inkType === 'shading';

    const toolLabel = `${isShading ? 'Shading ' : ''}${tool
      .replace('-select', ' Select')
      .replace('filled-', 'Filled ')}`;

    return (
      <div className="flex items-center gap-2.5 overflow-hidden text-muted-foreground">
        <span className="shrink-0 font-medium capitalize text-foreground">{toolLabel}</span>
        <span className="text-border-strong">·</span>

        <div className="flex min-w-0 items-center gap-2.5 truncate">
          {isSelection ? (
            <>
              <span className="shrink-0">
                <kbd className="font-mono text-foreground">Shift</kbd> Add
              </span>
              <span className="shrink-0">
                <kbd className="font-mono text-foreground">Alt+Shift</kbd> Subtract
              </span>
              <span className="shrink-0">
                <kbd className="font-mono text-foreground">Ctrl+Shift</kbd> Intersect
              </span>
            </>
          ) : (
            <>
              {['pencil', 'line', 'rect', 'filled-rect', 'ellipse', 'filled-ellipse', 'bucket'].includes(tool) &&
                isShading && (
                  <>
                    <span className="shrink-0">
                      <kbd className="font-mono text-foreground">Click</kbd> Next shade
                    </span>
                    <span className="shrink-0">
                      <kbd className="font-mono text-foreground">Ctrl+Click</kbd> Prev shade
                    </span>
                  </>
                )}
              {tool === 'pencil' && !isShading && (
                <>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Shift</kbd> Line
                  </span>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Alt</kbd> Eyedropper
                  </span>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Ctrl</kbd> Secondary
                  </span>
                </>
              )}
              {tool === 'smudge' && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">Drag</kbd>{' '}
                  {state.smudgeMode === 'push' ? 'Push pixels' : 'Smear colors'}
                </span>
              )}
              {tool === 'line' && !isShading && (
                <>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Shift</kbd> Snap angle
                  </span>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Alt</kbd> Eyedropper
                  </span>
                </>
              )}
              {['rect', 'filled-rect', 'ellipse', 'filled-ellipse'].includes(tool) && !isShading && (
                <>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Shift</kbd> Equal aspect
                  </span>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Alt</kbd> Eyedropper
                  </span>
                </>
              )}
              {tool === 'eraser' && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">Shift</kbd> Line
                </span>
              )}
              {tool === 'blur' && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">R</kbd> Soften edges
                </span>
              )}
              {tool === 'sharpen' && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">Shift+R</kbd> Crisp edges
                </span>
              )}
              {tool === 'bucket' && !isShading && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">Shift</kbd> Global fill
                </span>
              )}
              {tool === 'move' && (
                <>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Arrows</kbd> Nudge
                  </span>
                  <span className="shrink-0">
                    <kbd className="font-mono text-foreground">Alt</kbd> Duplicate
                  </span>
                </>
              )}
              {tool === 'eyedropper' && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">Alt</kbd> Set secondary
                </span>
              )}
              {statusMessage.text &&
                ![
                  'pencil',
                  'eraser',
                  'smudge',
                  'line',
                  'rect',
                  'filled-rect',
                  'ellipse',
                  'filled-ellipse',
                  'bucket',
                  'move',
                  'eyedropper',
                  'blur',
                  'sharpen',
                ].includes(tool) && <span className="truncate">{statusMessage.text}</span>}
            </>
          )}
        </div>
      </div>
    );
  };

  const isFreeformTool =
    state.tool === 'pencil' ||
    state.tool === 'eraser' ||
    state.tool === 'smudge' ||
    state.tool === 'blur' ||
    state.tool === 'sharpen';

  return (
    <div className="flex h-7 shrink-0 items-center overflow-hidden border-t border-border bg-card/90 px-3 text-[11px] text-muted-foreground select-none">
      <div className="mr-4 min-w-0 flex-1">{renderHints()}</div>

      <div className="flex h-full items-center gap-2.5 tabular-nums">
        {dragInfo && (
          <div className="flex items-center gap-2.5 font-mono text-primary">
            {isFreeformTool ? (
              <span>
                {dragInfo.start.x},{dragInfo.start.y} → {dragInfo.end.x},{dragInfo.end.y}
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <Maximize size={11} /> {dragInfo.dx}×{dragInfo.dy}
                </span>
                <span className="flex items-center gap-1">
                  <AngleIcon size={11} /> {dragInfo.angle}°
                </span>
              </>
            )}
            <div className="h-3 w-px bg-border" />
          </div>
        )}

        <div className="flex w-[74px] items-center gap-1 font-mono text-foreground">
          <MousePointer2 size={11} className="shrink-0 text-muted-foreground" />
          <span>{mousePos ? `${mousePos.x}, ${mousePos.y}` : '—, —'}</span>
        </div>

        <div className="h-3 w-px bg-border" />

        <div className="flex items-center gap-1 font-mono text-foreground">
          <Maximize size={11} className="text-muted-foreground" />
          <span>
            {state.width}×{state.height}
          </span>
        </div>

        {selectionSize && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1 font-mono text-primary">
              <span className="text-muted-foreground">Sel</span>
              <span>
                {selectionSize.w}×{selectionSize.h}
              </span>
            </div>
          </>
        )}

        <div className="h-3 w-px bg-border" />

        <div className="flex items-center gap-1 font-mono text-foreground">
          <Clock size={11} className="text-muted-foreground" />
          <span>
            {state.activeFrameIndex + 1}/{state.frames.length}
          </span>
        </div>

        <div className="h-3 w-px bg-border" />

        <div className="flex w-12 items-center justify-end gap-1 font-mono text-foreground">
          <ZoomIn size={11} className="text-muted-foreground" />
          <span>{Math.round(state.zoom * 100)}%</span>
        </div>

        <div className="h-3 w-px bg-border" />

        <div className="flex max-w-[112px] items-center gap-1 truncate text-foreground">
          <Layers size={11} className="shrink-0 text-muted-foreground" />
          <span className="truncate">
            {state.layers.find((l) => l.id === state.activeLayerId)?.name}
          </span>
        </div>
      </div>
    </div>
  );
};
