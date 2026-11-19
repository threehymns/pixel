import * as React from "react";
import {
  Tooltip as PrimitiveTooltip,
  TooltipArrow as PrimitiveTooltipArrow,
  TooltipContent as PrimitiveTooltipContent,
  TooltipShortcut as PrimitiveTooltipShortcut,
  TooltipTrigger as PrimitiveTooltipTrigger,
  createTooltipController,
} from "@ui-sdk/react/tooltip";
import { cn } from "../../lib/utils";

const Tooltip: React.FC<React.ComponentPropsWithoutRef<typeof PrimitiveTooltip>> = (props) => (
  <PrimitiveTooltip {...props} />
);
const TooltipTrigger = PrimitiveTooltipTrigger;

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTooltipContent>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <PrimitiveTooltipContent
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 inline-flex items-center gap-1.5 w-max max-w-xs rounded-md border border-border-strong bg-popover px-2 py-1 text-[11px] font-medium leading-tight text-popover-foreground shadow-lg outline-none pointer-events-none select-none",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";

const TooltipArrow = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTooltipArrow>
>(({ className, ...props }, ref) => (
  <PrimitiveTooltipArrow
    ref={ref}
    className={cn("h-2 w-2 rotate-45 border-border-strong bg-popover", className)}
    {...props}
  />
));
TooltipArrow.displayName = "TooltipArrow";

const TooltipShortcut = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTooltipShortcut>
>(({ className, ...props }, ref) => (
  <PrimitiveTooltipShortcut
    ref={ref}
    className={cn(
      "ml-0.5 rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground",
      className
    )}
    {...props}
  />
));
TooltipShortcut.displayName = "TooltipShortcut";

export {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipShortcut,
  TooltipTrigger,
  createTooltipController,
};
