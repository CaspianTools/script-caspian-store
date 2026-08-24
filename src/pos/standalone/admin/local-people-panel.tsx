'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Select } from '../../../ui/select';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { setLocalPassword, MIN_LOCAL_PASSWORD_LENGTH } from '../local-auth';
import { deleteLocalUser, listLocalUsers, saveLocalUser } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { can as canBuiltIn, type LocalUser, type PosLocalRole } from '../types';
import { fieldLabel, muted, section } from './panel-styles';
import { PosAdminPage } from './pos-admin-page';
import { UsersIcon } from '../../../ui/icons';

/**
 * Staff and their roles.
 *
 * Adding new people now lives in the Quick Add menu. This panel is for review,
 * role changes, password resets, and disabling accounts.
 */
export function LocalPeoplePanel() {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { enabledRoles, can } = usePosRoles();
  const [users, setUsers] = useState<LocalUser[] | null>(null);

  const isSupport = canBuiltIn(session.user?.role, 'appAdmin.view');
  // Seeing the staff list and changing it are separate grants, so a role can be
  // given the roster to check a rota against without also being handed the
  // password resets.
  const mayEdit = can(session.user?.role, 'people.edit');
  const assignable = isSupport
    ? enabledRoles
    : enabledRoles.filter((r) => r.id !== 'superadmin');

  const refresh = useCallback(async () => {
    setUsers(await listLocalUsers());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeRole = async (user: LocalUser, next: PosLocalRole) => {
    await saveLocalUser({ ...user, role: next });
    await refresh();
  };

  const toggleDisabled = async (user: LocalUser) => {
    await saveLocalUser({ ...user, disabled: !user.disabled });
    await refresh();
  };

  const resetPassword = async (user: LocalUser) => {
    const next = window.prompt(t('pos.admin.people.newPasswordPrompt', { name: user.displayName }));
    if (next === null) return;
    if (!(await setLocalPassword(user.id, next))) {
      toast({ title: t('pos.local.passwordTooShort', { min: MIN_LOCAL_PASSWORD_LENGTH }) });
      return;
    }
    toast({ title: t('pos.admin.people.passwordChanged') });
  };

  const remove = async (user: LocalUser) => {
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
      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.people.listTitle')}</span>
        {users === null ? (
          <div style={muted}>{t('common.loading')}</div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('pos.local.username')}</TH>
                <TH>{t('pos.local.displayName')}</TH>
                <TH>{t('pos.admin.people.roleLabel')}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {users.map((u) => {
                const isSelf = u.id === session.user?.id;
                const editable = mayEdit && (isSupport || u.role !== 'superadmin');
                return (
                  <TR key={u.id}>
                    <TD style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {u.username}
                    </TD>
                    <TD>
                      {u.displayName}
                      {u.disabled ? (
                        <span style={muted}> · {t('pos.admin.people.disabled')}</span>
                      ) : null}
                      {isSelf ? <span style={muted}> · {t('pos.admin.people.you')}</span> : null}
                    </TD>
                    <TD>
                      {editable && !isSelf ? (
                        <Select
                          value={u.role}
                          onChange={(e) => void changeRole(u, e.target.value as PosLocalRole)}
                          options={assignable.map((r) => ({ value: r.id, label: r.name }))}
                        />
                      ) : (
                        roleLabel(u.role)
                      )}
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {editable ? (
                          <Button variant="outline" onClick={() => void resetPassword(u)}>
                            {t('pos.admin.people.resetPassword')}
                          </Button>
                        ) : null}
                        {editable && !isSelf ? (
                          <Button variant="outline" onClick={() => void toggleDisabled(u)}>
                            {u.disabled
                              ? t('pos.admin.people.enable')
                              : t('pos.admin.people.disable')}
                          </Button>
                        ) : null}
                        {editable && !isSelf ? (
                          <Button variant="destructive" onClick={() => void remove(u)}>
                            {t('common.delete')}
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <FieldDescription>{t('pos.admin.people.deleteNote')}</FieldDescription>
      </section>
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
