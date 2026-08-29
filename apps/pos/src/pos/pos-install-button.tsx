'use client';

import { useState } from 'react';
import { useInstallPrompt } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';

/**
 * "Install" in the register's top bar.
 *
 * Deliberately a plain button rather than the storefront's floating banner: the
 * banner is `position: fixed; zIndex: 800` and the tender dialog is `zIndex: 60`,
 * so on a till it would sit on top of the cash keypad. A cashier installs the
 * register once, on the day the counter is set up, and never thinks about it
 * again — that does not deserve an interstitial.
 *
 * Renders nothing once the register is already running as an installed app.
 */
export function PosInstallButton() {
  const t = useT();
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  if (isStandalone) return null;
  if (!canInstall && !isIOS) return null;

  if (isIOS && !canInstall) {
    return (
      <span style={{ position: 'relative' }}>
        <button type="button" onClick={() => setShowIosHint((v) => !v)} className="cpos-btn cpos-btn--outline cpos-btn--sm">
          {t('pos.install.action')}
        </button>
        {showIosHint ? (
          <span role="status" className="cpos-popover">
            {t('pos.install.iosHint')}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        void promptInstall();
      }}
      className="cpos-btn cpos-btn--outline cpos-btn--sm"
      title={t('pos.install.help')}
    >
      {t('pos.install.action')}
    </button>
  );
}
