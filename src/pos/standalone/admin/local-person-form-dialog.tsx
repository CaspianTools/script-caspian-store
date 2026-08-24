'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select } from '../../../ui/select';
import { Dialog } from '../../../ui/dialog';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { createLocalUser, MIN_LOCAL_PASSWORD_LENGTH } from '../local-auth';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { canAccess, type PosLocalRole } from '../types';
import { danger, field, fieldLabel, row } from './panel-styles';

export interface LocalPersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * Add a new staff account from the Quick Add menu.
 *
 * Editing (role changes, password resets, disable/delete) stays on the People
 * panel where there is room for the full list.
 */
export function LocalPersonFormDialog({ open, onOpenChange, onSaved }: LocalPersonFormDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { enabledRoles } = usePosRoles();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PosLocalRole>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setUsername('');
    setDisplayName('');
    setPassword('');
    setRole(enabledRoles[0]?.id ?? 'staff');
    setError('');
  }, [open, enabledRoles]);

  const isSupport = canAccess(session.user?.role, 'support');
  const assignable = isSupport
    ? enabledRoles
    : enabledRoles.filter((r) => r.id !== 'superadmin');

  const add = async () => {
    setError('');
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
    onOpenChange(false);
    onSaved?.();
    toast({ title: t('pos.admin.people.added') });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pos.admin.people.addTitle')}
      maxWidth={560}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void add()} disabled={!username || !password}>
            {t('pos.admin.people.add')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={row}>
          <div style={{ ...field, flex: '1 1 140px' }}>
            <label style={fieldLabel}>{t('pos.local.username')}</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div style={{ ...field, flex: '1 1 160px' }}>
            <label style={fieldLabel}>{t('pos.local.displayName')}</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        </div>
        <div style={row}>
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
              options={assignable.map((r) => ({ value: r.id, label: r.name }))}
            />
          </div>
        </div>
        <FieldDescription>
          {t(`pos.admin.people.roleHelp.${role}`) ?? t('pos.admin.people.roleHelp.default')}
        </FieldDescription>
        {error ? <div style={danger}>{error}</div> : null}
      </div>
    </Dialog>
  );
}
