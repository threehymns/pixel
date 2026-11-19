import * as React from "react";
import {
  Popover as PrimitivePopover,
  PopoverArrow as PrimitivePopoverArrow,
  PopoverClose as PrimitivePopoverClose,
  PopoverContent as PrimitivePopoverContent,
  PopoverDescription as PrimitivePopoverDescription,
  PopoverShortcut as PrimitivePopoverShortcut,
  PopoverTitle as PrimitivePopoverTitle,
  PopoverTrigger as PrimitivePopoverTrigger,
  createPopoverController,
} from "@ui-sdk/react/popover";
import { cn } from "../../lib/utils";

const Popover: React.FC<React.ComponentPropsWithoutRef<typeof PrimitivePopover>> = (props) => (
  <PrimitivePopover {...props} />
);
const PopoverTrigger = PrimitivePopoverTrigger;
const PopoverClose = PrimitivePopoverClose;
const PopoverShortcut = PrimitivePopoverShortcut;

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitivePopoverContent>
>(({ className, align = "center" as const, sideOffset = 6, collisionPadding = 8, ...props }, ref) => (
  <PrimitivePopoverContent
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    collisionPadding={collisionPadding}
    className={cn(
      "z-50 w-80 rounded-lg border border-border-strong bg-popover p-3.5 text-popover-foreground shadow-2xl outline-none",
      className
    )}
    {...props}
  />
));
PopoverContent.displayName = "PopoverContent";

const PopoverTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof PrimitivePopoverTitle>
>(({ className, ...props }, ref) => (
  <PrimitivePopoverTitle
    ref={ref}
    className={cn("text-xs font-semibold text-foreground", className)}
    {...props}
  />
));
PopoverTitle.displayName = "PopoverTitle";

const PopoverDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof PrimitivePopoverDescription>
>(({ className, ...props }, ref) => (
  <PrimitivePopoverDescription
    ref={ref}
    className={cn("text-[11px] text-muted-foreground", className)}
    {...props}
  />
));
PopoverDescription.displayName = "PopoverDescription";

const PopoverArrow = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitivePopoverArrow>
>(({ className, ...props }, ref) => (
  <PrimitivePopoverArrow
    ref={ref}
    className={cn("h-2.5 w-2.5 rotate-45 border border-border-strong bg-popover", className)}
    {...props}
  />
));
PopoverArrow.displayName = "PopoverArrow";

export {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverShortcut,
  PopoverTitle,
  PopoverTrigger,
  createPopoverController,
};
