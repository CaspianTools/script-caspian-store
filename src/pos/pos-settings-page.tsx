'use client';

import { useEffect, useState } from 'react';
import { useLocaleControls, useT } from '../i18n/locale-context';
import { BUILTIN_LOCALE_CODES, BUILTIN_LOCALE_NAMES } from '../i18n/locales';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { FieldDescription } from '../ui/field-description';
import { getPosDeviceId, getPosDeviceLabel, setPosDeviceLabel } from './pos-device';
import {
  readScannerGapMs,
  readStorageMode,
  writeScannerGapMs,
  writeStorageMode,
} from './pos-preferences';
import type { PosStorageMode } from './storage/types';

export interface PosSettingsPageProps {
  className?: string;
}

/**
 * Per-register settings — everything here applies to this computer only.
 *
 * The language picker is the reason this page exists: the person setting up a
 * till picks the language their cashiers read, and it sticks on that machine
 * without touching the storefront or any other register. Before v10.0.0 the
 * library had no locale persistence at all, so this was not expressible.
 */
export function PosSettingsPage({ className }: PosSettingsPageProps) {
  const t = useT();
  const { toast } = useToast();
  const { locale, setLocale, pinned } = useLocaleControls();

  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [gapMs, setGapMs] = useState(40);
  const [storageMode, setStorageMode] = useState<PosStorageMode>('cloud');

  // Every value here comes from localStorage, which does not exist during
  // server render — read after mount so SSR and hydration agree.
  useEffect(() => {
    setDeviceId(getPosDeviceId());
    setLabel(getPosDeviceLabel());
    setGapMs(readScannerGapMs());
    setStorageMode(readStorageMode());
  }, []);

  const save = () => {
    setPosDeviceLabel(label);
    writeScannerGapMs(gapMs);
    writeStorageMode(storageMode);
    toast({ title: t('pos.settings.saved') });
  };

  return (
    <div className={className} style={{ padding: 24, maxWidth: 620, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('pos.settings.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('pos.settings.subtitle')}</p>
      </header>

      <section style={section}>
        <label style={field}>
          <span style={fieldLabel}>{t('pos.settings.language')}</span>
          <Select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={BUILTIN_LOCALE_CODES.map((code) => ({
              value: code,
              label: BUILTIN_LOCALE_NAMES[code] ?? code,
            }))}
          />
          <FieldDescription>{t('pos.settings.languageHelp')}</FieldDescription>
          {pinned ? (
            // Honest rather than mysteriously inert: a consumer app that drives
            // locale from the URL pins it, and the picker cannot win against
            // that. Saying so beats a control that appears to do nothing.
            <FieldDescription>
              This site sets the language from its own routing, so this choice is stored but
              will not change what you see here.
            </FieldDescription>
          ) : null}
        </label>
      </section>

      <section style={section}>
        <label style={field}>
          <span style={fieldLabel}>{t('pos.settings.deviceLabel')}</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front counter" />
          <FieldDescription>{t('pos.settings.deviceLabelHelp')}</FieldDescription>
        </label>

        <label style={field}>
          <span style={fieldLabel}>{t('pos.settings.deviceId')}</span>
          <Input value={deviceId} readOnly style={{ fontFamily: 'ui-monospace, monospace' }} />
        </label>
      </section>

      <section style={section}>
        <span style={fieldLabel}>{t('pos.storage.title')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {(['cloud', 'local'] as const).map((mode) => (
            <label key={mode} style={radioRow}>
              <input
                type="radio"
                name="pos-storage-mode"
                value={mode}
                checked={storageMode === mode}
                onChange={() => setStorageMode(mode)}
                // Standalone local mode is implemented in v10.2.0. Showing the
                // choice now (disabled) tells an evaluating merchant it is
                // coming; silently omitting it would read as "not supported".
                disabled={mode === 'local'}
              />
              <span>
                <strong>{t(`pos.storage.${mode}`)}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>{t(`pos.storage.${mode}Help`)}</div>
                {mode === 'local' ? (
                  <div style={{ fontSize: 12, color: '#b45309' }}>Available in a coming release.</div>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section style={section}>
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
