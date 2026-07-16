'use client';

import { useEffect, useState } from 'react';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { getProducts } from '../../services/product-service';
import type { Product } from '../../types';
import { ProductCard } from '../../components/product-card';
import { EditableText } from '../editor/editable';
import type { SectionComponentProps, SectionType } from '../types';

function FeaturedProductsSection({ props, editing, getProductHref, formatPrice }: SectionComponentProps) {
  const { db } = useCaspianFirebase();
  const s = (k: string) => String(props[k] ?? '');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    getProducts(db, undefined, 4)
      .then((p) => !cancelled && setProducts(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (!editing && products.length === 0) return null;

  return (
    <section className="home__featured">
      <header className="home__sect-head">
        <EditableText as="h2" fieldKey="heading" value={s('heading')} />
        <EditableText as="p" fieldKey="subheading" value={s('subheading')} multiline />
      </header>
      {products.length > 0 && (
        <div className="home__feat-grid">
          {products.slice(0, 4).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              getProductHref={getProductHref}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export const FEATURED_PRODUCTS_SECTION: SectionType = {
  type: 'featured-products',
  nameKey: 'pageBuilder.section.featuredProducts.name',
  descriptionKey: 'pageBuilder.section.featuredProducts.desc',
  fields: [
    { key: 'heading', labelKey: 'pageBuilder.field.heading', type: 'text', inline: true },
    { key: 'subheading', labelKey: 'pageBuilder.field.subheading', type: 'text', multiline: true, inline: true },
  ],
  defaultProps: {
    heading: 'The most-worn',
    subheading: 'Restocks, perennials, the pieces customers ask for by name.',
  },
  dynamic: true,
  singleton: true,
  Component: FeaturedProductsSection,
};
