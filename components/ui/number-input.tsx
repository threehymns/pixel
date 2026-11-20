import * as React from "react";
import {
  NumberInput as PrimitiveNumberInput,
  NumberInputControl as PrimitiveNumberInputControl,
  NumberInputDecrement as PrimitiveNumberInputDecrement,
  NumberInputGroup as PrimitiveNumberInputGroup,
  NumberInputIncrement as PrimitiveNumberInputIncrement,
  NumberInputScrubArea as PrimitiveNumberInputScrubArea,
  NumberInputScrubAreaCursor as PrimitiveNumberInputScrubAreaCursor,
  createNumberInputController,
} from "@ui-sdk/react/number-input";
import { Minus, Plus } from "../Icons";
import { cn } from "../../lib/utils";

const NumberInput = PrimitiveNumberInput;
const NumberInputScrubArea = PrimitiveNumberInputScrubArea;
const NumberInputScrubAreaCursor = PrimitiveNumberInputScrubAreaCursor;

const NumberInputGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveNumberInputGroup>
>(({ className, ...props }, ref) => (
  <PrimitiveNumberInputGroup
    ref={ref}
    className={cn(
      "flex h-8 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background text-xs text-foreground transition-colors hover:border-border-strong focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40 data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));
NumberInputGroup.displayName = "NumberInputGroup";

const NumberInputControl = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveNumberInputControl>
>(({ className, size = 1, ...props }, ref) => (
  <PrimitiveNumberInputControl
    ref={ref}
    size={size}
    className={cn(
      "w-full min-w-0 flex-1 bg-transparent px-2 text-xs font-mono tabular-nums text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
));
NumberInputControl.displayName = "NumberInputControl";

const NumberInputDecrement = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveNumberInputDecrement>
>(({ className, children, ...props }, ref) => (
  <PrimitiveNumberInputDecrement
    ref={ref}
    aria-label="Decrease"
    className={cn(
      "flex w-6 shrink-0 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35 cursor-pointer",
      className
    )}
    {...props}
  >
    {children ?? <Minus className="h-3 w-3" />}
  </PrimitiveNumberInputDecrement>
));
NumberInputDecrement.displayName = "NumberInputDecrement";

const NumberInputIncrement = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveNumberInputIncrement>
>(({ className, children, ...props }, ref) => (
  <PrimitiveNumberInputIncrement
    ref={ref}
    aria-label="Increase"
    className={cn(
      "flex w-6 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35 cursor-pointer",
      className
    )}
    {...props}
  >
    {children ?? <Plus className="h-3 w-3" />}
  </PrimitiveNumberInputIncrement>
));
NumberInputIncrement.displayName = "NumberInputIncrement";

export interface StudioNumberInputProps {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  disabled?: boolean;
  readOnly?: boolean;
  prefix?: string;
  suffix?: string;
  showSteppers?: boolean;
  wheel?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
}

const StudioNumberInput: React.FC<StudioNumberInputProps> = ({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep,
  disabled,
  readOnly,
  prefix,
  suffix,
  showSteppers = false,
  wheel = true,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}) => {
  const [draft, setDraft] = React.useState<number | null>(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <NumberInput
      value={draft}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      disabled={disabled}
      readOnly={readOnly}
      wheel={wheel}
      onValueChange={(next) => {
        setDraft(next);
        if (next !== null && !Number.isNaN(next)) {
          onValueChange(next);
        }
      }}
      onValueCommit={(next) => {
        if (next === null || Number.isNaN(next)) {
          const fallback = min !== undefined ? Math.max(min, value) : value;
          setDraft(fallback);
          onValueChange(fallback);
        } else {
          setDraft(next);
          onValueChange(next);
        }
      }}
      className={cn("block w-full min-w-0", className)}
    >
      <NumberInputGroup>
        {showSteppers && <NumberInputDecrement />}
        {prefix && (
          <NumberInputScrubArea
            pixelsPerStep={3}
            className="flex shrink-0 items-center whitespace-nowrap pl-2 pr-1 text-[11px] font-medium text-muted-foreground select-none cursor-ew-resize"
          >
            <span>{prefix}</span>
          </NumberInputScrubArea>
        )}
        <NumberInputControl
          aria-label={ariaLabel}
          className={cn(prefix && "pl-1", suffix && "pr-1", inputClassName)}
        />
        {suffix && (
          <span className="flex shrink-0 items-center whitespace-nowrap pr-2 text-[11px] font-mono text-muted-foreground select-none">
            {suffix}
          </span>
        )}
        {showSteppers && <NumberInputIncrement />}
      </NumberInputGroup>
    </NumberInput>
  );
};

export {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInputScrubArea,
  NumberInputScrubAreaCursor,
  StudioNumberInput,
  createNumberInputController,
};
