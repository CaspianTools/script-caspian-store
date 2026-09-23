'use client';

import { useEffect, useState } from 'react';
import type { JournalArticle } from '../../types';
import { getJournalArticle } from '../../services/journal-service';
import {
  useCaspianFirebase,
  useCaspianImage,
  useCaspianLink,
} from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Badge, Skeleton } from '../../ui/misc';
import { cn } from '../../utils/cn';

export interface JournalDetailPageProps {
  articleId: string;
  /** Where the "back" link points. Default: `/journal`. */
  backHref?: string;
  onNotFound?: () => void;
  className?: string;
}

export function JournalDetailPage({
  articleId,
  backHref = '/journal',
  onNotFound,
  className,
}: JournalDetailPageProps) {
  const { db } = useCaspianFirebase();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const t = useT();
  const [article, setArticle] = useState<JournalArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getJournalArticle(db, articleId)
      .then((a) => {
        if (!alive) return;
        if (!a) onNotFound?.();
        setArticle(a);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load journal article:', error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, articleId, onNotFound]);

  if (loading) {
    return (
      <main className={className} style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px' }}>
        <Skeleton style={{ height: 32, width: '60%' }} />
        <div style={{ marginTop: 16 }}>
          <Skeleton style={{ aspectRatio: '16 / 9' }} />
        </div>
      </main>
    );
  }

  if (!article) {
    return (
      <main className={className} style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#888' }}>{t('page.notFound')}</p>
      </main>
    );
  }

  const paragraphs = (article.content ?? '').split(/\n{2,}/).filter(Boolean);

  return (
    <main
      className={cn('caspian-journal-detail', 'caspian-page-gutter', className)}
      style={{ maxWidth: 820, margin: '0 auto', padding: '48px clamp(16px, 4vw, 24px)' }}
    >
      <div style={{ marginBottom: 16 }}>
        <Link href={backHref}>
          <span style={{ fontSize: 13 }}>← {t('journal.backToList')}</span>
        </Link>
      </div>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          {article.category && <Badge variant="secondary">{article.category}</Badge>}
          {article.date && <span style={{ fontSize: 13, color: '#888' }}>{article.date}</span>}
        </div>
        <h1
          style={{
            fontFamily: 'var(--caspian-font-headline, inherit)',
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {article.title}
        </h1>
        {article.excerpt && (
          <p style={{ color: '#666', marginTop: 12, fontSize: 17, lineHeight: 1.5 }}>
            {article.excerpt}
          </p>
        )}
      </header>
      {article.imageUrl && (
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 9',
            background: '#f5f5f5',
            overflow: 'hidden',
            borderRadius: 'var(--caspian-radius, 8px)',
            marginBottom: 32,
          }}
        >
          <Image src={article.imageUrl} alt={article.title} fill />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 16, lineHeight: 1.7, color: '#333' }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0 }}>
            {p}
          </p>
        ))}
      </div>
    </main>
  );
}
