import React from 'react';
import { Plus, FolderOpen, ImageIcon, Trash2, Upload } from './Icons';
import { RecentProject } from '../types';
import { Button } from './ui/button';
import { FileInput, FileInputDropzone } from './ui/file-input';
import { ScrollArea } from './ui/scroll-area';
import { studioConfirm } from './ui/alert-dialog';

interface HomeProps {
  onCreateProject: () => void;
  onImportProject: () => void;
  onImportFile?: (file: File) => void;
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
  onImportFile,
  onQuickCreate,
  recentProjects = [],
  onOpenRecent,
  onClearRecent,
}) => {
  const handleClearRecent = async () => {
    if (!onClearRecent) return;
    const confirmed = await studioConfirm({
      title: 'Clear recent files?',
      description: 'This removes your saved recent project shortcuts from this browser.',
      confirmLabel: 'Clear Recent',
      destructive: true,
    });
    if (confirmed) onClearRecent();
  };

  return (
    <div className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-canvas p-4 text-foreground select-none md:p-8">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border-strong bg-card shadow-2xl md:h-[540px] md:flex-row">
        <div className="flex w-full shrink-0 flex-col justify-between border-b border-border bg-muted/25 p-6 md:w-72 md:border-b-0 md:border-r">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
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
              <Button
                variant="primary"
                size="lg"
                onClick={onCreateProject}
                className="w-full justify-start"
              >
                <Plus size={15} />
                <span>New Canvas...</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={onImportProject}
                className="w-full justify-start"
              >
                <FolderOpen size={15} className="text-muted-foreground" />
                <span>Open File...</span>
              </Button>
            </div>

            {onQuickCreate && (
              <div className="mt-6">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Quick start
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {QUICK_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      onClick={() => onQuickCreate(preset.w, preset.h)}
                      className="h-auto flex-col gap-0.5 px-2 py-2.5"
                    >
                      <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                        {preset.label}
                      </span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {preset.hint}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden pt-4 text-[11px] text-muted-foreground md:block">
            Supports <span className="font-mono text-foreground/80">.aseprite</span>,{' '}
            <span className="font-mono text-foreground/80">.png</span>,{' '}
            <span className="font-mono text-foreground/80">.json</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-foreground">Recent Files</h2>
            {recentProjects.length > 0 && onClearRecent && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleClearRecent}
                className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </Button>
            )}
          </div>

          {recentProjects.length === 0 ? (
            <FileInput
              accept=".ase,.aseprite,.json,.pxl,image/png,image/gif,image/webp,image/jpeg"
              onValueChange={(files) => {
                if (files[0]) {
                  if (onImportFile) onImportFile(files[0]);
                  else onImportProject();
                }
              }}
              className="flex flex-1 flex-col"
            >
              <FileInputDropzone className="flex-1">
                <Upload size={24} className="text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No recent projects</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Drop an Aseprite, JSON, or image file here, or click to browse.
                </p>
              </FileInputDropzone>
            </FileInput>
          ) : (
            <ScrollArea className="min-h-0 flex-1 pr-1">
              <div className="space-y-1.5">
                {recentProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenRecent?.(p)}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
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
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};
