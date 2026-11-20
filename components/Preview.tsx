import React, { useEffect, useRef, useState } from 'react';
import { Frame, Layer } from '../types';
import { renderFrameToCanvas } from '../utils';
import { Play, Pause, SkipBack, SkipForward, X } from './Icons';
import { CustomSlider } from './ui/slider';
import { IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Toolbar } from './ui/toolbar';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { cn } from '../lib/utils';

interface PreviewProps {
  width?: number;
  frames: Frame[];
  layers: Layer[];
  palette: string[];
  spriteWidth: number;
  spriteHeight: number;
  activeFrameIndex: number;
  onClose?: () => void;
  isFloating?: boolean;
  density?: 'compact' | 'touch';
}

interface CachedFrameRender {
  layers: Layer[];
  palette: string[];
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

export const Preview: React.FC<PreviewProps> = ({
  frames,
  layers,
  palette,
  spriteWidth,
  spriteHeight,
  activeFrameIndex,
  onClose,
  density = 'compact',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCacheRef = useRef<WeakMap<Frame, CachedFrameRender>>(new WeakMap());
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [fps, setFps] = useState(12);
  const isTouch = density === 'touch';

  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && frames.length > 1) {
      interval = window.setInterval(() => {
        setPreviewFrame((curr) => (curr + 1) % frames.length);
      }, 1000 / Math.max(1, fps));
    } else {
      setPreviewFrame(activeFrameIndex);
    }

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [isPlaying, fps, frames.length, activeFrameIndex]);

  useEffect(() => {
    if (previewFrame >= frames.length) {
      setPreviewFrame(0);
    }
  }, [previewFrame, frames.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frameIndex = isPlaying ? previewFrame : activeFrameIndex;
    const frame = frames[frameIndex];
    if (frame) {
      let cached = frameCacheRef.current.get(frame);
      if (
        !cached ||
        cached.layers !== layers ||
        cached.palette !== palette ||
        cached.width !== spriteWidth ||
        cached.height !== spriteHeight
      ) {
        cached = {
          layers,
          palette,
          width: spriteWidth,
          height: spriteHeight,
          canvas: renderFrameToCanvas(
            { width: spriteWidth, height: spriteHeight, frames, palette, layers },
            frameIndex
          ),
        };
        frameCacheRef.current.set(frame, cached);
      }
      ctx.drawImage(cached.canvas, 0, 0, canvas.width, canvas.height);
    }
  }, [
    frames,
    layers,
    palette,
    spriteWidth,
    spriteHeight,
    activeFrameIndex,
    previewFrame,
    isPlaying,
  ]);

  const currentFrameNumber = (isPlaying ? previewFrame : activeFrameIndex) + 1;
  const canAnimate = frames.length > 1;

  return (
    <div className="flex h-full w-full flex-col bg-card select-none">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-border bg-background/50 px-2.5',
          isTouch ? 'h-12' : 'h-8'
        )}
      >
        <span className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
          Frame {currentFrameNumber}/{frames.length}
        </span>

        <Toolbar aria-label="Preview playback controls" className="gap-0.5">
          {canAnimate && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={isTouch ? 'touch' : 'xs'}
                    onClick={() => {
                      setIsPlaying(false);
                      setPreviewFrame((prev) => (prev - 1 + frames.length) % frames.length);
                    }}
                    aria-label="Previous preview frame"
                  />
                }
              >
                <SkipBack size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">Previous Frame</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  pressed={isPlaying}
                  onPressedChange={setIsPlaying}
                  disabled={!canAnimate}
                  variant="tint"
                  size={isTouch ? 'touch' : 'icon-sm'}
                  aria-label={isPlaying ? 'Pause Animation' : 'Play Animation'}
                  className={cn(!isTouch && 'h-6 w-6')}
                />
              }
            >
              {isPlaying ? <Pause size={isTouch ? 15 : 12} /> : <Play size={isTouch ? 15 : 12} />}
            </TooltipTrigger>
            <TooltipContent side="top">
              {!canAnimate ? 'Add more frames to animate' : isPlaying ? 'Pause Animation' : 'Play Animation'}
            </TooltipContent>
          </Tooltip>

          {canAnimate && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={isTouch ? 'touch' : 'xs'}
                    onClick={() => {
                      setIsPlaying(false);
                      setPreviewFrame((prev) => (prev + 1) % frames.length);
                    }}
                    aria-label="Next preview frame"
                  />
                }
              >
                <SkipForward size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">Next Frame</TooltipContent>
            </Tooltip>
          )}

          {onClose && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size={isTouch ? 'touch' : 'xs'}
                    onClick={onClose}
                    aria-label="Close Preview"
                    className="hover:bg-destructive/15 hover:text-destructive"
                  />
                }
              >
                <X size={isTouch ? 15 : 12} />
              </TooltipTrigger>
              <TooltipContent side="top">Close Preview</TooltipContent>
            </Tooltip>
          )}
        </Toolbar>
      </div>

      <div className="flex min-h-[110px] flex-1 items-center justify-center overflow-hidden bg-canvas p-2.5">
        <canvas
          ref={canvasRef}
          width={Math.max(64, spriteWidth)}
          height={Math.max(64, spriteHeight)}
          className="checkerboard-alpha pixelated h-full w-full max-h-full max-w-full rounded-sm border border-border object-contain shadow-sm"
        />
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-t border-border bg-card px-2.5',
          isTouch ? 'h-12' : 'h-8'
        )}
      >
        <span className="text-[11px] font-medium text-muted-foreground">FPS</span>
        <CustomSlider
          min={1}
          max={60}
          value={fps}
          onValueChange={setFps}
          aria-label="Preview framerate"
          className="flex-1"
        />
        <span className="w-7 text-right font-mono text-[11px] text-foreground tabular-nums">
          {fps}
        </span>
      </div>
    </div>
  );
};
