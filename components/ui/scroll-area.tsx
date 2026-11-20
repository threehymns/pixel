import * as React from "react";
import {
  ScrollArea as PrimitiveScrollArea,
  ScrollAreaContent as PrimitiveScrollAreaContent,
  ScrollAreaCorner as PrimitiveScrollAreaCorner,
  ScrollAreaScrollbar as PrimitiveScrollAreaScrollbar,
  ScrollAreaThumb as PrimitiveScrollAreaThumb,
  ScrollAreaViewport as PrimitiveScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { cn } from "../../lib/utils";

export interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof PrimitiveScrollArea> {
  viewportClassName?: string;
  orientation?: "vertical" | "horizontal" | "both";
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, orientation = "vertical", children, ...props }, ref) => (
    <PrimitiveScrollArea
      ref={ref}
      type="hover"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <PrimitiveScrollAreaViewport
        className={cn("h-full w-full rounded-[inherit] outline-none", viewportClassName)}
      >
        <PrimitiveScrollAreaContent className="min-w-full">
          {children}
        </PrimitiveScrollAreaContent>
      </PrimitiveScrollAreaViewport>
      {(orientation === "vertical" || orientation === "both") && (
        <PrimitiveScrollAreaScrollbar
          orientation="vertical"
          className="flex w-2 touch-none select-none p-0.5 transition-opacity data-[hidden]:opacity-0"
        >
          <PrimitiveScrollAreaThumb className="relative flex-1 rounded-full bg-white/15 hover:bg-white/25" />
        </PrimitiveScrollAreaScrollbar>
      )}
      {(orientation === "horizontal" || orientation === "both") && (
        <PrimitiveScrollAreaScrollbar
          orientation="horizontal"
          className="flex h-2 flex-col touch-none select-none p-0.5 transition-opacity data-[hidden]:opacity-0"
        >
          <PrimitiveScrollAreaThumb className="relative flex-1 rounded-full bg-white/15 hover:bg-white/25" />
        </PrimitiveScrollAreaScrollbar>
      )}
      {orientation === "both" && <PrimitiveScrollAreaCorner />}
    </PrimitiveScrollArea>
  )
);
ScrollArea.displayName = "ScrollArea";

export {
  PrimitiveScrollArea,
  PrimitiveScrollAreaContent,
  PrimitiveScrollAreaCorner,
  PrimitiveScrollAreaScrollbar,
  PrimitiveScrollAreaThumb,
  PrimitiveScrollAreaViewport,
  ScrollArea,
};
