import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipShortcut,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn } from "../lib/utils";

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  active,
  onClick,
  icon,
  label,
  shortcut,
  disabled = false,
  tooltipSide = "right",
  className = "",
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
            active
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
            className
          )}
        />
      }
    >
      {icon}
    </TooltipTrigger>
    <TooltipContent side={tooltipSide} sideOffset={8}>
      <span>{label}</span>
      {shortcut && <TooltipShortcut>{shortcut}</TooltipShortcut>}
    </TooltipContent>
  </Tooltip>
);
