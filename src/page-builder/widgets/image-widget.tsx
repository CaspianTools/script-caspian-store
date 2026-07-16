'use client';

import type { CSSProperties } from 'react';
import { useCaspianLink } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n';
import { EditableImage } from '../editor/editable';
import type { BlockComponentProps, BlockType } from '../types';

/**
 * Image widget — a single image with full display control (size, fit, focal
 * point, rounded corners) and an optional link. Uploads / stock search run
 * through the panel's `<ImageUploadField>`; the canvas shows an
 * `<EditableImage>` with a hover-to-edit overlay in edit mode.
 */
function ImageWidget({ props, editing }: BlockComponentProps) {
  const Link = useCaspianLink();
  const t = useT();
  const imageUrl = String(props.imageUrl ?? '');
  const href = String(props.href ?? '');
  const align = String(props.align ?? 'center');
  const openInNewTab = Boolean(props.openInNewTab);
  const radius = props.radius;

  // No image: show a placeholder while editing (clicking it selects the block →
  // panel), render nothing for shoppers so there's no broken <img>.
  if (!imageUrl) {
    if (!editing) return null;
    return (
      <div className="pb-w-image-wrap" style={{ textAlign: align as 'left' | 'center' | 'right' }}>
        <div className="pb-layout-empty">{t('pageBuilder.widget.image.empty')}</div>
      </div>
    );
  }

  const imgStyle: CSSProperties = {
    width: props.width ? String(props.width) : undefined,
    maxWidth: props.maxWidth ? String(props.maxWidth) : undefined,
    height: props.height ? String(props.height) : undefined,
    objectFit: props.objectFit ? (String(props.objectFit) as CSSProperties['objectFit']) : undefined,
    objectPosition: props.objectPosition ? String(props.objectPosition) : undefined,
    borderRadius: radius != null && radius !== '' ? `${Number(radius)}px` : undefined,
  };

  const img = (
    <EditableImage
      fieldKey="imageUrl"
      value={imageUrl}
      alt={String(props.alt ?? '')}
      className="pb-w-image"
      style={imgStyle}
    />
  );

  const credit = renderCredit(props.imageAttribution);

  return (
    <div className="pb-w-image-wrap" style={{ textAlign: align as 'left' | 'center' | 'right' }}>
      {!editing && href ? (
        <Link href={href} target={openInNewTab ? '_blank' : undefined} rel={openInNewTab ? 'noopener noreferrer' : undefined}>
          {img}
        </Link>
      ) : (
        img
      )}
      {credit}
    </div>
  );
}

/** Render a small attribution credit when a stock image carries one. */
function renderCredit(attribution: unknown) {
  if (!attribution || typeof attribution !== 'object') return null;
  const a = attribution as { creator?: string | null; foreignLandingUrl?: string; license?: string };
  const name = a.creator || (a.foreignLandingUrl ? 'Source' : '');
  const license = a.license ? a.license.toUpperCase() : '';
  if (!name && !license) return null;
  return (
    <small className="pb-w-image-credit">
      {name &&
        (a.foreignLandingUrl ? (
          <a href={a.foreignLandingUrl} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ) : (
          name
        ))}
      {name && license ? ' · ' : ''}
      {license}
    </small>
  );
}

export const IMAGE_WIDGET: BlockType = {
  type: 'widget:image',
  category: 'widget',
  nameKey: 'pageBuilder.widget.image.name',
  descriptionKey: 'pageBuilder.widget.image.desc',
  fields: [
    { key: 'imageUrl', labelKey: 'pageBuilder.field.image', type: 'image' },
    { key: 'alt', labelKey: 'pageBuilder.field.imageAlt', type: 'text' },
    { key: 'width', labelKey: 'pageBuilder.field.width', type: 'text', placeholderKey: 'pageBuilder.field.cssLength' },
    { key: 'maxWidth', labelKey: 'pageBuilder.field.maxWidth', type: 'text', placeholderKey: 'pageBuilder.field.cssLength' },
    { key: 'height', labelKey: 'pageBuilder.field.heightCss', type: 'text', placeholderKey: 'pageBuilder.field.cssLength' },
    {
      key: 'objectFit',
      labelKey: 'pageBuilder.field.objectFit',
      type: 'select',
      options: [
        { value: '', labelKey: 'pageBuilder.objectFit.default' },
        { value: 'cover', labelKey: 'pageBuilder.objectFit.cover' },
        { value: 'contain', labelKey: 'pageBuilder.objectFit.contain' },
        { value: 'fill', labelKey: 'pageBuilder.objectFit.fill' },
      ],
    },
    { key: 'objectPosition', labelKey: 'pageBuilder.field.focalPoint', type: 'focal' },
    { key: 'radius', labelKey: 'pageBuilder.field.radius', type: 'number', min: 0, max: 400, step: 1 },
    { key: 'href', labelKey: 'pageBuilder.field.linkHref', type: 'link' },
    { key: 'openInNewTab', labelKey: 'pageBuilder.field.openInNewTab', type: 'toggle' },
    {
      key: 'align',
      labelKey: 'pageBuilder.field.align',
      type: 'select',
      options: [
        { value: 'left', labelKey: 'pageBuilder.align.left' },
        { value: 'center', labelKey: 'pageBuilder.align.center' },
        { value: 'right', labelKey: 'pageBuilder.align.right' },
      ],
    },
  ],
  defaultProps: {
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80',
    alt: '',
    width: '',
    maxWidth: '',
    height: '',
    objectFit: '',
    objectPosition: '50% 50%',
    radius: '',
    href: '',
    openInNewTab: false,
    align: 'center',
  },
  Component: ImageWidget,
};
