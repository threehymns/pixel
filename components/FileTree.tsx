import React, { useState, useEffect, useCallback } from 'react';
import { FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemHandle } from '../types';
import { Folder, FolderOpen, File, Image, ChevronRight, ChevronDown, RefreshCcw } from './Icons';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tree, TreeGroup, TreeItem, TreeItemLabel } from './ui/tree';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';
import { cn } from '../lib/utils';

interface FileTreeProps {
  rootHandle: FileSystemDirectoryHandle | null;
  onFileOpen: (file: File, handle?: FileSystemFileHandle) => void;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onOpenFolder: () => void;
}

interface TreeNodeProps {
  handle: FileSystemHandle;
  path: string;
  depth: number;
  expandedIds: string[];
  onToggleExpand: (path: string) => void;
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

const TreeNode: React.FC<TreeNodeProps> = ({
  handle,
  path,
  depth,
  expandedIds,
  onToggleExpand,
  onFileOpen,
}) => {
  const isDirectory = handle.kind === 'directory';
  const isExpanded = expandedIds.includes(path);
  const [children, setChildren] = useState<FileSystemHandle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!isDirectory) return;
    setIsLoading(true);
    try {
      const entries = await readDirectoryEntries(handle as FileSystemDirectoryHandle);
      setChildren(entries);
    } catch (e) {
      console.error('Failed to read directory', e);
    }
    setIsLoading(false);
  }, [handle, isDirectory]);

  useEffect(() => {
    if (isExpanded && isDirectory && children.length === 0) {
      loadChildren();
    }
  }, [isExpanded, isDirectory, children.length, loadChildren]);

  const handleActivate = async () => {
    if (isDirectory) {
      onToggleExpand(path);
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
  if (isDirectory) {
    Icon = isExpanded ? FolderOpen : Folder;
  } else if (handle.name.match(/\.(png|jpg|jpeg|gif)$/i)) {
    Icon = Image;
  }

  const labelRow = (
    <TreeItemLabel
      onClick={handleActivate}
      className={cn(
        'flex w-full cursor-pointer items-center gap-1.5 rounded-sm py-1 px-2 text-left text-xs select-none transition-colors hover:bg-accent',
        depth === 0 ? 'font-medium text-foreground' : 'text-foreground/85'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      {isDirectory ? (
        <span className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      <Icon
        size={13}
        className={isDirectory ? 'shrink-0 text-primary' : 'shrink-0 text-muted-foreground'}
      />
      <span className="truncate">{handle.name}</span>
    </TreeItemLabel>
  );

  return (
    <TreeItem value={path} className="rounded-sm">
      {isDirectory ? (
        <ContextMenu>
          <ContextMenuTrigger render={labelRow} />
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => loadChildren()}>Refresh Folder</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        labelRow
      )}

      {isDirectory && isExpanded && (
        <TreeGroup>
          {isLoading ? (
            <li className="py-1 pl-6 text-[11px] text-muted-foreground">Loading...</li>
          ) : (
            children.map((child) => {
              const childPath = `${path}/${child.name}`;
              return (
                <TreeNode
                  key={childPath}
                  handle={child}
                  path={childPath}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  onFileOpen={onFileOpen}
                />
              );
            })
          )}
        </TreeGroup>
      )}
    </TreeItem>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ rootHandle, onFileOpen, onOpenFolder }) => {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    if (rootHandle) {
      setExpandedIds([rootHandle.name]);
    } else {
      setExpandedIds([]);
    }
  }, [rootHandle]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedIds((prev) =>
      prev.includes(path) ? prev.filter((id) => id !== path) : [...prev, path]
    );
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col bg-card select-none">
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/50 px-2.5">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {rootHandle ? rootHandle.name : 'Workspace'}
        </span>
        <Button type="button" variant="secondary" size="xs" onClick={onOpenFolder}>
          {rootHandle ? <RefreshCcw size={11} /> : <FolderOpen size={11} />}
          <span>{rootHandle ? 'Change' : 'Open Folder'}</span>
        </Button>
      </div>

      <ContextMenu>
        <ContextMenuTrigger
          render={
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-1 outline-none" tabIndex={0}>
                {rootHandle ? (
                  <Tree
                    aria-label="Workspace files"
                    expandedValues={expandedIds}
                    onExpandedValuesChange={setExpandedIds}
                  >
                    <TreeNode
                      handle={rootHandle}
                      path={rootHandle.name}
                      depth={0}
                      expandedIds={expandedIds}
                      onToggleExpand={handleToggleExpand}
                      onFileOpen={onFileOpen}
                    />
                  </Tree>
                ) : (
                  <div className="flex h-full min-h-[160px] flex-col items-center justify-center p-4 text-center">
                    <Folder size={22} className="mb-2 text-muted-foreground/50" />
                    <p className="mb-3 text-xs text-muted-foreground">
                      No workspace folder opened.
                    </p>
                    <Button type="button" variant="secondary" size="sm" onClick={onOpenFolder}>
                      Open Folder...
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onSelect={onOpenFolder}>Open Folder...</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};