'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebase, useCaspianServerApi } from '../provider/caspian-store-provider';
import { callCaspianServer } from '../services/caspian-callable';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';

interface SetupStatus {
  version: string;
  firestoreRules: 'current' | 'outdated' | 'missing' | 'unknown';
  storageRules: 'current' | 'outdated' | 'missing' | 'unknown';
  missingIndexes: number | null;
  ready: boolean;
  permissionMissing?: { roles: string[]; serviceAccount: string | null; grantUrl: string };
  error?: string;
}

interface InstallResult {
  firestoreRules: boolean;
  storageRules: boolean;
  indexesCreated: number;
  indexesBuilding: boolean;
  promotedToAdmin?: boolean;
  permissionMissing?: SetupStatus['permissionMissing'];
  error?: string;
}

type State =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'needed'; status: SetupStatus }
  | { kind: 'permission'; hint: NonNullable<SetupStatus['permissionMissing']> }
  | { kind: 'installing' }
  | { kind: 'installed'; building: boolean }
  | { kind: 'error'; message: string };

/**
 * Top-of-admin banner for stores running on a server API (`serverApi`
 * prop). Compares the security rules and indexes the Firebase project has
 * with the ones this library version ships, and installs them with one
 * click through the host's server — the owner never needs the Firebase CLI.
 * Renders nothing when everything is current or when there is no server API.
 */
export function AdminSetupBanner() {
  const serverApi = useCaspianServerApi();
  const { functions, auth } = useCaspianFirebase();
  const { user, refreshProfile } = useAuth();
  const t = useT();
  const [state, setState] = useState<State>({ kind: 'checking' });

  const check = useCallback(async () => {
    if (!serverApi || !user) return;
    setState({ kind: 'checking' });
    try {
      const status = await callCaspianServer<SetupStatus>(functions, 'setup/status', { method: 'GET' });
      if (status.permissionMissing) setState({ kind: 'permission', hint: status.permissionMissing });
      else if (status.error) setState({ kind: 'error', message: status.error });
      else if (status.ready) setState({ kind: 'ready' });
      else setState({ kind: 'needed', status });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [serverApi, user, functions]);

  useEffect(() => {
    void check();
  }, [check]);

  const install = async () => {
    setState({ kind: 'installing' });
    try {
      const result = await callCaspianServer<InstallResult>(functions, 'setup/install');
      if (result.permissionMissing) {
        setState({ kind: 'permission', hint: result.permissionMissing });
        return;
      }
      if (result.error) {
        setState({ kind: 'error', message: result.error });
        return;
      }
      if (result.promotedToAdmin) {
        await auth.currentUser?.getIdToken(true);
        await refreshProfile();
      }
      setState({ kind: 'installed', building: result.indexesBuilding });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  if (!serverApi || state.kind === 'checking' || state.kind === 'ready') return null;

  const tone =
    state.kind === 'installed'
      ? { bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.35)', fg: '#166534' }
      : state.kind === 'error'
        ? { bg: 'rgba(220, 38, 38, 0.06)', border: 'rgba(220, 38, 38, 0.3)', fg: '#991b1b' }
        : { bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.35)', fg: '#92400e' };

  return (
    <div
      role="status"
      style={{
        marginBottom: 20,
        padding: '14px 16px',
        borderRadius: 'var(--caspian-radius, 8px)',
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.fg,
        fontSize: 14,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        {state.kind === 'needed' && (
          <>
            <strong>{t('admin.setup.neededTitle')}</strong>
            <div style={{ marginTop: 2 }}>{t('admin.setup.neededBody', { version: state.status.version })}</div>
          </>
        )}
        {state.kind === 'installing' && <strong>{t('admin.setup.installing')}</strong>}
        {state.kind === 'installed' && (
          <>
            <strong>{t('admin.setup.installedTitle')}</strong>
            <div style={{ marginTop: 2 }}>
              {state.building ? t('admin.setup.installedBuilding') : t('admin.setup.installedBody')}
            </div>
          </>
        )}
        {state.kind === 'permission' && (
          <>
            <strong>{t('admin.setup.permissionTitle')}</strong>
            <div style={{ marginTop: 4 }}>
              {t('admin.setup.permissionBody', {
                account: state.hint.serviceAccount ?? t('admin.setup.permissionAccountUnknown'),
              })}
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>{t('admin.setup.roleFirebaseAdmin')}</li>
            </ul>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <strong>{t('admin.setup.errorTitle')}</strong>
            <div style={{ marginTop: 2, wordBreak: 'break-word' }}>{state.message}</div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {state.kind === 'needed' && (
          <Button size="sm" onClick={install}>
            {t('admin.setup.install')}
          </Button>
        )}
        {state.kind === 'installing' && (
          <Button size="sm" loading disabled>
            {t('admin.setup.install')}
          </Button>
        )}
        {state.kind === 'permission' && (
          <>
            <a
              href={state.hint.grantUrl}
              target="_blank"
              rel="noreferrer"
              style={{ alignSelf: 'center', color: 'inherit', fontWeight: 600 }}
            >
              {t('admin.setup.openIam')}
            </a>
            <Button size="sm" variant="outline" onClick={check}>
              {t('admin.setup.recheck')}
            </Button>
          </>
        )}
        {(state.kind === 'installed' || state.kind === 'error') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => (state.kind === 'installed' && typeof window !== 'undefined' ? window.location.reload() : check())}
          >
            {state.kind === 'installed' ? t('admin.setup.reload') : t('admin.setup.recheck')}
          </Button>
        )}
      </div>
    </div>
  );
}
