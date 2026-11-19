import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { Command, Position, ProjectState, ToolType } from '../types';
import { SELECTION_TOOLS } from '../constants';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { LayersPanel } from './LayersPanel';
import { Timeline } from './Timeline';
import { HistoryPanel } from './HistoryPanel';
import { Preview } from './Preview';
import { ColorPicker } from './ColorPicker';
import { Home } from './Home';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogSheetContent,
  DialogTitle,
} from './ui/dialog';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from './ui/segmented-control';
import { CustomSlider } from './ui/slider';
import {
  ArrowRightLeft,
  BoxSelect,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Command as CommandIcon,
  Crop,
  Download,
  Droplets,
  Eraser,
  Eye,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  Grid,
  Hand,
  History as HistoryIcon,
  Image as ImageIcon,
  Lasso,
  Layers,
  Maximize2,
  Menu as MenuIcon,
  Minus,
  MousePointer2,
  PaintBucket,
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Play,
  Plus,
  Redo,
  Scissors,
  Settings,
  Sliders,
  Sparkles,
  Square,
  Tag,
  Undo,
  Wand2,
  Waves,
  X,
  Zap,
} from './Icons';

interface MobileLayoutProps {
  state: ProjectState;
  updateState: (s: ProjectState, config?: any) => void;
  commands: Command[];
  project: any;
  canvasTools: any;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  statusMessage: { text: string; type: 'info' | 'error' | 'success' };
  mousePos: Position | null;
  dragStartPos: Position | null;
  selectionSize: { w: number; h: number } | null;
  setMousePos: (pos: Position | null) => void;
  setDragStartPos: (pos: Position | null) => void;
  onScalePixels: (selection: Set<number>, srcBox: any, destBox: any) => void;
  activeTagPopover?: any;
  onCloseTagPopover?: () => void;
  layerPropertiesState?: { isOpen: boolean; layer: any };
  onCloseLayerProperties?: () => void;
}

type MobilePanel = 'palette' | 'layers' | 'timeline' | 'history' | 'menu' | 'preview' | null;

const PANEL_TITLES: Record<Exclude<MobilePanel, null>, string> = {
  palette: 'Palette',
  layers: 'Layers',
  timeline: 'Timeline',
  history: 'History',
  menu: 'Studio Menu',
  preview: 'Preview',
};

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  state,
  updateState,
  commands,
  project,
  canvasTools,
  fileInputRef,
  handleFileChange,
  setMousePos,
  setDragStartPos,
  activeTagPopover,
  onCloseTagPopover,
  layerPropertiesState,
  onCloseLayerProperties,
  onScalePixels,
}) => {
  const [activePanel, setActivePanel] = useState<MobilePanel>(null);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isDraggingTray, setIsDraggingTray] = useState(false);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const trayRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);
  const dragScale = useTransform(dragY, [-18, 0, 220], [1.005, 1, 0.985]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetY = useMotionValue(0);
  const sheetBackdropOpacity = useMotionValue(1);
  const isClosingSheetRef = useRef(false);
  const suppressSheetClickRef = useRef(false);
  const prevPanelRef = useRef<MobilePanel>(null);

  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    isDragging: boolean;
    captured: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const handleTrayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-slot="slider-control"], [role="slider"], input[type="range"]')) {
      return;
    }

    dragY.stop();
    suppressClickRef.current = false;
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      isDragging: false,
      captured: false,
    };
  };

  const handleTrayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const rawDeltaY = e.clientY - session.startY;
    const absDeltaX = Math.abs(e.clientX - session.startX);

    if (!session.isDragging) {
      if (Math.abs(rawDeltaY) < 6 && absDeltaX < 6) return;
      if (absDeltaX > Math.abs(rawDeltaY)) {
        dragSessionRef.current = null;
        return;
      }

      session.isDragging = true;
      suppressClickRef.current = true;
      setIsDraggingTray(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        session.captured = true;
      } catch {
        // Ignore if pointer capture is unsupported
      }
    }

    const now = performance.now();
    const dt = now - session.lastTime;
    if (dt > 0) {
      const instantVy = ((e.clientY - session.lastY) / dt) * 1000;
      session.velocityY = session.velocityY * 0.45 + instantVy * 0.55;
      session.lastY = e.clientY;
      session.lastTime = now;
    }

    if (rawDeltaY < 0) {
      dragY.set(Math.max(-18, rawDeltaY * 0.16));
    } else {
      dragY.set(rawDeltaY);
    }
  };

  const handleTrayPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    if (session.captured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    }

    dragSessionRef.current = null;
    setIsDraggingTray(false);

    if (!session.isDragging) return;

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const currentY = dragY.get();
    const trayHeight = trayRef.current?.offsetHeight ?? 200;
    const dismissDistance = Math.min(72, trayHeight * 0.35);
    const timeSinceMove = performance.now() - session.lastTime;
    const vy = timeSinceMove > 90 ? 0 : session.velocityY;

    const shouldDismiss =
      e.type !== 'pointercancel' &&
      ((currentY > dismissDistance && vy >= -80) || (vy > 420 && currentY > 16));

    if (shouldDismiss) {
      if (!shouldReduceMotion) {
        const targetY = currentY + Math.min(80, Math.max(0, vy * 0.06));
        animate(dragY, targetY, {
          duration: 0.16,
          ease: [0.22, 1, 0.36, 1],
        });
      }
      setIsSettingsExpanded(false);
    } else if (shouldReduceMotion) {
      dragY.set(0);
    } else {
      animate(dragY, 0, {
        type: 'spring',
        stiffness: 540,
        damping: 34,
        mass: 0.8,
      });
    }
  };

  const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
    { id: 'pencil', icon: <Pencil size={18} />, label: 'Pencil' },
    { id: 'eraser', icon: <Eraser size={18} />, label: 'Eraser' },
    { id: 'bucket', icon: <PaintBucket size={18} />, label: 'Fill' },
    { id: 'eyedropper', icon: <Pipette size={18} />, label: 'Picker' },
    { id: 'move', icon: <MousePointer2 size={18} />, label: 'Move' },
    { id: 'rect', icon: <Square size={18} />, label: 'Rectangle' },
    { id: 'filled-rect', icon: <Square size={18} className="fill-current" />, label: 'Filled Rect' },
    { id: 'ellipse', icon: <Circle size={18} />, label: 'Ellipse' },
    { id: 'filled-ellipse', icon: <Circle size={18} className="fill-current" />, label: 'Filled Ellipse' },
    { id: 'line', icon: <Minus size={18} className="-rotate-45" />, label: 'Line' },
    { id: 'smudge', icon: <Hand size={18} />, label: 'Smudge' },
    { id: 'blur', icon: <Droplets size={18} />, label: 'Blur' },
    { id: 'sharpen', icon: <Zap size={18} />, label: 'Sharpen' },
    { id: 'color-replace', icon: <PaletteIcon size={18} />, label: 'Replace' },
    { id: 'rect-select', icon: <BoxSelect size={18} />, label: 'Rect Select' },
    { id: 'ellipse-select', icon: <Circle size={18} />, label: 'Ellipse Select' },
    { id: 'lasso-select', icon: <Lasso size={18} />, label: 'Lasso Select' },
    { id: 'poly-lasso-select', icon: <Scissors size={18} />, label: 'Poly Lasso' },
    { id: 'magic-wand', icon: <Wand2 size={18} />, label: 'Magic Wand' },
  ];

  const closePanel = useCallback(() => {
    isClosingSheetRef.current = false;
    setActivePanel(null);
  }, []);

  const dismissPanel = useCallback(
    (velocityY = 0) => {
      if (!activePanel || isClosingSheetRef.current) return;
      isClosingSheetRef.current = true;

      if (shouldReduceMotion) {
        isClosingSheetRef.current = false;
        setActivePanel(null);
        return;
      }

      const sheetHeight = sheetRef.current?.offsetHeight || 420;
      const targetY = sheetHeight + 28;
      const duration = velocityY > 500 ? 0.14 : 0.2;

      animate(sheetBackdropOpacity, 0, {
        duration,
        ease: [0.22, 1, 0.36, 1],
      });
      animate(sheetY, targetY, {
        duration,
        ease: [0.32, 0.72, 0, 1],
      }).then(() => {
        if (isClosingSheetRef.current) {
          isClosingSheetRef.current = false;
          setActivePanel(null);
        }
      });
    },
    [activePanel, sheetBackdropOpacity, sheetY, shouldReduceMotion]
  );

  const snapSheetBack = useCallback(() => {
    isClosingSheetRef.current = false;
    if (shouldReduceMotion) {
      sheetY.set(0);
      sheetBackdropOpacity.set(1);
      return;
    }

    animate(sheetY, 0, {
      type: 'spring',
      stiffness: 520,
      damping: 36,
      mass: 0.8,
    });
    animate(sheetBackdropOpacity, 1, {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    });
  }, [sheetBackdropOpacity, sheetY, shouldReduceMotion]);

  useLayoutEffect(() => {
    const prevPanel = prevPanelRef.current;
    prevPanelRef.current = activePanel;

    if (!prevPanel && activePanel) {
      isClosingSheetRef.current = false;
      suppressSheetClickRef.current = false;
      sheetY.stop();
      sheetBackdropOpacity.stop();

      if (shouldReduceMotion) {
        sheetY.set(0);
        sheetBackdropOpacity.set(1);
      } else {
        const startOffset = sheetRef.current?.offsetHeight || 420;
        sheetY.set(startOffset);
        sheetBackdropOpacity.set(0);
        animate(sheetY, 0, {
          type: 'spring',
          stiffness: 440,
          damping: 36,
          mass: 0.85,
        });
        animate(sheetBackdropOpacity, 1, {
          duration: 0.2,
          ease: [0.22, 1, 0.36, 1],
        });
      }
    }
  }, [activePanel, sheetBackdropOpacity, sheetY, shouldReduceMotion]);

  useEffect(() => {
    if (!activePanel) return;
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!sheetEl) return;

    type SheetDragSession = {
      source: 'touch' | 'pointer';
      pointerId: number;
      startX: number;
      startY: number;
      startOffsetY: number;
      lastY: number;
      lastTime: number;
      velocityY: number;
      scrollEl: HTMLElement | null;
      startScrollTop: number;
      isBackdrop: boolean;
      isDragging: boolean;
    };

    let activeSession: SheetDragSession | null = null;

    const shouldIgnoreTarget = (target: HTMLElement | null) =>
      Boolean(
        target?.closest(
          '[data-slot="slider-control"], [role="slider"], input[type="range"], [data-slot="popover-content"], [data-slot="menu-content"], [data-slot="select-content"], [draggable="true"], .split-view-sash, .sash, input, textarea, select, [contenteditable="true"]'
        )
      );

    const findVerticalScrollContainer = (target: HTMLElement | null) => {
      let el = target;
      while (el && el !== sheetEl) {
        const overflowY = window.getComputedStyle(el).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const startSession = (
      source: 'touch' | 'pointer',
      pointerId: number,
      clientX: number,
      clientY: number,
      target: HTMLElement | null,
      isBackdrop: boolean
    ): SheetDragSession | null => {
      if (!isBackdrop && shouldIgnoreTarget(target)) return null;

      isClosingSheetRef.current = false;
      sheetY.stop();
      sheetBackdropOpacity.stop();
      if (!isBackdrop) suppressSheetClickRef.current = false;

      const scrollEl = isBackdrop ? null : findVerticalScrollContainer(target);
      return {
        source,
        pointerId,
        startX: clientX,
        startY: clientY,
        startOffsetY: sheetY.get(),
        lastY: clientY,
        lastTime: performance.now(),
        velocityY: 0,
        scrollEl,
        startScrollTop: scrollEl ? scrollEl.scrollTop : 0,
        isBackdrop,
        isDragging: false,
      };
    };

    const moveSession = (clientX: number, clientY: number, touchEvent?: TouchEvent) => {
      if (!activeSession) return;

      const rawDeltaY = clientY - activeSession.startY;
      const absDeltaX = Math.abs(clientX - activeSession.startX);
      const absDeltaY = Math.abs(rawDeltaY);

      if (!activeSession.isDragging) {
        const threshold = activeSession.source === 'touch' ? 4 : 6;
        if (absDeltaY < threshold && absDeltaX < threshold) return;

        if (absDeltaX > absDeltaY) {
          activeSession = null;
          return;
        }

        if (activeSession.scrollEl) {
          if (activeSession.scrollEl.scrollTop > 1 || activeSession.startScrollTop > 1 || rawDeltaY < 0) {
            activeSession = null;
            return;
          }
        }

        if (touchEvent?.cancelable) touchEvent.preventDefault();
        activeSession.isDragging = true;
        if (!activeSession.isBackdrop) suppressSheetClickRef.current = true;
        setIsDraggingSheet(true);
      } else if (touchEvent?.cancelable) {
        touchEvent.preventDefault();
      }

      const now = performance.now();
      const dt = now - activeSession.lastTime;
      if (dt > 0) {
        const instantVy = ((clientY - activeSession.lastY) / dt) * 1000;
        activeSession.velocityY = activeSession.velocityY * 0.45 + instantVy * 0.55;
        activeSession.lastY = clientY;
        activeSession.lastTime = now;
      }

      const nextRaw = activeSession.startOffsetY + rawDeltaY;
      const nextY = nextRaw < 0 ? Math.max(-18, nextRaw * 0.16) : nextRaw;
      sheetY.set(nextY);

      const height = Math.max(240, sheetEl.offsetHeight || 360);
      const progress = Math.min(1, Math.max(0, nextY / height));
      sheetBackdropOpacity.set(1 - progress * 0.85);
    };

    const endSession = (isCancel: boolean) => {
      const session = activeSession;
      activeSession = null;
      setIsDraggingSheet(false);
      if (!session) return;

      if (!session.isBackdrop) {
        window.setTimeout(() => {
          suppressSheetClickRef.current = false;
        }, 50);
      }

      if (!session.isDragging) {
        if (!isCancel && session.isBackdrop) {
          const hasNestedPopup = Boolean(
            document.querySelector(
              '[data-slot="popover-content"][data-open], [data-slot="menu-content"][data-open], [data-slot="select-content"][data-open]'
            )
          );
          if (!hasNestedPopup) {
            dismissPanel();
          }
        } else if (sheetY.get() !== 0) {
          snapSheetBack();
        }
        return;
      }

      const currentY = sheetY.get();
      const sheetHeight = Math.max(240, sheetEl.offsetHeight || 360);
      const dismissDistance = Math.min(110, sheetHeight * 0.3);
      const timeSinceMove = performance.now() - session.lastTime;
      const vy = timeSinceMove > 90 ? 0 : session.velocityY;

      const shouldDismiss =
        !isCancel &&
        ((currentY > dismissDistance && vy >= -80) || (vy > 420 && currentY > 20));

      if (shouldDismiss) {
        dismissPanel(vy);
      } else {
        snapSheetBack();
      }
    };

    const onSheetTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      activeSession = startSession(
        'touch',
        touch.identifier,
        touch.clientX,
        touch.clientY,
        e.target as HTMLElement | null,
        false
      );
    };

    const onBackdropTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      activeSession = startSession(
        'touch',
        touch.identifier,
        touch.clientX,
        touch.clientY,
        e.target as HTMLElement | null,
        true
      );
    };

    const findMatchingTouch = (list: TouchList, id: number) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === id) return list[i];
      }
      return null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!activeSession || activeSession.source !== 'touch') return;
      const touch = findMatchingTouch(e.touches, activeSession.pointerId);
      if (!touch) return;
      moveSession(touch.clientX, touch.clientY, e);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!activeSession || activeSession.source !== 'touch') return;
      if (!findMatchingTouch(e.changedTouches, activeSession.pointerId)) return;
      endSession(false);
    };

    const onTouchCancel = (e: TouchEvent) => {
      if (!activeSession || activeSession.source !== 'touch') return;
      if (!findMatchingTouch(e.changedTouches, activeSession.pointerId)) return;
      endSession(true);
    };

    const onSheetPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      activeSession = startSession(
        'pointer',
        e.pointerId,
        e.clientX,
        e.clientY,
        e.target as HTMLElement | null,
        false
      );
    };

    const onBackdropPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      activeSession = startSession(
        'pointer',
        e.pointerId,
        e.clientX,
        e.clientY,
        e.target as HTMLElement | null,
        true
      );
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      if (!activeSession || activeSession.source !== 'pointer' || activeSession.pointerId !== e.pointerId) {
        return;
      }
      moveSession(e.clientX, e.clientY);
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (!activeSession || activeSession.source !== 'pointer' || activeSession.pointerId !== e.pointerId) {
        return;
      }
      endSession(false);
    };

    const onWindowPointerCancel = (e: PointerEvent) => {
      if (!activeSession || activeSession.source !== 'pointer' || activeSession.pointerId !== e.pointerId) {
        return;
      }
      endSession(true);
    };

    sheetEl.addEventListener('touchstart', onSheetTouchStart, { passive: true });
    // Non-passive listener allows canceling native scroll on touchmove when pulling down at scrollTop 0.
    sheetEl.addEventListener('touchmove', onTouchMove, { passive: false });
    sheetEl.addEventListener('touchend', onTouchEnd);
    sheetEl.addEventListener('touchcancel', onTouchCancel);
    sheetEl.addEventListener('pointerdown', onSheetPointerDown);

    backdropEl?.addEventListener('touchstart', onBackdropTouchStart, { passive: true });
    backdropEl?.addEventListener('touchmove', onTouchMove, { passive: false });
    backdropEl?.addEventListener('touchend', onTouchEnd);
    backdropEl?.addEventListener('touchcancel', onTouchCancel);
    backdropEl?.addEventListener('pointerdown', onBackdropPointerDown);

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);

    return () => {
      sheetEl.removeEventListener('touchstart', onSheetTouchStart);
      sheetEl.removeEventListener('touchmove', onTouchMove);
      sheetEl.removeEventListener('touchend', onTouchEnd);
      sheetEl.removeEventListener('touchcancel', onTouchCancel);
      sheetEl.removeEventListener('pointerdown', onSheetPointerDown);

      backdropEl?.removeEventListener('touchstart', onBackdropTouchStart);
      backdropEl?.removeEventListener('touchmove', onTouchMove);
      backdropEl?.removeEventListener('touchend', onTouchEnd);
      backdropEl?.removeEventListener('touchcancel', onTouchCancel);
      backdropEl?.removeEventListener('pointerdown', onBackdropPointerDown);

      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
    };
  }, [activePanel, dismissPanel, sheetBackdropOpacity, sheetY, snapSheetBack]);

  const isBrushTool = [
    'pencil',
    'eraser',
    'smudge',
    'line',
    'rect',
    'filled-rect',
    'ellipse',
    'filled-ellipse',
    'blur',
    'sharpen',
    'color-replace',
  ].includes(state.tool);
  const isFillTool = state.tool === 'bucket';
  const isMagicWand = state.tool === 'magic-wand';
  const isSelectionTool = SELECTION_TOOLS.includes(state.tool);
  const isMoveTool = state.tool === 'move';

  const hasAnySettings =
    isBrushTool || isFillTool || isMagicWand || isSelectionTool || isMoveTool;

  useEffect(() => {
    if (isSettingsExpanded && hasAnySettings) {
      if (shouldReduceMotion) {
        dragY.set(0);
      } else {
        animate(dragY, 0, {
          type: 'spring',
          stiffness: 520,
          damping: 36,
          mass: 0.8,
        });
      }
    }
  }, [isSettingsExpanded, hasAnySettings, dragY, shouldReduceMotion]);

  const toggleSymmetryX = () =>
    updateState({ ...state, symmetry: { ...state.symmetry, x: !state.symmetry.x } });
  const toggleSymmetryY = () =>
    updateState({ ...state, symmetry: { ...state.symmetry, y: !state.symmetry.y } });

  const getSettingsSummary = () => {
    if (isBrushTool) return `${state.brushSize}px`;
    if (isFillTool || isMagicWand) return state.fillContiguous ? 'Contig.' : 'Global';
    if (isSelectionTool) return state.selectionMode.slice(0, 3).toUpperCase();
    if (isMoveTool) return state.rotationAlgorithm === 'rotsprite' ? 'RotSprite' : 'Nearest';
    return 'Options';
  };

  const handleSwapColors = () => {
    const nextPrimary = state.secondaryColor;
    const nextSecondary = state.primaryColor;
    updateState({
      ...state,
      primaryColor: nextPrimary,
      secondaryColor: nextSecondary,
      ...(state.inkType === 'shading' ? { shades: [...state.shades].reverse() } : {}),
    });
  };

  const { activeProjectId } = project;
  const isHome = activeProjectId === 'home';

  return (
    <div
      className={`relative flex h-dvh flex-col overflow-hidden bg-background ${
        isHome ? '' : 'overscroll-none'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".aseprite,.ase,.png,.jpg,.jpeg,.gif,.json,.pxa"
        onChange={handleFileChange}
      />

      {isHome ? (
        <Home
          onCreateProject={project.createProject}
          onImportProject={() => fileInputRef.current?.click()}
          recentProjects={project.recentProjects}
          onOpenRecent={project.loadRecentProject}
          onClearRecent={project.clearRecents}
        />
      ) : (
        <>
          {/* Docked Top Studio Header */}
          <header className="z-20 flex h-12 shrink-0 items-center justify-between gap-1 border-b border-border bg-card px-1.5 safe-top">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setActivePanel('menu')}
                aria-label="Studio Menu"
                className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent active:bg-accent"
              >
                <MenuIcon size={20} />
              </button>

              <button
                type="button"
                onClick={() => commands.find((c) => c.id === 'edit.undo')?.perform()}
                disabled={!project.canUndo}
                aria-label="Undo"
                className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent active:bg-accent disabled:opacity-35"
              >
                <Undo size={18} />
              </button>

              <button
                type="button"
                onClick={() => commands.find((c) => c.id === 'edit.redo')?.perform()}
                disabled={!project.canRedo}
                aria-label="Redo"
                className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent active:bg-accent disabled:opacity-35"
              >
                <Redo size={18} />
              </button>
            </div>

            <div className="hidden min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground tabular-nums sm:flex">
              <span>
                {state.width}×{state.height}
              </span>
              <span>·</span>
              <span>{Math.round(state.zoom * 100)}%</span>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => updateState({ ...state, showGrid: !state.showGrid })}
                aria-label="Toggle Grid"
                aria-pressed={state.showGrid}
                className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                  state.showGrid
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Grid size={18} />
              </button>

              <button
                type="button"
                onClick={() => updateState({ ...state, onionSkin: !state.onionSkin })}
                aria-label="Toggle Onion Skin"
                aria-pressed={state.onionSkin}
                className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                  state.onionSkin
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Eye size={18} />
              </button>

              <button
                type="button"
                onClick={() => setActivePanel('preview')}
                aria-label="Preview Animation"
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Play size={18} />
              </button>

              <button
                type="button"
                onClick={() =>
                  project.openExportDialog ? project.openExportDialog('gif') : project.downloadImage()
                }
                aria-label="Export"
                className="ml-1 flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity active:opacity-90"
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            </div>
          </header>

          {/* Unobstructed Central Canvas Stage */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
            <Canvas
              state={state}
              onDrawStart={(pos) => {
                setDragStartPos(pos);
                canvasTools.handleDrawStart(pos, {
                  shift: false,
                  ctrl: false,
                  alt: false,
                  meta: false,
                });
              }}
              onDraw={canvasTools.handleDraw}
              onDrawEnd={() => {
                setDragStartPos(null);
                canvasTools.handleDrawEnd();
              }}
              onSelectionUpdate={(sel) =>
                updateState({ ...state, selection: sel }, { action: 'Select Area', tool: state.tool })
              }
              onMovePixels={canvasTools.handleMovePixels}
              onRotatePixels={canvasTools.handleRotatePixels}
              onScalePixels={onScalePixels}
              onZoom={(z) => updateState({ ...state, zoom: z })}
              onMousePosUpdate={setMousePos}
            />

            {/* Contextual Selection Bar (Anchored Cleanly Above Bottom Dock) */}
            <AnimatePresence>
              {!isSettingsExpanded && state.selection && state.selection.size > 0 && (
                <motion.div
                  key="mobile-selection-bar"
                  initial={shouldReduceMotion ? { opacity: 0 } : { y: 'calc(100% + 16px)' }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0, transition: { duration: 0.08 } }
                      : {
                          y: 'calc(100% + 16px)',
                          transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.08 }
                      : { type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }
                  }
                  className="pointer-events-auto absolute right-3 bottom-3 left-3 z-10 flex justify-center"
                >
                  <div className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-card p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => project.openOutlineDialog && project.openOutlineDialog()}
                      className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground active:opacity-90"
                    >
                      <Sparkles size={14} />
                      <span>Outline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateState({ ...state, selection: null }, { action: 'Deselect' })}
                      className="flex h-10 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X size={14} />
                      <span>Deselect</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expanded Tool Settings Tray */}
            <AnimatePresence>
              {isSettingsExpanded && hasAnySettings && (
                <motion.div
                  key="mobile-tool-settings-tray"
                  initial={shouldReduceMotion ? { opacity: 0 } : { y: 'calc(100% + 16px)' }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0, transition: { duration: 0.08 } }
                      : {
                          y: 'calc(100% + 16px)',
                          transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.08 }
                      : { type: 'spring', stiffness: 440, damping: 34, mass: 0.85 }
                  }
                  className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 mx-auto max-w-sm"
                >
                  <motion.div
                    ref={trayRef}
                    style={{
                      y: dragY,
                      scale: dragScale,
                    }}
                    onPointerDown={handleTrayPointerDown}
                    onPointerMove={handleTrayPointerMove}
                    onPointerUp={handleTrayPointerUpOrCancel}
                    onPointerCancel={handleTrayPointerUpOrCancel}
                    onClickCapture={(e) => {
                      if (suppressClickRef.current) {
                        e.stopPropagation();
                        e.preventDefault();
                      }
                    }}
                    className="pointer-events-auto flex flex-col gap-3 rounded-xl border border-border-strong bg-card p-3.5 shadow-2xl select-none touch-none"
                  >
                    <button
                      type="button"
                      onClick={() => setIsSettingsExpanded(false)}
                      aria-label="Collapse Tool Settings"
                      className="group mx-auto -my-1.5 flex w-20 cursor-grab items-center justify-center rounded-full py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    >
                      <span
                        className={`h-1 rounded-full transition-all duration-150 ${
                          isDraggingTray
                            ? 'w-11 bg-muted-foreground'
                            : 'w-9 bg-border-strong group-hover:bg-muted-foreground'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Tool Settings</span>
                    </div>

                {isBrushTool && (
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Brush Size
                        </span>
                        <span className="font-mono text-xs text-foreground tabular-nums">
                          {state.brushSize}px
                        </span>
                      </div>
                      <CustomSlider
                        min={1}
                        max={32}
                        value={state.brushSize}
                        onValueChange={(val) => updateState({ ...state, brushSize: val })}
                        aria-label="Brush size"
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">Shape</span>
                        <SegmentedControl
                          value={state.brushShape}
                          onValueChange={(val) => {
                            if (val === 'square' || val === 'circle') {
                              updateState({ ...state, brushShape: val });
                            }
                          }}
                        >
                          <SegmentedControlIndicator />
                          <SegmentedControlItem value="square" className="h-9">
                            <Square size={15} />
                          </SegmentedControlItem>
                          <SegmentedControlItem value="circle" className="h-9">
                            <Circle size={15} />
                          </SegmentedControlItem>
                        </SegmentedControl>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Symmetry
                        </span>
                        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-0.5">
                          <button
                            type="button"
                            onClick={toggleSymmetryX}
                            aria-label="Horizontal Symmetry"
                            aria-pressed={state.symmetry.x}
                            className={`flex h-9 items-center justify-center rounded-sm transition-colors ${
                              state.symmetry.x
                                ? 'bg-accent text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <FlipHorizontal size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={toggleSymmetryY}
                            aria-label="Vertical Symmetry"
                            aria-pressed={state.symmetry.y}
                            className={`flex h-9 items-center justify-center rounded-sm transition-colors ${
                              state.symmetry.y
                                ? 'bg-accent text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <FlipVertical size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateState({
                            ...state,
                            inkType: state.inkType === 'shading' ? 'simple' : 'shading',
                          })
                        }
                        className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${
                          state.inkType === 'shading'
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border bg-background text-muted-foreground'
                        }`}
                      >
                        <Droplets size={15} />
                        <span>{state.inkType === 'shading' ? 'Shading Ink' : 'Simple Ink'}</span>
                      </button>

                      {state.tool === 'pencil' && (
                        <button
                          type="button"
                          onClick={() => updateState({ ...state, pixelPerfect: !state.pixelPerfect })}
                          className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${
                            state.pixelPerfect
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border bg-background text-muted-foreground'
                          }`}
                        >
                          <Zap size={15} />
                          <span>Pixel Perfect</span>
                        </button>
                      )}
                    </div>

                    {state.tool === 'smudge' && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Smudge Mode
                          </span>
                          <SegmentedControl
                            value={state.smudgeMode || 'blend'}
                            onValueChange={(val) => {
                              if (val === 'blend' || val === 'push') {
                                updateState({ ...state, smudgeMode: val });
                              }
                            }}
                            className="w-auto"
                          >
                            <SegmentedControlIndicator />
                            <SegmentedControlItem value="blend" className="h-9 px-3">
                              Blend
                            </SegmentedControlItem>
                            <SegmentedControlItem value="push" className="h-9 px-3">
                              Push
                            </SegmentedControlItem>
                          </SegmentedControl>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Strength
                            </span>
                            <span className="font-mono text-xs text-foreground tabular-nums">
                              {Math.round((state.smudgeStrength ?? 0.7) * 100)}%
                            </span>
                          </div>
                          <CustomSlider
                            min={10}
                            max={100}
                            step={5}
                            value={Math.round((state.smudgeStrength ?? 0.7) * 100)}
                            onValueChange={(val) =>
                              updateState({ ...state, smudgeStrength: val / 100 })
                            }
                            aria-label="Smudge strength"
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(isFillTool || isMagicWand) && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Fill Scope
                    </span>
                    <SegmentedControl
                      value={state.fillContiguous ? 'contiguous' : 'global'}
                      onValueChange={(val) =>
                        updateState({ ...state, fillContiguous: val === 'contiguous' })
                      }
                    >
                      <SegmentedControlIndicator />
                      <SegmentedControlItem value="contiguous" className="h-10">
                        Contiguous
                      </SegmentedControlItem>
                      <SegmentedControlItem value="global" className="h-10">
                        Global
                      </SegmentedControlItem>
                    </SegmentedControl>
                  </div>
                )}

                {isMoveTool && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Rotation Algorithm
                    </span>
                    <SegmentedControl
                      value={state.rotationAlgorithm}
                      onValueChange={(val) => {
                        if (val === 'nearest' || val === 'rotsprite') {
                          updateState({ ...state, rotationAlgorithm: val });
                        }
                      }}
                    >
                      <SegmentedControlIndicator />
                      <SegmentedControlItem value="nearest" className="h-10">
                        Nearest
                      </SegmentedControlItem>
                      <SegmentedControlItem value="rotsprite" className="h-10">
                        RotSprite
                      </SegmentedControlItem>
                    </SegmentedControl>
                  </div>
                )}

                {isSelectionTool && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Selection Mode
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { mode: 'replace', label: 'New', icon: <Square size={14} /> },
                        { mode: 'add', label: 'Add', icon: <Plus size={14} /> },
                        { mode: 'subtract', label: 'Subtract', icon: <Minus size={14} /> },
                        { mode: 'intersect', label: 'Intersect', icon: <Waves size={14} /> },
                      ].map((m) => (
                        <button
                          key={m.mode}
                          type="button"
                          onClick={() => updateState({ ...state, selectionMode: m.mode as any })}
                          className={`flex h-11 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${
                            state.selectionMode === m.mode
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground'
                          }`}
                        >
                          {m.icon}
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Docked Two-Row Bottom Bar (44px+ Touch Targets, Zero Overlap) */}
          <footer className="z-20 shrink-0 border-t border-border bg-card pb-safe">
            {/* Row 1: Full-Width Scrollable Tool Strip */}
            <div className="flex h-12 items-center gap-1 overflow-x-auto border-b border-border bg-background/40 px-2 no-scrollbar">
              {tools.map((tool) => {
                const isActive = state.tool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => updateState({ ...state, tool: tool.id })}
                    aria-label={tool.label}
                    aria-pressed={isActive}
                    className={`flex h-10 min-w-[44px] shrink-0 items-center justify-center rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {tool.icon}
                  </button>
                );
              })}
            </div>

            {/* Row 2: Color Swatches, Tool Options & Panel Drawers */}
            <div className="flex h-14 items-center justify-between gap-2 px-2">
              <div className="flex items-center gap-1.5">
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Primary Color"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-border-strong shadow-xs"
                        style={{ backgroundColor: state.primaryColor }}
                      />
                    }
                  >
                    {state.inkType === 'shading' && (
                      <Droplets size={15} className="text-white/70 mix-blend-difference" />
                    )}
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={10}
                    className="w-auto border-none bg-transparent p-0 shadow-none"
                  >
                    <ColorPicker
                      color={state.primaryColor}
                      onChange={(c) => updateState({ ...state, primaryColor: c })}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Secondary Color"
                        className="h-11 w-9 shrink-0 rounded-md border border-border-strong shadow-xs"
                        style={{ backgroundColor: state.secondaryColor }}
                      />
                    }
                  />
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={10}
                    className="w-auto border-none bg-transparent p-0 shadow-none"
                  >
                    <ColorPicker
                      color={state.secondaryColor}
                      onChange={(c) => updateState({ ...state, secondaryColor: c })}
                    />
                  </PopoverContent>
                </Popover>

                <button
                  type="button"
                  onClick={handleSwapColors}
                  aria-label="Swap Colors"
                  className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground active:bg-accent"
                >
                  <ArrowRightLeft size={14} />
                </button>

                {hasAnySettings && (
                  <button
                    type="button"
                    onClick={() => setIsSettingsExpanded((v) => !v)}
                    aria-label="Tool Settings"
                    aria-expanded={isSettingsExpanded}
                    className={`flex h-11 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      isSettingsExpanded
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background text-foreground'
                    }`}
                  >
                    <Sliders size={14} className="text-primary" />
                    <span className="font-mono text-[11px] tabular-nums">{getSettingsSummary()}</span>
                    {isSettingsExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setActivePanel('palette')}
                  aria-label="Palette"
                  className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                    activePanel === 'palette'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <PaletteIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('layers')}
                  aria-label="Layers"
                  className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                    activePanel === 'layers'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Layers size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('timeline')}
                  aria-label="Timeline"
                  className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                    activePanel === 'timeline'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Clock size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('history')}
                  aria-label="History"
                  className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                    activePanel === 'history'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <HistoryIcon size={20} />
                </button>
              </div>
            </div>
          </footer>

          <Dialog
            open={!!activePanel}
            closeOnOutsidePress={false}
            onOpenChange={(open, details) => {
              if (!open) {
                details.cancel();
                dismissPanel();
              }
            }}
          >
            <DialogBackdrop
              ref={backdropRef}
              data-sheet="bottom"
              render={(props) => (
                <motion.div
                  {...props}
                  style={{
                    ...(props.style as React.CSSProperties | undefined),
                    opacity: sheetBackdropOpacity as unknown as number,
                  }}
                />
              )}
            />
            <DialogSheetContent
              ref={sheetRef}
              initialFocus="content"
              onClickCapture={(e) => {
                if (suppressSheetClickRef.current) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              render={(props) => (
                <motion.div
                  {...props}
                  style={{
                    ...(props.style as React.CSSProperties | undefined),
                    y: sheetY as unknown as number,
                  }}
                />
              )}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl border-t border-border-strong bg-card text-card-foreground shadow-2xl overscroll-y-contain">
                <div
                  className="flex shrink-0 cursor-grab items-center justify-center pt-2.5 pb-1 touch-none active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <div
                    className={`h-1 rounded-full transition-all duration-150 ${
                      isDraggingSheet ? 'w-11 bg-muted-foreground' : 'w-9 bg-border-strong'
                    }`}
                  />
                </div>
                <div className="flex h-11 shrink-0 cursor-grab items-center justify-between border-b border-border px-4 touch-none active:cursor-grabbing">
                  <DialogTitle className="text-sm font-semibold text-foreground">
                    {activePanel ? PANEL_TITLES[activePanel] : ''}
                  </DialogTitle>
                  <DialogClose
                    render={
                      <button
                        type="button"
                        aria-label="Close panel"
                        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      />
                    }
                  >
                    <X size={18} />
                  </DialogClose>
                </div>

                <DialogDescription className="sr-only">
                  {activePanel ? `${PANEL_TITLES[activePanel]} controls` : 'Panel controls'}
                </DialogDescription>

                <div className="flex min-h-0 flex-1 flex-col pb-safe">
                {activePanel === 'palette' && (
                  <div className="flex h-[52dvh] min-h-[340px] flex-col">
                    <Palette
                      width={0}
                      colors={state.palette}
                      palettes={state.paletteLibrary}
                      activePaletteId={state.activePaletteId}
                      primaryColor={state.primaryColor}
                      secondaryColor={state.secondaryColor}
                      onColorSelect={(c, p) =>
                        p
                          ? updateState({ ...state, primaryColor: c })
                          : updateState({ ...state, secondaryColor: c })
                      }
                      onAddColor={(c) => {
                        const updatedLibrary = state.paletteLibrary.map((p) =>
                          p.id === state.activePaletteId ? { ...p, colors: [...p.colors, c] } : p
                        );
                        updateState({
                          ...state,
                          paletteLibrary: updatedLibrary,
                          palette: [...state.palette, c],
                        });
                      }}
                      onSelectPalette={project.selectPalette}
                      onImportPalette={project.importPalette}
                      onResizeStart={() => {}}
                      onColorsSelected={(selectedColors) => {
                        updateState({ ...state, shades: selectedColors, inkType: 'shading' });
                      }}
                    />
                  </div>
                )}

                {activePanel === 'layers' && (
                  <div className="flex h-[50dvh] min-h-[320px] flex-col">
                    <LayersPanel
                      state={state}
                      onSelectLayers={(ids, active) =>
                        updateState({ ...state, selectedLayerIds: ids, activeLayerId: active })
                      }
                      onUpdateLayer={project.updateLayer}
                      onAddLayer={project.addLayer}
                      onAddGroupLayer={project.addGroupLayer}
                      onGroupSelectedLayers={project.groupSelectedLayers}
                      onUngroupSelectedLayers={project.ungroupSelectedLayers}
                      onAddLayerToGroup={project.addLayerToGroup}
                      onToggleCollapseAllGroups={project.toggleCollapseAllGroups}
                      onDuplicateLayer={project.duplicateLayer}
                      onDeleteLayer={project.deleteLayer}
                      onDuplicateSelectedLayers={project.duplicateSelectedLayers}
                      onDeleteSelectedLayers={project.deleteSelectedLayers}
                      onReorderLayers={project.reorderLayers}
                      onOpenLayerProperties={project.openLayerPropertiesDialog}
                      layerPropertiesState={layerPropertiesState}
                      onCloseLayerProperties={onCloseLayerProperties}
                      className="h-full w-full flex-1"
                    />
                  </div>
                )}

                {activePanel === 'timeline' && (
                  <div className="flex h-[52dvh] min-h-[320px] flex-col overflow-hidden">
                    <Timeline
                      state={state}
                      onSelectFrames={(indices, active, layerId) => {
                        const nextState = {
                          ...state,
                          selectedFrameIndices: indices,
                          activeFrameIndex: active,
                        };
                        if (layerId) {
                          nextState.activeLayerId = layerId;
                          nextState.selectedLayerIds = [layerId];
                        }
                        updateState(nextState);
                      }}
                      onAddFrame={project.addFrame}
                      onDuplicateFrame={project.duplicateFrame}
                      onDeleteFrame={project.deleteFrame}
                      onDuplicateSelectedFrames={project.duplicateSelectedFrames}
                      onDeleteSelectedFrames={project.deleteSelectedFrames}
                      onInsertFrame={project.insertFrame}
                      onTweenFrames={project.tweenFrames}
                      onSetFrameDuration={project.setFrameDuration}
                      onAddTag={project.addTag}
                      onSaveTag={project.saveTag}
                      onDeleteTag={project.deleteTag}
                      onOpenTagProperties={project.openTagPropertiesDialog}
                      activeTagPopover={activeTagPopover}
                      onCloseTagPopover={onCloseTagPopover}
                      onSelectLayer={(id) =>
                        updateState({ ...state, activeLayerId: id, selectedLayerIds: [id] })
                      }
                      onAddLayer={project.addLayer}
                      onAddGroupLayer={project.addGroupLayer}
                      onUpdateLayer={project.updateLayer}
                      onToggleLayerVisibility={(id) =>
                        updateState({
                          ...state,
                          layers: state.layers.map((l) =>
                            l.id === id ? { ...l, visible: !l.visible } : l
                          ),
                        })
                      }
                      onToggleLayerLock={(id) =>
                        updateState({
                          ...state,
                          layers: state.layers.map((l) =>
                            l.id === id ? { ...l, locked: !l.locked } : l
                          ),
                        })
                      }
                      onReorderLayers={project.reorderLayers}
                      onReorderFrames={project.reorderFrames}
                    />
                  </div>
                )}

                {activePanel === 'history' && (
                  <div className="flex h-[50dvh] min-h-[320px] flex-col">
                    <HistoryPanel
                      history={project.history}
                      historyIndex={project.historyIndex}
                      onJumpToHistory={project.jumpToHistory}
                      className="h-full w-full flex-1"
                    />
                  </div>
                )}

                {activePanel === 'preview' && (
                  <div className="flex h-[50dvh] min-h-[320px] flex-col bg-card">
                    <Preview state={state} width={0} isFloating={false} />
                  </div>
                )}

                {activePanel === 'menu' && (
                  <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                    <div className="space-y-2">
                      <span className="px-0.5 text-[11px] font-semibold text-muted-foreground">
                        File &amp; Export
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            project.createProject();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Plus size={16} className="text-muted-foreground" />
                          <span>New Canvas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <FolderOpen size={16} className="text-muted-foreground" />
                          <span>Open File</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            project.saveProject();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Check size={16} className="text-muted-foreground" />
                          <span>Save Project</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (project.openExportDialog) {
                              project.openExportDialog('gif');
                            } else {
                              project.downloadImage();
                            }
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg bg-primary px-3 py-2 text-left text-xs font-semibold text-primary-foreground active:opacity-90"
                        >
                          <Download size={16} />
                          <span>Export...</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="px-0.5 text-[11px] font-semibold text-muted-foreground">
                        Canvas &amp; Tools
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            closePanel();
                            commands.find((c) => c.id === 'app.commandPalette')?.perform();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <CommandIcon size={16} className="text-primary" />
                          <span>Command Palette</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateState({ ...state, tiled: !state.tiled });
                            closePanel();
                          }}
                          className={`flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                            state.tiled
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border bg-background text-foreground'
                          }`}
                        >
                          <Grid size={16} />
                          <span>Tiled View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closePanel();
                            commands.find((c) => c.id === 'view.referenceImage')?.perform();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <ImageIcon size={16} className="text-muted-foreground" />
                          <span>Reference Image</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closePanel();
                            project.openOutlineDialog?.();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Sparkles size={16} className="text-primary" />
                          <span>Outline FX...</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="px-0.5 text-[11px] font-semibold text-muted-foreground">
                        Sprite &amp; Properties
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            project.openSpritePropertiesDialog?.();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Settings size={16} className="text-primary" />
                          <span>Sprite Properties</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            project.openSlicesDialog?.();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Crop size={16} className="text-primary" />
                          <span>Slice Manager</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commands.find((c) => c.id === 'sprite.resize')?.perform();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Maximize2 size={16} className="text-muted-foreground" />
                          <span>Resize Canvas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            project.openLayerPropertiesDialog?.();
                            closePanel();
                          }}
                          className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Layers size={16} className="text-muted-foreground" />
                          <span>Layer Properties</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            project.openTagPropertiesDialog?.();
                            closePanel();
                          }}
                          className="col-span-2 flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition-colors active:bg-accent"
                        >
                          <Tag size={16} className="text-primary" />
                          <span>New Animation Tag...</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="px-0.5 text-[11px] font-semibold text-muted-foreground">
                        Recent Projects
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {project.recentProjects.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                            No recent projects
                          </div>
                        ) : (
                          project.recentProjects.map((p: any) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                project.loadRecentProject(p);
                                closePanel();
                              }}
                              className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors active:bg-accent"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-foreground">
                                  {p.title}
                                </div>
                                <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                  {p.width}×{p.height} ·{' '}
                                  {new Date(p.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
              {/* Covers bottom rubber-band gap during upward over-drag */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-full h-16 bg-card"
              />
            </DialogSheetContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
