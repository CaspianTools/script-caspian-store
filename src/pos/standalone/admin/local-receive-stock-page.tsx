'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { InboxIcon, ScanIcon, SearchIcon, TrashIcon } from '../../../ui/icons';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select } from '../../../ui/select';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { cn } from '../../../utils/cn';
import { useCaspianNavigation } from '../../../provider/caspian-store-provider';
import { DEFAULT_SCAN_GAP_MS, useBarcodeScanner } from '../../hardware/use-barcode-scanner';
import { readScannerGapMs } from '../../pos-preferences';
import { getPosDeviceLabel } from '../../pos-device';
import {
  discardLocalStockReceiptDraft,
  getLocalProduct,
  listLocalProducts,
  listLocalSuppliers,
  lookupLocalProductByCode,
  newLocalId,
  postLocalStockReceipt,
  readLocalStockReceiptDraft,
  writeLocalStockReceiptDraft,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosShopSettings } from '../shop-settings-context';
import { DEFAULT_SIZE_KEY, receiptTotals } from '../lot-allocation';
import type {
  LocalProduct,
  LocalStockReceipt,
  LocalStockReceiptLine,
  LocalSupplier,
} from '../types';
import { LocalProductFormDialog } from './local-product-form-dialog';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { field, fieldLabel } from './panel-styles';

type Mode = 'scan' | 'manual';

function blankReceipt(userId: string, userName: string): LocalStockReceipt {
  return {
    id: newLocalId(),
    reference: '',
    supplierId: '',
    supplierName: '',
    lines: [],
    receivedAtMillis: Date.now(),
    userId,
    userName,
    note: '',
    totalCost: 0,
    status: 'draft',
  };
}

/**
 * Take a delivery in.
 *
 * Two ways in, because a shop has two situations. A storekeeper with a scanner
 * and forty boxes wants to scan, and a scan of something the till has never
 * seen has to become a product there and then rather than sending them to
 * another screen and back. An owner working off a supplier's invoice with no
 * scanner in reach wants to search and type.
 *
 * Nothing moves until Confirm. Up to that point this is a draft on disk, so a
 * dropped tab half-way through a delivery does not mean starting again.
 */
export function LocalReceiveStockPage() {
  const t = useT();
  const { toast } = useToast();
  const { push, searchParams } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { settings } = usePosShopSettings();

  const [mode, setMode] = useState<Mode>('scan');
  const [receipt, setReceipt] = useState<LocalStockReceipt | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [suppliers, setSuppliers] = useState<LocalSupplier[]>([]);
  const [scanGapMs, setScanGapMs] = useState(DEFAULT_SCAN_GAP_MS);
  const [manualCode, setManualCode] = useState('');
  const [search, setSearch] = useState('');
  const [scanNote, setScanNote] = useState('');
  const [newProductBarcode, setNewProductBarcode] = useState('');
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /**
   * Held in a ref as well as state because the scanner's `onScan` is called
   * from a `document` listener installed once: reading the draft off state
   * inside it would add a line to whatever the draft was when the listener was
   * built, and the second scan of a delivery would erase the first.
   */
  const receiptRef = useRef<LocalStockReceipt | null>(null);
  receiptRef.current = receipt;

  const reload = useCallback(async () => {
    const [rows, supplierRows, draft] = await Promise.all([
      listLocalProducts(),
      settings.suppliersEnabled ? listLocalSuppliers() : Promise.resolve([]),
      readLocalStockReceiptDraft(),
    ]);
    setProducts(rows);
    setSuppliers(supplierRows.filter((s) => s.isActive));
    setReceipt(
      draft ?? blankReceipt(session.user?.id ?? '', session.user?.displayName ?? ''),
    );
  }, [settings.suppliersEnabled, session.user?.id, session.user?.displayName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Read after mount, like the register does: the scanner gap is a device
  // preference in localStorage, and reading it during render would disagree
  // with the server's idea of the first paint.
  useEffect(() => {
    setScanGapMs(readScannerGapMs());
  }, []);

  /** Persist every change, so the draft survives a reload mid-delivery. */
  const update = useCallback((next: LocalStockReceipt) => {
    setReceipt(next);
    receiptRef.current = next;
    void writeLocalStockReceiptDraft(next).catch(() => {
      /* A till with site data blocked still receives; it just cannot resume. */
    });
  }, []);

  const addLine = useCallback(
    (product: LocalProduct, quantity = 1) => {
      const current = receiptRef.current;
      if (!current) return;
      const sizeKey = product.sizes[0] ?? DEFAULT_SIZE_KEY;
      const existing = current.lines.findIndex(
        (line) => line.productId === product.id && line.sizeKey === sizeKey,
      );
      // A second scan of the same box is one more of it, not a second line.
      // That is the whole reason a storekeeper scans rather than types.
      const lines =
        existing >= 0
          ? current.lines.map((line, index) =>
              index === existing ? { ...line, quantity: line.quantity + quantity } : line,
            )
          : [
              ...current.lines,
              {
                productId: product.id,
                productName: product.name,
                sizeKey,
                quantity,
                unitCost: product.costPrice,
                lotCode: '',
                expiresOn: '',
                note: '',
              } satisfies LocalStockReceiptLine,
            ];
      update({ ...current, lines });
    },
    [update],
  );

  const handleCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      const found = await lookupLocalProductByCode(trimmed);
      if (found) {
        addLine(found);
        setScanNote(t('pos.store.receive.added', { name: found.name }));
        setManualCode('');
        return;
      }
      // Nothing matches. Rather than a dead end, this is how a shop gets a new
      // line onto its catalogue: the dialog opens with the code already in it.
      setNewProductBarcode(trimmed);
      setNewProductOpen(true);
      setScanNote(t('pos.store.receive.unknown', { code: trimmed }));
      setManualCode('');
    },
    [addLine, t],
  );

  const scanner = useBarcodeScanner({
    onScan: (code) => void handleCode(code),
    gapMs: scanGapMs,
    disabled: mode !== 'scan',
  });

  // Arriving from a product page's Receive button: that item is already the one
  // the storekeeper meant, so it is on the delivery before they touch anything.
  const seeded = useRef(false);
  useEffect(() => {
    const wanted = searchParams?.get('product');
    if (!wanted || !receipt || seeded.current) return;
    seeded.current = true;
    void getLocalProduct(wanted).then((found) => {
      if (found) {
        addLine(found);
        setMode('manual');
      }
    });
  }, [searchParams, receipt, addLine]);

  const setLine = (index: number, patch: Partial<LocalStockReceiptLine>) => {
    if (!receipt) return;
    update({
      ...receipt,
      lines: receipt.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    });
  };

  const removeLine = (index: number) => {
    if (!receipt) return;
    update({ ...receipt, lines: receipt.lines.filter((_, i) => i !== index) });
  };

  const totals = useMemo(() => receiptTotals(receipt?.lines ?? []), [receipt?.lines]);
  const money = (amount: number) => formatLocalMoney(amount, settings.currency);

  const post = async () => {
    if (!receipt || !receipt.lines.length) return;
    setPosting(true);
    try {
      const posted = await postLocalStockReceipt({
        ...receipt,
        receivedAtMillis: Date.now(),
        userId: session.user?.id ?? '',
        userName: session.user?.displayName ?? '',
        supplierName: suppliers.find((s) => s.id === receipt.supplierId)?.name ?? '',
      });
      toast({
        title: t('pos.store.receive.posted', {
          units: totals.unitCount,
          lines: posted.lines.length,
        }),
      });
      const fresh = blankReceipt(session.user?.id ?? '', session.user?.displayName ?? '');
      setReceipt(fresh);
      receiptRef.current = fresh;
      setScanNote('');
      await listLocalProducts().then(setProducts);
    } catch {
      toast({ title: t('pos.store.receive.failed'), variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const discard = async () => {
    if (!receipt) return;
    if (!window.confirm(t('pos.store.receive.confirmDiscard'))) return;
    await discardLocalStockReceiptDraft(receipt.id);
    const fresh = blankReceipt(session.user?.id ?? '', session.user?.displayName ?? '');
    setReceipt(fresh);
    receiptRef.current = fresh;
    setScanNote('');
  };

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return products
      .filter(
        (p) =>
          p.nameLower.includes(needle) ||
          p.sku.toLowerCase().includes(needle) ||
          p.barcode.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [products, search]);

  if (!receipt) {
    return (
      <div className="cpos-page">
        <div className="cpos-muted">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="cpos-page cpos-page--wide">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <InboxIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.store.receive.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.store.receive.subtitle')}</p>
        </span>
      </div>

      <StoreScreenNav current="receive" />

      <section className="cpos-section">
        <div className="cpos-segmented" role="group" aria-label={t('pos.store.receive.howTitle')}>
          {(['scan', 'manual'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={cn('cpos-segmented__btn', mode === value && 'cpos-segmented__btn--on')}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              <span className="cpos-segmented__icon">
                {value === 'scan' ? <ScanIcon size={16} /> : <SearchIcon size={16} />}
              </span>
              <span>{t(value === 'scan' ? 'pos.store.receive.byScan' : 'pos.store.receive.byHand')}</span>
            </button>
          ))}
        </div>

        {mode === 'scan' ? (
          <>
            <form
              className="cpos-row"
              onSubmit={(e) => {
                e.preventDefault();
                scanner.submitManual(manualCode);
              }}
            >
              <div style={{ ...field, flex: '2 1 260px' }}>
                <label style={fieldLabel}>{t('pos.scan.title')}</label>
                <Input
                  value={manualCode}
                  placeholder={t('pos.scan.placeholder')}
                  onChange={(e) => setManualCode(e.target.value)}
                />
              </div>
              <Button type="submit">{t('pos.store.receive.addCode')}</Button>
              {scanner.cameraSupported ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (scanner.cameraActive ? scanner.stopCamera() : scanner.startCamera())}
                >
                  {t(scanner.cameraActive ? 'pos.scan.cameraStop' : 'pos.scan.camera')}
                </Button>
              ) : null}
            </form>
            <FieldDescription>{t('pos.store.receive.scanHelp')}</FieldDescription>
            {scanner.cameraActive ? (
              <video
                ref={scanner.videoRef}
                playsInline
                muted
                style={{ width: '100%', maxWidth: 420, borderRadius: 'var(--cpos-r-md, 12px)' }}
              />
            ) : null}
            {scanNote ? <div className="cpos-note cpos-note--brand">{scanNote}</div> : null}
          </>
        ) : (
          <>
            <div style={field}>
              <label style={fieldLabel}>{t('pos.store.receive.find')}</label>
              <Input
                value={search}
                placeholder={t('pos.admin.products.search')}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {matches.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {matches.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      addLine(p);
                      setSearch('');
                    }}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setNewProductBarcode('');
                  setNewProductOpen(true);
                }}
              >
                {t('pos.store.receive.newProduct')}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.receive.paperwork')}</h2>
        <div className="cpos-row">
          <div style={{ ...field, flex: '1 1 180px' }}>
            <label style={fieldLabel}>{t('pos.store.receive.reference')}</label>
            <Input
              value={receipt.reference}
              placeholder={t('pos.store.receive.referencePlaceholder')}
              onChange={(e) => update({ ...receipt, reference: e.target.value })}
            />
          </div>
          {settings.suppliersEnabled ? (
            <div style={{ ...field, flex: '1 1 200px' }}>
              <label style={fieldLabel}>{t('pos.store.supplier.one')}</label>
              <Select
                value={receipt.supplierId}
                onChange={(e) => update({ ...receipt, supplierId: e.target.value })}
                options={[
                  { value: '', label: t('pos.store.receive.noSupplier') },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          ) : null}
          <div style={{ ...field, flex: '2 1 220px' }}>
            <label style={fieldLabel}>{t('pos.store.adjust.note')}</label>
            <Input value={receipt.note} onChange={(e) => update({ ...receipt, note: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">
          {t('pos.store.receive.lines', { count: receipt.lines.length })}
        </h2>

        {receipt.lines.length === 0 ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon cpos-empty__icon--neutral">
              <InboxIcon size={22} />
            </span>
            <p className="cpos-empty__title">{t('pos.store.receive.emptyTitle')}</p>
            <p className="cpos-empty__text">{t('pos.store.receive.emptyHelp')}</p>
          </div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.admin.products.name')}</th>
                  <th>{t('pos.admin.products.sizes')}</th>
                  <th className="cpos-table__num">{t('pos.store.adjust.quantity')}</th>
                  <th className="cpos-table__num">{t('pos.store.receive.unitCost')}</th>
                  {settings.lotTrackingEnabled ? <th>{t('pos.store.lot.code')}</th> : null}
                  {settings.lotTrackingEnabled ? <th>{t('pos.store.lot.expires')}</th> : null}
                  <th className="cpos-table__num">{t('pos.store.receive.lineTotal')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((line, index) => {
                  const product = productsById.get(line.productId);
                  const tracks = product?.tracksLots ?? false;
                  return (
                    <tr key={`${line.productId}-${line.sizeKey}-${index}`}>
                      <td>{line.productName}</td>
                      <td>
                        {product && product.sizes.length ? (
                          <Select
                            value={line.sizeKey}
                            onChange={(e) => setLine(index, { sizeKey: e.target.value })}
                            options={product.sizes.map((s) => ({ value: s, label: s }))}
                          />
                        ) : (
                          t('pos.store.product.noSize')
                        )}
                      </td>
                      <td className="cpos-table__num">
                        <Input
                          value={String(line.quantity)}
                          inputMode="numeric"
                          style={{ maxWidth: 88 }}
                          onChange={(e) => setLine(index, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="cpos-table__num">
                        <Input
                          value={String(line.unitCost)}
                          inputMode="decimal"
                          style={{ maxWidth: 96 }}
                          onChange={(e) => setLine(index, { unitCost: Number(e.target.value) || 0 })}
                        />
                      </td>
                      {settings.lotTrackingEnabled ? (
                        <td>
                          {tracks ? (
                            <Input
                              value={line.lotCode}
                              style={{ maxWidth: 120 }}
                              onChange={(e) => setLine(index, { lotCode: e.target.value })}
                            />
                          ) : (
                            <span className="cpos-muted">{t('pos.store.lot.notTracked')}</span>
                          )}
                        </td>
                      ) : null}
                      {settings.lotTrackingEnabled ? (
                        <td>
                          {tracks ? (
                            <Input
                              type="date"
                              value={line.expiresOn}
                              style={{ maxWidth: 150 }}
                              onChange={(e) => setLine(index, { expiresOn: e.target.value })}
                            />
                          ) : null}
                        </td>
                      ) : null}
                      <td className="cpos-table__num">{money(line.quantity * line.unitCost)}</td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                          <TrashIcon size={15} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="cpos-stats">
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.receive.units')}</span>
            <span className="cpos-stat__value">{totals.unitCount}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.receive.total')}</span>
            <span className="cpos-stat__value">{money(totals.totalCost)}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.receive.till')}</span>
            <span className="cpos-stat__value" style={{ fontSize: 16 }}>
              {getPosDeviceLabel()}
            </span>
          </div>
        </div>

        <div className="cpos-actions">
          <Button variant="outline" onClick={() => push('/pos/store')}>
            {t('common.cancel')}
          </Button>
          {receipt.lines.length ? (
            <Button variant="destructive" onClick={() => void discard()}>
              {t('pos.store.receive.discard')}
            </Button>
          ) : null}
          <Button disabled={posting || !receipt.lines.length} onClick={() => void post()}>
            {t('pos.store.receive.confirm')}
          </Button>
        </div>
        <FieldDescription>{t('pos.store.receive.confirmHelp')}</FieldDescription>
      </section>

      <LocalProductFormDialog
        open={newProductOpen}
        onOpenChange={setNewProductOpen}
        initialBarcode={newProductBarcode}
        onSaved={(saved) => {
          setProducts((rows) => [...rows, saved]);
          addLine(saved);
          setScanNote(t('pos.store.receive.added', { name: saved.name }));
        }}
      />
    </div>
  );
}
