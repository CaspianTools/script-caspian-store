'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select } from '../../../ui/select';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { createLocalUser, setLocalPassword, MIN_LOCAL_PASSWORD_LENGTH } from '../local-auth';
import { deleteLocalUser, listLocalUsers, saveLocalUser } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { canAccess, POS_LOCAL_ROLES, type LocalUser, type PosLocalRole } from '../types';
import { actions, danger, field, fieldLabel, muted, row, section } from './panel-styles';

/**
 * Staff and their roles.
 *
 * Only a superadmin can hand out the superadmin role — that is the one rule
 * here that is not merely tidiness. An owner who could promote themselves to
 * support could also lock the installer out of a machine the installer is
 * responsible for.
 */
export function LocalPeoplePanel() {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const [users, setUsers] = useState<LocalUser[] | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PosLocalRole>('staff');
  const [error, setError] = useState('');

  const isSupport = canAccess(session.user?.role, 'support');
  const assignable = isSupport ? POS_LOCAL_ROLES : POS_LOCAL_ROLES.filter((r) => r !== 'superadmin');

  const refresh = useCallback(async () => {
    setUsers(await listLocalUsers());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    setError('');
    const result = await createLocalUser({ username, displayName, password, role });
    if (!result.ok) {
      setError(
        result.reason === 'password-too-short'
          ? t('pos.local.passwordTooShort', { min: MIN_LOCAL_PASSWORD_LENGTH })
          : result.reason === 'username-taken'
            ? t('pos.local.usernameTaken')
            : t('pos.admin.people.addFailed'),
      );
      return;
    }
    setUsername('');
    setDisplayName('');
    setPassword('');
    setRole('staff');
    await refresh();
    toast({ title: t('pos.admin.people.added') });
  };

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

  const roleLabel = (r: PosLocalRole) => t(`pos.admin.people.role.${r}`);

  return (
    <div>
      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.people.addTitle')}</span>
        <div style={row}>
          <div style={{ ...field, flex: '1 1 140px' }}>
            <label style={fieldLabel}>{t('pos.local.username')}</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div style={{ ...field, flex: '1 1 160px' }}>
            <label style={fieldLabel}>{t('pos.local.displayName')}</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div style={{ ...field, flex: '1 1 140px' }}>
            <label style={fieldLabel}>{t('pos.local.password')}</label>
            <Input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div style={{ ...field, flex: '1 1 140px' }}>
            <label style={fieldLabel}>{t('pos.admin.people.roleLabel')}</label>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as PosLocalRole)}
              options={assignable.map((r) => ({ value: r, label: roleLabel(r) }))}
            />
          </div>
        </div>
        <FieldDescription>{t(`pos.admin.people.roleHelp.${role}`)}</FieldDescription>
        {error ? <div style={danger}>{error}</div> : null}
        <div style={actions}>
          <Button onClick={() => void add()} disabled={!username || !password}>
            {t('pos.admin.people.add')}
          </Button>
        </div>
      </section>

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
                // Only support can touch a support account, and nobody can
                // take away their own access — a till whose last superadmin
                // demoted themselves needs a reinstall to fix.
                const editable = isSupport || u.role !== 'superadmin';
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
                          options={assignable.map((r) => ({ value: r, label: roleLabel(r) }))}
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
