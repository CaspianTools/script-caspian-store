'use client';

import { useMemo, useState } from 'react';
import { useScriptSettings } from '../context/script-settings-context';
import { useT } from '../i18n/locale-context';
import {
  THEME_CATALOG,
  THEME_CATEGORY_LABELS,
  countThemesByCategory,
  type CatalogTheme,
  type ThemeCategory,
} from '../theme/catalog';
import { useThemeUpdateTracker } from '../theme/theme-update-tracker';
import { ThemeThumbnail } from '../theme/theme-thumbnail';
import type { FontTokens, ThemeTokens } from '../types';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast';

export interface AdminAppearancePageProps {
  className?: string;
  /**
   * Route the Preview button opens in a popup window. Default: `/admin-preview/appearance`.
   *
   * The default lives outside `/admin/**` so the popup escapes `app/admin/layout.tsx`
   * (AdminGuard + AdminShell). Point it back at `/admin/appearance/preview` only if
   * you have a custom layout that doesn't wrap admin routes in a shell.
   */
  previewPath?: string;
}

const CATEGORY_ORDER: readonly ThemeCategory[] = [
  'all',
  'corporate',
  'shop',
  'creative',
  'portfolio',
  'education',
  'health-beauty',
  'events',
  'food',
  'marketing',
  'minimal',
];

export function AdminAppearancePage({
  className,
  previewPath = '/admin-preview/appearance',
}: AdminAppearancePageProps) {
  const { settings, saving, save } = useScriptSettings();
  const { toast } = useToast();
  const t = useT();

  const [category, setCategory] = useState<ThemeCategory>('all');
  const [query, setQuery] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const { isUpdated, markSeen } = useThemeUpdateTracker();

  const counts = useMemo(countThemesByCategory, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THEME_CATALOG.filter((theme) => {
      if (category !== 'all' && !theme.categories.includes(category)) return false;
      if (!q) return true;
      return (
        theme.name.toLowerCase().includes(q) ||
        theme.description.toLowerCase().includes(q) ||
        theme.categories.some((c) => THEME_CATEGORY_LABELS[c].toLowerCase().includes(q))
      );
    });
  }, [category, query]);

  const activeThemeId = useMemo(() => {
    const active = THEME_CATALOG.find((theme) => tokensEqual(theme.tokens, settings.theme));
    return active?.id ?? null;
  }, [settings.theme]);

  const handleActivate = async (theme: CatalogTheme) => {
    setActivatingId(theme.id);
    markSeen(theme.id, theme.version);
    try {
      const patch: { theme: ThemeTokens; fonts?: FontTokens } = { theme: theme.tokens };
      const themeFontFamily = theme.tokens.fontFamily ?? theme.fontFamily;
      if (theme.googleFamilies?.length || themeFontFamily) {
        const stack = themeFontFamily ?? 'system-ui, -apple-system, sans-serif';
        patch.fonts = {
          body: stack,
          headline: stack,
          ...(theme.googleFamilies?.length ? { googleFamilies: theme.googleFamilies } : {}),
        };
      }
      await save(patch);
      toast({ title: t('admin.appearance.activated', { name: theme.name }) });
    } catch (error) {
      console.error('[caspian-store] Failed to activate theme:', error);
      toast({ title: t('admin.appearance.saveFailed'), variant: 'destructive' });
    } finally {
      setActivatingId(null);
    }
  };

  const handlePreview = (theme: CatalogTheme) => {
    if (typeof window === 'undefined') return;
    markSeen(theme.id, theme.version);
    const url = `${previewPath}?theme=${encodeURIComponent(theme.id)}`;
    window.open(
      url,
      `caspian-theme-preview-${theme.id}`,
      'width=1280,height=860,resizable=yes,scrollbars=yes',
    );
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('admin.appearance.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.appearance.gridSubtitle')}</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <aside style={{ position: 'sticky', top: 16 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.appearance.searchPlaceholder')}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 'var(--caspian-radius, 8px)',
              boxSizing: 'border-box',
              outline: 'none',
              marginBottom: 16,
            }}
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#999',
              padding: '0 12px 8px',
            }}
          >
            {t('admin.appearance.categories')}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            {CATEGORY_ORDER.map((cat) => {
              const active = cat === category;
              const count = counts[cat];
              if (count === 0 && cat !== 'all') return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                    border: 0,
                    borderRadius: 8,
                    color: active ? '#111' : '#444',
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span>{THEME_CATEGORY_LABELS[cat]}</span>
                  <span style={{ color: active ? '#666' : '#999', fontSize: 12 }}>{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div>
          {filtered.length === 0 ? (
            <p style={{ color: '#666', padding: '48px 0', textAlign: 'center' }}>
              {t('admin.appearance.noResults')}
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 20,
              }}
            >
              {filtered.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={activeThemeId === theme.id}
                  activating={activatingId === theme.id}
                  updated={isUpdated(theme.id, theme.version)}
                  onPreview={() => handlePreview(theme)}
                  onActivate={() => handleActivate(theme)}
                  disabled={saving}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ProductCardSettingsSection />
    </div>
  );
}

function ProductCardSettingsSection() {
  const { settings, saving, save } = useScriptSettings();
  const { toast } = useToast();
  const t = useT();
  const showWishlist = settings.productCard?.showWishlistIcon ?? true;
  const showQuickAdd = settings.productCard?.showQuickAddIcon ?? true;

  const update = async (next: { showWishlistIcon: boolean; showQuickAddIcon: boolean }) => {
    try {
      await save({ productCard: next });
      toast({ title: t('admin.appearance.productCard.saved') });
    } catch (error) {
      console.error('[caspian-store] Failed to save product card settings:', error);
      toast({ title: t('admin.appearance.productCard.saveFailed'), variant: 'destructive' });
    }
  };

  return (
    <section
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>
        {t('admin.appearance.productCard.title')}
      </h2>
      <p style={{ color: '#666', margin: '0 0 16px', fontSize: 14 }}>
        {t('admin.appearance.productCard.subtitle')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showWishlist}
            disabled={saving}
            onChange={(e) =>
              update({
                showWishlistIcon: e.target.checked,
                showQuickAddIcon: showQuickAdd,
              })
            }
          />
          <span>{t('admin.appearance.productCard.showWishlist')}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showQuickAdd}
            disabled={saving}
            onChange={(e) =>
              update({
                showWishlistIcon: showWishlist,
                showQuickAddIcon: e.target.checked,
              })
            }
          />
          <span>{t('admin.appearance.productCard.showQuickAdd')}</span>
        </label>
      </div>
    </section>
  );
}

interface ThemeCardProps {
  theme: CatalogTheme;
  active: boolean;
  activating: boolean;
  updated: boolean;
  disabled: boolean;
  onPreview: () => void;
  onActivate: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ThemeCard({
  theme,
  active,
  activating,
  updated,
  disabled,
  onPreview,
  onActivate,
  t,
}: ThemeCardProps) {
  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: active ? '2px solid var(--caspian-primary, #111)' : '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        background: '#fff',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s, transform 0.05s',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '3 / 2', background: '#f5f5f5' }}>
        <ThemeThumbnail theme={theme} />
        {theme.isNew && <CornerBadge label={t('admin.appearance.badgeNew')} color="#2563eb" />}
        {!theme.isNew && updated && (
          <CornerBadge label={t('admin.appearance.badgeUpdated')} color="#0ea5e9" />
        )}
        {active && (
          <CornerBadge
            label={t('admin.appearance.badgeActive')}
            color="var(--caspian-primary, #111)"
            right
          />
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{theme.name}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', lineHeight: 1.4 }}>
            {theme.description}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {theme.categories.map((cat) => (
            <span
              key={cat}
              style={{
                fontSize: 11,
                color: '#666',
                background: 'rgba(0,0,0,0.05)',
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              {THEME_CATEGORY_LABELS[cat]}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
          <Button variant="outline" size="sm" onClick={onPreview} style={{ flex: 1 }}>
            {t('admin.appearance.previewButton')}
          </Button>
          <Button
            variant={active ? 'ghost' : 'primary'}
            size="sm"
            onClick={onActivate}
            disabled={disabled || active}
            loading={activating}
            style={{ flex: 1 }}
          >
            {active
              ? t('admin.appearance.activeButton')
              : activating
                ? t('admin.appearance.activating')
                : t('admin.appearance.activateButton')}
          </Button>
        </div>
      </div>
    </article>
  );
}

function CornerBadge({
  label,
  color,
  right,
}: {
  label: string;
  color: string;
  right?: boolean;
}) {
  return (
    <span
      style={{
        position: 'absolute',
        top: 12,
        [right ? 'right' : 'left']: 12,
        padding: '3px 10px',
        background: color,
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: 4,
      }}
    >
      {label}
    </span>
  );
}

function tokensEqual(a: ThemeTokens, b: ThemeTokens): boolean {
  return (
    a.primary === b.primary &&
    a.primaryForeground === b.primaryForeground &&
    a.accent === b.accent &&
    a.radius === b.radius
  );
}
