'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FieldDescription,
  useToast,
  cn,
  useCaspianNavigation,
  useCaspianFirebaseOptional,
  useInstallPrompt,
  useFormatDate,
} from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import {
  ChevronRightIcon,
  DownloadIcon,
  LockIcon,
  ShieldIcon,
  SlidersIcon,
  StoreIcon,
  UsersIcon,
} from '../../../icons';
import { getLocalUser } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosOpeningCash } from '../opening-cash-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import { hasRecoveryCode, mintAndStoreRecoveryCode } from '../local-recovery';
import { RecoveryCodeBlock } from '../pos-local-recovery';
import { usePosLicense } from '../../license/use-pos-license';
import { PosLicenseSection } from '../../license/pos-license-section';
import { CASPIAN_POS_VERSION } from '../pos-version';
import { LocalPeoplePanel } from './local-people-panel';
import { listLocalTerminals } from '../local-terminals';
import { LocalTerminalsPanel } from './local-terminals-panel';
import { PosSwitch, PosSwitchRow } from './pos-switch';
import {
  BUILTIN_ROLES,
  CAPABILITY_GROUPS,
  type LocalShopSettings,
  type PosLocalCapability,
  type PosLocalRole,
  type RoleDefinition,
} from '../types';
import { usePosConfirm } from '../ui/pos-confirm';

const DAY: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

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

/** The two permissions that open this page, and so can never be given up here. */
const DOOR_CAPABILITIES: readonly PosLocalCapability[] = ['appAdmin.view', 'appAdmin.roles'];

type Section =
  | 'general'
  | 'roles'
  | 'people'
  | 'terminals'
  | 'install'
  | 'recovery'
  | 'licence';

/**
 * Addresses that used to be their own pane.
 *
 * The drawer switch and the optional screens were two tabs holding four
 * settings between them; they are one General tab now. Anything that linked to
 * the old addresses — the manual does — still lands somewhere true.
 */
const SECTION_ALIASES: Record<string, Section> = {
  openingCash: 'general',
  features: 'general',
};

const NAV: { value: Section; labelKey: string; icon: (size: number) => React.ReactNode }[] = [
  {
    value: 'general',
    labelKey: 'pos.appAdmin.section.general',
    icon: (s) => <SlidersIcon size={s} />,
  },
  { value: 'roles', labelKey: 'pos.appAdmin.section.roles', icon: (s) => <ShieldIcon size={s} /> },
  { value: 'people', labelKey: 'pos.appAdmin.section.people', icon: (s) => <UsersIcon size={s} /> },
  {
    value: 'terminals',
    labelKey: 'pos.appAdmin.section.terminals',
    icon: (s) => <StoreIcon size={s} />,
  },
  {
    value: 'install',
    labelKey: 'pos.appAdmin.section.install',
    icon: (s) => <DownloadIcon size={s} />,
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
  const session = usePosLocalSession();
  const { can } = usePosRoles();

  // The staff list is behind `people.edit` rather than a role id, per the rule
  // in pos/CLAUDE.md. In practice that is the Support account and nothing else,
  // because this whole page is already behind `appAdmin.view` — but a shop that
  // built its own App admin role and left the staff out of it gets what it
  // asked for instead of a pane it cannot use.
  const maySeePeople = can(session.user?.role, 'people.edit');
  // Same rule for the counters: gated on the capability, never on a role id, so
  // a shop that built its own App admin role and left `terminals.edit` out of
  // it gets what it asked for rather than a pane it cannot use.
  const maySeeTerminals = can(session.user?.role, 'terminals.edit');
  const nav = useMemo(
    () =>
      NAV.filter(
        (item) =>
          (item.value !== 'people' || maySeePeople) &&
          (item.value !== 'terminals' || maySeeTerminals),
      ),
    [maySeePeople, maySeeTerminals],
  );

  const param = searchParams?.get('section') ?? '';
  const asked = (SECTION_ALIASES[param] ?? param) as Section;
  const current: Section = nav.some((n) => n.value === asked) ? asked : 'general';

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
          {nav.map((item) => (
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
          {current === 'general' ? (
            <GeneralSection />
          ) : current === 'roles' ? (
            <RolesSection />
          ) : current === 'people' ? (
            <PeopleSection />
          ) : current === 'terminals' ? (
            <TerminalsSection />
          ) : current === 'install' ? (
            <InstallSection />
          ) : current === 'recovery' ? (
            <RecoverySection />
          ) : (
            <LicenceSection />
          )}

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
    </div>
  );
}

/**
 * The switches that apply to the whole shop rather than to this counter.
 *
 * Opening cash and the three optional screens were two separate panes with a
 * paragraph of explanation under each control. They are one list of switches
 * now: the person who reaches this page is commissioning a machine, and a
 * column of settings they can read down beats four screens they have to visit.
 * The wording that was cut said what the till already shows the moment the
 * switch is on — the drawer prompt appears, the Categories link appears.
 */
function GeneralSection() {
  const t = useT();
  const { toast } = useToast();
  const openingCash = usePosOpeningCash();
  const { settings, loading, save } = usePosShopSettings();
  const [saveFailed, setSaveFailed] = useState(false);

  // Whether any counter has been named yet, which is what the shifts switch
  // waits for. Read here rather than through `PosTerminalProvider`: this pane
  // is reachable on a till where that provider is mounted, but the roster can
  // grow on the Terminals pane next door without the provider hearing about it
  // -- IndexedDB fires no storage event.
  const [hasTerminals, setHasTerminals] = useState(false);
  useEffect(() => {
    let alive = true;
    listLocalTerminals()
      .then((rows) => {
        if (alive) setHasTerminals(rows.length > 0);
      })
      .catch(() => {
        // Storage unreachable. Leaves the switch disabled with its reason
        // showing, which is the safe direction: shifts a shop cannot see the
        // counters for would ask a cashier to open one against nothing.
        if (alive) setHasTerminals(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const FEATURES = [
    { key: 'categoriesEnabled', labelKey: 'pos.appAdmin.features.categories' },
    { key: 'suppliersEnabled', labelKey: 'pos.appAdmin.features.suppliers' },
    { key: 'lotTrackingEnabled', labelKey: 'pos.appAdmin.features.lots' },
  ] as const;

  /**
   * Awaited and reported on failure. A till with site data blocked really does
   * reject this write, and a silent revert reads as a switch that refuses to
   * move. `usePosShopSettings` holds the merged result, so the knob follows the
   * record rather than a second copy of it — a rejected write leaves the switch
   * where it was without anything having to put it back.
   */
  const choose = async (patch: Partial<LocalShopSettings>, title: string) => {
    setSaveFailed(false);
    try {
      await save(patch);
      // The opening-cash provider sits above PosRoot and stays mounted while
      // this page is open, and IndexedDB fires no storage event, so nothing it
      // holds would notice this write on its own. Without the refresh the
      // switch appears to save and then does nothing until the next page load.
      if ('requireOpeningCash' in patch) await openingCash.refresh();
      toast({ title });
    } catch {
      setSaveFailed(true);
    }
  };

  if (loading) return <div className="cpos-muted">{t('common.loading')}</div>;

  return (
    <section className="cpos-section">
      <h2 className="cpos-section__title">{t('pos.appAdmin.section.general')}</h2>
      <div className="cpos-muted">{t('pos.appAdmin.general.intro')}</div>

      <div>
        {/*
          Cannot be switched on until the shop has named a counter: a shift
          belongs to a terminal, and one with nowhere to belong would have to
          invent a counter out of the device id -- the sort of placeholder that
          survives into a shop's records. Disabled with the reason said out
          loud, rather than hidden, so an owner who has heard the feature exists
          finds out what it is waiting for.
        */}
        <PosSwitchRow
          title={t('pos.appAdmin.shifts.title')}
          description={
            hasTerminals ? t('pos.appAdmin.shifts.help') : t('pos.appAdmin.shifts.needTerminal')
          }
          checked={settings.shiftsEnabled}
          disabled={!hasTerminals && !settings.shiftsEnabled}
          onChange={(next) =>
            void choose(
              { shiftsEnabled: next },
              t(next ? 'pos.appAdmin.shifts.turnedOn' : 'pos.appAdmin.shifts.turnedOff'),
            )
          }
        />

        {/*
          Superseded rather than removed while shifts are on: the shift's
          opening float IS the drawer declaration, so asking both would put one
          question to a cashier twice and leave two different answers on file.
          The row stays visible saying so, because a setting that vanishes when
          another is flipped reads as a setting that has been lost.
        */}
        <PosSwitchRow
          title={t('pos.appAdmin.openingCash.title')}
          description={settings.shiftsEnabled ? t('pos.appAdmin.openingCash.superseded') : undefined}
          checked={settings.requireOpeningCash}
          disabled={settings.shiftsEnabled}
          onChange={(next) =>
            void choose(
              { requireOpeningCash: next },
              t(next ? 'pos.appAdmin.openingCash.turnedOn' : 'pos.appAdmin.openingCash.turnedOff'),
            )
          }
        />

        {FEATURES.map((item) => (
          <PosSwitchRow
            key={item.key}
            title={t(item.labelKey)}
            description={t(`${item.labelKey}Help`)}
            checked={settings[item.key]}
            onChange={(next) =>
              void choose(
                { [item.key]: next },
                t(next ? 'pos.appAdmin.features.turnedOn' : 'pos.appAdmin.features.turnedOff', {
                  name: t(item.labelKey),
                }),
              )
            }
          />
        ))}
      </div>

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
 * Every role on this till, each one opening to show what it can do.
 *
 * It used to be two lists — seven built-ins with a tick for on/off, and custom
 * roles with an editor card that appeared above them — and the built-ins'
 * permissions could not be seen at all, let alone changed. One list, one shape:
 * a switch says whether anybody can be given the role, and opening the row says
 * what holding it means. Thirteen permissions per role is more than fits on a
 * screen once a shop has a few, hence the search box inside each one.
 *
 * There is no Save button, here or anywhere on this page. Each switch writes on
 * the flip and each failure says so.
 */
function RolesSection() {
  const t = useT();
  const confirm = usePosConfirm();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { roles, saveRoles, loading, can } = usePosRoles();

  const mayEdit = can(session.user?.role, 'appAdmin.roles');
  const [openId, setOpenId] = useState<PosLocalRole | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /**
   * Every save reports its failure. They used to be bare `void x.then(...)`
   * chains, so when `writeLocalRoles` was aborting on every call the only
   * symptom was a success toast that never appeared — and the roles were back
   * to the built-ins on the next reload with nothing having said so.
   *
   * A flipped switch is its own confirmation, so those pass no title; the
   * coarser actions — adding, renaming, deleting a role — still say so.
   */
  const persist = (next: RoleDefinition[], title?: string) => {
    void saveRoles(next)
      .then(() => {
        if (title) toast({ title });
      })
      .catch(() => toast({ title: t('pos.appAdmin.roleSaveFailed') }));
  };

  /**
   * Built-ins first, in `BUILTIN_ROLES` order, then whatever the shop added.
   * `mergeWithBuiltins` guarantees every built-in is present but not that it
   * kept its order — a till that has saved its roles once returns them in
   * storage order, which would shuffle the list under the reader.
   */
  const listed = useMemo(() => {
    const byId = new Map(roles.map((r) => [r.id, r]));
    const builtIns = BUILTIN_ROLES.map((b) => byId.get(b.id) ?? b);
    const custom = roles.filter((r) => !BUILTIN_ROLES.some((b) => b.id === r.id));
    return [...builtIns, ...custom];
  }, [roles]);

  /**
   * `t` echoes an unknown key straight back, which would paint
   * `pos.appAdmin.role.x` on the page. A custom role, or a built-in that
   * outruns the message table, falls back to its own name instead.
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

  const summarise = (role: RoleDefinition) => {
    const listedCapabilities = role.capabilities ?? [];
    if (listedCapabilities.length === 0) return t('pos.appAdmin.noCapabilities');
    return listedCapabilities.map(capabilityLabel).join(' · ');
  };

  /**
   * A role nobody may retire, and a permission nobody may take away.
   *
   * Both are the same trap seen from two sides. Support keeps App admin because
   * it is the role every till is commissioned into; and nobody may retire the
   * role they are signed in as, or take App admin off it, because `can()`
   * refuses a disabled role outright -- which is how a shop that wrote its own
   * App admin role would lock itself out with one flip. A standalone till has
   * no server-side override to hand any of it back.
   */
  const isRoleLocked = (role: RoleDefinition) =>
    LOCKED_IDS.includes(role.id) || role.id === session.user?.role;

  const isDoorLocked = (role: RoleDefinition, capability: PosLocalCapability) =>
    DOOR_CAPABILITIES.includes(capability) && isRoleLocked(role);

  const toggleEnabled = (role: RoleDefinition, next: boolean) => {
    if (isRoleLocked(role)) return;
    persist(roles.map((r) => (r.id === role.id ? { ...r, enabled: next } : r)));
  };

  const toggleCapability = (
    role: RoleDefinition,
    capability: PosLocalCapability,
    next: boolean,
  ) => {
    if (isDoorLocked(role, capability)) return;
    const capabilities = next
      ? [...role.capabilities, capability]
      : role.capabilities.filter((c) => c !== capability);
    persist(roles.map((r) => (r.id === role.id ? { ...r, capabilities } : r)));
  };

  const addRole = () => {
    const id = `custom-${Date.now()}`;
    setOpenId(id);
    persist(
      [
        ...roles,
        {
          id,
          name: t('pos.appAdmin.newRoleName'),
          enabled: true,
          capabilities: ['register', 'settings.view'],
          builtIn: false,
        },
      ],
      t('pos.appAdmin.roleSaved'),
    );
  };

  const removeRole = async (role: RoleDefinition) => {
    // Typed: every account holding this role loses everything it granted, and
    // a standalone till has no server-side override to put it back.
    const ok = await confirm({
      title: t('pos.appAdmin.deleteRoleTitle'),
      body: t('pos.appAdmin.confirmDeleteRole', { name: role.name }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      typeToConfirm: {
        expected: role.name,
        hint: t('pos.appAdmin.deleteRoleGate', { name: role.name }),
      },
    });
    if (!ok) return;
    if (openId === role.id) setOpenId(null);
    persist(
      roles.filter((r) => r.id !== role.id),
      t('pos.appAdmin.roleDeleted'),
    );
  };

  /** Renaming saves when the box is left, so typing does not write per keystroke. */
  const commitName = (role: RoleDefinition) => {
    const draft = drafts[role.id];
    setDrafts((current) => {
      const next = { ...current };
      delete next[role.id];
      return next;
    });
    const trimmed = (draft ?? '').trim();
    if (!trimmed || trimmed === role.name) return;
    persist(
      roles.map((r) => (r.id === role.id ? { ...r, name: trimmed } : r)),
      t('pos.appAdmin.roleSaved'),
    );
  };

  if (loading) return <div className="cpos-muted">{t('common.loading')}</div>;

  return (
    <section className="cpos-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="cpos-section__title" style={{ flex: 1 }}>
          {t('pos.appAdmin.section.roles')}
        </h2>
        {mayEdit ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--outline cpos-btn--sm"
            onClick={addRole}
          >
            {t('pos.appAdmin.addRole')}
          </button>
        ) : null}
      </div>
      <div className="cpos-muted">
        {t(mayEdit ? 'pos.appAdmin.rolesIntro' : 'pos.appAdmin.rolesReadOnly')}
      </div>

      <div>
        {listed.map((role) => {
          const open = openId === role.id;
          const locked = isRoleLocked(role);
          const custom = !BUILTIN_ROLES.some((b) => b.id === role.id);
          const term = (search[role.id] ?? '').trim().toLowerCase();
          const groups = CAPABILITY_GROUPS.map((group) => ({
            group: group.group,
            capabilities: group.capabilities.filter(
              (capability) =>
                !term ||
                capabilityLabel(capability).toLowerCase().includes(term) ||
                capability.toLowerCase().includes(term),
            ),
          })).filter((group) => group.capabilities.length > 0);

          return (
            <div key={role.id} className={cn('cpos-collapse', open && 'cpos-collapse--open')}>
              <div className="cpos-collapse__head">
                <button
                  type="button"
                  className="cpos-collapse__toggle"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : role.id)}
                >
                  <span className="cpos-collapse__caret">
                    <ChevronRightIcon size={16} />
                  </span>
                  <span className="cpos-collapse__text">
                    <span className="cpos-collapse__title">{roleLabel(role)}</span>
                    <span className="cpos-collapse__sub">{summarise(role)}</span>
                  </span>
                </button>
                <PosSwitch
                  checked={role.enabled}
                  disabled={!mayEdit || locked}
                  onChange={(next) => toggleEnabled(role, next)}
                  label={roleLabel(role)}
                />
              </div>

              {open ? (
                <div className="cpos-collapse__body">
                  {locked ? (
                    <div className="cpos-muted">
                      {t(
                        LOCKED_IDS.includes(role.id)
                          ? 'pos.appAdmin.roleLocked'
                          : 'pos.appAdmin.roleIsYours',
                      )}
                    </div>
                  ) : null}
                  {DUPLICATE_IDS.includes(role.id) ? (
                    <div className="cpos-muted">{t('pos.appAdmin.roleDuplicate')}</div>
                  ) : null}

                  {custom && mayEdit ? (
                    <label className="cpos-field">
                      <span className="cpos-field__label">{t('pos.appAdmin.roleName')}</span>
                      <input
                        className="cpos-input"
                        value={drafts[role.id] ?? role.name}
                        onChange={(e) =>
                          setDrafts((current) => ({ ...current, [role.id]: e.target.value }))
                        }
                        onBlur={() => commitName(role)}
                      />
                    </label>
                  ) : null}

                  <div className="cpos-field">
                    <span className="cpos-field__label">{t('pos.appAdmin.capabilities')}</span>
                    <input
                      className="cpos-input"
                      type="search"
                      value={search[role.id] ?? ''}
                      placeholder={t('pos.appAdmin.searchCapabilities')}
                      aria-label={t('pos.appAdmin.searchCapabilities')}
                      onChange={(e) =>
                        setSearch((current) => ({ ...current, [role.id]: e.target.value }))
                      }
                    />
                  </div>

                  {groups.length === 0 ? (
                    <div className="cpos-muted">{t('pos.appAdmin.noCapabilityMatch')}</div>
                  ) : (
                    groups.map((group) => (
                      <div key={group.group}>
                        {/*
                          Grouped the way the sidebar groups the screens these
                          unlock, so the two tiers of a page — seeing it, and
                          changing it — sit next to each other rather than
                          thirteen loose switches in one run.
                        */}
                        <div className="cpos-collapse__grouplabel">
                          {t(`pos.nav.group.${group.group}`)}
                        </div>
                        {group.capabilities.map((capability) => (
                          <PosSwitchRow
                            key={capability}
                            title={capabilityLabel(capability)}
                            checked={role.capabilities.includes(capability)}
                            disabled={!mayEdit || isDoorLocked(role, capability)}
                            onChange={(next) => toggleCapability(role, capability, next)}
                          />
                        ))}
                      </div>
                    ))
                  )}

                  {custom && mayEdit ? (
                    <div className="cpos-actions">
                      <button
                        type="button"
                        className="cpos-btn cpos-btn--danger cpos-btn--sm"
                        onClick={() => removeRole(role)}
                      >
                        {t('pos.appAdmin.deleteRole')}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The staff list, on the page the person who inherits the shop is given.
 *
 * The same panel as `/pos/people`, deliberately: two copies of a table that
 * resets passwords is two places for the last-account guard to be got wrong.
 * It is here because whoever installs a till hands it over to somebody, and
 * that person needs one screen that holds the accounts, the roles behind them
 * and the way back in — not a route they have to be told about.
 */
function PeopleSection() {
  const t = useT();
  return (
    <>
      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.appAdmin.section.people')}</h2>
        <div className="cpos-muted">{t('pos.appAdmin.people.intro')}</div>
      </section>
      <LocalPeoplePanel />
    </>
  );
}

/**
 * Installing the register as an app on this machine.
 *
 * It was a button in the top bar, beside the search box and the theme switch,
 * where it sat on every screen for the life of the till and did something a
 * shop does once. Worse, it rendered nothing at all in the two states an owner
 * most needs an answer to — already installed, and this browser cannot — so
 * "where did the Install button go?" had no screen to go and look at. Here it
 * always says which of the four it is.
 */
/**
 * The counters the shop has, and the codes that pair a machine to one.
 *
 * Here rather than on the Store screen because it is handover work: whoever
 * installs the tills names the counters and hands over the slips of paper, and
 * this is the page they are handed. A cashier never opens it.
 */
function TerminalsSection() {
  const t = useT();
  return (
    <>
      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.appAdmin.section.terminals')}</h2>
        <div className="cpos-muted">{t('pos.appAdmin.terminals.intro')}</div>
      </section>
      <LocalTerminalsPanel />
    </>
  );
}

function InstallSection() {
  const t = useT();
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();

  return (
    <section className="cpos-section">
      <h2 className="cpos-section__title">{t('pos.appAdmin.section.install')}</h2>
      <div className="cpos-muted">{t('pos.install.help')}</div>

      {isStandalone ? (
        <div className="cpos-note cpos-note--success" role="status">
          {t('pos.appAdmin.install.already')}
        </div>
      ) : canInstall ? (
        <div className="cpos-actions">
          <button
            type="button"
            className="cpos-btn cpos-btn--primary"
            onClick={() => void promptInstall()}
          >
            {t('pos.install.action')}
          </button>
        </div>
      ) : isIOS ? (
        <div className="cpos-note cpos-note--brand">{t('pos.install.iosHint')}</div>
      ) : (
        <div className="cpos-note cpos-note--warning">{t('pos.appAdmin.install.unavailable')}</div>
      )}

      <FieldDescription>{t('pos.appAdmin.install.note')}</FieldDescription>
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
  const formatDay = useFormatDate(DAY);
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
            date: formatDay.format(settings.recoveryMintedAtMillis),
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
      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.appAdmin.section.licence')}</h2>
        <div className="cpos-muted">{t('pos.appAdmin.licence.parked')}</div>
      </section>
    );
  }

  return <PosLicenseSection license={license} />;
}
