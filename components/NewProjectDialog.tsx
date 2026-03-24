
import React, { useState } from 'react';
import { ColorMode } from '../types';
import { X, Check, FilePlus, Palette, Settings } from 'lucide-react';

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
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose}>
      <form 
        className="w-[500px] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FilePlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Create New Project</h2>
              <p className="text-xs text-muted-foreground">Set up your canvas dimensions and color mode.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* Title Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Settings size={14} className="text-muted-foreground" />
              Project Name
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="Untitled Sprite"
              autoFocus
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">Width</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all pr-10"
                  min="1"
                  max="1024"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">px</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">Height</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all pr-10"
                  min="1"
                  max="1024"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">px</span>
              </div>
            </div>
          </div>

          {/* Color Mode */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Palette size={14} className="text-muted-foreground" />
              Color Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setColorMode('rgba')}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${colorMode === 'rgba' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-background border-border hover:border-muted-foreground/30'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-sm font-semibold ${colorMode === 'rgba' ? 'text-primary' : 'text-foreground'}`}>RGBA</span>
                  {colorMode === 'rgba' && <Check size={16} className="text-primary" />}
                </div>
                <span className="text-xs text-muted-foreground">Full color range with alpha channel.</span>
              </button>
              
              <button 
                type="button"
                onClick={() => setColorMode('indexed')}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${colorMode === 'indexed' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-background border-border hover:border-muted-foreground/30'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-sm font-semibold ${colorMode === 'indexed' ? 'text-primary' : 'text-foreground'}`}>Indexed</span>
                  {colorMode === 'indexed' && <Check size={16} className="text-primary" />}
                </div>
                <span className="text-xs text-muted-foreground">Optimized for limited palettes.</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]"
          >
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
};
