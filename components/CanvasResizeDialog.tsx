import React, { useState, useEffect, useRef } from 'react';
import { MIN_CANVAS_DIM, MAX_CANVAS_DIM } from '../constants';
import { ModalShell } from './ui/dialog';
import { Button } from './ui/button';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
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
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;
    setWidth(currentWidth);
    setHeight(currentHeight);
    setAnchor('cc');
  }, [isOpen, currentWidth, currentHeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedW = Math.max(MIN_CANVAS_DIM, Math.min(MAX_CANVAS_DIM, Math.round(width)));
    const clampedH = Math.max(MIN_CANVAS_DIM, Math.min(MAX_CANVAS_DIM, Math.round(height)));
    onResize(clampedW, clampedH, anchor);
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
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="canvas-resize-form" variant="primary" size="sm">
            Resize Canvas
          </Button>
        </>
      }
    >
      <form id="canvas-resize-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Width</FieldLabel>
            <StudioNumberInput
              value={width}
              onValueChange={setWidth}
              min={MIN_CANVAS_DIM}
              max={MAX_CANVAS_DIM}
              step={1}
              largeStep={8}
              suffix="px"
              showSteppers
              aria-label="Canvas width in pixels"
            />
          </Field>
          <Field>
            <FieldLabel>Height</FieldLabel>
            <StudioNumberInput
              value={height}
              onValueChange={setHeight}
              min={MIN_CANVAS_DIM}
              max={MAX_CANVAS_DIM}
              step={1}
              largeStep={8}
              suffix="px"
              showSteppers
              aria-label="Canvas height in pixels"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Move size={12} />
            <span>Anchor Position</span>
          </span>
          <div
            role="radiogroup"
            aria-label="Resize anchor position"
            className="mx-auto grid w-32 grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1.5"
          >
            {ANCHORS.map((a) => {
              const selected = anchor === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-label={a.label}
                  aria-checked={selected}
                  onClick={() => setAnchor(a.id)}
                  className={cn(
                    'flex aspect-square w-full items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
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
