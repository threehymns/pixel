import React, { useState, useEffect } from 'react';
import { FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemHandle } from '../types';
import { Folder, FolderOpen, File, Image, ChevronRight, ChevronDown, RefreshCcw } from './Icons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';

interface FileTreeProps {
  rootHandle: FileSystemDirectoryHandle | null;
  onFileOpen: (file: File, handle?: FileSystemFileHandle) => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onOpenFolder: () => void;
}

interface TreeNodeProps {
  handle: FileSystemHandle;
  depth: number;
  onFileOpen: (file: File, handle?: FileSystemFileHandle) => void;
}

async function readDirectoryEntries(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> {
  const entries: FileSystemHandle[] = [];
  for await (const entry of dirHandle.values()) {
    entries.push(entry);
  }
  entries.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });
  return entries;
}

const TreeNode: React.FC<TreeNodeProps> = ({ handle, depth, onFileOpen }) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [children, setChildren] = useState<FileSystemHandle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadChildren = async () => {
    if (handle.kind !== 'directory') return;
    setIsLoading(true);
    try {
      const entries = await readDirectoryEntries(handle as FileSystemDirectoryHandle);
      setChildren(entries);
    } catch (e) {
      console.error('Failed to read directory', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isExpanded && handle.kind === 'directory' && children.length === 0) {
      loadChildren();
    }
  }, [isExpanded, handle]);

  const handleClick = async () => {
    if (handle.kind === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      const fileHandle = handle as FileSystemFileHandle;
      if (fileHandle.name.match(/\.(aseprite|ase|json|pxa|png|jpg|jpeg|gif|gpl)$/i)) {
        try {
          const file = await fileHandle.getFile();
          onFileOpen(file, fileHandle);
        } catch (e) {
          console.error('Failed to open file', e);
        }
      }
    }
  };

  let Icon = File;
  if (handle.kind === 'directory') {
    Icon = isExpanded ? FolderOpen : Folder;
  } else if (handle.name.match(/\.(png|jpg|jpeg|gif)$/i)) {
    Icon = Image;
  }

  const rowButton = (
    <button
      type="button"
      className={`flex w-full items-center gap-1.5 rounded-sm py-1 px-2 text-left text-xs select-none transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        depth === 0 ? 'font-medium text-foreground' : 'text-foreground/85'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={handleClick}
    >
      {handle.kind === 'directory' ? (
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      <Icon
        size={13}
        className={handle.kind === 'directory' ? 'shrink-0 text-primary' : 'shrink-0 text-muted-foreground'}
      />
      <span className="truncate">{handle.name}</span>
    </button>
  );

  return (
    <div>
      {handle.kind === 'directory' ? (
        <ContextMenu>
          <ContextMenuTrigger render={rowButton} />
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => loadChildren()}>Refresh Folder</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        rowButton
      )}

      {isExpanded && (
        <div>
          {isLoading ? (
            <div className="py-1 pl-6 text-[11px] text-muted-foreground">Loading...</div>
          ) : (
            children.map((child) => (
              <TreeNode key={child.name} handle={child} depth={depth + 1} onFileOpen={onFileOpen} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ rootHandle, onFileOpen, onOpenFolder }) => {
  return (
    <div className="relative flex h-full w-full flex-col bg-card select-none">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-background/50 px-2.5">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {rootHandle ? rootHandle.name : 'Workspace'}
        </span>
        <button
          type="button"
          onClick={onOpenFolder}
          className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-secondary/70 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          {rootHandle ? <RefreshCcw size={11} /> : <FolderOpen size={11} />}
          <span>{rootHandle ? 'Change' : 'Open Folder'}</span>
        </button>
      </div>

      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div className="flex-1 overflow-y-auto p-1 outline-none" tabIndex={0}>
              {rootHandle ? (
                <TreeNode handle={rootHandle} depth={0} onFileOpen={onFileOpen} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                  <Folder size={22} className="mb-2 text-muted-foreground/50" />
                  <p className="mb-3 text-xs text-muted-foreground">No workspace folder opened.</p>
                  <button
                    type="button"
                    onClick={onOpenFolder}
                    className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Open Folder...
                  </button>
                </div>
              )}
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onSelect={onOpenFolder}>Open Folder...</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};