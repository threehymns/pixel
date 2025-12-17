
import { useMemo } from 'react';
import { Command, ProjectState, ToolType } from '../types';

interface UseAppCommandsProps {
    state: ProjectState;
    updateState: (s: ProjectState, historyConfig?: { action: string, tool?: ToolType }) => void;
    projectActions: {
        undo: () => void;
        redo: () => void;
        canUndo: boolean;
        canRedo: boolean;
        addLayer: () => void;
        addFrame: () => void;
        duplicateFrame: () => void;
        downloadImage: () => void;
        saveProject: () => void;
        saveProjectAs: () => void;
        createProject: () => void;
        closeProject: (id: string) => void;
        switchTab: (dir: 'next' | 'prev') => void;
    };
    fileSystemActions: {
        openFolder: () => void;
    };
    uiActions: {
        toggleFileTree: () => void;
    };
    openCmdPalette: () => void;
    onOpenProject: () => void; // Trigger for the hidden file input
}

export function useAppCommands({ 
    state, 
    updateState, 
    projectActions, 
    fileSystemActions,
    uiActions,
    openCmdPalette, 
    onOpenProject 
}: UseAppCommandsProps) {
    return useMemo<Command[]>(() => [
        { 
            id: 'file.new', label: 'New Project', category: 'File', hotkey: 'Alt+T', keys: ['Alt+t'], 
            perform: projectActions.createProject
        },
        { 
            id: 'file.open', label: 'Open File...', category: 'File', hotkey: 'Ctrl+O', keys: ['Control+o', 'Meta+o'],
            perform: onOpenProject
        },
        {
            id: 'file.openFolder', label: 'Open Folder...', category: 'File', hotkey: 'Ctrl+Shift+O', keys: ['Control+Shift+O', 'Meta+Shift+O'],
            perform: () => {
                uiActions.toggleFileTree(); // Ensure visible
                fileSystemActions.openFolder();
            }
        },
        { 
            id: 'file.save', label: 'Save Project', category: 'File', hotkey: 'Ctrl+S', keys: ['Control+s', 'Meta+s'],
            perform: projectActions.saveProject 
        },
        { 
            id: 'file.saveAs', label: 'Save As...', category: 'File', hotkey: 'Ctrl+Shift+S', keys: ['Control+Shift+S', 'Meta+Shift+S'],
            perform: projectActions.saveProjectAs
        },
        { 
            id: 'file.close', label: 'Close Project', category: 'File', hotkey: 'Alt+W', keys: ['Alt+w'], 
            perform: () => projectActions.closeProject(state.id) 
        },
        { 
            id: 'file.export', label: 'Export PNG', category: 'File', hotkey: 'Shift+E', 
            perform: projectActions.downloadImage 
        },
        { 
            id: 'view.nextTab', label: 'Next Tab', category: 'View', hotkey: 'Ctrl+Tab', keys: ['Control+Tab'], 
            perform: () => projectActions.switchTab('next') 
        },
        { 
            id: 'view.prevTab', label: 'Previous Tab', category: 'View', hotkey: 'Ctrl+Shift+Tab', keys: ['Control+Shift+Tab'], 
            perform: () => projectActions.switchTab('prev') 
        },
        {
            id: 'view.fileTree', label: 'Toggle File Tree', category: 'View', hotkey: 'Ctrl+B', keys: ['Control+b', 'Meta+b'],
            perform: uiActions.toggleFileTree
        },
        { 
            id: 'edit.undo', label: 'Undo', category: 'Edit', hotkey: 'Ctrl+Z', keys: ['Control+z', 'Meta+z'],
            perform: projectActions.undo, disabled: !projectActions.canUndo
        },
        { 
            id: 'edit.redo', label: 'Redo', category: 'Edit', hotkey: 'Ctrl+Y', keys: ['Control+y', 'Meta+y', 'Control+Shift+z', 'Meta+Shift+z'],
            perform: projectActions.redo, disabled: !projectActions.canRedo
        },
        { 
            id: 'select.all', label: 'Select All', category: 'Select', hotkey: 'Ctrl+A', keys: ['Control+a', 'Meta+a'],
            perform: () => {
                const all = new Set<number>();
                for(let i=0; i<state.width*state.height; i++) all.add(i);
                updateState({...state, selection: all}, { action: 'Select All' });
            }
        },
        { 
            id: 'select.none', label: 'Deselect', category: 'Select', hotkey: 'Ctrl+D', keys: ['Control+d', 'Meta+d'],
            perform: () => updateState({...state, selection: null}, { action: 'Deselect' }) 
        },
        { 
            id: 'view.grid', label: 'Toggle Grid', category: 'View', hotkey: 'Shift+G', keys: ['Shift+G'],
            perform: () => updateState({...state, showGrid: !state.showGrid}) 
        },
        { 
            id: 'view.onion', label: 'Toggle Onion Skin', category: 'View', hotkey: 'Shift+O', keys: ['Shift+O'],
            perform: () => updateState({...state, onionSkin: !state.onionSkin}) 
        },
        { 
            id: 'layer.new', label: 'New Layer', category: 'Layer', hotkey: 'Shift+N', keys: ['Shift+N'],
            perform: projectActions.addLayer 
        },
        { 
            id: 'frame.new', label: 'New Frame', category: 'Sprite', hotkey: 'Alt+N', keys: ['Alt+n'],
            perform: projectActions.addFrame 
        },
        { 
            id: 'frame.duplicate', label: 'Duplicate Frame', category: 'Sprite', hotkey: 'Alt+D', keys: ['Alt+d'],
            perform: projectActions.duplicateFrame 
        },
        { 
          id: 'tool.pencil', label: 'Pencil Tool', category: 'Edit', hotkey: 'B', keys: ['b'],
          perform: () => updateState({ ...state, tool: 'pencil' })
        },
        { 
          id: 'tool.eraser', label: 'Eraser Tool', category: 'Edit', hotkey: 'E', keys: ['e'],
          perform: () => updateState({ ...state, tool: 'eraser' })
        },
        { 
          id: 'tool.fill', label: 'Fill Bucket', category: 'Edit', hotkey: 'G', keys: ['g'],
          perform: () => updateState({ ...state, tool: 'bucket' })
        },
        { 
          id: 'tool.picker', label: 'Color Picker', category: 'Edit', hotkey: 'I', keys: ['i'],
          perform: () => updateState({ ...state, tool: 'eyedropper' })
        },
        { 
          id: 'tool.move', label: 'Move Tool', category: 'Edit', hotkey: 'V', keys: ['v'],
          perform: () => updateState({ ...state, tool: 'move' })
        },
        { 
          id: 'tool.select.rect', label: 'Rectangle Select', category: 'Select', hotkey: 'M', keys: ['m'],
          perform: () => updateState({ ...state, tool: 'rect-select' })
        },
        { 
          id: 'tool.select.lasso', label: 'Lasso Select', category: 'Select', hotkey: 'L', keys: ['l'],
          perform: () => updateState({ ...state, tool: 'lasso-select' })
        },
        { 
          id: 'tool.select.wand', label: 'Magic Wand', category: 'Select', hotkey: 'W', keys: ['w'],
          perform: () => updateState({ ...state, tool: 'magic-wand' })
        },
        {
          id: 'app.commandPalette', label: 'Command Palette', category: 'View', hotkey: 'Ctrl+P', keys: ['Control+p', 'Meta+p', 'F1'],
          perform: openCmdPalette
        }
    ], [state, updateState, projectActions, fileSystemActions, uiActions, openCmdPalette, onOpenProject]);
}
