'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { BusinessHoursSchedule } from '../../types';
import { Button } from '../../ui/button';
import { Input, Label, Textarea } from '../../ui/input';
import { useToast } from '../../ui/toast';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { createContact } from '../../services/contact-service';
import { getSiteSettings } from '../../services/site-settings-service';
import { cn } from '../../utils/cn';
import { BusinessHoursCard } from './business-hours';

export interface ContactPageProps {
  /** Override the page heading. Defaults to the `contact.page.title` i18n string. */
  title?: string;
  /** Override the sub-heading copy. Defaults to the `contact.page.description` i18n string. */
  subtitle?: string;
  /** Wrapper className — use to slot the page into a constrained layout. */
  className?: string;
  /** Fires after a successful submission. Useful for analytics or redirects. */
  onSubmitted?: () => void;
}

const FIELD_GAP = 16;

/**
 * Public `/contact` page. Anyone (signed in or not) can submit; the service
 * writes to Firestore `contacts/{id}` with `status: 'new'`, which lights up
 * the admin notifications bell and triggers the admin-notify + auto-reply
 * Cloud Function.
 */
export function ContactPage({ title, subtitle, className, onSubmitted }: ContactPageProps) {
  const { db } = useCaspianFirebase();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const t = useT();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  // Honeypot — bots fill this out, humans never see it. Non-empty on submit → drop.
  const [trap, setTrap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [hours, setHours] = useState<BusinessHoursSchedule | null>(null);

  // Load the published business-hours schedule (if any) to render beside the form.
  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (alive) setHours(s?.businessHoursSchedule ?? null);
      })
      .catch(() => {
        /* hours are optional — a load failure just hides the panel */
      });
    return () => {
      alive = false;
    };
  }, [db]);

  // Pre-fill name/email when a signed-in user opens the page.
  useEffect(() => {
    if (!user || !userProfile) return;
    setName((n) => n || userProfile.displayName || '');
    setEmail((e) => e || user.email || userProfile.email || '');
  }, [user, userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trap) {
      // Silent success — don't reveal the honeypot to bots.
      setSent(true);
      return;
    }
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({ title: t('contact.form.errorRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createContact(db, {
        name,
        email,
        subject: subject || undefined,
        message,
        userId: user?.uid,
      });
      toast({
        title: t('contact.form.sent'),
        description: t('contact.form.sentDesc'),
      });
      setSent(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      onSubmitted?.();
    } catch (error) {
      console.error('[caspian-store] Failed to submit contact form:', error);
      toast({ title: t('contact.form.errorGeneric'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const heading = title ?? t('contact.page.title');
  const sub = subtitle ?? t('contact.page.description');
  const showHours = !!hours?.enabled;

  return (
    <div className={cn('caspian-contact-page', className)} style={{ padding: '48px 16px' }}>
      <div style={{ maxWidth: showHours ? 960 : 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{heading}</h1>
        <p style={{ color: '#555', marginTop: 8, lineHeight: 1.5 }}>{sub}</p>

        <div
          className={showHours ? cn('caspian-contact-layout') : undefined}
          style={
            showHours
              ? {
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 300px)',
                  gap: 32,
                  alignItems: 'start',
                }
              : undefined
          }
        >
          <div>
        {sent ? (
          <div style={successStyle}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t('contact.form.sent')}</h2>
            <p style={{ margin: '6px 0 0', color: '#333' }}>{t('contact.form.sentDesc')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: FIELD_GAP }}>
            <div>
              <Label htmlFor="contact-name">{t('contact.form.name')}</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="contact-email">{t('contact.form.email')}</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="contact-subject">{t('contact.form.subjectOptional')}</Label>
              <Input
                id="contact-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="contact-message">{t('contact.form.message')}</Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={5000}
                required
              />
              <p style={{ fontSize: 12, color: '#888', textAlign: 'right', marginTop: 4 }}>
                {message.length}/5000
              </p>
            </div>
            {/* Honeypot — hidden from real users via off-screen positioning + aria-hidden. */}
            <div aria-hidden="true" style={honeypotStyle}>
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
              />
            </div>
            <div>
              <Button type="submit" loading={submitting} disabled={submitting}>
                {submitting ? t('contact.form.submitting') : t('contact.form.submit')}
              </Button>
            </div>
          </form>
        )}
          </div>
          {showHours && hours ? (
            <div style={{ marginTop: 24 }}>
              <BusinessHoursCard schedule={hours} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const successStyle: CSSProperties = {
  marginTop: 24,
  padding: 20,
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 'var(--caspian-radius, 8px)',
  background: '#f6fff4',
};

const honeypotStyle: CSSProperties = {
  position: 'absolute',
  left: -9999,
  top: 'auto',
  width: 1,
  height: 1,
  overflow: 'hidden',
};
