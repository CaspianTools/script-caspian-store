'use client';

import { useState } from 'react';
import { useFormatDate, useCaspianLink } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../i18n/use-pos-t';
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
    <div role="status" className="cpos-strip">
      <span className="cpos-strip__spacer">{message}</span>
      <Link href="/pos/settings" className="cpos-strip__link">
        {t('pos.license.title')}
      </Link>
      <button
        type="button"
        className="cpos-btn cpos-btn--ghost cpos-btn--sm"
        onClick={() => setDismissed(true)}
      >
        {t('pos.license.dismiss')}
      </button>
    </div>
  );
}
