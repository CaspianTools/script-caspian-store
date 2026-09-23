'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { ProductImage } from '../types';
import { useCaspianImage } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons';
import { cn } from '../utils/cn';

/** Horizontal travel (px) a touch must cover before it counts as a swipe. */
const SWIPE_THRESHOLD = 40;

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
 * With more than one image the featured image also carries previous / next
 * buttons and responds to a horizontal touch swipe (pointer events only).
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
  const swipeStartRef = useRef<{ id: number; x: number; y: number } | null>(null);

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

  const step = (delta: number) => {
    selectImage((active + delta + images.length) % images.length);
  };

  // Mouse users get the buttons; a mouse drag here would fight native image
  // dragging and text selection for no gain.
  const handleSwipeStart = (e: PointerEvent<HTMLDivElement>) => {
    if (!hasRail || e.pointerType === 'mouse' || !e.isPrimary) return;
    swipeStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const handleSwipeEnd = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Mostly-vertical movement is the page scrolling, not a swipe.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
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
          // Vertical panning stays with the browser; horizontal travel is
          // delivered to the swipe handlers instead of being claimed as a pan.
          touchAction: hasRail ? 'pan-y pinch-zoom' : undefined,
        }}
        onPointerDown={handleSwipeStart}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <Image src={main.url} alt={main.alt || ''} fill priority />
        {hasRail && (
          <>
            <button
              type="button"
              className="caspian-gallery-prev"
              onClick={() => step(-1)}
              aria-label={t('product.gallery.previous')}
              style={{ ...navButtonStyle, left: 10 }}
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              className="caspian-gallery-next"
              onClick={() => step(1)}
              aria-label={t('product.gallery.next')}
              style={{ ...navButtonStyle, right: 10 }}
            >
              <ChevronRightIcon size={18} />
            </button>
          </>
        )}
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

const navButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 1,
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  borderRadius: 999,
  border: '1px solid rgba(0,0,0,0.08)',
  background: 'rgba(255,255,255,0.85)',
  color: '#111',
  cursor: 'pointer',
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
};
