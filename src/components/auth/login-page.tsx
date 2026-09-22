'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/auth-context';
import { useCaspianLink, useCaspianNavigation } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Input, Label } from '../../ui/input';
import { Separator } from '../../ui/misc';
import { useToast } from '../../ui/toast';

export interface LoginPageProps {
  /** Path to redirect to after successful sign-in. Default: `/account`. */
  redirectTo?: string;
  registerHref?: string;
  forgotPasswordHref?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function LoginPage({
  redirectTo = '/account',
  registerHref = '/register',
  forgotPasswordHref = '/forgot-password',
  title,
  subtitle,
  className,
}: LoginPageProps) {
  const { signIn, signInWithGoogle } = useAuth();
  const nav = useCaspianNavigation();
  const Link = useCaspianLink();
  const { toast } = useToast();
  const t = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password, rememberMe);
      nav.push(redirectTo);
    } catch (error) {
      console.error('[caspian-store] Sign-in failed:', error);
      toast({
        title: t('auth.login.failed'),
        description: t('auth.login.failedDesc'),
        variant: 'destructive',
      });
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
      toast({ title: t('auth.login.failed'), variant: 'destructive' });
      setSubmitting(false);
    }
  };

  return (
    <div className={className} style={{ maxWidth: 420, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{title ?? t('auth.login.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>{subtitle ?? t('auth.login.subtitle')}</p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Label htmlFor="login-email">{t('auth.login.email')}</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="login-password">{t('auth.login.password')}</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            enterKeyHint="done"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 13,
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t('auth.login.rememberMe')}
          </label>
          <Link href={forgotPasswordHref}>{t('auth.login.forgotPassword')}</Link>
        </div>
        <Button type="submit" size="lg" className="caspian-full-mobile" loading={submitting}>
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>

      <Separator />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="caspian-full-mobile"
        onClick={handleGoogle}
        disabled={submitting}
        style={{ width: '100%' }}
      >
        {t('auth.login.googleCta')}
      </Button>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#666' }}>
        {t('auth.login.noAccount')} <Link href={registerHref}>{t('auth.login.createOne')}</Link>
      </p>
    </div>
  );
}
