'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase, useCaspianLink, useCaspianNavigation } from '../../provider/caspian-store-provider';
import { getSiteSettings } from '../../services/site-settings-service';
import { useT } from '../../i18n/locale-context';
import type { AccountSettings } from '../../types';
import { Button } from '../../ui/button';
import { Input, Label } from '../../ui/input';
import { Separator } from '../../ui/misc';
import { useToast } from '../../ui/toast';

export interface RegisterPageProps {
  redirectTo?: string;
  loginHref?: string;
  title?: string;
  subtitle?: string;
  /** Minimum password length. Default: 8. */
  minPasswordLength?: number;
  /**
   * Override the account-creation policy read from `SiteSettings.accounts`.
   * When omitted, fetched on mount. Added in v2.10.
   */
  accounts?: AccountSettings;
  className?: string;
}

export function RegisterPage({
  redirectTo = '/account',
  loginHref = '/login',
  title,
  subtitle,
  minPasswordLength = 8,
  accounts: accountsOverride,
  className,
}: RegisterPageProps) {
  const { signUp, signUpWithSetupLink, signInWithGoogle } = useAuth();
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const Link = useCaspianLink();
  const { toast } = useToast();
  const t = useT();

  const [accounts, setAccounts] = useState<AccountSettings | undefined>(accountsOverride);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (accountsOverride !== undefined) {
      setAccounts(accountsOverride);
      return undefined;
    }
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (alive) setAccounts(s?.accounts);
      })
      .catch(() => {
        /* fall through to defaults */
      });
    return () => {
      alive = false;
    };
  }, [db, accountsOverride]);

  // Merchant explicitly turned off My-Account registration — show a banner
  // instead of the form so consumers don't have to write this branch themselves.
  if (accounts && accounts.allowAccountCreationOnMyAccount === false) {
    return (
      <div className={className} style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Registration is disabled</h1>
        <p style={{ color: '#666', marginTop: 8 }}>
          Account creation on this store is turned off. If you already have an account, sign in
          below.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link href={loginHref}>{t('auth.register.signIn')}</Link>
        </div>
      </div>
    );
  }

  const setupLinkMode = accounts?.sendPasswordSetupLink === true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: t('auth.register.emailRequired'), variant: 'destructive' });
      return;
    }
    if (!setupLinkMode) {
      if (password.length < minPasswordLength) {
        toast({
          title: t('auth.register.passwordTooShort', { min: minPasswordLength }),
          variant: 'destructive',
        });
        return;
      }
      if (password !== confirm) {
        toast({ title: t('auth.register.passwordMismatch'), variant: 'destructive' });
        return;
      }
    }
    setSubmitting(true);
    try {
      if (setupLinkMode) {
        await signUpWithSetupLink(email, '');
        toast({
          title: 'Check your email',
          description: 'We sent a link so you can set your password.',
        });
      } else {
        await signUp(email, password, '');
      }
      nav.push(redirectTo);
    } catch (error) {
      console.error('[caspian-store] Sign-up failed:', error);
      const msg = error instanceof Error ? error.message : t('auth.register.failed');
      toast({ title: t('auth.register.failed'), description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      nav.push(redirectTo);
    } catch (error) {
      console.error('[caspian-store] Google sign-in failed:', error);
      toast({ title: t('auth.register.failed'), variant: 'destructive' });
      setSubmitting(false);
    }
  };

  return (
    <div className={className} style={{ maxWidth: 420, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{title ?? t('auth.register.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>{subtitle ?? t('auth.register.subtitle')}</p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Label htmlFor="reg-email">{t('auth.login.email')}</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {!setupLinkMode && (
          <>
            <div>
              <Label htmlFor="reg-password">{t('auth.login.password')}</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={minPasswordLength}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reg-confirm">{t('auth.register.confirmPassword')}</Label>
              <Input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </>
        )}
        {setupLinkMode && (
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
            We'll email you a link to set your password after you sign up.
          </p>
        )}
        <Button type="submit" size="lg" loading={submitting}>
          {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </form>

      <Separator />

      <Button variant="outline" size="lg" onClick={handleGoogle} disabled={submitting} style={{ width: '100%' }}>
        {t('auth.login.googleCta')}
      </Button>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#666' }}>
        {t('auth.register.hasAccount')} <Link href={loginHref}>{t('auth.register.signIn')}</Link>
      </p>
    </div>
  );
}
