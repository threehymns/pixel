
import React, { useState } from 'react';
import { ColorMode } from '../types';
import { X, Check } from './Icons';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: { width: number, height: number, colorMode: ColorMode, title: string }) => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ isOpen, onClose, onCreate }) => {
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [colorMode, setColorMode] = useState<ColorMode>('indexed');
  const [title, setTitle] = useState('New Sprite');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ width, height, colorMode, title });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-[2px] flex justify-center items-center p-4" onClick={onClose}>
      <form 
        className="w-[400px] bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-background bg-secondary/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">New Sprite</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* Title Input */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Project Name</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Untitled Sprite"
              autoFocus
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Width</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary pr-8"
                  min="1"
                  max="1024"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground uppercase">px</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Height</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary pr-8"
                  min="1"
                  max="1024"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground uppercase">px</span>
              </div>
            </div>
          </div>

          {/* Color Mode */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Color Mode</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-background rounded-md border border-border">
              <button 
                type="button"
                onClick={() => setColorMode('rgba')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all ${colorMode === 'rgba' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary/40'}`}
              >
                {colorMode === 'rgba' && <Check size={12} />}
                RGBA
              </button>
              <button 
                type="button"
                onClick={() => setColorMode('indexed')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all ${colorMode === 'indexed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary/40'}`}
              >
                {colorMode === 'indexed' && <Check size={12} />}
                Indexed
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground italic mt-1">
              {colorMode === 'rgba' ? 'Best for high-color sprites and full transparency ranges.' : 'Optimized for limited palettes and retro-style pixel art.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-4 bg-secondary/10 border-t border-background mt-2">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="px-6 py-2 text-xs font-bold bg-primary text-primary-foreground rounded hover:opacity-90 shadow-lg transition-all active:scale-95"
          >
            Create Sprite
          </button>
        </div>
      </form>
    </div>
  );
};
