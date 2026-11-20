import * as React from "react";
import {
  Tree as PrimitiveTree,
  TreeGroup as PrimitiveTreeGroup,
  TreeItem as PrimitiveTreeItem,
  TreeItemIndicator as PrimitiveTreeItemIndicator,
  TreeItemLabel as PrimitiveTreeItemLabel,
  createTreeController,
} from "@ui-sdk/react/tree";
import { cn } from "../../lib/utils";

const Tree = React.forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTree>
>(({ className, ...props }, ref) => (
  <PrimitiveTree
    ref={ref}
    className={cn("list-none m-0 p-0 outline-none select-none", className)}
    {...props}
  />
));
Tree.displayName = "Tree";

const TreeGroup = React.forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTreeGroup>
>(({ className, ...props }, ref) => (
  <PrimitiveTreeGroup
    ref={ref}
    className={cn("list-none m-0 p-0", className)}
    {...props}
  />
));
TreeGroup.displayName = "TreeGroup";

const TreeItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveTreeItem>
>(({ className, value, ...props }, ref) => (
  <PrimitiveTreeItem
    ref={ref}
    value={value}
    className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", className)}
    {...props}
  />
));
TreeItem.displayName = "TreeItem";

const TreeItemLabel = PrimitiveTreeItemLabel;
const TreeItemIndicator = PrimitiveTreeItemIndicator;

export {
  Tree,
  TreeGroup,
  TreeItem,
  TreeItemIndicator,
  TreeItemLabel,
  createTreeController,
};
