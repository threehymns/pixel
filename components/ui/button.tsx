import * as React from "react";
import { Button as PrimitiveButton } from "@ui-sdk/react/button";
import { Loader2 } from "../Icons";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "touch";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-primary/80 shadow-xs hover:bg-primary/90 active:bg-primary/85",
  secondary:
    "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-border-strong",
  ghost:
    "bg-transparent text-muted-foreground border border-transparent hover:bg-accent hover:text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground border border-destructive/80 shadow-xs hover:bg-destructive/90",
  outline:
    "bg-background text-foreground border border-input hover:bg-accent hover:border-border-strong",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[11px] gap-1 rounded-sm",
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-8 px-3 text-xs gap-1.5 rounded-md",
  lg: "h-9 px-4 text-xs gap-2 rounded-md",
  touch: "min-h-11 px-3.5 text-xs gap-2 rounded-md",
};

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-6 w-6 p-0 rounded-sm",
  sm: "h-7 w-7 p-0 rounded-md",
  md: "h-8 w-8 p-0 rounded-md",
  lg: "h-9 w-9 p-0 rounded-md",
  touch: "h-11 w-11 p-0 rounded-md",
};

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof PrimitiveButton> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, disabled, children, ...props }, ref) => (
    <PrimitiveButton
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 data-[pending]:pointer-events-none data-[pending]:opacity-75",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
      {children}
    </PrimitiveButton>
  )
);
Button.displayName = "Button";

export interface IconButtonProps
  extends React.ComponentPropsWithoutRef<typeof PrimitiveButton> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  "aria-label": string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "sm", ...props }, ref) => (
    <PrimitiveButton
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 data-[pending]:pointer-events-none",
        VARIANT_CLASSES[variant],
        ICON_SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  )
);
IconButton.displayName = "IconButton";

export { Button, IconButton };
