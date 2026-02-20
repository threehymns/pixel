
import React, { createContext, useContext, useId, forwardRef } from 'react';

const TooltipContext = createContext<{
  id: string;
  anchorName: string;
} | null>(null);

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const unique = useId().replace(/:/g, '');
  const id = `tooltip-${unique}`;
  const anchorName = `--tooltip-anchor-${unique}`;

  return (
    <TooltipContext.Provider value={{ id, anchorName }}>
      {children}
    </TooltipContext.Provider>
  );
};

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const TooltipTrigger = forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ children, className, asChild = false, style, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, ref) => {
    const context = useContext(TooltipContext);
    if (!context) throw new Error("TooltipTrigger must be used within a Tooltip component");
    const { id, anchorName } = context;

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
      onMouseEnter?.(e);
      const popover = document.getElementById(id);
      if (popover) {
        try { popover.showPopover(); } catch (err) {}
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
      onMouseLeave?.(e);
      const popover = document.getElementById(id);
      if (popover) {
        try { popover.hidePopover(); } catch (err) {}
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
      onFocus?.(e);
      document.getElementById(id)?.showPopover();
    };

    const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
      onBlur?.(e);
      document.getElementById(id)?.hidePopover();
    };

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      const existingAnchorName = (child.props.style?.anchorName) || (child.props.style?.['anchor-name']) || (style as any)?.anchorName;
      const mergedAnchorName = existingAnchorName ? `${existingAnchorName}, ${anchorName}` : anchorName;

      return React.cloneElement(child, {
        ...props,
        ref,
        className: `${child.props.className || ''} ${className || ''}`.trim(),
        style: {
          ...child.props.style,
          ...style,
          anchorName: mergedAnchorName,
          'anchor-name': mergedAnchorName,
        } as any,
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
          child.props.onMouseEnter?.(e);
          handleMouseEnter(e);
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
          child.props.onMouseLeave?.(e);
          handleMouseLeave(e);
        },
        onFocus: (e: React.FocusEvent<HTMLElement>) => {
          child.props.onFocus?.(e);
          handleFocus(e);
        },
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
          child.props.onBlur?.(e);
          handleBlur(e);
        },
      });
    }

    const mergedAnchorName = (style as any)?.anchorName ? `${(style as any).anchorName}, ${anchorName}` : anchorName;

    return (
      <span 
        {...props} 
        ref={ref}
        className={`inline-flex ${className || ''}`}
        style={{ ...style, anchorName: mergedAnchorName, 'anchor-name': mergedAnchorName } as any}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {children}
      </span>
    );
  }
);
TooltipTrigger.displayName = "TooltipTrigger";

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ children, className, side = 'top', align = 'center', sideOffset = 6, style, ...props }, ref) => {
    const context = useContext(TooltipContext);
    if (!context) return null;
    const { id, anchorName } = context;

    let baseStyle: any = {
      position: 'fixed',
      positionAnchor: anchorName,
      'position-anchor': anchorName,
      margin: 0,
      inset: 'auto',
      width: 'max-content',
      pointerEvents: 'none',
    };

    const offset = `${sideOffset}px`;

    if (side === 'bottom') {
      baseStyle.top = `calc(anchor(bottom) + ${offset})`;
      if (align === 'start') { baseStyle.left = 'anchor(left)'; }
      else if (align === 'center') { baseStyle.left = 'anchor(center)'; baseStyle.translate = '-50%'; }
      else if (align === 'end') { baseStyle.right = 'anchor(right)'; }
    } else if (side === 'top') {
      baseStyle.bottom = `calc(anchor(top) + ${offset})`;
      if (align === 'start') { baseStyle.left = 'anchor(left)'; }
      else if (align === 'center') { baseStyle.left = 'anchor(center)'; baseStyle.translate = '-50%'; }
      else if (align === 'end') { baseStyle.right = 'anchor(right)'; }
    } else if (side === 'right') {
      baseStyle.left = `calc(anchor(right) + ${offset})`;
      if (align === 'start') { baseStyle.top = 'anchor(top)'; }
      else if (align === 'center') { baseStyle.top = 'anchor(center)'; baseStyle.translate = '0 -50%'; }
      else if (align === 'end') { baseStyle.bottom = 'anchor(bottom)'; }
    } else if (side === 'left') {
      baseStyle.right = `calc(anchor(left) + ${offset})`;
      if (align === 'start') { baseStyle.top = 'anchor(top)'; }
      else if (align === 'center') { baseStyle.top = 'anchor(center)'; baseStyle.translate = '0 -50%'; }
      else if (align === 'end') { baseStyle.bottom = 'anchor(bottom)'; }
    }

    return (
      <div
        ref={ref}
        id={id}
        popover="manual"
        className={`z-[100] px-2 py-1 text-[10px] font-bold tracking-wide uppercase bg-popover text-popover-foreground border border-border rounded shadow-md animate-in fade-in zoom-in-95 duration-75 ${className || ''} [&:not(:popover-open)]:hidden`}
        style={{ ...baseStyle, ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";
