import * as React from "react";
import {
  Switch as PrimitiveSwitch,
  SwitchThumb as PrimitiveSwitchThumb,
  createSwitchController,
} from "@ui-sdk/react/switch";
import { cn } from "../../lib/utils";

const Switch = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveSwitch>
>(({ className, ...props }, ref) => (
  <PrimitiveSwitch
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input bg-secondary p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 data-[checked]:border-primary data-[checked]:bg-primary",
      className
    )}
    {...props}
  >
    <PrimitiveSwitchThumb
      className={cn(
        "pointer-events-none block h-3.5 w-3.5 rounded-full bg-foreground shadow-sm transition-transform data-[checked]:translate-x-4 data-[checked]:bg-primary-foreground"
      )}
    />
  </PrimitiveSwitch>
));
Switch.displayName = "Switch";

export { Switch, createSwitchController };
