'use client';

import { useState } from 'react';
import { useWishlist } from '../context/wishlist-context';
import { useToast } from '../ui/toast';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';

export interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: number;
  ariaLabel?: string;
}

export function WishlistButton({
  productId,
  className,
  size = 20,
  ariaLabel,
}: WishlistButtonProps) {
  const { isSaved, toggle } = useWishlist();
  const { toast } = useToast();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(productId);

  const handleClick = async () => {
    setBusy(true);
    try {
      await toggle(productId);
      toast({ title: saved ? t('wishlist.removed') : t('wishlist.saved') });
    } catch (error) {
      console.error('[caspian-store] Wishlist toggle failed:', error);
      toast({ title: t('wishlist.failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (saved ? t('wishlist.aria.remove') : t('wishlist.aria.save'))}
      aria-pressed={saved}
      onClick={handleClick}
      disabled={busy}
      className={cn('caspian-wishlist-btn', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 16,
        height: size + 16,
        borderRadius: '50%',
        border: 0,
        background: 'transparent',
        cursor: busy ? 'wait' : 'pointer',
        color: saved ? '#dc2626' : '#666',
        transition: 'transform 0.1s',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}
