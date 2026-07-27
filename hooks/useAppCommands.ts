
import { useMemo, useRef } from 'react';
import { Command, ProjectState, ToolType, ColorMode } from '../types';

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
        tweenFrames: () => void;
        downloadImage: () => void;
        downloadSpriteSheet: () => void;
        downloadGif?: () => void;
        openExportDialog?: (format?: any) => void;
        saveProject: () => void;
        saveProjectAs: () => void;
        createProject: () => void;
        closeProject: (id: string) => void;
        switchTab: (dir: 'next' | 'prev') => void;
        setColorMode: (mode: ColorMode) => void;
        openResizeDialog: () => void;
        openReferenceImageDialog: () => void;
        flipPixels: (axis: 'h' | 'v') => void;
        clearSelection: () => void;
        cropCanvas: () => void;
        centerContent: () => void;
        generateOutline: () => void;
        strokeSelection: () => void;
    };
    fileSystemActions: {
        openFolder: () => void;
    };
    uiActions: {
        toggleFileTree: () => void;
        togglePalette: () => void;
        toggleTimeline: () => void;
        toggleRightPanel: () => void;
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
    const lastRectTool = useRef<ToolType>('rect');
    const lastEllipseTool = useRef<ToolType>('ellipse');

    return useMemo<Command[]>(() => [
        { 
            id: 'file.new', label: 'New Project...', category: 'File', hotkey: 'Alt+T', keys: ['Alt+t'], 
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
            id: 'file.export', label: 'Export Frame (PNG)', category: 'File', hotkey: 'Shift+E', 
            perform: projectActions.downloadImage 
        },
        { 
            id: 'file.exportGif', label: 'Export Animated GIF...', category: 'File', hotkey: 'Ctrl+E', keys: ['Control+e', 'Meta+e'],
            perform: () => projectActions.downloadGif ? projectActions.downloadGif() : projectActions.downloadImage()
        },
        { 
            id: 'file.exportSpritesheet', label: 'Export Sprite Sheet...', category: 'File', 
            perform: projectActions.downloadSpriteSheet 
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
            id: 'view.palette', label: 'Toggle Palette', category: 'View',
            perform: uiActions.togglePalette
        },
        {
            id: 'view.layersHistory', label: 'Toggle Layers/History', category: 'View',
            perform: uiActions.toggleRightPanel
        },
        {
            id: 'view.timeline', label: 'Toggle Timeline', category: 'View',
            perform: uiActions.toggleTimeline
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
            id: 'edit.flipH', label: 'Flip Horizontal', category: 'Edit', hotkey: 'Shift+H', keys: ['Shift+h'],
            perform: () => projectActions.flipPixels('h')
        },
        { 
            id: 'edit.flipV', label: 'Flip Vertical', category: 'Edit', hotkey: 'Shift+V', keys: ['Shift+v'],
            perform: () => projectActions.flipPixels('v')
        },
        { 
            id: 'edit.clearEdit', label: 'Clear Selection', category: 'Edit', hotkey: 'Del', keys: ['Backspace', 'Delete'],
            perform: projectActions.clearSelection,
            disabled: !state.selection || state.selection.size === 0
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
            id: 'select.invert', label: 'Invert Selection', category: 'Select', hotkey: 'Ctrl+Shift+I', keys: ['Control+I', 'Meta+I'],
            perform: () => {
                const newSel = new Set<number>();
                for(let i=0; i<state.width*state.height; i++) {
                    if (!state.selection?.has(i)) newSel.add(i);
                }
                updateState({...state, selection: newSel}, { action: 'Invert Selection' });
            }
        },
        {
            id: 'select.stroke', label: 'Stroke Selection', category: 'Select',
            perform: () => projectActions.strokeSelection(),
            disabled: !state.selection || state.selection.size === 0
        },
        { 
            id: 'view.grid', label: 'Toggle Grid', category: 'View', hotkey: 'Shift+G', keys: ['Shift+G'],
            perform: () => updateState({...state, showGrid: !state.showGrid}),
            checked: state.showGrid
        },
        { 
            id: 'view.onion', label: 'Toggle Onion Skin', category: 'View', hotkey: 'Shift+O', keys: ['Shift+O'],
            perform: () => updateState({...state, onionSkin: !state.onionSkin}),
            checked: state.onionSkin
        },
        { 
            id: 'view.tiled', label: 'Tiled View', category: 'View', hotkey: 'T', keys: ['t'],
            perform: () => updateState({...state, tiled: !state.tiled}),
            checked: state.tiled
        },
        { 
            id: 'view.referenceImage', label: 'Reference Image...', category: 'View', hotkey: 'Alt+R', keys: ['Alt+r'],
            perform: projectActions.openReferenceImageDialog
        },
        { 
            id: 'layer.new', label: 'New Layer', category: 'Layer', hotkey: 'Shift+N', keys: ['Shift+N'],
            perform: projectActions.addLayer 
        },
        { 
            id: 'layer.centerContent', label: 'Center Content', category: 'Layer',
            perform: () => projectActions.centerContent()
        },
        { 
            id: 'layer.generateOutline', label: 'Generate Outline', category: 'Layer',
            perform: () => projectActions.generateOutline()
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
            id: 'sprite.tween', label: 'Interpolate (Tween)', category: 'Sprite', hotkey: 'Alt+I', keys: ['Alt+i'],
            perform: projectActions.tweenFrames 
        },
        { 
            id: 'sprite.dithering', label: 'Toggle Dithering', category: 'Sprite', 
            perform: () => updateState({...state, ditheringEnabled: !state.ditheringEnabled}),
            checked: state.ditheringEnabled
        },
        { 
            id: 'sprite.modeIndexed', label: 'Color Mode: Indexed', category: 'Sprite', 
            perform: () => projectActions.setColorMode('indexed'),
            disabled: state.colorMode === 'indexed'
        },
        { 
            id: 'sprite.modeRGBA', label: 'Color Mode: RGBA', category: 'Sprite', 
            perform: () => projectActions.setColorMode('rgba'),
            disabled: state.colorMode === 'rgba'
        },
        {
            id: 'sprite.resize', label: 'Canvas Size...', category: 'Sprite', hotkey: 'Alt+C', keys: ['Alt+c'],
            perform: projectActions.openResizeDialog
        },
        {
            id: 'sprite.crop', label: 'Crop to Selection', category: 'Sprite',
            perform: projectActions.cropCanvas,
            disabled: !state.selection || state.selection.size === 0
        },
        { 
          id: 'tool.pencil', label: 'Pencil Tool', category: 'Edit', hotkey: 'B', keys: ['b'],
          perform: () => updateState({ ...state, tool: 'pencil' })
        },
        { 
          id: 'tool.line', label: 'Line Tool', category: 'Edit', hotkey: 'L', keys: ['l'],
          perform: () => updateState({ ...state, tool: 'line' })
        },
        { 
          id: 'tool.rect_toggle', label: 'Rectangle Tool', category: 'Edit', hotkey: 'U', keys: ['u'],
          perform: () => {
            if (state.tool === 'rect') {
                lastRectTool.current = 'filled-rect';
                updateState({ ...state, tool: 'filled-rect' });
            } else if (state.tool === 'filled-rect') {
                lastRectTool.current = 'rect';
                updateState({ ...state, tool: 'rect' });
            } else {
                updateState({ ...state, tool: lastRectTool.current });
            }
          }
        },
        { 
          id: 'tool.ellipse_toggle', label: 'Ellipse Tool', category: 'Edit', hotkey: 'Shift+U', keys: ['Shift+U'],
          perform: () => {
            if (state.tool === 'ellipse') {
                lastEllipseTool.current = 'filled-ellipse';
                updateState({ ...state, tool: 'filled-ellipse' });
            } else if (state.tool === 'filled-ellipse') {
                lastEllipseTool.current = 'ellipse';
                updateState({ ...state, tool: 'ellipse' });
            } else {
                updateState({ ...state, tool: lastEllipseTool.current });
            }
          }
        },
        { 
          id: 'tool.smudge', label: 'Smudge/Push Tool', category: 'Edit', hotkey: 'S', keys: ['s'],
          perform: () => updateState({ ...state, tool: 'smudge' })
        },
        { 
          id: 'tool.blur', label: 'Blur Tool', category: 'Edit', hotkey: 'R', keys: ['r'],
          perform: () => updateState({ ...state, tool: 'blur' })
        },
        { 
          id: 'tool.sharpen', label: 'Sharpen Tool', category: 'Edit', hotkey: 'Shift+R', keys: ['Shift+R'],
          perform: () => updateState({ ...state, tool: 'sharpen' })
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
          id: 'tool.color_replace', label: 'Color Replace Tool', category: 'Edit',
          perform: () => updateState({ ...state, tool: 'color-replace' })
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
          id: 'tool.select.lasso', label: 'Lasso Select', category: 'Select', hotkey: 'Q', keys: ['q'],
          perform: () => updateState({ ...state, tool: 'lasso-select' })
        },
        { 
          id: 'tool.select.wand', label: 'Magic Wand', category: 'Select', hotkey: 'W', keys: ['w'],
          perform: () => updateState({ ...state, tool: 'magic-wand' })
        },
        {
          id: 'tool.brushSize.increase', label: 'Increase Brush Size', category: 'Edit', hotkey: ']', keys: [']'],
          perform: () => updateState({ ...state, brushSize: Math.min(64, state.brushSize + 1) })
        },
        {
          id: 'tool.brushSize.decrease', label: 'Decrease Brush Size', category: 'Edit', hotkey: '[', keys: ['['],
          perform: () => updateState({ ...state, brushSize: Math.max(1, state.brushSize - 1) })
        },
        {
          id: 'view.zoomIn', label: 'Zoom In', category: 'View', hotkey: 'Ctrl++', keys: ['Control+=', 'Meta+='],
          perform: () => updateState({ ...state, zoom: Math.min(128, state.zoom * 2) })
        },
        {
          id: 'view.zoomOut', label: 'Zoom Out', category: 'View', hotkey: 'Ctrl+-', keys: ['Control+-', 'Meta+-'],
          perform: () => updateState({ ...state, zoom: Math.max(1, state.zoom / 2) })
        },
        {
          id: 'app.commandPalette', label: 'Command Palette', category: 'View', hotkey: 'Ctrl+P', keys: ['Control+p', 'Meta+p', 'F1'],
          perform: openCmdPalette
        }
    ], [state, updateState, projectActions, fileSystemActions, uiActions, openCmdPalette, onOpenProject]);
}
