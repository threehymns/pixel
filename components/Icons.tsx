
import React from 'react';
import { 
  Pencil, Eraser, PaintBucket, Pipette, 
  Plus, Layers, Play, Pause, Trash2, 
  Copy, Eye, EyeOff, Grid, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, ChevronUp, Square, Undo, Redo,
  Download, FilePlus, Upload, GripVertical, Menu,
  ChevronDown, Circle,
  BoxSelect, Lasso, Wand2, MousePointer2, Scissors,
  Check, Command, Search, X, File, Settings, HelpCircle,
  Home, Github, ArrowRightLeft, Edit2,
  Lock, Unlock, Folder, FolderOpen, Image,
  Maximize, Info, AlertCircle, Clock, Minus,
  Share, Palette, Sparkles, Droplets, Zap, Waves,
  FlipHorizontal, FlipVertical, Hand
} from 'lucide-react';

export const AngleIcon = ({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M20 20H3c-1.1 0-1.3-.6-.4-1.3L20.4 4.3"/>
  </svg>
);

export { 
  Pencil, Eraser, PaintBucket, Pipette, 
  Plus, Layers, Play, Pause, Trash2, 
  Copy, Eye, EyeOff, Grid, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, ChevronUp, Square, Undo, Redo,
  Download, FilePlus, Upload, GripVertical, Menu,
  ChevronDown, Circle,
  BoxSelect, Lasso, Wand2, MousePointer2, Scissors,
  Check, Command, Search, X, File, Settings, HelpCircle,
  Home, Github, ArrowRightLeft, Edit2,
  Lock, Unlock, Folder, FolderOpen, Image,
  Maximize, Info, AlertCircle, Clock, Minus,
  Share, Palette, Sparkles, Droplets, Zap, Waves,
  FlipHorizontal, FlipVertical, Hand
};
