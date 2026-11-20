import * as React from "react";
import {
  Toolbar as PrimitiveToolbar,
  ToolbarButton as PrimitiveToolbarButton,
  ToolbarGroup as PrimitiveToolbarGroup,
  ToolbarInput as PrimitiveToolbarInput,
  ToolbarLink as PrimitiveToolbarLink,
  ToolbarSeparator as PrimitiveToolbarSeparator,
  createToolbarController,
} from "@ui-sdk/react/toolbar";
import { cn } from "../../lib/utils";

const Toolbar = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveToolbar>
>(({ className, ...props }, ref) => (
  <PrimitiveToolbar
    ref={ref}
    className={cn("flex items-center gap-1 select-none", className)}
    {...props}
  />
));
Toolbar.displayName = "Toolbar";

const ToolbarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveToolbarGroup>
>(({ className, ...props }, ref) => (
  <PrimitiveToolbarGroup
    ref={ref}
    className={cn("flex items-center gap-0.5", className)}
    {...props}
  />
));
ToolbarGroup.displayName = "ToolbarGroup";

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveToolbarButton>
>(({ className, ...props }, ref) => (
  <PrimitiveToolbarButton
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
      className
    )}
    {...props}
  />
));
ToolbarButton.displayName = "ToolbarButton";

const ToolbarSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveToolbarSeparator>
>(({ className, ...props }, ref) => (
  <PrimitiveToolbarSeparator
    ref={ref}
    className={cn("mx-1 h-4 w-px shrink-0 bg-border", className)}
    {...props}
  />
));
ToolbarSeparator.displayName = "ToolbarSeparator";

const ToolbarInput = PrimitiveToolbarInput;
const ToolbarLink = PrimitiveToolbarLink;

export {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarInput,
  ToolbarLink,
  ToolbarSeparator,
  createToolbarController,
};
