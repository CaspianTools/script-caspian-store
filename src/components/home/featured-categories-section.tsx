'use client';

import { useEffect, useState } from 'react';
import type { ProductCategoryDoc } from '../../types';
import { getFeaturedCategories } from '../../services/category-service';
import { useCaspianFirebase, useCaspianImage, useCaspianLink } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Skeleton } from '../../ui/misc';
import { cn } from '../../utils/cn';

export interface FeaturedCategoriesSectionProps {
  label?: string;
  title?: string;
  /** Link target for each category card. Default: `/shop?category={slug}` — `<ProductListPage>` pre-selects that category filter. */
  getCategoryHref?: (category: ProductCategoryDoc) => string;
  className?: string;
}

export function FeaturedCategoriesSection({
  label,
  title,
  getCategoryHref = (c) => `/shop?category=${encodeURIComponent(c.slug || c.id)}`,
  className,
}: FeaturedCategoriesSectionProps) {
  const { db } = useCaspianFirebase();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const t = useT();
  const [categories, setCategories] = useState<ProductCategoryDoc[] | null>(null);

  useEffect(() => {
    let alive = true;
    getFeaturedCategories(db)
      .then((list) => {
        if (alive) setCategories(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load featured categories:', error);
        if (alive) setCategories([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  if (categories !== null && categories.length === 0) return null;

  return (
    <section className={cn('caspian-featured-categories', className)} style={{ padding: '64px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#888',
              fontFamily: 'var(--caspian-font-headline, inherit)',
            }}
          >
            {label ?? t('home.featured.label')}
          </p>
          <h2
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            {title ?? t('home.featured.title')}
          </h2>
        </header>
        {categories === null ? (
          <div style={gridStyle}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ aspectRatio: '3 / 4' }} />
            ))}
          </div>
        ) : (
          <div style={gridStyle}>
            {categories.map((cat) => (
              <Link key={cat.id} href={getCategoryHref(cat)}>
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
                    {cat.imageUrl ? (
                      <Image src={cat.imageUrl} alt={cat.name} fill />
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
                        {cat.name}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{cat.name}</h3>
                    {cat.description && (
                      <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{cat.description}</p>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 24,
};
