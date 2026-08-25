'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { TruckIcon } from '../../../ui/icons';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Dialog } from '../../../ui/dialog';
import { useToast } from '../../../ui/toast';
import {
  deleteLocalSupplier,
  listLocalStockReceipts,
  listLocalSuppliers,
  makeLocalSupplier,
  saveLocalSupplier,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import type { LocalStockReceipt, LocalSupplier } from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { PanelLoadError } from './panel-load-error';
import { field, fieldLabel, row } from './panel-styles';

const BLANK = { name: '', contactName: '', phone: '', email: '', address: '', note: '' };

/**
 * Who the shop buys from.
 *
 * A supplier is picked on a delivery and its name frozen onto the lots that
 * arrive, so this list is a convenience rather than a source of truth for
 * history. That is why disabling is offered before deleting: the paperwork
 * still names them either way, but a disabled one stops cluttering the picker.
 */
export function LocalSuppliersPanel() {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const mayEdit = can(session.user?.role, 'store.edit');

  const [suppliers, setSuppliers] = useState<LocalSupplier[] | null>(null);
  const [receipts, setReceipts] = useState<LocalStockReceipt[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocalSupplier | null>(null);
  const [draft, setDraft] = useState(BLANK);

  const refresh = useCallback(async () => {
    try {
      const [rows, receiptRows] = await Promise.all([listLocalSuppliers(), listLocalStockReceipts()]);
      setSuppliers(rows);
      setReceipts(receiptRows);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** How much each supplier has delivered, off the posted receipts. */
  const activity = useMemo(() => {
    const out = new Map<string, { deliveries: number; total: number; lastAtMillis: number }>();
    for (const receipt of receipts) {
      if (!receipt.supplierId) continue;
      const current = out.get(receipt.supplierId) ?? { deliveries: 0, total: 0, lastAtMillis: 0 };
      out.set(receipt.supplierId, {
        deliveries: current.deliveries + 1,
        total: current.total + receipt.totalCost,
        lastAtMillis: Math.max(current.lastAtMillis, receipt.receivedAtMillis),
      });
    }
    return out;
  }, [receipts]);

  const startAdd = () => {
    setEditing(null);
    setDraft(BLANK);
    setDialogOpen(true);
  };

  const startEdit = (supplier: LocalSupplier) => {
    setEditing(supplier);
    setDraft({
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      note: supplier.note,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast({ title: t('pos.store.supplier.needsName'), variant: 'destructive' });
      return;
    }
    await saveLocalSupplier(makeLocalSupplier({ ...(editing ?? {}), ...draft }));
    setDialogOpen(false);
    await refresh();
    toast({ title: t('pos.store.supplier.saved') });
  };

  const toggle = async (supplier: LocalSupplier) => {
    await saveLocalSupplier({ ...supplier, isActive: !supplier.isActive, updatedAtMillis: Date.now() });
    await refresh();
  };

  const remove = async (supplier: LocalSupplier) => {
    const delivered = activity.get(supplier.id)?.deliveries ?? 0;
    if (delivered) {
      // Deleting one that has delivered would leave its receipts naming a
      // supplier the shop can no longer look up. Disabling does the job.
      toast({ title: t('pos.store.supplier.deleteBlocked'), variant: 'destructive' });
      return;
    }
    if (!window.confirm(t('pos.store.supplier.confirmDelete', { name: supplier.name }))) return;
    await deleteLocalSupplier(supplier.id);
    await refresh();
  };

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <TruckIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.store.supplier.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.store.supplier.subtitle')}</p>
        </span>
      </div>

      <StoreScreenNav current="suppliers" />

      <section className="cpos-section">
        <div className="cpos-row" style={{ alignItems: 'center' }}>
          <span className="cpos-section__title">
            {t('pos.store.supplier.listTitle', { count: suppliers?.length ?? 0 })}
          </span>
          {mayEdit ? (
            <div style={{ marginInlineStart: 'auto' }}>
              <Button onClick={startAdd}>{t('pos.store.supplier.add')}</Button>
            </div>
          ) : null}
        </div>

        {loadFailed ? (
          <PanelLoadError onRetry={() => void refresh()} />
        ) : suppliers === null ? (
          <div className="cpos-muted">{t('common.loading')}</div>
        ) : suppliers.length === 0 ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon cpos-empty__icon--neutral">
              <TruckIcon size={22} />
            </span>
            <p className="cpos-empty__title">{t('pos.store.supplier.empty')}</p>
            <p className="cpos-empty__text">{t('pos.store.supplier.emptyHelp')}</p>
          </div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.store.supplier.name')}</th>
                  <th>{t('pos.store.supplier.contact')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.deliveries')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.spent')}</th>
                  <th>{t('pos.store.supplier.last')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const stats = activity.get(supplier.id);
                  return (
                    <tr key={supplier.id}>
                      <td>
                        {supplier.name}
                        {supplier.isActive ? null : (
                          <span className="cpos-muted"> · {t('pos.store.supplier.disabled')}</span>
                        )}
                      </td>
                      <td>
                        {[supplier.contactName, supplier.phone, supplier.email]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                      <td className="cpos-table__num">{stats?.deliveries ?? 0}</td>
                      <td className="cpos-table__num">
                        {formatLocalMoney(stats?.total ?? 0, settings.currency)}
                      </td>
                      <td>
                        {stats?.lastAtMillis
                          ? new Date(stats.lastAtMillis).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {mayEdit ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => startEdit(supplier)}>
                                {t('common.edit')}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => void toggle(supplier)}>
                                {t(
                                  supplier.isActive
                                    ? 'pos.store.supplier.disable'
                                    : 'pos.store.supplier.enable',
                                )}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void remove(supplier)}
                              >
                                {t('common.delete')}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('pos.store.supplier.editTitle') : t('pos.store.supplier.add')}
        maxWidth={560}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()}>{t('common.save')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={row}>
            <div style={{ ...field, flex: '2 1 200px' }}>
              <label style={fieldLabel}>{t('pos.store.supplier.name')}</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div style={{ ...field, flex: '1 1 160px' }}>
              <label style={fieldLabel}>{t('pos.store.supplier.contact')}</label>
              <Input
                value={draft.contactName}
                onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
              />
            </div>
          </div>
          <div style={row}>
            <div style={{ ...field, flex: '1 1 140px' }}>
              <label style={fieldLabel}>{t('pos.store.supplier.phone')}</label>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
            <div style={{ ...field, flex: '2 1 200px' }}>
              <label style={fieldLabel}>{t('pos.store.supplier.email')}</label>
              <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
          </div>
          <div style={field}>
            <label style={fieldLabel}>{t('pos.store.supplier.address')}</label>
            <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </div>
          <div style={field}>
            <label style={fieldLabel}>{t('pos.store.adjust.note')}</label>
            <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
