import React, { useState, useEffect } from 'react';
import { ModalShell } from './ui/dialog';
import { Input } from './ui/input';
import { Move } from './Icons';
import { cn } from '../lib/utils';

interface CanvasResizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentWidth: number;
  currentHeight: number;
  onResize: (width: number, height: number, anchor: string) => void;
}

const ANCHORS = [
  { id: 'tl', label: 'Top Left' },
  { id: 'tc', label: 'Top Center' },
  { id: 'tr', label: 'Top Right' },
  { id: 'cl', label: 'Center Left' },
  { id: 'cc', label: 'Center' },
  { id: 'cr', label: 'Center Right' },
  { id: 'bl', label: 'Bottom Left' },
  { id: 'bc', label: 'Bottom Center' },
  { id: 'br', label: 'Bottom Right' },
];

export const CanvasResizeDialog: React.FC<CanvasResizeDialogProps> = ({
  isOpen,
  onClose,
  currentWidth,
  currentHeight,
  onResize,
}) => {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [anchor, setAnchor] = useState('cc');

  useEffect(() => {
    if (!isOpen) return;
    setWidth(currentWidth);
    setHeight(currentHeight);
    setAnchor('cc');
  }, [isOpen, currentWidth, currentHeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onResize(Math.max(1, width), Math.max(1, height), anchor);
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Canvas Size"
      subtitle={`Current: ${currentWidth} × ${currentHeight} px`}
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-7 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="canvas-resize-form"
            className="h-7 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Resize
          </button>
        </>
      }
    >
      <form id="canvas-resize-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="resize-width"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Width (px)
            </label>
            <Input
              id="resize-width"
              type="number"
              value={width}
              onChange={(e) => setWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min={1}
              max={2048}
              className="font-mono tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="resize-height"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Height (px)
            </label>
            <Input
              id="resize-height"
              type="number"
              value={height}
              onChange={(e) => setHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min={1}
              max={2048}
              className="font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Move size={12} />
            <span>Anchor</span>
          </span>
          <div className="mx-auto grid w-32 grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1.5">
            {ANCHORS.map((a) => {
              const selected = anchor === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.label}
                  aria-pressed={selected}
                  onClick={() => setAnchor(a.id)}
                  className={cn(
                    'flex aspect-square w-full items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'bg-primary' : 'hover:bg-accent'
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      selected ? 'bg-primary-foreground' : 'bg-muted-foreground/50'
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
