'use client';

import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  useCaspianFirebase,
  useFormatDate,
  reportServiceError,
  Badge,
  Skeleton,
  Button,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';
import { isLicensingConfigured } from '../pos/license/public-key';

interface LicenseRow {
  lic: string;
  name: string;
  tier: string;
  deviceId: string;
  expiresAt: number | null;
  rejectedAttempts: number;
  lastRejectedDeviceId: string;
  activatedAtMillis: number | null;
  lastSeenAtMillis: number | null;
}

export interface AdminPosLicensesProps {
  className?: string;
}

/**
 * Sold register licences, and the one support action that matters: releasing a
 * seat.
 *
 * Tills get replaced, browsers get wiped, and a register's device id is
 * regenerated whenever someone clears site data — so a customer who paid can
 * lock themselves out through no fault of their own. Without a release button,
 * per-computer licensing turns into a support queue.
 *
 * Renders nothing when this build has no vendor public key, which is the
 * default for anyone not selling licences.
 */
export function AdminPosLicenses({ className }: AdminPosLicensesProps) {
  const { db, functions } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const formatDate = useFormatDate({ dateStyle: 'medium' });

  const [rows, setRows] = useState<LicenseRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    httpsCallable<Record<string, never>, { licenses: LicenseRow[] }>(functions, 'listPosLicenses')({})
      .then(({ data }) => setRows(data.licenses ?? []))
      .catch((error) => {
        reportServiceError(db, 'admin-pos-licenses.load', error);
        setRows([]);
      });
  }, [db, functions]);

  useEffect(() => {
    if (isLicensingConfigured()) load();
  }, [load]);

  if (!isLicensingConfigured()) return null;

  const release = async (row: LicenseRow) => {
    if (typeof window !== 'undefined' && !window.confirm(t('admin.pos.license.confirmRelease'))) return;
    setBusy(row.lic);
    try {
      await httpsCallable(functions, 'releasePosLicenseSeat')({ lic: row.lic });
      toast({ title: t('admin.pos.license.released') });
      load();
    } catch (error) {
      reportServiceError(db, 'admin-pos-licenses.release', error);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={className} style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <strong>{t('admin.pos.license.title')}</strong>
        <Button variant="outline" size="sm" onClick={load}>
          {t('common.retry')}
        </Button>
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>{t('admin.pos.license.subtitle')}</div>

      {rows === null ? (
        <Skeleton style={{ height: 90 }} />
      ) : rows.length === 0 ? (
        <p style={{ color: '#888', padding: 20, textAlign: 'center', margin: 0 }}>
          {t('admin.pos.license.none')}
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.pos.license.col.customer')}</TH>
              <TH>{t('admin.pos.license.col.computer')}</TH>
              <TH>{t('admin.pos.license.col.expires')}</TH>
              <TH>{t('admin.pos.license.col.lastSeen')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.lic}>
                <TD>
                  <div style={{ fontWeight: 550 }}>{row.name || row.lic}</div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'ui-monospace, monospace' }}>
                    {row.lic}
                  </div>
                </TD>
                <TD style={{ fontSize: 12 }}>
                  {row.deviceId ? (
                    <span style={{ fontFamily: 'ui-monospace, monospace' }}>{row.deviceId}</span>
                  ) : (
                    <Badge variant="outline">{t('admin.pos.license.unbound')}</Badge>
                  )}
                  {row.rejectedAttempts > 0 ? (
                    <div style={{ marginTop: 4 }}>
                      <Badge variant="secondary">
                        {t('admin.pos.license.blocked', { count: row.rejectedAttempts })}
                      </Badge>
                    </div>
                  ) : null}
                </TD>
                <TD style={{ fontSize: 13, color: '#666' }}>
                  {row.expiresAt ? formatDate.format(new Date(row.expiresAt * 1000)) : '—'}
                </TD>
                <TD style={{ fontSize: 13, color: '#666' }}>
                  {row.lastSeenAtMillis ? formatDate.format(new Date(row.lastSeenAtMillis)) : '—'}
                </TD>
                <TD>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!row.deviceId || busy === row.lic}
                    loading={busy === row.lic}
                    onClick={() => void release(row)}
                  >
                    {t('admin.pos.license.release')}
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 'var(--caspian-radius, 12px)',
  padding: 16,
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};
