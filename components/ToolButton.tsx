import React from 'react';

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    title={label} 
    className={`p-1.5 rounded-sm transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
  >
    {icon}
  </button>
);