'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import {
  deleteLocalProduct,
  listLocalProducts,
  makeLocalProduct,
  saveLocalProduct,
  saveLocalProducts,
} from '../local-db';
import {
  LOCAL_PRODUCT_COLUMNS,
  localProductTemplateCsv,
  localProductsToCsv,
  planLocalProductImport,
} from '../local-csv';
import { saveTextFile } from '../local-backup';
import type { LocalProduct } from '../types';
import { actions, danger, field, fieldLabel, muted, row, section } from './panel-styles';

const BLANK = { name: '', price: '', sku: '', barcode: '', category: '', sizes: '', stock: '' };

/**
 * The catalogue on a standalone till.
 *
 * Editing and importing sit on one screen because a shop setting up a till does
 * both in the same ten minutes: import the spreadsheet, then fix the six rows
 * that came out wrong. Splitting them across two pages only adds navigation to
 * a job that is already fiddly.
 */
export function LocalProductsPanel() {
  const t = useT();
  const { toast } = useToast();
  const [products, setProducts] = useState<LocalProduct[] | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(BLANK);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setProducts(await listLocalProducts());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEdit = (product: LocalProduct) => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      price: String(product.price),
      sku: product.sku,
      barcode: product.barcode,
      category: product.category,
      sizes: product.sizes.join(';'),
      stock: Object.entries(product.stock)
        .map(([k, v]) => `${k}:${v}`)
        .join(';'),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(BLANK);
  };

  const save = async () => {
    const price = Number(draft.price);
    if (!draft.name.trim() || !Number.isFinite(price) || price < 0) {
      toast({ title: t('pos.admin.products.invalid') });
      return;
    }
    const stock: Record<string, number> = {};
    for (const part of draft.stock.split(/[;,]/)) {
      const [size, qty] = part.split(':');
      if (size?.trim() && Number.isFinite(Number(qty))) stock[size.trim()] = Number(qty);
    }
    const existing = editingId ? products?.find((p) => p.id === editingId) : undefined;
    await saveLocalProduct(
      makeLocalProduct({
        ...(existing ?? {}),
        ...(editingId ? { id: editingId } : {}),
        name: draft.name,
        price,
        sku: draft.sku,
        barcode: draft.barcode,
        category: draft.category,
        sizes: draft.sizes.split(/[;,]/).map((s) => s.trim()).filter(Boolean),
        stock,
      }),
    );
    cancelEdit();
    await refresh();
    toast({ title: t('pos.admin.products.saved') });
  };

  const remove = async (product: LocalProduct) => {
    // Deleting a product does not touch sales that referenced it: those lines
    // froze their own name and price at commit, so last week's receipt still
    // reads correctly after the item leaves the catalogue.
    if (!window.confirm(t('pos.admin.products.confirmDelete', { name: product.name }))) return;
    await deleteLocalProduct(product.id);
    if (editingId === product.id) cancelEdit();
    await refresh();
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const plan = planLocalProductImport(text, products ?? []);
    setImportErrors(plan.errors.map((e) => t('pos.admin.products.importError', { line: e.line, message: e.message })));
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
        <span style={fieldLabel}>
          {editingId ? t('pos.admin.products.editTitle') : t('pos.admin.products.addTitle')}
        </span>
        <div style={row}>
          <div style={{ ...field, flex: '2 1 180px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.name')}</label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div style={{ ...field, flex: '1 1 100px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.price')}</label>
            <Input
              value={draft.price}
              inputMode="decimal"
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.barcode')}</label>
            <Input
              value={draft.barcode}
              onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 100px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.sku')}</label>
            <Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
          </div>
        </div>
        <div style={row}>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.category')}</label>
            <Input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.sizes')}</label>
            <Input
              value={draft.sizes}
              placeholder="S;M;L"
              onChange={(e) => setDraft({ ...draft, sizes: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 140px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.stock')}</label>
            <Input
              value={draft.stock}
              placeholder="_default:12"
              onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            />
          </div>
        </div>
        <FieldDescription>{t('pos.admin.products.stockHelp')}</FieldDescription>
        <div style={actions}>
          {editingId ? (
            <Button variant="outline" onClick={cancelEdit}>
              {t('common.cancel')}
            </Button>
          ) : null}
          <Button onClick={() => void save()}>
            {editingId ? t('pos.admin.products.update') : t('pos.admin.products.add')}
          </Button>
        </div>
      </section>

      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.products.fileTitle')}</span>
        <FieldDescription>{t('pos.admin.products.fileHelp')}</FieldDescription>
        <div style={actions}>
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
          <Button onClick={() => fileInput.current?.click()}>
            {t('pos.admin.products.import')}
          </Button>
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
    </div>
  );
}
