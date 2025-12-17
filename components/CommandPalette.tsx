import React, { useState, useEffect, useRef } from 'react';
import { Command } from '../types';
import { Search, Command as CmdIcon } from './Icons';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase()) || 
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].perform();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[1px] flex justify-center items-start pt-[10vh]" onClick={onClose}>
      <div 
        className="w-[600px] bg-popover border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col text-popover-foreground animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-3 py-3 border-b border-border">
           <Search className="text-muted-foreground mr-3" size={18} />
           <input
             ref={inputRef}
             className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder-muted-foreground"
             placeholder="Type a command..."
             value={query}
             onChange={e => setQuery(e.target.value)}
             onKeyDown={handleKeyDown}
           />
           <div className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border">ESC</div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto py-1 custom-scrollbar">
           {filteredCommands.length === 0 ? (
             <div className="px-4 py-8 text-center text-muted-foreground text-sm">No commands found</div>
           ) : (
             filteredCommands.map((cmd, idx) => (
               <button
                 key={cmd.id}
                 className={`w-full text-left px-3 py-2 flex items-center justify-between text-sm ${
                   idx === selectedIndex ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
                 }`}
                 onClick={() => {
                   cmd.perform();
                   onClose();
                 }}
                 onMouseEnter={() => setSelectedIndex(idx)}
               >
                 <div className="flex items-center gap-2">
                    {idx === selectedIndex && <CmdIcon size={12} className="opacity-50" />}
                    <span>{cmd.label}</span>
                    <span className={`text-[10px] opacity-50 ml-2 border px-1 rounded-sm ${idx===selectedIndex ? 'border-primary-foreground' : 'border-border'}`}>{cmd.category}</span>
                 </div>
                 {cmd.hotkey && <span className="text-xs opacity-60 font-mono">{cmd.hotkey}</span>}
               </button>
             ))
           )}
        </div>
        <div className="bg-muted px-3 py-1 text-[10px] text-muted-foreground border-t border-border flex justify-between">
            <span>PixelForge Command Palette</span>
            <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
};