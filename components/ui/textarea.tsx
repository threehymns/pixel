import * as React from "react";
import { Textarea as PrimitiveTextarea } from "@ui-sdk/react/textarea";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTextarea>
>(({ className, ...props }, ref) => (
  <PrimitiveTextarea
    ref={ref}
    className={cn(
      "min-h-[68px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
