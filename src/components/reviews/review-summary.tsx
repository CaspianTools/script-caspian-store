'use client';

import { StarIcon } from '../star-icon';
import { Button } from '../../ui/button';
import { useT } from '../../i18n/locale-context';

export interface ReviewSummaryData {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function ReviewSummary({
  summary,
  onWriteReview,
  onAskQuestion,
}: {
  summary: ReviewSummaryData;
  onWriteReview: () => void;
  onAskQuestion: () => void;
}) {
  const { average, total, distribution } = summary;
  const t = useT();
  return (
    <div
      className="caspian-review-summary"
      style={{
        display: 'grid',
        gap: 32,
        padding: '24px 0',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 42, fontWeight: 300 }}>
          {average.toFixed(1)}
          <span style={{ color: '#888' }}>/5</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <StarIcon
              key={i}
              width={18}
              height={18}
              fill={i <= Math.round(average) ? '#f59e0b' : 'none'}
              stroke={i <= Math.round(average) ? '#f59e0b' : 'rgba(0,0,0,0.3)'}
            />
          ))}
        </div>
        <p style={{ color: '#888', fontSize: 13 }}>{t('reviews.count', { count: total })}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[star] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div
              key={star}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 20px 1fr 40px',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
                color: '#666',
              }}
            >
              <span>{star}</span>
              <StarIcon width={12} height={12} fill="#f59e0b" stroke="#f59e0b" />
              <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b' }} />
              </div>
              <span style={{ textAlign: 'right' }}>({count})</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <Button onClick={onWriteReview}>{t('reviews.writeReview')}</Button>
        <Button variant="outline" onClick={onAskQuestion}>
          {t('reviews.askQuestion')}
        </Button>
      </div>
    </div>
  );
}
