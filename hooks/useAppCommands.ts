
import { useLayoutEffect, useRef } from 'react';
import { Command, ProjectState, ToolType, ColorMode, FrameTag, Layer } from '../types';
import { MIN_BRUSH_SIZE, MAX_BRUSH_SIZE, MIN_ZOOM, MAX_ZOOM } from '../constants';
import { SelectionMask } from '../utils';

interface UseAppCommandsProps {
    state: ProjectState;
    updateState: (s: ProjectState, historyConfig?: { action: string, tool?: ToolType }) => void;
    projectActions: {
        undo: () => void;
        redo: () => void;
        canUndo: boolean;
        canRedo: boolean;
        addLayer: () => void;
        addGroupLayer?: () => void;
        groupSelectedLayers?: () => void;
        ungroupSelectedLayers?: () => void;
        toggleCollapseAllGroups?: () => void;
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
        openSpritePropertiesDialog?: () => void;
        openSlicesDialog?: () => void;
        openTagPropertiesDialog?: (tag?: FrameTag) => void;
        openLayerPropertiesDialog?: (layer?: Layer) => void;
        flipPixels: (axis: 'h' | 'v') => void;
        clearSelection: () => void;
        cropCanvas: () => void;
        centerContent: () => void;
        generateOutline: () => void;
        openOutlineDialog?: () => void;
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
    onOpenProject: () => void;
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

    const latestRef = useRef({
        state,
        updateState,
        projectActions,
        fileSystemActions,
        uiActions,
        openCmdPalette,
        onOpenProject,
    });
    useLayoutEffect(() => {
        latestRef.current = {
            state,
            updateState,
            projectActions,
            fileSystemActions,
            uiActions,
            openCmdPalette,
            onOpenProject,
        };
    });

    const canUndo = projectActions.canUndo;
    const canRedo = projectActions.canRedo;
    const hasSelection = Boolean(state.selection && state.selection.size > 0);
    const { showGrid, onionSkin, tiled, ditheringEnabled, colorMode } = state;

    const commands: Command[] = [
        { 
            id: 'file.new', label: 'New Project...', category: 'File', hotkey: 'Alt+T', keys: ['Alt+t'], 
            perform: () => latestRef.current.projectActions.createProject()
        },
        { 
            id: 'file.open', label: 'Open File...', category: 'File', hotkey: 'Ctrl+O', keys: ['Control+o', 'Meta+o'],
            perform: () => latestRef.current.onOpenProject()
        },
        {
            id: 'file.openFolder', label: 'Open Folder...', category: 'File', hotkey: 'Ctrl+Shift+O', keys: ['Control+Shift+O', 'Meta+Shift+O'],
            perform: () => {
                latestRef.current.uiActions.toggleFileTree();
                latestRef.current.fileSystemActions.openFolder();
            }
        },
        { 
            id: 'file.save', label: 'Save Project', category: 'File', hotkey: 'Ctrl+S', keys: ['Control+s', 'Meta+s'],
            perform: () => latestRef.current.projectActions.saveProject()
        },
        { 
            id: 'file.saveAs', label: 'Save As...', category: 'File', hotkey: 'Ctrl+Shift+S', keys: ['Control+Shift+S', 'Meta+Shift+S'],
            perform: () => latestRef.current.projectActions.saveProjectAs()
        },
        { 
            id: 'file.close', label: 'Close Project', category: 'File', hotkey: 'Alt+W', keys: ['Alt+w'], 
            perform: () => latestRef.current.projectActions.closeProject(latestRef.current.state.id)
        },
        { 
            id: 'file.export', label: 'Export Frame (PNG)...', category: 'File', hotkey: 'Shift+E', 
            perform: () => latestRef.current.projectActions.downloadImage()
        },
        { 
            id: 'file.exportGif', label: 'Export Animated GIF...', category: 'File', hotkey: 'Ctrl+E', keys: ['Control+e', 'Meta+e'],
            perform: () => {
                const pa = latestRef.current.projectActions;
                if (pa.downloadGif) pa.downloadGif();
                else pa.downloadImage();
            }
        },
        { 
            id: 'file.exportSpritesheet', label: 'Export Sprite Sheet...', category: 'File', 
            perform: () => latestRef.current.projectActions.downloadSpriteSheet()
        },
        { 
            id: 'view.nextTab', label: 'Next Tab', category: 'View', hotkey: 'Ctrl+Tab', keys: ['Control+Tab'], 
            perform: () => latestRef.current.projectActions.switchTab('next')
        },
        { 
            id: 'view.prevTab', label: 'Previous Tab', category: 'View', hotkey: 'Ctrl+Shift+Tab', keys: ['Control+Shift+Tab'], 
            perform: () => latestRef.current.projectActions.switchTab('prev')
        },
        {
            id: 'view.fileTree', label: 'Toggle File Tree', category: 'View', hotkey: 'Ctrl+B', keys: ['Control+b', 'Meta+b'],
            perform: () => latestRef.current.uiActions.toggleFileTree()
        },
        {
            id: 'view.palette', label: 'Toggle Palette', category: 'View',
            perform: () => latestRef.current.uiActions.togglePalette()
        },
        {
            id: 'view.layersHistory', label: 'Toggle Layers & History', category: 'View',
            perform: () => latestRef.current.uiActions.toggleRightPanel()
        },
        {
            id: 'view.timeline', label: 'Toggle Timeline', category: 'View',
            perform: () => latestRef.current.uiActions.toggleTimeline()
        },
        { 
            id: 'edit.undo', label: 'Undo', category: 'Edit', hotkey: 'Ctrl+Z', keys: ['Control+z', 'Meta+z'],
            perform: () => latestRef.current.projectActions.undo(), disabled: !canUndo
        },
        { 
            id: 'edit.redo', label: 'Redo', category: 'Edit', hotkey: 'Ctrl+Y', keys: ['Control+y', 'Meta+y', 'Control+Shift+z', 'Meta+Shift+z'],
            perform: () => latestRef.current.projectActions.redo(), disabled: !canRedo
        },
        { 
            id: 'edit.flipH', label: 'Flip Horizontal', category: 'Edit', hotkey: 'Shift+H', keys: ['Shift+h'],
            perform: () => latestRef.current.projectActions.flipPixels('h')
        },
        { 
            id: 'edit.flipV', label: 'Flip Vertical', category: 'Edit', hotkey: 'Shift+V', keys: ['Shift+v'],
            perform: () => latestRef.current.projectActions.flipPixels('v')
        },
        { 
            id: 'edit.clearEdit', label: 'Clear Selection', category: 'Edit', hotkey: 'Del', keys: ['Backspace', 'Delete'],
            perform: () => latestRef.current.projectActions.clearSelection(),
            disabled: !hasSelection
        },
        {
            id: 'fx.outline', label: 'Outline...', category: 'Edit', hotkey: 'Shift+O', keys: ['Shift+o', 'Shift+O'],
            perform: () => {
                const pa = latestRef.current.projectActions;
                if (pa.openOutlineDialog) pa.openOutlineDialog();
                else pa.generateOutline();
            }
        },
        { 
            id: 'select.all', label: 'Select All', category: 'Select', hotkey: 'Ctrl+A', keys: ['Control+a', 'Meta+a'],
            perform: () => {
                const s = latestRef.current.state;
                const all = SelectionMask.full(s.width, s.height);
                latestRef.current.updateState({ ...s, selection: all }, { action: 'Select All' });
            }
        },
        { 
            id: 'select.none', label: 'Deselect', category: 'Select', hotkey: 'Ctrl+D', keys: ['Control+d', 'Meta+d'],
            perform: () => latestRef.current.updateState({ ...latestRef.current.state, selection: null }, { action: 'Deselect' }) 
        },
        { 
            id: 'select.invert', label: 'Invert Selection', category: 'Select', hotkey: 'Ctrl+Shift+I', keys: ['Control+I', 'Meta+I'],
            perform: () => {
                const s = latestRef.current.state;
                const nextSel = s.selection
                  ? s.selection.invert()
                  : SelectionMask.full(s.width, s.height);
                latestRef.current.updateState({ ...s, selection: nextSel.size > 0 ? nextSel : null }, { action: 'Invert Selection' });
            }
        },
        {
            id: 'select.stroke', label: 'Stroke Selection', category: 'Select',
            perform: () => latestRef.current.projectActions.strokeSelection(),
            disabled: !hasSelection
        },
        { 
            id: 'view.grid', label: 'Toggle Grid', category: 'View', hotkey: 'Shift+G', keys: ['Shift+G'],
            perform: () => {
                const s = latestRef.current.state;
                latestRef.current.updateState({ ...s, showGrid: !s.showGrid });
            },
            checked: showGrid
        },
        { 
            id: 'view.onion', label: 'Toggle Onion Skin', category: 'View', hotkey: 'Alt+O', keys: ['Alt+o', 'Alt+O'],
            perform: () => {
                const s = latestRef.current.state;
                latestRef.current.updateState({ ...s, onionSkin: !s.onionSkin });
            },
            checked: onionSkin
        },
        { 
            id: 'view.tiled', label: 'Tiled View', category: 'View', hotkey: 'T', keys: ['t'],
            perform: () => {
                const s = latestRef.current.state;
                latestRef.current.updateState({ ...s, tiled: !s.tiled });
            },
            checked: tiled
        },
        { 
            id: 'view.referenceImage', label: 'Reference Image...', category: 'View', hotkey: 'Alt+R', keys: ['Alt+r'],
            perform: () => latestRef.current.projectActions.openReferenceImageDialog()
        },
        { 
            id: 'layer.new', label: 'New Layer', category: 'Layer', hotkey: 'Shift+N', keys: ['Shift+N'],
            perform: () => latestRef.current.projectActions.addLayer()
        },
        { 
            id: 'layer.newGroup', label: 'New Layer Group', category: 'Layer',
            perform: () => latestRef.current.projectActions.addGroupLayer?.()
        },
        { 
            id: 'layer.groupSelected', label: 'Group Selected Layers', category: 'Layer', hotkey: 'Ctrl+G', keys: ['Control+g', 'Meta+g'],
            perform: () => latestRef.current.projectActions.groupSelectedLayers?.()
        },
        { 
            id: 'layer.ungroupSelected', label: 'Ungroup Layers', category: 'Layer', hotkey: 'Ctrl+Shift+G', keys: ['Control+Shift+G', 'Meta+Shift+G'],
            perform: () => latestRef.current.projectActions.ungroupSelectedLayers?.()
        },
        { 
            id: 'layer.toggleCollapseAll', label: 'Collapse / Expand All Groups', category: 'Layer',
            perform: () => latestRef.current.projectActions.toggleCollapseAllGroups?.()
        },
        { 
            id: 'layer.centerContent', label: 'Center Content', category: 'Layer',
            perform: () => latestRef.current.projectActions.centerContent()
        },
        {
            id: 'layer.properties', label: 'Layer Properties...', category: 'Layer',
            perform: () => latestRef.current.projectActions.openLayerPropertiesDialog?.()
        },
        { 
            id: 'frame.new', label: 'New Frame', category: 'Sprite', hotkey: 'Alt+N', keys: ['Alt+n'],
            perform: () => latestRef.current.projectActions.addFrame()
        },
        { 
            id: 'frame.duplicate', label: 'Duplicate Frame', category: 'Sprite', hotkey: 'Alt+D', keys: ['Alt+d'],
            perform: () => latestRef.current.projectActions.duplicateFrame()
        },
        { 
            id: 'sprite.tween', label: 'Interpolate (Tween)', category: 'Sprite', hotkey: 'Alt+I', keys: ['Alt+i'],
            perform: () => latestRef.current.projectActions.tweenFrames()
        },
        { 
            id: 'sprite.dithering', label: 'Toggle Dithering', category: 'Sprite', 
            perform: () => {
                const s = latestRef.current.state;
                latestRef.current.updateState({ ...s, ditheringEnabled: !s.ditheringEnabled });
            },
            checked: ditheringEnabled
        },
        { 
            id: 'sprite.modeIndexed', label: 'Color Mode: Indexed', category: 'Sprite', 
            perform: () => latestRef.current.projectActions.setColorMode('indexed'),
            checked: colorMode === 'indexed'
        },
        { 
            id: 'sprite.modeRGBA', label: 'Color Mode: RGBA', category: 'Sprite', 
            perform: () => latestRef.current.projectActions.setColorMode('rgba'),
            checked: colorMode === 'rgba'
        },
        {
            id: 'sprite.resize', label: 'Canvas Size...', category: 'Sprite', hotkey: 'Alt+C', keys: ['Alt+c'],
            perform: () => latestRef.current.projectActions.openResizeDialog()
        },
        {
            id: 'sprite.properties', label: 'Sprite Properties...', category: 'Sprite',
            perform: () => latestRef.current.projectActions.openSpritePropertiesDialog?.()
        },
        {
            id: 'sprite.slices', label: 'Slice Manager...', category: 'Sprite',
            perform: () => latestRef.current.projectActions.openSlicesDialog?.()
        },
        {
            id: 'sprite.newTag', label: 'New Animation Tag...', category: 'Sprite',
            perform: () => latestRef.current.projectActions.openTagPropertiesDialog?.()
        },
        {
            id: 'sprite.crop', label: 'Crop to Selection', category: 'Sprite',
            perform: () => latestRef.current.projectActions.cropCanvas(),
            disabled: !hasSelection
        },
        { 
          id: 'tool.pencil', label: 'Pencil Tool', category: 'Tools', hotkey: 'B', keys: ['b'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'pencil' })
        },
        { 
          id: 'tool.line', label: 'Line Tool', category: 'Tools', hotkey: 'L', keys: ['l'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'line' })
        },
        { 
          id: 'tool.rect_toggle', label: 'Rectangle Tool', category: 'Tools', hotkey: 'U', keys: ['u'],
          perform: () => {
            const s = latestRef.current.state;
            if (s.tool === 'rect') {
                lastRectTool.current = 'filled-rect';
                latestRef.current.updateState({ ...s, tool: 'filled-rect' });
            } else if (s.tool === 'filled-rect') {
                lastRectTool.current = 'rect';
                latestRef.current.updateState({ ...s, tool: 'rect' });
            } else {
                latestRef.current.updateState({ ...s, tool: lastRectTool.current });
            }
          }
        },
        { 
          id: 'tool.ellipse_toggle', label: 'Ellipse Tool', category: 'Tools', hotkey: 'Shift+U', keys: ['Shift+U'],
          perform: () => {
            const s = latestRef.current.state;
            if (s.tool === 'ellipse') {
                lastEllipseTool.current = 'filled-ellipse';
                latestRef.current.updateState({ ...s, tool: 'filled-ellipse' });
            } else if (s.tool === 'filled-ellipse') {
                lastEllipseTool.current = 'ellipse';
                latestRef.current.updateState({ ...s, tool: 'ellipse' });
            } else {
                latestRef.current.updateState({ ...s, tool: lastEllipseTool.current });
            }
          }
        },
        { 
          id: 'tool.smudge', label: 'Smudge / Push Tool', category: 'Tools', hotkey: 'S', keys: ['s'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'smudge' })
        },
        { 
          id: 'tool.blur', label: 'Blur Tool', category: 'Tools', hotkey: 'R', keys: ['r'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'blur' })
        },
        { 
          id: 'tool.sharpen', label: 'Sharpen Tool', category: 'Tools', hotkey: 'Shift+R', keys: ['Shift+R'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'sharpen' })
        },
        { 
          id: 'tool.eraser', label: 'Eraser Tool', category: 'Tools', hotkey: 'E', keys: ['e'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'eraser' })
        },
        { 
          id: 'tool.fill', label: 'Fill Bucket', category: 'Tools', hotkey: 'G', keys: ['g'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'bucket' })
        },
        {
          id: 'tool.color_replace', label: 'Color Replace Tool', category: 'Tools',
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'color-replace' })
        },
        { 
          id: 'tool.picker', label: 'Color Picker', category: 'Tools', hotkey: 'I', keys: ['i'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'eyedropper' })
        },
        { 
          id: 'tool.move', label: 'Move Tool', category: 'Tools', hotkey: 'V', keys: ['v'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'move' })
        },
        { 
          id: 'tool.select.rect', label: 'Rectangle Select', category: 'Select', hotkey: 'M', keys: ['m'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'rect-select' })
        },
        { 
          id: 'tool.select.lasso', label: 'Lasso Select', category: 'Select', hotkey: 'Q', keys: ['q'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'lasso-select' })
        },
        { 
          id: 'tool.select.wand', label: 'Magic Wand', category: 'Select', hotkey: 'W', keys: ['w'],
          perform: () => latestRef.current.updateState({ ...latestRef.current.state, tool: 'magic-wand' })
        },
        {
          id: 'tool.brushSize.increase', label: 'Increase Brush Size', category: 'Tools', hotkey: ']', keys: [']'],
          perform: () => {
            const s = latestRef.current.state;
            latestRef.current.updateState({ ...s, brushSize: Math.min(MAX_BRUSH_SIZE, s.brushSize + 1) });
          }
        },
        {
          id: 'tool.brushSize.decrease', label: 'Decrease Brush Size', category: 'Tools', hotkey: '[', keys: ['['],
          perform: () => {
            const s = latestRef.current.state;
            latestRef.current.updateState({ ...s, brushSize: Math.max(MIN_BRUSH_SIZE, s.brushSize - 1) });
          }
        },
        {
          id: 'view.zoomIn', label: 'Zoom In', category: 'View', hotkey: 'Ctrl++', keys: ['Control+=', 'Meta+='],
          perform: () => {
            const s = latestRef.current.state;
            latestRef.current.updateState({ ...s, zoom: Math.min(MAX_ZOOM, s.zoom * 2) });
          }
        },
        {
          id: 'view.zoomOut', label: 'Zoom Out', category: 'View', hotkey: 'Ctrl+-', keys: ['Control+-', 'Meta+-'],
          perform: () => {
            const s = latestRef.current.state;
            latestRef.current.updateState({ ...s, zoom: Math.max(MIN_ZOOM, s.zoom / 2) });
          }
        },
        {
          id: 'app.commandPalette', label: 'Command Palette', category: 'View', hotkey: 'Ctrl+K', keys: ['Control+k', 'Meta+k', 'Control+p', 'Meta+p', 'F1'],
          perform: () => latestRef.current.openCmdPalette()
        }
    ];

    return commands;
}

