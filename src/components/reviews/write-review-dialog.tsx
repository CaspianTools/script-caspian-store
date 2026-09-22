'use client';

import { useState } from 'react';
import { Dialog } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Label, Textarea } from '../../ui/input';
import { useToast } from '../../ui/toast';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import {
  createReview,
  hasUserReviewedProduct,
} from '../../services/review-service';
import { StarRatingInput } from '../star-rating-input';

export function WriteReviewDialog({
  productId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  const { db } = useCaspianFirebase();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setRating(0);
    setText('');
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!user || !userProfile) {
      toast({ title: t('reviews.dialog.signInRequired'), variant: 'destructive' });
      return;
    }
    if (rating < 1) {
      toast({ title: t('reviews.dialog.ratingRequired'), variant: 'destructive' });
      return;
    }
    if (!text.trim()) {
      toast({ title: t('reviews.dialog.textRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (await hasUserReviewedProduct(db, user.uid, productId)) {
        toast({ title: t('reviews.dialog.alreadyReviewed'), variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      await createReview(
        db,
        { productId, rating, text },
        {
          uid: user.uid,
          displayName: userProfile.displayName || user.email || 'Anonymous',
          photoURL: userProfile.photoURL,
        },
      );
      toast({
        title: t('reviews.dialog.submitted'),
        description: t('reviews.dialog.submittedDesc'),
      });
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast({ title: t('reviews.dialog.somethingWrong'), variant: 'destructive' });
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t('reviews.dialog.writeTitle')}
      description={t('reviews.dialog.writeDescription')}
      footer={
        user ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button className="caspian-full-mobile" onClick={handleSubmit} loading={submitting}>
              {submitting ? t('reviews.dialog.submitting') : t('reviews.dialog.submit')}
            </Button>
          </>
        ) : null
      }
    >
      {!user ? (
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#666', fontSize: 14 }}>{t('reviews.dialog.signInHint')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>{t('reviews.dialog.ratingLabel')}</Label>
            <StarRatingInput className="caspian-star-input" value={rating} onChange={setRating} />
          </div>
          <div>
            <Label htmlFor="review-text">{t('reviews.dialog.reviewLabel')}</Label>
            <Textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t('reviews.dialog.reviewPlaceholder')}
            />
            <p style={{ fontSize: 12, color: '#888', textAlign: 'right', marginTop: 4 }}>{text.length}/2000</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
