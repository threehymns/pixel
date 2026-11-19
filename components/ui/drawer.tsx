import * as React from "react";
import {
  Drawer as PrimitiveDrawer,
  DrawerBackdrop as PrimitiveDrawerBackdrop,
  DrawerClose as PrimitiveDrawerClose,
  DrawerContent as PrimitiveDrawerContent,
  DrawerDescription as PrimitiveDrawerDescription,
  DrawerHandle as PrimitiveDrawerHandle,
  DrawerOutlet as PrimitiveDrawerOutlet,
  DrawerShortcut as PrimitiveDrawerShortcut,
  DrawerTitle as PrimitiveDrawerTitle,
  DrawerTrigger as PrimitiveDrawerTrigger,
  createDrawerController,
} from "@ui-sdk/react/drawer";
import { cn } from "../../lib/utils";

const Drawer = PrimitiveDrawer;
const DrawerTrigger = PrimitiveDrawerTrigger;
const DrawerClose = PrimitiveDrawerClose;
const DrawerOutlet = PrimitiveDrawerOutlet;
const DrawerShortcut = PrimitiveDrawerShortcut;

const DrawerBackdrop = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDrawerBackdrop>
>(({ className, ...props }, ref) => (
  <PrimitiveDrawerBackdrop
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px]", className)}
    {...props}
  />
));
DrawerBackdrop.displayName = "DrawerBackdrop";

const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDrawerContent>
>(({ className, ...props }, ref) => (
  <PrimitiveDrawerContent
    ref={ref}
    className={cn(
      "z-50 m-0 flex flex-col overflow-hidden border-border-strong bg-card p-0 text-card-foreground shadow-2xl outline-none",
      className
    )}
    {...props}
  />
));
DrawerContent.displayName = "DrawerContent";

const DrawerHandle = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDrawerHandle>
>(({ className, ...props }, ref) => (
  <PrimitiveDrawerHandle
    ref={ref}
    aria-label="Resize drawer"
    className={cn(
      "mx-auto my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong transition-colors hover:bg-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  />
));
DrawerHandle.displayName = "DrawerHandle";

const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDrawerTitle>
>(({ className, ...props }, ref) => (
  <PrimitiveDrawerTitle
    ref={ref}
    className={cn("text-xs font-semibold tracking-tight text-foreground", className)}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveDrawerDescription>
>(({ className, ...props }, ref) => (
  <PrimitiveDrawerDescription
    ref={ref}
    className={cn("text-[11px] text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerOutlet,
  DrawerShortcut,
  DrawerTitle,
  DrawerTrigger,
  createDrawerController,
};
