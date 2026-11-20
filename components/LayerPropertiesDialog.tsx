import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Layer, LayerBlendMode } from '../types';
import { ENTITY_COLOR_TAGS } from '../constants';
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
import { Textarea } from './ui/textarea';
import { Button, IconButton } from './ui/button';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import { ColorSwatchField } from './ui/color-picker';
import { cn } from '../lib/utils';

export interface LayerPropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  layer: Layer | null;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onPreviewLayer?: (id: string, updates: Partial<Layer>) => void;
  onRevertPreview?: (id: string, snapshot: Partial<Layer>) => void;
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

const rgbToHex = (c?: { r: number; g: number; b: number }) =>
  c
    ? `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`
    : '#3b82f6';

export const LayerPropertiesDialogContent: React.FC<{
  layer: Layer;
  onClose: () => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onPreviewLayer?: (id: string, updates: Partial<Layer>) => void;
  onRevertPreview?: (id: string, snapshot: Partial<Layer>) => void;
  hideHeader?: boolean;
}> = ({
  layer,
  onClose,
  onUpdateLayer,
  onPreviewLayer,
  onRevertPreview,
  hideHeader = false,
}) => {
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
  const [userColor, setUserColor] = useState<string>(rgbToHex(layer.userData?.color));
  const [hasUserColor, setHasUserColor] = useState(!!layer.userData?.color);

  const snapshotRef = useRef<{ id: string; data: Partial<Layer> }>({
    id: layer.id,
    data: {
      opacity: initialOpacity,
      blendMode: layer.blendMode || 'normal',
      visible: layer.visible ?? true,
      colorTag: layer.colorTag,
    },
  });
  const isCommittedRef = useRef(false);
  const hasPreviewedRef = useRef(false);
  const onPreviewRef = useRef(onPreviewLayer);
  const onRevertRef = useRef(onRevertPreview);

  useLayoutEffect(() => {
    onPreviewRef.current = onPreviewLayer;
    onRevertRef.current = onRevertPreview;
  });

  // Reset form and capture a fresh snapshot only when switching to a different layer ID
  useEffect(() => {
    const nextOpacity = layer.opacity != null && !isNaN(layer.opacity) ? layer.opacity : 100;
    snapshotRef.current = {
      id: layer.id,
      data: {
        opacity: nextOpacity,
        blendMode: layer.blendMode || 'normal',
        visible: layer.visible ?? true,
        colorTag: layer.colorTag,
      },
    };
    isCommittedRef.current = false;
    hasPreviewedRef.current = false;

    setName(layer.name);
    setOpacity(nextOpacity);
    setBlendMode(layer.blendMode || 'normal');
    setVisible(layer.visible ?? true);
    setLocked(layer.locked ?? false);
    setLockMovement(layer.lockMovement ?? false);
    setIsBackground(layer.isBackground ?? false);
    setPreferLinkedCels(layer.preferLinkedCels ?? false);
    setIsReference(layer.isReference ?? false);
    setColorTag(layer.colorTag);
    setUserText(layer.userData?.text || '');
    setUserColor(rgbToHex(layer.userData?.color));
    setHasUserColor(!!layer.userData?.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id]);

  // Revert uncommitted live preview if unmounted via backdrop/Escape/click-away
  useEffect(() => {
    return () => {
      if (!isCommittedRef.current && hasPreviewedRef.current) {
        onRevertRef.current?.(snapshotRef.current.id, snapshotRef.current.data);
      }
    };
  }, []);

  const emitPreview = (patch: Partial<Layer>) => {
    if (!onPreviewRef.current) return;
    hasPreviewedRef.current = true;
    onPreviewRef.current(layer.id, patch);
  };

  const handleCancel = () => {
    if (!isCommittedRef.current && hasPreviewedRef.current) {
      onRevertRef.current?.(snapshotRef.current.id, snapshotRef.current.data);
      hasPreviewedRef.current = false;
    }
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    isCommittedRef.current = true;
    hasPreviewedRef.current = false;

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
      opacity: Math.max(0, Math.min(100, Math.round(opacity))),
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
        text: userText.trim() || undefined,
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
          handleCancel();
        }
      }}
    >
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers size={14} className="shrink-0 text-muted-foreground" />
            <span>Layer Properties</span>
          </div>
          <IconButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCancel}
            aria-label="Close layer properties"
          >
            <X size={13} />
          </IconButton>
        </div>
      )}

      <div className="flex flex-col gap-3 text-xs">
        <div className="grid grid-cols-3 items-center gap-2">
          <FieldLabel htmlFor="layer-name-input">Name</FieldLabel>
          <Input
            id="layer-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Layer name"
            autoFocus
            className="col-span-2 h-7"
          />
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <FieldLabel>Blend Mode</FieldLabel>
          <div className="col-span-2">
            <StudioSelect<LayerBlendMode>
              value={blendMode}
              options={BLEND_MODES}
              onValueChange={(next) => {
                setBlendMode(next);
                emitPreview({ blendMode: next });
              }}
              className="h-7"
              aria-label="Layer blend mode"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <FieldLabel>Opacity</FieldLabel>
          <div className="col-span-2 flex items-center gap-2">
            <CustomSlider
              value={opacity}
              onValueChange={(val) => {
                setOpacity(val);
                emitPreview({ opacity: val });
              }}
              min={0}
              max={100}
              step={1}
              aria-label="Layer opacity"
              className="flex-1"
            />
            <StudioNumberInput
              value={opacity}
              onValueChange={(val) => {
                const clamped = Math.max(0, Math.min(100, Math.round(val)));
                setOpacity(clamped);
                emitPreview({ opacity: clamped });
              }}
              min={0}
              max={100}
              suffix="%"
              aria-label="Opacity percentage"
              className="w-16 shrink-0"
              inputClassName="px-1.5 text-right"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <FieldLabel>Color Tag</FieldLabel>
          <div className="col-span-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setColorTag(undefined);
                emitPreview({ colorTag: undefined });
              }}
              className={cn(
                'rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !colorTag
                  ? 'border-primary bg-primary/15 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              None
            </button>
            {ENTITY_COLOR_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={t.label}
                aria-pressed={colorTag === t.id}
                onClick={() => {
                  setColorTag(t.id);
                  emitPreview({ colorTag: t.id });
                }}
                className={cn(
                  'relative flex h-4 w-4 items-center justify-center rounded-full border transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  colorTag === t.id
                    ? 'scale-110 border-foreground ring-2 ring-primary ring-offset-1 ring-offset-popover'
                    : 'border-border-strong hover:scale-105'
                )}
                style={{ backgroundColor: t.hex }}
              >
                {colorTag === t.id && <Check size={10} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <FieldLabel>Flags</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                {
                  label: 'Visible',
                  checked: visible,
                  setter: (v: boolean) => {
                    setVisible(v);
                    emitPreview({ visible: v });
                  },
                  icon: <Eye size={12} />,
                },
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

        <Field className="border-t border-border pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="layer-notes-input" className="flex items-center gap-1">
              <Palette size={12} />
              <span>User Notes</span>
            </FieldLabel>
            <div className="flex items-center gap-1.5">
              <label className="flex cursor-pointer items-center gap-1.5">
                <CustomCheckbox checked={hasUserColor} onCheckedChange={setHasUserColor} />
                <span className="text-[11px] text-muted-foreground">Highlight</span>
              </label>
              {hasUserColor && (
                <ColorSwatchField
                  value={userColor}
                  onChange={setUserColor}
                  presets={ENTITY_COLOR_TAGS.map((t) => t.hex)}
                  label="User note highlight color"
                  className="h-6 px-1.5 text-[10px]"
                />
              )}
            </div>
          </div>
          <Textarea
            id="layer-notes-input"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Notes or engine metadata..."
            rows={2}
          />
        </Field>
      </div>

      <div className="mt-1 flex items-center justify-end gap-1.5 border-t border-border pt-2.5">
        <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => handleSubmit()}>
          <Check size={12} />
          <span>Save Layer</span>
        </Button>
      </div>
    </div>
  );
};

export const LayerPropertiesDialog: React.FC<LayerPropertiesDialogProps> = ({
  isOpen,
  onClose,
  layer,
  onUpdateLayer,
  onPreviewLayer,
  onRevertPreview,
  isEmbedded = false,
}) => {
  if (isEmbedded) {
    if (!isOpen || !layer) return null;
    return (
      <LayerPropertiesDialogContent
        layer={layer}
        onClose={onClose}
        onUpdateLayer={onUpdateLayer}
        onPreviewLayer={onPreviewLayer}
        onRevertPreview={onRevertPreview}
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
          onPreviewLayer={onPreviewLayer}
          onRevertPreview={onRevertPreview}
          hideHeader
        />
      )}
    </ModalShell>
  );
};
