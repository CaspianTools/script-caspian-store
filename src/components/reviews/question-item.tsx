'use client';

import type { FirestoreQuestion } from '../../types';
import { Avatar } from '../../ui/misc';
import { useLocale, useT } from '../../i18n/locale-context';

export function QuestionItem({ question }: { question: FirestoreQuestion }) {
  const askedDate = question.createdAt?.toDate ? question.createdAt.toDate() : new Date();
  const answeredDate = question.answeredAt?.toDate ? question.answeredAt.toDate() : null;
  const t = useT();
  const locale = useLocale();
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <Avatar src={question.photoURL} fallback={question.author} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontWeight: 600, margin: 0 }}>{question.author}</p>
            <p style={{ marginLeft: 'auto', fontSize: 13, color: '#888' }}>{askedDate.toLocaleDateString(locale)}</p>
          </div>
          <p style={{ marginTop: 4, fontWeight: 500 }}>
            {t('reviews.questions.askedPrefix')}
            {question.text}
          </p>
        </div>
      </div>
      {question.answer ? (
        <div
          style={{
            marginLeft: 56,
            marginTop: 10,
            padding: '10px 14px',
            borderLeft: '2px solid var(--caspian-primary, #111)',
            background: '#fafafa',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888', margin: 0 }}>
            {t('reviews.questions.answerLabel')}
            {answeredDate ? ` · ${answeredDate.toLocaleDateString(locale)}` : ''}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{question.answer}</p>
        </div>
      ) : (
        <p style={{ marginLeft: 56, marginTop: 6, fontSize: 12, fontStyle: 'italic', color: '#888' }}>
          {t('reviews.questions.awaitingAnswer')}
        </p>
      )}
    </div>
  );
}
