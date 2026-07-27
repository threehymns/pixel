import React, { useRef, useEffect } from 'react';
import { ProjectInstance } from '../types';
import { Plus, X, Home } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface TabStripProps {
    projects: ProjectInstance[];
    activeProjectId: string;
    onSelectProject: (id: string) => void;
    onCloseProject: (id: string) => void;
    onNewProject: () => void;
}

export const TabStrip: React.FC<TabStripProps> = ({
    projects,
    activeProjectId,
    onSelectProject,
    onCloseProject,
    onNewProject
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll active tab into view
    useEffect(() => {
        if (scrollRef.current && activeProjectId !== 'home') {
            const activeEl = scrollRef.current.querySelector(`[data-active="true"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        }
    }, [activeProjectId]);

    return (
        <div className="flex bg-muted/30 h-8 border-b border-border px-2 gap-1 select-none overflow-hidden shrink-0 items-end">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => onSelectProject('home')}
                        className={`
                            flex items-center justify-center w-10 h-7 rounded-t-md transition-colors
                            ${activeProjectId === 'home' 
                                ? 'bg-card text-primary shadow-[0_-1px_2px_rgba(0,0,0,0.05)]' 
                                : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                        `}
                    >
                        <Home size={14} />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Home</TooltipContent>
            </Tooltip>
            
            <div className="w-[1px] h-4 bg-border/50 my-auto mx-1"></div>
            
            <div 
                ref={scrollRef}
                className="flex-1 flex overflow-x-auto no-scrollbar gap-1 h-full items-end"
                onWheel={(e) => {
                    if (e.deltaY !== 0) {
                        e.currentTarget.scrollLeft += e.deltaY;
                        e.preventDefault();
                    }
                }}
            >
                {projects.map((p) => {
                    const isActive = p.data.id === activeProjectId;
                    const isDirty = p.historyIndex !== p.lastSavedHistoryIndex;

                    return (
                        <div
                            key={p.data.id}
                            data-active={isActive}
                            onClick={() => onSelectProject(p.data.id)}
                            className={`
                                group flex items-center min-w-[120px] max-w-[200px] h-7 px-3 gap-2 rounded-t-md cursor-pointer text-xs transition-colors
                                ${isActive 
                                    ? 'bg-card text-foreground font-semibold shadow-[0_-1px_2px_rgba(0,0,0,0.05)] border-t-2 border-t-primary' 
                                    : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'}
                            `}
                        >
                            <span className="flex-1 truncate">{p.data.title}</span>
                            
                            <div className="ml-1 w-4 h-4 flex items-center justify-center relative">
                                {isDirty && (
                                    <div className={`w-2 h-2 rounded-full group-hover:opacity-0 transition-opacity ${isActive ? 'bg-amber-400' : 'bg-amber-400/80'}`} />
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCloseProject(p.data.id);
                                    }}
                                    className={`
                                        absolute inset-0 flex items-center justify-center rounded-sm transition-all
                                        ${isDirty 
                                            ? 'opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground' 
                                            : isActive 
                                                ? 'opacity-50 hover:opacity-100 hover:bg-muted hover:text-foreground' 
                                                : 'opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground'}
                                    `}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center h-full pb-0.5">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onNewProject}
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                        >
                            <Plus size={14} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">New Project</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};