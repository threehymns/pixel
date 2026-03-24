import React from 'react';
import { Command, RecentProject } from '../types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './Popover';
import { ChevronRight, Trash2, Check } from './Icons';

interface MenubarProps {
  commands: Command[];
  recentProjects?: RecentProject[];
  onOpenRecent?: (project: RecentProject) => void;
  onClearRecent?: () => void;
}

export const Menubar: React.FC<MenubarProps> = ({ 
  commands, 
  recentProjects = [], 
  onOpenRecent,
  onClearRecent 
}) => {
  const categories = ['File', 'Edit', 'View', 'Select', 'Layer', 'Sprite'];
  const [isAnyMenuOpen, setIsAnyMenuOpen] = React.useState(false);

  // Track the global state of popovers to enable "hover-to-switch" behavior
  React.useEffect(() => {
    const handleToggle = () => {
      const openPopover = document.querySelector('[popover]:popover-open');
      setIsAnyMenuOpen(!!openPopover);
    };
    
    document.addEventListener('toggle', handleToggle, true);
    return () => document.removeEventListener('toggle', handleToggle, true);
  }, []);

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isAnyMenuOpen) {
      const button = e.currentTarget;
      const targetId = button.getAttribute('popovertarget');
      const targetPopover = targetId ? document.getElementById(targetId) : null;
      
      if (targetPopover && !targetPopover.matches(':popover-open')) {
        button.click();
      }
    }
  };

  const handleSubmenuEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget;
      const targetId = button.getAttribute('popovertarget');
      const targetPopover = targetId ? document.getElementById(targetId) : null;
      if (targetPopover && !targetPopover.matches(':popover-open')) {
          try {
              targetPopover.showPopover();
          } catch (err) {}
      }
  };

  return (
    <div className="flex items-center gap-0.5">
      {categories.map(category => {
        const categoryCommands = commands.filter(c => c.category === category);
        
        return (
          <Popover key={category}>
            <PopoverTrigger 
              asChild 
              onMouseEnter={handleMouseEnter}
            >
              <button className="px-2.5 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md focus:outline-none focus:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground transition-colors">
                {category}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={4} className="w-56 p-1 flex flex-col gap-0.5 overflow-visible shadow-lg border-border/50 bg-card/95 backdrop-blur-sm rounded-lg">
              {categoryCommands.map(cmd => {
                // Special handling to group Color Mode commands into a nested Popover
                if (cmd.id === 'sprite.modeRGBA') return null; 
                
                if (cmd.id === 'sprite.modeIndexed') {
                    const indexedCmd = cmd;
                    const rgbaCmd = categoryCommands.find(c => c.id === 'sprite.modeRGBA');
                    
                    return (
                        <Popover key="color-mode-popover">
                            <PopoverTrigger asChild onMouseEnter={handleSubmenuEnter}>
                                <button className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group">
                                    <span className="text-xs">Color Mode</span>
                                    <ChevronRight size={12} className="text-muted-foreground group-hover:text-primary-foreground" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent side="right" align="start" sideOffset={4} className="w-44 p-1 flex flex-col gap-0.5 shadow-lg border border-border/50 bg-card/95 backdrop-blur-sm rounded-lg z-[100]">
                                <PopoverClose asChild>
                                    <button 
                                        onClick={indexedCmd.perform}
                                        disabled={indexedCmd.disabled}
                                        className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group disabled:opacity-50"
                                    >
                                        <span className="text-xs">Indexed</span>
                                        {indexedCmd.disabled && <Check size={12} className="text-primary group-hover:text-primary-foreground" />}
                                    </button>
                                </PopoverClose>
                                {rgbaCmd && (
                                    <PopoverClose asChild>
                                        <button 
                                            onClick={rgbaCmd.perform}
                                            disabled={rgbaCmd.disabled}
                                            className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group disabled:opacity-50"
                                        >
                                            <span className="text-xs">RGBA</span>
                                            {rgbaCmd.disabled && <Check size={12} className="text-primary group-hover:text-primary-foreground" />}
                                        </button>
                                    </PopoverClose>
                                )}
                            </PopoverContent>
                        </Popover>
                    );
                }

                const menuItem = (
                    <PopoverClose key={cmd.id} asChild>
                        <button 
                            onClick={cmd.perform}
                            disabled={cmd.disabled}
                            className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="text-xs flex items-center gap-2">
                                {cmd.checked !== undefined && (
                                    <span className="w-3 flex justify-center">
                                        {cmd.checked && <Check size={12} className="text-foreground group-hover:text-primary-foreground" />}
                                    </span>
                                )}
                                {cmd.label}
                            </span>
                            {cmd.hotkey && (
                                <span className="text-[10px] text-muted-foreground group-hover:text-primary-foreground/80">{cmd.hotkey}</span>
                            )}
                        </button>
                    </PopoverClose>
                );

                if (category === 'File' && cmd.id === 'file.open') {
                   return (
                     <React.Fragment key="fragment-recent">
                       {menuItem}
                       {/* Nested Popover for Open Recent */}
                       <Popover>
                          <PopoverTrigger asChild onMouseEnter={handleSubmenuEnter}>
                              <button className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group">
                                  <span className="text-xs">Open Recent</span>
                                  <ChevronRight size={12} className="text-muted-foreground group-hover:text-primary-foreground" />
                              </button>
                          </PopoverTrigger>
                          <PopoverContent side="right" align="start" sideOffset={4} className="w-48 p-1 flex flex-col gap-0.5 shadow-lg border border-border/50 bg-card/95 backdrop-blur-sm rounded-lg z-[100]">
                             {recentProjects.length === 0 ? (
                                <div className="px-3 py-2 text-[10px] text-muted-foreground italic">No recent files</div>
                             ) : (
                                <>
                                  {recentProjects.map(recent => (
                                    <PopoverClose key={recent.id} asChild>
                                        <button
                                            onClick={() => onOpenRecent && onOpenRecent(recent)}
                                            className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex flex-col group"
                                        >
                                            <span className="text-xs truncate font-medium">{recent.title}</span>
                                            <span className="text-[9px] text-muted-foreground group-hover:text-primary-foreground/80">{new Date(recent.timestamp).toLocaleDateString()}</span>
                                        </button>
                                    </PopoverClose>
                                  ))}
                                  {onClearRecent && (
                                    <>
                                        <div className="border-t border-border my-0.5"></div>
                                        <button 
                                            onClick={onClearRecent}
                                            className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-destructive hover:text-destructive-foreground text-muted-foreground flex items-center gap-2 text-xs"
                                        >
                                            <Trash2 size={10} />
                                            <span>Clear List</span>
                                        </button>
                                    </>
                                  )}
                                </>
                             )}
                          </PopoverContent>
                       </Popover>
                     </React.Fragment>
                   );
                }

                return menuItem;
              })}
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
};