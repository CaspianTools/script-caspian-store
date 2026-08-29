'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAuth,
  useCaspianFirebaseOptional,
  useCaspianNavigation,
  getSiteSettings,
  reportServiceError,
  cn,
  DEFAULT_POS_SETTINGS,
  type PosSettings,
  type Product,
} from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';
import {
  CheckIcon,
  InboxIcon,
  PackageIcon,
  ReceiptIcon,
  ScanIcon,
  SearchIcon,
  ShoppingCartIcon,
  TagIcon,
  XIcon,
} from '../icons';
import { useBarcodeScanner, DEFAULT_SCAN_GAP_MS } from './hardware/use-barcode-scanner';
import { usePosAdapter } from './pos-adapter-context';
import type { PosCommittedSale, PosSaleLine, PosTenderInput } from './storage/types';
import { usePosLocalSession } from './standalone/local-session-context';
import { usePosRoles } from './standalone/role-context';
import { readLocalShopSettings } from './standalone/local-db';
import { announcePosSaleCommitted } from './standalone/use-pos-auto-backup';
import { usePosOpenSale } from './open-sale-context';
import { getPosDeviceId, getPosDeviceLabel, nextPosSaleId } from './pos-device';
import { PosTenderDialog } from './pos-tender-dialog';
import { parseAmount } from './parse-amount';
import {
  buildReceiptModel,
  summariseSoldLines,
  type PosReceiptModel,
} from './receipt/build-receipt-model';
import { PosReceipt } from './receipt/pos-receipt';
import { readScannerGapMs } from './pos-preferences';
import { usePosConfirm } from './standalone/ui/pos-confirm';
import { usePosMoney } from './use-pos-money';

type Phase =
  | { kind: 'selling' }
  | { kind: 'tendering' }
  | { kind: 'done'; sale: PosCommittedSale; receipt: PosReceiptModel };

export interface PosRegisterProps {
  className?: string;
  /** Override price rendering. Defaults to the store currency via `Intl`. */
  formatPrice?: (amount: number) => string;
}

interface TicketFigures {
  lines: PosSaleLine[];
  totals: { subtotal: number; lineDiscounts: number };
}

/**
 * What the receipt should say a customer was charged.
 *
 * Prefers the priced lines the commit came back with, and falls back to the
 * open ticket only for a sale still held on this device, where nothing has
 * priced it yet. The distinction matters: the ticket's prices are what the till
 * believed while scanning, and if the catalogue moved mid-sale they are not
 * what was charged. Mixing the two — ticket lines against a committed total —
 * printed a slip whose own lines did not add up to its own total.
 */
function receiptFigures(
  sale: PosCommittedSale,
  ticket: TicketFigures,
): { lines: PosSaleLine[]; subtotal: number; discount: number } {
  if (sale.lines?.length) {
    const { subtotal, discount } = summariseSoldLines(sale.lines);
    return { lines: sale.lines, subtotal, discount };
  }
  return {
    lines: ticket.lines,
    subtotal: ticket.totals.subtotal,
    discount: ticket.totals.lineDiscounts,
  };
}

/**
 * The register.
 *
 * Two panes: scanning and search on the left, the open ticket on the right.
 * The scanner is live the whole time this screen is mounted — a cashier should
 * never have to click into a field before the first scan of the day works.
 */
export function PosRegister({ className, formatPrice: formatPriceProp }: PosRegisterProps) {
  const db = useCaspianFirebaseOptional()?.db ?? null;
  const { user, userProfile } = useAuth();
  const local = usePosLocalSession();
  const t = useT();
  const confirm = usePosConfirm();
  const { can: canDo } = usePosRoles();
  // BOTH capabilities. The button goes to the Sales list, and that route is
  // gated on `sales.view` -- so a role granted only `sales.refund` would get a
  // button that bounces straight back to the register.
  const canRefund =
    local.standalone &&
    canDo(local.user?.role, 'sales.refund') &&
    canDo(local.user?.role, 'sales.view');
  // The open sale lives above this component, and on disk. `PosRoot` swaps
  // this whole component out for every other /pos screen, so a ticket owned
  // here would not survive a cashier glancing at Settings.
  const openSale = usePosOpenSale();
  const ticket = openSale.ticket;
  // One adapter for the whole register, shared with the connection pill and the
  // held-sales page so all three watch the same outbox.
  const { adapter } = usePosAdapter();

  const { searchParams, replace } = useCaspianNavigation();
  const [posSettings, setPosSettings] = useState<PosSettings | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [phase, setPhase] = useState<Phase>({ kind: 'selling' });
  const [manualCode, setManualCode] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<Product[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [scanGapMs, setScanGapMs] = useState(DEFAULT_SCAN_GAP_MS);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  // Which line is having a markdown keyed into it, and the raw text so far.
  const [discountLine, setDiscountLine] = useState<number | null>(null);
  const [discountDraft, setDiscountDraft] = useState('');

  // Attribution for the sale record is the adapter's job — it reads identity at
  // capture time, so a sale drained tomorrow still names tonight's cashier.
  // This is only the name to print on the slip in front of us.
  const cashierName = local.standalone
    ? (local.user?.displayName ?? '')
    : userProfile?.displayName || user?.email || '';

  const deviceId = useMemo(() => getPosDeviceId(), []);
  // Held across retries of the SAME sale — see the note in `commit`. Owned by
  // the provider so it is written to disk beside the lines it belongs to: a
  // ticket recovered without its sale id would mint a fresh one and charge a
  // customer twice for a commit that had actually landed.
  const saleIdRef = openSale.saleIdRef;
  // What was tendered on the last attempt, so a sale recovered on cancel can
  // still print a full receipt instead of one missing its payment lines.
  const lastTendersRef = useRef<PosTenderInput[]>([]);

  useEffect(() => {
    setScanGapMs(readScannerGapMs());
  }, []);

  // Search products when the header search query changes.
  const searchQuery = searchParams?.get('q')?.trim() ?? '';
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    adapter
      .searchProducts(searchQuery)
      .then((products) => {
        if (!alive) return;
        setSearchResults(products.slice(0, 24));
      })
      .catch(() => {
        if (!alive) return;
        setSearchResults([]);
      })
      .finally(() => {
        if (alive) setSearching(false);
      });
    return () => {
      alive = false;
    };
  }, [adapter, searchQuery]);

  useEffect(() => {
    let alive = true;
    // Standalone: receipt wording and currency come from the shop record on
    // this machine. Same defaults on failure, for the same reason.
    const load = db
      ? getSiteSettings(db).then((settings) => ({
          pos: { ...DEFAULT_POS_SETTINGS, ...(settings?.pos ?? {}) },
          currency: settings?.currency || 'USD',
        }))
      : readLocalShopSettings().then((shop) => ({
          pos: {
            ...DEFAULT_POS_SETTINGS,
            receiptHeader: shop.receiptHeader,
            receiptFooter: shop.receiptFooter,
            receiptPrefix: shop.receiptPrefix,
            roundCashTo: shop.roundCashTo,
            showTaxOnReceipt: shop.showTaxOnReceipt,
          },
          currency: shop.currency || 'USD',
        }));

    load
      .then(({ pos, currency: resolved }) => {
        if (!alive) return;
        setPosSettings(pos);
        setCurrency(resolved);
      })
      .catch((error) => {
        reportServiceError(db, 'pos-register.settings', error);
        // A missing settings document must not stop a shop trading — the
        // defaults are all safe (no cash rounding, no shift requirement).
        if (alive) setPosSettings(DEFAULT_POS_SETTINGS);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const fallbackPrice = usePosMoney(currency);
  const formatPrice = formatPriceProp ?? fallbackPrice;

  // --- Scanning ---
  const handleScan = useCallback(
    async (code: string) => {
      setManualCode('');
      setAmbiguous(null);
      setSearchResults([]);
      try {
        const found = await adapter.lookupByCode(code);
        if (!found) {
          setScanMessage(t('pos.scan.notFound', { code }));
          return;
        }
        if (found.products.length > 1) {
          setAmbiguous(found.products);
          setScanMessage(t('pos.scan.multipleMatches', { count: found.products.length }));
          return;
        }
        ticket.addProduct(found.products[0]);
        setScanMessage(
          found.matchedBy === 'sku'
            ? t('pos.scan.matchedBySku')
            : found.matchedBy === 'id'
              ? t('pos.scan.matchedById')
              : null,
        );
      } catch (error) {
        reportServiceError(db, 'pos-register.lookup', error);
        setScanMessage(t('common.error'));
      }
    },
    [adapter, db, t, ticket],
  );

  const addProductFromSearch = useCallback(
    (product: Product) => {
      ticket.addProduct(product);
      setSearchResults([]);
      setScanMessage(null);
      replace('/pos');
    },
    [ticket, replace],
  );

  const scanner = useBarcodeScanner({
    onScan: handleScan,
    gapMs: scanGapMs,
    // Open dialogs silence the wedge on their own, detected from the DOM — the
    // hook has to do that itself, because the POS header opens dialogs outside
    // this component. The markdown editor below is NOT in a dialog, so it says
    // so here: keying `10.00` into it must never be read as a barcode.
    disabled: phase.kind !== 'selling' || discountLine !== null,
  });

  // --- Line markdowns ---
  const openDiscount = useCallback((index: number, current: number | undefined) => {
    setDiscountLine(index);
    setDiscountDraft(current ? String(current) : '');
  }, []);

  const applyDiscount = useCallback(
    (index: number) => {
      // Parsed with the tender screen's reader so `12,50` means the same thing
      // in both places on the same keyboard.
      ticket.setLineDiscount(index, parseAmount(discountDraft));
      setDiscountLine(null);
      setDiscountDraft('');
    },
    [discountDraft, ticket],
  );

  // --- Commit ---
  const commit = useCallback(
    async (tenders: PosTenderInput[]) => {
      setCommitting(true);
      setCommitError(null);
      // Minted once per attempt and reused across retries: if the first call
      // actually landed and only the response was lost, the retry collides with
      // the committed sale and returns it as a duplicate instead of double-
      // charging. Minting a fresh id per retry would create the second sale.
      const saleId = saleIdRef.current ?? nextPosSaleId();
      saleIdRef.current = saleId;
      // Awaited, not fired and forgotten: the window this closes is a crash
      // between sending the sale and hearing back, and a ticket recovered
      // without this id would mint a fresh one and charge the customer twice.
      // An unawaited write is not ordered against the commit at all.
      await openSale.flush();
      lastTendersRef.current = tenders;
      try {
        const sale = await adapter.commitSale({
          saleId,
          deviceId,
          lines: ticket.lines,
          tenders,
          capturedAtMillis: Date.now(),
          capturedTotal: ticket.totals.total,
          capturedSubtotal: ticket.totals.subtotal,
        });
        const figures = receiptFigures(sale, ticket);
        const receipt = buildReceiptModel({
          receiptNumber: sale.receiptNumber,
          provisionalReceipt: sale.provisionalReceipt,
          orderId: sale.orderId,
          lines: figures.lines,
          tenders,
          subtotal: figures.subtotal,
          discount: figures.discount,
          total: sale.total,
          cashierName,
          deviceLabel: getPosDeviceLabel(),
          receiptHeader: posSettings?.receiptHeader,
          receiptFooter: posSettings?.receiptFooter,
          cashRounding: posSettings?.roundCashTo,
        });
        // Both, and in this order. `settle` forgets the sale id and stops the
        // writer; `clear` empties the basket that has just been paid for. The
        // receipt above was built from those lines a moment ago and the done
        // screen renders from `receipt`, so nothing downstream needs them.
        //
        // Clearing used to happen by accident: the ticket lived inside this
        // component and died when `PosRoot` swapped the screen. Now that it
        // outlives the screen, leaving it would put a settled basket back in
        // front of the next customer with a live Pay button.
        openSale.settle();
        ticket.clear();
        // The trigger for an automatic backup. A sale is the only event that
        // makes the previous backup out of date, so it is the only one worth
        // waking the writer for.
        announcePosSaleCommitted();
        setPhase({ kind: 'done', sale, receipt });
      } catch (error) {
        reportServiceError(db, 'pos-register.commit', error);
        setCommitError(
          error instanceof Error && error.message ? error.message : t('pos.done.failed'),
        );
      } finally {
        setCommitting(false);
      }
    },
    [adapter, cashierName, db, deviceId, openSale, posSettings, t, ticket],
  );

  /**
   * Backing out of the payment window after a failed commit.
   *
   * This looks trivial and is not. A commit that timed out and a commit that
   * was rejected are indistinguishable from here, so before letting the cashier
   * edit the ticket the register asks the one question that separates them:
   * did the sale land? Guessing wrong is expensive in both directions — keeping
   * the burnt sale id drops anything scanned afterwards (the idempotency gate
   * returns the original order), while minting a fresh one charges the customer
   * twice for a sale that actually succeeded.
   */
  const cancelTender = useCallback(async () => {
    const saleId = saleIdRef.current;
    setCommitError(null);
    if (!saleId) {
      setPhase({ kind: 'selling' });
      return;
    }
    setCommitting(true);
    try {
      const landed = await adapter.findCommittedSale(saleId);
      if (landed) {
        // It succeeded and only the response was lost. The ticket has not been
        // touched since the attempt, so it still describes this sale exactly.
        const figures = receiptFigures(landed, ticket);
        const receipt = buildReceiptModel({
          receiptNumber: landed.receiptNumber,
          provisionalReceipt: landed.provisionalReceipt,
          orderId: landed.orderId,
          lines: figures.lines,
          tenders: lastTendersRef.current,
          subtotal: figures.subtotal,
          discount: figures.discount,
          total: landed.total || ticket.totals.total,
          cashierName,
          deviceLabel: getPosDeviceLabel(),
          receiptHeader: posSettings?.receiptHeader,
          receiptFooter: posSettings?.receiptFooter,
          cashRounding: posSettings?.roundCashTo,
        });
        openSale.settle();
        ticket.clear();
        setPhase({ kind: 'done', sale: landed, receipt });
        return;
      }
      // Definitively absent: nothing was charged, so an edited ticket is free to
      // start a fresh id.
      saleIdRef.current = null;
      openSale.setOutcomeUnknown(false);
      openSale.persist();
      setPhase({ kind: 'selling' });
    } catch (error) {
      // Could not find out. Keep the id — a retry then collides with the
      // committed sale instead of creating a second one. The cost is that an
      // item added now would be swallowed, so say so rather than hide it.
      reportServiceError(db, 'pos-register.cancelProbe', error);
      // Held in the provider, not in `scanMessage`: the burnt sale id now
      // survives a walk to another screen, and a warning that did not would
      // leave a cashier adding items to a sale that cannot accept them.
      openSale.setOutcomeUnknown(true);
      setPhase({ kind: 'selling' });
    } finally {
      setCommitting(false);
    }
  }, [adapter, cashierName, db, openSale, posSettings, t, ticket]);

  const startNewSale = useCallback(() => {
    ticket.clear();
    setScanMessage(null);
    setAmbiguous(null);
    setCommitError(null);
    setDiscountLine(null);
    saleIdRef.current = null;
    openSale.settle();
    setPhase({ kind: 'selling' });
  }, [openSale, ticket]);


  if (!posSettings) {
    return (
      <div className="cpos-register">
        <div className="cpos-card cpos-card--pad">
          <div className="cpos-skeleton" style={{ height: 38, width: 220 }} />
          <div className="cpos-skeleton" style={{ height: 54 }} />
          <div className="cpos-skeleton" style={{ flex: 1, minHeight: 200 }} />
        </div>
        <div className="cpos-card cpos-card--pad">
          <div className="cpos-skeleton" style={{ height: 38, width: 180 }} />
          <div className="cpos-skeleton" style={{ flex: 1, minHeight: 200 }} />
          <div className="cpos-skeleton" style={{ height: 120 }} />
        </div>
      </div>
    );
  }

  if (phase.kind === 'done') {
    return (
      <PosSaleComplete
        sale={phase.sale}
        receipt={phase.receipt}
        formatPrice={formatPrice}
        onNewSale={startNewSale}
      />
    );
  }

  return (
    <div className={cn('cpos-register', className)}>
      {/* --- Left: scan + browse --- */}
      <section className="cpos-card cpos-card--pad cpos-register__pane">
        <div className="cpos-cardhead">
          <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
            <ScanIcon size={19} />
          </span>
          <span className="cpos-cardhead__text">
            <h2 className="cpos-cardhead__title">{t('pos.scan.title')}</h2>
            <span className="cpos-cardhead__sub">{t('pos.scan.hint')}</span>
          </span>
        </div>

        <form
          className="cpos-scanbar"
          onSubmit={(e) => {
            e.preventDefault();
            scanner.submitManual(manualCode);
          }}
        >
          <span className="cpos-scanbar__icon">
            <PackageIcon size={19} />
          </span>
          <input
            className="cpos-input cpos-scanbar__input"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t('pos.scan.placeholder')}
            aria-label={t('pos.scan.labelAddToSale')}
          />
          <button type="submit" className="cpos-btn cpos-btn--primary" disabled={!manualCode.trim()}>
            {t('pos.scan.submit')}
          </button>
        </form>

        {/*
          Nothing is focused on this screen at rest, so a scanner's characters
          land nowhere a cashier can see them. That made a scanner sending no
          Enter, and one typing too slowly to be recognised, look exactly like a
          scanner that was not plugged in. Now the burst shows as it arrives.
        */}
        {scanner.pending ? (
          <div className="cpos-note cpos-note--brand" role="status">
            {t('pos.scan.reading', { code: scanner.pending })}
          </div>
        ) : null}

        <div className="cpos-row" style={{ alignItems: 'center' }}>
          {scanner.cameraSupported ? (
            <button
              type="button"
              className={cn('cpos-btn', 'cpos-btn--sm', scanner.cameraActive ? 'cpos-btn--primary' : 'cpos-btn--outline')}
              onClick={() => (scanner.cameraActive ? scanner.stopCamera() : void scanner.startCamera())}
            >
              <ScanIcon size={15} />
              {scanner.cameraActive ? t('pos.scan.cameraStop') : t('pos.scan.camera')}
            </button>
          ) : (
            <span className="cpos-muted">{t('pos.scan.cameraUnsupported')}</span>
          )}
          {scanner.cameraError === 'denied' ? (
            <span className="cpos-badge cpos-badge--danger">{t('pos.scan.cameraDenied')}</span>
          ) : null}
        </div>

        {scanner.cameraActive ? (
          <video
            ref={scanner.videoRef}
            style={{
              width: '100%',
              maxHeight: 260,
              objectFit: 'cover',
              borderRadius: 'var(--cpos-r-lg)',
              background: '#000',
            }}
          />
        ) : null}

        {searchQuery && !scanner.cameraActive ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
            <div className="cpos-cardhead">
              <strong style={{ fontSize: 14, fontWeight: 650 }}>
                {searching ? t('common.loading') : t('pos.search.results')}
              </strong>
              {!searching ? (
                <span className="cpos-badge">{searchResults.length}</span>
              ) : (
                <span className="cpos-spinner" aria-hidden="true" />
              )}
              <span className="cpos-cardhead__spacer" />
              <button type="button" className="cpos-btn cpos-btn--ghost cpos-btn--sm" onClick={() => replace('/pos')}>
                <XIcon size={14} /> {t('common.close')}
              </button>
            </div>
            {searchResults.length === 0 && !searching ? (
              <div className="cpos-empty">
                <span className="cpos-empty__icon cpos-empty__icon--neutral">
                  <SearchIcon size={28} />
                </span>
                <p className="cpos-empty__text">{t('pos.search.empty')}</p>
              </div>
            ) : (
              <div className="cpos-tiles cpos-scroll">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="cpos-tile"
                    onClick={() => addProductFromSearch(product)}
                  >
                    <span className="cpos-tile__media">
                      {product.images?.[0]?.url ? (
                        <img src={product.images[0].url} alt="" />
                      ) : (
                        <PackageIcon size={26} />
                      )}
                    </span>
                    <span className="cpos-tile__body">
                      <span className="cpos-tile__name">{product.name}</span>
                      <span className="cpos-tile__price">{formatPrice(product.price)}</span>
                      {product.stock ? (
                        <span className="cpos-tile__stock">
                          {t('pos.search.inStock', {
                            count: Object.values(product.stock).reduce((a, b) => a + b, 0),
                          })}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {scanMessage && !searchQuery ? (
          <div className="cpos-note" role="status">
            {scanMessage}
          </div>
        ) : null}

        {ambiguous && !searchQuery ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>{t('pos.scan.chooseMatch')}</strong>
            {/*
              Name and price alone are not enough to choose between two items
              that share a barcode -- which is exactly the situation this picker
              exists for, and two items with the same name is the commonest
              version of it. The code and what is on the shelf are what tell
              them apart, so they are on the button.
            */}
            {ambiguous.map((product) => {
              const onHand = Object.values(product.stock ?? {}).reduce(
                (sum, count) => sum + (count ?? 0),
                0,
              );
              const detail = [product.sku || product.barcode, product.category]
                .filter(Boolean)
                .join(' \u00b7 ');
              return (
                <button
                  key={product.id}
                  type="button"
                  className="cpos-btn cpos-btn--outline"
                  style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                  onClick={() => {
                    ticket.addProduct(product);
                    setAmbiguous(null);
                    setScanMessage(null);
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <span>{product.name}</span>
                    {detail ? <span className="cpos-muted">{detail}</span> : null}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 2,
                    }}
                  >
                    <span>{formatPrice(product.price)}</span>
                    <span className={cn('cpos-muted', onHand < 0 && 'cpos-neg')}>
                      {t('pos.search.inStock', { count: onHand })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!searchQuery && !ambiguous && !scanner.cameraActive ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon">
              <ScanIcon size={30} />
            </span>
            <p className="cpos-empty__title">{t('pos.scan.readyTitle')}</p>
            <p className="cpos-empty__text">{t('pos.scan.hint')}</p>
          </div>
        ) : null}
      </section>

      {/* --- Right: the open ticket --- */}
      <section className="cpos-card cpos-card--pad cpos-register__pane">
        <div className="cpos-cardhead">
          <span className="cpos-cardhead__icon cpos-cardhead__icon--success">
            <ShoppingCartIcon size={19} />
          </span>
          <span className="cpos-cardhead__text">
            <h2 className="cpos-cardhead__title">{t('pos.ticket.title')}</h2>
            <span className="cpos-cardhead__sub">{cashierName || t('pos.nav.user')}</span>
          </span>
          <span className="cpos-cardhead__spacer" />
          <span className={cn('cpos-badge', !ticket.isEmpty && 'cpos-badge--brand')}>
            {t('pos.ticket.itemCount', { count: ticket.totals.itemCount })}
          </span>
        </div>

        {ticket.isEmpty ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon cpos-empty__icon--neutral">
              <ShoppingCartIcon size={30} />
            </span>
            <p className="cpos-empty__text">{t('pos.ticket.empty')}</p>
          </div>
        ) : (
          <div className="cpos-lines cpos-scroll">
            {ticket.lines.map((line, index) => (
              <div key={`${line.productId}-${line.selectedSize ?? ''}`} className="cpos-line">
                <div className="cpos-line__row">
                  <div className="cpos-line__main">
                    <div className="cpos-line__name">{line.name}</div>
                    <div className="cpos-line__meta">
                      {formatPrice(line.unitPrice)}
                      {line.selectedSize ? ` · ${line.selectedSize}` : ''}
                      {line.sku ? ` · ${line.sku}` : ''}
                    </div>
                  </div>

                  <div className="cpos-stepper">
                    <button
                      type="button"
                      className="cpos-stepper__btn"
                      aria-label={t('pos.ticket.decrease')}
                      onClick={() => ticket.setQuantity(index, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="cpos-stepper__value">{line.quantity}</span>
                    <button
                      type="button"
                      className="cpos-stepper__btn"
                      aria-label={t('pos.ticket.increase')}
                      onClick={() => ticket.setQuantity(index, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                  <div className="cpos-line__amount">
                    {formatPrice(line.unitPrice * line.quantity - (line.lineDiscount ?? 0))}
                  </div>

                  <div className="cpos-line__tools">
                    <button
                      type="button"
                      className={cn('cpos-iconbtn', line.lineDiscount && 'cpos-iconbtn--bordered')}
                      style={line.lineDiscount ? { color: 'var(--cpos-success)' } : undefined}
                      aria-label={t('pos.ticket.discount')}
                      title={t('pos.ticket.discount')}
                      onClick={() =>
                        discountLine === index
                          ? setDiscountLine(null)
                          : openDiscount(index, line.lineDiscount)
                      }
                    >
                      <TagIcon size={17} />
                    </button>
                    <button
                      type="button"
                      className="cpos-iconbtn"
                      aria-label={t('pos.ticket.remove')}
                      onClick={() => ticket.removeLine(index)}
                    >
                      <XIcon size={17} />
                    </button>
                  </div>
                </div>

                {line.lineDiscount ? (
                  <div className="cpos-line__discount">
                    {t('pos.ticket.discount')} −{formatPrice(line.lineDiscount)}
                  </div>
                ) : null}

                {discountLine === index ? (
                  <div className="cpos-line__editor">
                    <input
                      className="cpos-input"
                      inputMode="decimal"
                      autoFocus
                      value={discountDraft}
                      onChange={(e) => setDiscountDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyDiscount(index);
                        }
                      }}
                      placeholder={t('pos.ticket.discountPlaceholder')}
                      aria-label={t('pos.ticket.discount')}
                      style={{ flex: 1, textAlign: 'end' }}
                    />
                    <button type="button" className="cpos-btn cpos-btn--primary cpos-btn--sm" onClick={() => applyDiscount(index)}>
                      {t('pos.ticket.discountApply')}
                    </button>
                    <button
                      type="button"
                      className="cpos-btn cpos-btn--ghost cpos-btn--sm"
                      onClick={() => {
                        ticket.setLineDiscount(index, 0);
                        setDiscountLine(null);
                        setDiscountDraft('');
                      }}
                    >
                      {t('pos.ticket.discountClear')}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="cpos-totals">
          <div className="cpos-totals__row">
            <span className="cpos-totals__label">{t('pos.ticket.subtotal')}</span>
            <span className="cpos-totals__value">{formatPrice(ticket.totals.subtotal)}</span>
          </div>
          {ticket.totals.lineDiscounts > 0 ? (
            <div className="cpos-totals__row">
              <span className="cpos-totals__label">{t('pos.ticket.discountTotal')}</span>
              <span className="cpos-totals__value cpos-totals__value--save">
                -{formatPrice(ticket.totals.lineDiscounts)}
              </span>
            </div>
          ) : null}
          <div className="cpos-totals__grand">
            <span>{t('pos.ticket.total')}</span>
            <span className="cpos-totals__grandvalue">{formatPrice(ticket.totals.total)}</span>
          </div>

          {/*
            A return starts at the counter, because that is where the customer
            is. It goes to the Sales list rather than opening a lookup here: the
            list already has the search, the dates and the cashier names a
            cashier needs to find the right receipt, and a second lookup box on
            the register would be a third scan-shaped field on a screen that
            already has two.
          */}
          {canRefund ? (
            <button
              type="button"
              className="cpos-btn cpos-btn--ghost cpos-btn--sm"
              onClick={() => replace('/pos/sales')}
            >
              {t('pos.refund.start')}
            </button>
          ) : null}
          <div className="cpos-totals__actions">
            <button
              type="button"
              className="cpos-btn cpos-btn--outline"
              style={{ flex: 1 }}
              disabled={ticket.isEmpty}
              onClick={() => {
                void (async () => {
                  // Focus starts on Cancel. This is the most-pressed of the
                  // register's confirms and the one hit mid-queue, so the safe
                  // answer is the one already under the finger.
                  const ok = await confirm({
                    title: t('pos.ticket.clearTitle'),
                    body: t('pos.ticket.clearConfirm'),
                    confirmLabel: t('pos.ticket.clearVerb'),
                    tone: 'danger',
                    focus: 'cancel',
                    detail: (
                      <p className="cpos-muted" style={{ margin: 0 }}>
                        {t('pos.ticket.clearDetail', {
                          count: ticket.lines.length,
                          total: formatPrice(ticket.totals.total),
                        })}
                      </p>
                    ),
                  });
                  if (ok) startNewSale();
                })();
              }}
            >
              {t('pos.ticket.clear')}
            </button>
            <button
              type="button"
              className="cpos-btn cpos-btn--primary cpos-btn--pay"
              style={{ flex: 2 }}
              disabled={ticket.isEmpty}
              onClick={() => setPhase({ kind: 'tendering' })}
            >
              <span>{t('pos.tender.title')}</span>
              <span className="cpos-btn__paytotal">{formatPrice(ticket.totals.total)}</span>
            </button>
          </div>
        </div>
      </section>

      {phase.kind === 'tendering' ? (
        <PosTenderDialog
          total={ticket.totals.total}
          formatPrice={formatPrice}
          cashRounding={posSettings.roundCashTo}
          submitting={committing}
          error={commitError}
          onCancel={cancelTender}
          onConfirm={commit}
        />
      ) : null}
    </div>
  );
}

/**
 * What a cashier sees the instant the money is taken.
 *
 * Deliberately loud and deliberately short: the receipt number, the amount, and
 * the change to hand back. Everything else on this screen is an exception --
 * a sale held on the till, a provisional number, stock that went negative --
 * and each one says so in its own words rather than in a colour alone.
 */
function PosSaleComplete({
  sale,
  receipt,
  formatPrice,
  onNewSale,
}: {
  sale: PosCommittedSale;
  receipt: PosReceiptModel;
  formatPrice: (amount: number) => string;
  onNewSale: () => void;
}) {
  const t = useT();
  const [printing, setPrinting] = useState(false);

  return (
    <div className="cpos-done">
      <span className={cn('cpos-done__seal', sale.pending && 'cpos-done__seal--held')}>
        {sale.pending ? <InboxIcon size={32} /> : <CheckIcon size={34} />}
      </span>

      <h1 className="cpos-done__h">
        {sale.pending ? t('pos.done.heldTitle') : t('pos.done.title')}
      </h1>
      <p className="cpos-done__receipt">
        {t('pos.done.receiptNumber', { number: sale.receiptNumber })}
      </p>
      {sale.provisionalReceipt ? (
        <span className="cpos-badge cpos-badge--warning">{t('pos.done.provisionalReceipt')}</span>
      ) : null}

      <div className="cpos-done__total">{formatPrice(sale.total)}</div>

      {receipt.changeDue > 0 ? (
        <div className="cpos-done__change">
          {t('pos.done.changeDue', { amount: formatPrice(receipt.changeDue) })}
        </div>
      ) : null}

      {sale.stockShortfall.length > 0 ? (
        <div className="cpos-note cpos-note--warning" style={{ marginTop: 14 }}>
          {t('pos.done.stockWarning', { count: sale.stockShortfall.length })}
        </div>
      ) : null}

      <div className="cpos-done__actions">
        <button type="button" className="cpos-btn cpos-btn--outline" onClick={() => setPrinting(true)}>
          <ReceiptIcon size={17} />
          {t('pos.done.print')}
        </button>
        <button type="button" className="cpos-btn cpos-btn--primary cpos-btn--lg" onClick={onNewSale} autoFocus>
          {t('pos.done.newSale')}
        </button>
      </div>

      {/* Kept out of the normal flow; the print stylesheet reveals only this. */}
      <div className="caspian-pos-print-root" style={{ display: printing ? 'block' : 'none' }}>
        <PosReceipt
          model={receipt}
          formatPrice={formatPrice}
          autoPrint={printing}
          onAfterPrint={() => setPrinting(false)}
        />
      </div>
    </div>
  );
}
