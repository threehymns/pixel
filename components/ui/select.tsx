import * as React from "react";
import {
  Select as PrimitiveSelect,
  SelectArrow as PrimitiveSelectArrow,
  SelectContent as PrimitiveSelectContent,
  SelectGroup as PrimitiveSelectGroup,
  SelectGroupLabel as PrimitiveSelectGroupLabel,
  SelectItem as PrimitiveSelectItem,
  SelectItemIndicator as PrimitiveSelectItemIndicator,
  SelectLabel as PrimitiveSelectLabel,
  SelectSeparator as PrimitiveSelectSeparator,
  SelectTrigger as PrimitiveSelectTrigger,
  SelectValue as PrimitiveSelectValue,
  createSelectController,
} from "@ui-sdk/react/select";
import { Check, ChevronDown } from "../Icons";
import { cn } from "../../lib/utils";

const Select = PrimitiveSelect;
const SelectGroup = PrimitiveSelectGroup;
const SelectValue = PrimitiveSelectValue;
const SelectArrow = PrimitiveSelectArrow;

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSelectLabel>
>(({ className, ...props }, ref) => (
  <PrimitiveSelectLabel
    ref={ref}
    className={cn("text-[11px] font-medium text-muted-foreground", className)}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSelectTrigger>
>(({ className, children, ...props }, ref) => (
  <PrimitiveSelectTrigger
    ref={ref}
    className={cn(
      "inline-flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <span className="min-w-0 truncate">{children}</span>
    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  </PrimitiveSelectTrigger>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSelectContent>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <PrimitiveSelectContent
    ref={ref}
    sideOffset={sideOffset}
    collisionPadding={collisionPadding}
    className={cn(
      "z-50 max-h-64 min-w-[var(--anchor-width,8rem)] overflow-y-auto rounded-lg border border-border-strong bg-popover p-1 text-popover-foreground shadow-2xl outline-none",
      className
    )}
    {...props}
  />
));
SelectContent.displayName = "SelectContent";

const SelectGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSelectGroupLabel>
>(({ className, ...props }, ref) => (
  <PrimitiveSelectGroupLabel
    ref={ref}
    className={cn("px-2.5 py-1 text-[11px] font-medium text-muted-foreground", className)}
    {...props}
  />
));
SelectGroupLabel.displayName = "SelectGroupLabel";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSelectSeparator>
>(({ className, ...props }, ref) => (
  <PrimitiveSelectSeparator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSelectItem>
>(({ className, children, value, ...props }, ref) => (
  <PrimitiveSelectItem
    ref={ref}
    value={value}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2.5 text-xs text-foreground outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      className
    )}
    {...props}
  >
    <PrimitiveSelectItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-primary">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
    </PrimitiveSelectItemIndicator>
    <span className="truncate">{children}</span>
  </PrimitiveSelectItem>
));
SelectItem.displayName = "SelectItem";

export interface StudioSelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface StudioSelectProps<T extends string = string> {
  value: T;
  options: readonly StudioSelectOption<T>[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
}

function StudioSelect<T extends string = string>({
  value,
  options,
  onValueChange,
  placeholder,
  disabled,
  className,
  contentClassName,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  id,
}: StudioSelectProps<T>) {
  const items = React.useMemo(
    () => options.map((opt) => ({ value: opt.value, label: opt.label, disabled: opt.disabled })),
    [options]
  );

  return (
    <Select<T>
      value={value}
      items={items}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={className}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} label={opt.label} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export {
  Select,
  SelectArrow,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  StudioSelect,
  createSelectController,
};
