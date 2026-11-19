import React from 'react';
import { Plus, FolderOpen, ImageIcon, Trash2 } from './Icons';
import { RecentProject } from '../types';

interface HomeProps {
  onCreateProject: () => void;
  onImportProject: () => void;
  onQuickCreate?: (width: number, height: number) => void;
  recentProjects?: RecentProject[];
  onOpenRecent?: (recent: RecentProject) => void;
  onClearRecent?: () => void;
}

const QUICK_PRESETS = [
  { label: '16×16', hint: 'Icon', w: 16, h: 16 },
  { label: '32×32', hint: 'Sprite', w: 32, h: 32 },
  { label: '64×64', hint: 'Tile', w: 64, h: 64 },
];

export const Home: React.FC<HomeProps> = ({
  onCreateProject,
  onImportProject,
  onQuickCreate,
  recentProjects = [],
  onOpenRecent,
  onClearRecent,
}) => {
  return (
    <div className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-canvas p-4 text-foreground select-none md:p-8">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border-strong bg-card shadow-2xl md:h-[540px] md:flex-row">
        {/* Left Column: Actions & Quick Start */}
        <div className="flex w-full shrink-0 flex-col justify-between border-b border-border bg-muted/25 p-6 md:w-72 md:border-b-0 md:border-r">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M4 4h4v4H4zm4 4h4v4H8zm4 4h4v4h-4zm4 4h4v4h-4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  PixelForge Studio
                </h1>
                <p className="text-xs text-muted-foreground">Pixel art & sprite animation</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onCreateProject}
                className="flex h-9 items-center gap-2.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus size={15} />
                <span>New Canvas...</span>
              </button>
              <button
                type="button"
                onClick={onImportProject}
                className="flex h-9 items-center gap-2.5 rounded-md border border-border bg-background/60 px-3.5 text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FolderOpen size={15} className="text-muted-foreground" />
                <span>Open File...</span>
              </button>
            </div>

            {onQuickCreate && (
              <div className="mt-6">
                <div className="mb-2 text-[11px] font-medium text-muted-foreground">
                  Quick start
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onQuickCreate(preset.w, preset.h)}
                      className="flex flex-col items-center rounded-md border border-border bg-background/50 px-2 py-2 text-center transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                        {preset.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{preset.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden pt-4 text-[11px] text-muted-foreground md:block">
            Supports <span className="font-mono text-foreground/80">.aseprite</span>,{' '}
            <span className="font-mono text-foreground/80">.png</span>,{' '}
            <span className="font-mono text-foreground/80">.gif</span>
          </div>
        </div>

        {/* Right Column: Recent Files */}
        <div className="flex min-h-0 flex-1 flex-col bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-foreground">Recent Files</h2>
            {recentProjects.length > 0 && onClearRecent && (
              <button
                type="button"
                onClick={onClearRecent}
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {recentProjects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/40 p-6 text-center">
              <ImageIcon size={28} className="mb-2.5 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No recent projects</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Create a new canvas or open an existing Aseprite or image file to begin.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {recentProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenRecent?.(p)}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                      <ImageIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-foreground">
                        {p.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                        <span>
                          {p.width}×{p.height}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(p.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    Open
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
