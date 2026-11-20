import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ImageIcon, Trash2, Check, Upload } from './Icons';
import { ModalShell } from './ui/dialog';
import { CustomSlider } from './ui/slider';
import { Switch } from './ui/switch';
import { Button, IconButton } from './ui/button';
import { Field, FieldLabel } from './ui/field';
import { StudioNumberInput } from './ui/number-input';
import { FileInput, FileInputDropzone } from './ui/file-input';

export interface ReferenceImageConfig {
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
  onPreview?: (config: ReferenceImageConfig | null) => void;
  onRevertPreview?: (snapshot: ReferenceImageConfig | null) => void;
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
  onPreview,
  onRevertPreview,
}) => {
  const [localConfig, setLocalConfig] = useState<ReferenceImageConfig>(
    referenceImage || DEFAULT_CONFIG
  );

  const wasOpenRef = useRef(false);
  const snapshotRef = useRef<ReferenceImageConfig | null>(referenceImage);
  const isCommittedRef = useRef(false);
  const hasPreviewedRef = useRef(false);
  const onPreviewRef = useRef(onPreview || onUpdate);
  const onRevertRef = useRef(onRevertPreview || onUpdate);

  useLayoutEffect(() => {
    onPreviewRef.current = onPreview || onUpdate;
    onRevertRef.current = onRevertPreview || onUpdate;
  });

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const justClosed = !isOpen && wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      snapshotRef.current = referenceImage ? { ...referenceImage } : null;
      isCommittedRef.current = false;
      hasPreviewedRef.current = false;
      setLocalConfig(referenceImage ? { ...referenceImage } : DEFAULT_CONFIG);
    } else if (justClosed) {
      if (!isCommittedRef.current && hasPreviewedRef.current) {
        onRevertRef.current(snapshotRef.current);
      }
      hasPreviewedRef.current = false;
    }
  }, [isOpen, referenceImage]);

  useEffect(() => {
    return () => {
      if (!isCommittedRef.current && hasPreviewedRef.current) {
        onRevertRef.current(snapshotRef.current);
      }
    };
  }, []);

  const applyDraft = (next: ReferenceImageConfig | null) => {
    hasPreviewedRef.current = true;
    if (next && next.url) {
      setLocalConfig(next);
      onPreviewRef.current(next);
    } else {
      setLocalConfig(DEFAULT_CONFIG);
      onPreviewRef.current(null);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    applyDraft({ ...localConfig, url, visible: true });
  };

  const handleCancel = () => {
    if (!isCommittedRef.current && hasPreviewedRef.current) {
      onRevertRef.current(snapshotRef.current);
      hasPreviewedRef.current = false;
    }
    onClose();
  };

  const handleSave = () => {
    isCommittedRef.current = true;
    hasPreviewedRef.current = false;
    onUpdate(localConfig.url ? localConfig : null);
    onClose();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={handleCancel}
      title="Reference Image"
      subtitle="Trace over an image layer on the canvas"
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleSave}>
            <Check size={12} />
            <span>Save Reference</span>
          </Button>
        </>
      }
    >
      {!localConfig.url ? (
        <FileInput accept="image/*" onValueChange={handleFilesSelected}>
          <FileInputDropzone className="p-8">
            <ImageIcon size={28} className="text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              Drop reference image or click to browse
            </p>
            <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP, or SVG</p>
          </FileInputDropzone>
        </FileInput>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="checkerboard-alpha group relative aspect-video overflow-hidden rounded-lg border border-border">
            <img
              src={localConfig.url}
              className="h-full w-full object-contain"
              style={{ opacity: localConfig.visible ? localConfig.opacity / 100 : 0.2 }}
              alt="Reference preview"
            />
            <div className="absolute right-2 top-2 flex items-center gap-1.5">
              <FileInput accept="image/*" onValueChange={handleFilesSelected}>
                <FileInputDropzone className="h-7 flex-row gap-1 border-solid bg-card/90 px-2 py-0 text-[11px] font-medium text-foreground hover:bg-card">
                  <Upload size={12} />
                  <span>Replace</span>
                </FileInputDropzone>
              </FileInput>
              <IconButton
                type="button"
                variant="destructive"
                size="sm"
                aria-label="Remove reference image"
                onClick={() => applyDraft(null)}
              >
                <Trash2 size={13} />
              </IconButton>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2">
            <span className="text-xs font-medium text-foreground">Visible on Canvas</span>
            <Switch
              checked={localConfig.visible}
              onCheckedChange={(v) => applyDraft({ ...localConfig, visible: v })}
              aria-label="Toggle reference visibility"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Field>
              <div className="flex justify-between">
                <FieldLabel>Opacity</FieldLabel>
                <span className="font-mono text-[11px] text-foreground tabular-nums">
                  {localConfig.opacity}%
                </span>
              </div>
              <CustomSlider
                value={localConfig.opacity}
                onValueChange={(v) => applyDraft({ ...localConfig, opacity: v })}
                min={0}
                max={100}
                aria-label="Reference opacity"
              />
            </Field>

            <Field>
              <div className="flex justify-between">
                <FieldLabel>Scale</FieldLabel>
                <span className="font-mono text-[11px] text-foreground tabular-nums">
                  {localConfig.scale.toFixed(2)}×
                </span>
              </div>
              <CustomSlider
                value={Math.round(localConfig.scale * 100)}
                onValueChange={(v) => applyDraft({ ...localConfig, scale: v / 100 })}
                min={10}
                max={400}
                aria-label="Reference scale"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Offset X</FieldLabel>
                <StudioNumberInput
                  value={localConfig.x}
                  onValueChange={(v) => applyDraft({ ...localConfig, x: v })}
                  prefix="X"
                  suffix="px"
                  aria-label="Reference offset X"
                />
              </Field>
              <Field>
                <FieldLabel>Offset Y</FieldLabel>
                <StudioNumberInput
                  value={localConfig.y}
                  onValueChange={(v) => applyDraft({ ...localConfig, y: v })}
                  prefix="Y"
                  suffix="px"
                  aria-label="Reference offset Y"
                />
              </Field>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};
