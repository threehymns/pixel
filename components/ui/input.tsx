import * as React from "react";
import {
  Input as PrimitiveInput,
  InputClear as PrimitiveInputClear,
  InputGroup as PrimitiveInputGroup,
  createInputController,
} from "@ui-sdk/react/input";
import { X } from "../Icons";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveInput>
>(({ className, ...props }, ref) => (
  <PrimitiveInput
    ref={ref}
    className={cn(
      "h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveInputGroup>
>(({ className, ...props }, ref) => (
  <PrimitiveInputGroup
    ref={ref}
    className={cn(
      "flex h-8 w-full items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs text-foreground transition-colors hover:border-border-strong focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40",
      className
    )}
    {...props}
  />
));
InputGroup.displayName = "InputGroup";

const InputClear = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveInputClear>
>(({ className, children, ...props }, ref) => (
  <PrimitiveInputClear
    ref={ref}
    aria-label="Clear input"
    className={cn(
      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  >
    {children ?? <X className="h-3 w-3" />}
  </PrimitiveInputClear>
));
InputClear.displayName = "InputClear";

export { Input, InputClear, InputGroup, createInputController };
