import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({ active, onClick, icon, label, className = '' }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button 
        onClick={onClick} 
        className={`p-1.5 rounded-sm transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'} ${className}`}
      >
        {icon}
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={8}>
      {label}
    </TooltipContent>
  </Tooltip>
);
