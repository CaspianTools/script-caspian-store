'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FirestoreQuestion, FirestoreReview } from '../../types';
import { getApprovedReviewsForProduct, type ReviewSortBy } from '../../services/review-service';
import { getApprovedQuestionsForProduct } from '../../services/question-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select } from '../../ui/select';
import { Skeleton } from '../../ui/misc';
import { ReviewSummary, type ReviewSummaryData } from './review-summary';
import { ReviewList } from './review-list';
import { QuestionList } from './question-list';
import { WriteReviewDialog } from './write-review-dialog';
import { AskQuestionDialog } from './ask-question-dialog';

export function computeSummary(reviews: FirestoreReview[]): ReviewSummaryData {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    const bucket = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
    sum += r.rating;
  }
  const total = reviews.length;
  const average = total === 0 ? 0 : sum / total;
  return { average, total, distribution };
}

export function ProductReviews({
  productId,
  onSummaryChange,
  mode = 'combined',
}: {
  productId: string;
  onSummaryChange?: (s: ReviewSummaryData) => void;
  /**
   * - `combined` (default): reviews + questions shown as internal sub-tabs.
   *   Back-compat mode for standalone use.
   * - `reviews-only`: reviews list + summary + Write dialog. No questions.
   * - `questions-only`: questions list + Ask dialog. No reviews list/summary.
   * The PDP uses `reviews-only` and `questions-only` to split the content
   * across two sibling tabs alongside "Details".
   */
  mode?: 'combined' | 'reviews-only' | 'questions-only';
}) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [reviews, setReviews] = useState<FirestoreReview[]>([]);
  const [questions, setQuestions] = useState<FirestoreQuestion[]>([]);
  const [sortBy, setSortBy] = useState<ReviewSortBy>('recent');
  const [loading, setLoading] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const loadReviews = useCallback(
    async (sort: ReviewSortBy) => {
      const data = await getApprovedReviewsForProduct(db, productId, sort);
      setReviews(data);
    },
    [db, productId],
  );
  const loadQuestions = useCallback(async () => {
    const data = await getApprovedQuestionsForProduct(db, productId);
    setQuestions(data);
  }, [db, productId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadReviews(sortBy), loadQuestions()]);
      } catch (error) {
        console.error('[caspian-store] Failed to load reviews/questions:', error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadReviews, loadQuestions, sortBy]);

  const summary = useMemo(() => computeSummary(reviews), [reviews]);
  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  const sectionStyle: React.CSSProperties =
    mode === 'combined'
      ? { marginTop: 48, borderTop: '1px solid #eee', paddingTop: 32 }
      : {};

  if (loading) {
    return (
      <section style={sectionStyle}>
        {mode === 'combined' && (
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('reviews.title')}</h2>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '32px 0' }}>
          <Skeleton style={{ height: 100, width: '100%' }} />
          <Skeleton style={{ height: 180, width: '100%' }} />
        </div>
      </section>
    );
  }

  if (mode === 'reviews-only') {
    return (
      <section style={sectionStyle}>
        <ReviewSummary
          summary={summary}
          onWriteReview={() => setWriteOpen(true)}
          onAskQuestion={() => setAskOpen(true)}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            margin: '16px 0',
          }}
        >
          <span style={{ fontSize: 13, color: '#666' }}>{t('reviews.sortBy')}</span>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ReviewSortBy)}
            options={[
              { value: 'recent', label: t('reviews.sort.recent') },
              { value: 'highest', label: t('reviews.sort.highest') },
              { value: 'lowest', label: t('reviews.sort.lowest') },
            ]}
          />
        </div>
        <ReviewList reviews={reviews} onWriteReview={() => setWriteOpen(true)} />
        <WriteReviewDialog productId={productId} open={writeOpen} onOpenChange={setWriteOpen} />
      </section>
    );
  }

  if (mode === 'questions-only') {
    return (
      <section style={sectionStyle}>
        <QuestionList questions={questions} onAskQuestion={() => setAskOpen(true)} />
        <AskQuestionDialog productId={productId} open={askOpen} onOpenChange={setAskOpen} />
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('reviews.title')}</h2>

      <ReviewSummary
        summary={summary}
        onWriteReview={() => setWriteOpen(true)}
        onAskQuestion={() => setAskOpen(true)}
      />

      <Tabs defaultValue="reviews">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 8,
            background: '#f5f5f5',
            borderRadius: 'var(--caspian-radius, 6px)',
          }}
        >
          <TabsList>
            <TabsTrigger value="reviews">{t('reviews.tab.reviews', { count: reviews.length })}</TabsTrigger>
            <TabsTrigger value="questions">{t('reviews.tab.questions', { count: questions.length })}</TabsTrigger>
          </TabsList>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#666' }}>{t('reviews.sortBy')}</span>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ReviewSortBy)}
              options={[
                { value: 'recent', label: t('reviews.sort.recent') },
                { value: 'highest', label: t('reviews.sort.highest') },
                { value: 'lowest', label: t('reviews.sort.lowest') },
              ]}
            />
          </div>
        </div>

        <TabsContent value="reviews">
          <ReviewList reviews={reviews} onWriteReview={() => setWriteOpen(true)} />
        </TabsContent>
        <TabsContent value="questions">
          <QuestionList questions={questions} onAskQuestion={() => setAskOpen(true)} />
        </TabsContent>
      </Tabs>

      <WriteReviewDialog productId={productId} open={writeOpen} onOpenChange={setWriteOpen} />
      <AskQuestionDialog productId={productId} open={askOpen} onOpenChange={setAskOpen} />
    </section>
  );
}

export type { ReviewSummaryData };
