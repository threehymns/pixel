import React, { useRef, useState } from 'react';
import { Plus, Upload, ChevronDown, Check, Palette as PaletteIcon, ArrowRightLeft } from './Icons';
import { SavedPalette } from '../types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './Popover';

interface PaletteProps {
  width: number;
  colors: string[];
  palettes: SavedPalette[];
  activePaletteId: string;
  primaryColor: string;
  secondaryColor: string;
  onColorSelect: (color: string, isPrimary: boolean) => void;
  onAddColor: (color: string) => void;
  onSelectPalette: (id: string) => void;
  onImportPalette: (file: File) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

export const Palette: React.FC<PaletteProps> = ({
  colors,
  palettes,
  activePaletteId,
  primaryColor,
  secondaryColor,
  onColorSelect,
  onAddColor,
  onSelectPalette,
  onImportPalette,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');

  const activePalette = palettes.find(p => p.id === activePaletteId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportPalette(e.target.files[0]);
    }
    if (e.target.value) e.target.value = '';
  };

  const handleColorPick = (color: string) => {
    onColorSelect(color, target === 'primary');
  };
  
  const swapColors = () => {
      const p = primaryColor;
      const s = secondaryColor;
      onColorSelect(s, true);
      onColorSelect(p, false);
  };

  const currentColor = target === 'primary' ? primaryColor : secondaryColor;

  return (
    <div className="flex flex-col h-full w-full bg-card border-r border-background select-none overflow-hidden font-sans">
      {/* 1. Header: Palette Selector */}
      <div className="p-1 border-b border-background bg-secondary/30 flex items-center gap-0.5 shrink-0">
        <Popover>
            <PopoverTrigger asChild>
                <button 
                    className="flex-1 min-w-0 bg-background/40 text-[9px] font-bold text-muted-foreground hover:text-foreground border border-border rounded-sm px-1.5 py-0.5 flex items-center justify-between hover:bg-secondary/40 transition-colors focus:outline-none"
                >
                    <span className="truncate uppercase tracking-tight">{activePalette?.name || 'Palette'}</span>
                    <ChevronDown size={8} className="ml-1 shrink-0 opacity-40" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1 flex flex-col gap-0.5 max-h-[300px] overflow-y-auto z-50 shadow-2xl bg-card border-border">
                {palettes.map((p) => (
                    <PopoverClose key={p.id} asChild>
                        <button
                            onClick={() => onSelectPalette(p.id)}
                            className={`w-full text-left p-1 rounded group border border-transparent transition-all ${
                                activePaletteId === p.id 
                                ? 'bg-primary/10 border-primary/20' 
                                : 'hover:bg-accent'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-0.5 px-1">
                                <span className={`text-[9px] font-bold truncate ${activePaletteId === p.id ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {p.name}
                                </span>
                                {activePaletteId === p.id && <Check size={8} className="text-primary" />}
                            </div>
                            <div className="h-1 w-full flex rounded-full overflow-hidden bg-background">
                                {p.colors.slice(0, 10).map((c, i) => (
                                    <div key={i} style={{ backgroundColor: c }} className="flex-1 h-full" />
                                ))}
                            </div>
                        </button>
                    </PopoverClose>
                ))}
            </PopoverContent>
        </Popover>

        <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-muted-foreground hover:text-foreground transition-all"
            title="Import Palette"
        >
            <Upload size={10} />
        </button>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".png,.gpl,.ase"
            onChange={handleFileChange}
        />
      </div>

      {/* 2. Controls: Standard Overlapping Color Swap UI */}
      <div className="p-2 border-b border-background bg-card/10 shrink-0 space-y-2">
           <div className="flex items-center justify-between">
               {/* Overlapping Squares */}
               <div className="relative w-10 h-10 ml-1">
                   {/* Secondary (Background) */}
                   <button 
                      onClick={() => setTarget('secondary')}
                      className={`
                        absolute bottom-0 right-0 w-6 h-6 rounded-sm border transition-all
                        ${target === 'secondary' ? 'border-primary z-10' : 'border-[#3f3f3f] hover:border-muted-foreground'}
                      `}
                      style={{ backgroundColor: secondaryColor }}
                      title="Secondary Color"
                   />
                   {/* Primary (Foreground) */}
                   <button 
                      onClick={() => setTarget('primary')}
                      className={`
                        absolute top-0 left-0 w-6 h-6 rounded-sm border transition-all
                        ${target === 'primary' ? 'border-primary z-10' : 'border-[#3f3f3f] hover:border-muted-foreground'}
                      `}
                      style={{ backgroundColor: primaryColor }}
                      title="Primary Color"
                   />
               </div>

               {/* Swap Button */}
               <div className="flex flex-col gap-1 items-center mr-1">
                   <button 
                      onClick={swapColors} 
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-all active:scale-90 border border-transparent"
                      title="Swap Colors (X)"
                    >
                      <ArrowRightLeft size={12} />
                   </button>
               </div>
           </div>

           {/* Picker & Add Buttons - Cleaned up */}
           <div className="flex items-center gap-1">
                <div className="relative flex-1 h-5 flex items-center bg-secondary/40 hover:bg-secondary/60 rounded border border-[#3f3f3f] overflow-hidden transition-colors">
                    <input 
                        type="color" 
                        value={currentColor}
                        onChange={(e) => handleColorPick(e.target.value)}
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                        title="Pick Custom Color"
                    />
                    <div className="relative flex items-center gap-2 px-1.5 pointer-events-none w-full">
                        <PaletteIcon size={8} className="text-muted-foreground" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Pick Color</span>
                    </div>
                </div>
                
                <button 
                    className="h-5 w-5 flex items-center justify-center rounded bg-secondary/40 border border-[#3f3f3f] text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-90"
                    onClick={() => onAddColor(primaryColor)}
                    title="Add Current to Palette"
                >
                    <Plus size={10} />
                </button>
           </div>
      </div>

      {/* 3. Swatches Grid*/}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 bg-background/5 min-h-0">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-0.5 content-start">
              {colors.map((color, idx) => {
                  const isPrimary = primaryColor.toLowerCase() === color.toLowerCase();
                  const isSecondary = secondaryColor.toLowerCase() === color.toLowerCase();
                  
                  return (
                      <button
                          key={`${color}-${idx}`}
                          className={`
                              aspect-square rounded-[1px] transition-all active:scale-90 relative overflow-hidden group
                              ${(target === 'primary' && isPrimary) 
                                  ? 'z-10 ring-1 ring-primary ring-inset shadow-[0_0_0_1px_rgba(255,255,255,0.4)]' 
                                  : (target === 'secondary' && isSecondary)
                                      ? 'z-10 ring-1 ring-muted-foreground ring-inset opacity-90'
                                      : 'hover:z-10'}
                          `}
                          // Fix: Removed the non-standard 'cornerShape' property to resolve TypeScript error.
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorPick(color)}
                          onContextMenu={(e) => {
                              e.preventDefault();
                              onColorSelect(color, false);
                              setTarget('secondary');
                          }}
                          title={color}
                      >
                          {/* Indicator marks for active colors */}
                          {isPrimary && (
                              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-background border-b border-l border-primary/60 rounded-bl-sm"></div>
                          )}
                          {isSecondary && !isPrimary && (
                              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-background border-t border-r border-muted-foreground/60 rounded-tr-sm"></div>
                          )}
                      </button>
                  );
              })}
          </div>
      </div>
    </div>
  );
};