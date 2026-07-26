import React, { useState, useEffect } from 'react';
import { CustomSlider } from './ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
};

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [hex, setHex] = useState(color);
  const rgb = hexToRgb(color);

  useEffect(() => {
    setHex(color);
  }, [color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const newRgb = { ...rgb, [channel]: value };
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  return (
    <div className="flex flex-col gap-3 p-3 w-56 bg-card border border-border rounded-xl shadow-2xl">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-10 h-10 rounded-md border border-border overflow-hidden shrink-0 relative shadow-inner cursor-pointer" style={{ backgroundColor: color }}>
               <input 
                 type="color" 
                 value={color} 
                 onChange={(e) => onChange(e.target.value)}
                 className="absolute -inset-4 w-20 h-20 cursor-pointer opacity-0"
               />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">Native Picker</TooltipContent>
        </Tooltip>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Hex</label>
          <div className="flex items-center bg-background border border-border rounded-md overflow-hidden focus-within:border-primary transition-colors">
            <span className="pl-2 text-muted-foreground text-xs font-mono">#</span>
            <input 
              type="text" 
              value={hex.replace('#', '')} 
              onChange={(e) => handleHexChange({ ...e, target: { ...e.target, value: '#' + e.target.value } } as any)}
              className="w-full bg-transparent px-1 py-1.5 text-xs font-mono text-foreground focus:outline-none"
              maxLength={6}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <div key={channel} className="flex items-center gap-2">
            <label className="w-3 text-[10px] font-bold text-muted-foreground uppercase">{channel}</label>
            <CustomSlider
              min={0}
              max={255}
              value={rgb[channel]}
              onValueChange={(val) => handleRgbChange(channel, val)}
              className="flex-1"
            />
            <input 
              type="number" 
              min="0" max="255" 
              value={rgb[channel]}
              onChange={(e) => handleRgbChange(channel, parseInt(e.target.value) || 0)}
              className="w-10 bg-background border border-border rounded px-1 py-0.5 text-[10px] font-mono text-center focus:outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1 pt-2 border-t border-border">
        {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#888888', '#ff8800', '#0088ff', '#88ff00', '#ff0088', '#00ff88', '#8800ff', '#444444'].map(c => (
          <Tooltip key={c}>
            <TooltipTrigger asChild>
              <button 
                className="w-full aspect-square rounded-sm border border-border hover:scale-110 transition-transform shadow-sm cursor-pointer"
                style={{ backgroundColor: c }}
                onClick={() => onChange(c)}
              />
            </TooltipTrigger>
            <TooltipContent side="top">{c}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
