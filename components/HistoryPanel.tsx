import React, { useRef, useEffect, useState } from 'react';
import {
  Pencil,
  Eraser,
  PaintBucket,
  MousePointer2,
  Layers,
  Plus,
  Trash2,
  Copy,
  FilePlus,
  Square,
  File,
  ArrowRightLeft,
  BoxSelect,
  Lasso,
  Wand2,
  Scissors,
  Circle,
  Edit2,
  Hand,
  Undo,
  Redo,
  Search,
  X,
} from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Input } from './ui/input';
import { HistoryEntry, ToolType } from '../types';

interface HistoryPanelProps {
  history: HistoryEntry[];
  historyIndex: number;
  onJumpToHistory: (index: number) => void;
  className?: string;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = React.memo(({
  history,
  historyIndex,
  onJumpToHistory,
  className,
}) => {
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [historyIndex]);

  const getIcon = (action: string, tool?: ToolType, isActive?: boolean) => {
    const cls = isActive
      ? 'text-primary'
      : 'text-muted-foreground group-hover:text-foreground transition-colors';

    if (tool) {
      switch (tool) {
        case 'pencil':
          return <Pencil size={12} className={cls} />;
        case 'eraser':
          return <Eraser size={12} className={cls} />;
        case 'bucket':
          return <PaintBucket size={12} className={cls} />;
        case 'move':
          return <MousePointer2 size={12} className={cls} />;
        case 'smudge':
          return <Hand size={12} className={cls} />;
        case 'rect-select':
          return <BoxSelect size={12} className={cls} />;
        case 'ellipse-select':
          return <Circle size={12} className={cls} />;
        case 'lasso-select':
          return <Lasso size={12} className={cls} />;
        case 'poly-lasso-select':
          return <Scissors size={12} className={cls} />;
        case 'magic-wand':
          return <Wand2 size={12} className={cls} />;
        default:
          break;
      }
    }

    const lower = action.toLowerCase();
    if (lower.includes('layer')) return <Layers size={12} className={cls} />;
    if (lower.includes('rename')) return <Edit2 size={12} className={cls} />;
    if (lower.includes('frame')) return <Plus size={12} className={cls} />;
    if (lower.includes('delete')) return <Trash2 size={12} className={cls} />;
    if (lower.includes('duplicate')) return <Copy size={12} className={cls} />;
    if (lower.includes('project')) return <File size={12} className={cls} />;
    if (lower.includes('reorder')) return <ArrowRightLeft size={12} className={cls} />;
    if (lower.includes('import')) return <FilePlus size={12} className={cls} />;
    if (lower.includes('selection')) return <BoxSelect size={12} className={cls} />;

    return <Square size={12} className={cls} />;
  };

  const filteredHistory = history
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        entry.action.toLowerCase().includes(query) ||
        (entry.tool && entry.tool.toLowerCase().includes(query))
      );
    });

  return (
    <div className={`flex flex-col bg-card select-none ${className ?? ''}`}>
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-background/50 px-2.5">
        <span className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
          {history.length > 0 ? `Step ${historyIndex + 1}/${history.length}` : '0 steps'}
        </span>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Filter History"
                  onClick={() => {
                    setShowSearch(!showSearch);
                    if (showSearch) setSearchQuery('');
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
                    showSearch
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Search size={12} />
                </button>
              }
            />
            <TooltipContent side="top">Filter History</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Undo"
                  onClick={() => historyIndex > 0 && onJumpToHistory(historyIndex - 1)}
                  disabled={historyIndex <= 0}
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Undo size={12} />
                </button>
              }
            />
            <TooltipContent side="top">Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Redo"
                  onClick={() => historyIndex < history.length - 1 && onJumpToHistory(historyIndex + 1)}
                  disabled={historyIndex >= history.length - 1}
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Redo size={12} />
                </button>
              }
            />
            <TooltipContent side="top">Redo</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {showSearch && (
        <div className="flex items-center gap-1.5 border-b border-border bg-background/40 px-2 py-1.5">
          <Search size={12} className="shrink-0 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter history..."
            autoFocus
            className="h-6 flex-1 px-2 text-[11px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear filter"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {history.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-muted-foreground">No history yet.</div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-muted-foreground">No matching actions.</div>
        ) : (
          filteredHistory.map(({ entry, index }) => {
            const isActive = index === historyIndex;
            const isFuture = index > historyIndex;

            return (
              <button
                key={`history-step-${index}`}
                ref={isActive ? activeItemRef : null}
                type="button"
                onClick={() => onJumpToHistory(index)}
                className={`group relative flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors ${
                  isActive
                    ? 'border border-primary/40 bg-primary/15 text-foreground'
                    : isFuture
                      ? 'border border-transparent text-muted-foreground opacity-55 hover:bg-accent/50 hover:opacity-90'
                      : 'border border-transparent text-foreground/85 hover:bg-accent/60'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {getIcon(entry.action, entry.tool, isActive)}
                </div>

                <span
                  className={`min-w-0 flex-1 truncate text-[11px] ${
                    isActive ? 'font-semibold text-foreground' : 'font-normal'
                  }`}
                >
                  {entry.action}
                </span>

                <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                  #{index + 1}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});
