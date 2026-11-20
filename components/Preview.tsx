import React, { useEffect, useRef, useState } from 'react';
import { Frame, Layer } from '../types';
import { renderFrameToCanvas } from '../utils';
import { Play, Pause, X } from './Icons';
import { CustomSlider } from './ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';

interface PreviewProps {
  width: number;
  frames: Frame[];
  layers: Layer[];
  palette: string[];
  spriteWidth: number;
  spriteHeight: number;
  activeFrameIndex: number;
  onClose?: () => void;
  isFloating?: boolean;
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
  isFloating = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameCacheRef = useRef<WeakMap<Frame, CachedFrameRender>>(new WeakMap());
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [fps, setFps] = useState(12);

  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem('preview_size');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { width: 204, height: 224 };
  });

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('preview_position');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedSize = localStorage.getItem('preview_size');
        let w = 204;
        let h = 224;
        if (savedSize) {
          try {
            const ps = JSON.parse(savedSize);
            w = ps.width;
            h = ps.height;
          } catch {}
        }
        return {
          x: Math.max(0, Math.min(parsed.x, window.innerWidth - w)),
          y: Math.max(0, Math.min(parsed.y, window.innerHeight - h)),
        };
      } catch {}
    }
    return { x: Math.max(16, window.innerWidth - 224), y: Math.max(16, window.innerHeight - 252) };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('preview_position', JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    localStorage.setItem('preview_size', JSON.stringify(size));
  }, [size]);

  useEffect(() => {
    if (!isFloating || !windowRef.current) return;

    const observer = new ResizeObserver(() => {
      if (windowRef.current) {
        setSize({
          width: windowRef.current.offsetWidth,
          height: windowRef.current.offsetHeight,
        });
      }
    });

    observer.observe(windowRef.current);
    return () => observer.disconnect();
  }, [isFloating]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isFloating) return;
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const newX = Math.max(0, Math.min(dragStartRef.current.posX + dx, window.innerWidth - size.width));
      const newY = Math.max(0, Math.min(dragStartRef.current.posY + dy, window.innerHeight - size.height));

      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, size]);

  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && frames.length > 1) {
      interval = window.setInterval(() => {
        setPreviewFrame((curr) => (curr + 1) % frames.length);
      }, 1000 / fps);
    } else {
      setPreviewFrame(activeFrameIndex);
    }

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [isPlaying, fps, frames.length, activeFrameIndex]);

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

  const innerContent = (
    <div className="flex h-full w-full flex-col bg-card select-none">
      <div
        className={`flex h-8 shrink-0 items-center justify-between border-b border-border bg-background/50 px-2.5 ${
          isFloating ? 'cursor-move active:cursor-grabbing' : ''
        }`}
        onPointerDown={handlePointerDown}
      >
        <div className="flex items-center gap-2">
          {isFloating && (
            <span className="text-[11px] font-semibold tracking-tight text-foreground">Preview</span>
          )}
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            F{currentFrameNumber}/{frames.length}
          </span>
        </div>

        <div className="no-drag flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause Animation' : 'Play Animation'}
                  className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
                    isPlaying
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                </button>
              }
            />
            <TooltipContent side="top">
              {isPlaying ? 'Pause Animation' : 'Play Animation'}
            </TooltipContent>
          </Tooltip>

          {isFloating && onClose && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Preview"
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                }
              />
              <TooltipContent side="top">Close Preview</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-[110px] flex-1 items-center justify-center overflow-hidden bg-canvas p-2.5"
      >
        <canvas
          ref={canvasRef}
          width={Math.max(64, spriteWidth)}
          height={Math.max(64, spriteHeight)}
          className="checkerboard-alpha pixelated h-full w-full max-h-full max-w-full rounded-sm border border-border object-contain shadow-sm"
        />
      </div>

      <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border bg-card px-2.5">
        <span className="text-[11px] font-medium text-muted-foreground">FPS</span>
        <CustomSlider
          min={1}
          max={60}
          value={fps}
          onValueChange={setFps}
          aria-label="Preview framerate"
          className="flex-1"
        />
        <span className="w-6 text-right font-mono text-[11px] text-foreground tabular-nums">
          {fps}
        </span>
      </div>
    </div>
  );

  const content = isFloating ? (
    <ContextMenu>
      <ContextMenuTrigger render={innerContent} />
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            setPosition({
              x: Math.max(16, window.innerWidth - 224),
              y: Math.max(16, window.innerHeight - 252),
            });
            setSize({ width: 204, height: 224 });
          }}
        >
          Reset Position &amp; Size
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ) : (
    innerContent
  );

  if (!isFloating) {
    return <div className="flex h-full w-full flex-col bg-card">{content}</div>;
  }

  return (
    <div
      ref={windowRef}
      className="fixed z-40 flex flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        resize: 'both',
        minWidth: 164,
        minHeight: 164,
      }}
    >
      {content}
    </div>
  );
};
