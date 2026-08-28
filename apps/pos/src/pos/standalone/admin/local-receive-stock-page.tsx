'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useT,
  useToast,
  FieldDescription,
  cn,
  useCaspianNavigation,
} from '@caspian-explorer/script-caspian-store';
import { InboxIcon, ScanIcon, SearchIcon, TrashIcon } from '../../../icons';
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
import { addReceiptLine, ensureReceiptLine, receiptTotals } from '../lot-allocation';
import type {
  LocalProduct,
  LocalStockReceipt,
  LocalStockReceiptLine,
  LocalSupplier,
} from '../types';
import { LocalProductFormDialog } from './local-product-form-dialog';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { PosSelect } from '../ui/pos-field';
import { usePosConfirm } from '../ui/pos-confirm';

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
  const confirm = usePosConfirm();
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

  /**
   * The delivery is established once, and the supplier list is loaded apart from
   * it.
   *
   * They used to be one `reload`, and that was a bug with teeth: its identity
   * depended on `settings.suppliersEnabled`, which starts false and flips true a
   * beat later when the shop record arrives, so it ran a second time and its
   * `setReceipt` overwrote whatever had been put on the delivery in between --
   * the item seeded from a product page, or a scan that arrived while the shop
   * record was still loading. A storekeeper would have watched a box they had
   * just scanned disappear.
   *
   * The seed happens inside this same pass rather than in an effect of its own,
   * so there is no second writer to race, and it is idempotent because the
   * register app mounts under StrictMode and every effect body runs twice.
   */
  const userId = session.user?.id ?? '';
  const userName = session.user?.displayName ?? '';
  const seedId = searchParams?.get('product') ?? '';

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [rows, draft, seedProduct] = await Promise.all([
        listLocalProducts(),
        readLocalStockReceiptDraft(),
        seedId ? getLocalProduct(seedId) : Promise.resolve(null),
      ]);
      if (!alive) return;

      setProducts(rows);
      let next = draft ?? blankReceipt(userId, userName);
      if (seedProduct) {
        next = { ...next, lines: ensureReceiptLine(next.lines, seedProduct) };
        // Nothing to scan for -- they already said which item this is about.
        setMode('manual');
      }
      setReceipt(next);
      receiptRef.current = next;
      if (seedProduct) {
        void writeLocalStockReceiptDraft(next).catch(() => {
          /* Site data blocked. The delivery still works; it cannot be resumed. */
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [seedId, userId, userName]);

  useEffect(() => {
    if (!settings.suppliersEnabled) {
      setSuppliers([]);
      return;
    }
    let alive = true;
    void listLocalSuppliers().then((rows) => {
      if (alive) setSuppliers(rows.filter((s) => s.isActive));
    });
    return () => {
      alive = false;
    };
  }, [settings.suppliersEnabled]);

  // Read after mount, like the register does: the scanner gap is a device
  // preference in localStorage, and reading it during render would disagree
  // with the server's idea of the first paint.
  useEffect(() => {
    setScanGapMs(readScannerGapMs());
  }, []);

  /**
   * Persist every change, so the draft survives a reload mid-delivery.
   *
   * Refuses to write once the delivery is being posted. `postLocalStockReceipt`
   * flips that row to `posted`, and a draft write landing after it would put a
   * `draft` row back under the same id -- a delivery already on the shelf,
   * offered again as unfinished work.
   */
  const postingRef = useRef(false);
  const update = useCallback((next: LocalStockReceipt) => {
    if (postingRef.current) return;
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
      update({ ...current, lines: addReceiptLine(current.lines, product, quantity) });
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
    // Off while the new-product dialog is open, and off while the delivery is
    // being posted. The hook silences itself for keystrokes whose target is
    // inside a `[role="dialog"]`, but a wedge fires at whatever has focus --
    // and after a scan that is the page, not the dialog it just opened. A
    // second box scanned at that moment wiped the half-typed form. Posting is
    // the same problem one step later: a scan landing mid-post would write the
    // receipt back to a draft after it had already gone on the shelf.
    disabled: mode !== 'scan' || newProductOpen || posting,
  });

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
    if (!receipt || !receipt.lines.length || postingRef.current) return;
    postingRef.current = true;
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
      setProducts(await listLocalProducts());
    } catch {
      toast({ title: t('pos.store.receive.failed'), variant: 'destructive' });
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  const discard = async () => {
    if (!receipt) return;
    const ok = await confirm({
      title: t('pos.store.receive.discardTitle'),
      body: t('pos.store.receive.confirmDiscard'),
      confirmLabel: t('pos.store.receive.discard'),
      tone: 'danger',
    });
    if (!ok) return;
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
              <div className="cpos-field" style={{ flex: '2 1 260px' }}>
                <span className="cpos-field__label">{t('pos.scan.title')}</span>
                <input className="cpos-input"
                  value={manualCode}
                  placeholder={t('pos.scan.placeholder')}
                  onChange={(e) => setManualCode(e.target.value)}
                />
              </div>
              <button type="submit" className="cpos-btn cpos-btn--primary">{t('pos.store.receive.addCode')}</button>
              {scanner.cameraSupported ? (
                <button
                  type="button"
                  className="cpos-btn cpos-btn--outline"
                  onClick={() => (scanner.cameraActive ? scanner.stopCamera() : scanner.startCamera())}>
                  {t(scanner.cameraActive ? 'pos.scan.cameraStop' : 'pos.scan.camera')}
                </button>
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
            <div className="cpos-field">
              <span className="cpos-field__label">{t('pos.store.receive.find')}</span>
              <input className="cpos-input"
                value={search}
                placeholder={t('pos.admin.products.search')}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {matches.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {matches.map((p) => (
                  <button
                    type="button"
                    className="cpos-btn cpos-btn--outline cpos-btn--sm"
                    key={p.id}
                    onClick={() => {
                      addLine(p);
                      setSearch('');
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="cpos-btn cpos-btn--outline"
                onClick={() => {
                  setNewProductBarcode('');
                  setNewProductOpen(true);
                }}>
                {t('pos.store.receive.newProduct')}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.receive.paperwork')}</h2>
        <div className="cpos-row">
          <div className="cpos-field" style={{ flex: '1 1 180px' }}>
            <span className="cpos-field__label">{t('pos.store.receive.reference')}</span>
            <input className="cpos-input"
              value={receipt.reference}
              placeholder={t('pos.store.receive.referencePlaceholder')}
              onChange={(e) => update({ ...receipt, reference: e.target.value })}
            />
          </div>
          {settings.suppliersEnabled ? (
            <div className="cpos-field" style={{ flex: '1 1 200px' }}>
              <span className="cpos-field__label">{t('pos.store.supplier.one')}</span>
              <PosSelect
                value={receipt.supplierId}
                onChange={(e) => update({ ...receipt, supplierId: e.target.value })}
                options={[
                  { value: '', label: t('pos.store.receive.noSupplier') },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          ) : null}
          <div className="cpos-field" style={{ flex: '2 1 220px' }}>
            <span className="cpos-field__label">{t('pos.store.adjust.note')}</span>
            <input className="cpos-input" value={receipt.note} onChange={(e) => update({ ...receipt, note: e.target.value })} />
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
                          <PosSelect
                            value={line.sizeKey}
                            onChange={(e) => setLine(index, { sizeKey: e.target.value })}
                            options={product.sizes.map((s) => ({ value: s, label: s }))}
                          />
                        ) : (
                          t('pos.store.product.noSize')
                        )}
                      </td>
                      <td className="cpos-table__num">
                        <input className="cpos-input"
                          value={String(line.quantity)}
                          inputMode="numeric"
                          style={{ maxWidth: 88 }}
                          onChange={(e) => setLine(index, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="cpos-table__num">
                        <input className="cpos-input"
                          value={String(line.unitCost)}
                          inputMode="decimal"
                          style={{ maxWidth: 96 }}
                          onChange={(e) => setLine(index, { unitCost: Number(e.target.value) || 0 })}
                        />
                      </td>
                      {settings.lotTrackingEnabled ? (
                        <td>
                          {tracks ? (
                            <input className="cpos-input"
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
                            <input className="cpos-input"
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
                        <button type="button" className="cpos-btn cpos-btn--ghost cpos-btn--sm"   onClick={() => removeLine(index)}>
                          <TrashIcon size={15} />
                        </button>
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
          <button type="button" className="cpos-btn cpos-btn--outline" onClick={() => push('/pos/store')}>
            {t('common.cancel')}
          </button>
          {receipt.lines.length ? (
            <button type="button" className="cpos-btn cpos-btn--danger" onClick={() => void discard()}>
              {t('pos.store.receive.discard')}
            </button>
          ) : null}
          <button type="button" className="cpos-btn cpos-btn--primary" disabled={posting || !receipt.lines.length} onClick={() => void post()}>
            {t('pos.store.receive.confirm')}
          </button>
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
