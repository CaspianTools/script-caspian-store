'use client';

import { useState } from 'react';
import { Dialog } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Label, Textarea } from '../../ui/input';
import { useToast } from '../../ui/toast';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { createQuestion } from '../../services/question-service';

export function AskQuestionDialog({
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
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !userProfile) {
      toast({ title: t('reviews.dialog.signInRequired'), variant: 'destructive' });
      return;
    }
    if (!text.trim()) {
      toast({ title: t('reviews.dialog.questionRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createQuestion(
        db,
        { productId, text },
        {
          uid: user.uid,
          displayName: userProfile.displayName || user.email || 'Anonymous',
          photoURL: userProfile.photoURL,
        },
      );
      toast({
        title: t('reviews.dialog.submitted'),
        description: t('reviews.dialog.questionSubmittedDesc'),
      });
      setText('');
      onOpenChange(false);
      onSubmitted?.();
    } catch (error) {
      console.error('Failed to submit question:', error);
      toast({ title: t('reviews.dialog.somethingWrong'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setText('');
          setSubmitting(false);
        }
        onOpenChange(o);
      }}
      title={t('reviews.dialog.askTitle')}
      description={t('reviews.dialog.askDescription')}
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
        <p style={{ color: '#666', fontSize: 14 }}>{t('reviews.dialog.askSignInHint')}</p>
      ) : (
        <div>
          <Label htmlFor="question-text">{t('reviews.dialog.questionLabel')}</Label>
          <Textarea
            id="question-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t('reviews.dialog.questionPlaceholder')}
          />
          <p style={{ fontSize: 12, color: '#888', textAlign: 'right', marginTop: 4 }}>{text.length}/1000</p>
        </div>
      )}
    </Dialog>
  );
}
