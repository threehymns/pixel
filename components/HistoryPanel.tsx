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
} from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Input, InputGroup, InputClear } from './ui/input';
import { IconButton } from './ui/button';
import { Toggle } from './ui/toggle';
import { Toolbar } from './ui/toolbar';
import { ScrollArea } from './ui/scroll-area';
import { HistoryEntry, ToolType } from '../types';
import { cn } from '../lib/utils';

interface HistoryPanelProps {
  history: HistoryEntry[];
  historyIndex: number;
  onJumpToHistory: (index: number) => void;
  density?: 'compact' | 'touch';
  className?: string;
}

const getHistoryIcon = (action: string, tool?: ToolType, isActive?: boolean) => {
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

interface HistoryRowProps {
  action: string;
  tool?: ToolType;
  index: number;
  isActive: boolean;
  isFuture: boolean;
  isTouch: boolean;
  activeItemRef: React.RefObject<HTMLButtonElement | null> | null;
  onJumpToHistory: (index: number) => void;
}

const HistoryRow: React.FC<HistoryRowProps> = ({
  action,
  tool,
  index,
  isActive,
  isFuture,
  isTouch,
  activeItemRef,
  onJumpToHistory,
}) => {
  return (
    <button
      ref={activeItemRef}
      type="button"
      onClick={() => onJumpToHistory(index)}
      className={cn(
        'group relative flex w-full items-center gap-2 rounded-md px-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isTouch ? 'min-h-11 px-3' : 'h-7',
        isActive
          ? 'border border-primary/40 bg-primary/15 text-foreground'
          : isFuture
            ? 'border border-transparent text-muted-foreground opacity-55 hover:bg-accent/50 hover:opacity-90'
            : 'border border-transparent text-foreground/85 hover:bg-accent/60'
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {getHistoryIcon(action, tool, isActive)}
      </div>

      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          isTouch ? 'text-xs' : 'text-[11px]',
          isActive ? 'font-semibold text-foreground' : 'font-normal'
        )}
      >
        {action}
      </span>

      <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
        #{index + 1}
      </span>
    </button>
  );
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  historyIndex,
  onJumpToHistory,
  density = 'compact',
  className,
}) => {
  const isTouch = density === 'touch';
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [historyIndex]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredHistory = history
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (!trimmedQuery) return true;
      return (
        entry.action.toLowerCase().includes(trimmedQuery) ||
        (entry.tool && entry.tool.toLowerCase().includes(trimmedQuery))
      );
    });

  return (
    <div className={cn('flex flex-col bg-card select-none', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-border bg-background/50 px-2.5',
          isTouch ? 'h-12' : 'h-8'
        )}
      >
        <span className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
          {history.length > 0 ? `Step ${historyIndex + 1}/${history.length}` : '0 steps'}
        </span>

        <Toolbar aria-label="History controls" className="gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  pressed={showSearch}
                  onPressedChange={(next) => {
                    if (!next) setSearchQuery('');
                    setShowSearch(next);
                  }}
                  variant="tint"
                  size={isTouch ? 'touch' : 'icon-sm'}
                  aria-label="Filter History"
                  className={cn(!isTouch && 'h-6 w-6')}
                />
              }
            >
              <Search size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Filter History</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  type="button"
                  variant="ghost"
                  size={isTouch ? 'touch' : 'xs'}
                  aria-label="Undo"
                  onClick={() => historyIndex > 0 && onJumpToHistory(historyIndex - 1)}
                  disabled={historyIndex <= 0}
                />
              }
            >
              <Undo size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  type="button"
                  variant="ghost"
                  size={isTouch ? 'touch' : 'xs'}
                  aria-label="Redo"
                  onClick={() => historyIndex < history.length - 1 && onJumpToHistory(historyIndex + 1)}
                  disabled={historyIndex >= history.length - 1}
                />
              }
            >
              <Redo size={isTouch ? 15 : 12} />
            </TooltipTrigger>
            <TooltipContent side="top">Redo</TooltipContent>
          </Tooltip>
        </Toolbar>
      </div>

      {showSearch && (
        <div className="border-b border-border bg-background/40 px-2 py-1.5">
          <InputGroup className={cn(isTouch ? 'h-9' : 'h-7')}>
            <Search size={12} className="shrink-0 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter history..."
              autoFocus
              className="h-full border-0 bg-transparent px-0 text-[11px] focus-visible:ring-0"
            />
            {searchQuery && <InputClear onClick={() => setSearchQuery('')} />}
          </InputGroup>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-1.5">
          {history.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-muted-foreground">No history yet.</div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-muted-foreground">
              No matching actions.
            </div>
          ) : (
            filteredHistory.map(({ entry, index }) => {
              const isActive = index === historyIndex;
              const isFuture = index > historyIndex;

              return (
                <HistoryRow
                  key={`history-step-${index}`}
                  action={entry.action}
                  tool={entry.tool}
                  index={index}
                  isActive={isActive}
                  isFuture={isFuture}
                  isTouch={isTouch}
                  activeItemRef={isActive ? activeItemRef : null}
                  onJumpToHistory={onJumpToHistory}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
