

export interface Position {
  x: number;
  y: number;
}

export type PixelGrid = (string | null)[]; // Flat array of hex colors or null (transparent)

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface Frame {
  id: string;
  // Key represents Layer ID, Value is the pixel data for that layer on this frame
  layerData: Record<string, PixelGrid>; 
}

export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
}

export type ToolType = 
  | 'pencil' 
  | 'eraser' 
  | 'bucket' 
  | 'eyedropper' 
  | 'move'
  | 'rect-select' 
  | 'ellipse-select' 
  | 'lasso-select' 
  | 'poly-lasso-select' 
  | 'magic-wand';

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'intersect';

export interface ProjectState {
  id: string; // Unique Project ID
  title: string; // Project Name for Tab
  width: number;
  height: number;
  layers: Layer[];
  frames: Frame[];
  activeLayerId: string;
  activeFrameIndex: number;
  // Current working colors
  palette: string[]; 
  // Library of available palettes
  paletteLibrary: SavedPalette[];
  activePaletteId: string;
  primaryColor: string;
  secondaryColor: string;
  tool: ToolType;
  // Tool Options
  brushSize: number;
  brushShape: 'square' | 'circle';
  fillContiguous: boolean;
  pixelPerfect: boolean;
  
  zoom: number;
  onionSkin: boolean;
  showGrid: boolean;

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