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

export const Popover = ({ children }: { children: React.ReactNode }) => {
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

    const triggerStyle = {
        // @ts-ignore
        anchorName: anchorName,
        ...style
    };

    const triggerProps = {
        ...props,
        ref,
        className,
        style: triggerStyle,
        // @ts-ignore
        popovertarget: id,
        onClick
    };

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement, triggerProps);
    }

    return (
        <button {...triggerProps}>
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

    let baseStyle: React.CSSProperties = {
        position: 'absolute',
        // @ts-ignore
        positionAnchor: anchorName,
        margin: 0,
        inset: 'auto',
    };

    const offset = `${sideOffset}px`;

    // Side logic
    if (side === 'bottom') {
        // @ts-ignore
        baseStyle.top = `calc(anchor(bottom) + ${offset})`;
        // @ts-ignore
        if (align === 'start') baseStyle.left = 'anchor(left)';
        // @ts-ignore
        else if (align === 'center') { baseStyle.left = 'anchor(center)'; baseStyle.translate = '-50%'; }
        // @ts-ignore
        else if (align === 'end') baseStyle.right = 'anchor(right)';
    } else if (side === 'top') {
        // @ts-ignore
        baseStyle.bottom = `calc(anchor(top) + ${offset})`;
        // @ts-ignore
        if (align === 'start') baseStyle.left = 'anchor(left)';
        // @ts-ignore
        else if (align === 'center') { baseStyle.left = 'anchor(center)'; baseStyle.translate = '-50%'; }
        // @ts-ignore
        else if (align === 'end') baseStyle.right = 'anchor(right)';
    } else if (side === 'right') {
        // @ts-ignore
        baseStyle.left = `calc(anchor(right) + ${offset})`;
        // @ts-ignore
        if (align === 'start') baseStyle.top = 'anchor(top)';
        // @ts-ignore
        else if (align === 'center') { baseStyle.top = 'anchor(center)'; baseStyle.translate = '0 -50%'; }
        // @ts-ignore
        else if (align === 'end') baseStyle.bottom = 'anchor(bottom)';
    } else if (side === 'left') {
        // @ts-ignore
        baseStyle.right = `calc(anchor(left) + ${offset})`;
        // @ts-ignore
        if (align === 'start') baseStyle.top = 'anchor(top)';
        // @ts-ignore
        else if (align === 'center') { baseStyle.top = 'anchor(center)'; baseStyle.translate = '0 -50%'; }
        // @ts-ignore
        else if (align === 'end') baseStyle.bottom = 'anchor(bottom)';
    }

    return (
      <div
        ref={ref}
        id={id}
        // @ts-ignore
        popover="auto"
        className={`z-50 min-w-[8rem] bg-popover text-popover-foreground border border-border rounded shadow-xl outline-none p-1 ${className} [&:not(:popover-open)]:hidden`}
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
            // @ts-ignore
            popovertarget: id,
            // @ts-ignore
            popovertargetaction: "hide"
        };

        if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children as React.ReactElement, combinedProps);
        }
        return <button {...combinedProps}>{children}</button>;
    }
);
PopoverClose.displayName = "PopoverClose";