import * as React from "react";
import {
  Slider as PrimitiveSlider,
  SliderControl as PrimitiveSliderControl,
  SliderIndicator as PrimitiveSliderIndicator,
  SliderThumb as PrimitiveSliderThumb,
  SliderTrack as PrimitiveSliderTrack,
  SliderValue as PrimitiveSliderValue,
  createSliderController,
} from "@ui-sdk/react/slider";
import { cn } from "../../lib/utils";

const Slider = PrimitiveSlider;
const SliderValue = PrimitiveSliderValue;

const SliderControl = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSliderControl>
>(({ className, ...props }, ref) => (
  <PrimitiveSliderControl
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-1.5", className)}
    {...props}
  />
));
SliderControl.displayName = "SliderControl";

const SliderTrack = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSliderTrack>
>(({ className, ...props }, ref) => (
  <PrimitiveSliderTrack
    ref={ref}
    className={cn(
      "relative h-1.5 w-full grow rounded-full border border-border bg-secondary",
      className
    )}
    {...props}
  />
));
SliderTrack.displayName = "SliderTrack";

const SliderIndicator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSliderIndicator>
>(({ className, ...props }, ref) => (
  <PrimitiveSliderIndicator
    ref={ref}
    className={cn("absolute h-full rounded-full bg-primary", className)}
    {...props}
  />
));
SliderIndicator.displayName = "SliderIndicator";

const SliderThumb = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSliderThumb>
>(({ className, ...props }, ref) => (
  <PrimitiveSliderThumb
    ref={ref}
    className={cn(
      "block h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-primary/80 bg-foreground shadow-md transition-transform hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-background data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));
SliderThumb.displayName = "SliderThumb";

export const CustomSlider: React.FC<{
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Slider value",
}) => (
  <Slider<number>
    value={value}
    onValueChange={(val) => onValueChange(Array.isArray(val) ? val[0] : val)}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
    className={cn("relative flex w-full items-center", className)}
  >
    <SliderControl>
      <SliderTrack>
        <SliderIndicator />
        <SliderThumb aria-label={ariaLabel} />
      </SliderTrack>
    </SliderControl>
  </Slider>
);

export {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
  SliderValue,
  createSliderController,
};
