import React, { useRef } from 'react';
import { Plus, Upload, GripVertical, ChevronDown, Check } from './Icons';
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
  width,
  colors,
  palettes,
  activePaletteId,
  primaryColor,
  secondaryColor,
  onColorSelect,
  onAddColor,
  onSelectPalette,
  onImportPalette,
  onResizeStart,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePalette = palettes.find(p => p.id === activePaletteId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportPalette(e.target.files[0]);
    }
    // Reset value so same file can be selected again
    if (e.target.value) e.target.value = '';
  };

  return (
    <div 
      className="flex flex-col h-full bg-card border-r border-background relative select-none"
      style={{ width: width, minWidth: 160, maxWidth: 400 }}
    >
      {/* Palette Header & Controls */}
      <div className="p-2 border-b border-border flex flex-col gap-2">
        <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
                <Popover>
                    <PopoverTrigger asChild>
                        <button 
                            className="w-full bg-muted text-xs text-muted-foreground border border-border rounded px-2 py-1.5 flex items-center justify-between hover:border-input transition-colors focus:outline-none focus:border-ring"
                        >
                            <span className="truncate font-medium">{activePalette?.name || 'Select Palette'}</span>
                            <ChevronDown size={12} className="text-muted-foreground ml-2 inline-block flex-shrink-0" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-1 flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
                        {palettes.map((p) => (
                            <PopoverClose key={p.id} asChild>
                                <button
                                    onClick={() => onSelectPalette(p.id)}
                                    className={`w-full text-left p-2 rounded group border border-transparent transition-all ${
                                        activePaletteId === p.id 
                                        ? 'bg-secondary border-input' 
                                        : 'hover:bg-accent hover:border-border'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-xs font-medium truncate ${activePaletteId === p.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {p.name}
                                        </span>
                                        {activePaletteId === p.id && <Check size={12} className="text-primary" />}
                                    </div>
                                    <div className="h-3 w-full flex rounded-sm overflow-hidden bg-background ring-1 ring-white/5">
                                        {p.colors.slice(0, 20).map((c, i) => (
                                            <div 
                                                key={i} 
                                                style={{ backgroundColor: c }} 
                                                className="flex-1 h-full"
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                </button>
                            </PopoverClose>
                        ))}
                    </PopoverContent>
                </Popover>
            </div>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-secondary hover:bg-input rounded border border-background text-muted-foreground h-[29px] w-[29px] flex items-center justify-center"
                title="Import Palette (.png, .gpl, .ase)"
            >
                <Upload size={14} />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".png,.gpl,.ase"
                onChange={handleFileChange}
            />
        </div>
      </div>

      <div className="p-2 flex-1 flex flex-col overflow-hidden">
        {/* Current Colors Display */}
        <div className="mb-4 bg-muted p-3 rounded-sm border border-border shadow-inner flex-shrink-0">
            <div className="flex gap-4 items-center justify-center">
            <div className="relative w-12 h-12">
                {/* Secondary (Back) */}
                <div 
                className="absolute bottom-0 right-0 w-8 h-8 border-2 border-white shadow-md z-0 cursor-pointer"
                style={{ backgroundColor: secondaryColor }}
                onClick={() => {}}
                />
                {/* Primary (Front) */}
                <div 
                className="absolute top-0 left-0 w-8 h-8 border-2 border-white shadow-md z-10 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
                onClick={() => {}}
                />
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-muted-foreground overflow-hidden">
                <span className="truncate">Pri: {primaryColor.toUpperCase()}</span>
                <span className="truncate">Sec: {secondaryColor.toUpperCase()}</span>
            </div>
            </div>
        </div>

        <div className="text-xs text-muted-foreground mb-1 px-1 font-bold">SWATCHES</div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-auto-fill gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(1.5rem, 1fr))' }}>
            {colors.map((color, idx) => (
                <div
                key={`${color}-${idx}`}
                className={`aspect-square cursor-pointer border hover:border-white transition-colors
                    ${primaryColor === color ? 'border-white ring-1 ring-black' : 'border-background'}
                `}
                style={{ backgroundColor: color }}
                onClick={() => onColorSelect(color, true)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onColorSelect(color, false);
                }}
                title={color}
                />
            ))}
            <button 
                className="aspect-square flex items-center justify-center bg-secondary border border-background hover:bg-input text-muted-foreground"
                onClick={() => onAddColor('#ffffff')}
            >
                <Plus size={14} />
            </button>
            </div>
        </div>
      </div>

      <div className="p-2 border-t border-border flex-shrink-0">
         <div className="flex items-center gap-2">
            <input 
              type="color" 
              value={primaryColor}
              onChange={(e) => onColorSelect(e.target.value, true)}
              className="w-8 h-8 cursor-pointer border-0 p-0 bg-transparent"
            />
            <div className="flex-1 text-xs text-muted-foreground">
               Click to pick custom
            </div>
         </div>
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