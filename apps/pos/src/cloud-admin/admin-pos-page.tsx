'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  type Order,
  listPosOrders,
  reportServiceError,
  getSiteSettings,
  saveSiteSettings,
  useCaspianFirebase,
  useCaspianLink,
  useScriptSettings,
  useT,
  Badge,
  Skeleton,
  Button,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  DEFAULT_POS_SETTINGS,
  type PosSettings,
} from '@caspian-explorer/script-caspian-store';
import { AdminPosLicenses } from './admin-pos-licenses';

export interface AdminPosPageProps {
  className?: string;
}

/**
 * Back office for the register: switch the POS on, see what it has sold, and
 * open it.
 *
 * Shift reports and per-session reconciliation land here in a later release.
 * What is here now is the minimum an owner needs on day one — proof that
 * in-person sales are arriving, and the switch that lets them arrive.
 */
export function AdminPosPage({ className }: AdminPosPageProps) {
  const { db } = useCaspianFirebase();
  const { settings, save: saveScriptSettings } = useScriptSettings();
  const Link = useCaspianLink();
  const t = useT();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [posSettings, setPosSettings] = useState<PosSettings | null>(null);
  const [savingFlag, setSavingFlag] = useState(false);

  const posEnabled = Boolean(settings.features?.pos || settings.features?.posOnly);
  const posOnly = Boolean(settings.features?.posOnly);

  useEffect(() => {
    let alive = true;
    listPosOrders(db)
      .then((list) => {
        if (alive) setOrders(list);
      })
      .catch((error) => {
        reportServiceError(db, 'admin-pos-page.orders', error);
        if (alive) setOrders([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (alive) setPosSettings({ ...DEFAULT_POS_SETTINGS, ...(s?.pos ?? {}) });
      })
      .catch((error) => {
        reportServiceError(db, 'admin-pos-page.settings', error);
        if (alive) setPosSettings(DEFAULT_POS_SETTINGS);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const totals = useMemo(() => {
    const list = orders ?? [];
    return {
      count: list.length,
      revenue: list.reduce((sum, o) => sum + (o.total ?? 0), 0),
    };
  }, [orders]);

  const toggleFlag = async (key: 'pos' | 'posOnly', value: boolean) => {
    setSavingFlag(true);
    try {
      await saveScriptSettings({
        features: {
          ...settings.features,
          [key]: value,
          // Turning on register-only implies the register itself; otherwise a
          // store would switch its storefront off and have nothing at all.
          ...(key === 'posOnly' && value ? { pos: true } : {}),
        },
      });
    } catch (error) {
      reportServiceError(db, 'admin-pos-page.toggle', error);
    } finally {
      setSavingFlag(false);
    }
  };

  const savePosSettings = async (patch: Partial<PosSettings>) => {
    const next = { ...(posSettings ?? DEFAULT_POS_SETTINGS), ...patch };
    setPosSettings(next);
    try {
      const current = await getSiteSettings(db);
      await saveSiteSettings(db, { ...(current ?? {}), pos: next } as never);
    } catch (error) {
      reportServiceError(db, 'admin-pos-page.savePos', error);
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.pos.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.pos.subtitle')}</p>
      </header>

      <section style={card}>
        <div style={switchRow}>
          <div>
            <strong>{t('admin.pos.enable')}</strong>
            <div style={hint}>{t('admin.pos.enableHelp')}</div>
          </div>
          <Switch
            checked={posEnabled}
            disabled={savingFlag || posOnly}
            onChange={(value) => void toggleFlag('pos', value)}
          />
        </div>

        <div style={switchRow}>
          <div>
            <strong>{t('admin.pos.posOnly')}</strong>
            <div style={hint}>{t('admin.pos.posOnlyHelp')}</div>
          </div>
          <Switch
            checked={posOnly}
            disabled={savingFlag}
            onChange={(value) => void toggleFlag('posOnly', value)}
          />
        </div>

        {posEnabled ? (
          <div>
            <Link href="/pos">
              <Button>{t('admin.pos.open')}</Button>
            </Link>
          </div>
        ) : null}
      </section>

      {posSettings ? (
        <section style={card}>
          <strong>{t('admin.pos.receiptSettings')}</strong>
          <label style={fieldRow}>
            <span style={hint}>{t('admin.pos.receiptHeader')}</span>
            <textarea
              rows={3}
              value={posSettings.receiptHeader}
              onChange={(e) => setPosSettings({ ...posSettings, receiptHeader: e.target.value })}
              onBlur={(e) => void savePosSettings({ receiptHeader: e.target.value })}
              style={textarea}
            />
          </label>
          <label style={fieldRow}>
            <span style={hint}>{t('admin.pos.receiptFooter')}</span>
            <textarea
              rows={2}
              value={posSettings.receiptFooter}
              onChange={(e) => setPosSettings({ ...posSettings, receiptFooter: e.target.value })}
              onBlur={(e) => void savePosSettings({ receiptFooter: e.target.value })}
              style={textarea}
            />
          </label>
        </section>
      ) : null}

      <AdminPosLicenses />

      <section style={card}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Stat label={t('admin.pos.recentSales')} value={String(totals.count)} />
          <Stat label={t('admin.pos.recentRevenue')} value={totals.revenue.toFixed(2)} />
        </div>
      </section>

      {orders === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : orders.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>{t('admin.pos.noSales')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.pos.col.receipt')}</TH>
              <TH>{t('admin.pos.col.date')}</TH>
              <TH>{t('admin.pos.col.items')}</TH>
              <TH>{t('admin.pos.col.payment')}</TH>
              <TH>{t('admin.pos.col.total')}</TH>
            </TR>
          </THead>
          <TBody>
            {orders.map((order) => (
              <TR key={order.id}>
                <TD>
                  <Link href={`/admin/orders/${order.id}`}>{order.receiptNumber || order.id}</Link>
                </TD>
                <TD style={{ fontSize: 13, color: '#666' }}>
                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : '—'}
                </TD>
                <TD>{order.items?.length ?? 0}</TD>
                <TD>
                  <Badge variant="outline">{order.payment?.method ?? '—'}</Badge>
                  {order.stockShortfall?.length ? (
                    <span style={{ marginInlineStart: 6 }}>
                      <Badge variant="secondary">{t('admin.pos.stockWarning')}</Badge>
                    </span>
                  ) : null}
                </TD>
                <TD style={{ fontWeight: 600 }}>{order.total?.toFixed(2)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 'var(--caspian-radius, 12px)',
  padding: 16,
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const switchRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
};

const fieldRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

const hint: React.CSSProperties = { fontSize: 12, color: '#666' };

const textarea: React.CSSProperties = {
  padding: 8,
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 'var(--caspian-radius, 6px)',
  fontSize: 14,
  fontFamily: 'inherit',
  resize: 'vertical',
};
