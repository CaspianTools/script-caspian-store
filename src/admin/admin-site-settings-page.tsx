'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AccountSettings,
  CurrencyDisplay,
  InventorySettings,
  PrivacyRetentionSettings,
  SiteSettings,
  SocialLink,
  SocialPlatform,
  StoreAddress,
  SupportedCountry,
  TaxConfig,
} from '../types';
import { SOCIAL_PLATFORMS } from '../types';
import { DEFAULT_INVENTORY_SETTINGS } from '../utils/inventory';
import { DEFAULT_TAX_CONFIG } from '../utils/tax';

const DEFAULT_ACCOUNTS: AccountSettings = {
  allowGuestCheckout: true,
  allowAccountCreationAtCheckout: true,
  allowAccountCreationOnMyAccount: true,
  sendPasswordSetupLink: false,
};
import { getSiteSettings, saveSiteSettings } from '../services/site-settings-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { SocialIcon } from '../components/social-icon';
import { Button } from '../ui/button';
import { ImageUploadField } from '../ui/image-upload-field';
import { Input, Label, Textarea } from '../ui/input';
import { Skeleton } from '../ui/misc';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { FieldHelp } from '../ui/field-help';
import { FieldDescription } from '../ui/field-description';
import { SearchableSelect, type SearchableSelectOption } from '../ui/searchable-select';
import { defaultCurrencyDisplay, formatCurrency } from '../utils/format-currency';
import { getSubdivisions } from '../data/subdivisions';
import { ALL_COUNTRIES } from '../utils/countries';
import { CountryPickerDialog, ISO_COUNTRIES } from './country-picker-dialog';

const emptySettings: SiteSettings = {
  logoUrl: '',
  faviconUrl: '',
  brandName: '',
  brandDescription: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  businessHours: '',
  currency: '',
  timezone: '',
  country: '',
  socialLinks: [],
};

/** Most-used ISO 4217 codes. Free-text fallback available via "Other". */
const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Select currency —' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'SEK', label: 'SEK — Swedish Krona' },
  { value: 'NOK', label: 'NOK — Norwegian Krone' },
  { value: 'DKK', label: 'DKK — Danish Krone' },
  { value: 'PLN', label: 'PLN — Polish Złoty' },
  { value: 'CZK', label: 'CZK — Czech Koruna' },
  { value: 'TRY', label: 'TRY — Turkish Lira' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'KRW', label: 'KRW — South Korean Won' },
  { value: 'THB', label: 'THB — Thai Baht' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { value: 'PHP', label: 'PHP — Philippine Peso' },
];

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter',
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};

function supportedTimezones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone');
    } catch {
      /* fall through */
    }
  }
  return [
    'UTC',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Amsterdam',
    'Europe/Stockholm',
    'Europe/Warsaw',
    'Europe/Istanbul',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Buenos_Aires',
    'Asia/Dubai',
    'Asia/Tel_Aviv',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];
}

export function AdminSiteSettingsPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const timezoneOptions = useMemo(
    () => [
      { value: '', label: '— Select timezone —' },
      ...supportedTimezones().map((tz) => ({ value: tz, label: tz })),
    ],
    [],
  );

  const localizationCountryOptions: SearchableSelectOption[] = useMemo(
    () => ALL_COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: c.code })),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const existing = await getSiteSettings(db);
        setDraft(existing ?? emptySettings);
      } catch (error) {
        console.error('[caspian-store] Failed to load site settings:', error);
        setDraft(emptySettings);
      }
    })();
  }, [db]);

  const patch = (p: Partial<SiteSettings>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.brandName.trim()) {
      toast({ title: 'Brand name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveSiteSettings(db, draft);
      toast({ title: 'Site settings saved' });
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateSocial = (idx: number, updated: SocialLink) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            socialLinks: d.socialLinks.map((s, i) => (i === idx ? updated : s)),
          }
        : d,
    );
  };

  const addSocial = () => {
    setDraft((d) =>
      d
        ? { ...d, socialLinks: [...d.socialLinks, { platform: 'instagram', url: '' }] }
        : d,
    );
  };

  const removeSocial = (idx: number) => {
    setDraft((d) =>
      d ? { ...d, socialLinks: d.socialLinks.filter((_, i) => i !== idx) } : d,
    );
  };

  if (!draft) {
    return (
      <div className={className}>
        <Skeleton style={{ height: 240 }} />
      </div>
    );
  }

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Site settings</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          Brand, contact, localization, store behavior, and tax. Rendered by the header, footer,
          and checkout.
        </p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Brand</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Label>Brand name</Label>
              <Input
                value={draft.brandName}
                onChange={(e) => patch({ brandName: e.target.value })}
              />
            </div>
            <div>
              <Label>Brand description</Label>
              <Textarea
                rows={2}
                value={draft.brandDescription}
                onChange={(e) => patch({ brandDescription: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ImageUploadField
                label="Logo"
                value={draft.logoUrl}
                onChange={(url) => patch({ logoUrl: url })}
                storagePath="siteSettings/logo"
                aspectRatio="3 / 1"
                previewMaxWidth={280}
                allowUrlFallback
              />
              <ImageUploadField
                label="Favicon"
                value={draft.faviconUrl ?? ''}
                onChange={(url) => patch({ faviconUrl: url })}
                storagePath="siteSettings/favicon"
                aspectRatio="1 / 1"
                previewMaxWidth={120}
                allowUrlFallback
              />
            </div>
            <p
              style={{
                gridColumn: '1 / -1',
                margin: '8px 0 0',
                fontSize: 12,
                color: '#666',
                lineHeight: 1.5,
              }}
            >
              <strong>Heads up:</strong> SVG logos and favicons can embed
              JavaScript. Only upload SVG files from sources you trust — paste
              the file content into a text editor first if you're unsure. Other
              storefront image uploads (products, journal, pages) reject SVG
              automatically; this surface accepts it because logos are commonly
              vector.
            </p>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Coming Soon mode
            <FieldHelp>
              When enabled, non-admin visitors see a "launching soon" splash instead of the
              storefront. Admin routes (`/admin/**`) are never blocked.
            </FieldHelp>
          </h2>
          <FieldDescription style={{ margin: '0 0 12px' }}>
            Useful while you're still setting the store up but the domain is already live.
          </FieldDescription>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={draft.comingSoon?.enabled ?? false}
                onChange={(e) =>
                  patch({
                    comingSoon: {
                      enabled: e.target.checked,
                      message: draft.comingSoon?.message ?? '',
                      allowAdminPreview: draft.comingSoon?.allowAdminPreview ?? true,
                    },
                  })
                }
              />
              <span>Enable Coming Soon mode</span>
            </label>
            {draft.comingSoon?.enabled && (
              <>
                <div>
                  <Label>Splash message</Label>
                  <Textarea
                    rows={2}
                    value={draft.comingSoon?.message ?? ''}
                    placeholder="We're launching soon."
                    onChange={(e) =>
                      patch({
                        comingSoon: {
                          enabled: draft.comingSoon?.enabled ?? false,
                          message: e.target.value,
                          allowAdminPreview: draft.comingSoon?.allowAdminPreview ?? true,
                        },
                      })
                    }
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={draft.comingSoon?.allowAdminPreview ?? true}
                    onChange={(e) =>
                      patch({
                        comingSoon: {
                          enabled: draft.comingSoon?.enabled ?? false,
                          message: draft.comingSoon?.message ?? '',
                          allowAdminPreview: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>Let signed-in admins preview the live storefront</span>
                </label>
              </>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Localization</h2>
          <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
            Used by the storefront for price formatting and checkout defaults. Safe to change
            later — existing orders retain the currency they were placed in.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <Label>Currency</Label>
              <Select
                value={draft.currency ?? ''}
                onChange={(e) => patch({ currency: e.target.value })}
                options={CURRENCY_OPTIONS}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Label>Timezone</Label>
              <Select
                value={draft.timezone ?? ''}
                onChange={(e) => patch({ timezone: e.target.value })}
                options={timezoneOptions}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Label>Country</Label>
              <SearchableSelect
                value={draft.country ?? ''}
                onChange={(v) => patch({ country: v })}
                options={localizationCountryOptions}
                placeholder="— Select country —"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Currency display
            <FieldHelp>
              Override how prices render across the storefront. When unset, Caspian uses your
              browser's locale-default format for the currency selected above.
            </FieldHelp>
          </h2>
          <FieldDescription style={{ margin: '0 0 12px' }}>
            Preview: <strong>{formatCurrency(1234.5, draft.currency || 'USD', { display: draft.currencyDisplay })}</strong>
          </FieldDescription>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={!!draft.currencyDisplay}
                onChange={(e) =>
                  patch({
                    currencyDisplay: e.target.checked
                      ? defaultCurrencyDisplay(draft.currency || 'USD')
                      : undefined,
                  })
                }
              />
              <span>Override automatic formatting</span>
            </label>
            {draft.currencyDisplay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Symbol position</Label>
                  <Select
                    value={draft.currencyDisplay.position}
                    onChange={(e) =>
                      patch({
                        currencyDisplay: {
                          ...(draft.currencyDisplay as CurrencyDisplay),
                          position: e.target.value as CurrencyDisplay['position'],
                        },
                      })
                    }
                    options={[
                      { value: 'left', label: 'Left ($99)' },
                      { value: 'right', label: 'Right (99$)' },
                      { value: 'left_space', label: 'Left with space ($ 99)' },
                      { value: 'right_space', label: 'Right with space (99 $)' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Label>Thousand separator</Label>
                  <Input
                    value={draft.currencyDisplay.thousandSep}
                    maxLength={1}
                    onChange={(e) =>
                      patch({
                        currencyDisplay: {
                          ...(draft.currencyDisplay as CurrencyDisplay),
                          thousandSep: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Decimal separator</Label>
                  <Input
                    value={draft.currencyDisplay.decimalSep}
                    maxLength={1}
                    onChange={(e) =>
                      patch({
                        currencyDisplay: {
                          ...(draft.currencyDisplay as CurrencyDisplay),
                          decimalSep: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Decimals</Label>
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={draft.currencyDisplay.decimals}
                    onChange={(e) =>
                      patch({
                        currencyDisplay: {
                          ...(draft.currencyDisplay as CurrencyDisplay),
                          decimals: Math.max(0, Math.min(6, Number(e.target.value) || 0)),
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Contact</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={draft.contactEmail}
                  onChange={(e) => patch({ contactEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={draft.contactPhone}
                  onChange={(e) => patch({ contactPhone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                rows={2}
                value={draft.contactAddress}
                onChange={(e) => patch({ contactAddress: e.target.value })}
              />
            </div>
            <div>
              <Label>Business hours</Label>
              <Textarea
                rows={2}
                value={draft.businessHours}
                onChange={(e) => patch({ businessHours: e.target.value })}
              />
            </div>
          </div>
        </div>

        <StoreAddressSection
          value={draft.storeAddress}
          legacy={draft.contactAddress}
          onChange={(next) => patch({ storeAddress: next })}
        />

        <div>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Social links</h2>
            <Button variant="outline" size="sm" onClick={addSocial}>
              + Add link
            </Button>
          </div>
          {draft.socialLinks.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>No social links configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draft.socialLinks.map((s, idx) => {
                const platformOptions = SOCIAL_PLATFORMS.map((p) => ({
                  value: p,
                  label: PLATFORM_LABELS[p],
                }));
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 200px 1fr auto',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      aria-hidden
                      title={PLATFORM_LABELS[s.platform]}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--caspian-radius, 6px)',
                        background: '#f3f4f6',
                        color: '#444',
                      }}
                    >
                      <SocialIcon platform={s.platform} />
                    </span>
                    <Select
                      value={s.platform}
                      onChange={(e) =>
                        updateSocial(idx, {
                          ...s,
                          platform: e.target.value as SocialPlatform,
                        })
                      }
                      options={platformOptions}
                    />
                    <Input
                      placeholder="https://…"
                      value={s.url}
                      onChange={(e) => updateSocial(idx, { ...s, url: e.target.value })}
                    />
                    <Button variant="destructive" size="sm" onClick={() => removeSocial(idx)}>
                      ✕
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Reviews policy
            <FieldHelp>
              Governs who can leave reviews and how the "verified purchase" badge renders.
            </FieldHelp>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={draft.reviewPolicy?.restrictToVerifiedBuyers ?? false}
                onChange={(e) =>
                  patch({
                    reviewPolicy: {
                      restrictToVerifiedBuyers: e.target.checked,
                      requireStarRating: draft.reviewPolicy?.requireStarRating ?? false,
                      showVerifiedBadge: draft.reviewPolicy?.showVerifiedBadge ?? true,
                    },
                  })
                }
              />
              <span>
                Only verified buyers can leave reviews
                <FieldDescription style={{ marginTop: 2 }}>
                  Non-buyers see a disabled form with an explanatory message.
                </FieldDescription>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={draft.reviewPolicy?.requireStarRating ?? false}
                onChange={(e) =>
                  patch({
                    reviewPolicy: {
                      restrictToVerifiedBuyers: draft.reviewPolicy?.restrictToVerifiedBuyers ?? false,
                      requireStarRating: e.target.checked,
                      showVerifiedBadge: draft.reviewPolicy?.showVerifiedBadge ?? true,
                    },
                  })
                }
              />
              <span>
                Require a star rating
                <FieldDescription style={{ marginTop: 2 }}>
                  Submissions without a rating are rejected.
                </FieldDescription>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={draft.reviewPolicy?.showVerifiedBadge ?? true}
                onChange={(e) =>
                  patch({
                    reviewPolicy: {
                      restrictToVerifiedBuyers: draft.reviewPolicy?.restrictToVerifiedBuyers ?? false,
                      requireStarRating: draft.reviewPolicy?.requireStarRating ?? false,
                      showVerifiedBadge: e.target.checked,
                    },
                  })
                }
              />
              <span>
                Show "verified purchase" badge on qualifying reviews
                <FieldDescription style={{ marginTop: 2 }}>
                  Turn off to hide the badge everywhere — verification is still tracked under the
                  hood.
                </FieldDescription>
              </span>
            </label>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Cart behavior
            <FieldHelp>
              Controls what happens immediately after a shopper clicks "Add to cart".
            </FieldHelp>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={draft.cartBehavior?.redirectToCartAfterAdd ?? false}
                onChange={(e) =>
                  patch({
                    cartBehavior: {
                      redirectToCartAfterAdd: e.target.checked,
                      ajaxOnArchives: draft.cartBehavior?.ajaxOnArchives ?? true,
                    },
                  })
                }
              />
              <span>
                Navigate to /cart after adding to cart
                <FieldDescription style={{ marginTop: 2 }}>
                  Off by default — shoppers stay on the product page and see a toast instead.
                </FieldDescription>
              </span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 14,
                opacity: 0.6,
              }}
            >
              <input
                type="checkbox"
                style={{ marginTop: 3 }}
                checked={draft.cartBehavior?.ajaxOnArchives ?? true}
                onChange={(e) =>
                  patch({
                    cartBehavior: {
                      redirectToCartAfterAdd: draft.cartBehavior?.redirectToCartAfterAdd ?? false,
                      ajaxOnArchives: e.target.checked,
                    },
                  })
                }
              />
              <span>
                Async add-to-cart on product list pages
                <FieldDescription style={{ marginTop: 2 }}>
                  Reserved for a future release — toggle has no storefront effect yet.
                </FieldDescription>
              </span>
            </label>
          </div>
        </div>

        <AccountsAndPrivacySection
          accounts={draft.accounts}
          privacy={draft.privacy}
          onChangeAccounts={(next) => patch({ accounts: next })}
          onChangePrivacy={(next) => patch({ privacy: next })}
        />

        <InventorySection
          value={draft.inventory}
          onChange={(next) => patch({ inventory: next })}
        />

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Tax & supported countries</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
            Controls which countries shoppers can pick at checkout and how tax is estimated.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Tax mode</Label>
                <Select
                  value={draft.taxMode ?? 'none'}
                  onChange={(e) => patch({ taxMode: e.target.value as SiteSettings['taxMode'] })}
                  options={[
                    { value: 'none', label: 'No tax' },
                    { value: 'flat', label: 'Flat rate (all orders)' },
                    { value: 'per-country', label: 'Per-country rates' },
                  ]}
                />
              </div>
              <div>
                <Label>Tax label</Label>
                <Input
                  placeholder="Sales tax / VAT"
                  value={draft.taxLabel ?? ''}
                  onChange={(e) => patch({ taxLabel: e.target.value })}
                />
              </div>
            </div>
            {draft.taxMode === 'flat' && (
              <div>
                <Label>Flat tax rate (decimal, e.g. 0.08 for 8%)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={draft.flatTaxRate ?? 0}
                  onChange={(e) => patch({ flatTaxRate: Number(e.target.value) })}
                />
              </div>
            )}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Label style={{ marginBottom: 0 }}>Supported countries</Label>
                <Button variant="outline" size="sm" onClick={() => setCountryPickerOpen(true)}>
                  {(draft.supportedCountries?.length ?? 0) === 0
                    ? '+ Add countries'
                    : 'Manage countries'}
                </Button>
              </div>
              {(draft.supportedCountries?.length ?? 0) === 0 ? (
                <p style={{ fontSize: 13, color: '#888', margin: '8px 0 0' }}>
                  No countries configured. Checkout falls back to a default list of 6 countries
                  until you add your own.
                </p>
              ) : (
                <div
                  style={{
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {(draft.supportedCountries ?? []).map((c, idx) => (
                    <div
                      key={c.code}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          draft.taxMode === 'per-country'
                            ? '40px 1fr 120px 40px'
                            : '40px 1fr 40px',
                        gap: 10,
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderBottom:
                          idx === (draft.supportedCountries?.length ?? 0) - 1
                            ? 0
                            : '1px solid rgba(0,0,0,0.05)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>
                        {c.code}
                      </span>
                      <span style={{ fontSize: 14 }}>{c.name}</span>
                      {draft.taxMode === 'per-country' && (
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max="1"
                          value={c.taxRate ?? ''}
                          placeholder="0.00"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const next = [...(draft.supportedCountries ?? [])];
                            const parsed = raw === '' ? undefined : Number(raw);
                            next[idx] = {
                              ...c,
                              taxRate: Number.isFinite(parsed as number)
                                ? (parsed as number)
                                : undefined,
                            };
                            patch({ supportedCountries: next });
                          }}
                          style={{
                            padding: '6px 8px',
                            border: '1px solid rgba(0,0,0,0.15)',
                            borderRadius: 6,
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => {
                          const next = (draft.supportedCountries ?? []).filter(
                            (x) => x.code !== c.code,
                          );
                          patch({ supportedCountries: next });
                        }}
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: '#888',
                          cursor: 'pointer',
                          fontSize: 16,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {draft.taxMode === 'per-country' && (
                <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                  Tax rate is a decimal (e.g. 0.08 for 8%). Leave blank to charge no tax for
                  that country.
                </p>
              )}
            </div>
            <TaxOptionsSubSection
              value={draft.taxConfig}
              onChange={(next) => patch({ taxConfig: next })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleSave} loading={saving}>
            Save settings
          </Button>
        </div>
      </section>

      <CountryPickerDialog
        open={countryPickerOpen}
        onOpenChange={setCountryPickerOpen}
        selected={(draft.supportedCountries ?? []).map((c) => c.code)}
        onConfirm={(codes) => {
          // Preserve existing tax rates when a country is kept; add new rows
          // with empty taxRate; drop rows that were deselected.
          const existing = new Map(
            (draft.supportedCountries ?? []).map((c) => [c.code, c] as const),
          );
          const next: SupportedCountry[] = codes.map((code) => {
            const prev = existing.get(code);
            if (prev) return prev;
            const iso = ISO_COUNTRIES.find((x) => x.code === code);
            return { code, name: iso?.name ?? code };
          });
          patch({ supportedCountries: next });
        }}
      />
    </div>
  );
}

function StoreAddressSection({
  value,
  legacy,
  onChange,
}: {
  value: StoreAddress | undefined;
  legacy: string;
  onChange: (next: StoreAddress | undefined) => void;
}) {
  const enabled = !!value;
  const address: StoreAddress = value ?? {
    line1: legacy?.trim() || '',
    line2: '',
    city: '',
    stateOrRegion: '',
    country: '',
    postcode: '',
  };

  const countryOptions: SearchableSelectOption[] = useMemo(
    () => ISO_COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: c.code })),
    [],
  );

  const subdivisions = getSubdivisions(address.country);
  const stateOptions: SearchableSelectOption[] | null = subdivisions
    ? subdivisions.map((s) => ({ value: s.code, label: s.name, hint: s.code }))
    : null;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Store address
        <FieldHelp>
          The physical address your business operates from. Used as the default basis for tax and
          shipping calculations, and printed on emails and invoices.
        </FieldHelp>
      </h2>
      <FieldDescription style={{ margin: '0 0 12px' }}>
        The single-line "Address" field above is kept for backward compatibility. Fill out the
        structured fields to override it.
      </FieldDescription>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? address : undefined)}
        />
        <span>Use structured store address</span>
      </label>
      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label>Address line 1</Label>
            <Input
              value={address.line1}
              onChange={(e) => onChange({ ...address, line1: e.target.value })}
            />
          </div>
          <div>
            <Label>Address line 2 (optional)</Label>
            <Input
              value={address.line2 ?? ''}
              onChange={(e) => onChange({ ...address, line2: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>City</Label>
              <Input
                value={address.city}
                onChange={(e) => onChange({ ...address, city: e.target.value })}
              />
            </div>
            <div>
              <Label>Postcode / ZIP</Label>
              <Input
                value={address.postcode}
                onChange={(e) => onChange({ ...address, postcode: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Country</Label>
              <SearchableSelect
                value={address.country}
                onChange={(v) =>
                  onChange({
                    ...address,
                    country: v,
                    // Reset state when country changes so stale codes don't linger.
                    stateOrRegion: '',
                  })
                }
                options={countryOptions}
                placeholder="— Select country —"
              />
            </div>
            <div>
              <Label>State / region</Label>
              {stateOptions ? (
                <SearchableSelect
                  value={address.stateOrRegion}
                  onChange={(v) => onChange({ ...address, stateOrRegion: v })}
                  options={stateOptions}
                  placeholder="— Select state —"
                />
              ) : (
                <Input
                  value={address.stateOrRegion}
                  placeholder={
                    address.country
                      ? 'State / region / province'
                      : 'Select a country to pick a subdivision'
                  }
                  onChange={(e) => onChange({ ...address, stateOrRegion: e.target.value })}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountsAndPrivacySection({
  accounts,
  privacy,
  onChangeAccounts,
  onChangePrivacy,
}: {
  accounts: AccountSettings | undefined;
  privacy: PrivacyRetentionSettings | undefined;
  onChangeAccounts: (next: AccountSettings) => void;
  onChangePrivacy: (next: PrivacyRetentionSettings | undefined) => void;
}) {
  const current: AccountSettings = accounts ?? DEFAULT_ACCOUNTS;
  const privacyCurrent: PrivacyRetentionSettings = privacy ?? {};
  const setPrivacy = (patchFields: Partial<PrivacyRetentionSettings>) => {
    const next = { ...privacyCurrent, ...patchFields };
    const empty = Object.values(next).every((v) => v === undefined || v === null);
    onChangePrivacy(empty ? undefined : next);
  };

  const retentionField = (
    label: string,
    key: keyof PrivacyRetentionSettings,
    hint: string,
  ) => {
    const raw = privacyCurrent[key];
    return (
      <div>
        <Label>{label}</Label>
        <Input
          type="number"
          min={0}
          placeholder="Keep indefinitely"
          value={raw === undefined ? '' : String(raw)}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === '') {
              setPrivacy({ [key]: undefined } as Partial<PrivacyRetentionSettings>);
            } else {
              const num = Math.max(0, Math.floor(Number(v)));
              setPrivacy({ [key]: Number.isFinite(num) ? num : undefined } as Partial<PrivacyRetentionSettings>);
            }
          }}
        />
        <FieldDescription>{hint}</FieldDescription>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Accounts & privacy
        <FieldHelp>
          Controls how shoppers sign up, whether guests can check out, and how long you keep
          personal data before the retention Cloud Function deletes it.
        </FieldHelp>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            style={{ marginTop: 3 }}
            checked={current.allowGuestCheckout}
            onChange={(e) => onChangeAccounts({ ...current, allowGuestCheckout: e.target.checked })}
          />
          <span>
            Allow guest checkout
            <FieldDescription style={{ marginTop: 2 }}>
              Shoppers can complete checkout without picking a password — the storefront signs
              them in with Firebase anonymous auth. Requires the Anonymous sign-in provider to
              be enabled in Firebase Authentication.
            </FieldDescription>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            style={{ marginTop: 3 }}
            checked={current.allowAccountCreationAtCheckout}
            onChange={(e) =>
              onChangeAccounts({ ...current, allowAccountCreationAtCheckout: e.target.checked })
            }
          />
          <span>
            Allow customers to create an account during checkout
            <FieldDescription style={{ marginTop: 2 }}>
              Shows a "Create an account" CTA on the checkout sign-in gate when the shopper
              isn't signed in.
            </FieldDescription>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            style={{ marginTop: 3 }}
            checked={current.allowAccountCreationOnMyAccount}
            onChange={(e) =>
              onChangeAccounts({ ...current, allowAccountCreationOnMyAccount: e.target.checked })
            }
          />
          <span>
            Allow customers to register on the My Account page
            <FieldDescription style={{ marginTop: 2 }}>
              When off, <code>/register</code> renders a "registration disabled" notice instead
              of the signup form.
            </FieldDescription>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            style={{ marginTop: 3 }}
            checked={current.sendPasswordSetupLink}
            onChange={(e) =>
              onChangeAccounts({ ...current, sendPasswordSetupLink: e.target.checked })
            }
          />
          <span>
            Send a password setup link on sign-up
            <FieldDescription style={{ marginTop: 2 }}>
              Registration skips the "pick a password" step — the storefront generates a random
              password, signs the user in, and emails a reset link so they can choose their own.
            </FieldDescription>
          </span>
        </label>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 4px' }}>
        Personal-data retention
      </h3>
      <FieldDescription style={{ margin: '0 0 10px' }}>
        The scheduled retention Cloud Function (<code>runRetentionCleanup</code>) reads these
        values daily. Leave a field blank to keep data indefinitely.
      </FieldDescription>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {retentionField(
          'Inactive accounts (days)',
          'retainInactiveAccountsDays',
          'Delete user docs + Auth record when createdAt is older than this.',
        )}
        {retentionField(
          'Cancelled orders (days)',
          'retainCancelledOrdersDays',
          "Delete orders in status 'cancelled' older than this.",
        )}
        {retentionField(
          'Failed orders (days)',
          'retainFailedOrdersDays',
          "Delete orders in a failed / errored state older than this.",
        )}
        {retentionField(
          'Completed orders (days)',
          'retainCompletedOrdersDays',
          "Delete orders in status 'delivered' older than this.",
        )}
        {retentionField(
          'Error logs (days)',
          'retainErrorLogsDays',
          'Delete error logs older than this. Surfaced on the About page.',
        )}
      </div>
    </div>
  );
}

function InventorySection({
  value,
  onChange,
}: {
  value: InventorySettings | undefined;
  onChange: (next: InventorySettings | undefined) => void;
}) {
  const enabled = value?.trackStock ?? false;
  const settings: InventorySettings = value ?? DEFAULT_INVENTORY_SETTINGS;
  const update = (patchFields: Partial<InventorySettings>) =>
    onChange({ ...settings, ...patchFields });

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Inventory
        <FieldHelp>
          Track per-size stock counts on each product (in the product editor) and surface
          low / out-of-stock badges on the storefront. Off by default — opt-in per store.
        </FieldHelp>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              onChange(e.target.checked ? { ...settings, trackStock: true } : undefined)
            }
          />
          <span>Manage stock</span>
        </label>
        {enabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Low-stock threshold</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.lowStockThreshold}
                  onChange={(e) =>
                    update({ lowStockThreshold: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
                <FieldDescription>
                  When a product's total units across all sizes is at or below this, the storefront
                  shows a "Low stock" badge.
                </FieldDescription>
              </div>
              <div>
                <Label>Out-of-stock threshold</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.outOfStockThreshold}
                  onChange={(e) =>
                    update({ outOfStockThreshold: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
                <FieldDescription>
                  Per-size unit count at or below this is considered out of stock. Usually 0.
                </FieldDescription>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Out-of-stock visibility</Label>
                <Select
                  value={settings.outOfStockVisibility}
                  onChange={(e) =>
                    update({
                      outOfStockVisibility: e.target.value as InventorySettings['outOfStockVisibility'],
                    })
                  }
                  options={[
                    { value: 'show', label: 'Show in catalog with badge' },
                    { value: 'hide', label: 'Hide from catalog entirely' },
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <Label>Stock badge display</Label>
                <Select
                  value={settings.stockDisplay}
                  onChange={(e) =>
                    update({ stockDisplay: e.target.value as InventorySettings['stockDisplay'] })
                  }
                  options={[
                    { value: 'always', label: 'Always show in-stock / low-stock badges' },
                    { value: 'low', label: 'Only when low or out of stock' },
                    { value: 'never', label: 'Never show stock badges' },
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TaxOptionsSubSection({
  value,
  onChange,
}: {
  value: TaxConfig | undefined;
  onChange: (next: TaxConfig | undefined) => void;
}) {
  const enabled = value !== undefined;
  const config: TaxConfig = value ?? DEFAULT_TAX_CONFIG;
  const update = (patchFields: Partial<TaxConfig>) => onChange({ ...config, ...patchFields });

  return (
    <div style={{ marginTop: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px' }}>
        Tax display options
        <FieldHelp>
          Layered on top of the rate table above. Every field is optional — defaults preserve
          pre-v2.12 behavior (tax added on top at checkout, no price-display suffix, single tax row).
        </FieldHelp>
      </h3>
      <FieldDescription style={{ margin: '0 0 10px' }}>
        Enable to override how tax renders across the storefront and which address drives the
        per-country rate lookup.
      </FieldDescription>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? DEFAULT_TAX_CONFIG : undefined)}
        />
        <span>Customize tax display</span>
      </label>
      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Prices entered with tax</Label>
              <Select
                value={config.pricesEnteredWithTax ? 'incl' : 'excl'}
                onChange={(e) =>
                  update({ pricesEnteredWithTax: e.target.value === 'incl' })
                }
                options={[
                  { value: 'excl', label: 'No, prices exclude tax' },
                  { value: 'incl', label: 'Yes, prices include tax' },
                ]}
                style={{ width: '100%' }}
              />
              <FieldDescription>
                Only relevant if you want the storefront to strip tax out of displayed prices.
                Checkout math still uses the rate configured above.
              </FieldDescription>
            </div>
            <div>
              <Label>Calculate tax based on</Label>
              <Select
                value={config.taxBasedOn}
                onChange={(e) => update({ taxBasedOn: e.target.value as TaxConfig['taxBasedOn'] })}
                options={[
                  { value: 'shipping', label: 'Customer shipping address' },
                  { value: 'billing', label: 'Customer billing address (reserved)' },
                  { value: 'store', label: 'Shop base country' },
                ]}
                style={{ width: '100%' }}
              />
              <FieldDescription>
                <code>billing</code> falls back to the shipping address — checkout doesn't collect
                a separate billing address yet.
              </FieldDescription>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Shop price display</Label>
              <Select
                value={config.displayPricesInShop}
                onChange={(e) =>
                  update({ displayPricesInShop: e.target.value as TaxConfig['displayPricesInShop'] })
                }
                options={[
                  { value: 'excl', label: 'Excluding tax' },
                  { value: 'incl', label: 'Including tax' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <Label>Cart & checkout price display</Label>
              <Select
                value={config.displayPricesCartCheckout}
                onChange={(e) =>
                  update({
                    displayPricesCartCheckout:
                      e.target.value as TaxConfig['displayPricesCartCheckout'],
                  })
                }
                options={[
                  { value: 'excl', label: 'Excluding tax' },
                  { value: 'incl', label: 'Including tax' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <Label>Price display suffix</Label>
            <Input
              value={config.priceDisplaySuffix}
              placeholder="incl. VAT  •  or: ex. GST"
              onChange={(e) => update({ priceDisplaySuffix: e.target.value })}
            />
            <FieldDescription>
              Appended after every rendered price. Use the <code>{'{rate}'}</code> placeholder to
              inline the active rate (e.g. <code>inc. {'{rate}'} VAT</code> → <code>inc. 8% VAT</code>).
            </FieldDescription>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Round tax</Label>
              <Select
                value={config.roundAtSubtotalLevel ? 'subtotal' : 'per-line'}
                onChange={(e) =>
                  update({ roundAtSubtotalLevel: e.target.value === 'subtotal' })
                }
                options={[
                  { value: 'subtotal', label: 'At subtotal level' },
                  { value: 'per-line', label: 'Per line item (reserved)' },
                ]}
                style={{ width: '100%' }}
              />
              <FieldDescription>
                Per-line rounding is reserved for future multi-class support; the single-rate
                engine rounds at the subtotal either way.
              </FieldDescription>
            </div>
            <div>
              <Label>Checkout tax row</Label>
              <Select
                value={config.displayTaxTotals}
                onChange={(e) =>
                  update({ displayTaxTotals: e.target.value as TaxConfig['displayTaxTotals'] })
                }
                options={[
                  { value: 'single', label: 'Single "Tax" row' },
                  { value: 'itemized', label: 'Itemized per class (reserved)' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
