
import React from 'react';
import { Command, RecentProject } from '../types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from './Popover';
import { ChevronRight, Trash2 } from './Icons';

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
    
    // Listen for toggle events (native to the popover API) to update our open state
    document.addEventListener('toggle', handleToggle, true);
    return () => document.removeEventListener('toggle', handleToggle, true);
  }, []);

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    // If a menu is already open, hovering over another menu trigger should switch to it
    if (isAnyMenuOpen) {
      const button = e.currentTarget;
      const targetId = button.getAttribute('popovertarget');
      const targetPopover = targetId ? document.getElementById(targetId) : null;
      
      // If the hovered button's popover isn't open yet, trigger a click to switch menus
      if (targetPopover && !targetPopover.matches(':popover-open')) {
        button.click();
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      {categories.map(category => {
        const categoryCommands = commands.filter(c => c.category === category);
        
        return (
          <Popover key={category}>
            <PopoverTrigger 
              asChild 
              onMouseEnter={handleMouseEnter}
            >
              <button className="px-3 py-1 text-sm text-gray-300 hover:bg-accent rounded-sm focus:outline-none focus:bg-accent data-[state=open]:bg-accent">
                {category}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={2} className="w-56 p-1 flex flex-col gap-0.5">
              {categoryCommands.map(cmd => {
                const menuItem = (
                    <PopoverClose key={cmd.id} asChild>
                        <button 
                            onClick={cmd.perform}
                            disabled={cmd.disabled}
                            className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="text-xs">{cmd.label}</span>
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
                       {/* Submenu for Open Recent */}
                       <div className="relative group/recent w-full">
                          <button className="w-full text-left px-3 py-1.5 rounded-sm hover:bg-primary hover:text-primary-foreground text-foreground flex items-center justify-between group">
                              <span className="text-xs">Open Recent</span>
                              <ChevronRight size={12} className="text-muted-foreground group-hover:text-primary-foreground" />
                          </button>
                          
                          {/* Absolute positioned submenu - using CSS to show on hover */}
                          <div className="absolute left-full top-0 ml-1 w-48 bg-popover border border-border rounded shadow-xl hidden group-hover/recent:flex flex-col gap-0.5 p-1 z-[60]">
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
                          </div>
                       </div>
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
