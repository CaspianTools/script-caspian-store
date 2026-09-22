'use client';

import { useEffect, useState } from 'react';
import type { ProductImage } from '../types';
import { useCaspianImage } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';

export interface ProductGalleryProps {
  images: ProductImage[];
  className?: string;
  /**
   * Featured-image aspect ratio. Default `4/5` (ecommerce portrait). Pass
   * `'1 / 1'` for square, `'3 / 4'` for the previous default, etc.
   */
  aspectRatio?: string;
}

/**
 * Product image gallery. Vertical thumbnail rail on the left (fixed height
 * matching the featured image; internal scroll when there are too many) +
 * the selected image on the right at a fixed 4:5 aspect ratio.
 *
 * Collapses to a single column when only one image is present (no rail).
 * Collapses to a stacked layout on narrow viewports (rail becomes a
 * horizontal strip above the featured image).
 */
export function ProductGallery({
  images,
  className,
  aspectRatio = '4 / 5',
}: ProductGalleryProps) {
  const Image = useCaspianImage();
  const t = useT();
  const [active, setActive] = useState(0);

  // A new image set (product change) must not keep pointing at whatever
  // index the previous product was on.
  useEffect(() => {
    setActive(0);
  }, [images]);

  const main = images[active] ?? images[0];

  if (!main) {
    return (
      <div
        className={className}
        style={{
          aspectRatio,
          background: '#f5f5f5',
          borderRadius: 'var(--caspian-radius, 8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        {t('product.gallery.noImages')}
      </div>
    );
  }

  const hasRail = images.length > 1;

  return (
    <div
      className={cn('caspian-product-gallery', 'caspian-gallery', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: hasRail ? '80px minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: 12,
        alignItems: 'start',
      }}
    >
      {hasRail && (
        <div
          className="caspian-product-gallery-rail caspian-gallery-rail"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 'calc(80px * 5 + 8px * 4)',
            overflow: 'hidden auto',
            paddingRight: 2,
          }}
        >
          {images.map((img, i) => {
            const isActive = active === i;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={t('product.gallery.viewImage', { index: i + 1 })}
                aria-pressed={isActive}
                className="caspian-gallery-thumb"
                style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  background: '#f5f5f5',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: isActive
                    ? '2px solid var(--caspian-primary, #111)'
                    : '1px solid rgba(0,0,0,0.08)',
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Image src={img.url} alt={img.alt || ''} fill />
              </button>
            );
          })}
        </div>
      )}
      <div
        style={{
          position: 'relative',
          aspectRatio,
          background: '#f5f5f5',
          overflow: 'hidden',
          borderRadius: 'var(--caspian-radius, 12px)',
        }}
      >
        <Image src={main.url} alt={main.alt || ''} fill priority />
      </div>
    </div>
  );
}
