import * as React from "react";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
  toast,
} from "@ui-sdk/react/toast";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from "../Icons";

const ToastTypeIcon: React.FC<{ type?: string }> = ({ type }) => {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
    case "loading":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />;
    case "info":
      return <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />;
    default:
      return null;
  }
};

export const StudioToaster: React.FC<{
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}> = ({ side = "bottom" as const, align = "end" as const }) => (
  <ToastRegion
    side={side as "top" | "bottom"}
    align={align as "start" | "center" | "end"}
    maxVisible={3}
    aria-label="Notifications"
  >
    {(item) => (
      <Toast className="flex items-start gap-2.5 rounded-lg border border-border-strong bg-popover px-3.5 py-2.5 text-popover-foreground shadow-2xl select-none">
        <div className="mt-0.5">
          <ToastTypeIcon type={item.type} />
        </div>
        <div className="min-w-0 flex-1">
          <ToastTitle className="text-xs font-semibold text-foreground leading-snug" />
          {item.description && (
            <ToastDescription className="mt-0.5 text-[11px] text-muted-foreground leading-snug" />
          )}
        </div>
        {item.action && (
          <ToastAction className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer" />
        )}
        <ToastClose
          aria-label="Dismiss notification"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <X className="h-3 w-3" />
        </ToastClose>
      </Toast>
    )}
  </ToastRegion>
);

export { toast };
