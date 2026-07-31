
import React, { useState } from 'react';
import { X, Image as ImageIcon, Trash2, Eye, EyeOff } from 'lucide-react';
import { CustomSlider } from './ui/slider';

interface ReferenceImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  referenceImage: {
    url: string;
    opacity: number;
    x: number;
    y: number;
    scale: number;
    visible: boolean;
  } | null;
  onUpdate: (config: any) => void;
}

export const ReferenceImageDialog: React.FC<ReferenceImageDialogProps> = ({
  isOpen, onClose, referenceImage, onUpdate
}) => {
  const [localConfig, setLocalConfig] = useState(referenceImage || {
    url: '',
    opacity: 50,
    x: 0,
    y: 0,
    scale: 1,
    visible: true
  });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newConfig = { ...localConfig, url, visible: true };
      setLocalConfig(newConfig);
      onUpdate(newConfig);
    }
  };

  const update = (patch: any) => {
    const newConfig = { ...localConfig, ...patch };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="w-full max-w-[400px] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ImageIcon size={18} />
            </div>
            <h2 className="text-base font-semibold tracking-tight">Reference Image</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {!localConfig.url ? (
            <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleFileChange}
              />
              <ImageIcon size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload reference</p>
              <p className="text-[10px] text-muted-foreground italic">PNG, JPG or SVG</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative aspect-video bg-muted/50 rounded-lg overflow-hidden border border-border group">
                <img src={localConfig.url} className="w-full h-full object-contain" alt="Reference" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                        onClick={() => update({ visible: !localConfig.visible })}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md"
                    >
                        {localConfig.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button 
                        onClick={() => { update({ url: '' }); onUpdate(null); }}
                        className="p-2 bg-destructive/80 hover:bg-destructive rounded-full text-white"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold uppercase text-muted-foreground">
                    <span>Opacity</span>
                    <span>{localConfig.opacity}%</span>
                  </div>
                  <CustomSlider value={localConfig.opacity} onValueChange={(v) => update({ opacity: v })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold uppercase text-muted-foreground">
                    <span>Scale</span>
                    <span>{localConfig.scale.toFixed(2)}x</span>
                  </div>
                  <CustomSlider value={localConfig.scale * 100} onValueChange={(v) => update({ scale: v / 100 })} min={10} max={400} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Offset X</label>
                        <input 
                            type="number" 
                            value={localConfig.x} 
                            onChange={(e) => update({ x: parseInt(e.target.value) || 0 })}
                            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Offset Y</label>
                        <input 
                            type="number" 
                            value={localConfig.y} 
                            onChange={(e) => update({ y: parseInt(e.target.value) || 0 })}
                            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs"
                        />
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-muted/30 border-t border-border">
          <button onClick={onClose} className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
