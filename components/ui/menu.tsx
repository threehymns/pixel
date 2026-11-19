import * as React from "react";
import {
  Menu as PrimitiveMenu,
  MenuCheckboxItem as PrimitiveMenuCheckboxItem,
  MenuContent as PrimitiveMenuContent,
  MenuContextTrigger as PrimitiveMenuContextTrigger,
  MenuGroup as PrimitiveMenuGroup,
  MenuGroupLabel as PrimitiveMenuGroupLabel,
  MenuItem as PrimitiveMenuItem,
  MenuItemIcon as PrimitiveMenuItemIcon,
  MenuItemIndicator as PrimitiveMenuItemIndicator,
  MenuRadioGroup as PrimitiveMenuRadioGroup,
  MenuRadioItem as PrimitiveMenuRadioItem,
  MenuSeparator as PrimitiveMenuSeparator,
  MenuShortcut as PrimitiveMenuShortcut,
  MenuSub as PrimitiveMenuSub,
  MenuSubContent as PrimitiveMenuSubContent,
  MenuSubTrigger as PrimitiveMenuSubTrigger,
  MenuTrigger as PrimitiveMenuTrigger,
  createMenuController,
} from "@ui-sdk/react/menu";
import { Check, ChevronRight, Circle } from "../Icons";
import { cn } from "../../lib/utils";

const Menu: React.FC<React.ComponentPropsWithoutRef<typeof PrimitiveMenu>> = (props) => (
  <PrimitiveMenu {...props} />
);
const MenuTrigger = PrimitiveMenuTrigger;
const MenuContextTrigger = PrimitiveMenuContextTrigger;
const MenuGroup = PrimitiveMenuGroup;
const MenuRadioGroup = PrimitiveMenuRadioGroup;
const MenuSub: React.FC<React.ComponentPropsWithoutRef<typeof PrimitiveMenuSub>> = (props) => (
  <PrimitiveMenuSub {...props} />
);

const menuContentClass =
  "z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border-strong bg-popover p-1 text-popover-foreground shadow-2xl outline-none";

const menuItemClass =
  "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

const MenuContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuContent>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <PrimitiveMenuContent
    ref={ref}
    sideOffset={sideOffset}
    collisionPadding={collisionPadding}
    className={cn(menuContentClass, className)}
    {...props}
  />
));
MenuContent.displayName = "MenuContent";

const MenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuSubContent>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <PrimitiveMenuSubContent
    ref={ref}
    sideOffset={sideOffset}
    collisionPadding={collisionPadding}
    className={cn(menuContentClass, className)}
    {...props}
  />
));
MenuSubContent.displayName = "MenuSubContent";

const MenuItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuItem> & { inset?: boolean }
>(({ className, inset, destructive, ...props }, ref) => (
  <PrimitiveMenuItem
    ref={ref}
    destructive={destructive}
    className={cn(
      menuItemClass,
      destructive &&
        "text-destructive data-[highlighted]:bg-destructive/15 data-[highlighted]:text-destructive",
      inset && "pl-7",
      className
    )}
    {...props}
  />
));
MenuItem.displayName = "MenuItem";

const MenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuSubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <PrimitiveMenuSubTrigger
    ref={ref}
    className={cn(
      menuItemClass,
      "data-[open]:bg-accent data-[open]:text-accent-foreground",
      inset && "pl-7",
      className
    )}
    {...props}
  >
    <span className="flex-1 flex items-center gap-2">{children}</span>
    <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
  </PrimitiveMenuSubTrigger>
));
MenuSubTrigger.displayName = "MenuSubTrigger";

const MenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuCheckboxItem>
>(({ className, children, value, ...props }, ref) => (
  <PrimitiveMenuCheckboxItem
    ref={ref}
    value={value}
    className={cn(menuItemClass, "pl-7 pr-2.5", className)}
    {...props}
  >
    <PrimitiveMenuItemIndicator
      keepMounted
      className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-primary opacity-0 data-[checked]:opacity-100"
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
    </PrimitiveMenuItemIndicator>
    {children}
  </PrimitiveMenuCheckboxItem>
));
MenuCheckboxItem.displayName = "MenuCheckboxItem";

const MenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuRadioItem>
>(({ className, children, value, ...props }, ref) => (
  <PrimitiveMenuRadioItem
    ref={ref}
    value={value}
    className={cn(menuItemClass, "pl-7 pr-2.5", className)}
    {...props}
  >
    <PrimitiveMenuItemIndicator
      keepMounted
      className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-primary opacity-0 data-[checked]:opacity-100"
    >
      <Circle className="h-2 w-2 fill-current" />
    </PrimitiveMenuItemIndicator>
    {children}
  </PrimitiveMenuRadioItem>
));
MenuRadioItem.displayName = "MenuRadioItem";

const MenuItemIndicator = PrimitiveMenuItemIndicator;

const MenuItemIcon = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuItemIcon>
>(({ className, ...props }, ref) => (
  <PrimitiveMenuItemIcon
    ref={ref}
    className={cn("inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground", className)}
    {...props}
  />
));
MenuItemIcon.displayName = "MenuItemIcon";

const MenuGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuGroupLabel> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <PrimitiveMenuGroupLabel
    ref={ref}
    className={cn(
      "px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
      inset && "pl-7",
      className
    )}
    {...props}
  />
));
MenuGroupLabel.displayName = "MenuGroupLabel";

const MenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuSeparator>
>(({ className, ...props }, ref) => (
  <PrimitiveMenuSeparator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
MenuSeparator.displayName = "MenuSeparator";

const MenuShortcut = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveMenuShortcut>
>(({ className, ...props }, ref) => (
  <PrimitiveMenuShortcut
    ref={ref}
    className={cn(
      "ml-auto pl-4 font-mono text-[11px] text-muted-foreground/80",
      className
    )}
    {...props}
  />
));
MenuShortcut.displayName = "MenuShortcut";

export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuContextTrigger,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIcon,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  createMenuController,
};
