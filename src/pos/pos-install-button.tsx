'use client';

import { useState } from 'react';
import { useT } from '../i18n/locale-context';
import { useInstallPrompt } from '../components/install-app-prompt';

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
        <button type="button" onClick={() => setShowIosHint((v) => !v)} style={button}>
          {t('pos.install.action')}
        </button>
        {showIosHint ? (
          <span role="status" style={popover}>
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
      style={button}
      title={t('pos.install.help')}
    >
      {t('pos.install.action')}
    </button>
  );
}

const button: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.16)',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 8,
  padding: '5px 11px',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const popover: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  insetInlineEnd: 0,
  width: 260,
  padding: '10px 12px',
  background: '#111',
  color: '#fff',
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.5,
  boxShadow: '0 12px 28px rgba(0,0,0,0.24)',
  zIndex: 40,
};
