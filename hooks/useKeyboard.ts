import { useEffect } from 'react';
import { Command, ProjectState } from '../types';

export function useKeyboard(
  commands: Command[], 
  state: ProjectState, 
  updateState: (s: ProjectState) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      let key = e.key.toLowerCase();
      if (key === 'escape') key = 'escape';
      
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

      // Selection Modes
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
  }, [state, commands, updateState]);
}