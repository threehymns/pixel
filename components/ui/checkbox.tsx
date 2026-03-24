import * as React from "react";
import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CustomCheckbox = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Checkbox.Root>
>(({ className, ...props }, ref) => (
  <Checkbox.Root
    ref={ref}
    className={cn(
      "group flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-background transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <Checkbox.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3" strokeWidth={3} />
    </Checkbox.Indicator>
  </Checkbox.Root>
));
CustomCheckbox.displayName = "CustomCheckbox";

export { CustomCheckbox };
