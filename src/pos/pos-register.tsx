'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { getSiteSettings } from '../services/site-settings-service';
import { reportServiceError } from '../services/error-log-service';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { DEFAULT_POS_SETTINGS, type PosSettings, type Product } from '../types';
import { useBarcodeScanner, DEFAULT_SCAN_GAP_MS } from './hardware/use-barcode-scanner';
import { PosCloudAdapter } from './storage/cloud-adapter';
import type { PosCommittedSale, PosTenderInput } from './storage/types';
import { usePosTicket } from './use-pos-ticket';
import { getPosDeviceId, getPosDeviceLabel, nextPosSaleId } from './pos-device';
import { PosTenderDialog } from './pos-tender-dialog';
import { buildReceiptModel, type PosReceiptModel } from './receipt/build-receipt-model';
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

/**
 * The register.
 *
 * Two panes: scanning and search on the left, the open ticket on the right.
 * The scanner is live the whole time this screen is mounted — a cashier should
 * never have to click into a field before the first scan of the day works.
 */
export function PosRegister({ className, formatPrice: formatPriceProp }: PosRegisterProps) {
  const { db, functions } = useCaspianFirebase();
  const { user, userProfile } = useAuth();
  const t = useT();
  const ticket = usePosTicket();

  const [posSettings, setPosSettings] = useState<PosSettings | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [phase, setPhase] = useState<Phase>({ kind: 'selling' });
  const [manualCode, setManualCode] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<Product[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [scanGapMs, setScanGapMs] = useState(DEFAULT_SCAN_GAP_MS);

  const adapter = useMemo(() => new PosCloudAdapter(db, functions), [db, functions]);
  const deviceId = useMemo(() => getPosDeviceId(), []);
  // Held across retries of the SAME sale — see the note in `commit`.
  const saleIdRef = useRef<string | null>(null);

  useEffect(() => {
    setScanGapMs(readScannerGapMs());
  }, []);

  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((settings) => {
        if (!alive) return;
        setPosSettings({ ...DEFAULT_POS_SETTINGS, ...(settings?.pos ?? {}) });
        setCurrency(settings?.currency || 'USD');
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

  const scanner = useBarcodeScanner({
    onScan: handleScan,
    gapMs: scanGapMs,
    // Silence the wedge while a dialog owns the keyboard, so keying an amount
    // into the tender field is never mistaken for a barcode.
    disabled: phase.kind !== 'selling',
  });

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
      try {
        const sale = await adapter.commitSale({
          saleId,
          deviceId,
          lines: ticket.lines,
          tenders,
          capturedAtMillis: Date.now(),
        });
        const receipt = buildReceiptModel({
          receiptNumber: sale.receiptNumber,
          orderId: sale.orderId,
          lines: ticket.lines,
          tenders,
          subtotal: ticket.totals.subtotal,
          discount: ticket.totals.lineDiscounts,
          total: sale.total,
          cashierName: userProfile?.displayName || user?.email || '',
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
    [adapter, db, deviceId, posSettings, t, ticket.lines, ticket.totals, user, userProfile],
  );

  const startNewSale = useCallback(() => {
    ticket.clear();
    setScanMessage(null);
    setAmbiguous(null);
    setCommitError(null);
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
        <h2 style={paneTitle}>{t('pos.title')}</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            scanner.submitManual(manualCode);
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t('pos.scan.placeholder')}
            aria-label={t('pos.scan.placeholder')}
            style={{ flex: 1, fontSize: 16 }}
          />
          <Button type="submit" disabled={!manualCode.trim()}>
            {t('pos.scan.submit')}
          </Button>
        </form>
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{t('pos.scan.hint')}</p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {scanner.cameraSupported ? (
            <Button
              type="button"
              variant="outline"
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
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, background: '#000' }}
          />
        ) : null}

        {scanMessage ? (
          <div style={{ fontSize: 13, color: '#666' }} role="status">
            {scanMessage}
          </div>
        ) : null}

        {ambiguous ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 13 }}>{t('pos.scan.chooseMatch')}</strong>
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
      </section>

      {/* --- Right: the open ticket --- */}
      <section style={{ ...pane, background: 'rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={paneTitle}>{t('pos.ticket.title')}</h2>
          <Badge>{t('pos.ticket.itemCount', { count: ticket.totals.itemCount })}</Badge>
        </div>

        {ticket.isEmpty ? (
          <p style={{ color: '#888', padding: '32px 0', textAlign: 'center' }}>
            {t('pos.ticket.empty')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {ticket.lines.map((line, index) => (
              <div key={`${line.productId}-${line.selectedSize ?? ''}`} style={lineRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{line.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {formatPrice(line.unitPrice)}
                    {line.selectedSize ? ` · ${line.selectedSize}` : ''}
                    {line.sku ? ` · ${line.sku}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={t('pos.ticket.decrease')}
                    onClick={() => ticket.setQuantity(index, line.quantity - 1)}
                  >
                    −
                  </Button>
                  <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>
                    {line.quantity}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={t('pos.ticket.increase')}
                    onClick={() => ticket.setQuantity(index, line.quantity + 1)}
                  >
                    +
                  </Button>
                </div>
                <div style={{ minWidth: 78, textAlign: 'end', fontWeight: 600 }}>
                  {formatPrice(line.unitPrice * line.quantity - (line.lineDiscount ?? 0))}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('pos.ticket.remove')}
                  onClick={() => ticket.removeLine(index)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={totalRow}>
            <span>{t('pos.ticket.subtotal')}</span>
            <span>{formatPrice(ticket.totals.subtotal)}</span>
          </div>
          {ticket.totals.lineDiscounts > 0 ? (
            <div style={totalRow}>
              <span>{t('pos.ticket.discountTotal')}</span>
              <span>-{formatPrice(ticket.totals.lineDiscounts)}</span>
            </div>
          ) : null}
          <div style={{ ...totalRow, fontSize: 24, fontWeight: 700 }}>
            <span>{t('pos.ticket.total')}</span>
            <span>{formatPrice(ticket.totals.total)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              variant="outline"
              disabled={ticket.isEmpty}
              onClick={() => {
                if (window.confirm(t('pos.ticket.clearConfirm'))) startNewSale();
              }}
            >
              {t('pos.ticket.clear')}
            </Button>
            <Button
              type="button"
              size="lg"
              style={{ flex: 1 }}
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
          onCancel={() => setPhase({ kind: 'selling' })}
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
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{t('pos.done.title')}</h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        {t('pos.done.receiptNumber', { number: sale.receiptNumber })}
      </p>

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
  gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1fr)',
  gap: 16,
  padding: 16,
  height: '100%',
  minHeight: 0,
  alignItems: 'stretch',
};

const pane: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  borderRadius: 'var(--caspian-radius, 12px)',
  border: '1px solid rgba(0,0,0,0.1)',
  minHeight: 0,
};

const paneTitle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700 };

const lineRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 4px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
};

const totalRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
};
