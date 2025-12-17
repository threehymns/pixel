import React, { useRef, useEffect } from 'react';
import { ProjectInstance } from '../types';
import { Plus, X, Home } from './Icons';

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
        <div className="flex bg-muted h-9 border-b border-background pt-1 px-1 gap-1 select-none overflow-hidden">
            <button
                onClick={() => onSelectProject('home')}
                className={`
                    flex items-center justify-center w-10 h-full rounded-t-sm border-t border-x
                    ${activeProjectId === 'home' 
                        ? 'bg-secondary border-secondary text-orange-500' 
                        : 'bg-transparent border-transparent text-muted-foreground hover:bg-background hover:text-foreground'}
                `}
                title="Home"
            >
                <Home size={16} />
            </button>
            <div className="w-[1px] h-5 bg-border my-auto mx-1"></div>
            
            <div 
                ref={scrollRef}
                className="flex-1 flex overflow-x-auto custom-scrollbar gap-0.5"
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
                                group flex items-center min-w-[120px] max-w-[200px] h-full px-3 gap-2 rounded-t-sm cursor-pointer border-t border-x text-xs
                                ${isActive 
                                    ? 'bg-secondary border-secondary text-foreground' 
                                    : 'bg-background/50 border-transparent text-muted-foreground hover:bg-background hover:text-foreground'}
                            `}
                        >
                            <span className="flex-1 truncate">{p.data.title}</span>
                            
                            <div className="ml-1 w-4 h-4 flex items-center justify-center relative">
                                {isDirty && (
                                    <div className={`w-2 h-2 rounded-full group-hover:opacity-0 transition-opacity ${isActive ? 'bg-primary' : 'bg-foreground'}`} />
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCloseProject(p.data.id);
                                    }}
                                    className={`
                                        absolute inset-0 flex items-center justify-center rounded-sm transition-all
                                        ${isDirty 
                                            ? 'opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-white' 
                                            : isActive 
                                                ? 'opacity-50 hover:opacity-100 hover:bg-white/10 hover:text-white' 
                                                : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-white'}
                                    `}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button
                onClick={onNewProject}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-sm"
                title="New Project"
            >
                <Plus size={16} />
            </button>
        </div>
    );
};