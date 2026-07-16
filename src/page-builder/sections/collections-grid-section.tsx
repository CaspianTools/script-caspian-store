'use client';

import { useEffect, useState } from 'react';
import { useCaspianFirebase, useCaspianLink } from '../../provider/caspian-store-provider';
import { listProductCollections } from '../../services/product-collection-service';
import type { ProductCollectionDoc } from '../../types';
import { EditableText } from '../editor/editable';
import type { SectionComponentProps, SectionType } from '../types';

function CollectionsGridSection({ props, editing }: SectionComponentProps) {
  const Link = useCaspianLink();
  const { db } = useCaspianFirebase();
  const s = (k: string) => String(props[k] ?? '');
  const [collections, setCollections] = useState<ProductCollectionDoc[]>([]);

  useEffect(() => {
    let cancelled = false;
    listProductCollections(db)
      .then((list) => {
        if (cancelled) return;
        const active = list.filter((c) => c.isActive);
        active.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCollections(active.slice(0, 5));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db]);

  // View mode hides an empty grid; edit mode keeps the header visible so the
  // admin can still select / edit / reorder the section.
  if (!editing && collections.length === 0) return null;

  return (
    <section className="home__collections">
      <header className="home__sect-head">
        <EditableText as="h2" fieldKey="heading" value={s('heading')} />
        <p>
          {collections.length}{' '}
          <EditableText as="span" fieldKey="subheadingSuffix" value={s('subheadingSuffix')} />
        </p>
      </header>
      {collections.length > 0 && (
        <div className="home__col-grid">
          {collections.map((c, i) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className={`coltile coltile--${i === 0 ? 'lg' : 'sm'}`}
            >
              {c.imageUrl && <img src={c.imageUrl} alt="" />}
              <div className="coltile__meta">
                <span className="coltile__num">No. {String(i + 1).padStart(2, '0')}</span>
                <h3>{c.name}</h3>
                {c.description && <p>{c.description}</p>}
                <span className="coltile__count">{c.productIds?.length ?? 0} pieces →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export const COLLECTIONS_GRID_SECTION: SectionType = {
  type: 'collections-grid',
  nameKey: 'pageBuilder.section.collectionsGrid.name',
  descriptionKey: 'pageBuilder.section.collectionsGrid.desc',
  fields: [
    { key: 'heading', labelKey: 'pageBuilder.field.heading', type: 'text', inline: true },
    { key: 'subheadingSuffix', labelKey: 'pageBuilder.field.subheading', type: 'text', inline: true },
  ],
  defaultProps: {
    heading: 'Collections',
    subheadingSuffix: 'families, considered as a whole.',
  },
  dynamic: true,
  singleton: true,
  Component: CollectionsGridSection,
};
