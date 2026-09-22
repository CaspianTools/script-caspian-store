'use client';

import { useEffect, useState } from 'react';
import type { JournalArticle } from '../../types';
import { listJournalArticles } from '../../services/journal-service';
import {
  useCaspianFirebase,
  useCaspianImage,
  useCaspianLink,
} from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Badge, Skeleton } from '../../ui/misc';
import { cn } from '../../utils/cn';
import { EmptyState } from '../empty-state';

export interface JournalListPageProps {
  title?: string;
  subtitle?: string;
  /** Build the URL for an article detail page. Default: `/journal/{id}`. */
  getArticleHref?: (articleId: string) => string;
  emptyMessage?: string;
  className?: string;
}

export function JournalListPage({
  title,
  subtitle,
  getArticleHref = (id) => `/journal/${id}`,
  emptyMessage,
  className,
}: JournalListPageProps) {
  const { db } = useCaspianFirebase();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const t = useT();
  const [articles, setArticles] = useState<JournalArticle[] | null>(null);

  useEffect(() => {
    let alive = true;
    listJournalArticles(db)
      .then((list) => {
        if (alive) setArticles(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load journal:', error);
        if (alive) setArticles([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  return (
    <main
      className={cn('caspian-journal-list', 'caspian-page-gutter', className)}
      style={{ padding: 'clamp(40px, 8vw, 64px) clamp(16px, 4vw, 24px)' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {title ?? t('journal.title')}
          </h1>
          <p style={{ color: '#666', marginTop: 12, fontSize: 15 }}>
            {subtitle ?? t('journal.subtitle')}
          </p>
        </header>

        {articles === null ? (
          <div className="caspian-journal-grid" style={gridStyle}>
            {Array.from({ length: 3 }).map((_, i) => (
              <article key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Skeleton className="caspian-journal-card__image" style={{ aspectRatio: '16 / 10' }} />
                <Skeleton style={{ height: 20, width: '80%' }} />
                <Skeleton style={{ height: 14, width: '100%' }} />
              </article>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState title={emptyMessage ?? t('journal.empty')} />
        ) : (
          <div className="caspian-journal-grid" style={gridStyle}>
            {articles.map((article) => (
              <Link key={article.id} href={getArticleHref(article.id)}>
                <article style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    className="caspian-journal-card__image"
                    style={{
                      position: 'relative',
                      aspectRatio: '16 / 10',
                      background: '#f5f5f5',
                      overflow: 'hidden',
                      borderRadius: 'var(--caspian-radius, 8px)',
                    }}
                  >
                    {article.imageUrl ? (
                      <Image src={article.imageUrl} alt={article.title} fill />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                          fontSize: 13,
                        }}
                      >
                        {article.title}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      {article.category && <Badge variant="secondary">{article.category}</Badge>}
                      {article.date && (
                        <span style={{ fontSize: 12, color: '#888' }}>{article.date}</span>
                      )}
                    </div>
                    <h2
                      style={{
                        fontFamily: 'var(--caspian-font-headline, inherit)',
                        fontSize: 18,
                        fontWeight: 600,
                        margin: 0,
                      }}
                    >
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p style={{ color: '#666', marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>
                        {article.excerpt}
                      </p>
                    )}
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 10,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {t('journal.readMore')} →
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
  gap: 32,
};
