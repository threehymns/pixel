import React from 'react';
import { ToolType, InkType, Position } from '../types';
import { SELECTION_TOOLS } from '../constants';
import { useCursorMousePos, useCursorDragStartPos, useLiveZoom } from '../hooks/useCursorStore';
import { useStatusMessage } from '../hooks/useStatusStore';
import { Button, IconButton } from './ui/button';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  MousePointer2,
  Layers,
  Maximize,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  AngleIcon,
  Minus,
  Plus,
} from './Icons';

interface StatusBarProps {
  tool: ToolType;
  inkType: InkType;
  smudgeMode?: 'blend' | 'push';
  width: number;
  height: number;
  activeFrameIndex: number;
  frameCount: number;
  zoom: number;
  activeLayerName?: string;
  isHome: boolean;
  mousePos?: Position | null;
  dragStartPos?: Position | null;
  selectionSize: { w: number; h: number } | null;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onZoomFit?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  tool,
  inkType,
  smudgeMode,
  width,
  height,
  activeFrameIndex,
  frameCount,
  zoom,
  activeLayerName,
  isHome,
  mousePos: mousePosProp,
  dragStartPos: dragStartPosProp,
  selectionSize,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
}) => {
  const storeMousePos = useCursorMousePos();
  const storeDragStartPos = useCursorDragStartPos();
  const liveZoom = useLiveZoom();
  const statusMessage = useStatusMessage();
  const mousePos = mousePosProp !== undefined ? mousePosProp : storeMousePos;
  const dragStartPos = dragStartPosProp !== undefined ? dragStartPosProp : storeDragStartPos;

  let dragInfo: { start: Position; end: Position; dx: number; dy: number; angle: string } | null = null;
  if (dragStartPos && mousePos) {
    const dx = mousePos.x - dragStartPos.x;
    const dy = mousePos.y - dragStartPos.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    dragInfo = {
      start: dragStartPos,
      end: mousePos,
      dx: Math.abs(dx),
      dy: Math.abs(dy),
      angle: angle.toFixed(1),
    };
  }

  if (isHome) {
    return null;
  }

  const renderHints = () => {
    if (statusMessage.text) {
      const styleMap = {
        error: { cls: 'text-destructive', Icon: AlertCircle },
        warning: { cls: 'text-warning', Icon: AlertTriangle },
        success: { cls: 'text-success', Icon: CheckCircle2 },
        info: { cls: 'text-primary', Icon: Info },
      } as const;
      const { cls, Icon } = styleMap[statusMessage.type] || styleMap.info;
      return (
        <div role="status" aria-live="polite" className={`flex items-center gap-1.5 font-medium ${cls}`}>
          <Icon size={12} className="shrink-0" />
          <span className="truncate">{statusMessage.text}</span>
        </div>
      );
    }

    const isSelection = SELECTION_TOOLS.includes(tool);
    const isShading = inkType === 'shading';

    const toolLabel = `${isShading ? 'Shading ' : ''}${tool
      .replace('-select', ' Select')
      .replace('filled-', 'Filled ')
      .replace('color-replace', 'Color Replace')}`;

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
                  {smudgeMode === 'push' ? 'Push pixels' : 'Smear colors'}
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
              {tool === 'color-replace' && (
                <span className="shrink-0">
                  <kbd className="font-mono text-foreground">Drag</kbd> Replace secondary with primary
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
            </>
          )}
        </div>
      </div>
    );
  };

  const isFreeformTool =
    tool === 'pencil' ||
    tool === 'eraser' ||
    tool === 'smudge' ||
    tool === 'blur' ||
    tool === 'sharpen' ||
    tool === 'color-replace';

  const zoomPercent = Math.round((liveZoom ?? zoom) * 100);

  return (
    <div className="flex h-7 shrink-0 items-center overflow-hidden border-t border-border bg-card/90 px-3 text-[11px] text-muted-foreground select-none">
      <div className="mr-4 min-w-0 flex-1">{renderHints()}</div>

      <div className="flex h-full items-center gap-2 tabular-nums">
        {dragInfo && (
          <div className="flex items-center gap-2 font-mono text-primary">
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
            <Separator orientation="vertical" className="h-3" />
          </div>
        )}

        <div className="flex w-[74px] items-center gap-1 font-mono text-foreground">
          <MousePointer2 size={11} className="shrink-0 text-muted-foreground" />
          <span>{mousePos ? `${mousePos.x}, ${mousePos.y}` : '—, —'}</span>
        </div>

        <Separator orientation="vertical" className="h-3" />

        <div className="flex items-center gap-1 font-mono text-foreground">
          <Maximize size={11} className="text-muted-foreground" />
          <span>
            {width}×{height}
          </span>
        </div>

        {selectionSize && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <div className="flex items-center gap-1 font-mono text-primary">
              <span className="text-muted-foreground">Sel</span>
              <span>
                {selectionSize.w}×{selectionSize.h}
              </span>
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-3" />

        <div className="flex items-center gap-1 font-mono text-foreground">
          <Clock size={11} className="text-muted-foreground" />
          <span>
            {activeFrameIndex + 1}/{frameCount}
          </span>
        </div>

        <Separator orientation="vertical" className="h-3" />

        <div className="flex items-center gap-0.5">
          {onZoomOut && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label="Zoom out"
                    onClick={onZoomOut}
                    className="h-5 w-5"
                  />
                }
              >
                <Minus size={11} />
              </TooltipTrigger>
              <TooltipContent side="top">Zoom out (Ctrl+-)</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={onZoomReset}
                  disabled={!onZoomReset}
                  className="h-5 min-w-[44px] px-1 font-mono text-[11px] text-foreground tabular-nums"
                />
              }
            >
              {zoomPercent}%
            </TooltipTrigger>
            <TooltipContent side="top">Reset zoom</TooltipContent>
          </Tooltip>
          {onZoomIn && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label="Zoom in"
                    onClick={onZoomIn}
                    className="h-5 w-5"
                  />
                }
              >
                <Plus size={11} />
              </TooltipTrigger>
              <TooltipContent side="top">Zoom in (Ctrl++)</TooltipContent>
            </Tooltip>
          )}
          {onZoomFit && (
            <Button
              size="xs"
              variant="ghost"
              onClick={onZoomFit}
              className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Fit
            </Button>
          )}
        </div>

        <Separator orientation="vertical" className="h-3" />

        <div className="flex max-w-[112px] items-center gap-1 truncate text-foreground">
          <Layers size={11} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{activeLayerName}</span>
        </div>
      </div>
    </div>
  );
};
