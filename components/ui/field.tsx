import * as React from "react";
import {
  Field as PrimitiveField,
  FieldDescription as PrimitiveFieldDescription,
  FieldError as PrimitiveFieldError,
  FieldGroup as PrimitiveFieldGroup,
  FieldLabel as PrimitiveFieldLabel,
  FieldLegend as PrimitiveFieldLegend,
  FieldSet as PrimitiveFieldSet,
} from "@ui-sdk/react/field";
import { cn } from "../../lib/utils";

const Field = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveField>
>(({ className, ...props }, ref) => (
  <PrimitiveField
    ref={ref}
    className={cn("flex flex-col gap-1.5", className)}
    {...props}
  />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFieldLabel>
>(({ className, ...props }, ref) => (
  <PrimitiveFieldLabel
    ref={ref}
    className={cn(
      "text-xs font-medium text-muted-foreground select-none data-[invalid]:text-destructive",
      className
    )}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFieldDescription>
>(({ className, ...props }, ref) => (
  <PrimitiveFieldDescription
    ref={ref}
    className={cn("text-[11px] text-muted-foreground/80 leading-relaxed", className)}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFieldError>
>(({ className, ...props }, ref) => (
  <PrimitiveFieldError
    ref={ref}
    className={cn("text-[11px] font-medium text-destructive", className)}
    {...props}
  />
));
FieldError.displayName = "FieldError";

const FieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFieldSet>
>(({ className, ...props }, ref) => (
  <PrimitiveFieldSet
    ref={ref}
    className={cn("flex flex-col gap-3 border-0 p-0 m-0", className)}
    {...props}
  />
));
FieldSet.displayName = "FieldSet";

const FieldLegend = React.forwardRef<
  HTMLLegendElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFieldLegend>
>(({ className, ...props }, ref) => (
  <PrimitiveFieldLegend
    ref={ref}
    className={cn("text-xs font-semibold text-foreground mb-1", className)}
    {...props}
  />
));
FieldLegend.displayName = "FieldLegend";

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFieldGroup>
>(({ className, ...props }, ref) => (
  <PrimitiveFieldGroup
    ref={ref}
    className={cn("flex flex-col gap-3", className)}
    {...props}
  />
));
FieldGroup.displayName = "FieldGroup";

export {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
};
