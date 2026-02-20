
import React, { useEffect, useRef, useState } from 'react';
import { ProjectState } from '../types';
import { getCoords } from '../utils';
import { Play, Pause } from 'lucide-react';

interface PreviewProps {
  width: number; // Ignored
  state: ProjectState;
}

export const Preview: React.FC<PreviewProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [fps, setFps] = useState(12);

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
        // Fix: resolve hex color correctly from PixelValue (string | number | null).
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

  return (
    <div 
        className="bg-card flex flex-col w-full"
    >
      <div className="bg-secondary px-2 py-1 text-xs font-bold text-gray-300 flex justify-between items-center border-b border-background">
        <span>Preview</span>
        <div className="flex gap-1">
          <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-white" title={isPlaying ? "Pause Animation" : "Play Animation"}>
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
        </div>
      </div>
      
      <div className="p-4 flex items-center justify-center bg-muted flex-1 min-h-[150px]" ref={containerRef}>
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          className="bg-muted-foreground/10 pixelated border border-border shadow-md max-w-full max-h-full object-contain"
        />
      </div>

      <div className="px-2 py-2 flex items-center gap-2 border-t border-border bg-card">
         <span className="text-xs text-muted-foreground">FPS:</span>
         <input 
          type="range" 
          min="1" 
          max="60" 
          value={fps} 
          onChange={(e) => setFps(parseInt(e.target.value))}
          className="flex-1 h-1 bg-input appearance-none rounded"
          aria-label="Frames per second"
         />
         <span className="text-xs text-gray-300 w-4 text-right">{fps}</span>
      </div>
    </div>
  );
};
