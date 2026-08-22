'use client';

import { useState } from 'react';
import { useT, useFormatDate } from '../../i18n/locale-context';
import { useCaspianLink } from '../../provider/caspian-store-provider';
import type { PosLicenseState } from './use-pos-license';

export interface PosLicenseBannerProps {
  license: PosLicenseState;
}

/**
 * The whole of licence enforcement: a strip of text.
 *
 * It never blocks a sale, never covers the ticket, and can be dismissed for the
 * session. That is the enforcement posture this product chose deliberately — a
 * shop that cannot serve a customer because of a clock, a network hiccup or an
 * expired card on the vendor's side is a far worse outcome than an unlicensed
 * shop, and the register is the last place to learn that lesson.
 */
export function PosLicenseBanner({ license }: PosLicenseBannerProps) {
  const t = useT();
  const Link = useCaspianLink();
  const formatDate = useFormatDate({ dateStyle: 'medium' });
  const [dismissed, setDismissed] = useState(false);

  if (!license.shouldWarn || dismissed) return null;

  const message = (() => {
    if (license.seat === 'taken') return t('pos.license.seatTaken');
    if (license.status === 'expired') {
      const exp = license.payload?.exp;
      return exp
        ? t('pos.license.expired', { date: formatDate.format(new Date(exp * 1000)) })
        : t('pos.license.bannerExpired');
    }
    if (license.status === 'invalid') return t('pos.license.invalid');
    return t('pos.license.bannerUnlicensed');
  })();

  return (
    <div role="status" style={strip}>
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      <Link href="/pos/settings" style={link}>
        {t('pos.license.title')}
      </Link>
      <button type="button" onClick={() => setDismissed(true)} style={dismiss}>
        {t('pos.license.dismiss')}
      </button>
    </div>
  );
}

const strip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  background: '#fffbeb',
  borderBottom: '1px solid #f2dda4',
  color: '#8a5a00',
  fontSize: 13,
  flexWrap: 'wrap',
};

const link: React.CSSProperties = { color: 'inherit', fontWeight: 600, textDecoration: 'underline' };

const dismiss: React.CSSProperties = {
  border: '1px solid rgba(138, 90, 0, 0.3)',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 6,
  padding: '3px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
