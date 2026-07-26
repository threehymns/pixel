
export interface Position {
  x: number;
  y: number;
}

export interface Modifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export type PixelValue = string | number | null;
export type PixelGrid = PixelValue[]; // Flat array of hex colors (RGBA), indices (Indexed), or null (transparent)

export type LayerBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 100
  blendMode: LayerBlendMode;
}

export interface Frame {
  id: string;
  // Key represents Layer ID, Value is the pixel data for that layer on this frame
  layerData: Record<string, PixelGrid>; 
}

export type ColorMode = 'indexed' | 'rgba';
export type InkType = 'simple' | 'shading';

export interface SymmetryConfig {
  x: boolean; // Vertical axis (horizontal symmetry)
  y: boolean; // Horizontal axis (vertical symmetry)
}

export interface ProjectState {
  id: string; // Unique Project ID
  title: string; // Project Name for Tab
  width: number;
  height: number;
  colorMode: ColorMode;
  layers: Layer[];
  frames: Frame[];
  activeLayerId: string;
  selectedLayerIds: string[]; // Support for multiple selected layers
  activeFrameIndex: number;
  selectedFrameIndices: number[]; // Support for multiple selected frames
  // Current working colors
  palette: string[]; 
  // Library of available palettes
  paletteLibrary: SavedPalette[];
  activePaletteId: string;
  primaryColor: string;
  secondaryColor: string;
  
  // Symmetry
  symmetry: SymmetryConfig;

  // Ink processing
  inkType: InkType;
  shades: string[]; // Ordered list of colors for shading mode
  
  tool: ToolType;
  // Tool Options
  brushSize: number;
  brushShape: 'square' | 'circle';
  fillContiguous: boolean;
  pixelPerfect: boolean;
  ditheringEnabled: boolean; // For palette conversion and effects
  rotationAlgorithm: 'nearest' | 'rotsprite';
  
  zoom: number;
  onionSkin: boolean;
  showGrid: boolean;
  tiled: boolean;

  // Reference Image
  referenceImage: {
    url: string;
    opacity: number;
    x: number;
    y: number;
    scale: number;
    visible: boolean;
  } | null;

  // Selection
  selection: Set<number> | null;
  selectionMode: SelectionMode;

  // File System
  fileHandle?: FileSystemFileHandle;
}

export interface RecentProject {
  id: string;
  title: string;
  timestamp: number;
  data: ProjectState;
}

export interface HistoryEntry {
  state: ProjectState;
  action: string;
  tool?: ToolType;
  timestamp: number;
}

export interface ProjectInstance {
  data: ProjectState;
  history: HistoryEntry[];
  historyIndex: number;
  lastSavedHistoryIndex: number;
}

export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
}

export type ToolType = 
  | 'pencil' 
  | 'eraser' 
  | 'smudge'
  | 'line'
  | 'rect'
  | 'filled-rect'
  | 'ellipse'
  | 'filled-ellipse'
  | 'bucket' 
  | 'eyedropper' 
  | 'move'
  | 'rect-select' 
  | 'ellipse-select' 
  | 'lasso-select' 
  | 'poly-lasso-select' 
  | 'magic-wand'
  | 'blur'
  | 'sharpen'
  | 'color-replace';

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'intersect';

export const CANVAS_SIZE = 32; // Default 32x32

// --- Command Registry Types ---

export interface Command {
  id: string;
  label: string;
  category: 'File' | 'Edit' | 'View' | 'Select' | 'Sprite' | 'Layer' | 'Help';
  hotkey?: string; // Display string, e.g. "Ctrl+Z"
  keys?: string[]; // Code matchers, e.g. ["Control+z", "Meta+z"]
  perform: () => void;
  disabled?: boolean;
  checked?: boolean;
}

// --- File System Access API Types (Partial) ---
export interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

export interface FileSystemSaveFilePickerOptions {
    types?: {
        description: string;
        accept: Record<string, string[]>;
    }[];
    excludeAcceptAllOption?: boolean;
    suggestedName?: string;
}
