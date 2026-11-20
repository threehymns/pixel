import * as React from "react";
import {
  AlertDialog as PrimitiveAlertDialog,
  AlertDialogBackdrop as PrimitiveAlertDialogBackdrop,
  AlertDialogClose as PrimitiveAlertDialogClose,
  AlertDialogContent as PrimitiveAlertDialogContent,
  AlertDialogDescription as PrimitiveAlertDialogDescription,
  AlertDialogTitle as PrimitiveAlertDialogTitle,
  AlertDialogTrigger as PrimitiveAlertDialogTrigger,
  createAlertDialogController,
  createConfirm,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "./button";
import { cn } from "../../lib/utils";

const AlertDialog = PrimitiveAlertDialog;
const AlertDialogTrigger = PrimitiveAlertDialogTrigger;
const AlertDialogClose = PrimitiveAlertDialogClose;

const AlertDialogBackdrop = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveAlertDialogBackdrop>
>(({ className, ...props }, ref) => (
  <PrimitiveAlertDialogBackdrop
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]", className)}
    {...props}
  />
));
AlertDialogBackdrop.displayName = "AlertDialogBackdrop";

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveAlertDialogContent>
>(({ className, ...props }, ref) => (
  <PrimitiveAlertDialogContent
    ref={ref}
    className={cn(
      "fixed left-1/2 top-1/2 z-50 m-0 flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border-strong bg-card p-5 text-card-foreground shadow-2xl outline-none",
      className
    )}
    {...props}
  />
));
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveAlertDialogTitle>
>(({ className, ...props }, ref) => (
  <PrimitiveAlertDialogTitle
    ref={ref}
    className={cn("text-sm font-semibold tracking-tight text-foreground", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveAlertDialogDescription>
>(({ className, ...props }, ref) => (
  <PrimitiveAlertDialogDescription
    ref={ref}
    className={cn("text-xs leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

export interface StudioConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export const studioConfirm = createConfirm<StudioConfirmOptions>();

export const StudioConfirmHost: React.FC = () => (
  <AlertDialog controller={studioConfirm.controller}>
    <AlertDialogBackdrop />
    <PrimitiveAlertDialogContent<StudioConfirmOptions>
      className="fixed left-1/2 top-1/2 z-50 m-0 flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border-strong bg-card p-5 text-card-foreground shadow-2xl outline-none"
    >
      {(state) => (
        <>
          <div className="flex flex-col gap-1.5">
            <AlertDialogTitle>
              {state.payload?.title ?? "Confirm action"}
            </AlertDialogTitle>
            {state.payload?.description && (
              <AlertDialogDescription>
                {state.payload.description}
              </AlertDialogDescription>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <AlertDialogClose render={<Button variant="secondary" size="md" />}>
              {state.payload?.cancelLabel ?? "Cancel"}
            </AlertDialogClose>
            <AlertDialogClose
              value="confirm"
              render={
                <Button
                  variant={state.payload?.destructive ? "destructive" : "primary"}
                  size="md"
                />
              }
            >
              {state.payload?.confirmLabel ?? "Confirm"}
            </AlertDialogClose>
          </div>
        </>
      )}
    </PrimitiveAlertDialogContent>
  </AlertDialog>
);

export {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogController,
  createConfirm,
};
