import React, { useState, useEffect } from 'react';
import { ImageIcon, Trash2, Eye, EyeOff } from './Icons';
import { ModalShell } from './ui/dialog';
import { CustomSlider } from './ui/slider';
import { Input } from './ui/input';

interface ReferenceImageConfig {
  url: string;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

interface ReferenceImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  referenceImage: ReferenceImageConfig | null;
  onUpdate: (config: ReferenceImageConfig | null) => void;
}

const DEFAULT_CONFIG: ReferenceImageConfig = {
  url: '',
  opacity: 50,
  x: 0,
  y: 0,
  scale: 1,
  visible: true,
};

export const ReferenceImageDialog: React.FC<ReferenceImageDialogProps> = ({
  isOpen,
  onClose,
  referenceImage,
  onUpdate,
}) => {
  const [localConfig, setLocalConfig] = useState<ReferenceImageConfig>(
    referenceImage || DEFAULT_CONFIG
  );

  useEffect(() => {
    if (!isOpen) return;
    setLocalConfig(referenceImage || DEFAULT_CONFIG);
  }, [isOpen, referenceImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newConfig = { ...localConfig, url, visible: true };
      setLocalConfig(newConfig);
      onUpdate(newConfig);
    }
  };

  const update = (patch: Partial<ReferenceImageConfig>) => {
    const newConfig = { ...localConfig, ...patch };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Reference Image"
      maxWidthClassName="max-w-sm"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-7 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Done
        </button>
      }
    >
      {!localConfig.url ? (
        <label className="relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-background/40 p-8 text-center transition-colors hover:bg-accent/40">
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={handleFileChange}
          />
          <ImageIcon size={28} className="text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Click to upload reference</p>
          <p className="text-[11px] text-muted-foreground">PNG, JPG, or SVG</p>
        </label>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="checkerboard-alpha group relative aspect-video overflow-hidden rounded-lg border border-border">
            <img
              src={localConfig.url}
              className="h-full w-full object-contain"
              alt="Reference"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                aria-label={localConfig.visible ? 'Hide reference' : 'Show reference'}
                onClick={() => update({ visible: !localConfig.visible })}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-card/90 text-foreground transition-colors hover:bg-card"
              >
                {localConfig.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button
                type="button"
                aria-label="Remove reference image"
                onClick={() => {
                  setLocalConfig(DEFAULT_CONFIG);
                  onUpdate(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                <span>Opacity</span>
                <span className="font-mono text-foreground tabular-nums">
                  {localConfig.opacity}%
                </span>
              </div>
              <CustomSlider
                value={localConfig.opacity}
                onValueChange={(v) => update({ opacity: v })}
                aria-label="Reference opacity"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                <span>Scale</span>
                <span className="font-mono text-foreground tabular-nums">
                  {localConfig.scale.toFixed(2)}×
                </span>
              </div>
              <CustomSlider
                value={Math.round(localConfig.scale * 100)}
                onValueChange={(v) => update({ scale: v / 100 })}
                min={10}
                max={400}
                aria-label="Reference scale"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Offset X</label>
                <Input
                  type="number"
                  value={localConfig.x}
                  onChange={(e) => update({ x: parseInt(e.target.value, 10) || 0 })}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Offset Y</label>
                <Input
                  type="number"
                  value={localConfig.y}
                  onChange={(e) => update({ y: parseInt(e.target.value, 10) || 0 })}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};
