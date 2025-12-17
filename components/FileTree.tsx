
import React, { useState, useEffect } from 'react';
import { FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemHandle } from '../types';
import { Folder, FolderOpen, File, Image, ChevronRight, ChevronDown, GripVertical } from './Icons';

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

const TreeNode: React.FC<TreeNodeProps> = ({ handle, depth, onFileOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileSystemHandle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && handle.kind === 'directory' && children.length === 0) {
      loadChildren();
    }
  }, [isExpanded, handle]);

  const loadChildren = async () => {
    if (handle.kind !== 'directory') return;
    setIsLoading(true);
    const dirHandle = handle as FileSystemDirectoryHandle;
    const entries: FileSystemHandle[] = [];
    try {
      for await (const entry of dirHandle.values()) {
        entries.push(entry);
      }
      // Sort: Directories first, then files
      entries.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === 'directory' ? -1 : 1;
      });
      setChildren(entries);
    } catch (e) {
      console.error("Failed to read directory", e);
    }
    setIsLoading(false);
  };

  const handleClick = async () => {
    if (handle.kind === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      const fileHandle = handle as FileSystemFileHandle;
      if (fileHandle.name.match(/\.(json|png|jpg|jpeg|gif|ase|gpl)$/i)) {
          try {
             const file = await fileHandle.getFile();
             onFileOpen(file, fileHandle);
          } catch(e) {
             console.error("Failed to open file", e);
          }
      }
    }
  };

  // Icons based on type and name
  let Icon = File;
  if (handle.kind === 'directory') {
      Icon = isExpanded ? FolderOpen : Folder;
  } else if (handle.name.match(/\.(png|jpg|jpeg|gif)$/i)) {
      Icon = Image;
  }

  return (
    <div>
      <div 
        className={`flex items-center gap-1 py-1 px-2 hover:bg-accent cursor-pointer text-xs select-none ${depth === 0 ? 'font-medium' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {handle.kind === 'directory' && (
          <span className="text-muted-foreground">
             {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        )}
        {handle.kind === 'file' && <span className="w-2.5" />} {/* Spacer for no chevron */}
        
        <Icon size={14} className={handle.kind === 'directory' ? 'text-blue-400' : 'text-gray-400'} />
        <span className="truncate">{handle.name}</span>
      </div>
      
      {isExpanded && (
        <div>
          {isLoading ? (
             <div className="pl-6 py-1 text-[10px] text-muted-foreground">Loading...</div>
          ) : (
             children.map(child => (
               <TreeNode key={child.name} handle={child} depth={depth + 1} onFileOpen={onFileOpen} />
             ))
          )}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ rootHandle, onFileOpen, width, onResizeStart, onOpenFolder }) => {
  return (
    <div 
        className="flex flex-col bg-card border-r border-background h-full relative"
        style={{ width: width, minWidth: 150, maxWidth: 400 }}
    >
        <div className="h-8 bg-secondary border-b border-background flex items-center justify-between px-2">
            <span className="text-xs font-bold text-gray-300">Files</span>
            {!rootHandle && (
                <button 
                  onClick={onOpenFolder}
                  className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded hover:bg-primary/90"
                >
                  Open Folder
                </button>
            )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {rootHandle ? (
                <TreeNode handle={rootHandle} depth={0} onFileOpen={onFileOpen} />
            ) : (
                <div className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-2">No folder opened.</p>
                    <button 
                        onClick={onOpenFolder}
                        className="text-xs border border-border bg-background hover:bg-accent px-3 py-1 rounded transition-colors"
                    >
                        Browse System...
                    </button>
                </div>
            )}
        </div>

        {/* Resize Handle */}
        <div 
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary group z-50"
            onMouseDown={onResizeStart}
        >
            <div className="absolute top-1/2 -translate-y-1/2 -right-1 opacity-0 group-hover:opacity-100 text-muted-foreground">
            <GripVertical size={12} />
            </div>
        </div>
    </div>
  );
};
