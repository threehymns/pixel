import React, { useState, useEffect } from 'react';
import { CustomSlider } from './ui/slider';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

const QUICK_SWATCHES = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
  '#888888',
  '#ff8800',
  '#0088ff',
  '#88ff00',
  '#ff0088',
  '#00ff88',
  '#8800ff',
  '#444444',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [hex, setHex] = useState(color);
  const rgb = hexToRgb(color);

  useEffect(() => {
    setHex(color);
  }, [color]);

  const handleHexInput = (raw: string) => {
    const clean = raw.startsWith('#') ? raw : `#${raw}`;
    setHex(clean);
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      onChange(clean);
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const clamped = Math.max(0, Math.min(255, value));
    const newRgb = { ...rgb, [channel]: clamped };
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  return (
    <div className="flex w-56 flex-col gap-3 rounded-lg border border-border-strong bg-popover p-3 text-popover-foreground shadow-2xl select-none">
      <div className="flex items-center gap-2.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <label
                aria-label="Open system color picker"
                className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border-strong shadow-inner"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="absolute -inset-4 h-20 w-20 cursor-pointer opacity-0"
                />
              </label>
            }
          />
          <TooltipContent side="top">System Color Picker</TooltipContent>
        </Tooltip>

        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Hex</label>
          <div className="flex h-7 items-center overflow-hidden rounded-md border border-border bg-background transition-colors focus-within:border-primary">
            <span className="pl-2 font-mono text-xs text-muted-foreground">#</span>
            <input
              type="text"
              aria-label="Hex color value"
              value={hex.replace('#', '')}
              onChange={(e) => handleHexInput(e.target.value)}
              className="w-full bg-transparent px-1 py-1 font-mono text-xs text-foreground uppercase tabular-nums focus:outline-none"
              maxLength={6}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <div key={channel} className="flex items-center gap-2">
            <span className="w-3 text-[11px] font-medium uppercase text-muted-foreground">
              {channel}
            </span>
            <CustomSlider
              min={0}
              max={255}
              value={rgb[channel]}
              onValueChange={(val) => handleRgbChange(channel, val)}
              aria-label={`${channel.toUpperCase()} channel`}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              aria-label={`${channel.toUpperCase()} value`}
              onChange={(e) => handleRgbChange(channel, parseInt(e.target.value, 10) || 0)}
              className="h-6 w-11 shrink-0 px-1 text-center font-mono text-[11px] tabular-nums"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1 border-t border-border pt-2.5">
        {QUICK_SWATCHES.map((c) => (
          <Tooltip key={c}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Select color ${c}`}
                  className="aspect-square w-full cursor-pointer rounded-xs border border-white/15 transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                  onClick={() => onChange(c)}
                />
              }
            />
            <TooltipContent side="top" className="font-mono text-[11px] uppercase tabular-nums">
              {c}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
