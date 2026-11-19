import React, { useState, useEffect } from 'react';
import { Layer, LayerBlendMode } from '../types';
import {
  X,
  Layers,
  Lock,
  Eye,
  ShieldAlert,
  LinkIcon,
  ImageIcon,
  Palette,
  Check,
} from './Icons';
import { ModalShell } from './ui/dialog';
import { CustomCheckbox } from './ui/checkbox';
import { CustomSlider } from './ui/slider';
import { StudioSelect } from './ui/select';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

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
  hideHeader?: boolean;
}> = ({ layer, onClose, onUpdateLayer, hideHeader = false }) => {
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
      className={cn(
        'flex flex-col gap-3 text-xs text-popover-foreground outline-none select-none',
        !hideHeader && 'w-80'
      )}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' &&
          e.target instanceof HTMLInputElement &&
          e.target.type !== 'checkbox'
        ) {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === 'Escape' && !hideHeader) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers size={14} className="shrink-0 text-muted-foreground" />
            <span>Layer Properties</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close layer properties"
            className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5 text-xs">
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-[11px] font-medium text-muted-foreground">Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Layer name"
            autoFocus
            className="col-span-2 h-7"
          />
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Blend Mode</span>
          <div className="col-span-2">
            <StudioSelect<LayerBlendMode>
              value={blendMode}
              options={BLEND_MODES}
              onValueChange={setBlendMode}
              className="h-7"
              aria-label="Layer blend mode"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Opacity</span>
          <div className="col-span-2 flex items-center gap-2">
            <CustomSlider
              value={opacity}
              onValueChange={setOpacity}
              min={0}
              max={100}
              step={1}
              aria-label="Layer opacity"
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={opacity}
              aria-label="Opacity percentage"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setOpacity(isNaN(val) ? 100 : Math.max(0, Math.min(100, val)));
              }}
              className="h-7 w-12 shrink-0 px-1 text-center font-mono tabular-nums"
            />
            <span className="font-mono text-[11px] text-muted-foreground">%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Color Tag</span>
          <div className="col-span-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setColorTag(undefined)}
              className={cn(
                'rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors',
                !colorTag
                  ? 'border-primary bg-primary/15 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              None
            </button>
            {COLOR_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={t.label}
                onClick={() => setColorTag(t.id)}
                className={cn(
                  'relative flex h-4 w-4 items-center justify-center rounded-full border transition-transform',
                  colorTag === t.id
                    ? 'scale-110 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-popover'
                    : 'border-border-strong hover:scale-105'
                )}
                style={{ backgroundColor: t.color }}
              >
                {colorTag === t.id && <Check size={10} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          <span className="text-[11px] font-medium text-muted-foreground">Flags</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { label: 'Visible', checked: visible, setter: setVisible, icon: <Eye size={12} /> },
                { label: 'Locked', checked: locked, setter: setLocked, icon: <Lock size={12} /> },
                {
                  label: 'Lock Motion',
                  checked: lockMovement,
                  setter: setLockMovement,
                  icon: <ShieldAlert size={12} />,
                },
                {
                  label: 'Background',
                  checked: isBackground,
                  setter: setIsBackground,
                  icon: <Layers size={12} />,
                },
                {
                  label: 'Linked Cels',
                  checked: preferLinkedCels,
                  setter: setPreferLinkedCels,
                  icon: <LinkIcon size={12} />,
                },
                {
                  label: 'Reference',
                  checked: isReference,
                  setter: setIsReference,
                  icon: <ImageIcon size={12} />,
                },
              ] as const
            ).map((flag) => (
              <label
                key={flag.label}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background/50 p-1.5 transition-colors hover:bg-accent/60"
              >
                <CustomCheckbox checked={flag.checked} onCheckedChange={flag.setter} />
                <span className="shrink-0 text-muted-foreground">{flag.icon}</span>
                <span className="text-[11px] font-medium text-foreground">{flag.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              <Palette size={12} />
              <span>User Notes</span>
            </span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <CustomCheckbox checked={hasUserColor} onCheckedChange={setHasUserColor} />
              <span className="text-[11px] text-muted-foreground">Highlight</span>
              {hasUserColor && (
                <input
                  type="color"
                  value={userColor}
                  onChange={(e) => setUserColor(e.target.value)}
                  aria-label="User note highlight color"
                  className="h-3.5 w-3.5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              )}
            </label>
          </div>
          <Input
            type="text"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Notes or metadata..."
            className="h-7"
          />
        </div>
      </div>

      <div className="mt-1 flex items-center justify-end gap-1.5 border-t border-border pt-2">
        <button
          type="button"
          onClick={onClose}
          className="h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleSubmit()}
          className="flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Check size={12} />
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
  if (isEmbedded) {
    if (!isOpen || !layer) return null;
    return (
      <LayerPropertiesDialogContent
        layer={layer}
        onClose={onClose}
        onUpdateLayer={onUpdateLayer}
      />
    );
  }

  return (
    <ModalShell
      open={isOpen && !!layer}
      onClose={onClose}
      title="Layer Properties"
      maxWidthClassName="max-w-sm"
    >
      {layer && (
        <LayerPropertiesDialogContent
          layer={layer}
          onClose={onClose}
          onUpdateLayer={onUpdateLayer}
          hideHeader
        />
      )}
    </ModalShell>
  );
};
