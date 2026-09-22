'use client';

import { useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import { caspianCollections } from '../../firebase/collections';
import { useCaspianFirebase, useCaspianNavigation } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Input, Label } from '../../ui/input';
import { Dialog } from '../../ui/dialog';
import { useToast } from '../../ui/toast';

const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountCard({
  redirectTo = '/',
  className,
}: {
  redirectTo?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const { auth, db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const isGoogleAccount = user.providerData.some((p) => p.providerId === 'google.com');

  const reset = () => {
    setPassword('');
    setPhrase('');
    setDeleting(false);
    setOpen(false);
  };

  const handleDelete = async () => {
    if (phrase !== CONFIRM_PHRASE) {
      toast({ title: t('deleteAccount.failed'), variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      if (!isGoogleAccount) {
        if (!user.email) {
          toast({ title: t('password.noEmail'), variant: 'destructive' });
          setDeleting(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }
      // Per-user docs go before the auth user: once `deleteUser` resolves the
      // client has no auth and the owner-scoped rules deny both deletes.
      // Orders are preserved for records.
      const collections = caspianCollections(db);
      await deleteDoc(doc(collections.users, user.uid)).catch(() => undefined);
      await deleteDoc(doc(collections.carts, user.uid)).catch(() => undefined);
      // A Google account has no password to reauthenticate with up front, so
      // a stale session surfaces here as `auth/requires-recent-login`; confirm
      // through the Google popup and retry once.
      try {
        await deleteUser(user);
      } catch (error) {
        if ((error as { code?: string })?.code === 'auth/requires-recent-login' && isGoogleAccount) {
          await reauthenticateWithPopup(user, new GoogleAuthProvider());
          await deleteUser(user);
        } else {
          throw error;
        }
      }
      toast({ title: t('deleteAccount.success'), variant: 'success' });
      // Sign out the stale session if still attached.
      try {
        await auth.signOut();
      } catch {
        /* ignore */
      }
      nav.push(redirectTo);
    } catch (error) {
      console.error('[caspian-store] Delete account failed:', error);
      const code = (error as { code?: string })?.code;
      toast({
        title: code === 'auth/wrong-password' ? t('password.wrongCurrent') : t('deleteAccount.failed'),
        variant: 'destructive',
      });
      setDeleting(false);
    }
  };

  return (
    <section
      className={className}
      style={{
        padding: 20,
        border: '1px solid #fee2e2',
        background: '#fff7f7',
        borderRadius: 'var(--caspian-radius, 8px)',
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 8, color: '#991b1b' }}>
        {t('deleteAccount.title')}
      </h2>
      <p style={{ color: '#7f1d1d', fontSize: 14, margin: 0, marginBottom: 12 }}>
        {t('deleteAccount.description')}
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {t('deleteAccount.cta')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (!o ? reset() : setOpen(o))}
        title={t('deleteAccount.title')}
        description={t('deleteAccount.description')}
        footer={
          <>
            <Button variant="outline" onClick={reset} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              {t('deleteAccount.confirm')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isGoogleAccount && (
            <div>
              <Label>{t('deleteAccount.passwordPrompt')}</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label>{t('deleteAccount.typeToConfirm', { text: CONFIRM_PHRASE })}</Label>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
            />
          </div>
        </div>
      </Dialog>
    </section>
  );
}
