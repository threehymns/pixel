import * as React from "react";
import {
  SegmentedControl as PrimitiveSegmentedControl,
  SegmentedControlIndicator as PrimitiveSegmentedControlIndicator,
  SegmentedControlItem as PrimitiveSegmentedControlItem,
  createSegmentedControlController,
} from "@ui-sdk/react/segmented-control";
import { cn } from "../../lib/utils";

function SegmentedControl<T extends string = string>({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof PrimitiveSegmentedControl<T>>) {
  return (
    <PrimitiveSegmentedControl<T>
      className={cn(
        "inline-flex w-full items-center gap-0.5 rounded-md border border-border bg-background p-0.5 select-none",
        className
      )}
      {...props}
    />
  );
}

const SegmentedControlIndicator = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSegmentedControlIndicator>
>(({ className, ...props }, ref) => (
  <PrimitiveSegmentedControlIndicator
    ref={ref}
    className={cn(
      "rounded-[4px] border border-border-strong bg-accent shadow-xs",
      className
    )}
    {...props}
  />
));
SegmentedControlIndicator.displayName = "SegmentedControlIndicator";

const SegmentedControlItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSegmentedControlItem>
>(({ className, value, ...props }, ref) => (
  <PrimitiveSegmentedControlItem
    ref={ref}
    value={value}
    className={cn(
      "relative flex-1 inline-flex items-center justify-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 data-[checked]:text-foreground",
      className
    )}
    {...props}
  />
));
SegmentedControlItem.displayName = "SegmentedControlItem";

export {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
  createSegmentedControlController,
};
