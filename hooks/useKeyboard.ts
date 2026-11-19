
import { useEffect, useRef } from 'react';
import { Command, ProjectState, Position, SelectionMode } from '../types';

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
  const commandsRef = useRef(commands);
  const stateRef = useRef(state);
  const updateStateRef = useRef(updateState);
  const projectActionsRef = useRef(projectActions);

  commandsRef.current = commands;
  stateRef.current = state;
  updateStateRef.current = updateState;
  projectActionsRef.current = projectActions;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const curState = stateRef.current;
      const curActions = projectActionsRef.current;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const key = e.key.toLowerCase();
      
      // Batch Delete Support
      if (key === 'delete' || key === 'backspace') {
          if (isInput) return;
          if (curState.selectedLayerIds.length > 1) {
              e.preventDefault();
              curActions.deleteSelectedLayers();
              return;
          }
          if (curState.selectedFrameIndices.length > 1) {
              e.preventDefault();
              curActions.deleteSelectedFrames();
              return;
          }
      }

      // Nudge Support for Move Tool
      if (curState.tool === 'move' && curState.selection && !isInput) {
          if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
              e.preventDefault();
              const offset = { x: 0, y: 0 };
              const amount = e.shiftKey ? 10 : 1;
              if (key === 'arrowup') offset.y = -amount;
              if (key === 'arrowdown') offset.y = amount;
              if (key === 'arrowleft') offset.x = -amount;
              if (key === 'arrowright') offset.x = amount;
              curActions.handleMovePixels(curState.selection, offset);
              return;
          }
      }
      
      for (const cmd of commandsRef.current) {
          if (!cmd.keys) continue;
          
          const match = cmd.keys.some(k => {
             const parts = k.split('+').map(p => p.trim().toLowerCase());
             const mainKey = parts[parts.length - 1];
             const reqModifiers = parts.slice(0, parts.length - 1);
             
             if (mainKey !== key) return false;
             
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

      // Selection Modes (Handled by handleKeyUp too) - only update on actual transition
      let nextSelectionMode: SelectionMode | null = null;
      if (e.shiftKey && e.ctrlKey) nextSelectionMode = 'intersect';
      else if (e.shiftKey && e.altKey) nextSelectionMode = 'subtract';
      else if (e.shiftKey) nextSelectionMode = 'add';

      if (nextSelectionMode && curState.selectionMode !== nextSelectionMode) {
        updateStateRef.current({ ...curState, selectionMode: nextSelectionMode });
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') {
        const curState = stateRef.current;
        if (curState.selectionMode !== 'replace') {
          updateStateRef.current({ ...curState, selectionMode: 'replace' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}
