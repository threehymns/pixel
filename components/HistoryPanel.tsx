
import React from 'react';
import { 
  Pencil, Eraser, PaintBucket, MousePointer2, 
  Layers, Plus, Trash2, Copy, FilePlus, 
  Square, GripVertical, File, ArrowRightLeft,
  BoxSelect, Lasso, Wand2, Scissors, Circle, Edit2,
  Hand
} from './Icons';
import { ProjectState, HistoryEntry, ToolType } from '../types';

interface HistoryPanelProps {
  history: HistoryEntry[];
  historyIndex: number;
  onJumpToHistory: (index: number) => void;
  className?: string;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  historyIndex,
  onJumpToHistory,
  className
}) => {
  
  const getIcon = (action: string, tool?: ToolType) => {
      // First check tool
      if (tool) {
          switch(tool) {
              case 'pencil': return <Pencil size={14} />;
              case 'eraser': return <Eraser size={14} />;
              case 'bucket': return <PaintBucket size={14} />;
              case 'move': return <MousePointer2 size={14} />;
              case 'smudge': return <Hand size={14} />;
              case 'rect-select': return <BoxSelect size={14} />;
              case 'ellipse-select': return <Circle size={14} />;
              case 'lasso-select': return <Lasso size={14} />;
              case 'poly-lasso-select': return <Scissors size={14} />;
              case 'magic-wand': return <Wand2 size={14} />;
              default: break;
          }
      }

      // Check action string keywords
      const lower = action.toLowerCase();
      if (lower.includes('layer')) return <Layers size={14} />;
      if (lower.includes('rename')) return <Edit2 size={14} />;
      if (lower.includes('frame')) return <Plus size={14} />; // Or a generic plus
      if (lower.includes('delete')) return <Trash2 size={14} />;
      if (lower.includes('duplicate')) return <Copy size={14} />;
      if (lower.includes('project')) return <File size={14} />;
      if (lower.includes('reorder')) return <ArrowRightLeft size={14} />;
      if (lower.includes('import')) return <FilePlus size={14} />;
      if (lower.includes('selection')) return <BoxSelect size={14} />;

      return <Square size={14} />; // Default
  };

  return (
    <div 
      className={`bg-card flex flex-col ${className}`}
    >
      <div className="bg-secondary px-2 py-1 text-xs font-bold text-gray-300 flex justify-between items-center border-b border-background">
        <span>History</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {history.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs italic">
            No history yet.
          </div>
        ) : (
          history.map((entry, index) => {
            const isActive = index === historyIndex;
            return (
                <button
                key={`history-step-${index}`}
                onClick={() => onJumpToHistory(index)}
                className={`w-full text-left px-2 py-1.5 text-xs border-b border-muted transition-colors flex items-center gap-2
                    ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'}
                    ${index > historyIndex ? 'opacity-50' : ''} 
                `}
                aria-current={isActive ? 'step' : undefined}
                >
                <span className={`flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-gray-500'}`}>
                    {getIcon(entry.action, entry.tool)}
                </span>
                <span className="truncate font-medium">{entry.action}</span>
                </button>
            );
          })
        )}
      </div>
    </div>
  );
};
