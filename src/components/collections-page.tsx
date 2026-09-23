'use client';

import { useEffect, useState } from 'react';
import type { ProductCollectionDoc } from '../types';
import { listProductCollections } from '../services/product-collection-service';
import {
  useCaspianFirebase,
  useCaspianImage,
  useCaspianLink,
} from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Skeleton } from '../ui/misc';
import { cn } from '../utils/cn';
import { EmptyState } from './empty-state';

export interface CollectionsPageProps {
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  /** Link target for each collection card. Default: `/collections/{slug}`. */
  getCollectionHref?: (collection: ProductCollectionDoc) => string;
  className?: string;
}

export function CollectionsPage({
  title,
  subtitle,
  emptyMessage,
  getCollectionHref = (c) => `/collections/${c.slug}`,
  className,
}: CollectionsPageProps) {
  const { db } = useCaspianFirebase();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const t = useT();
  const [collections, setCollections] = useState<ProductCollectionDoc[] | null>(null);

  useEffect(() => {
    let alive = true;
    listProductCollections(db)
      .then((list) => {
        if (alive) setCollections(list.filter((c) => c.isActive));
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load collections:', error);
        if (alive) setCollections([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const resolvedTitle = title ?? t('navigation.collections');
  const resolvedSubtitle = subtitle ?? t('collections.subtitle');
  const resolvedEmpty = emptyMessage ?? t('collections.empty');

  return (
    <div className={cn('caspian-collections-page', 'caspian-page-gutter', className)}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{resolvedTitle}</h1>
        {resolvedSubtitle && <p style={{ color: '#666', marginTop: 4 }}>{resolvedSubtitle}</p>}
      </header>

      {collections === null ? (
        <div className="caspian-collection-grid" style={gridStyle}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ aspectRatio: '3 / 4' }} />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <EmptyState title={resolvedEmpty} />
      ) : (
        <div className="caspian-collection-grid" style={gridStyle}>
          {collections.map((c) => (
            <Link key={c.id} href={getCollectionHref(c)} className="caspian-collection-card">
              <article style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '3 / 4',
                    background: '#f5f5f5',
                    overflow: 'hidden',
                    borderRadius: 'var(--caspian-radius, 8px)',
                  }}
                >
                  {c.imageUrl ? (
                    <Image src={c.imageUrl} alt={c.name} fill />
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
                      {c.name}
                    </div>
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{c.name}</h3>
                  {c.description && (
                    <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{c.description}</p>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 24,
};
