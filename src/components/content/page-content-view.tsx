'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { PageContent } from '../../types';
import { getPageContent } from '../../services/page-content-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Skeleton } from '../../ui/misc';
import { cn } from '../../utils/cn';

export interface PageContentViewProps {
  /** Firestore doc id under `pageContents/` (e.g. `about`, `privacy`, `sustainability`). */
  pageKey: string;
  /** Shown when no Firestore doc exists (e.g. admin hasn't seeded content yet). */
  fallback?: {
    title: string;
    subtitle?: string;
    content?: string;
  };
  /** Slot rendered after the content — useful for page-specific extras like a contact form. */
  afterContent?: ReactNode;
  className?: string;
}

/**
 * Drop-in long-form content page backed by `pageContents/{pageKey}` in
 * Firestore. Used for About / Contact / Privacy / Terms / Sustainability
 * and any other static marketing page. Content is paragraph-split on
 * double newlines.
 *
 * Admins edit via `<AdminPagesPage />`.
 */
export function PageContentView({
  pageKey,
  fallback,
  afterContent,
  className,
}: PageContentViewProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getPageContent(db, pageKey)
      .then((p) => {
        if (alive) setPage(p);
      })
      .catch((error) => {
        console.error(`[caspian-store] Failed to load page ${pageKey}:`, error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, pageKey]);

  if (loading) {
    return (
      <main className={cn('caspian-page-gutter', className)} style={mainStyle}>
        <Skeleton style={{ height: 36, width: '40%' }} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton style={{ height: 14, width: '90%' }} />
          <Skeleton style={{ height: 14, width: '85%' }} />
          <Skeleton style={{ height: 14, width: '80%' }} />
        </div>
      </main>
    );
  }

  const title = page?.title ?? fallback?.title;
  const subtitle = page?.subtitle ?? fallback?.subtitle;
  const rawContent = page?.content ?? fallback?.content ?? '';

  if (!title) {
    return (
      <main className={cn('caspian-page-gutter', className)} style={mainStyle}>
        <p style={{ color: '#888' }}>
          {t('page.notFound')} <em>({pageKey})</em>
        </p>
        <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>{t('page.defaultContentHint')}</p>
      </main>
    );
  }

  const paragraphs = rawContent.split(/\n{2,}/).filter(Boolean);

  return (
    <main className={cn('caspian-page-content', 'caspian-page-gutter', className)} style={mainStyle}>
      <header style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--caspian-font-headline, inherit)',
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: '#666', marginTop: 12, fontSize: 17, lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 16, lineHeight: 1.7, color: '#333' }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0 }}>
            {p}
          </p>
        ))}
      </div>
      {afterContent}
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: '0 auto',
  padding: '48px clamp(16px, 4vw, 24px)',
};
