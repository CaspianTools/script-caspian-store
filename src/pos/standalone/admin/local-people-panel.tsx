'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import {
  canDisableLocalUser,
  canRemoveLocalUser,
} from '../local-auth';
import { deleteLocalUser, listLocalUsers, saveLocalUser } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import type { LocalUser, PosLocalRole } from '../types';
import { PanelLoadError } from './panel-load-error';
import { LocalPasswordDialog } from './local-password-dialog';
import { usePosQuickAdd } from './quick-add/pos-quick-add-context';
import { PosAdminPage } from './pos-admin-page';
import { UsersIcon } from '../../../ui/icons';
import { PosSelect } from '../ui/pos-field';

/**
 * Staff and their roles: adding, review, role changes, password resets, and
 * blocking accounts.
 *
 * Rendered at `/pos/people` and again inside App admin, where it is the staff
 * half of what a shop is handed when whoever installed the till leaves. One
 * component in both places on purpose -- a second table that resets passwords
 * is a second place for the last-account guards to be got wrong.
 *
 * Adding opens Quick add on the Person entry rather than a dialog of its own.
 * The button stays here because a screen called People that cannot add one
 * sends the reader hunting for a screen that can -- but there is one form, and
 * it is the same one the top bar opens.
 */
export function LocalPeoplePanel() {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { enabledRoles, can } = usePosRoles();
  const [users, setUsers] = useState<LocalUser[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const quickAdd = usePosQuickAdd();

  const isSupport = can(session.user?.role, 'appAdmin.view');
  /** The live test, handed to the pure last-account guards below. */
  const holdsAppAdmin = (role: PosLocalRole) => can(role, 'appAdmin.view');
  // Seeing the staff list and changing it are separate grants, so a role can be
  // given the roster to check a rota against without also being handed the
  // password resets.
  const mayEdit = can(session.user?.role, 'people.edit');
  const assignable = isSupport
    ? enabledRoles
    : enabledRoles.filter((r) => r.id !== 'superadmin');

  const refresh = useCallback(async () => {
    try {
      setUsers(await listLocalUsers());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, quickAdd.savedCount]);

  const changeRole = async (user: LocalUser, next: PosLocalRole) => {
    await saveLocalUser({ ...user, role: next });
    await refresh();
  };

  const toggleDisabled = async (user: LocalUser) => {
    // Only blocking needs the guard. Letting somebody back in cannot strand the
    // till, and refusing it would be a way to make the situation permanent.
    if (!user.disabled && !canDisableLocalUser(users ?? [], user.id, holdsAppAdmin)) {
      toast({ title: t('pos.admin.people.lastSupport') });
      return;
    }
    await saveLocalUser({ ...user, disabled: !user.disabled });
    await refresh();
  };

  // Was a `window.prompt` until v1.1.0, which put the new password in clear text
  // on a screen facing the shop floor, had no confirmation box, and in an
  // installed PWA renders as browser chrome some platforms suppress outright.
  const [passwordFor, setPasswordFor] = useState<LocalUser | null>(null);

  const remove = async (user: LocalUser) => {
    // The People screen only ever stopped you deleting yourself, so two Support
    // accounts could delete each other and leave a till with a catalogue, a
    // year of sales and nobody able to add a cashier. App admin already refuses
    // to let the Support *role* be switched off for the same reason.
    if (!canRemoveLocalUser(users ?? [], user.id, holdsAppAdmin)) {
      toast({ title: t('pos.admin.people.lastSupport') });
      return;
    }
    if (!window.confirm(t('pos.admin.people.confirmDelete', { name: user.displayName }))) return;
    await deleteLocalUser(user.id);
    await refresh();
  };

  const roleLabel = (r: PosLocalRole) => {
    const def = enabledRoles.find((role) => role.id === r);
    return def?.name ?? r;
  };

  return (
    <div>
      <section className="cpos-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="cpos-section__title" style={{ flex: 1 }}>{t('pos.admin.people.listTitle')}</span>
          {mayEdit ? (
            <button type="button" className="cpos-btn cpos-btn--primary cpos-btn--sm" onClick={() => quickAdd.open('person')}>
              {t('pos.admin.people.add')}
            </button>
          ) : null}
        </div>
        {loadFailed ? (
          <PanelLoadError onRetry={() => void refresh()} />
        ) : users === null ? (
          <div className="cpos-muted">{t('common.loading')}</div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
              <tr>
                <th>{t('pos.local.username')}</th>
                <th>{t('pos.local.displayName')}</th>
                <th>{t('pos.admin.people.roleLabel')}</th>
                <th />
              </tr>
              </thead>
              <tbody>
              {users.map((u) => {
                const isSelf = u.id === session.user?.id;
                const editable = mayEdit && (isSupport || u.role !== 'superadmin');
                return (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {u.username}
                    </td>
                    <td>
                      {u.displayName}
                      {u.disabled ? (
                        <span className="cpos-muted"> · {t('pos.admin.people.disabled')}</span>
                      ) : null}
                      {isSelf ? <span className="cpos-muted"> · {t('pos.admin.people.you')}</span> : null}
                    </td>
                    <td>
                      {editable && !isSelf ? (
                        <PosSelect
                          value={u.role}
                          onChange={(e) => void changeRole(u, e.target.value as PosLocalRole)}
                          options={assignable.map((r) => ({ value: r.id, label: r.name }))}
                        />
                      ) : (
                        roleLabel(u.role)
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {editable ? (
                          <button type="button" className="cpos-btn cpos-btn--outline" onClick={() => setPasswordFor(u)}>
                            {t('pos.admin.people.resetPassword')}
                          </button>
                        ) : null}
                        {editable && !isSelf ? (
                          <button type="button" className="cpos-btn cpos-btn--outline" onClick={() => void toggleDisabled(u)}>
                            {u.disabled
                              ? t('pos.admin.people.enable')
                              : t('pos.admin.people.disable')}
                          </button>
                        ) : null}
                        {editable && !isSelf ? (
                          <button type="button" className="cpos-btn cpos-btn--danger" onClick={() => void remove(u)}>
                            {t('common.delete')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
          </table>
        </div>
        )}
        <FieldDescription>{t('pos.admin.people.deleteNote')}</FieldDescription>
      </section>

      <LocalPasswordDialog
        open={!!passwordFor}
        onOpenChange={(next) => {
          if (!next) setPasswordFor(null);
        }}
        user={passwordFor}
      />

    </div>
  );
}

/** The same panel as the screen it now has to itself. */
export function LocalPeoplePage() {
  const t = useT();
  return (
    <PosAdminPage
      icon={<UsersIcon size={19} />}
      title={t('pos.admin.section.people')}
      subtitle={t('pos.people.subtitle')}
    >
      <LocalPeoplePanel />
    </PosAdminPage>
  );
}
