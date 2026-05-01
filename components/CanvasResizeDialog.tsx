
import React, { useState } from 'react';
import { X, Check, Maximize, Move } from 'lucide-react';

interface CanvasResizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentWidth: number;
  currentHeight: number;
  onResize: (width: number, height: number, anchor: string) => void;
}

export const CanvasResizeDialog: React.FC<CanvasResizeDialogProps> = ({ 
  isOpen, onClose, currentWidth, currentHeight, onResize 
}) => {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [anchor, setAnchor] = useState('cc');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onResize(width, height, anchor);
    onClose();
  };

  const anchors = [
    { id: 'tl', label: 'Top Left' }, { id: 'tc', label: 'Top Center' }, { id: 'tr', label: 'Top Right' },
    { id: 'cl', label: 'Center Left' }, { id: 'cc', label: 'Center' }, { id: 'cr', label: 'Center Right' },
    { id: 'bl', label: 'Bottom Left' }, { id: 'bc', label: 'Bottom Center' }, { id: 'br', label: 'Bottom Right' }
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose}>
      <form 
        className="w-[440px] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Maximize size={18} />
            </div>
            <h2 className="text-base font-semibold tracking-tight">Canvas Size</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold">Width</label>
              <input 
                type="number" 
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                min="1" max="2048"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold">Height</label>
              <input 
                type="number" 
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                min="1" max="2048"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold flex items-center gap-2">
              <Move size={14} className="text-muted-foreground" />
              Anchor
            </label>
            <div className="grid grid-cols-3 gap-1 w-36 mx-auto bg-muted/50 p-1 rounded-lg border border-border">
              {anchors.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAnchor(a.id)}
                  className={`w-full aspect-square rounded transition-all flex items-center justify-center ${anchor === a.id ? 'bg-primary shadow-sm' : 'hover:bg-muted-foreground/10'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${anchor === a.id ? 'bg-primary-foreground' : 'bg-muted-foreground/40'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-muted/30 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-lg">Cancel</button>
          <button type="submit" className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]">
            Resize
          </button>
        </div>
      </form>
    </div>
  );
};
