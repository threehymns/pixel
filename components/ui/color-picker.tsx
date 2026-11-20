import * as React from "react";
import {
  ColorPicker as PrimitiveColorPicker,
  ColorPickerArea as PrimitiveColorPickerArea,
  ColorPickerAreaThumb as PrimitiveColorPickerAreaThumb,
  ColorPickerChannelInput as PrimitiveColorPickerChannelInput,
  ColorPickerEyeDropper as PrimitiveColorPickerEyeDropper,
  ColorPickerInput as PrimitiveColorPickerInput,
  ColorPickerSlider as PrimitiveColorPickerSlider,
  ColorPickerSliderThumb as PrimitiveColorPickerSliderThumb,
  ColorPickerSwatch as PrimitiveColorPickerSwatch,
  ColorPickerSwatchItem as PrimitiveColorPickerSwatchItem,
  ColorPickerSwatches as PrimitiveColorPickerSwatches,
  createColorPickerController,
} from "@ui-sdk/react/color-picker";
import { Pipette } from "../Icons";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../lib/utils";

export interface StudioColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  onCommit?: (hex: string) => void;
  presets?: string[];
  showChannels?: boolean;
  "aria-label"?: string;
  className?: string;
}

const StudioColorPicker: React.FC<StudioColorPickerProps> = ({
  value,
  onChange,
  onCommit,
  presets,
  showChannels = true,
  "aria-label": ariaLabel = "Color picker",
  className,
}) => (
  <PrimitiveColorPicker
    aria-label={ariaLabel}
    space="hsv"
    format="hex"
    value={value}
    onValueChange={(next) => onChange(next)}
    onValueCommit={(next) => onCommit?.(next)}
    className={cn("flex flex-col gap-2.5 select-none", className)}
  >
    <PrimitiveColorPickerArea
      className="relative h-36 w-full cursor-crosshair overflow-hidden rounded-md border border-border-strong touch-none"
      style={{ background: "var(--color-area-background)" }}
    >
      <PrimitiveColorPickerAreaThumb
        className="h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ background: "var(--color-picker-color)" }}
      />
    </PrimitiveColorPickerArea>

    <PrimitiveColorPickerSlider
      channel="hue"
      className="relative h-3 w-full cursor-pointer rounded-full border border-border touch-none"
      style={{ background: "var(--color-slider-background)" }}
    >
      <PrimitiveColorPickerSliderThumb
        className="top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ background: "var(--color-picker-color)" }}
      />
    </PrimitiveColorPickerSlider>

    <div className="flex items-center gap-1.5">
      <PrimitiveColorPickerSwatch
        className="h-7 w-7 shrink-0 rounded-md border border-border-strong shadow-inner"
        style={{ background: "var(--color-picker-color)" }}
      />
      <PrimitiveColorPickerInput
        aria-label="Hex color"
        className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs uppercase tabular-nums text-foreground outline-none transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <PrimitiveColorPickerEyeDropper
        aria-label="Pick color from screen"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[unsupported]:hidden cursor-pointer"
      >
        <Pipette className="h-3.5 w-3.5" />
      </PrimitiveColorPickerEyeDropper>
    </div>

    {showChannels && (
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { channel: "red", label: "R" },
            { channel: "green", label: "G" },
            { channel: "blue", label: "B" },
          ] as const
        ).map(({ channel, label }) => (
          <label
            key={channel}
            className="flex items-center rounded-md border border-input bg-background px-1.5 h-7 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40"
          >
            <span className="text-[10px] font-semibold text-muted-foreground mr-1 select-none">
              {label}
            </span>
            <PrimitiveColorPickerChannelInput
              channel={channel}
              aria-label={channel}
              className="w-full min-w-0 bg-transparent font-mono text-[11px] tabular-nums text-foreground outline-none text-right"
            />
          </label>
        ))}
      </div>
    )}

    {presets && presets.length > 0 && (
      <PrimitiveColorPickerSwatches
        aria-label="Color presets"
        className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border"
      >
        {presets.map((preset) => (
          <PrimitiveColorPickerSwatchItem
            key={preset}
            value={preset}
            className="h-5 w-5 rounded-sm border border-border-strong transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected]:ring-2 data-[selected]:ring-foreground data-[selected]:ring-offset-1 data-[selected]:ring-offset-popover cursor-pointer"
            style={{ background: "var(--color-picker-color)" }}
          />
        ))}
      </PrimitiveColorPickerSwatches>
    )}
  </PrimitiveColorPicker>
);

export interface ColorSwatchFieldProps {
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
  label?: string;
  className?: string;
  disabled?: boolean;
}

const ColorSwatchField: React.FC<ColorSwatchFieldProps> = ({
  value,
  onChange,
  presets,
  label = "Choose color",
  className,
  disabled = false,
}) => (
  <Popover>
    <PopoverTrigger
      render={
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs font-mono uppercase tabular-nums text-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 cursor-pointer",
            className
          )}
        />
      }
    >
      <span
        className="h-4 w-4 shrink-0 rounded-sm border border-border-strong shadow-inner"
        style={{ backgroundColor: value }}
      />
      <span className="truncate">{value}</span>
    </PopoverTrigger>
    <PopoverContent className="w-60 p-3" align="start">
      <StudioColorPicker
        value={value}
        onChange={onChange}
        presets={presets}
        aria-label={label}
      />
    </PopoverContent>
  </Popover>
);

export {
  ColorSwatchField,
  PrimitiveColorPicker as ColorPicker,
  StudioColorPicker,
  createColorPickerController,
};
