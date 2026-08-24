'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocaleControls, useT } from '../i18n/locale-context';
import { BUILTIN_LOCALE_NAMES } from '../i18n/locales';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { FieldDescription } from '../ui/field-description';
import { cn } from '../utils/cn';
import {
  GlobeIcon,
  LockIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  ScanIcon,
  SlidersIcon,
  SunIcon,
} from '../ui/icons';
import { getPosDeviceId, getPosDeviceLabel, setPosDeviceLabel } from './pos-device';
import {
  readScannerGapMs,
  resolvePosStorageMode,
  writeScannerGapMs,
  type PosThemeMode,
} from './pos-preferences';
import type { PosStorageMode } from './storage/types';
import { useCaspianFirebaseOptional } from '../provider/caspian-store-provider';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseSection } from './license/pos-license-section';
import { usePosChrome } from './theme/pos-chrome-context';

export interface PosSettingsPageProps {
  className?: string;
}

/** Languages exposed by the POS settings picker. */
const POS_LOCALES = ['en', 'az'] as const;

interface SectionConfig {
  id: string;
  labelKey: string;
  icon: 'appearance' | 'language' | 'device' | 'license' | 'storage' | 'scanner';
}

const SECTIONS: SectionConfig[] = [
  { id: 'appearance', labelKey: 'pos.theme.title', icon: 'appearance' },
  { id: 'language', labelKey: 'pos.settings.section.language', icon: 'language' },
  { id: 'device', labelKey: 'pos.settings.section.device', icon: 'device' },
  { id: 'license', labelKey: 'pos.settings.section.license', icon: 'license' },
  { id: 'storage', labelKey: 'pos.settings.section.storage', icon: 'storage' },
  { id: 'scanner', labelKey: 'pos.settings.section.scanner', icon: 'scanner' },
];

const SECTION_ICON: Record<SectionConfig['icon'], (size: number) => React.ReactNode> = {
  appearance: (size) => <PaletteIcon size={size} />,
  language: (size) => <GlobeIcon size={size} />,
  device: (size) => <MonitorIcon size={size} />,
  license: (size) => <LockIcon size={size} />,
  storage: (size) => <SlidersIcon size={size} />,
  scanner: (size) => <ScanIcon size={size} />,
};

const THEME_CHOICES: { value: PosThemeMode; labelKey: string; icon: React.ReactNode }[] = [
  { value: 'light', labelKey: 'pos.theme.light', icon: <SunIcon size={17} /> },
  { value: 'dark', labelKey: 'pos.theme.dark', icon: <MoonIcon size={17} /> },
  { value: 'system', labelKey: 'pos.theme.system', icon: <MonitorIcon size={17} /> },
];

/**
 * Per-register settings -- everything here applies to this computer only.
 *
 * The jump list on the left used to be a hand-rolled collapsible sidebar that
 * abbreviated its own labels to a single letter when parked, which made Sales
 * and Shop identical. Now that the shell owns navigation, this is just a sticky
 * index of the sections below it, and the language picker is still deliberately
 * limited to English and Azerbaijani.
 */
export function PosSettingsPage({ className }: PosSettingsPageProps) {
  const t = useT();
  const { toast } = useToast();
  const { locale, setLocale, pinned } = useLocaleControls();
  const firebase = useCaspianFirebaseOptional();
  const functions = firebase?.functions ?? null;
  const license = usePosLicense(functions);
  const { themeMode, setThemeMode } = usePosChrome();

  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [gapMs, setGapMs] = useState(40);
  // Derived, not chosen -- see `resolvePosStorageMode`.
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
    <div className={cn('cpos-page', className)}>
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <SlidersIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.settings.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.settings.subtitle')}</p>
        </span>
      </div>

      <div className="cpos-settings__grid">
        <nav className="cpos-jump" aria-label={t('pos.settings.title')}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="cpos-jump__item"
              onClick={() => scrollTo(s.id)}
            >
              <span className="cpos-jump__icon">{SECTION_ICON[s.icon](17)}</span>
              <span>{t(s.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="cpos-settings__body">
          <section id="pos-settings-appearance" className="cpos-section">
            <h2 className="cpos-section__title">{t('pos.theme.title')}</h2>
            <div className="cpos-choices">
              {THEME_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={cn('cpos-choice', themeMode === choice.value && 'cpos-choice--on')}
                  aria-pressed={themeMode === choice.value}
                  onClick={() => setThemeMode(choice.value)}
                >
                  <span className="cpos-choice__icon">{choice.icon}</span>
                  <span>{t(choice.labelKey)}</span>
                </button>
              ))}
            </div>
            <FieldDescription>{t('pos.theme.help')}</FieldDescription>
          </section>

          <section id="pos-settings-language" className="cpos-section">
            <label className="cpos-field">
              <span className="cpos-field__label">{t('pos.settings.language')}</span>
              <Select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                options={languageOptions}
              />
              <FieldDescription>{t('pos.settings.languageHelp')}</FieldDescription>
              {pinned ? <FieldDescription>{t('pos.settings.languagePinned')}</FieldDescription> : null}
            </label>
          </section>

          <section id="pos-settings-device" className="cpos-section">
            <label className="cpos-field">
              <span className="cpos-field__label">{t('pos.settings.deviceLabel')}</span>
              <input
                className="cpos-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('pos.settings.deviceLabelPlaceholder')}
              />
              <FieldDescription>{t('pos.settings.deviceLabelHelp')}</FieldDescription>
            </label>

            <label className="cpos-field">
              <span className="cpos-field__label">{t('pos.settings.deviceId')}</span>
              <input
                className="cpos-input"
                value={deviceId}
                readOnly
                style={{ fontFamily: 'ui-monospace, monospace' }}
              />
            </label>
          </section>

          <div id="pos-settings-license">
            <PosLicenseSection license={license} />
          </div>

          <section id="pos-settings-storage" className="cpos-section">
            <h2 className="cpos-section__title">{t('pos.storage.title')}</h2>
            <FieldDescription>{t('pos.storage.decidedAtSetup')}</FieldDescription>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['cloud', 'local'] as const).map((mode) => (
                <label
                  key={mode}
                  className={cn('cpos-radio', storageMode === mode && 'cpos-radio--on')}
                >
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
                    <span className="cpos-muted" style={{ display: 'block', marginTop: 2 }}>
                      {t(`pos.storage.${mode}Help`)}
                    </span>
                    {mode === 'local' && storageMode === 'local' ? (
                      <span
                        className="cpos-muted"
                        style={{ display: 'block', marginTop: 4, color: 'var(--cpos-warning)' }}
                      >
                        {t('pos.storage.localWarning')}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section id="pos-settings-scanner" className="cpos-section">
            <label className="cpos-field">
              <span className="cpos-field__label">{t('pos.settings.scannerGap')}</span>
              <input
                className="cpos-input"
                type="number"
                min={10}
                max={300}
                value={gapMs}
                onChange={(e) => setGapMs(Number.parseInt(e.target.value, 10) || 40)}
              />
              <FieldDescription>{t('pos.settings.scannerGapHelp')}</FieldDescription>
            </label>

            <label className="cpos-field">
              <span className="cpos-field__label">{t('pos.settings.printer')}</span>
              <Select
                value="browser"
                disabled
                onChange={() => undefined}
                options={[{ value: 'browser', label: t('pos.settings.printerBrowser') }]}
              />
              <FieldDescription>{t('pos.settings.printerBrowserHelp')}</FieldDescription>
            </label>
          </section>

          <div className="cpos-actions">
            <button type="button" className="cpos-btn cpos-btn--primary" onClick={save}>
              {t('pos.settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
