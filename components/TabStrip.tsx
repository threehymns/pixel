import React, { useRef, useEffect } from 'react';
import { ProjectTabItem } from '../hooks/useProject';
import { Plus, X, Home } from './Icons';
import { Tabs, TabsList, TabsTab } from './ui/tabs';
import { IconButton } from './ui/button';
import { Separator } from './ui/separator';
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
      const activeEl = scrollRef.current.querySelector('[data-selected]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeProjectId]);

  return (
    <Tabs
      value={activeProjectId}
      onValueChange={(next) => {
        if (next) onSelectProject(next);
      }}
      className="flex h-8 shrink-0 items-end gap-1 overflow-hidden border-b border-border bg-background px-2 select-none"
    >
      <TabsList
        aria-label="Open projects"
        className="flex h-full min-w-0 flex-1 items-end gap-1 border-b-0"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <TabsTab
                value="home"
                aria-label="Home"
                className={cn(
                  'flex h-7 w-9 shrink-0 items-center justify-center rounded-t-md border-x border-t p-0 transition-colors',
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

        <Separator orientation="vertical" className="my-auto mx-0.5 h-4" />

        <div
          ref={scrollRef}
          className="flex h-full min-w-0 flex-1 items-end gap-1 overflow-x-auto no-scrollbar"
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
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseProject(tab.id);
                  }
                }}
                className={cn(
                  'group relative flex h-7 min-w-[120px] max-w-[200px] items-center rounded-t-md border-x border-t transition-colors',
                  isActive
                    ? 'border-border border-t-primary bg-card text-foreground'
                    : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <TabsTab
                  value={tab.id}
                  className={cn(
                    'flex h-full min-w-0 flex-1 items-center justify-start gap-2 rounded-t-md py-0 pl-2.5 pr-7 text-xs',
                    isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                  )}
                >
                  <span className="truncate">{tab.title}</span>
                </TabsTab>

                <div className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
                  {isDirty && (
                    <span
                      aria-label="Unsaved changes"
                      className={cn(
                        'pointer-events-none h-1.5 w-1.5 rounded-full transition-opacity group-hover:opacity-0',
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
                      'absolute inset-0 flex items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer',
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
      </TabsList>

      <div className="flex h-full items-center pb-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                size="xs"
                variant="ghost"
                aria-label="New Project"
                onClick={onNewProject}
              />
            }
          >
            <Plus size={14} />
          </TooltipTrigger>
          <TooltipContent side="bottom">New Project</TooltipContent>
        </Tooltip>
      </div>
    </Tabs>
  );
};