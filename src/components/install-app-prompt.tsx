'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/locale-context';

/** The `beforeinstallprompt` event isn't in the standard DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Module-level store so the deferred prompt is captured exactly once and shared
// across every consumer of `useInstallPrompt()` (the banner below + the mobile
// nav drawer's "Install app" item). The native event fires a single time.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let storeInitialized = false;
const subscribers = new Set<() => void>();

function emit() {
  for (const fn of subscribers) fn();
}

function ensureStore() {
  if (storeInitialized || typeof window === 'undefined') return;
  storeInitialized = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

export interface InstallPromptState {
  /** True when a native install prompt is available (Android / desktop Chrome). */
  canInstall: boolean;
  /** Triggers the native prompt; resolves to the user's choice (or null). */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
  /** True on iOS Safari, which has no programmatic prompt (Add to Home Screen). */
  isIOS: boolean;
  /** True when already running as an installed standalone app. */
  isStandalone: boolean;
}

/**
 * Shared install-prompt state. Captures the `beforeinstallprompt` event once
 * and exposes a stable `promptInstall()` plus platform flags. Consumed by the
 * `<InstallAppPrompt>` banner and the `<MobileNavSheet>` install entry.
 */
export function useInstallPrompt(): InstallPromptState {
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    ensureStore();
    const update = () => setCanInstall(deferredPrompt != null);
    update();
    subscribers.add(update);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent || '';
    const iOS =
      /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS 13+ reports as a Mac; disambiguate by touch support.
      (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
    setIsIOS(iOS);

    return () => {
      subscribers.delete(update);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    emit();
    return choice.outcome;
  }, []);

  return { canInstall, promptInstall, isIOS, isStandalone };
}

const DISMISS_KEY = 'caspian:pwa-install-dismissed';

/**
 * Dismissible bottom banner nudging installation. Shows the native prompt on
 * Android/Chrome and an "Add to Home Screen" hint on iOS. Hidden when already
 * installed (standalone) or previously dismissed. Mount once at the app root.
 */
export function InstallAppPrompt() {
  const t = useT();
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();
  // Start hidden to avoid a flash before the localStorage read resolves.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — best effort */
    }
    setDismissed(true);
  };

  if (isStandalone || dismissed) return null;
  const showAndroid = canInstall;
  const showIOS = isIOS && !canInstall;
  if (!showAndroid && !showIOS) return null;

  return (
    <div
      role="dialog"
      aria-label={t('pwa.install')}
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 800,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: 'min(560px, calc(100vw - 32px))',
        padding: '12px 14px 12px 18px',
        background: '#111',
        color: '#fff',
        borderRadius: 'var(--caspian-radius, 12px)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 14 }}>{showIOS ? t('pwa.iosHintTitle') : t('pwa.install')}</strong>
        <span style={{ fontSize: 12, opacity: 0.82 }}>
          {showIOS ? t('pwa.iosHintBody') : t('pwa.installBanner')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {showAndroid && (
          <button
            type="button"
            onClick={() => {
              void promptInstall();
            }}
            style={{
              background: '#fff',
              color: '#111',
              border: 0,
              borderRadius: 999,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('pwa.install')}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('pwa.dismiss')}
          style={{
            background: 'transparent',
            border: 0,
            color: '#fff',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            opacity: 0.7,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
