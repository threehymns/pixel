import React, { useRef, useEffect } from 'react';
import { ProjectTabItem } from '../hooks/useProject';
import { Plus, X, Home } from './Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { cn } from '../lib/utils';

interface TabStripProps {
  tabs: ProjectTabItem[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCloseProject: (id: string) => void;
  onNewProject: () => void;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeProjectId,
  onSelectProject,
  onCloseProject,
  onNewProject,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && activeProjectId !== 'home') {
      const activeEl = scrollRef.current.querySelector(`[data-active="true"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeProjectId]);

  return (
    <div className="flex h-8 shrink-0 items-end gap-1 overflow-hidden border-b border-border bg-background px-2 select-none">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Home"
              onClick={() => onSelectProject('home')}
              className={cn(
                'flex h-7 w-9 items-center justify-center rounded-t-md border-x border-t transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeProjectId === 'home'
                  ? 'border-border bg-card text-primary'
                  : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            />
          }
        >
          <Home size={14} />
        </TooltipTrigger>
        <TooltipContent side="bottom">Home</TooltipContent>
      </Tooltip>

      <div className="my-auto mx-0.5 h-4 w-px bg-border" />

      <div
        ref={scrollRef}
        className="flex h-full flex-1 items-end gap-1 overflow-x-auto no-scrollbar"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeProjectId;
          const isDirty = tab.isDirty;

          return (
            <div
              key={tab.id}
              data-active={isActive}
              onClick={() => onSelectProject(tab.id)}
              className={cn(
                'group flex h-7 min-w-[120px] max-w-[200px] cursor-pointer items-center gap-2 rounded-t-md border-x border-t px-2.5 text-xs transition-colors',
                isActive
                  ? 'border-border border-t-primary bg-card font-semibold text-foreground'
                  : 'border-transparent bg-transparent font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className="flex-1 truncate">{tab.title}</span>

              <div className="relative ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {isDirty && (
                  <span
                    aria-label="Unsaved changes"
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-opacity group-hover:opacity-0',
                      isActive ? 'bg-primary' : 'bg-primary/75'
                    )}
                  />
                )}
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseProject(tab.id);
                  }}
                  className={cn(
                    'absolute inset-0 flex items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    isDirty
                      ? 'opacity-0 group-hover:opacity-100'
                      : isActive
                        ? 'opacity-65 hover:opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex h-full items-center pb-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="New Project"
                onClick={onNewProject}
                className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <Plus size={14} />
          </TooltipTrigger>
          <TooltipContent side="bottom">New Project</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};