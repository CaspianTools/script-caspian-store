'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { deleteLocalProduct, listLocalProducts, saveLocalProducts } from '../local-db';
import type { LocalProduct } from '../types';
import {
  LOCAL_PRODUCT_COLUMNS,
  localProductTemplateCsv,
  localProductsToCsv,
  planLocalProductImport,
} from '../local-csv';
import { saveTextFile } from '../local-backup';
import { LocalProductFormDialog } from './local-product-form-dialog';
import { danger, fieldLabel, muted, row, section } from './panel-styles';

/**
 * The catalogue on a standalone till.
 *
 * The add/edit form has moved to a dialog (opened from Quick Add or the Store
 * page). This panel keeps CSV import and the product list so a shop can set up
 * in bulk and then tweak individual rows.
 */
export function LocalProductsPanel() {
  const t = useT();
  const { toast } = useToast();
  const [products, setProducts] = useState<LocalProduct[] | null>(null);
  const [search, setSearch] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocalProduct | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setProducts(await listLocalProducts());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEdit = (product: LocalProduct) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const plan = planLocalProductImport(text, products ?? []);
    setImportErrors(
      plan.errors.map((e) => t('pos.admin.products.importError', { line: e.line, message: e.message })),
    );
    if (plan.rows.length) {
      await saveLocalProducts(plan.rows.map((r) => r.product));
      await refresh();
    }
    toast({
      title: t('pos.admin.products.imported', {
        added: plan.rows.filter((r) => !r.updates).length,
        updated: plan.rows.filter((r) => r.updates).length,
        skipped: plan.errors.length,
      }),
    });
  };

  const remove = async (product: LocalProduct) => {
    if (!window.confirm(t('pos.admin.products.confirmDelete', { name: product.name }))) return;
    await deleteLocalProduct(product.id);
    await refresh();
  };

  const visible = (products ?? []).filter((p) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      p.nameLower.includes(needle) ||
      p.sku.toLowerCase().includes(needle) ||
      p.barcode.toLowerCase().includes(needle)
    );
  });

  return (
    <div>
      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.products.fileTitle')}</span>
        <FieldDescription>{t('pos.admin.products.fileHelp')}</FieldDescription>
        <div style={row}>
          <Button
            variant="outline"
            onClick={() => saveTextFile('caspian-catalogue-template.csv', localProductTemplateCsv(), 'text/csv')}
          >
            {t('pos.admin.products.template')}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              saveTextFile('caspian-catalogue.csv', localProductsToCsv(products ?? []), 'text/csv')
            }
          >
            {t('pos.admin.products.export')}
          </Button>
          <Button onClick={() => fileInput.current?.click()}>{t('pos.admin.products.import')}</Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onImportFile(file);
            }}
          />
        </div>
        {importErrors.length ? (
          <ul style={{ ...danger, margin: 0, paddingInlineStart: 18 }}>
            {importErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <div style={muted}>
          {t('pos.admin.products.columns', {
            columns: LOCAL_PRODUCT_COLUMNS.map((c) => c.header).join(', '),
          })}
        </div>
      </section>

      <section style={section}>
        <div style={row}>
          <span style={fieldLabel}>
            {t('pos.admin.products.listTitle', { count: products?.length ?? 0 })}
          </span>
          <Input
            style={{ marginInlineStart: 'auto', maxWidth: 240 }}
            value={search}
            placeholder={t('pos.admin.products.search')}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                <TH>{t('pos.admin.products.stock')}</TH>
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
                  <TD>
                    {Object.entries(p.stock)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(' ') || '—'}
                  </TD>
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
