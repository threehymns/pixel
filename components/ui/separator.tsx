import * as React from "react";
import { Separator as PrimitiveSeparator } from "@ui-sdk/react/separator";
import { cn } from "../../lib/utils";

const Separator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSeparator>
>(({ className, orientation = "horizontal" as const, ...props }, ref) => (
  <PrimitiveSeparator
    ref={ref}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };
