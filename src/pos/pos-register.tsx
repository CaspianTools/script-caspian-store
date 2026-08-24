'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebaseOptional, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { getSiteSettings } from '../services/site-settings-service';
import { reportServiceError } from '../services/error-log-service';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { PackageIcon, SearchIcon, ShoppingCartIcon, TagIcon, UserIcon, XIcon } from '../ui/icons';
import { DEFAULT_POS_SETTINGS, type PosSettings, type Product } from '../types';
import { useBarcodeScanner, DEFAULT_SCAN_GAP_MS } from './hardware/use-barcode-scanner';
import { usePosAdapter } from './pos-adapter-context';
import type { PosCommittedSale, PosSaleLine, PosTenderInput } from './storage/types';
import { usePosLocalSession } from './standalone/local-session-context';
import { readLocalShopSettings } from './standalone/local-db';
import { usePosTicket } from './use-pos-ticket';
import { getPosDeviceId, getPosDeviceLabel, nextPosSaleId } from './pos-device';
import { PosTenderDialog, parseAmount } from './pos-tender-dialog';
import {
  buildReceiptModel,
  summariseSoldLines,
  type PosReceiptModel,
} from './receipt/build-receipt-model';
import { PosReceipt } from './receipt/pos-receipt';
import { readScannerGapMs } from './pos-preferences';

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
  const ticket = usePosTicket();
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
  // Held across retries of the SAME sale — see the note in `commit`.
  const saleIdRef = useRef<string | null>(null);
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

  const formatPrice = useMemo(() => {
    if (formatPriceProp) return formatPriceProp;
    return (amount: number) => {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
      } catch {
        return amount.toFixed(2);
      }
    };
  }, [formatPriceProp, currency]);

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
        saleIdRef.current = null;
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
    [adapter, cashierName, db, deviceId, posSettings, t, ticket],
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
        saleIdRef.current = null;
        setPhase({ kind: 'done', sale: landed, receipt });
        return;
      }
      // Definitively absent: nothing was charged, so an edited ticket is free to
      // start a fresh id.
      saleIdRef.current = null;
      setPhase({ kind: 'selling' });
    } catch (error) {
      // Could not find out. Keep the id — a retry then collides with the
      // committed sale instead of creating a second one. The cost is that an
      // item added now would be swallowed, so say so rather than hide it.
      reportServiceError(db, 'pos-register.cancelProbe', error);
      setScanMessage(t('pos.done.outcomeUnknown'));
      setPhase({ kind: 'selling' });
    } finally {
      setCommitting(false);
    }
  }, [adapter, cashierName, db, posSettings, t, ticket]);

  const startNewSale = useCallback(() => {
    ticket.clear();
    setScanMessage(null);
    setAmbiguous(null);
    setCommitError(null);
    setDiscountLine(null);
    saleIdRef.current = null;
    setPhase({ kind: 'selling' });
  }, [ticket]);

  if (!posSettings) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 28, width: 220 }} />
        <Skeleton style={{ height: 200 }} />
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
    <div className={className} style={layout}>
      {/* --- Left: scan + browse --- */}
      <section style={pane}>
        <div style={paneHeader}>
          <div style={paneIcon}>
            <SearchIcon size={18} />
          </div>
          <h2 style={paneTitle}>{t('pos.title')}</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            scanner.submitManual(manualCode);
          }}
          style={scanForm}
        >
          <span style={scanIcon}>
            <PackageIcon size={18} />
          </span>
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t('pos.scan.placeholder')}
            aria-label={t('pos.scan.placeholder')}
            style={scanInput}
          />
          <Button type="submit" disabled={!manualCode.trim()} size="md">
            {t('pos.scan.submit')}
          </Button>
        </form>

        <div style={scanActions}>
          {scanner.cameraSupported ? (
            <Button
              type="button"
              variant={scanner.cameraActive ? 'primary' : 'outline'}
              size="sm"
              onClick={() => (scanner.cameraActive ? scanner.stopCamera() : void scanner.startCamera())}
            >
              {scanner.cameraActive ? t('pos.scan.cameraStop') : t('pos.scan.camera')}
            </Button>
          ) : (
            <span style={{ fontSize: 12, color: '#666' }}>{t('pos.scan.cameraUnsupported')}</span>
          )}
          {scanner.cameraError === 'denied' ? (
            <span style={{ fontSize: 12, color: '#b91c1c' }}>{t('pos.scan.cameraDenied')}</span>
          ) : null}
        </div>

        {scanner.cameraActive ? (
          <video
            ref={scanner.videoRef}
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, background: '#000' }}
          />
        ) : null}

        {searchQuery && !scanner.cameraActive ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, fontWeight: 600 }}>
                {searching ? t('common.loading') : t('pos.search.results')}
              </strong>
              <button
                type="button"
                onClick={() => replace('/pos')}
                style={textButton}
              >
                <XIcon size={14} /> {t('common.close')}
              </button>
            </div>
            {searchResults.length === 0 && !searching ? (
              <p style={{ color: '#888', textAlign: 'center', margin: 'auto 0' }}>
                {t('pos.search.empty')}
              </p>
            ) : (
              <div style={productGrid}>
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductFromSearch(product)}
                    style={productCard}
                  >
                    <div style={productImage}>
                      {product.images?.[0]?.url ? (
                        <img
                          src={product.images[0].url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <PackageIcon size={24} />
                      )}
                    </div>
                    <div style={{ padding: 10, textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{product.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--caspian-primary, #1a73e8)', fontWeight: 700, marginTop: 4 }}>
                        {formatPrice(product.price)}
                      </div>
                      {product.stock ? (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          {Object.values(product.stock).reduce((a, b) => a + b, 0)} in stock
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {scanMessage && !searchQuery ? (
          <div style={scanMessageBox} role="status">
            {scanMessage}
          </div>
        ) : null}

        {ambiguous && !searchQuery ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>{t('pos.scan.chooseMatch')}</strong>
            {ambiguous.map((product) => (
              <Button
                key={product.id}
                type="button"
                variant="outline"
                onClick={() => {
                  ticket.addProduct(product);
                  setAmbiguous(null);
                  setScanMessage(null);
                }}
                style={{ justifyContent: 'space-between' }}
              >
                <span>{product.name}</span>
                <span>{formatPrice(product.price)}</span>
              </Button>
            ))}
          </div>
        ) : null}

        {!searchQuery && !ambiguous && !scanner.cameraActive ? (
          <div style={emptyState}>
            <div style={emptyIcon}>
              <ShoppingCartIcon size={32} />
            </div>
            <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{t('pos.scan.hint')}</p>
          </div>
        ) : null}
      </section>

      {/* --- Right: the open ticket --- */}
      <section style={{ ...pane, background: '#fff' }}>
        <div style={paneHeader}>
          <div style={{ ...paneIcon, background: '#10b981', color: '#fff' }}>
            <ShoppingCartIcon size={18} />
          </div>
          <h2 style={paneTitle}>{t('pos.ticket.title')}</h2>
          <div style={{ flex: 1, minWidth: 8 }} />
          <Badge>
            {t('pos.ticket.itemCount', { count: ticket.totals.itemCount })}
          </Badge>
        </div>

        {ticket.isEmpty ? (
          <div style={emptyState}>
            <div style={{ ...emptyIcon, background: 'rgba(0,0,0,0.03)', color: '#888' }}>
              <UserIcon size={32} />
            </div>
            <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{t('pos.ticket.empty')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {ticket.lines.map((line, index) => (
              <div key={`${line.productId}-${line.selectedSize ?? ''}`} style={lineCard}>
                <div style={lineRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflowWrap: 'anywhere', fontSize: 14 }}>{line.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {formatPrice(line.unitPrice)}
                      {line.selectedSize ? ` · ${line.selectedSize}` : ''}
                      {line.sku ? ` · ${line.sku}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={t('pos.ticket.decrease')}
                      onClick={() => ticket.setQuantity(index, line.quantity - 1)}
                      style={{ borderRadius: 8 }}
                    >
                      −
                    </Button>
                    <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={t('pos.ticket.increase')}
                      onClick={() => ticket.setQuantity(index, line.quantity + 1)}
                      style={{ borderRadius: 8 }}
                    >
                      +
                    </Button>
                  </div>
                  <div style={{ minWidth: 78, textAlign: 'end', fontWeight: 700, fontSize: 15 }}>
                    {formatPrice(line.unitPrice * line.quantity - (line.lineDiscount ?? 0))}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant={line.lineDiscount ? 'primary' : 'ghost'}
                    aria-label={t('pos.ticket.discount')}
                    title={t('pos.ticket.discount')}
                    onClick={() =>
                      discountLine === index
                        ? setDiscountLine(null)
                        : openDiscount(index, line.lineDiscount)
                    }
                  >
                    <TagIcon size={16} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('pos.ticket.remove')}
                    onClick={() => ticket.removeLine(index)}
                  >
                    <XIcon size={16} />
                  </Button>
                </div>

                {line.lineDiscount ? (
                  <div style={discountNote}>
                    {t('pos.ticket.discount')} −{formatPrice(line.lineDiscount)}
                  </div>
                ) : null}

                {discountLine === index ? (
                  <div style={discountEditor}>
                    <Input
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
                    <Button type="button" size="sm" onClick={() => applyDiscount(index)}>
                      {t('pos.ticket.discountApply')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        ticket.setLineDiscount(index, 0);
                        setDiscountLine(null);
                        setDiscountDraft('');
                      }}
                    >
                      {t('pos.ticket.discountClear')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div style={ticketFooter}>
          <div style={totalRow}>
            <span style={{ color: '#666' }}>{t('pos.ticket.subtotal')}</span>
            <span style={{ fontWeight: 600 }}>{formatPrice(ticket.totals.subtotal)}</span>
          </div>
          {ticket.totals.lineDiscounts > 0 ? (
            <div style={totalRow}>
              <span style={{ color: '#666' }}>{t('pos.ticket.discountTotal')}</span>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>
                -{formatPrice(ticket.totals.lineDiscounts)}
              </span>
            </div>
          ) : null}
          <div style={{ ...totalRow, fontSize: 24, fontWeight: 800, marginTop: 4, paddingTop: 8, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
            <span>{t('pos.ticket.total')}</span>
            <span>{formatPrice(ticket.totals.total)}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button
              type="button"
              variant="outline"
              disabled={ticket.isEmpty}
              onClick={() => {
                if (window.confirm(t('pos.ticket.clearConfirm'))) startNewSale();
              }}
              style={{ flex: 1, borderRadius: 12, height: 52 }}
            >
              {t('pos.ticket.clear')}
            </Button>
            <Button
              type="button"
              size="lg"
              style={{ flex: 2, borderRadius: 12, height: 52, boxShadow: '0 4px 14px rgba(26,115,232,0.35)' }}
              disabled={ticket.isEmpty}
              onClick={() => setPhase({ kind: 'tendering' })}
            >
              {t('pos.tender.title')}
            </Button>
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
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        {sale.pending ? t('pos.done.heldTitle') : t('pos.done.title')}
      </h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        {t('pos.done.receiptNumber', { number: sale.receiptNumber })}
      </p>
      {sale.provisionalReceipt ? (
        <p style={{ color: '#b45309', fontSize: 13, margin: '4px 0 0' }}>
          {t('pos.done.provisionalReceipt')}
        </p>
      ) : null}

      <div style={{ fontSize: 34, fontWeight: 700, margin: '16px 0' }}>
        {formatPrice(sale.total)}
      </div>

      {receipt.changeDue > 0 ? (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: '#ecfdf5',
            color: '#065f46',
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {t('pos.done.changeDue', { amount: formatPrice(receipt.changeDue) })}
        </div>
      ) : null}

      {sale.stockShortfall.length > 0 ? (
        <p style={{ color: '#b45309', fontSize: 13, marginTop: 12 }}>
          {t('pos.done.stockWarning', { count: sale.stockShortfall.length })}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
        <Button type="button" variant="outline" onClick={() => setPrinting(true)}>
          {t('pos.done.print')}
        </Button>
        <Button type="button" size="lg" onClick={onNewSale} autoFocus>
          {t('pos.done.newSale')}
        </Button>
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

const layout: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(340px, 1fr)',
  gap: 20,
  padding: 20,
  height: '100%',
  minHeight: 0,
  alignItems: 'stretch',
};

const pane: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: 20,
  borderRadius: 20,
  background: '#fff',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
  minHeight: 0,
};

const paneHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 2,
};

const paneIcon: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--caspian-primary, #1a73e8)',
  color: 'var(--caspian-primary-foreground, #fff)',
  boxShadow: '0 2px 8px rgba(26,115,232,0.25)',
};

const paneTitle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700 };

const scanForm: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  position: 'relative',
};

const scanIcon: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  color: '#888',
  pointerEvents: 'none',
  display: 'inline-flex',
};

const scanInput: React.CSSProperties = {
  flex: 1,
  paddingLeft: 42,
  paddingRight: 14,
  height: 48,
  borderRadius: 14,
  fontSize: 15,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#f9fafb',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
};

const scanActions: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const scanMessageBox: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  background: '#f3f4f6',
  color: '#4b5563',
  fontSize: 13,
};

const productGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 12,
  overflowY: 'auto',
  padding: 4,
};

const productCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 14,
  background: '#fff',
  cursor: 'pointer',
  overflow: 'hidden',
  textAlign: 'left',
  padding: 0,
  transition: 'transform 0.1s, box-shadow 0.15s',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

const productImage: React.CSSProperties = {
  height: 90,
  background: '#f3f4f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#9ca3af',
};

const emptyState: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: 12,
  minHeight: 160,
};

const emptyIcon: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 20,
  background: 'rgba(26,115,232,0.08)',
  color: 'var(--caspian-primary, #1a73e8)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const textButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: 0,
  background: 'transparent',
  color: '#666',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

const lineCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 8px',
  borderRadius: 12,
  background: '#f9fafb',
  border: '1px solid rgba(0,0,0,0.04)',
};

const lineRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const discountNote: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#16a34a',
};

const discountEditor: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const ticketFooter: React.CSSProperties = {
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  borderRadius: 16,
  background: '#f9fafb',
  border: '1px solid rgba(0,0,0,0.04)',
};

const totalRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: 14,
};
