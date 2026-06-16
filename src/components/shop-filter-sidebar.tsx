'use client';

import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';

export interface ShopFilterState {
  category: string | null;
  minPrice: string;
  maxPrice: string;
  sizes: ReadonlySet<string>;
  isNew: boolean;
  limited: boolean;
  /** Taxonomy facet selections: taxonomy id → selected term ids. */
  taxonomies: Record<string, ReadonlySet<string>>;
}

/** A taxonomy facet to render: the taxonomy and the terms present in the result set. */
export interface TaxonomyFacet {
  id: string;
  label: string;
  terms: { id: string; name: string }[];
}

export const EMPTY_SHOP_FILTERS: ShopFilterState = {
  category: null,
  minPrice: '',
  maxPrice: '',
  sizes: new Set<string>(),
  isNew: false,
  limited: false,
  taxonomies: {},
};

/** Count of distinct filter dimensions currently active. Useful for badge UIs. */
export function countActiveShopFilters(state: ShopFilterState): number {
  let n = 0;
  if (state.category !== null) n += 1;
  if (state.minPrice !== '' || state.maxPrice !== '') n += 1;
  if (state.sizes.size > 0) n += 1;
  if (state.isNew) n += 1;
  if (state.limited) n += 1;
  for (const set of Object.values(state.taxonomies)) {
    if (set.size > 0) n += 1;
  }
  return n;
}

export interface ShopFilterFieldsProps {
  state: ShopFilterState;
  onChange: (next: ShopFilterState) => void;
  availableCategories: readonly string[];
  categoryLabels?: ReadonlyMap<string, string>;
  availableSizes: readonly string[];
  /** Enabled-taxonomy facets present in the result set. Rendered after Size. */
  availableTaxonomies?: readonly TaxonomyFacet[];
  /** Total number of products visible after filters apply. Renders the count line. */
  resultCount?: number;
  /** When true, the header/title row is omitted — useful when the drawer or
   *  sidebar already provides its own chrome. */
  hideHeader?: boolean;
  /** When true, omit the inline Reset button — drawers typically render it in
   *  a sticky footer instead. */
  hideReset?: boolean;
}

export interface ShopFilterSidebarProps
  extends Omit<ShopFilterFieldsProps, 'hideHeader' | 'hideReset'> {
  className?: string;
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  paddingBottom: 18,
  marginBottom: 18,
  borderBottom: '1px solid rgba(0,0,0,0.08)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#444',
  margin: 0,
};

const radioRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
  fontSize: 14,
  color: '#222',
  cursor: 'pointer',
};

/**
 * Body-only filter form. Renders all sections (category, price, size, quick
 * filters) without an outer container — drop into a sidebar `<aside>`, a
 * dialog, or a mobile drawer.
 */
export function ShopFilterFields({
  state,
  onChange,
  availableCategories,
  categoryLabels,
  availableSizes,
  availableTaxonomies,
  resultCount,
  hideHeader,
  hideReset,
}: ShopFilterFieldsProps) {
  const t = useT();

  const setCategory = (cat: string | null) => onChange({ ...state, category: cat });
  const setMinPrice = (v: string) => onChange({ ...state, minPrice: v });
  const setMaxPrice = (v: string) => onChange({ ...state, maxPrice: v });
  const toggleSize = (size: string) => {
    const next = new Set(state.sizes);
    if (next.has(size)) next.delete(size);
    else next.add(size);
    onChange({ ...state, sizes: next });
  };
  const toggleTaxonomyTerm = (taxId: string, termId: string) => {
    const current = new Set(state.taxonomies[taxId] ?? []);
    if (current.has(termId)) current.delete(termId);
    else current.add(termId);
    const nextTax: Record<string, ReadonlySet<string>> = { ...state.taxonomies };
    if (current.size) nextTax[taxId] = current;
    else delete nextTax[taxId];
    onChange({ ...state, taxonomies: nextTax });
  };
  const reset = () => onChange(EMPTY_SHOP_FILTERS);

  const hasActiveFilters = countActiveShopFilters(state) > 0;

  return (
    <>
      {!hideHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('shop.filters.title')}</h2>
          {typeof resultCount === 'number' && (
            <span style={{ fontSize: 12, color: '#888' }}>
              {t('shop.filters.resultCount', { count: resultCount })}
            </span>
          )}
        </div>
      )}

      {availableCategories.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>{t('shop.filters.category')}</p>
          <label style={radioRowStyle}>
            <input
              type="radio"
              name="caspian-shop-category"
              checked={state.category === null}
              onChange={() => setCategory(null)}
            />
            <span>{t('shop.filters.allCategories')}</span>
          </label>
          {availableCategories.map((cat) => (
            <label key={cat} style={radioRowStyle}>
              <input
                type="radio"
                name="caspian-shop-category"
                checked={state.category === cat}
                onChange={() => setCategory(cat)}
              />
              <span>{categoryLabels?.get(cat) ?? cat}</span>
            </label>
          ))}
        </div>
      )}

      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>{t('shop.filters.price')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            value={state.minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder={t('shop.filters.minPrice')}
            min={0}
            style={priceInputStyle}
          />
          <input
            type="number"
            inputMode="numeric"
            value={state.maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={t('shop.filters.maxPrice')}
            min={0}
            style={priceInputStyle}
          />
        </div>
      </div>

      {availableSizes.length > 0 && (
        <div style={sectionStyle}>
          <p style={sectionTitleStyle}>{t('shop.filters.size')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {availableSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                style={pillStyle(state.sizes.has(size))}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {(availableTaxonomies ?? []).map((facet) =>
        facet.terms.length === 0 ? null : (
          <div key={facet.id} style={sectionStyle}>
            <p style={sectionTitleStyle}>{facet.label}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {facet.terms.map((term) => (
                <button
                  key={term.id}
                  type="button"
                  onClick={() => toggleTaxonomyTerm(facet.id, term.id)}
                  style={pillStyle(state.taxonomies[facet.id]?.has(term.id) ?? false)}
                >
                  {term.name}
                </button>
              ))}
            </div>
          </div>
        ),
      )}

      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 8, paddingBottom: 8 }}>
        <p style={sectionTitleStyle}>{t('shop.filters.quickFilters')}</p>
        <label style={radioRowStyle}>
          <input
            type="checkbox"
            checked={state.isNew}
            onChange={(e) => onChange({ ...state, isNew: e.target.checked })}
          />
          <span>{t('shop.filters.newArrivals')}</span>
        </label>
        <label style={radioRowStyle}>
          <input
            type="checkbox"
            checked={state.limited}
            onChange={(e) => onChange({ ...state, limited: e.target.checked })}
          />
          <span>{t('shop.filters.limited')}</span>
        </label>
      </div>

      {!hideReset && hasActiveFilters && (
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            color: 'var(--caspian-primary, #111)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('shop.filters.reset')}
        </button>
      )}
    </>
  );
}

export function ShopFilterSidebar({
  className,
  ...fieldsProps
}: ShopFilterSidebarProps) {
  return (
    <aside
      className={cn('caspian-shop-filter-sidebar', className)}
      style={{
        padding: 20,
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 'var(--caspian-radius, 8px)',
        background: '#fff',
        alignSelf: 'start',
        position: 'sticky',
        top: 16,
      }}
    >
      <ShopFilterFields {...fieldsProps} />
    </aside>
  );
}

const priceInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 'var(--caspian-radius, 8px)',
  outline: 'none',
  background: '#fff',
};

/** Shared rounded toggle-pill style for the Size and taxonomy facet sections. */
function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    border: active
      ? '1px solid var(--caspian-primary, #111)'
      : '1px solid rgba(0,0,0,0.15)',
    borderRadius: 999,
    background: active ? 'var(--caspian-primary, #111)' : '#fff',
    color: active ? 'var(--caspian-primary-foreground, #fff)' : '#222',
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s, border-color 0.1s',
  };
}
