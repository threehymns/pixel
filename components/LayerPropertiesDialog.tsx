import React, { useState, useEffect } from 'react';
import { Layer, LayerBlendMode } from '../types';
import {
  X,
  Layers,
  Lock,
  Eye,
  ShieldAlert,
  Link as LinkIcon,
  Image as ImageIcon,
  Palette,
  Check,
} from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent, PopoverArrow } from './ui/popover';
import { CustomCheckbox } from './ui/checkbox';
import { CustomSlider } from './ui/slider';

export interface LayerPropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer | null;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  isEmbedded?: boolean;
}

const BLEND_MODES: { value: LayerBlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
  { value: 'addition', label: 'Addition' },
  { value: 'subtract', label: 'Subtract' },
  { value: 'divide', label: 'Divide' },
];

const COLOR_TAGS = [
  { id: 'red', label: 'Red', color: '#ef4444' },
  { id: 'orange', label: 'Orange', color: '#f97316' },
  { id: 'yellow', label: 'Yellow', color: '#eab308' },
  { id: 'green', label: 'Green', color: '#22c55e' },
  { id: 'blue', label: 'Blue', color: '#3b82f6' },
  { id: 'purple', label: 'Purple', color: '#a855f7' },
  { id: 'pink', label: 'Pink', color: '#ec4899' },
];

export const LayerPropertiesDialogContent: React.FC<{
  layer: Layer;
  onClose: () => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
}> = ({ layer, onClose, onUpdateLayer }) => {
  const initialOpacity = layer.opacity != null && !isNaN(layer.opacity) ? layer.opacity : 100;
  const [name, setName] = useState(layer.name);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [blendMode, setBlendMode] = useState<LayerBlendMode>(layer.blendMode || 'normal');
  const [visible, setVisible] = useState(layer.visible ?? true);
  const [locked, setLocked] = useState(layer.locked ?? false);
  const [lockMovement, setLockMovement] = useState(layer.lockMovement ?? false);
  const [isBackground, setIsBackground] = useState(layer.isBackground ?? false);
  const [preferLinkedCels, setPreferLinkedCels] = useState(layer.preferLinkedCels ?? false);
  const [isReference, setIsReference] = useState(layer.isReference ?? false);
  const [colorTag, setColorTag] = useState<string | undefined>(layer.colorTag);
  const [userText, setUserText] = useState(layer.userData?.text || '');
  const [userColor, setUserColor] = useState<string>(
    layer.userData?.color
      ? `#${layer.userData.color.r.toString(16).padStart(2, '0')}${layer.userData.color.g.toString(16).padStart(2, '0')}${layer.userData.color.b.toString(16).padStart(2, '0')}`
      : '#000000'
  );
  const [hasUserColor, setHasUserColor] = useState(!!layer.userData?.color);

  useEffect(() => {
    setName(layer.name);
    setOpacity(layer.opacity != null && !isNaN(layer.opacity) ? layer.opacity : 100);
    setBlendMode(layer.blendMode || 'normal');
    setVisible(layer.visible ?? true);
    setLocked(layer.locked ?? false);
    setLockMovement(layer.lockMovement ?? false);
    setIsBackground(layer.isBackground ?? false);
    setPreferLinkedCels(layer.preferLinkedCels ?? false);
    setIsReference(layer.isReference ?? false);
    setColorTag(layer.colorTag);
    setUserText(layer.userData?.text || '');
    setUserColor(
      layer.userData?.color
        ? `#${layer.userData.color.r.toString(16).padStart(2, '0')}${layer.userData.color.g.toString(16).padStart(2, '0')}${layer.userData.color.b.toString(16).padStart(2, '0')}`
        : '#000000'
    );
    setHasUserColor(!!layer.userData?.color);
  }, [layer]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let hexColorObj = layer.userData?.color;
    if (hasUserColor && userColor) {
      const hex = userColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      hexColorObj = { r, g, b, a: 255 };
    } else if (!hasUserColor) {
      hexColorObj = undefined;
    }

    onUpdateLayer(layer.id, {
      name: name.trim() || layer.name,
      opacity,
      blendMode,
      visible,
      locked,
      lockMovement,
      isBackground,
      preferLinkedCels,
      isReference,
      colorTag,
      userData: {
        ...layer.userData,
        text: userText || undefined,
        color: hexColorObj,
      },
    });

    onClose();
  };

  return (
    <div
      className="w-80 bg-popover text-popover-foreground border border-border shadow-2xl rounded-xl p-3.5 flex flex-col gap-3 text-xs outline-none select-none relative"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <PopoverArrow />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
          <Layers size={14} className="text-primary shrink-0" />
          <span>Layer Properties</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Form Body */}
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Name */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Layer name"
            autoFocus
            className="col-span-2 bg-background border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Blend Mode */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Blend Mode</label>
          <select
            value={blendMode}
            onChange={(e) => setBlendMode(e.target.value as LayerBlendMode)}
            className="col-span-2 bg-background border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary capitalize cursor-pointer"
          >
            {BLEND_MODES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* Opacity using CustomSlider */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Opacity</label>
          <div className="col-span-2 flex items-center gap-2">
            <CustomSlider
              value={opacity}
              onValueChange={(val) => setOpacity(val)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setOpacity(isNaN(val) ? 100 : Math.max(0, Math.min(100, val)));
              }}
              className="w-12 bg-background border border-border rounded-md px-1 py-0.5 text-xs font-mono font-medium text-foreground text-center outline-none focus:ring-1 focus:ring-primary focus:border-primary shrink-0"
            />
            <span className="text-[10px] font-mono text-muted-foreground">%</span>
          </div>
        </div>

        {/* Color Tag */}
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-muted-foreground font-medium">Color Tag</label>
          <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setColorTag(undefined)}
              className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                !colorTag
                  ? 'border-primary bg-primary/10 text-foreground font-semibold'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              None
            </button>
            {COLOR_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setColorTag(t.id)}
                title={t.label}
                className={`w-4 h-4 rounded-full border transition-transform cursor-pointer relative flex items-center justify-center ${
                  colorTag === t.id
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-popover scale-110 border-white'
                    : 'border-black/10 dark:border-white/10 hover:scale-105'
                }`}
                style={{ backgroundColor: t.color }}
              >
                {colorTag === t.id && <Check size={10} className="text-white drop-shadow-xs" />}
              </button>
            ))}
          </div>
        </div>

        {/* Flags with CustomCheckbox */}
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Flags</span>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors">
              <CustomCheckbox
                checked={visible}
                onCheckedChange={(c) => setVisible(!!c)}
              />
              <Eye size={12} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-[11px] text-foreground">Visible</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors">
              <CustomCheckbox
                checked={locked}
                onCheckedChange={(c) => setLocked(!!c)}
              />
              <Lock size={12} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-[11px] text-foreground">Locked</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors">
              <CustomCheckbox
                checked={lockMovement}
                onCheckedChange={(c) => setLockMovement(!!c)}
              />
              <ShieldAlert size={12} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-[11px] text-foreground">Lock Motion</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors">
              <CustomCheckbox
                checked={isBackground}
                onCheckedChange={(c) => setIsBackground(!!c)}
              />
              <Layers size={12} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-[11px] text-foreground">Background</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors">
              <CustomCheckbox
                checked={preferLinkedCels}
                onCheckedChange={(c) => setPreferLinkedCels(!!c)}
              />
              <LinkIcon size={12} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-[11px] text-foreground">Linked Cels</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors">
              <CustomCheckbox
                checked={isReference}
                onCheckedChange={(c) => setIsReference(!!c)}
              />
              <ImageIcon size={12} className="text-muted-foreground shrink-0" />
              <span className="font-medium text-[11px] text-foreground">Reference</span>
            </label>
          </div>
        </div>

        {/* User Notes & Highlight */}
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              <Palette size={12} className="text-primary shrink-0" />
              <span>User Notes</span>
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <CustomCheckbox
                checked={hasUserColor}
                onCheckedChange={(c) => setHasUserColor(!!c)}
              />
              <span className="text-[10px] text-muted-foreground">Highlight</span>
              {hasUserColor && (
                <input
                  type="color"
                  value={userColor}
                  onChange={(e) => setUserColor(e.target.value)}
                  className="w-3.5 h-3.5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
              )}
            </label>
          </div>
          <input
            type="text"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Notes or metadata..."
            className="bg-background border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60 mt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleSubmit()}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground font-medium rounded-md shadow-xs hover:bg-primary/90 transition-colors text-xs"
        >
          <Check size={13} />
          <span>Save Layer</span>
        </button>
      </div>
    </div>
  );
};

export const LayerPropertiesDialog: React.FC<LayerPropertiesDialogProps> = ({
  isOpen,
  onClose,
  layer,
  onUpdateLayer,
  isEmbedded = false,
}) => {
  if (!isOpen || !layer) return null;

  if (isEmbedded) {
    return (
      <LayerPropertiesDialogContent
        layer={layer}
        onClose={onClose}
        onUpdateLayer={onUpdateLayer}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <LayerPropertiesDialogContent
        layer={layer}
        onClose={onClose}
        onUpdateLayer={onUpdateLayer}
      />
    </div>
  );
};
