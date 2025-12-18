
import { useEffect } from 'react';
import { Command, ProjectState, Position } from '../types';

export function useKeyboard(
  commands: Command[], 
  state: ProjectState, 
  updateState: (s: ProjectState) => void,
  projectActions: {
      deleteSelectedLayers: () => void;
      deleteSelectedFrames: () => void;
      handleMovePixels: (sel: Set<number>, offset: Position) => void;
  }
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      let key = e.key.toLowerCase();
      
      // Batch Delete Support
      if (key === 'delete' || key === 'backspace') {
          if (isInput) return;
          if (state.selectedLayerIds.length > 1) {
              e.preventDefault();
              projectActions.deleteSelectedLayers();
              return;
          }
          if (state.selectedFrameIndices.length > 1) {
              e.preventDefault();
              projectActions.deleteSelectedFrames();
              return;
          }
      }

      // Nudge Support for Move Tool
      if (state.tool === 'move' && state.selection && !isInput) {
          if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
              e.preventDefault();
              const offset = { x: 0, y: 0 };
              const amount = e.shiftKey ? 10 : 1;
              if (key === 'arrowup') offset.y = -amount;
              if (key === 'arrowdown') offset.y = amount;
              if (key === 'arrowleft') offset.x = -amount;
              if (key === 'arrowright') offset.x = amount;
              projectActions.handleMovePixels(state.selection, offset);
              return;
          }
      }

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('Control');
      if (e.metaKey) modifiers.push('Meta');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      
      for (const cmd of commands) {
          if (!cmd.keys) continue;
          
          const match = cmd.keys.some(k => {
             const parts = k.split('+').map(p => p.trim().toLowerCase());
             const mainKey = parts[parts.length - 1];
             const reqModifiers = parts.slice(0, parts.length - 1);
             
             if (mainKey !== e.key.toLowerCase()) return false;
             
             const hasCtrl = reqModifiers.includes('control') || reqModifiers.includes('ctrl');
             const hasMeta = reqModifiers.includes('meta') || reqModifiers.includes('cmd');
             const hasAlt = reqModifiers.includes('alt');
             const hasShift = reqModifiers.includes('shift');
             
             return (
                 e.ctrlKey === hasCtrl &&
                 e.metaKey === hasMeta &&
                 e.altKey === hasAlt &&
                 e.shiftKey === hasShift
             );
          });

          if (match) {
              if (isInput && !e.ctrlKey && !e.metaKey && e.key !== 'Escape' && !e.key.startsWith('F')) {
                  continue; 
              }
              e.preventDefault();
              cmd.perform();
              return;
          }
      }

      // Selection Modes (Handled by handleKeyUp too)
      if (e.shiftKey && e.ctrlKey) updateState({...state, selectionMode: 'intersect'});
      else if (e.shiftKey && e.altKey) updateState({...state, selectionMode: 'subtract'});
      else if (e.shiftKey) updateState({...state, selectionMode: 'add'});
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') {
         updateState({...state, selectionMode: 'replace'});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state, commands, updateState, projectActions]);
}
