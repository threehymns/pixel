import React, { useRef, useState, useEffect } from 'react';
import { Plus, Upload, ChevronDown, Check, Palette as PaletteIcon } from './Icons';
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
  onColorsSelected?: (colors: string[]) => void;
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
  onColorsSelected,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<'primary' | 'secondary'>('primary');
  
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activePalette = palettes.find(p => p.id === activePaletteId);

  useEffect(() => {
      const handleGlobalPointerUp = () => {
          if (isDragging) {
              setIsDragging(false);
              if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) {
                  const start = Math.min(selectionStart, selectionEnd);
                  const end = Math.max(selectionStart, selectionEnd);
                  if (onColorsSelected) {
                      onColorsSelected(colors.slice(start, end + 1));
                  }
              }
          }
      };
      window.addEventListener('pointerup', handleGlobalPointerUp);
      return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDragging, selectionStart, selectionEnd, colors, onColorsSelected]);

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
      if (e.button === 0) { // Left click
          if (e.shiftKey && selectionStart !== null) {
              setSelectionEnd(idx);
              const start = Math.min(selectionStart, idx);
              const end = Math.max(selectionStart, idx);
              if (onColorsSelected && end > start) {
                  onColorsSelected(colors.slice(start, end + 1));
              }
          } else {
              setSelectionStart(idx);
              setSelectionEnd(idx);
              setIsDragging(true);
              onColorSelect(colors[idx], true);
              setTarget('primary');
          }
      } else if (e.button === 2) { // Right click
          onColorSelect(colors[idx], false);
          setTarget('secondary');
      }
  };

  const handlePointerEnter = (idx: number) => {
      if (isDragging && selectionStart !== null) {
          setSelectionEnd(idx);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportPalette(e.target.files[0]);
    }
    if (e.target.value) e.target.value = '';
  };

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
            onClick={() => onAddColor(primaryColor)}
            className="p-1 text-muted-foreground hover:text-foreground transition-all"
            title="Add Primary Color to Palette"
        >
            <Plus size={10} />
        </button>

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

      {/* 2. Swatches Grid*/}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 bg-background/5 min-h-0">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-0.5 content-start">
              {colors.map((color, idx) => {
                  const isPrimary = primaryColor.toLowerCase() === color.toLowerCase();
                  const isSecondary = secondaryColor.toLowerCase() === color.toLowerCase();
                  
                  let inSelection = false;
                  if (selectionStart !== null && selectionEnd !== null) {
                      const start = Math.min(selectionStart, selectionEnd);
                      const end = Math.max(selectionStart, selectionEnd);
                      inSelection = idx >= start && idx <= end;
                  }
                  
                  return (
                      <button
                          key={`${color}-${idx}`}
                          className={`
                              aspect-square rounded-[1px] transition-all active:scale-90 relative overflow-hidden group
                              ${inSelection ? 'ring-2 ring-primary z-20 scale-110 shadow-lg' : (isPrimary || isSecondary) ? 'z-10 ring-1 ring-border ring-inset' : 'hover:z-10 hover:ring-1 hover:ring-border/50'}
                          `}
                          style={{ backgroundColor: color }}
                          onPointerDown={(e) => {
                              e.preventDefault();
                              handlePointerDown(idx, e);
                          }}
                          onPointerEnter={() => handlePointerEnter(idx)}
                          onContextMenu={(e) => e.preventDefault()}
                          title={`${color} (Left-click: Primary, Right-click: Secondary, Drag/Shift-click: Select Range)`}
                      >
                          {/* Aseprite-style triangular indicators */}
                          {isPrimary && (
                              <div className="absolute top-0 left-0 w-0 h-0 border-t-[8px] border-r-[8px] border-t-primary border-r-transparent drop-shadow-sm"></div>
                          )}
                          {isSecondary && (
                              <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[8px] border-l-[8px] border-b-foreground border-l-transparent drop-shadow-sm"></div>
                          )}
                          
                          {/* Center dot for the active target color to match Aseprite's "current entry" */}
                          {((target === 'primary' && isPrimary) || (target === 'secondary' && isSecondary)) && (
                              <div className="absolute inset-0 m-auto w-1 h-1 bg-background rounded-full shadow-sm mix-blend-difference"></div>
                          )}
                      </button>
                  );
              })}
          </div>
      </div>
    </div>
  );
};