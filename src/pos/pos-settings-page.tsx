'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocaleControls, useT } from '../i18n/locale-context';
import { BUILTIN_LOCALE_CODES, BUILTIN_LOCALE_NAMES } from '../i18n/locales';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { FieldDescription } from '../ui/field-description';
import { cn } from '../utils/cn';
import {
  GlobeIcon,
  InboxIcon,
  MonitorIcon,
  LockIcon,
  MoonIcon,
  PaletteIcon,
  ScanIcon,
  SlidersIcon,
  StoreIcon,
  SunIcon,
  UserIcon,
} from '../ui/icons';
import { getPosDeviceId, getPosDeviceLabel, setPosDeviceLabel } from './pos-device';
import {
  readIdleLockMinutes,
  writeIdleLockMinutes,
  IDLE_LOCK_CHOICES,
  readScannerGapMs,
  resolvePosStorageMode,
  writeScannerGapMs,
  type PosThemeMode,
} from './pos-preferences';
import type { PosStorageMode } from './storage/types';
import { PosStorageHealthCard } from './pos-storage-health-card';
import { useCaspianFirebaseOptional } from '../provider/caspian-store-provider';
import { usePosChrome } from './theme/pos-chrome-context';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseSection } from './license/pos-license-section';
import { usePosLocalSession } from './standalone/local-session-context';
import { usePosTerminal } from './standalone/terminal-context';
import { usePosRoles } from './standalone/role-context';
import { LocalShopPanel } from './standalone/admin/local-shop-panel';
import { LocalBackupPanel } from './standalone/admin/local-backup-panel';
import { LocalPasswordDialog } from './standalone/admin/local-password-dialog';
import { CASPIAN_POS_VERSION } from './standalone/pos-version';
import { CASPIAN_STORE_VERSION } from '../version';

export interface PosSettingsPageProps {
  className?: string;
}

/**
 * Languages exposed by the POS settings picker.
 *
 * Every locale that ships with a dictionary, not the two that were hand-listed
 * here. The sign-in screen now offers the same list, and a till that can be set
 * to Russian before anybody signs in must be able to be set back to it
 * afterwards -- a picker that drops two of the four is how a shop ends up stuck
 * in a language it did not choose.
 */
const POS_LOCALES = BUILTIN_LOCALE_CODES;

interface SectionConfig {
  id: string;
  labelKey: string;
  icon:
    | 'appearance'
    | 'language'
    | 'device'
    | 'account'
    | 'shop'
    | 'backup'
    | 'license'
    | 'storage'
    | 'scanner';
}

const SECTION_ICON: Record<SectionConfig['icon'], (size: number) => React.ReactNode> = {
  appearance: (size) => <PaletteIcon size={size} />,
  language: (size) => <GlobeIcon size={size} />,
  device: (size) => <MonitorIcon size={size} />,
  account: (size) => <UserIcon size={size} />,
  shop: (size) => <StoreIcon size={size} />,
  backup: (size) => <InboxIcon size={size} />,
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
  const { themeMode, setThemeMode } = usePosChrome();
  const local = usePosLocalSession();
  const { terminal } = usePosTerminal();
  const { can } = usePosRoles();

  // The shop's own details and its backup used to be two tabs of a back office
  // that no longer exists. They are standalone-only -- they read the till's own
  // disk -- while this page also serves a cloud register, hence both gates.
  const showShop = local.standalone && can(local.user?.role, 'settings.shop');
  const showBackup = local.standalone && can(local.user?.role, 'settings.backup');

  // Changing your own password. Not in the avatar menu beside Sign out, where
  // it would read most naturally: that menu is `pos-topbar.tsx`, a shared file
  // a cloud register renders too, and pos/CLAUDE.md is explicit that reaching
  // into one of those is the signal a change has stopped being standalone.
  // Settings is one click further and every built-in role can open it, because
  // `settings.view` is granted to all of them.
  const showAccount = local.standalone && !!local.user;

  // A standalone till activates its licence from /pos/app-admin. A cloud till
  // has no app admin to route to, so the key keeps the home it has always had
  // here -- otherwise moving the pane would leave a cloud shop that bought a
  // licence with nowhere at all to enter it.
  const license = usePosLicense(firebase?.functions ?? null);
  const showLicense = !local.standalone && license.configured;

  const sections = useMemo<SectionConfig[]>(() => {
    const list: SectionConfig[] = [
      { id: 'appearance', labelKey: 'pos.theme.title', icon: 'appearance' },
      { id: 'language', labelKey: 'pos.settings.section.language', icon: 'language' },
      { id: 'device', labelKey: 'pos.settings.section.device', icon: 'device' },
    ];
    if (showAccount) {
      list.push({ id: 'account', labelKey: 'pos.settings.section.account', icon: 'account' });
    }
    if (showShop) list.push({ id: 'shop', labelKey: 'pos.admin.section.shop', icon: 'shop' });
    if (showLicense) {
      list.push({ id: 'license', labelKey: 'pos.appAdmin.section.licence', icon: 'license' });
    }
    if (showBackup) {
      list.push({ id: 'backup', labelKey: 'pos.admin.section.backup', icon: 'backup' });
    }
    list.push({ id: 'storage', labelKey: 'pos.settings.section.storage', icon: 'storage' });
    list.push({ id: 'scanner', labelKey: 'pos.settings.section.scanner', icon: 'scanner' });
    return list;
  }, [showAccount, showShop, showBackup, showLicense]);

  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [gapMs, setGapMs] = useState(40);
  const [idleLock, setIdleLock] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Derived, not chosen -- see `resolvePosStorageMode`.
  const storageMode: PosStorageMode = resolvePosStorageMode(Boolean(firebase));

  useEffect(() => {
    setDeviceId(getPosDeviceId());
    setLabel(getPosDeviceLabel());
    setGapMs(readScannerGapMs());
    setIdleLock(readIdleLockMinutes());
  }, []);

  const save = () => {
    setPosDeviceLabel(label);
    writeScannerGapMs(gapMs);
    writeIdleLockMinutes(idleLock);
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
          {sections.map((s) => (
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
            {/*
              Which counter this machine answers to, read-only and only once the
              shop has named one. A cashier cannot change it here on purpose:
              re-pointing a till at a different counter mid-day would put the
              rest of a shift's sales under the wrong name, and the way to move
              one is to release it on the Terminals page and pair again.
            */}
            {local.standalone && terminal ? (
              <label className="cpos-field">
                <span className="cpos-field__label">{t('pos.settings.terminal')}</span>
                <input className="cpos-input" value={terminal.name} readOnly />
                <FieldDescription>{t('pos.settings.terminalHelp')}</FieldDescription>
              </label>
            ) : null}

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

            {/*
              A device preference, beside the scanner gap, because it is a fact
              about where the machine stands rather than about the shop. Off
              everywhere until somebody switches it on, and only on a till that
              runs on its own -- a cloud register signs out through Firebase Auth
              and has no local password to unlock with.
            */}
            {local.standalone ? (
              <label className="cpos-field">
                <span className="cpos-field__label">{t('pos.settings.idleLock')}</span>
                <Select
                  value={String(idleLock)}
                  onChange={(e) => setIdleLock(Number(e.target.value))}
                  options={IDLE_LOCK_CHOICES.map((m) => ({
                    value: String(m),
                    label:
                      m === 0
                        ? t('pos.settings.idleLockNever')
                        : t('pos.settings.idleLockMinutes', { count: m }),
                  }))}
                />
                <FieldDescription>{t('pos.settings.idleLockHelp')}</FieldDescription>
              </label>
            ) : null}
          </section>

          {showAccount ? (
            <section id="pos-settings-account" className="cpos-section">
              <h2 className="cpos-section__title">{t('pos.settings.section.account')}</h2>
              <label className="cpos-field">
                <span className="cpos-field__label">{t('pos.settings.signedInAs')}</span>
                <input
                  className="cpos-input"
                  value={local.user?.displayName || local.user?.username || ''}
                  readOnly
                />
              </label>
              <div className="cpos-actions">
                <button
                  type="button"
                  className="cpos-btn cpos-btn--outline"
                  onClick={() => setPasswordOpen(true)}
                >
                  {t('pos.settings.changePassword')}
                </button>
              </div>
              <FieldDescription>{t('pos.settings.changePasswordHelp')}</FieldDescription>
            </section>
          ) : null}

          {showShop ? (
            <div id="pos-settings-shop">
              <LocalShopPanel />
            </div>
          ) : null}

          {showBackup ? (
            <div id="pos-settings-backup">
              <LocalBackupPanel />
            </div>
          ) : null}

          {showLicense ? (
            <div id="pos-settings-license">
              <PosLicenseSection license={license} />
            </div>
          ) : null}

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
            <PosStorageHealthCard />
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

          {/*
            Two products, two numbers. A standalone till never installs this
            library, so quoting the storefront's release to a shop running one
            tells it nothing it can act on; a cloud register has no version of
            its own and the library is what it is running. Below the Save row
            because it is not a setting -- it is the answer to "which version is
            that till on?", asked by somebody on the phone.
          */}
          <p className="cpos-version">
            {t('pos.settings.appVersion', {
              version: local.standalone ? CASPIAN_POS_VERSION : CASPIAN_STORE_VERSION,
            })}
          </p>
        </div>
      </div>

      <LocalPasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        user={local.user}
        self
      />
    </div>
  );
}
