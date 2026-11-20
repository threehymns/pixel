import React from 'react';
import { Menubar as PrimitiveMenubar } from '@ui-sdk/react/menubar';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuItemIcon,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from './ui/menu';
import { studioConfirm } from './ui/alert-dialog';
import { Command, RecentProject } from '../types';
import { Trash2 } from './Icons';

interface MenubarProps {
  commands: Command[];
  recentProjects?: RecentProject[];
  onOpenRecent?: (project: RecentProject) => void;
  onClearRecent?: () => void;
}

const CATEGORIES = ['File', 'Edit', 'Tools', 'View', 'Select', 'Layer', 'Sprite'] as const;

const SEPARATOR_AFTER = new Set([
  'file.close',
  'edit.redo',
  'edit.clearEdit',
  'fx.outline',
  'tool.move',
  'view.prevTab',
  'view.timeline',
  'view.referenceImage',
  'select.stroke',
  'layer.toggleCollapseAll',
  'layer.centerContent',
  'frame.duplicate',
  'sprite.dithering',
]);

interface RecentProjectsSubmenuProps {
  recentProjects: RecentProject[];
  onOpenRecent?: (project: RecentProject) => void;
  onClearRecent?: () => void;
}

const RecentProjectsSubmenu: React.FC<RecentProjectsSubmenuProps> = ({
  recentProjects,
  onOpenRecent,
  onClearRecent,
}) => {
  const handleClearRecent = async () => {
    if (!onClearRecent) return;
    const confirmed = await studioConfirm({
      title: 'Clear recent files?',
      description: 'This removes your saved recent project shortcuts from this browser.',
      confirmLabel: 'Clear Recent',
      destructive: true,
    });
    if (confirmed) onClearRecent();
  };

  return (
    <MenuSub>
      <MenuSubTrigger>Open Recent</MenuSubTrigger>
      <MenuSubContent className="w-56">
        {recentProjects.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-muted-foreground">No recent files</div>
        ) : (
          <>
            {recentProjects.map((recent) => (
              <MenuItem
                key={recent.id}
                value={`recent-${recent.id}`}
                onSelect={() => onOpenRecent?.(recent)}
                className="flex-col items-start gap-0.5 py-1.5"
              >
                <span className="w-full truncate text-xs font-medium">{recent.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {recent.width}×{recent.height} · {new Date(recent.timestamp).toLocaleDateString()}
                </span>
              </MenuItem>
            ))}
            {onClearRecent && (
              <>
                <MenuSeparator />
                <MenuItem value="clear-recent" destructive onSelect={handleClearRecent}>
                  <MenuItemIcon>
                    <Trash2 className="h-3.5 w-3.5" />
                  </MenuItemIcon>
                  <span>Clear Recent List</span>
                </MenuItem>
              </>
            )}
          </>
        )}
      </MenuSubContent>
    </MenuSub>
  );
};

interface MenubarCategoryMenuProps {
  category: (typeof CATEGORIES)[number];
  commands: Command[];
  recentSubmenu?: React.ReactNode;
}

const MenubarCategoryMenu: React.FC<MenubarCategoryMenuProps> = ({
  category,
  commands,
  recentSubmenu,
}) => {
  const categoryCommands = commands.filter((c) => c.category === category);

  return (
    <Menu>
      <MenuTrigger className="rounded-sm px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[open]:bg-accent data-[open]:text-foreground cursor-pointer">
        {category}
      </MenuTrigger>
      <MenuContent align="start" sideOffset={4} className="w-56">
        {categoryCommands.map((cmd) => {
          if (cmd.id === 'sprite.modeRGBA') return null;

          if (category === 'Edit' && cmd.id === 'fx.outline') {
            return (
              <React.Fragment key="edit-fx-group">
                <MenuSub>
                  <MenuSubTrigger>FX</MenuSubTrigger>
                  <MenuSubContent className="w-44">
                    <MenuItem value={cmd.id} disabled={cmd.disabled} onSelect={cmd.perform}>
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.hotkey && <MenuShortcut>{cmd.hotkey}</MenuShortcut>}
                    </MenuItem>
                  </MenuSubContent>
                </MenuSub>
              </React.Fragment>
            );
          }

          if (cmd.id === 'sprite.modeIndexed') {
            const indexedCmd = cmd;
            const rgbaCmd = categoryCommands.find((c) => c.id === 'sprite.modeRGBA');
            const activeMode = indexedCmd.checked ? 'indexed' : 'rgba';

            return (
              <MenuSub key="color-mode-submenu">
                <MenuSubTrigger>Color Mode</MenuSubTrigger>
                <MenuSubContent className="w-40">
                  <MenuRadioGroup
                    value={activeMode}
                    onValueChange={(next) => {
                      if (next === 'indexed') indexedCmd.perform();
                      else if (next === 'rgba') rgbaCmd?.perform();
                    }}
                  >
                    <MenuRadioItem value="indexed">Indexed</MenuRadioItem>
                    {rgbaCmd && <MenuRadioItem value="rgba">RGBA</MenuRadioItem>}
                  </MenuRadioGroup>
                </MenuSubContent>
              </MenuSub>
            );
          }

          const menuEntry =
            cmd.checked !== undefined ? (
              <MenuCheckboxItem
                key={cmd.id}
                value={cmd.id}
                checked={cmd.checked}
                disabled={cmd.disabled}
                onCheckedChange={() => cmd.perform()}
              >
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hotkey && <MenuShortcut>{cmd.hotkey}</MenuShortcut>}
              </MenuCheckboxItem>
            ) : (
              <MenuItem
                key={cmd.id}
                value={cmd.id}
                disabled={cmd.disabled}
                onSelect={cmd.perform}
              >
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hotkey && <MenuShortcut>{cmd.hotkey}</MenuShortcut>}
              </MenuItem>
            );

          if (category === 'File' && cmd.id === 'file.open') {
            return (
              <React.Fragment key="file-open-with-recent">
                {menuEntry}
                {recentSubmenu}
              </React.Fragment>
            );
          }

          if (SEPARATOR_AFTER.has(cmd.id)) {
            return (
              <React.Fragment key={cmd.id}>
                {menuEntry}
                <MenuSeparator />
              </React.Fragment>
            );
          }

          return menuEntry;
        })}
      </MenuContent>
    </Menu>
  );
};

export const Menubar: React.FC<MenubarProps> = ({
  commands,
  recentProjects = [],
  onOpenRecent,
  onClearRecent,
}) => {
  const recentSubmenu = (
    <RecentProjectsSubmenu
      recentProjects={recentProjects}
      onOpenRecent={onOpenRecent}
      onClearRecent={onClearRecent}
    />
  );

  return (
    <PrimitiveMenubar aria-label="Application menu" className="flex items-center gap-0.5">
      {CATEGORIES.map((category) => (
        <MenubarCategoryMenu
          key={category}
          category={category}
          commands={commands}
          recentSubmenu={category === 'File' ? recentSubmenu : undefined}
        />
      ))}
    </PrimitiveMenubar>
  );
};