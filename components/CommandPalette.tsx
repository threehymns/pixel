import React, { useMemo, useState, useEffect } from 'react';
import {
  Command as CommandRoot,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemText,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@ui-sdk/react/command';
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from './ui/dialog';
import { Command } from '../types';
import { Search } from './Icons';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CATEGORY_ORDER = ['File', 'Edit', 'Tools', 'View', 'Select', 'Layer', 'Sprite'];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const groupedCommands = useMemo(() => {
    const map = new Map<string, Command[]>();
    CATEGORY_ORDER.forEach((cat) => map.set(cat, []));
    commands.forEach((cmd) => {
      const list = map.get(cmd.category) ?? [];
      list.push(cmd);
      map.set(cmd.category, list);
    });
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [commands]);

  const handleAction = (value: string) => {
    const cmd = commands.find((c) => c.id === value);
    if (cmd && !cmd.disabled) {
      cmd.perform();
      onClose();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogBackdrop />
      <DialogContent className="top-[14vh] translate-y-0 max-w-xl border-border-strong bg-popover text-popover-foreground">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <CommandRoot
          query={query}
          onQueryChange={(next) => setQuery(next)}
          onAction={handleAction}
          filter="fuzzy"
          autoHighlight
          loop
          className="flex flex-col"
        >
          <div className="flex h-11 items-center gap-2.5 border-b border-border px-3.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              aria-label="Search commands"
              placeholder="Search commands, tools, and actions..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
              Esc
            </kbd>
          </div>

          <CommandEmpty className="text-center text-xs text-muted-foreground data-[empty]:px-4 data-[empty]:py-10">
            No matching commands
          </CommandEmpty>

          <CommandList className="max-h-[340px] overflow-y-auto p-1.5">
            {groupedCommands.map(([category, items], groupIdx) => (
              <React.Fragment key={category}>
                {groupIdx > 0 && <CommandSeparator className="my-1 h-px bg-border" />}
                <CommandGroup>
                  <CommandGroupLabel className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {category}
                  </CommandGroupLabel>
                  {items.map((cmd) => (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.id}
                      label={cmd.label}
                      keywords={[cmd.category, cmd.hotkey || '']}
                      disabled={cmd.disabled}
                      className="flex w-full cursor-default select-none items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                    >
                      <CommandItemText className="min-w-0 flex-1 truncate [&>mark]:bg-primary/25 [&>mark]:text-primary [&>mark]:rounded-[2px] [&>mark]:px-0.5">
                        {cmd.label}
                      </CommandItemText>
                      {cmd.hotkey && (
                        <CommandShortcut className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {cmd.hotkey}
                        </CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>

          <div className="flex h-7 items-center justify-between border-t border-border bg-muted/40 px-3.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">↑↓</kbd>
                Navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">↵</kbd>
                Run
              </span>
            </div>
            <span className="tabular-nums">{commands.length} commands</span>
          </div>
        </CommandRoot>
      </DialogContent>
    </Dialog>
  );
};