'use client';

import { useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
} from 'firebase/auth';
import { useAuth } from '../../context/auth-context';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Input, Label } from '../../ui/input';
import { useToast } from '../../ui/toast';

export function ChangePasswordCard({
  minPasswordLength = 8,
  className,
}: {
  minPasswordLength?: number;
  className?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  // Whether the account already has an email/password credential. A federated
  // account (e.g. Google-only) has no `password` provider yet — instead of
  // changing a password it doesn't have, it can *set* one (link the credential)
  // so the user can also sign in with email + password, not just Google.
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');

  const reset = () => {
    setCurrent('');
    setNewPassword('');
    setConfirm('');
    setOpen(false);
  };

  const handleSave = async () => {
    if (newPassword.length < minPasswordLength) {
      toast({ title: t('password.tooShort', { min: minPasswordLength }), variant: 'destructive' });
      return;
    }
    if (newPassword !== confirm) {
      toast({ title: t('password.mismatch'), variant: 'destructive' });
      return;
    }
    if (!user.email) {
      toast({ title: t('password.noEmail'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (hasPassword) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        toast({ title: t('password.updated') });
      } else {
        // Link an email/password credential onto the federated account. If the
        // sign-in session is stale Firebase demands a fresh login first, so
        // reauthenticate through the Google popup and retry once.
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        try {
          await linkWithCredential(user, credential);
        } catch (error) {
          if ((error as { code?: string })?.code === 'auth/requires-recent-login' && hasGoogle) {
            await reauthenticateWithPopup(user, new GoogleAuthProvider());
            await linkWithCredential(user, credential);
          } else {
            throw error;
          }
        }
        await user.reload();
        toast({ title: t('password.setSuccess') });
      }
      reset();
    } catch (error) {
      console.error('[caspian-store] Password change failed:', error);
      const code = (error as { code?: string })?.code;
      toast({
        title: code === 'auth/wrong-password' ? t('password.wrongCurrent') : t('password.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={className}
      style={{ padding: 20, border: '1px solid #eee', borderRadius: 'var(--caspian-radius, 8px)' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('password.title')}</h2>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {hasPassword ? t('password.change') : t('password.set')}
          </Button>
        )}
      </header>

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasPassword && (
            <div>
              <Label>{t('password.current')}</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label>{t('password.new')}</Label>
            <Input
              type="password"
              autoComplete="new-password"
              minLength={minPasswordLength}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('password.confirmNew')}</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={reset} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {hasPassword ? t('password.update') : t('password.set')}
            </Button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
          {hasPassword ? t('password.subtitle') : t('password.setHint')}
        </p>
      )}
    </section>
  );
}
