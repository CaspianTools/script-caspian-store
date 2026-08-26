'use client';

import { useState } from 'react';
import { useT } from '../../../../i18n/locale-context';
import { useToast } from '../../../../ui/toast';
import { FieldDescription } from '../../../../ui/field-description';
import { PosField, PosSelect } from '../../ui/pos-field';
import { createLocalUser, MIN_LOCAL_PASSWORD_LENGTH } from '../../local-auth';
import { usePosLocalSession } from '../../local-session-context';
import { usePosRoles } from '../../role-context';
import type { PosLocalRole } from '../../types';

export interface LocalPersonFormProps {
  formId: string;
  onSaved?: () => void;
}

/**
 * A new staff account.
 *
 * Editing -- role changes, password resets, disabling, deleting -- stays on the
 * People screen, where there is room for the full list and for the guard that
 * stops a till losing its last account.
 */
export function LocalPersonForm({ formId, onSaved }: LocalPersonFormProps) {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { enabledRoles, can } = usePosRoles();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PosLocalRole>(() => enabledRoles[0]?.id ?? 'staff');
  const [error, setError] = useState('');

  // The live definitions, not a hardcoded role id: a custom role granted App
  // admin could not hand out Support, which PosGuard would have allowed.
  const isSupport = can(session.user?.role, 'appAdmin.view');
  const assignable = isSupport ? enabledRoles : enabledRoles.filter((r) => r.id !== 'superadmin');

  /**
   * `t` echoes an unknown key rather than returning nullish, so a `??` here
   * could never fire: picking Storekeeper printed the literal string
   * `pos.admin.people.roleHelp.storekeeper` under the picker. Only four roles
   * have a help line, and custom roles never will.
   */
  const roleHelp = (() => {
    const key = `pos.admin.people.roleHelp.${role}`;
    const translated = t(key);
    return translated === key ? t('pos.admin.people.roleHelp.default') : translated;
  })();

  const add = async () => {
    setError('');
    // Checked here rather than by disabling the button. A disabled Add with no
    // explanation is the same dead end as a disabled tab; saying which field is
    // empty is the thing the person actually needs.
    if (!username.trim() || !password) {
      setError(t('pos.admin.people.needsCredentials'));
      return;
    }
    const result = await createLocalUser({ username, displayName, password, role });
    if (!result.ok) {
      setError(
        result.reason === 'password-too-short'
          ? t('pos.local.passwordTooShort', { min: MIN_LOCAL_PASSWORD_LENGTH })
          : result.reason === 'username-taken'
            ? t('pos.local.usernameTaken')
            : result.reason === 'invalid-role'
              ? t('pos.admin.people.invalidRole')
              : t('pos.admin.people.addFailed'),
      );
      return;
    }
    setUsername('');
    setDisplayName('');
    setPassword('');
    onSaved?.();
    toast({ title: t('pos.admin.people.added') });
  };

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
      className="cpos-form"
    >
      <div className="cpos-row">
        <PosField label={t('pos.local.username')} style={{ flex: '1 1 140px' }}>
          <input
            className="cpos-input"
            value={username}
            autoFocus
            autoComplete="off"
            onChange={(e) => setUsername(e.target.value)}
          />
        </PosField>
        <PosField label={t('pos.local.displayName')} style={{ flex: '1 1 160px' }}>
          <input
            className="cpos-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </PosField>
      </div>
      <div className="cpos-row">
        <PosField label={t('pos.local.password')} style={{ flex: '1 1 140px' }}>
          <input
            className="cpos-input"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </PosField>
        <PosField label={t('pos.admin.people.roleLabel')} style={{ flex: '1 1 140px' }}>
          <PosSelect
            value={role}
            onChange={(e) => setRole(e.target.value as PosLocalRole)}
            options={assignable.map((r) => ({ value: r.id, label: r.name }))}
          />
        </PosField>
      </div>
      <FieldDescription>{roleHelp}</FieldDescription>
      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
}
