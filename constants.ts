
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

export const ENDESGA_64_PALETTE: SavedPalette = {
    id: 'endesga-64',
    name: 'Endesga 64',
    colors: [
        '#ff0040', '#131313', '#1b1b1b', '#272727', 
        '#3d3d3d', '#5d5d5d', '#858585', '#b4b4b4', 
        '#ffffff', '#c7cfdd', '#92a1b9', '#657392', 
        '#424c6e', '#2a2f4e', '#1a1932', '#0e071b', 
        '#1c121c', '#391f21', '#5d2c28', '#8a4836', 
        '#bf6f4a', '#e69c69', '#f6ca9f', '#f9e6cf', 
        '#edab50', '#e07438', '#c64524', '#8e251d', 
        '#ff5000', '#ed7614', '#ffa214', '#ffc825', 
        '#ffeb57', '#d3fc7e', '#99e65f', '#5ac54f', 
        '#33984b', '#1e6f50', '#134c4c', '#0c2e44', 
        '#00396d', '#0069aa', '#0098dc', '#00cdf9', 
        '#0cf1ff', '#94fdff', '#fdd2ed', '#f389f5', 
        '#db3ffd', '#7a09fa', '#3003d9', '#0c0293', 
        '#03193f', '#3b1443', '#622461', '#93388f', 
        '#ca52c9', '#c85086', '#f68187', '#f5555d', 
        '#ea323c', '#c42430', '#891e2b', '#571c27'
    ]
};

export const INITIAL_STATE: ProjectState = {
  id: 'project-1',
  title: 'Untitled-1',
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  colorMode: 'indexed',
  layers: [{ id: INITIAL_LAYER_ID, name: 'Layer 1', visible: true, locked: false }],
  frames: [{ 
    id: INITIAL_FRAME_ID, 
    layerData: { [INITIAL_LAYER_ID]: new Array(CANVAS_SIZE * CANVAS_SIZE).fill(null) } 
  }],
  activeLayerId: INITIAL_LAYER_ID,
  selectedLayerIds: [INITIAL_LAYER_ID],
  activeFrameIndex: 0,
  selectedFrameIndices: [0],
  palette: ENDESGA_64_PALETTE.colors,
  paletteLibrary: [ENDESGA_64_PALETTE, DEFAULT_PALETTE, GAMEBOY_PALETTE],
  activePaletteId: ENDESGA_64_PALETTE.id,
  primaryColor: '#ffffff',
  secondaryColor: '#000000',
  
  symmetry: { x: false, y: false },

  inkType: 'simple',
  shades: ['#000000', '#5d5d5d', '#b4b4b4', '#ffffff'], // Default ramp

  tool: 'pencil',
  brushSize: 1,
  brushShape: 'circle',
  fillContiguous: true,
  pixelPerfect: false,
  ditheringEnabled: false,
  rotationAlgorithm: 'nearest',
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
