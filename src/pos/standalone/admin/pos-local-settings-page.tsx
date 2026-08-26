'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocaleControls, useT } from '../../../i18n/locale-context';
import { BUILTIN_LOCALE_CODES, BUILTIN_LOCALE_NAMES } from '../../../i18n/locales';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { cn } from '../../../utils/cn';
import { useCaspianNavigation } from '../../../provider/caspian-store-provider';
import {
  GlobeIcon,
  InboxIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  ScanIcon,
  SlidersIcon,
  StoreIcon,
  SunIcon,
  UserIcon,
} from '../../../ui/icons';
import { getPosDeviceId, getPosDeviceLabel, setPosDeviceLabel } from '../../pos-device';
import {
  readIdleLockMinutes,
  writeIdleLockMinutes,
  IDLE_LOCK_CHOICES,
  readScannerGapMs,
  writeScannerGapMs,
  type PosThemeMode,
} from '../../pos-preferences';
import { PosScannerTest } from '../../hardware/pos-scanner-test';
import { PosStorageHealthCard } from '../../pos-storage-health-card';
import { usePosChrome } from '../../theme/pos-chrome-context';
import { CASPIAN_POS_VERSION } from '../pos-version';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosTerminal } from '../terminal-context';
import { PosField, PosSelect } from '../ui/pos-field';
import { LocalShopPanel } from './local-shop-panel';
import { LocalBackupPanel } from './local-backup-panel';
import { LocalPasswordDialog } from './local-password-dialog';

type Section =
  | 'appearance'
  | 'language'
  | 'device'
  | 'scanner'
  | 'account'
  | 'shop'
  | 'backup'
  | 'storage';

/**
 * Addresses that used to be a scroll target.
 *
 * Until v1.4.0 this page rendered all eight sections at once and its sidebar
 * only scrolled between them, so anything that pointed at one pointed at a
 * fragment. Those still land somewhere true.
 */
const SECTION_ALIASES: Record<string, Section> = {
  printer: 'scanner',
  theme: 'appearance',
  till: 'device',
};

interface SectionConfig {
  value: Section;
  labelKey: string;
  icon: (size: number) => ReactNode;
}

const THEME_CHOICES: { value: PosThemeMode; labelKey: string; icon: ReactNode }[] = [
  { value: 'light', labelKey: 'pos.theme.light', icon: <SunIcon size={17} /> },
  { value: 'dark', labelKey: 'pos.theme.dark', icon: <MoonIcon size={17} /> },
  { value: 'system', labelKey: 'pos.theme.system', icon: <MonitorIcon size={17} /> },
];

/**
 * Settings, on a till that runs on its own.
 *
 * Split from `pos-settings-page.tsx` in v1.4.0, which is the cloud register's
 * now. That file had grown five `local.standalone && …` branches -- the account
 * pane, the shop record, the backup panel, the idle lock, and which version
 * number to print -- and pos/CLAUDE.md is explicit that a standalone feature
 * reaching into a shared screen is the signal it wants a file of its own.
 *
 * The shape is App admin's, deliberately: one section at a time, chosen by a
 * `?section=` query so a reload and a bookmark both land where the reader was.
 * The old page put eight sections on one scroll and used the sidebar to jump
 * between them, which meant the Backup warning and the receipt wording shared a
 * screen with the scanner timing.
 *
 * There is no page-level Save. With one section visible it would sit under a
 * section whose fields it does not write; the two sections that have editable
 * fields carry their own.
 */
export function PosLocalSettingsPage({ className }: { className?: string }) {
  const t = useT();
  const { toast } = useToast();
  const { searchParams, replace } = useCaspianNavigation();
  const { locale, setLocale, pinned } = useLocaleControls();
  const { themeMode, setThemeMode } = usePosChrome();
  const local = usePosLocalSession();
  const { can } = usePosRoles();
  const { terminal } = usePosTerminal();

  const showShop = can(local.user?.role, 'settings.shop');
  const showBackup = can(local.user?.role, 'settings.backup');
  // Changing your own password. Not in the avatar menu beside Sign out, where it
  // would read most naturally: that menu is the top bar, which is chrome rather
  // than a screen. Settings is one click further and every built-in role can
  // open it, because `settings.view` is granted to all of them.
  const showAccount = !!local.user;

  const sections = useMemo<SectionConfig[]>(() => {
    const list: SectionConfig[] = [
      { value: 'appearance', labelKey: 'pos.theme.title', icon: (s) => <PaletteIcon size={s} /> },
      {
        value: 'language',
        labelKey: 'pos.settings.section.language',
        icon: (s) => <GlobeIcon size={s} />,
      },
      {
        value: 'device',
        labelKey: 'pos.settings.section.device',
        icon: (s) => <MonitorIcon size={s} />,
      },
      {
        value: 'scanner',
        labelKey: 'pos.settings.section.scanner',
        icon: (s) => <ScanIcon size={s} />,
      },
    ];
    if (showAccount) {
      list.push({
        value: 'account',
        labelKey: 'pos.settings.section.account',
        icon: (s) => <UserIcon size={s} />,
      });
    }
    if (showShop) {
      list.push({
        value: 'shop',
        labelKey: 'pos.admin.section.shop',
        icon: (s) => <StoreIcon size={s} />,
      });
    }
    if (showBackup) {
      list.push({
        value: 'backup',
        labelKey: 'pos.admin.section.backup',
        icon: (s) => <InboxIcon size={s} />,
      });
    }
    list.push({
      value: 'storage',
      labelKey: 'pos.settings.section.storage',
      icon: (s) => <SlidersIcon size={s} />,
    });
    return list;
  }, [showAccount, showShop, showBackup]);

  const param = searchParams?.get('section') ?? '';
  const asked = (SECTION_ALIASES[param] ?? param) as Section;
  const current: Section = sections.some((s) => s.value === asked) ? asked : 'appearance';

  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [gapMs, setGapMs] = useState(40);
  const [idleLock, setIdleLock] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    setDeviceId(getPosDeviceId());
    setLabel(getPosDeviceLabel());
    setGapMs(readScannerGapMs());
    setIdleLock(readIdleLockMinutes());
  }, []);

  const saveDevice = () => {
    setPosDeviceLabel(label);
    writeIdleLockMinutes(idleLock);
    toast({ title: t('pos.settings.saved') });
  };

  const saveScanner = () => {
    writeScannerGapMs(gapMs);
    toast({ title: t('pos.settings.saved') });
  };

  const languageOptions = useMemo(
    () =>
      BUILTIN_LOCALE_CODES.map((code) => ({
        value: code,
        label: BUILTIN_LOCALE_NAMES[code] ?? code,
      })),
    [],
  );

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
              key={s.value}
              type="button"
              className={cn('cpos-jump__item', current === s.value && 'cpos-jump__item--on')}
              aria-current={current === s.value ? 'page' : undefined}
              onClick={() => replace(`/pos/settings?section=${s.value}`)}
            >
              <span className="cpos-jump__icon">{s.icon(17)}</span>
              <span>{t(s.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="cpos-settings__body cpos-fadein" key={current}>
          {current === 'appearance' ? (
            <section className="cpos-section">
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
          ) : null}

          {current === 'language' ? (
            <section className="cpos-section">
              <h2 className="cpos-section__title">{t('pos.settings.section.language')}</h2>
              <PosField
                label={t('pos.settings.language')}
                help={t('pos.settings.languageHelp')}
                style={{ maxWidth: 320 }}
              >
                <PosSelect
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  options={languageOptions}
                />
              </PosField>
              {pinned ? <FieldDescription>{t('pos.settings.languagePinned')}</FieldDescription> : null}
            </section>
          ) : null}

          {current === 'device' ? (
            <section className="cpos-section">
              <h2 className="cpos-section__title">{t('pos.settings.section.device')}</h2>

              {/*
                Which counter this machine answers to, read-only and only once
                the shop has named one. A cashier cannot change it here on
                purpose: re-pointing a till at a different counter mid-day would
                put the rest of a shift's sales under the wrong name, and the way
                to move one is to release it on the Terminals page and pair
                again.
              */}
              {terminal ? (
                <PosField label={t('pos.settings.terminal')} help={t('pos.settings.terminalHelp')}>
                  <input className="cpos-input" value={terminal.name} readOnly />
                </PosField>
              ) : null}

              <PosField
                label={t('pos.settings.deviceLabel')}
                help={t('pos.settings.deviceLabelHelp')}
              >
                <input
                  className="cpos-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t('pos.settings.deviceLabelPlaceholder')}
                />
              </PosField>

              <PosField label={t('pos.settings.deviceId')}>
                <input
                  className="cpos-input"
                  value={deviceId}
                  readOnly
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
              </PosField>

              {/*
                A device preference, beside the scanner gap, because it is a fact
                about where the machine stands rather than about the shop. Off
                everywhere until somebody switches it on.
              */}
              <PosField label={t('pos.settings.idleLock')} help={t('pos.settings.idleLockHelp')}>
                <PosSelect
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
              </PosField>

              <div className="cpos-actions">
                <button type="button" className="cpos-btn cpos-btn--primary" onClick={saveDevice}>
                  {t('pos.settings.save')}
                </button>
              </div>
            </section>
          ) : null}

          {current === 'scanner' ? (
            <section className="cpos-section">
              <h2 className="cpos-section__title">{t('pos.settings.section.scanner')}</h2>
              <PosField
                label={t('pos.settings.scannerGap')}
                help={t('pos.settings.scannerGapHelp')}
                style={{ maxWidth: 220 }}
              >
                <input
                  className="cpos-input"
                  type="number"
                  min={10}
                  max={300}
                  value={gapMs}
                  onChange={(e) => setGapMs(Number.parseInt(e.target.value, 10) || 40)}
                />
              </PosField>

              {/*
                One transport, and it is disabled. Deliberate, and said out loud
                rather than hidden: the till prints through the browser, and the
                other transports are not built. A picker with one option that
                cannot be changed is the honest shape of that.
              */}
              <PosField
                label={t('pos.settings.printer')}
                help={t('pos.settings.printerBrowserHelp')}
                style={{ maxWidth: 320 }}
              >
                <PosSelect
                  value="browser"
                  disabled
                  onChange={() => undefined}
                  options={[{ value: 'browser', label: t('pos.settings.printerBrowser') }]}
                />
              </PosField>

              <div className="cpos-actions">
                <button type="button" className="cpos-btn cpos-btn--primary" onClick={saveScanner}>
                  {t('pos.settings.save')}
                </button>
              </div>

              <PosScannerTest onGapChange={setGapMs} />
            </section>
          ) : null}

          {current === 'account' ? (
            <section className="cpos-section">
              <h2 className="cpos-section__title">{t('pos.settings.section.account')}</h2>
              <PosField label={t('pos.settings.signedInAs')}>
                <input
                  className="cpos-input"
                  value={local.user?.displayName || local.user?.username || ''}
                  readOnly
                />
              </PosField>
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

          {current === 'shop' ? <LocalShopPanel /> : null}
          {current === 'backup' ? <LocalBackupPanel /> : null}

          {current === 'storage' ? (
            <section className="cpos-section">
              <h2 className="cpos-section__title">{t('pos.storage.title')}</h2>
              {/*
                No picker at all, where the cloud register shows two read-only
                radios. On a till that runs on its own there is nothing to
                choose between -- the mode is a property of the deployment, and
                offering the alternative would imply a switch that does not
                exist.
              */}
              <div className="cpos-note cpos-note--warning">{t('pos.storage.localWarning')}</div>
              <FieldDescription>{t('pos.storage.localHelp')}</FieldDescription>
              <PosStorageHealthCard />
            </section>
          ) : null}

          {/*
            At the foot of the body rather than the header, because it answers a
            question nobody has while they are working -- "which version is that
            till on?" -- and putting it beside the page title would give it the
            weight of a setting.
          */}
          <p className="cpos-version">
            {t('pos.settings.appVersion', { version: CASPIAN_POS_VERSION })}
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
