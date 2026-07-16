'use client';

import { useId, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { diagnoseUploadDenial, uploadAdminImage } from '../services/storage-service';
import { cn } from '../utils/cn';
import type { StockImageAttribution } from '../types';
import { Button } from './button';
import { Input, Label } from './input';
import { StockImagePicker } from './stock-image-picker';
import { useToast } from './toast';

export interface ImageUploadFieldProps {
  /** Current image URL (stored on the owning doc). */
  value: string;
  /** Called with the new URL after a successful upload or URL edit. */
  onChange: (url: string) => void;
  /** When true, offer an inline open-stock-image (Openverse) search. */
  allowStockSearch?: boolean;
  /** Called with the picked stock image's attribution (null when cleared). */
  onAttributionChange?: (attribution: StockImageAttribution | null) => void;
  /**
   * Storage path prefix. The uploaded file is saved as
   * `<storagePath>/<timestamp>-<random>.<ext>`. Must match a path allowed by
   * your Storage rules (e.g. `siteSettings`, `products/{id}`).
   */
  storagePath: string;
  /** Field label shown above the preview. */
  label?: string;
  /** Preview aspect ratio (CSS `aspect-ratio`). Default: `1 / 1`. */
  aspectRatio?: string;
  /** Preview max width in px. Default: `240`. */
  previewMaxWidth?: number;
  /** When true, shows a URL text input as a fallback below the file picker. */
  allowUrlFallback?: boolean;
  /** Max file size in bytes. Default: 10 MB. */
  maxBytes?: number;
  /** Allowed MIME types. Default: jpeg/png/webp/gif/svg+xml. */
  allowedTypes?: string[];
  className?: string;
}

const DEFAULT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

function extFromType(type: string): string {
  switch (type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'jpg';
  }
}

export function ImageUploadField({
  value,
  onChange,
  allowStockSearch = false,
  onAttributionChange,
  storagePath,
  label,
  aspectRatio = '1 / 1',
  previewMaxWidth = 240,
  allowUrlFallback = false,
  maxBytes = 10 * 1024 * 1024,
  allowedTypes = DEFAULT_TYPES,
  className,
}: ImageUploadFieldProps) {
  const { auth, db, storage, functions } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = extFromType(file.type);
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${storagePath.replace(/\/$/, '')}/${Date.now()}-${rand}.${ext}`;
      const url = await uploadAdminImage({
        storage,
        auth,
        functions,
        path,
        file,
        maxBytes,
        allowedTypes,
      });
      onChange(url);
      toast({ title: t('imageUpload.success') });
    } catch (error) {
      console.error('[caspian-store] Image upload failed:', error);
      const code =
        error && typeof error === 'object' && 'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : null;
      switch (code) {
        case 'storage/unauthorized': {
          // The retry inside uploadAdminImage already force-refreshed the
          // ID token once. If we're here, the claim genuinely isn't on
          // the token OR the user isn't admin OR the deployed rules are
          // stale. Disambiguate so the toast names the right fix.
          const diagnosis = await diagnoseUploadDenial({ auth, db });
          toast({
            title: t(`imageUpload.errors.${diagnosis.kind}.title`),
            description: t(`imageUpload.errors.${diagnosis.kind}.description`),
            variant: 'destructive',
            durationMs: 8000,
          });
          break;
        }
        case 'storage/unauthenticated':
          toast({
            title: t('imageUpload.errors.unauthenticated.title'),
            description: t('imageUpload.errors.unauthenticated.description'),
            variant: 'destructive',
            durationMs: 8000,
          });
          break;
        case 'storage/quota-exceeded':
          toast({
            title: t('imageUpload.errors.quotaExceeded.title'),
            description: t('imageUpload.errors.quotaExceeded.description'),
            variant: 'destructive',
            durationMs: 8000,
          });
          break;
        case 'storage/retry-limit-exceeded':
        case 'storage/canceled':
          toast({
            title: t('imageUpload.errors.network.title'),
            description: t('imageUpload.errors.network.description'),
            variant: 'destructive',
          });
          break;
        default:
          if (code === null && error instanceof Error) {
            // Local validation throws (size/type) from uploadAdminImage — the
            // message is already short and actionable.
            toast({ title: error.message, variant: 'destructive' });
          } else {
            toast({
              title: t('imageUpload.errors.generic.title'),
              description: t('imageUpload.errors.generic.description'),
              variant: 'destructive',
            });
          }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
    onAttributionChange?.(null);
  };

  return (
    <div className={cn('caspian-image-upload', className)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: previewMaxWidth,
        }}
      >
        <div
          style={{
            aspectRatio,
            background: '#f5f5f5',
            borderRadius: 'var(--caspian-radius, 8px)',
            border: '1px dashed rgba(0,0,0,0.15)',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <button
                type="button"
                onClick={handleRemove}
                aria-label="Remove image"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 0,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </>
          ) : (
            <span style={{ color: '#888', fontSize: 13 }}>No image</span>
          )}
        </div>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={allowedTypes.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {value ? 'Replace' : 'Upload'}
          </Button>
          {allowStockSearch && (
            <Button type="button" variant="outline" size="sm" onClick={() => setStockOpen(true)}>
              {t('stockImage.search')}
            </Button>
          )}
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
              Remove
            </Button>
          )}
        </div>

        {allowUrlFallback && (
          <div style={{ marginTop: 4 }}>
            <Label style={{ fontSize: 12, color: '#666' }}>or paste URL</Label>
            <Input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://…"
            />
          </div>
        )}
      </div>

      {allowStockSearch && (
        <StockImagePicker
          open={stockOpen}
          onOpenChange={setStockOpen}
          storagePath={storagePath}
          onSelect={(url, attribution) => {
            onChange(url);
            onAttributionChange?.(attribution);
          }}
        />
      )}
    </div>
  );
}
