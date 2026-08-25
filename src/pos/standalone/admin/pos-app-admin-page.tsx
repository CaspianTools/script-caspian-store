'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { CashDrawerIcon, LockIcon, ShieldIcon, SlidersIcon } from '../../../ui/icons';
import { Button } from '../../../ui/button';
import { FieldDescription } from '../../../ui/field-description';
import { Input } from '../../../ui/input';
import { useToast } from '../../../ui/toast';
import { cn } from '../../../utils/cn';
import { useCaspianNavigation, useCaspianFirebaseOptional } from '../../../provider/caspian-store-provider';
import { getLocalUser, readLocalShopSettings, writeLocalShopSettings } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosOpeningCash } from '../opening-cash-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import { hasRecoveryCode, mintAndStoreRecoveryCode } from '../local-recovery';
import { RecoveryCodeBlock } from '../pos-local-recovery';
import { usePosLicense } from '../../license/use-pos-license';
import { PosLicenseSection } from '../../license/pos-license-section';
import {
  BUILTIN_ROLES,
  CAPABILITY_GROUPS,
  type PosLocalCapability,
  type PosLocalRole,
  type RoleDefinition,
} from '../types';
import { actions, field, fieldLabel, muted, section } from './panel-styles';

/**
 * Roles that cannot be switched off.
 *
 * `superadmin` is the only role carrying `appAdmin.view`, and that capability is
 * the only key to this page. Unticking it would take the register, the store,
 * the shop screens and this one away from the account that did it, and a
 * standalone till has no server-side override to hand it back — a factory reset
 * would be the only way out.
 */
const LOCKED_IDS: readonly PosLocalRole[] = ['superadmin'];

/** Roles kept only so accounts already holding them keep working. */
const DUPLICATE_IDS: readonly PosLocalRole[] = ['cashier'];

type Section = 'roles' | 'openingCash' | 'features' | 'recovery' | 'licence';

/**
 * Opening cash sits above the licence because the licence pane is furniture:
 * `PosLicenseSection` renders a parked message on every stock build, so putting
 * a setting an owner actually changes underneath it would bury it.
 */
const NAV: { value: Section; labelKey: string; icon: (size: number) => React.ReactNode }[] = [
  { value: 'roles', labelKey: 'pos.appAdmin.section.roles', icon: (s) => <ShieldIcon size={s} /> },
  {
    value: 'openingCash',
    labelKey: 'pos.appAdmin.section.openingCash',
    icon: (s) => <CashDrawerIcon size={s} />,
  },
  {
    value: 'features',
    labelKey: 'pos.appAdmin.section.features',
    icon: (s) => <SlidersIcon size={s} />,
  },
  {
    value: 'recovery',
    labelKey: 'pos.appAdmin.section.recovery',
    icon: (s) => <LockIcon size={s} />,
  },
  { value: 'licence', labelKey: 'pos.appAdmin.section.licence', icon: (s) => <LockIcon size={s} /> },
];

export function PosAppAdminPage() {
  const t = useT();
  const { searchParams, replace } = useCaspianNavigation();

  const param = searchParams?.get('section') as Section | null;
  const current: Section = NAV.some((n) => n.value === param) ? param! : 'roles';

  return (
    <div className="cpos-page">
      <header className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <ShieldIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.appAdmin.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.appAdmin.subtitle')}</p>
        </span>
      </header>

      <div className="cpos-settings__grid">
        <nav className="cpos-jump" aria-label={t('pos.appAdmin.title')}>
          {NAV.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn('cpos-jump__item', current === item.value && 'cpos-jump__item--on')}
              aria-current={current === item.value ? 'page' : undefined}
              onClick={() => replace(`/pos/app-admin?section=${item.value}`)}
            >
              <span className="cpos-jump__icon">{item.icon(17)}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="cpos-settings__body cpos-fadein" key={current}>
          {current === 'roles' ? (
            <RolesSection />
          ) : current === 'openingCash' ? (
            <OpeningCashSection />
          ) : current === 'features' ? (
            <FeaturesSection />
          ) : current === 'recovery' ? (
            <RecoverySection />
          ) : (
            <LicenceSection />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The licence key this till is running under.
 *
 * `PosLicenseSection` renders nothing at all when the build carries no vendor
 * public key, which is every stock build. An empty pane would read as a screen
 * that failed to load, so the parked state says so in words instead.
 */
function LicenceSection() {
  const t = useT();
  const functions = useCaspianFirebaseOptional()?.functions ?? null;
  const license = usePosLicense(functions);

  if (!license.configured) {
    return (
      <section style={section}>
        <span style={fieldLabel}>{t('pos.appAdmin.section.licence')}</span>
        <div style={muted}>{t('pos.appAdmin.licence.parked')}</div>
      </section>
    );
  }

  return <PosLicenseSection license={license} />;
}

/**
 * Whether a cashier declares the drawer before the sale screen opens.
 *
 * Shop-wide and off by default, so nothing changes for a till that upgrades
 * into this release.
 */
function OpeningCashSection() {
  const t = useT();
  const { toast } = useToast();
  const { can } = usePosRoles();
  const session = usePosLocalSession();
  const { push } = useCaspianNavigation();
  const openingCash = usePosOpeningCash();

  /** `null` until the stored setting has been read, so the pane never guesses. */
  const [required, setRequired] = useState<boolean | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void readLocalShopSettings().then((shop) => {
      if (alive) setRequired(shop.requireOpeningCash);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Saved on the click, with no Save button -- no pane on this page has one --
   * but unlike `RolesSection` the write is awaited and a failure is shown. A
   * till with site data blocked really does reject this write, and a silent
   * revert would read as a switch that refuses to move.
   */
  const choose = async (next: boolean) => {
    if (required === null || next === required) return;
    const previous = required;
    setRequired(next);
    setSaveFailed(false);
    try {
      await writeLocalShopSettings({ requireOpeningCash: next });
      // The provider sits above PosRoot and stays mounted while this page is
      // open, so nothing it holds would notice this write on its own: there is
      // no storage event for IndexedDB, and none fires in the writing tab even
      // for localStorage. Without this the switch would appear to save and then
      // do nothing until the next page load -- which reads as a broken switch,
      // and on the way back off it reads as a till that will not let go.
      await openingCash.refresh();
      // Directional, not a generic "Saved": the effect lands on whoever opens
      // the till tomorrow morning, so the person flipping it is told which way
      // it went.
      toast({
        title: t(
          next ? 'pos.appAdmin.openingCash.turnedOn' : 'pos.appAdmin.openingCash.turnedOff',
        ),
      });
    } catch {
      setRequired(previous);
      setSaveFailed(true);
    }
  };

  if (required === null) return <div className="cpos-muted">{t('common.loading')}</div>;

  return (
    <section className="cpos-section">
      <h2 className="cpos-section__title">{t('pos.appAdmin.openingCash.title')}</h2>

      <div className="cpos-field">
        {/*
          A two-button group rather than `<Switch>`. The switch is 38x22 -- half
          the register's `--cpos-touch` 44px floor -- and it hardcodes
          `rgba(0,0,0,0.22)` and `#fff`, neither of them a `--cpos-*` token, so
          in the till's dark mode it is near-black on near-black. It gets away
          with that at `/admin/pos` only because that surface is always light.
          `.cpos-choices` already carries the touch floor, already resolves
          through the tokens in both themes, and is already the register's idiom
          for this pick at `/pos/settings`. It also names both states in words
          instead of leaving the answer in a knob position.
        */}
        <div className="cpos-choices" role="group" aria-label={t('pos.appAdmin.openingCash.title')}>
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              className={cn('cpos-choice', required === value && 'cpos-choice--on')}
              aria-pressed={required === value}
              onClick={() => void choose(value)}
            >
              <span>
                {t(value ? 'pos.appAdmin.openingCash.on' : 'pos.appAdmin.openingCash.off')}
              </span>
            </button>
          ))}
        </div>
        <FieldDescription>{t('pos.appAdmin.openingCash.help')}</FieldDescription>
      </div>

      {saveFailed ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {t('pos.appAdmin.openingCash.saveFailed')}
        </div>
      ) : null}

      {required ? (
        <div className="cpos-note cpos-note--brand">{t('pos.appAdmin.openingCash.rule')}</div>
      ) : null}

      {can(session.user?.role, 'sales.view') ? (
        <div className="cpos-actions">
          <Button variant="outline" onClick={() => push('/pos/sales#pos-sales-opening-cash')}>
            {t('pos.appAdmin.openingCash.viewRecord')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The screens a shop gets only if whoever installed the till switched them on.
 *
 * Three switches, all off by default, all shop-wide. They are here rather than
 * on `/pos/settings` because they are not a shopkeeper's preference: a corner
 * shop with forty lines does not want a Categories screen, and handing it one
 * to discover on its own is how a simple till stops being simple. The person
 * commissioning the machine decides, alongside the drawer count.
 *
 * Turning one off hides its screen and its fields; it never deletes what the
 * shop entered, and for lots it never changes what happens to stock. A product
 * already marked as tracked goes on drawing earliest-expiry-first with the
 * switch off, because a switch that quietly stopped drawing lots would leave
 * the shelf and the record disagreeing.
 */
function FeaturesSection() {
  const t = useT();
  const { toast } = useToast();
  const { settings, loading, save } = usePosShopSettings();
  const [saveFailed, setSaveFailed] = useState(false);

  const SWITCHES = [
    { key: 'categoriesEnabled', labelKey: 'pos.appAdmin.features.categories' },
    { key: 'suppliersEnabled', labelKey: 'pos.appAdmin.features.suppliers' },
    { key: 'lotTrackingEnabled', labelKey: 'pos.appAdmin.features.lots' },
  ] as const;

  // Awaited and rolled back on failure, like the drawer switch above: a till
  // with site data blocked really does reject this write, and a silent revert
  // reads as a switch that refuses to move.
  const choose = async (key: (typeof SWITCHES)[number]['key'], next: boolean) => {
    if (settings[key] === next) return;
    setSaveFailed(false);
    try {
      await save({ [key]: next });
      toast({
        title: t(next ? 'pos.appAdmin.features.turnedOn' : 'pos.appAdmin.features.turnedOff', {
          name: t(SWITCHES.find((s) => s.key === key)!.labelKey),
        }),
      });
    } catch {
      setSaveFailed(true);
    }
  };

  if (loading) return <div className="cpos-muted">{t('common.loading')}</div>;

  return (
    <section className="cpos-section">
      <h2 className="cpos-section__title">{t('pos.appAdmin.features.title')}</h2>
      <div className="cpos-muted">{t('pos.appAdmin.features.intro')}</div>

      {SWITCHES.map((item) => (
        <div className="cpos-field" key={item.key}>
          <span className="cpos-field__label">{t(item.labelKey)}</span>
          <div className="cpos-choices" role="group" aria-label={t(item.labelKey)}>
            {([false, true] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                className={cn('cpos-choice', settings[item.key] === value && 'cpos-choice--on')}
                aria-pressed={settings[item.key] === value}
                onClick={() => void choose(item.key, value)}
              >
                <span>
                  {t(value ? 'pos.appAdmin.features.on' : 'pos.appAdmin.features.off')}
                </span>
              </button>
            ))}
          </div>
          <FieldDescription>{t(`${item.labelKey}Help`)}</FieldDescription>
        </div>
      ))}

      {saveFailed ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {t('pos.appAdmin.openingCash.saveFailed')}
        </div>
      ) : null}

      {settings.lotTrackingEnabled ? (
        <div className="cpos-note cpos-note--brand">{t('pos.appAdmin.features.lotsNote')}</div>
      ) : null}
    </section>
  );
}

/**
 * The till's way back in, for a machine that was set up without one.
 *
 * Every till commissioned before v1.1.0 has no recovery code, and so does one
 * whose settings write failed during setup. This pane is where that is put
 * right -- and it is deliberately here rather than at the counter. A cashier
 * shown a warning about a missing recovery code can do precisely nothing about
 * it, so the warning would be noise on the one screen that must not have any.
 * App admin is where the person who can act already goes.
 *
 * The code is shown once and then only its hash is kept, which is the point:
 * nobody, including whoever installed the machine, can read it back off the
 * till afterwards.
 */
function RecoverySection() {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { settings, loading, refresh } = usePosShopSettings();
  const [minted, setMinted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [belongsTo, setBelongsTo] = useState('');

  const exists = hasRecoveryCode(settings);

  // The stored field is an account id, which is meaningless to an owner reading
  // this page. Resolve it to the name they know; fall back to the raw id only
  // when the account has since been deleted, where the id is at least a clue.
  useEffect(() => {
    let alive = true;
    const id = settings.recoveryForUserId;
    if (!id) {
      setBelongsTo('');
      return;
    }
    getLocalUser(id)
      .then((user) => {
        if (alive) setBelongsTo(user?.displayName || user?.username || id);
      })
      .catch(() => {
        if (alive) setBelongsTo(id);
      });
    return () => {
      alive = false;
    };
  }, [settings.recoveryForUserId]);

  const generate = async () => {
    if (busy || !session.user) return;
    setBusy(true);
    setFailed(false);
    try {
      // Against the account doing this, not against whoever commissioned the
      // machine: that person may have left the company, and a code naming a
      // deleted account is a code that opens nothing.
      const code = await mintAndStoreRecoveryCode(session.user.id);
      setMinted(code);
      await refresh();
      toast({ title: t('pos.appAdmin.recovery.minted') });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="cpos-muted">{t('common.loading')}</div>;

  return (
    <section className="cpos-section">
      <h2 className="cpos-section__title">{t('pos.appAdmin.section.recovery')}</h2>
      <div className="cpos-muted">{t('pos.appAdmin.recovery.intro')}</div>

      {!exists && !minted ? (
        <div className="cpos-note cpos-note--warning" role="status">
          {t('pos.appAdmin.recovery.none')}
        </div>
      ) : null}

      {minted ? (
        <>
          <div className="cpos-note cpos-note--warning">{t('pos.local.recoveryWarning')}</div>
          <RecoveryCodeBlock code={minted} />
        </>
      ) : null}

      {exists && !minted ? (
        <FieldDescription>
          {t('pos.appAdmin.recovery.mintedFor', {
            name: belongsTo,
            date: new Date(settings.recoveryMintedAtMillis).toLocaleDateString(),
          })}
        </FieldDescription>
      ) : null}

      <div className="cpos-actions">
        <button
          type="button"
          className="cpos-btn cpos-btn--primary"
          onClick={() => void generate()}
          disabled={busy}
        >
          {exists ? t('pos.appAdmin.recovery.regenerate') : t('pos.appAdmin.recovery.generate')}
        </button>
      </div>
      <FieldDescription>{t('pos.appAdmin.recovery.help')}</FieldDescription>

      {failed ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {t('pos.appAdmin.openingCash.saveFailed')}
        </div>
      ) : null}
    </section>
  );
}

function RolesSection() {
  const t = useT();
  const { toast } = useToast();
  const { roles, saveRoles, loading } = usePosRoles();
  const [editing, setEditing] = useState<RoleDefinition | null>(null);

  /**
   * Every save reports its failure. They used to be bare `void x.then(...)`
   * chains, so when `writeLocalRoles` was aborting on every call the only
   * symptom was a success toast that never appeared -- and the roles were back
   * to the built-ins on the next reload with nothing having said so.
   */
  const persistRoles = (next: RoleDefinition[], title: string, after?: () => void) => {
    void saveRoles(next)
      .then(() => {
        after?.();
        toast({ title });
      })
      .catch(() => toast({ title: t('pos.appAdmin.roleSaveFailed') }));
  };

  const toggleBuiltIn = (id: PosLocalRole) => {
    if (LOCKED_IDS.includes(id)) return;
    const next = roles.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    persistRoles(next, t('pos.settings.saved'));
  };

  const startAdd = () => {
    setEditing({
      id: `custom-${Date.now()}`,
      name: '',
      enabled: true,
      capabilities: ['register', 'settings.view'],
      builtIn: false,
    });
  };

  const saveCustom = () => {
    if (!editing || !editing.name.trim()) return;
    const exists = roles.some((r) => r.id === editing.id);
    const next = exists
      ? roles.map((r) => (r.id === editing.id ? editing : r))
      : [...roles, editing];
    persistRoles(next, t('pos.appAdmin.roleSaved'), () => setEditing(null));
  };

  const removeCustom = (id: PosLocalRole) => {
    const next = roles.filter((r) => r.id !== id);
    persistRoles(next, t('pos.appAdmin.roleDeleted'));
  };

  /**
   * `t` echoes an unknown key straight back, which would paint
   * `pos.appAdmin.role.x` on the page. A built-in that outruns the message
   * table falls back to its own English name instead.
   */
  const roleLabel = (role: RoleDefinition) => {
    const key = `pos.appAdmin.role.${role.id}`;
    const translated = t(key);
    return translated === key ? role.name : translated;
  };

  const capabilityLabel = (capability: PosLocalCapability) => {
    const key = `pos.appAdmin.capability.${capability}`;
    const translated = t(key);
    return translated === key ? capability : translated;
  };

  const summarise = (role: RoleDefinition) =>
    (role.capabilities ?? []).map(capabilityLabel).join(' · ');

  const toggleCapability = (capability: PosLocalCapability, on: boolean) => {
    if (!editing) return;
    const next = on
      ? [...editing.capabilities, capability]
      : editing.capabilities.filter((c) => c !== capability);
    setEditing({ ...editing, capabilities: next });
  };

  const custom = roles.filter((r) => !r.builtIn);

  if (loading) return <div style={muted}>{t('common.loading')}</div>;

  return (
    <>
      <section style={section}>
        <span style={fieldLabel}>{t('pos.appAdmin.predefinedTitle')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/*
            Driven by BUILTIN_ROLES rather than a second list of ids kept beside
            it. Those two drifting apart is what made this page throw on every
            render from the day it shipped.
          */}
          {BUILTIN_ROLES.map((builtIn) => {
            const role = roles.find((r) => r.id === builtIn.id) ?? builtIn;
            const locked = LOCKED_IDS.includes(role.id);
            return (
              <label key={builtIn.id} style={roleRow}>
                <input
                  type="checkbox"
                  checked={role.enabled}
                  disabled={locked}
                  onChange={() => toggleBuiltIn(role.id)}
                />
                <span style={{ flex: 1 }}>
                  <strong>{roleLabel(role)}</strong>
                  <div style={{ fontSize: 12, color: 'var(--cpos-fg-muted, #666)' }}>
                    {summarise(role)}
                  </div>
                  {locked ? <div style={muted}>{t('pos.appAdmin.roleLocked')}</div> : null}
                  {DUPLICATE_IDS.includes(role.id) ? (
                    <div style={muted}>{t('pos.appAdmin.roleDuplicate')}</div>
                  ) : null}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: role.enabled
                      ? 'var(--cpos-success, #15803d)'
                      : 'var(--cpos-fg-muted, #666)',
                  }}
                >
                  {role.enabled ? t('pos.appAdmin.enabled') : t('pos.appAdmin.disabled')}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={fieldLabel}>{t('pos.appAdmin.customTitle')}</span>
          <Button size="sm" onClick={startAdd}>
            {t('pos.appAdmin.addRole')}
          </Button>
        </div>

        {editing ? (
          <div
            style={{
              border: '1px solid var(--cpos-border, rgba(0,0,0,0.1))',
              borderRadius: 'var(--cpos-r-md, 12px)',
              padding: 16,
            }}
          >
            <div style={field}>
              <label style={fieldLabel}>{t('pos.appAdmin.roleName')}</label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={fieldLabel}>{t('pos.appAdmin.capabilities')}</span>
              {/*
                Grouped the way the sidebar groups the screens these unlock, so
                the two tiers of a page -- seeing it, and changing it -- sit next
                to each other rather than twelve loose ticks in one run.
              */}
              {CAPABILITY_GROUPS.map((group) => (
                <div key={group.group} style={{ marginTop: 10 }}>
                  <div style={muted}>{t(`pos.nav.group.${group.group}`)}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                    {group.capabilities.map((capability) => (
                      <label
                        key={capability}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
                      >
                        <input
                          type="checkbox"
                          checked={editing.capabilities.includes(capability)}
                          onChange={(e) => toggleCapability(capability, e.target.checked)}
                        />
                        {capabilityLabel(capability)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...actions, marginTop: 16 }}>
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={saveCustom}>{t('pos.appAdmin.saveRole')}</Button>
            </div>
          </div>
        ) : null}

        {custom.length === 0 ? (
          <div style={muted}>{t('pos.appAdmin.noRoles')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {custom.map((role) => (
              <div key={role.id} style={roleRow}>
                <span style={{ flex: 1 }}>
                  <strong>{role.name}</strong>
                  <div style={{ fontSize: 12, color: 'var(--cpos-fg-muted, #666)' }}>
                    {summarise(role)}
                  </div>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => removeCustom(role.id)}>
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

const roleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  border: '1px solid var(--cpos-border, rgba(0,0,0,0.08))',
  borderRadius: 'var(--cpos-r-sm, 8px)',
};
