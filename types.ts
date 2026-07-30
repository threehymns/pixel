
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

export type LayerBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity' | 'addition' | 'subtract' | 'divide';

export type LayerType = 'normal' | 'group' | 'tilemap';

export interface UserPropertyMap {
  key: number; // 0 = user properties, != 0 = extension Entry ID
  properties: Record<string, any>;
}

export interface UserData {
  text?: string;
  color?: { r: number; g: number; b: number; a: number };
  propertiesMaps?: UserPropertyMap[];
}

export interface ExternalFile {
  id: number;
  type: number; // 0=External palette, 1=External tileset, 2=Extension name for properties, 3=Extension name for tile management
  filename: string;
}

export interface CelExtra {
  flags: number;
  preciseX: number;
  preciseY: number;
  widthInSprite: number;
  heightInSprite: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 100
  blendMode: LayerBlendMode;
  type?: LayerType;
  childLevel?: number;
  parentId?: string | null;
  collapsed?: boolean;
  tilesetIndex?: number;
  uuid?: string;
  userData?: UserData;
  colorTag?: string;
  isBackground?: boolean;
  lockMovement?: boolean;
  preferLinkedCels?: boolean;
  isReference?: boolean;
}

export interface FrameTag {
  id: string;
  name: string;
  from: number;
  to: number;
  direction?: 'forward' | 'reverse' | 'ping-pong' | 'ping-pong-reverse';
  color?: string;
  loopAnimation?: number; // 0=Forward, 1=Reverse, 2=Ping-pong
  repeat?: number;
  userData?: UserData;
}

export interface SliceKey {
  frameIndex?: number;
  frame?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  center?: { x: number; y: number; w: number; h: number };
  pivot?: { x: number; y: number };
}

export interface Slice {
  id: string;
  name: string;
  color?: string;
  keys: SliceKey[];
  userData?: UserData;
}

export interface Tileset {
  id: number;
  name: string;
  tileWidth: number;
  tileHeight: number;
  baseIndex: number;
  tilesCount: number;
  pixels?: PixelGrid;
  externalFileId?: number;
  externalTilesetId?: number;
  userData?: UserData;
  flags?: number;
  tileUserData?: Record<number, UserData>;
}

export interface ColorProfile {
  type: number;
  flags: number;
  gamma: number;
  iccData?: Uint8Array;
}

export interface Frame {
  id: string;
  duration?: number; // duration in ms (default 100)
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

  // Aseprite extra data
  grid?: { x: number; y: number; width: number; height: number };
  pixelRatio?: { width: number; height: number };
  tags?: FrameTag[];
  slices?: Slice[];
  tilesets?: Tileset[];
  externalFiles?: ExternalFile[];
  colorProfile?: ColorProfile;
  transparentIndex?: number;
  paletteNames?: Record<number, string>;
  userData?: UserData;
  mask?: { x: number; y: number; width: number; height: number; name?: string; bitmap?: Uint8Array };

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
