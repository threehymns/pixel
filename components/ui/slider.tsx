import * as React from "react";
import { Slider } from "@base-ui/react/slider";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SliderRoot = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Slider.Root>
>(({ className, ...props }, ref) => (
  <Slider.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center group",
      className
    )}
    {...props}
  />
));
SliderRoot.displayName = "SliderRoot";

const SliderControl = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Slider.Control>
>(({ className, ...props }, ref) => (
  <Slider.Control
    ref={ref}
    className={cn(
      "relative flex w-full items-center",
      className
    )}
    {...props}
  >
    {props.children}
  </Slider.Control>
));
SliderControl.displayName = "SliderControl";

const SliderTrack = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Slider.Track>
>(({ className, ...props }, ref) => (
  <Slider.Track
    ref={ref}
    className={cn(
      "relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary/50 border border-white/5",
      className
    )}
    {...props}
  >
    <Slider.Indicator className="absolute h-full bg-primary transition-all duration-150" />
  </Slider.Track>
));
SliderTrack.displayName = "SliderTrack";

const SliderThumb = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Slider.Thumb>
>(({ className, ...props }, ref) => (
  <Slider.Thumb
    ref={ref}
    className={cn(
      "block h-3.5 w-3.5 rounded-full border border-primary/50 bg-white shadow-lg ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing",
      className
    )}
    {...props}
  />
));
SliderThumb.displayName = "SliderThumb";

export { SliderRoot, SliderControl, SliderTrack, SliderThumb };

// A convenient combined component
export const CustomSlider = ({ 
  value, 
  onValueChange, 
  min = 0, 
  max = 100, 
  step = 1,
  className 
}: { 
  value: number; 
  onValueChange: (val: number) => void; 
  min?: number; 
  max?: number; 
  step?: number;
  className?: string;
}) => (
  <SliderRoot 
    value={value} 
    onValueChange={(val) => onValueChange(Array.isArray(val) ? val[0] : val)} 
    min={min} 
    max={max} 
    step={step}
    className={className}
  >
    <SliderControl>
      <SliderTrack />
      <SliderThumb />
    </SliderControl>
  </SliderRoot>
);
