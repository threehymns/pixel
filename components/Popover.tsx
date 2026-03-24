
import React, { createContext, useContext, useId } from 'react';

const PopoverContext = createContext<{
  id: string;
  anchorName: string;
} | null>(null);

export const usePopover = () => {
  const context = useContext(PopoverContext);
  if (!context) throw new Error("usePopover must be used within <Popover>");
  return context;
};

export const Popover: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const unique = useId().replace(/:/g, '');
  const id = `popover-${unique}`;
  const anchorName = `--anchor-${unique}`;

  return (
    <PopoverContext.Provider value={{ id, anchorName }}>
      {children}
    </PopoverContext.Provider>
  );
};

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ children, className, asChild = false, style, onClick, ...props }, ref) => {
    const { id, anchorName } = usePopover();

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      const existingAnchorName = (child.props.style?.anchorName) || (style as any)?.anchorName;
      const mergedAnchorName = existingAnchorName ? `${existingAnchorName}, ${anchorName}` : anchorName;

      return React.cloneElement(child, {
        ...props,
        ref,
        className: `${child.props.className || ''} ${className || ''}`.trim(),
        style: {
          ...child.props.style,
          ...style,
          anchorName: mergedAnchorName,
        } as any,
        popoverTarget: id,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          child.props.onClick?.(e);
          onClick?.(e);
        }
      });
    }

    const mergedAnchorName = (style as any)?.anchorName ? `${(style as any).anchorName}, ${anchorName}` : anchorName;

    return (
      <button 
        {...props} 
        ref={ref} 
        className={className}
        style={{ ...style, anchorName: mergedAnchorName } as any}
        popoverTarget={id}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
);
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ children, className, side = 'bottom', align = 'center', sideOffset = 4, style, ...props }, ref) => {
    const { id, anchorName } = usePopover();

    let baseStyle: any = {
        position: 'fixed',
        positionAnchor: anchorName,
        margin: 0,
        inset: 'auto',
        width: 'max-content',
        height: 'max-content',
        maxWidth: '100vw',
        maxHeight: '100vh',
        overflow: 'visible',
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
        popover="auto"
        className={`z-[99] min-w-[8rem] bg-popover text-popover-foreground border border-border rounded shadow-xl outline-none p-1 animate-in fade-in zoom-in-95 duration-100 ${className || ''} [&:not(:popover-open)]:hidden`}
        style={{ ...baseStyle, ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = "PopoverContent";

export const PopoverClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
    ({ children, asChild, ...props }, ref) => {
        const { id } = usePopover();
        const combinedProps = {
            ...props,
            ref,
            popoverTarget: id,
            // Fix: Cast the string literal to satisfy the exact union type required by modern React types for popoverTargetAction.
            popoverTargetAction: "hide" as "hide"
        };

        if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children as React.ReactElement, combinedProps);
        }
        return <button {...combinedProps}>{children}</button>;
    }
);
PopoverClose.displayName = "PopoverClose";
