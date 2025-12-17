
import { useState, useEffect } from 'react';

export function useLayout() {
  const [fileTreeWidth, setFileTreeWidth] = useState(200);
  const [leftPanelWidth, setLeftPanelWidth] = useState(200);
  const [rightPanelWidth, setRightPanelWidth] = useState(250);
  
  const [isDraggingFileTree, setIsDraggingFileTree] = useState(false);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingFileTree) {
        setFileTreeWidth(Math.max(150, Math.min(400, e.clientX)));
      } else if (isDraggingLeft) {
        // Offset by fileTreeWidth + sidebar width (48)
        // We only care about relative resizing for this panel usually, but simplistic approach:
        // Note: Logic depends on absolute structure.
        // Let's assume leftPanel is rendered after FileTree + Sidebar (48px)
        // This resize logic might need adjustment based on exact DOM structure in App.tsx
        // For now, let's keep it simple.
        setLeftPanelWidth(Math.max(160, Math.min(400, e.movementX + leftPanelWidth)));
      } else if (isDraggingRight) {
        setRightPanelWidth(Math.max(200, Math.min(500, window.innerWidth - e.clientX)));
      }
    };
    const handleMouseUp = () => {
      setIsDraggingFileTree(false);
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
      document.body.style.cursor = 'default';
    };
    if (isDraggingLeft || isDraggingRight || isDraggingFileTree) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight, isDraggingFileTree, leftPanelWidth]);

  return {
    fileTreeWidth,
    leftPanelWidth,
    rightPanelWidth,
    startFileTreeResize: (e: React.MouseEvent) => { e.preventDefault(); setIsDraggingFileTree(true); },
    startLeftResize: (e: React.MouseEvent) => { e.preventDefault(); setIsDraggingLeft(true); },
    startRightResize: (e: React.MouseEvent) => { e.preventDefault(); setIsDraggingRight(true); }
  };
}
