import * as React from "react";
import {
  Checkbox as PrimitiveCheckbox,
  CheckboxGroup as PrimitiveCheckboxGroup,
  CheckboxIndicator as PrimitiveCheckboxIndicator,
  createCheckboxController,
  createCheckboxGroupController,
  type CheckedState,
} from "@ui-sdk/react/checkbox";
import { Check } from "../Icons";
import { cn } from "../../lib/utils";

const Checkbox = PrimitiveCheckbox;
const CheckboxGroup = PrimitiveCheckboxGroup;
const CheckboxIndicator = PrimitiveCheckboxIndicator;

export interface CustomCheckboxProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof PrimitiveCheckbox>,
    "onCheckedChange" | "checked"
  > {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const CustomCheckbox = React.forwardRef<HTMLButtonElement, CustomCheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <PrimitiveCheckbox
      ref={ref}
      checked={checked}
      onCheckedChange={(next: CheckedState) => {
        onCheckedChange?.(next === true);
      }}
      className={cn(
        "group flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong bg-background text-primary-foreground transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45 data-[checked]:border-primary data-[checked]:bg-primary",
        className
      )}
      {...props}
    >
      <PrimitiveCheckboxIndicator className="flex items-center justify-center text-current">
        <Check className="h-3 w-3" strokeWidth={3} />
      </PrimitiveCheckboxIndicator>
    </PrimitiveCheckbox>
  )
);
CustomCheckbox.displayName = "CustomCheckbox";

export {
  Checkbox,
  CheckboxGroup,
  CheckboxIndicator,
  CustomCheckbox,
  createCheckboxController,
  createCheckboxGroupController,
};
