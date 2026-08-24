'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocaleControls, useT } from '../i18n/locale-context';
import { BUILTIN_LOCALE_NAMES } from '../i18n/locales';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { FieldDescription } from '../ui/field-description';
import { getPosDeviceId, getPosDeviceLabel, setPosDeviceLabel } from './pos-device';
import { readScannerGapMs, resolvePosStorageMode, writeScannerGapMs } from './pos-preferences';
import type { PosStorageMode } from './storage/types';
import { useCaspianFirebaseOptional } from '../provider/caspian-store-provider';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseSection } from './license/pos-license-section';

export interface PosSettingsPageProps {
  className?: string;
}

/** Languages exposed by the POS settings picker. */
const POS_LOCALES = ['en', 'az'] as const;

interface SectionConfig {
  id: string;
  labelKey: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'language', labelKey: 'pos.settings.section.language' },
  { id: 'device', labelKey: 'pos.settings.section.device' },
  { id: 'license', labelKey: 'pos.settings.section.license' },
  { id: 'storage', labelKey: 'pos.settings.section.storage' },
  { id: 'scanner', labelKey: 'pos.settings.section.scanner' },
];

/**
 * Per-register settings — everything here applies to this computer only.
 *
 * A sidebar lets cashiers jump between sections, and the language picker is
 * intentionally limited to English and Azerbaijani for now.
 */
export function PosSettingsPage({ className }: PosSettingsPageProps) {
  const t = useT();
  const { toast } = useToast();
  const { locale, setLocale, pinned } = useLocaleControls();
  const firebase = useCaspianFirebaseOptional();
  const functions = firebase?.functions ?? null;
  const license = usePosLicense(functions);

  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [gapMs, setGapMs] = useState(40);
  const [collapsed, setCollapsed] = useState(false);
  // Derived, not chosen — see `resolvePosStorageMode`.
  const storageMode: PosStorageMode = resolvePosStorageMode(Boolean(firebase));

  useEffect(() => {
    setDeviceId(getPosDeviceId());
    setLabel(getPosDeviceLabel());
    setGapMs(readScannerGapMs());
  }, []);

  const save = () => {
    setPosDeviceLabel(label);
    writeScannerGapMs(gapMs);
    toast({ title: t('pos.settings.saved') });
  };

  const languageOptions = useMemo(
    () =>
      POS_LOCALES.map((code) => ({
        value: code,
        label: BUILTIN_LOCALE_NAMES[code] ?? code,
      })),
    [],
  );

  const scrollTo = (id: string) => {
    const el = document.getElementById(`pos-settings-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 24,
        padding: 24,
        maxWidth: 960,
        margin: '0 auto',
        alignItems: 'flex-start',
      }}
    >
      <aside
        style={{
          width: collapsed ? 44 : 200,
          flexShrink: 0,
          position: 'sticky',
          top: 16,
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 'var(--caspian-radius, 12px)',
          padding: 8,
          background: 'var(--caspian-background, #fff)',
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('common.expand') : t('common.collapse')}
          style={sidebarToggle}
        >
          {collapsed ? '›' : '‹'}
        </button>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              style={{
                ...sidebarLink,
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              title={t(s.labelKey)}
            >
              {collapsed ? s.labelKey.split('.').pop()?.[0].toUpperCase() : t(s.labelKey)}
            </button>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('pos.settings.title')}</h1>
          <p style={{ color: '#666', marginTop: 4 }}>{t('pos.settings.subtitle')}</p>
        </header>

        <section id="pos-settings-language" style={section}>
          <label style={field}>
            <span style={fieldLabel}>{t('pos.settings.language')}</span>
            <Select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              options={languageOptions}
            />
            <FieldDescription>{t('pos.settings.languageHelp')}</FieldDescription>
            {pinned ? <FieldDescription>{t('pos.settings.languagePinned')}</FieldDescription> : null}
          </label>
        </section>

        <section id="pos-settings-device" style={section}>
          <label style={field}>
            <span style={fieldLabel}>{t('pos.settings.deviceLabel')}</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('pos.settings.deviceLabelPlaceholder')}
            />
            <FieldDescription>{t('pos.settings.deviceLabelHelp')}</FieldDescription>
          </label>

          <label style={field}>
            <span style={fieldLabel}>{t('pos.settings.deviceId')}</span>
            <Input value={deviceId} readOnly style={{ fontFamily: 'ui-monospace, monospace' }} />
          </label>
        </section>

        <div id="pos-settings-license">
          <PosLicenseSection license={license} />
        </div>

        <section id="pos-settings-storage" style={section}>
          <span style={fieldLabel}>{t('pos.storage.title')}</span>
          <FieldDescription>{t('pos.storage.decidedAtSetup')}</FieldDescription>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(['cloud', 'local'] as const).map((mode) => (
              <label key={mode} style={radioRow}>
                <input
                  type="radio"
                  name="pos-storage-mode"
                  value={mode}
                  checked={storageMode === mode}
                  readOnly
                  disabled
                />
                <span>
                  <strong>{t(`pos.storage.${mode}`)}</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>{t(`pos.storage.${mode}Help`)}</div>
                  {mode === 'local' && storageMode === 'local' ? (
                    <div style={{ fontSize: 12, color: '#b45309' }}>
                      {t('pos.storage.localWarning')}
                    </div>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section id="pos-settings-scanner" style={section}>
          <label style={field}>
            <span style={fieldLabel}>{t('pos.settings.scannerGap')}</span>
            <Input
              type="number"
              min={10}
              max={300}
              value={gapMs}
              onChange={(e) => setGapMs(Number.parseInt(e.target.value, 10) || 40)}
            />
            <FieldDescription>{t('pos.settings.scannerGapHelp')}</FieldDescription>
          </label>

          <label style={field}>
            <span style={fieldLabel}>{t('pos.settings.printer')}</span>
            <Select
              value="browser"
              disabled
              onChange={() => undefined}
              options={[{ value: 'browser', label: t('pos.settings.printerBrowser') }]}
            />
            <FieldDescription>{t('pos.settings.printerBrowserHelp')}</FieldDescription>
          </label>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={save}>{t('pos.settings.save')}</Button>
        </div>
      </div>
    </div>
  );
}

const section: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 'var(--caspian-radius, 12px)',
  padding: 16,
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600 };

const radioRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  padding: 10,
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 'var(--caspian-radius, 8px)',
  cursor: 'pointer',
};

const sidebarToggle: React.CSSProperties = {
  width: '100%',
  padding: '6px 0',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  color: '#666',
  borderRadius: 'calc(var(--caspian-radius, 8px) - 4px)',
};

const sidebarLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  color: 'inherit',
  borderRadius: 'calc(var(--caspian-radius, 8px) - 4px)',
  textAlign: 'left',
  width: '100%',
};
