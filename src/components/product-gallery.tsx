'use client';

import { useEffect, useRef, useState } from 'react';
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
 * On phones (≤820px, see globals.css) the rail and featured image are hidden
 * and a horizontal scroll-snap track of every image takes over, with a dot
 * indicator that follows the swipe.
 */
export function ProductGallery({
  images,
  className,
  aspectRatio = '4 / 5',
}: ProductGalleryProps) {
  const Image = useCaspianImage();
  const t = useT();
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // A new image set (product change) must not keep pointing at whatever
  // index the previous product was on.
  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [images]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

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

  const scrollTrackTo = (index: number) => {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2,
      behavior: 'smooth',
    });
  };

  const selectImage = (index: number) => {
    setActive(index);
    scrollTrackTo(index);
  };

  // Snap the dots to whichever slide's centre is nearest the viewport centre.
  // rAF-throttled because scroll fires far faster than we need to re-render.
  const handleTrackScroll = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const track = trackRef.current;
      if (!track) return;
      const centre = track.scrollLeft + track.clientWidth / 2;
      let nearest = 0;
      let nearestDistance = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      });
      setActive((prev) => (prev === nearest ? prev : nearest));
    });
  };

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
                onClick={() => selectImage(i)}
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
        className="caspian-gallery-main"
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
      <div
        ref={trackRef}
        className="caspian-gallery-track"
        onScroll={handleTrackScroll}
        aria-roledescription="carousel"
        aria-label={t('product.gallery.carouselLabel')}
      >
        {images.map((img, i) => (
          <div
            key={img.id}
            role="group"
            aria-roledescription="slide"
            aria-label={t('product.gallery.slideLabel', { index: i + 1, total: images.length })}
            style={{ position: 'relative', aspectRatio }}
          >
            <Image
              src={img.url}
              alt={img.alt || ''}
              fill
              priority={i === 0}
              loading={i === 0 ? undefined : 'lazy'}
            />
          </div>
        ))}
      </div>
      {hasRail && (
        <div className="caspian-gallery-dots" aria-hidden="true">
          {images.map((img, i) => (
            <span key={img.id} className={cn(active === i && 'is-active')} />
          ))}
        </div>
      )}
    </div>
  );
}
