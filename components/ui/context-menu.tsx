import * as React from "react"
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ContextMenu: React.FC<React.ComponentProps<typeof BaseContextMenu.Root>> = (props) => (
  <BaseContextMenu.Root {...props} />
)

const ContextMenuTrigger = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.Trigger>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.Trigger> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  if (asChild) {
    return (
      <BaseContextMenu.Trigger ref={ref} {...props} render={children as React.ReactElement} />
    )
  }
  return (
    <BaseContextMenu.Trigger ref={ref} {...props}>
      {children}
    </BaseContextMenu.Trigger>
  )
})
ContextMenuTrigger.displayName = "ContextMenuTrigger"

const ContextMenuGroup = BaseContextMenu.Group

const ContextMenuPortal = BaseContextMenu.Portal

const ContextMenuSub = BaseContextMenu.SubmenuRoot

const ContextMenuRadioGroup = BaseContextMenu.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.SubmenuTrigger>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.SubmenuTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <BaseContextMenu.SubmenuTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-xs outline-none hover:bg-primary hover:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[open]:bg-primary data-[open]:text-primary-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
  </BaseContextMenu.SubmenuTrigger>
))
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger"

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.Popup>
>(({ className, ...props }, ref) => (
  <BaseContextMenu.Portal>
    <BaseContextMenu.Positioner className="z-50">
      <BaseContextMenu.Popup
        ref={ref}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-white/5 bg-card/95 backdrop-blur-sm p-1 text-popover-foreground shadow-lg outline-none data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </BaseContextMenu.Positioner>
  </BaseContextMenu.Portal>
))
ContextMenuSubContent.displayName = "ContextMenuSubContent"

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.Popup>
>(({ className, ...props }, ref) => (
  <BaseContextMenu.Portal>
    <BaseContextMenu.Backdrop className="fixed inset-0 z-50 bg-transparent" />
    <BaseContextMenu.Positioner className="z-50">
      <BaseContextMenu.Popup
        ref={ref}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-white/5 bg-card/95 backdrop-blur-sm p-1 text-popover-foreground shadow-lg outline-none animate-in fade-in-80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </BaseContextMenu.Positioner>
  </BaseContextMenu.Portal>
))
ContextMenuContent.displayName = "ContextMenuContent"

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.Item>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <BaseContextMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-xs outline-none hover:bg-primary hover:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuItem.displayName = "ContextMenuItem"

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <BaseContextMenu.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-xs outline-none hover:bg-primary hover:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <BaseContextMenu.CheckboxItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </BaseContextMenu.CheckboxItemIndicator>
    </span>
    {children}
  </BaseContextMenu.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem"

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.RadioItem>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <BaseContextMenu.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-xs outline-none hover:bg-primary hover:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <BaseContextMenu.RadioItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </BaseContextMenu.RadioItemIndicator>
    </span>
    {children}
  </BaseContextMenu.RadioItem>
))
ContextMenuRadioItem.displayName = "ContextMenuRadioItem"

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.GroupLabel>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.GroupLabel> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <BaseContextMenu.GroupLabel
    ref={ref}
    className={cn(
      "px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuLabel.displayName = "ContextMenuLabel"

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof BaseContextMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof BaseContextMenu.Separator>
>(({ className, ...props }, ref) => (
  <BaseContextMenu.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = "ContextMenuSeparator"

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
