'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '../ui/dialog';
import { SearchIcon, XIcon } from '../ui/icons';
import { Button } from '../ui/button';
import { useT } from '../i18n/locale-context';
import {
  useCaspianFirebase,
  useCaspianLink,
  useCaspianNavigation,
} from '../provider/caspian-store-provider';
import { logSearchTerm } from '../services/search-term-service';
import { useProductSearch } from '../hooks/use-product-search';

const RESULT_LIMIT = 8;

export interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional override for the product link. Defaults to `/products/{slug ?? id}`. */
  getProductHref?: (productId: string, slug?: string) => string;
}

export function SearchDialog({ open, onOpenChange, getProductHref }: SearchDialogProps) {
  const t = useT();
  const Link = useCaspianLink();
  const navigation = useCaspianNavigation();
  const { db } = useCaspianFirebase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const { matches, loading } = useProductSearch(query, { enabled: open });

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const submit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    void logSearchTerm(db, q).catch((err) => {
      console.warn('[caspian-store] logSearchTerm failed:', err);
    });
    onOpenChange(false);
    navigation.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const visible = matches.slice(0, RESULT_LIMIT);
  const hrefFor = (id: string, slug?: string) =>
    getProductHref ? getProductHref(id, slug) : `/products/${slug ?? id}`;

  const trimmed = query.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth={640}>
      <form
        onSubmit={submit}
        role="search"
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <span aria-hidden style={{ display: 'inline-flex', color: '#666' }}>
          <SearchIcon size={20} />
        </span>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('navigation.searchPlaceholder')}
          aria-label={t('navigation.searchPlaceholder')}
          style={{
            flex: 1,
            height: 40,
            padding: '0 12px',
            background: '#f6f6f6',
            border: 'none',
            borderRadius: 999,
            fontSize: 14,
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label={t('navigation.closeSearch')}
        >
          <XIcon size={18} />
        </Button>
      </form>

      <div style={{ marginTop: 16, minHeight: 80 }}>
        {trimmed === '' ? (
          <p style={{ color: '#888', margin: 0, fontSize: 14 }}>{t('search.emptyQuery')}</p>
        ) : loading && matches.length === 0 ? (
          <p style={{ color: '#888', margin: 0, fontSize: 14 }}>{t('search.loading')}</p>
        ) : matches.length === 0 ? (
          <p style={{ color: '#888', margin: 0, fontSize: 14 }}>{t('search.noResults')}</p>
        ) : (
          <>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {visible.map((p) => {
                const img = p.images?.[0]?.url;
                return (
                  <li key={p.id}>
                    <Link
                      href={hrefFor(p.id, p.slug)}
                      onClick={() => onOpenChange(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 4px',
                        textDecoration: 'none',
                        color: 'inherit',
                        borderRadius: 6,
                      }}
                    >
                      {img && (
                        <img
                          src={img}
                          alt=""
                          width={40}
                          height={40}
                          style={{ borderRadius: 4, objectFit: 'cover' }}
                        />
                      )}
                      <span
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.name}
                        </span>
                        <span style={{ fontSize: 12, color: '#777' }}>{p.brand}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {matches.length > RESULT_LIMIT && (
              <button
                type="button"
                onClick={() => submit()}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  padding: '8px 4px',
                  fontSize: 13,
                  color: '#111',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                {t('search.viewAllResults', { count: matches.length })}
              </button>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
