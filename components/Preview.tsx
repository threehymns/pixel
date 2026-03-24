
import React, { useEffect, useRef, useState } from 'react';
import { ProjectState } from '../types';
import { getCoords } from '../utils';
import { Play, Pause, X } from 'lucide-react';
import { CustomSlider } from './ui/slider';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";

interface PreviewProps {
  width: number; // Ignored
  state: ProjectState;
  onClose?: () => void;
  isFloating?: boolean;
}

export const Preview: React.FC<PreviewProps> = ({ state, onClose, isFloating = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [fps, setFps] = useState(12);

  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem('preview_size');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { width: 192, height: 192 };
  });

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('preview_position');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // We don't have access to size yet, so we use a fallback or the parsed size if we can get it
        const savedSize = localStorage.getItem('preview_size');
        let w = 192, h = 192;
        if (savedSize) {
            try {
                const ps = JSON.parse(savedSize);
                w = ps.width; h = ps.height;
            } catch(e) {}
        }
        return {
            x: Math.max(0, Math.min(parsed.x, window.innerWidth - w)),
            y: Math.max(0, Math.min(parsed.y, window.innerHeight - h))
        };
      } catch (e) {}
    }
    return { x: window.innerWidth - 210, y: window.innerHeight - 210 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('preview_position', JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    localStorage.setItem('preview_size', JSON.stringify(size));
  }, [size]);

  useEffect(() => {
    if (!isFloating || !windowRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (windowRef.current) {
        setSize({ 
          width: windowRef.current.offsetWidth, 
          height: windowRef.current.offsetHeight 
        });
      }
    });
    
    observer.observe(windowRef.current);
    return () => observer.disconnect();
  }, [isFloating]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isFloating) return;
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      let newX = dragStartRef.current.posX + dx;
      let newY = dragStartRef.current.posY + dy;
      
      // Clamp to window bounds
      newX = Math.max(0, Math.min(newX, window.innerWidth - size.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - size.height));
      
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, size]);

  // Animation Loop
  useEffect(() => {
    let interval: number;
    if (isPlaying && state.frames.length > 1) {
      interval = window.setInterval(() => {
        setPreviewFrame(curr => (curr + 1) % state.frames.length);
      }, 1000 / fps);
    } else {
      setPreviewFrame(state.activeFrameIndex);
    }

    return () => clearInterval(interval);
  }, [isPlaying, fps, state.frames.length, state.activeFrameIndex]);

  // Render logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Checkerboard
    const scale = canvas.width / state.width;
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw content
    const frameIndex = isPlaying ? previewFrame : state.activeFrameIndex;
    const frame = state.frames[frameIndex];

    if (!frame) return;

    state.layers.forEach(layer => {
      if (!layer.visible) return;
      const pixels = frame.layerData[layer.id];
      if (!pixels) return;

      pixels.forEach((val, i) => {
        if (val !== null) {
          const color = typeof val === 'number' ? state.palette[val] : val;
          if (color) {
            const { x, y } = getCoords(i, state.width);
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      });
    });

  }, [state, previewFrame, isPlaying]);

  const innerContent = (
    <div className="flex flex-col w-full h-full">
      <div 
        className="bg-secondary px-2 py-1.5 flex justify-between items-center border-b border-border select-none"
        onPointerDown={handlePointerDown}
      >
        <span className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">Preview</span>
        <div className="flex gap-1 no-drag">
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors" title={isPlaying ? "Pause Animation" : "Play Animation"}>
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          {isFloating && onClose && (
            <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Close Preview">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      
      <div className="p-2 flex items-center justify-center bg-muted/20 flex-1 min-h-[120px] overflow-hidden" ref={containerRef}>
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          className="bg-muted-foreground/10 pixelated border border-border shadow-sm w-full h-full object-contain"
        />
      </div>

      <div className="px-2 py-1.5 flex items-center gap-2 border-t border-border bg-card shrink-0">
         <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">FPS:</span>
         <CustomSlider
          min={1} 
          max={60} 
          value={fps} 
          onValueChange={setFps}
          className="flex-1"
         />
         <span className="text-[10px] text-foreground w-4 text-right font-mono">{fps}</span>
      </div>
    </div>
  );

  const content = isFloating ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {innerContent}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => {
          setPosition({ x: window.innerWidth - 210, y: window.innerHeight - 210 });
          setSize({ width: 192, height: 192 });
        }}>
          Reset Position & Size
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ) : innerContent;

  if (!isFloating) {
    return (
      <div className="flex flex-col w-full h-full bg-card">
        {content}
      </div>
    );
  }

  return (
    <div 
        ref={windowRef}
        className="fixed z-[100] bg-card border border-border shadow-2xl flex flex-col rounded-lg overflow-hidden"
        style={{ 
          left: position.x, 
          top: position.y, 
          width: size.width,
          height: size.height,
          resize: 'both', 
          minWidth: 150, 
          minHeight: 150 
        }}
    >
      {content}
    </div>
  );
};
