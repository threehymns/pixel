
import { ProjectState, SavedPalette, ToolType, CANVAS_SIZE } from './types';

export const INITIAL_LAYER_ID = 'layer-1';
export const INITIAL_FRAME_ID = 'frame-1';

export const DEFAULT_PALETTE: SavedPalette = {
    id: 'pico-8',
    name: 'Pico-8',
    colors: [
        '#000000', '#1d2b53', '#7e2553', '#008751', 
        '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', 
        '#ff004d', '#ffa300', '#ffec27', '#00e436', 
        '#29adff', '#83769c', '#ff77a8', '#ffccaa'
    ]
};

export const GAMEBOY_PALETTE: SavedPalette = {
    id: 'gameboy',
    name: 'Gameboy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
};

export const INITIAL_STATE: ProjectState = {
  id: 'project-1',
  title: 'Untitled-1',
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  layers: [{ id: INITIAL_LAYER_ID, name: 'Layer 1', visible: true, locked: false }],
  frames: [{ 
    id: INITIAL_FRAME_ID, 
    layerData: { [INITIAL_LAYER_ID]: new Array(CANVAS_SIZE * CANVAS_SIZE).fill(null) } 
  }],
  activeLayerId: INITIAL_LAYER_ID,
  activeFrameIndex: 0,
  palette: DEFAULT_PALETTE.colors,
  paletteLibrary: [DEFAULT_PALETTE, GAMEBOY_PALETTE],
  activePaletteId: DEFAULT_PALETTE.id,
  primaryColor: '#ffffff',
  secondaryColor: '#000000',
  tool: 'pencil',
  brushSize: 1,
  brushShape: 'circle',
  fillContiguous: true,
  pixelPerfect: false,
  zoom: 16,
  onionSkin: false,
  showGrid: false,
  selection: null,
  selectionMode: 'replace'
};

export const SELECTION_TOOLS: ToolType[] = [
  'rect-select', 
  'ellipse-select', 
  'lasso-select', 
  'poly-lasso-select', 
  'magic-wand'
];
