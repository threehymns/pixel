import * as React from "react";
import {
  Dialog as PrimitiveDialog,
  DialogBackdrop as PrimitiveDialogBackdrop,
  DialogClose as PrimitiveDialogClose,
  DialogContent as PrimitiveDialogContent,
  DialogDescription as PrimitiveDialogDescription,
  DialogShortcut as PrimitiveDialogShortcut,
  DialogTitle as PrimitiveDialogTitle,
  DialogTrigger as PrimitiveDialogTrigger,
  createDialogController,
} from "@ui-sdk/react/dialog";
import { X } from "../Icons";
import { cn } from "../../lib/utils";

const Dialog = PrimitiveDialog;
const DialogTrigger = PrimitiveDialogTrigger;
const DialogClose = PrimitiveDialogClose;
const DialogShortcut = PrimitiveDialogShortcut;

const DialogBackdrop = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDialogBackdrop>
>(({ className, ...props }, ref) => (
  <PrimitiveDialogBackdrop
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px]", className)}
    {...props}
  />
));
DialogBackdrop.displayName = "DialogBackdrop";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDialogContent>
>(({ className, ...props }, ref) => (
  <PrimitiveDialogContent
    ref={ref}
    className={cn(
      "fixed left-1/2 top-1/2 z-50 m-0 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border-strong bg-card p-0 text-card-foreground shadow-2xl outline-none",
      className
    )}
    {...props}
  />
));
DialogContent.displayName = "DialogContent";

const DialogSheetContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDialogContent>
>(({ className, ...props }, ref) => (
  <PrimitiveDialogContent
    ref={ref}
    data-sheet="bottom"
    className={cn(
      "fixed inset-x-0 bottom-0 z-50 m-0 flex max-h-[82dvh] w-full flex-col outline-none",
      className
    )}
    {...props}
  />
));
DialogSheetContent.displayName = "DialogSheetContent";

const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex h-10 shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4",
      className
    )}
    {...props}
  />
);

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDialogTitle>
>(({ className, ...props }, ref) => (
  <PrimitiveDialogTitle
    ref={ref}
    className={cn("text-xs font-semibold tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDialogDescription>
>(({ className, ...props }, ref) => (
  <PrimitiveDialogDescription
    ref={ref}
    className={cn("text-[11px] text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex h-11 shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/30 px-4",
      className
    )}
    {...props}
  />
);

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClassName?: string;
  bodyClassName?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClassName = "max-w-md",
  bodyClassName,
  footer,
  children,
}) => (
  <Dialog
    open={open}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}
  >
    <DialogBackdrop />
    <DialogContent className={maxWidthClassName}>
      <DialogHeader className={subtitle ? "h-auto py-2.5" : "h-10"}>
        <div className="min-w-0 pr-3">
          <DialogTitle className="truncate">{title}</DialogTitle>
          {subtitle && (
            <DialogDescription className="truncate mt-0.5">{subtitle}</DialogDescription>
          )}
        </div>
        <DialogClose
          render={
            <button
              type="button"
              aria-label={`Close ${title}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <X className="h-3.5 w-3.5" />
        </DialogClose>
      </DialogHeader>
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>
        {children}
      </div>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogContent>
  </Dialog>
);

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSheetContent,
  DialogShortcut,
  DialogTitle,
  DialogTrigger,
  ModalShell,
  createDialogController,
};
