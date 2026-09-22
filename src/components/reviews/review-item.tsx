'use client';

import type { FirestoreReview } from '../../types';
import { Avatar, Badge } from '../../ui/misc';
import { StarIcon } from '../star-icon';
import { useLocale, useT } from '../../i18n/locale-context';

export interface ReviewItemProps {
  review: FirestoreReview;
  /**
   * When false, the "verified purchase" badge is hidden even on verified reviews.
   * Consumers wire this to `SiteSettings.reviewPolicy.showVerifiedBadge`. Default true.
   * Added in v2.7.
   */
  showVerifiedBadge?: boolean;
}

export function ReviewItem({ review, showVerifiedBadge = true }: ReviewItemProps) {
  const date = review.createdAt?.toDate ? review.createdAt.toDate() : new Date();
  const t = useT();
  const locale = useLocale();
  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #eee' }}>
      <Avatar src={review.photoURL} fallback={review.author} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontWeight: 600, margin: 0 }}>{review.author}</p>
          {showVerifiedBadge && review.isVerifiedPurchase && (
            <Badge variant="secondary">{t('reviews.verifiedPurchase')}</Badge>
          )}
          <p style={{ marginLeft: 'auto', fontSize: 13, color: '#888' }}>{date.toLocaleDateString(locale)}</p>
        </div>
        <div style={{ display: 'flex', gap: 2, margin: '6px 0' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon
              key={i}
              width={14}
              height={14}
              fill={i < review.rating ? '#f59e0b' : 'none'}
              stroke={i < review.rating ? '#f59e0b' : 'rgba(0,0,0,0.3)'}
            />
          ))}
        </div>
        <p style={{ color: '#555', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>{review.text}</p>
      </div>
    </div>
  );
}
