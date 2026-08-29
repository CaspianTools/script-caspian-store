'use client';

import { useEffect, useState } from 'react';
import {
  useFormatDate,
  Button,
  Input,
  FieldDescription,
  useToast,
} from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../i18n/use-pos-t';
import type { PosLicenseState } from './use-pos-license';

export interface PosLicenseSectionProps {
  license: PosLicenseState;
}

/**
 * The licence panel on `/pos/settings`.
 *
 * Renders nothing at all when the build has no vendor public key, which is the
 * default. A shop that never bought a licence from anyone should not be shown a
 * licence box it can only leave empty.
 */
export function PosLicenseSection({ license }: PosLicenseSectionProps) {
  const t = useT();
  const { toast } = useToast();
  const formatDate = useFormatDate({ dateStyle: 'medium' });
  const [draft, setDraft] = useState('');

  useEffect(() => setDraft(license.storedKey), [license.storedKey]);

  if (!license.configured) return null;

  const apply = async () => {
    const result = await license.activate(draft);
    if (result.status === 'invalid') {
      toast({ title: t('pos.license.invalid'), variant: 'destructive' });
      return;
    }
    if (result.seat === 'taken') {
      toast({ title: t('pos.license.seatTaken'), variant: 'destructive' });
      return;
    }
    toast({ title: t('pos.license.activated') });
  };

  const statusLine = (() => {
    if (license.seat === 'taken') return { text: t('pos.license.seatTaken'), tone: bad };
    switch (license.status) {
      case 'valid':
        return { text: t('pos.license.active', { name: license.payload?.name ?? '' }), tone: good };
      case 'expired':
        return {
          text: license.payload?.exp
            ? t('pos.license.expired', { date: formatDate.format(new Date(license.payload.exp * 1000)) })
            : t('pos.license.bannerExpired'),
          tone: bad,
        };
      case 'invalid':
        return { text: t('pos.license.invalid'), tone: bad };
      case 'unverifiable':
        // Honest rather than alarming: the key looks right, this browser just
        // cannot do the maths. The server settles it at activation.
        return { text: t('pos.license.unverifiable'), tone: neutral };
      default:
        return { text: t('pos.license.missing'), tone: neutral };
    }
  })();

  return (
    <section style={section}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <strong>{t('pos.license.title')}</strong>
        <span style={{ ...chip, ...statusLine.tone }}>{statusLine.text}</span>
      </div>

      {license.status === 'valid' && license.payload?.exp ? (
        <FieldDescription>
          {t('pos.license.expires', { date: formatDate.format(new Date(license.payload.exp * 1000)) })}
        </FieldDescription>
      ) : null}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t('pos.license.key')}</span>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="cslic1."
          spellCheck={false}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
        />
        <FieldDescription>{t('pos.license.keyHelp')}</FieldDescription>
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={apply} loading={license.busy} disabled={!draft.trim() || license.busy}>
          {t('pos.license.activate')}
        </Button>
        {license.storedKey ? (
          <Button variant="outline" onClick={license.clear} disabled={license.busy}>
            {t('pos.license.remove')}
          </Button>
        ) : null}
      </div>

      {license.seat === 'offline' && license.storedKey ? (
        <FieldDescription>{t('pos.license.offline')}</FieldDescription>
      ) : null}
    </section>
  );
}

const section: React.CSSProperties = {
  border: '1px solid var(--cpos-border, rgba(0,0,0,0.1))',
  borderRadius: 'var(--cpos-r-md, 12px)',
  background: 'var(--cpos-surface, transparent)',
  color: 'var(--cpos-fg, inherit)',
  padding: 16,
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const chip: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 10px',
  borderRadius: 999,
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
};

const good: React.CSSProperties = {
  background: 'var(--cpos-success-soft, #ecfdf5)',
  color: 'var(--cpos-success, #065f46)',
  borderColor: 'var(--cpos-success-line, #a7f3d0)',
};
const bad: React.CSSProperties = {
  background: 'var(--cpos-danger-soft, #fef2f2)',
  color: 'var(--cpos-danger, #991b1b)',
  borderColor: 'var(--cpos-danger-line, #fecaca)',
};
const neutral: React.CSSProperties = {
  background: 'var(--cpos-surface-3, rgba(0,0,0,0.04))',
  color: 'var(--cpos-fg-muted, #555)',
};
