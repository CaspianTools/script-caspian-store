'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FaqItem } from '../../types';
import { listFaqs } from '../../services/faq-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Skeleton } from '../../ui/misc';
import { cn } from '../../utils/cn';
import { EmptyState } from '../empty-state';

export interface FaqsPageProps {
  title?: string;
  subtitle?: string;
  /** Optional override for category heading labels. Keys match `FaqItem.category`. */
  categoryLabels?: Record<string, string>;
  /** Order of category sections. Missing categories are appended alphabetically. */
  categoryOrder?: string[];
  emptyMessage?: string;
  className?: string;
}

const DEFAULT_CATEGORY_KEYS = ['orders', 'returns', 'products', 'account', 'general'] as const;

const DEFAULT_CATEGORY_ORDER = ['orders', 'returns', 'products', 'account'];

export function FaqsPage({
  title,
  subtitle,
  categoryLabels,
  categoryOrder,
  emptyMessage,
  className,
}: FaqsPageProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listFaqs(db)
      .then((list) => {
        if (alive) setFaqs(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load FAQs:', error);
        if (alive) setFaqs([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const labels = useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const key of DEFAULT_CATEGORY_KEYS) defaults[key] = t(`faqs.category.${key}`);
    return { ...defaults, ...(categoryLabels ?? {}) };
  }, [t, categoryLabels]);
  const order = categoryOrder ?? DEFAULT_CATEGORY_ORDER;

  const grouped = useMemo(() => {
    if (!faqs) return [];
    const byCategory = new Map<string, FaqItem[]>();
    for (const faq of faqs) {
      const key = faq.category || 'general';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(faq);
    }
    const seen = new Set<string>();
    const out: Array<{ key: string; label: string; items: FaqItem[] }> = [];
    for (const key of order) {
      const items = byCategory.get(key);
      if (items?.length) {
        out.push({ key, label: labels[key] ?? key, items });
        seen.add(key);
      }
    }
    for (const [key, items] of byCategory.entries()) {
      if (!seen.has(key) && items.length > 0) {
        out.push({ key, label: labels[key] ?? key, items });
      }
    }
    return out;
  }, [faqs, order, labels]);

  return (
    <main className={cn('caspian-faqs', className)} style={{ padding: '48px 24px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {title ?? t('faqs.title')}
          </h1>
          <p style={{ color: '#666', marginTop: 12, fontSize: 15 }}>{subtitle ?? t('faqs.subtitle')}</p>
        </header>

        {faqs === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton style={{ height: 48 }} />
            <Skeleton style={{ height: 48 }} />
            <Skeleton style={{ height: 48 }} />
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState title={emptyMessage ?? t('faqs.empty')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {grouped.map((group) => (
              <section key={group.key}>
                <h2
                  style={{
                    fontFamily: 'var(--caspian-font-headline, inherit)',
                    fontSize: 18,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: 12,
                  }}
                >
                  {group.label}
                </h2>
                <div>
                  {group.items.map((faq) => {
                    const open = openId === faq.id;
                    return (
                      <details
                        key={faq.id}
                        open={open}
                        onToggle={(e) =>
                          setOpenId((e.currentTarget as HTMLDetailsElement).open ? faq.id : null)
                        }
                        style={{
                          borderTop: '1px solid #eee',
                          padding: '14px 0',
                        }}
                      >
                        <summary
                          style={{
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: 15,
                            listStyle: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          {faq.question}
                          <span style={{ color: '#888', fontSize: 18 }}>{open ? '−' : '+'}</span>
                        </summary>
                        <p style={{ color: '#555', marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
                          {faq.answer}
                        </p>
                      </details>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
