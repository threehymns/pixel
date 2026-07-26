import React, { useState, useEffect } from 'react';

export interface PaneGroup {
  id: string;
  panes: string[];
  activePaneId: string;
}

export type SplitDirection = 'vertical' | 'horizontal';

export interface SlotState {
  groups: PaneGroup[];
  splitDirection: SplitDirection;
  visible: boolean;
  size?: number;
}

export type DragZonePosition = 'tab-bar' | 'body-top' | 'body-bottom' | 'body-left' | 'body-right';

export interface DragOverZone {
  slotId: string;
  groupId?: string;
  position: DragZonePosition;
}

export interface WorkspaceLayout {
  left: SlotState;
  right: SlotState;
  bottom: SlotState;
}

export interface FloatingPane {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  left: {
    groups: [
      { id: 'g-left-1', panes: ['file-tree', 'palette'], activePaneId: 'palette' }
    ],
    splitDirection: 'vertical',
    visible: true,
    size: 220
  },
  right: {
    groups: [
      { id: 'g-right-1', panes: ['layers', 'history'], activePaneId: 'layers' }
    ],
    splitDirection: 'vertical',
    visible: true,
    size: 250
  },
  bottom: {
    groups: [
      { id: 'g-bottom-1', panes: ['timeline', 'preview'], activePaneId: 'timeline' }
    ],
    splitDirection: 'horizontal',
    visible: true,
    size: 220
  }
};

function normalizeSlot(slotData: any, defaultSlotId: 'left' | 'right' | 'bottom'): SlotState {
  if (!slotData) return DEFAULT_LAYOUT[defaultSlotId];

  if (Array.isArray(slotData.groups) && slotData.groups.length > 0) {
    const validGroups: PaneGroup[] = slotData.groups
      .map((g: any, i: number) => ({
        id: g.id || `g-${defaultSlotId}-${i + 1}`,
        panes: Array.isArray(g.panes) ? g.panes : [],
        activePaneId: g.activePaneId || (g.panes && g.panes[0]) || ''
      }))
      .filter((g: PaneGroup) => g.panes.length > 0);

    if (validGroups.length > 0) {
      return {
        groups: validGroups,
        splitDirection: slotData.splitDirection === 'horizontal' ? 'horizontal' : 'vertical',
        visible: slotData.visible ?? true,
        size: slotData.size
      };
    }
  }

  // Conversion from legacy format (panes, activePaneId, splitActivePaneId)
  const panes: string[] = Array.isArray(slotData.panes) ? slotData.panes : [];
  const activePaneId = slotData.activePaneId || panes[0] || '';
  const splitActivePaneId = slotData.splitActivePaneId;

  if (splitActivePaneId && panes.includes(splitActivePaneId) && splitActivePaneId !== activePaneId) {
    const mainPanes = panes.filter(p => p !== splitActivePaneId);
    return {
      groups: [
        { id: `g-${defaultSlotId}-1`, panes: mainPanes.length > 0 ? mainPanes : [activePaneId], activePaneId: activePaneId },
        { id: `g-${defaultSlotId}-2`, panes: [splitActivePaneId], activePaneId: splitActivePaneId }
      ],
      splitDirection: 'vertical',
      visible: slotData.visible ?? true,
      size: slotData.size
    };
  }

  return {
    groups: [
      { id: `g-${defaultSlotId}-1`, panes: panes.length > 0 ? panes : DEFAULT_LAYOUT[defaultSlotId].groups[0].panes, activePaneId: activePaneId || panes[0] || DEFAULT_LAYOUT[defaultSlotId].groups[0].activePaneId }
    ],
    splitDirection: 'vertical',
    visible: slotData.visible ?? true,
    size: slotData.size
  };
}

export function useLayout() {
  const [slots, setSlots] = useState<WorkspaceLayout>(() => {
    const saved = localStorage.getItem('pixelforge_studio_layout_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.left || parsed.right || parsed.bottom) {
          const left = normalizeSlot(parsed.left, 'left');
          const right = normalizeSlot(parsed.right, 'right');
          const bottom = normalizeSlot(parsed.bottom, 'bottom');

          // Verify all core panes exist across slots
          const allPanes = ['file-tree', 'palette', 'layers', 'history', 'timeline', 'preview'];
          const existingPanes = [
            ...left.groups.flatMap(g => g.panes),
            ...right.groups.flatMap(g => g.panes),
            ...bottom.groups.flatMap(g => g.panes)
          ];
          const missingPanes = allPanes.filter(p => !existingPanes.includes(p));

          missingPanes.forEach(paneId => {
            const defaultKey =
              paneId === 'file-tree' || paneId === 'palette' ? 'left' :
              paneId === 'layers' || paneId === 'history' ? 'right' : 'bottom';
            const targetSlot = defaultKey === 'left' ? left : defaultKey === 'right' ? right : bottom;
            if (targetSlot.groups.length > 0) {
              targetSlot.groups[0].panes.push(paneId);
            } else {
              targetSlot.groups.push({ id: `g-${defaultKey}-1`, panes: [paneId], activePaneId: paneId });
            }
          });

          return { left, right, bottom };
        }
      } catch (e) {}
    }
    return DEFAULT_LAYOUT;
  });

  useEffect(() => {
    localStorage.setItem('pixelforge_studio_layout_v3', JSON.stringify(slots));
  }, [slots]);

  const [floatingPanes, setFloatingPanes] = useState<FloatingPane[]>(() => {
    const saved = localStorage.getItem('pixelforge_studio_floating_panes_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('pixelforge_studio_floating_panes_v3', JSON.stringify(floatingPanes));
  }, [floatingPanes]);

  const [draggedPane, setDraggedPane] = useState<{ paneId: string, sourceSlot: string, sourceGroupId?: string } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{ slotId: string, groupId?: string, index: number } | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DragOverZone | null>(null);

  const togglePaneVisibility = (paneId: string) => {
    const isFloating = floatingPanes.some(p => p.id === paneId);
    if (isFloating) {
      setFloatingPanes(curr => curr.filter(p => p.id !== paneId));
      return;
    }

    setSlots(curr => {
      // Find if pane is in any slot
      let foundSlotId: 'left' | 'right' | 'bottom' | null = null;
      let foundGroup: PaneGroup | null = null;

      for (const slotKey of ['left', 'right', 'bottom'] as const) {
        for (const group of curr[slotKey].groups) {
          if (group.panes.includes(paneId)) {
            foundSlotId = slotKey;
            foundGroup = group;
            break;
          }
        }
        if (foundSlotId) break;
      }

      if (foundSlotId && foundGroup) {
        const slot = curr[foundSlotId];
        if (foundGroup.activePaneId === paneId && slot.visible) {
          // Hide slot if this active tab was clicked while visible
          return {
            ...curr,
            [foundSlotId]: { ...slot, visible: false }
          };
        } else {
          // Select tab and show slot
          const updatedGroups = slot.groups.map(g =>
            g.id === foundGroup!.id ? { ...g, activePaneId: paneId } : g
          );
          return {
            ...curr,
            [foundSlotId]: { ...slot, groups: updatedGroups, visible: true }
          };
        }
      } else {
        // Find default slot for this pane
        const defaultSlotId: 'left' | 'right' | 'bottom' =
          paneId === 'file-tree' || paneId === 'palette' ? 'left' :
          paneId === 'layers' || paneId === 'history' ? 'right' : 'bottom';

        const slot = curr[defaultSlotId];
        const targetGroup = slot.groups[0];

        if (targetGroup) {
          const updatedGroups = slot.groups.map((g, idx) =>
            idx === 0 ? { ...g, panes: Array.from(new Set([...g.panes, paneId])), activePaneId: paneId } : g
          );
          return {
            ...curr,
            [defaultSlotId]: { ...slot, groups: updatedGroups, visible: true }
          };
        } else {
          return {
            ...curr,
            [defaultSlotId]: {
              ...slot,
              groups: [{ id: `g-${defaultSlotId}-1`, panes: [paneId], activePaneId: paneId }],
              visible: true
            }
          };
        }
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, paneId: string, sourceSlot: string, sourceGroupId?: string) => {
    setDraggedPane({ paneId, sourceSlot, sourceGroupId });
    e.dataTransfer.setData('text/plain', paneId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    if (dragOverSlot !== slotId) setDragOverSlot(slotId);
  };

  const handleDragOverBody = (slotId: string, groupId: string, position: DragZonePosition) => {
    if (dragOverSlot !== slotId) setDragOverSlot(slotId);
    setDragOverZone({ slotId, groupId, position });
    setDragOverIndex(null);
  };

  const handleDragOverTabBar = (e: React.DragEvent, slotId: string, groupId: string) => {
    e.preventDefault();
    if (dragOverSlot !== slotId) setDragOverSlot(slotId);
    setDragOverZone({ slotId, groupId, position: 'tab-bar' });

    const slot = slots[slotId as 'left' | 'right' | 'bottom'];
    const group = slot?.groups.find(g => g.id === groupId);
    const count = group?.panes.length || 0;

    if (!dragOverIndex || dragOverIndex.slotId !== slotId || dragOverIndex.groupId !== groupId) {
      setDragOverIndex({ slotId, groupId, index: count });
    }
  };

  const handleDragOverTab = (e: React.DragEvent, paneId: string, slotId: string, groupId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverSlot !== slotId) setDragOverSlot(slotId);
    setDragOverZone({ slotId, groupId, position: 'tab-bar' });

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const targetIndex = e.clientX < midX ? index : index + 1;

    if (!dragOverIndex || dragOverIndex.slotId !== slotId || dragOverIndex.groupId !== groupId || dragOverIndex.index !== targetIndex) {
      setDragOverIndex({ slotId, groupId, index: targetIndex });
    }
  };

  const handleDragEnd = () => {
    setDraggedPane(null);
    setDragOverSlot(null);
    setDragOverIndex(null);
    setDragOverZone(null);
  };

  const handleSelectTab = (slotId: 'left' | 'right' | 'bottom', groupId: string, paneId: string) => {
    setSlots(curr => {
      const slot = curr[slotId];
      if (!slot) return curr;
      const updatedGroups = slot.groups.map(g =>
        g.id === groupId ? { ...g, activePaneId: paneId } : g
      );
      return {
        ...curr,
        [slotId]: { ...slot, groups: updatedGroups, visible: true }
      };
    });
  };

  const splitGroup = (slotId: 'left' | 'right' | 'bottom', groupId: string, paneId: string, direction: SplitDirection) => {
    setSlots(curr => {
      const slot = curr[slotId];
      if (!slot) return curr;

      const groupIdx = slot.groups.findIndex(g => g.id === groupId);
      if (groupIdx === -1) return curr;

      const sourceGroup = slot.groups[groupIdx];
      const remainingPanes = sourceGroup.panes.filter(p => p !== paneId);

      let updatedGroups = [...slot.groups];

      if (remainingPanes.length === 0) {
        if (slot.groups.length > 1) {
          return {
            ...curr,
            [slotId]: { ...slot, splitDirection: direction }
          };
        }
        return curr;
      }

      updatedGroups[groupIdx] = {
        ...sourceGroup,
        panes: remainingPanes,
        activePaneId: sourceGroup.activePaneId === paneId ? remainingPanes[0] : sourceGroup.activePaneId
      };

      const newGroup: PaneGroup = {
        id: `g-${slotId}-${Date.now()}`,
        panes: [paneId],
        activePaneId: paneId
      };

      updatedGroups.splice(groupIdx + 1, 0, newGroup);

      return {
        ...curr,
        [slotId]: {
          ...slot,
          groups: updatedGroups,
          splitDirection: direction,
          visible: true
        }
      };
    });
  };

  const unsplitSlot = (slotId: 'left' | 'right' | 'bottom') => {
    setSlots(curr => {
      const slot = curr[slotId];
      if (!slot || slot.groups.length <= 1) return curr;

      const allPanes = Array.from(new Set(slot.groups.flatMap(g => g.panes))) as string[];
      const activePaneId = slot.groups[0]?.activePaneId || allPanes[0] || '';

      const mergedGroup: PaneGroup = {
        id: slot.groups[0]?.id || `g-${slotId}-merged`,
        panes: allPanes,
        activePaneId
      };

      return {
        ...curr,
        [slotId]: {
          ...slot,
          groups: [mergedGroup],
          visible: true
        }
      };
    });
  };

  const handleClosePane = (paneId: string) => {
    setFloatingPanes(curr => curr.filter(p => p.id !== paneId));

    setSlots(curr => {
      const updated = { ...curr };
      for (const slotKey of ['left', 'right', 'bottom'] as const) {
        const slot = updated[slotKey];
        let changed = false;

        const updatedGroups = slot.groups
          .map(group => {
            if (group.panes.includes(paneId)) {
              changed = true;
              const remaining = group.panes.filter(p => p !== paneId);
              return {
                ...group,
                panes: remaining,
                activePaneId: group.activePaneId === paneId ? remaining[0] || '' : group.activePaneId
              };
            }
            return group;
          })
          .filter(group => group.panes.length > 0);

        if (changed) {
          updated[slotKey] = {
            ...slot,
            groups: updatedGroups,
            visible: updatedGroups.length > 0 ? slot.visible : false
          };
        }
      }
      return updated;
    });
  };

  const handleCloseOtherPanesInGroup = (slotId: 'left' | 'right' | 'bottom', groupId: string, keepPaneId: string) => {
    setSlots(curr => {
      const slot = curr[slotId];
      if (!slot) return curr;

      const updatedGroups = slot.groups.map(g =>
        g.id === groupId ? { ...g, panes: [keepPaneId], activePaneId: keepPaneId } : g
      );

      return {
        ...curr,
        [slotId]: { ...slot, groups: updatedGroups, visible: true }
      };
    });
  };

  const handleCloseAllPanesInSlot = (slotId: 'left' | 'right' | 'bottom') => {
    setSlots(curr => ({
      ...curr,
      [slotId]: { ...curr[slotId], groups: [], visible: false }
    }));
  };

  const handleAddPaneToGroup = (slotId: 'left' | 'right' | 'bottom', groupId: string, paneId: string) => {
    setFloatingPanes(curr => curr.filter(p => p.id !== paneId));

    setSlots(curr => {
      const updated = { ...curr };

      for (const slotKey of ['left', 'right', 'bottom'] as const) {
        const slot = updated[slotKey];
        const updatedGroups = slot.groups
          .map(g => ({
            ...g,
            panes: g.panes.filter(p => p !== paneId),
            activePaneId: g.activePaneId === paneId ? g.panes.filter(p => p !== paneId)[0] || '' : g.activePaneId
          }))
          .filter(g => g.panes.length > 0);

        updated[slotKey] = {
          ...slot,
          groups: updatedGroups,
          visible: updatedGroups.length > 0 ? slot.visible : false
        };
      }

      const targetSlot = updated[slotId];
      let targetGroups = targetSlot.groups;

      if (targetGroups.length === 0) {
        targetGroups = [{ id: `g-${slotId}-1`, panes: [paneId], activePaneId: paneId }];
      } else {
        targetGroups = targetGroups.map(g => {
          if (g.id === groupId) {
            return {
              ...g,
              panes: Array.from(new Set([...g.panes, paneId])),
              activePaneId: paneId
            };
          }
          return g;
        });
      }

      updated[slotId] = {
        ...targetSlot,
        groups: targetGroups,
        visible: true
      };

      return updated;
    });
  };

  const handleAddPaneToSlot = (slotId: 'left' | 'right' | 'bottom', paneId: string) => {
    const slot = slots[slotId];
    const targetGroupId = slot.groups[0]?.id || `g-${slotId}-1`;
    handleAddPaneToGroup(slotId, targetGroupId, paneId);
  };

  const floatPane = (paneId: string, sourceSlot: string, sourceGroupId: string | undefined, x: number, y: number) => {
    if (sourceSlot && sourceSlot !== 'floating') {
      setSlots(curr => {
        const slotKey = sourceSlot as 'left' | 'right' | 'bottom';
        const slot = curr[slotKey];
        if (!slot) return curr;

        const updatedGroups = slot.groups
          .map(g => {
            if (g.panes.includes(paneId)) {
              const remaining = g.panes.filter(p => p !== paneId);
              return {
                ...g,
                panes: remaining,
                activePaneId: g.activePaneId === paneId ? remaining[0] || '' : g.activePaneId
              };
            }
            return g;
          })
          .filter(g => g.panes.length > 0);

        return {
          ...curr,
          [slotKey]: {
            ...slot,
            groups: updatedGroups,
            visible: updatedGroups.length > 0 ? slot.visible : false
          }
        };
      });
    }

    const clampedX = Math.max(10, Math.min(typeof window !== 'undefined' ? window.innerWidth - 300 : 800, x));
    const clampedY = Math.max(10, Math.min(typeof window !== 'undefined' ? window.innerHeight - 300 : 600, y));

    setFloatingPanes(curr => [
      ...curr.filter(p => p.id !== paneId),
      { id: paneId, x: clampedX, y: clampedY, width: 280, height: 320 }
    ]);
  };

  const updateFloatingPanePosition = (paneId: string, x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(typeof window !== 'undefined' ? window.innerWidth - 100 : 800, x));
    const clampedY = Math.max(0, Math.min(typeof window !== 'undefined' ? window.innerHeight - 80 : 600, y));
    setFloatingPanes(curr => curr.map(p => p.id === paneId ? { ...p, x: clampedX, y: clampedY } : p));
  };

  const handleDrop = (e: React.DragEvent, slotId: 'left' | 'right' | 'bottom', targetGroupId?: string) => {
    e.preventDefault();
    if (!draggedPane) return;

    const { paneId, sourceSlot } = draggedPane;

    if (sourceSlot === 'floating') {
      setFloatingPanes(curr => curr.filter(p => p.id !== paneId));
    }

    setSlots(curr => {
      const updated = { ...curr };

      // 1. Remove paneId from source groups
      for (const sKey of ['left', 'right', 'bottom'] as const) {
        const s = updated[sKey];
        const remGroups = s.groups
          .map(g => {
            if (g.panes.includes(paneId)) {
              const rem = g.panes.filter(p => p !== paneId);
              return {
                ...g,
                panes: rem,
                activePaneId: g.activePaneId === paneId ? rem[0] || '' : g.activePaneId
              };
            }
            return g;
          })
          .filter(g => g.panes.length > 0);

        updated[sKey] = {
          ...s,
          groups: remGroups,
          visible: remGroups.length > 0 ? s.visible : false
        };
      }

      // 2. Add paneId to target slot/group
      const targetSlot = updated[slotId];
      const isSplitDrop = dragOverZone?.slotId === slotId && (
        dragOverZone.position === 'body-bottom' ||
        dragOverZone.position === 'body-top' ||
        dragOverZone.position === 'body-left' ||
        dragOverZone.position === 'body-right'
      );

      const splitDir: SplitDirection = (dragOverZone?.position === 'body-left' || dragOverZone?.position === 'body-right')
        ? 'horizontal'
        : 'vertical';

      if (isSplitDrop) {
        const newGroup: PaneGroup = {
          id: `g-${slotId}-${Date.now()}`,
          panes: [paneId],
          activePaneId: paneId
        };
        updated[slotId] = {
          ...targetSlot,
          groups: [...targetSlot.groups, newGroup],
          splitDirection: splitDir,
          visible: true
        };
      } else {
        let gList = targetSlot.groups;
        if (gList.length === 0) {
          gList = [{ id: `g-${slotId}-1`, panes: [paneId], activePaneId: paneId }];
        } else {
          const matchedGroupIdx = targetGroupId ? gList.findIndex(g => g.id === targetGroupId) : 0;
          const targetGroupIdx = matchedGroupIdx !== -1 ? matchedGroupIdx : 0;

          gList = gList.map((g, idx) => {
            if (idx === targetGroupIdx) {
              const filterPanes = g.panes.filter(p => p !== paneId);
              let insertIdx = filterPanes.length;
              if (dragOverIndex && dragOverIndex.slotId === slotId && dragOverIndex.groupId === g.id) {
                insertIdx = Math.min(dragOverIndex.index, filterPanes.length);
              }
              filterPanes.splice(insertIdx, 0, paneId);
              return {
                ...g,
                panes: filterPanes,
                activePaneId: paneId
              };
            }
            return g;
          });
        }

        updated[slotId] = {
          ...targetSlot,
          groups: gList,
          visible: true
        };
      }

      return updated;
    });

    handleDragEnd();
  };

  const setSlotVisibility = (slotId: 'left' | 'right' | 'bottom', visible: boolean) => {
    setSlots(curr => ({
      ...curr,
      [slotId]: { ...curr[slotId], visible }
    }));
  };

  const resetToDefault = () => {
    setSlots(DEFAULT_LAYOUT);
    setFloatingPanes([]);
  };

  return {
    slots,
    floatingPanes,
    draggedPane,
    dragOverSlot,
    dragOverIndex,
    dragOverZone,
    togglePaneVisibility,
    handleDragStart,
    handleDragOver,
    handleDragOverBody,
    handleDragOverTabBar,
    handleDragOverTab,
    handleDragEnd,
    handleDrop,
    unsplitSlot,
    splitGroup,
    floatPane,
    updateFloatingPanePosition,
    handleSelectTab,
    handleClosePane,
    handleCloseOtherPanesInGroup,
    handleCloseAllPanesInSlot,
    handleAddPaneToGroup,
    handleAddPaneToSlot,
    setSlotVisibility,
    setSlots,
    resetToDefault
  };
}
