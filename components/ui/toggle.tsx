import * as React from "react";
import {
  Toggle as PrimitiveToggle,
  ToggleGroup as PrimitiveToggleGroup,
  ToggleIcon as PrimitiveToggleIcon,
  createToggleController,
  createToggleGroupController,
} from "@ui-sdk/react/toggle";
import { cn } from "../../lib/utils";

type ToggleVariant = "solid" | "tint";
type ToggleSize = "xs" | "sm" | "md" | "icon-sm" | "icon-md" | "touch";

const TOGGLE_VARIANT_CLASSES: Record<ToggleVariant, string> = {
  solid:
    "text-muted-foreground hover:bg-accent hover:text-foreground data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:shadow-xs",
  tint:
    "text-muted-foreground hover:bg-accent hover:text-foreground data-[pressed]:bg-primary/15 data-[pressed]:text-primary data-[pressed]:ring-1 data-[pressed]:ring-primary/35",
};

const TOGGLE_SIZE_CLASSES: Record<ToggleSize, string> = {
  xs: "h-6 px-2 text-[11px] gap-1 rounded-sm",
  sm: "h-7 px-2 text-xs gap-1.5 rounded-md",
  md: "h-8 px-2.5 text-xs gap-1.5 rounded-md",
  "icon-sm": "h-7 w-7 p-0 rounded-md",
  "icon-md": "h-8 w-8 p-0 rounded-md",
  touch: "h-11 min-w-11 px-2.5 text-xs gap-1.5 rounded-md",
};

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof PrimitiveToggle> {
  variant?: ToggleVariant;
  size?: ToggleSize;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, variant = "tint", size = "icon-sm", ...props }, ref) => (
    <PrimitiveToggle
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        TOGGLE_VARIANT_CLASSES[variant],
        TOGGLE_SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  )
);
Toggle.displayName = "Toggle";

function ToggleGroup<T extends string = string>({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof PrimitiveToggleGroup<T>>) {
  return (
    <PrimitiveToggleGroup<T>
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

const ToggleIcon = PrimitiveToggleIcon;

export {
  Toggle,
  ToggleGroup,
  ToggleIcon,
  createToggleController,
  createToggleGroupController,
};
