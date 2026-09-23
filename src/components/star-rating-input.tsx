'use client';

import { useState } from 'react';
import { cn } from '../utils/cn';
import { useT } from '../i18n/locale-context';
import { StarIcon } from './star-icon';

export interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  className?: string;
}

// Numeric pixel sizes — passed as SVG width/height attributes so the icon
// renders even when the consumer hasn't loaded the library's Tailwind utility
// layer. The Tailwind-class approach used previously fell back to a 0-sized
// SVG inside the dialog and the user saw empty boxes.
const SIZE_PX = { sm: 16, md: 24, lg: 32 } as const;

export function StarRatingInput({
  value,
  onChange,
  size = 'lg',
  ariaLabel,
  className,
}: StarRatingInputProps) {
  const t = useT();
  const [hover, setHover] = useState(0);
  const display = hover || value;
  const px = SIZE_PX[size];

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? t('reviews.ratingLabel')}
      className={cn('caspian-flex caspian-items-center caspian-gap-1', className)}
      style={{ display: 'inline-flex', gap: 4 }}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= display;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={t('reviews.starsLabel', { count: i })}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            className="caspian-rounded focus:caspian-outline-none focus-visible:caspian-ring-2 caspian-transition-transform hover:caspian-scale-110"
            style={{
              background: 'transparent',
              border: 0,
              padding: 2,
              cursor: 'pointer',
              color: active ? '#f59e0b' : 'rgba(0,0,0,0.3)',
            }}
          >
            <StarIcon
              width={px}
              height={px}
              fill={active ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
}
