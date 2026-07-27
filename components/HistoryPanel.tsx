import React, { useRef, useEffect, useState } from 'react';
import { 
  Pencil, Eraser, PaintBucket, MousePointer2, 
  Layers, Plus, Trash2, Copy, FilePlus, 
  Square, File, ArrowRightLeft,
  BoxSelect, Lasso, Wand2, Scissors, Circle, Edit2,
  Hand, Undo, Redo, Search, X
} from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { HistoryEntry, ToolType } from '../types';

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
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [historyIndex]);
  
  const getIcon = (action: string, tool?: ToolType) => {
      if (tool) {
          switch(tool) {
              case 'pencil': return <Pencil size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'eraser': return <Eraser size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'bucket': return <PaintBucket size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'move': return <MousePointer2 size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'smudge': return <Hand size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'rect-select': return <BoxSelect size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'ellipse-select': return <Circle size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'lasso-select': return <Lasso size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'poly-lasso-select': return <Scissors size={11} className="text-muted-foreground group-hover:text-foreground" />;
              case 'magic-wand': return <Wand2 size={11} className="text-muted-foreground group-hover:text-foreground" />;
              default: break;
          }
      }

      const lower = action.toLowerCase();
      if (lower.includes('layer')) return <Layers size={11} className="text-emerald-500/80" />;
      if (lower.includes('rename')) return <Edit2 size={11} className="text-emerald-500/80" />;
      if (lower.includes('frame')) return <Plus size={11} className="text-blue-500/80" />;
      if (lower.includes('delete')) return <Trash2 size={11} className="text-rose-500/80" />;
      if (lower.includes('duplicate')) return <Copy size={11} className="text-muted-foreground/80" />;
      if (lower.includes('project')) return <File size={11} className="text-blue-500/80" />;
      if (lower.includes('reorder')) return <ArrowRightLeft size={11} className="text-purple-500/80" />;
      if (lower.includes('import')) return <FilePlus size={11} className="text-blue-500/80" />;
      if (lower.includes('selection')) return <BoxSelect size={11} className="text-purple-500/80" />;

      return <Square size={11} className="text-muted-foreground/60" />;
  };

  // Filter history based on dynamic query
  const filteredHistory = history.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.action.toLowerCase().includes(query) || 
      (entry.tool && entry.tool.toLowerCase().includes(query))
    );
  });

  return (
    <div className={`flex flex-col bg-muted/20 select-none ${className}`}>
      {/* Header Toolbar */}
      <div className="px-2 py-1 flex justify-end items-center border-b border-border/40 bg-secondary/20 shrink-0">
        <div className="flex items-center gap-0.5">
            {/* Search Toggle Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => {
                    setShowSearch(!showSearch);
                    if (showSearch) setSearchQuery('');
                  }} 
                  className={`p-0.5 rounded transition-colors ${showSearch ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                  <Search size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Filter History</TooltipContent>
            </Tooltip>

            {/* Undo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => onJumpToHistory(historyIndex - 1)} 
                    disabled={historyIndex <= 0}
                    className={`p-0.5 transition-colors rounded ${historyIndex <= 0 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                    <Undo size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Undo</TooltipContent>
            </Tooltip>

            {/* Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                    onClick={() => onJumpToHistory(historyIndex + 1)} 
                    disabled={historyIndex >= history.length - 1}
                    className={`p-0.5 transition-colors rounded ${historyIndex >= history.length - 1 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                    <Redo size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Redo</TooltipContent>
            </Tooltip>
        </div>
      </div>

      {/* Embedded Simple Search Box */}
      {showSearch && (
        <div className="p-1 px-2 border-b border-border bg-accent/10 flex items-center gap-1.5">
          <Search size={10} className="text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action logs..."
            autoFocus
            className="flex-1 bg-transparent text-[10px] outline-none border-none text-foreground placeholder:text-muted-foreground h-5 py-0"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded shrink-0"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
      
      {/* Scrollable list styled identically to LayersPanel rows (without bullet indicators or checkmarks) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
        {history.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-[10px] italic">
            No history yet.
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-[10px] italic">
            No matches.
          </div>
        ) : (
          filteredHistory.map(({ entry, index }) => {
            const isActive = index === historyIndex;
            const isFuture = index > historyIndex;

            return (
              <button
                key={`history-step-${index}`}
                ref={isActive ? activeItemRef : null}
                onClick={() => onJumpToHistory(index)}
                className={`
                  flex items-center w-full h-8 gap-2.5 px-2 rounded-md relative text-left cursor-default group transition-all
                  ${isActive 
                    ? 'bg-primary/10 shadow-sm' 
                    : isFuture 
                      ? 'bg-transparent opacity-65 hover:opacity-95 hover:bg-accent/30' 
                      : 'bg-transparent hover:bg-accent/50'
                  }
                `}
                aria-current={isActive ? 'step' : undefined}
              >
                {/* Clean Micro Action Icon matching the structural slot of Layers icons */}
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  {getIcon(entry.action, entry.tool)}
                </div>

                {/* Main Label text */}
                <div className="flex-1 min-w-0">
                  <div className={`truncate text-[10px] ${isActive ? 'text-foreground font-bold' : 'text-foreground/80 group-hover:text-foreground transition-colors'}`}>
                    {entry.action}
                  </div>
                </div>

                {/* Quick 'revert' cue on hover */}
                {!isActive && (
                  <div className="text-[8.5px] font-mono text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity pr-0.5">
                    revert
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
