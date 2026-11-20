import * as React from "react";
import {
  Tabs as PrimitiveTabs,
  TabsIndicator as PrimitiveTabsIndicator,
  TabsList as PrimitiveTabsList,
  TabsPanel as PrimitiveTabsPanel,
  TabsTab as PrimitiveTabsTab,
  TabsTabIcon as PrimitiveTabsTabIcon,
  createTabsController,
} from "@ui-sdk/react/tabs";
import { cn } from "../../lib/utils";

const Tabs = PrimitiveTabs;
const TabsTabIcon = PrimitiveTabsTabIcon;

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTabsList>
>(({ className, ...props }, ref) => (
  <PrimitiveTabsList
    ref={ref}
    className={cn(
      "relative flex items-center gap-0.5 border-b border-border select-none",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTab = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTabsTab>
>(({ className, value, ...props }, ref) => (
  <PrimitiveTabsTab
    ref={ref}
    value={value}
    className={cn(
      "relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 data-[selected]:text-foreground cursor-pointer",
      className
    )}
    {...props}
  />
));
TabsTab.displayName = "TabsTab";

const TabsIndicator = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTabsIndicator>
>(({ className, ...props }, ref) => (
  <PrimitiveTabsIndicator
    ref={ref}
    className={cn("bg-primary rounded-t-full", className)}
    {...props}
  />
));
TabsIndicator.displayName = "TabsIndicator";

const TabsPanel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTabsPanel>
>(({ className, value, ...props }, ref) => (
  <PrimitiveTabsPanel
    ref={ref}
    value={value}
    className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...props}
  />
));
TabsPanel.displayName = "TabsPanel";

export {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsTab,
  TabsTabIcon,
  createTabsController,
};
