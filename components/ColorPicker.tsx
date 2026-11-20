import React from 'react';
import { StudioColorPicker } from './ui/color-picker';
import { cn } from '../lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

const QUICK_SWATCHES = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#78716c',
  '#44403c',
  '#fde047',
  '#86efac',
  '#93c5fd',
  '#f9a8d4',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, className }) => {
  return (
    <StudioColorPicker
      value={color}
      onChange={onChange}
      presets={QUICK_SWATCHES}
      aria-label="Brush color picker"
      className={cn('w-56', className)}
    />
  );
};
