'use client';

import { useId, useMemo, useState } from 'react';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Input, Label, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { FieldDescription } from '../ui/field-description';
import { CountryPickerDialog, type IsoCountry } from './country-picker-dialog';
import type { AnyPluginInstall, CatalogPlugin, PluginInstallWrite } from './admin-plugin-registry';

/**
 * The configuration form for one plugin install, shared by every plugin
 * category. These are the field bodies that used to live inside the three
 * category pages' configure dialogs; the settings page now renders them
 * full-page, one per install.
 */

/** Editable form state. Config values are kept as strings while typing. */
export interface PluginInstallDraft {
  name: string;
  order: number;
  config: Record<string, string>;
  /** Payment only. */
  description: string;
  /** Shipping only. */
  estimatedDaysMin: number;
  /** Shipping only. */
  estimatedDaysMax: number;
  /** Shipping only. ISO-2 codes; empty = everywhere. */
  eligibleCountries: string[];
}

function stringifyConfig(cfg: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

export function draftFromDefaults(plugin: CatalogPlugin, order: number): PluginInstallDraft {
  return {
    name: plugin.name,
    order,
    config: stringifyConfig(plugin.defaultConfig),
    description: '',
    estimatedDaysMin: 3,
    estimatedDaysMax: 7,
    eligibleCountries: [],
  };
}

export function draftFromInstall(install: AnyPluginInstall): PluginInstallDraft {
  const config = stringifyConfig(install.config);
  // Legacy (v2.0 / v2.1) stripe installs stored a single `publishableKey`.
  // Seed the test/live slots so the owner doesn't have to re-paste.
  if (
    install.pluginId === 'stripe' &&
    config.publishableKey &&
    !config.publishableKeyLive &&
    !config.publishableKeyTest
  ) {
    if (config.publishableKey.startsWith('pk_live_')) {
      config.publishableKeyLive = config.publishableKey;
      if (!config.mode) config.mode = 'live';
    } else if (config.publishableKey.startsWith('pk_test_')) {
      config.publishableKeyTest = config.publishableKey;
      if (!config.mode) config.mode = 'test';
    }
  }
  return {
    name: install.name,
    order: install.order,
    config,
    description: install.description ?? '',
    estimatedDaysMin: install.estimatedDays?.min ?? 3,
    estimatedDaysMax: install.estimatedDays?.max ?? 7,
    eligibleCountries: [...(install.eligibleCountries ?? [])],
  };
}

/**
 * Turns the string draft into the stored config. Shipping configs are
 * numeric, so number-looking values become numbers there; every other
 * category stores trimmed strings. Empty values are dropped.
 */
export function coerceDraftConfig(
  plugin: CatalogPlugin,
  raw: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const trimmed = v.trim();
    if (trimmed === '') continue;
    if (plugin.category === 'shipping' && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      out[k] = Number(trimmed);
    } else {
      out[k] = trimmed;
    }
  }
  return out;
}

export function draftToWrite(
  plugin: CatalogPlugin,
  draft: PluginInstallDraft,
  enabled: boolean,
): PluginInstallWrite {
  const base: PluginInstallWrite = {
    name: draft.name.trim(),
    order: draft.order,
    enabled,
    config: coerceDraftConfig(plugin, draft.config),
  };
  if (plugin.category === 'shipping') {
    base.estimatedDays = { min: draft.estimatedDaysMin, max: draft.estimatedDaysMax };
    base.eligibleCountries = draft.eligibleCountries;
  }
  if (plugin.category === 'payment') {
    base.description = draft.description.trim();
  }
  return base;
}

export interface PluginInstallFormProps {
  plugin: CatalogPlugin;
  draft: PluginInstallDraft;
  onChange: (next: PluginInstallDraft) => void;
  /** Countries the shipping eligible-countries picker offers. */
  countrySource: readonly IsoCountry[];
}

export function PluginInstallForm({ plugin, draft, onChange, countrySource }: PluginInstallFormProps) {
  const t = useT();
  const baseId = useId();
  const set = (patch: Partial<PluginInstallDraft>) => onChange({ ...draft, ...patch });
  const setConfigValue = (key: string, value: string) =>
    onChange({ ...draft, config: { ...draft.config, [key]: value } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Label htmlFor={`${baseId}-name`}>{t('admin.plugins.field.name')}</Label>
        <Input
          id={`${baseId}-name`}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={plugin.name}
        />
        <FieldDescription>{t(`admin.plugins.field.nameHint.${plugin.category}`)}</FieldDescription>
      </div>

      {plugin.category === 'payment' && (
        <div>
          <Label htmlFor={`${baseId}-description`}>
            {t('admin.paymentPlugins.field.description')}
          </Label>
          <Textarea
            id={`${baseId}-description`}
            rows={2}
            value={draft.description}
            placeholder={plugin.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          <FieldDescription>{t('admin.paymentPlugins.field.descriptionHint')}</FieldDescription>
        </div>
      )}

      {plugin.category === 'shipping' ? (
        <div className="caspian-admin-grid-3" style={{ display: 'grid', gap: 12 }}>
          <NumberField
            id={`${baseId}-min`}
            label={t('admin.shippingPlugins.field.minDays')}
            value={draft.estimatedDaysMin}
            onChange={(v) => set({ estimatedDaysMin: v })}
          />
          <NumberField
            id={`${baseId}-max`}
            label={t('admin.shippingPlugins.field.maxDays')}
            value={draft.estimatedDaysMax}
            onChange={(v) => set({ estimatedDaysMax: v })}
          />
          <NumberField
            id={`${baseId}-order`}
            label={t('admin.plugins.field.order')}
            value={draft.order}
            onChange={(v) => set({ order: v })}
          />
        </div>
      ) : (
        <div style={{ maxWidth: 200 }}>
          <NumberField
            id={`${baseId}-order`}
            label={t('admin.plugins.field.order')}
            value={draft.order}
            onChange={(v) => set({ order: v })}
          />
        </div>
      )}
      <FieldDescription style={{ marginTop: -8 }}>
        {t(`admin.plugins.field.orderHint.${plugin.category}`)}
      </FieldDescription>

      {plugin.category === 'shipping' && (
        <ShippingConfigFields pluginId={plugin.id} draft={draft} setConfigValue={setConfigValue} />
      )}
      {plugin.category === 'payment' && (
        <PaymentConfigFields pluginId={plugin.id} draft={draft} setConfigValue={setConfigValue} />
      )}
      {plugin.category === 'email' && plugin.secretName && (
        <EmailSecretPanel secretName={plugin.secretName} />
      )}

      {plugin.category === 'shipping' && (
        <EligibleCountriesField
          selected={draft.eligibleCountries}
          source={countrySource}
          onChange={(codes) => set({ eligibleCountries: codes })}
        />
      )}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ConfigFieldsProps {
  pluginId: string;
  draft: PluginInstallDraft;
  setConfigValue: (key: string, value: string) => void;
}

function ShippingConfigFields({ pluginId, draft, setConfigValue }: ConfigFieldsProps) {
  const t = useT();
  const baseId = useId();
  const money = (key: string, labelKey: string) => (
    <MoneyField
      id={`${baseId}-${key}`}
      label={t(labelKey)}
      value={draft.config[key] ?? ''}
      onChange={(v) => setConfigValue(key, v)}
    />
  );

  switch (pluginId) {
    case 'flat-rate':
      return money('price', 'admin.shippingPlugins.field.flatRate.price');
    case 'free-shipping':
      return (
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
          {t('admin.shippingPlugins.field.freeShipping.hint')}
        </p>
      );
    case 'free-over-threshold':
      return (
        <div className="caspian-admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {money('threshold', 'admin.shippingPlugins.field.freeOverThreshold.threshold')}
          {money('fallbackPrice', 'admin.shippingPlugins.field.freeOverThreshold.fallbackPrice')}
        </div>
      );
    case 'weight-based':
      return (
        <>
          <div className="caspian-admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {money('basePrice', 'admin.shippingPlugins.field.weightBased.basePrice')}
            {money('pricePerKg', 'admin.shippingPlugins.field.weightBased.pricePerKg')}
          </div>
          <FieldDescription style={{ marginTop: -8 }}>
            {t('admin.shippingPlugins.field.weightBased.hint')}
          </FieldDescription>
        </>
      );
    default:
      return null;
  }
}

function RequiredMark() {
  return (
    <span style={{ color: '#b91c1c', marginLeft: 4 }} aria-hidden>
      *
    </span>
  );
}

function PaymentConfigFields({ pluginId, draft, setConfigValue }: ConfigFieldsProps) {
  const t = useT();
  const baseId = useId();
  const text = (
    key: string,
    labelKey: string,
    opts: { placeholder?: string; required?: boolean } = {},
  ) => (
    <div>
      <Label htmlFor={`${baseId}-${key}`}>
        {t(labelKey)}
        {opts.required && <RequiredMark />}
      </Label>
      <Input
        id={`${baseId}-${key}`}
        value={draft.config[key] ?? ''}
        onChange={(e) => setConfigValue(key, e.target.value)}
        placeholder={opts.placeholder}
      />
    </div>
  );
  const area = (key: string, labelKey: string, placeholder?: string, required?: boolean) => (
    <div>
      <Label htmlFor={`${baseId}-${key}`}>
        {t(labelKey)}
        {required && <RequiredMark />}
      </Label>
      <Textarea
        id={`${baseId}-${key}`}
        rows={3}
        value={draft.config[key] ?? ''}
        onChange={(e) => setConfigValue(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
  const instructions = () =>
    area(
      'instructions',
      'admin.paymentPlugins.field.instructions',
      t(`admin.paymentPlugins.field.instructionsPlaceholder.${pluginId}`),
      true,
    );

  switch (pluginId) {
    case 'stripe': {
      const mode = draft.config.mode === 'live' ? 'live' : 'test';
      return (
        <>
          <div>
            <Label htmlFor={`${baseId}-mode`}>{t('admin.paymentPlugins.field.stripe.mode')}</Label>
            <Select
              id={`${baseId}-mode`}
              value={mode}
              onChange={(e) => setConfigValue('mode', e.target.value)}
              options={[
                { value: 'test', label: t('admin.paymentPlugins.field.stripe.modeTest') },
                { value: 'live', label: t('admin.paymentPlugins.field.stripe.modeLive') },
              ]}
            />
            <FieldDescription>{t('admin.paymentPlugins.field.stripe.modeHint')}</FieldDescription>
          </div>
          {text('publishableKeyTest', 'admin.paymentPlugins.field.stripe.publishableKeyTest', {
            placeholder: 'pk_test_...',
            required: mode === 'test',
          })}
          <div>
            {text('publishableKeyLive', 'admin.paymentPlugins.field.stripe.publishableKeyLive', {
              placeholder: 'pk_live_...',
              required: mode === 'live',
            })}
            <FieldDescription>
              {t('admin.paymentPlugins.field.stripe.publishableKeyHint')}
            </FieldDescription>
          </div>
        </>
      );
    }
    case 'bacs':
      return (
        <>
          {instructions()}
          <div className="caspian-admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {text('accountName', 'admin.paymentPlugins.field.bacs.accountName', {
              placeholder: 'Acme Trading Co.',
              required: true,
            })}
            {text('accountNumber', 'admin.paymentPlugins.field.bacs.accountNumber', {
              placeholder: '12345678',
            })}
          </div>
          <div className="caspian-admin-grid-3" style={{ display: 'grid', gap: 12 }}>
            {text('sortCode', 'admin.paymentPlugins.field.bacs.sortCode', { placeholder: '12-34-56' })}
            {text('iban', 'admin.paymentPlugins.field.bacs.iban', { placeholder: 'GB82 WEST …' })}
            {text('swift', 'admin.paymentPlugins.field.bacs.swift', { placeholder: 'ABCDEF2L' })}
          </div>
          <FieldDescription style={{ marginTop: -8 }}>
            {t('admin.paymentPlugins.field.bacs.hint')}
          </FieldDescription>
        </>
      );
    case 'cheque':
      return (
        <>
          {instructions()}
          {text('payableTo', 'admin.paymentPlugins.field.cheque.payableTo', {
            placeholder: 'Acme Trading Co.',
          })}
          {area('postalAddress', 'admin.paymentPlugins.field.cheque.postalAddress')}
        </>
      );
    case 'cod':
      return (
        <>
          {instructions()}
          <div>
            {text('enabledForShippingMethods', 'admin.paymentPlugins.field.cod.shippingMethods')}
            <FieldDescription>{t('admin.paymentPlugins.field.cod.shippingMethodsHint')}</FieldDescription>
          </div>
        </>
      );
    default:
      return null;
  }
}

function EmailSecretPanel({ secretName }: { secretName: string }) {
  const t = useT();
  return (
    <div
      style={{
        background: '#f7f8fa',
        border: '1px solid #e1e4e8',
        borderRadius: 10,
        padding: 14,
        fontSize: 13,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6 }}>
        {t('admin.emailPlugins.secretSetup.title')}
      </strong>
      <p style={{ margin: '0 0 8px', color: '#555' }}>{t('admin.emailPlugins.secretSetup.body')}</p>
      <code
        style={{
          display: 'block',
          background: '#0d1117',
          color: '#e6edf3',
          padding: '8px 10px',
          borderRadius: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          overflowX: 'auto',
        }}
      >
        firebase functions:secrets:set {secretName}
      </code>
      <p style={{ margin: '8px 0 0', color: '#666', fontSize: 12 }}>
        {t('admin.emailPlugins.secretSetup.deployHint')}
      </p>
    </div>
  );
}

function EligibleCountriesField({
  selected,
  source,
  onChange,
}: {
  selected: string[];
  source: readonly IsoCountry[];
  onChange: (codes: string[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const nameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of source) map.set(c.code, c.name);
    return map;
  }, [source]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Label style={{ marginBottom: 0 }}>{t('admin.shippingPlugins.field.eligibleCountries')}</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {selected.length === 0
            ? t('admin.shippingPlugins.field.pickCountries')
            : t('admin.shippingPlugins.field.editCountries', { count: selected.length })}
        </Button>
      </div>
      {selected.length === 0 ? (
        <FieldDescription>{t('admin.shippingPlugins.field.eligibleCountriesAll')}</FieldDescription>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {selected.map((code) => (
            <span
              key={code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.05)',
              }}
            >
              <span style={{ fontFamily: 'monospace', color: '#555' }}>{code}</span>
              <span>{nameByCode.get(code) ?? ''}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== code))}
                aria-label={t('admin.shippingPlugins.field.removeCountry', { code })}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#888',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <CountryPickerDialog
        open={open}
        onOpenChange={setOpen}
        selected={selected}
        source={source}
        onConfirm={onChange}
        title={t('admin.shippingPlugins.pickCountriesTitle')}
      />
    </div>
  );
}
