'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { deleteLocalProduct, listLocalProducts } from '../local-db';
import type { LocalProduct } from '../types';
import { LocalProductFormDialog } from './local-product-form-dialog';
import { fieldLabel, muted, row, section } from './panel-styles';

/**
 * Storekeeper inventory page.
 *
 * Products live here rather than on the back-office Items tab. The list is
 * stock-centric and the add/edit form opens in a dialog.
 */
export function LocalStorePanel() {
  const t = useT();
  const [products, setProducts] = useState<LocalProduct[] | null>(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocalProduct | null>(null);

  const refresh = useCallback(async () => {
    setProducts(await listLocalProducts());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalStock = (p: LocalProduct) =>
    (Object.values(p.stock) as number[]).reduce((a, b) => a + b, 0);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (!needle) return true;
      return (
        p.nameLower.includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        p.barcode.toLowerCase().includes(needle)
      );
    });
  }, [products, search]);

  const startAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const startEdit = (p: LocalProduct) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const remove = async (p: LocalProduct) => {
    if (!window.confirm(t('pos.admin.products.confirmDelete', { name: p.name }))) return;
    await deleteLocalProduct(p.id);
    await refresh();
  };

  return (
    <div>
      <section style={section}>
        <div style={row}>
          <span style={fieldLabel}>{t('pos.admin.products.listTitle', { count: products?.length ?? 0 })}</span>
          <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
            <Input
              style={{ maxWidth: 240 }}
              value={search}
              placeholder={t('pos.admin.products.search')}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button onClick={startAdd}>{t('pos.store.addTitle')}</Button>
          </div>
        </div>

        {products === null ? (
          <div style={muted}>{t('common.loading')}</div>
        ) : visible.length === 0 ? (
          <div style={muted}>{t('pos.admin.products.empty')}</div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('pos.admin.products.name')}</TH>
                <TH>{t('pos.admin.products.barcode')}</TH>
                <TH>{t('pos.admin.products.price')}</TH>
                <TH>{t('pos.store.totalStock')}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {visible.map((p) => (
                <TR key={p.id}>
                  <TD>
                    {p.name}
                    {p.isActive ? null : <span style={muted}> · {t('pos.admin.products.hidden')}</span>}
                  </TD>
                  <TD style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{p.barcode}</TD>
                  <TD>{p.price.toFixed(2)}</TD>
                  <TD>{totalStock(p)}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Button variant="outline" onClick={() => startEdit(p)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="destructive" onClick={() => void remove(p)}>
                        {t('common.delete')}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <LocalProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSaved={refresh}
      />
    </div>
  );
}
