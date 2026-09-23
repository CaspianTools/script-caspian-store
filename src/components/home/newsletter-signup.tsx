'use client';

import { useState, type FormEvent } from 'react';
import { subscribeEmail } from '../../services/subscriber-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useToast } from '../../ui/toast';
import { cn } from '../../utils/cn';

export interface NewsletterSignupProps {
  title?: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Optional compact mode — one-line form with no surrounding section. */
  compact?: boolean;
  className?: string;
}

export function NewsletterSignup({
  title,
  description,
  placeholder,
  submitLabel,
  compact,
  className,
}: NewsletterSignupProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const result = await subscribeEmail(db, email);
      if (result === 'already-subscribed') {
        toast({ title: t('home.newsletter.alreadySubscribed') });
      } else {
        toast({
          title: t('home.newsletter.success'),
          description: t('home.newsletter.successDesc'),
        });
      }
      setEmail('');
    } catch (error) {
      console.error('[caspian-store] Newsletter subscribe failed:', error);
      toast({ title: t('home.newsletter.failure'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <form
      className="caspian-stack-mobile"
      onSubmit={handleSubmit}
      style={{ display: 'flex', gap: 8, maxWidth: 420, width: '100%' }}
    >
      <Input
        type="email"
        autoComplete="email"
        inputMode="email"
        enterKeyHint="send"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder ?? t('home.newsletter.placeholder')}
        style={{ flex: 1 }}
      />
      <Button type="submit" loading={submitting}>
        {submitLabel ?? t('home.newsletter.submit')}
      </Button>
    </form>
  );

  if (compact) {
    return <div className={cn('caspian-newsletter-compact', className)}>{form}</div>;
  }

  return (
    <section
      className={cn('caspian-newsletter', className)}
      style={{ padding: 'clamp(40px, 8vw, 64px) clamp(16px, 4vw, 24px)', background: 'rgba(0,0,0,0.03)' }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <h2
          style={{
            fontFamily: 'var(--caspian-font-headline, inherit)',
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {title ?? t('home.newsletter.title')}
        </h2>
        <p style={{ color: '#666', marginTop: 12, marginBottom: 24 }}>
          {description ?? t('home.newsletter.description')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{form}</div>
      </div>
    </section>
  );
}
