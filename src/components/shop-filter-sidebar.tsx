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
}

export const EMPTY_SHOP_FILTERS: ShopFilterState = {
  category: null,
  minPrice: '',
  maxPrice: '',
  sizes: new Set<string>(),
  isNew: false,
  limited: false,
};

export interface ShopFilterSidebarProps {
  state: ShopFilterState;
  onChange: (next: ShopFilterState) => void;
  /** Categories present in the loaded product set; the radio list. */
  availableCategories: readonly string[];
  /** Map from category value (the string stored on `product.category`, usually
   *  a Firestore category id) to the human display label. When omitted, or
   *  when a value isn't in the map, the raw value is shown — matches the
   *  legacy behaviour for free-text categories. */
  categoryLabels?: ReadonlyMap<string, string>;
  /** Sizes present in the loaded product set; the chip checkboxes. */
  availableSizes: readonly string[];
  /** Total number of products visible after filters apply. Renders the count line. */
  resultCount?: number;
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

export function ShopFilterSidebar({
  state,
  onChange,
  availableCategories,
  categoryLabels,
  availableSizes,
  resultCount,
  className,
}: ShopFilterSidebarProps) {
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
  const reset = () => onChange(EMPTY_SHOP_FILTERS);

  const hasActiveFilters =
    state.category !== null ||
    state.minPrice !== '' ||
    state.maxPrice !== '' ||
    state.sizes.size > 0 ||
    state.isNew ||
    state.limited;

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
            {availableSizes.map((size) => {
              const active = state.sizes.has(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  style={{
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
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
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

      {hasActiveFilters && (
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
