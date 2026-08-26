'use client';

import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../i18n/locale-context';
import { useCaspianNavigation, useCaspianStandalone } from '../../provider/caspian-store-provider';
import { Button } from '../../ui/button';
import { CashDrawerIcon } from '../../ui/icons';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { useToast } from '../../ui/toast';
import { parseAmount } from '../pos-tender-dialog';
import { PosAdminPage } from './admin/pos-admin-page';
import { actions, field, fieldLabel, muted, section } from './admin/panel-styles';
import { usePosShift } from './shift-context';
import { ShiftReport } from './shift-report';
import type { ShiftTotals } from './shift-totals';
import type { LocalShift } from './types';

/**
 * The open shift: what it has taken, the money moved in and out of the drawer,
 * and the way to close it against a count.
 *
 * Reached from the strip on the register rather than from the sidebar -- see
 * the note on `PosShiftStrip`. A closed shift's report stays on screen after
 * the close rather than bouncing back to the register, because the figure a
 * cashier has just been given is the one they are about to write down.
 */
export function PosShiftPage() {
  const t = useT();
  const { toast } = useToast();
  const standalone = useCaspianStandalone();
  const { push } = useCaspianNavigation();
  const { required, loading, shift, totals, currency, cashMovement, close } = usePosShift();

  const [movementKind, setMovementKind] = useState<'in' | 'out' | null>(null);
  const [closing, setClosing] = useState(false);
  /** The shift just closed on this screen, kept so its report can be read. */
  const [justClosed, setJustClosed] = useState<LocalShift | null>(null);

  const formatPrice = useMemo(
    () => (amount: number) => {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
      } catch {
        return amount.toFixed(2);
      }
    },
    [currency],
  );

  const onClose = useCallback(
    async (countedCash: number) => {
      const result = await close(countedCash);
      if (!result.ok) {
        toast({ title: t('pos.shift.closeFailed'), variant: 'destructive' });
        return false;
      }
      setJustClosed(result.shift);
      toast({ title: t('pos.shift.closed') });
      return true;
    },
    [close, toast, t],
  );

  if (!standalone) return null;

  if (loading) {
    return (
      <PosAdminPage
        icon={<CashDrawerIcon size={20} />}
        title={t('pos.shift.pageTitle')}
        subtitle={t('pos.shift.pageSubtitle')}
      >
        <div className="cpos-skeleton" style={{ height: 220 }} />
      </PosAdminPage>
    );
  }

  if (!required) {
    return (
      <PosAdminPage
        icon={<CashDrawerIcon size={20} />}
        title={t('pos.shift.pageTitle')}
        subtitle={t('pos.shift.pageSubtitle')}
      >
        <section style={section}>
          <p style={muted}>{t('pos.shift.notEnabled')}</p>
        </section>
      </PosAdminPage>
    );
  }

  if (justClosed) {
    return (
      <PosAdminPage
        icon={<CashDrawerIcon size={20} />}
        title={t('pos.shift.zTitle')}
        subtitle={t('pos.shift.zSubtitle')}
      >
        <section style={section}>
          {/* No totals passed: a closed shift is read off the figures it was
              closed at, never recomputed. */}
          <ShiftReport shift={justClosed} formatPrice={formatPrice} />
          <div style={actions}>
            {/*
              The browser's own print, which is the only receipt transport this
              till has -- see the disabled printer picker at /pos/settings. It
              prints the page, so the report is the page.
            */}
            <Button variant="outline" onClick={() => window.print()}>
              {t('pos.shift.print')}
            </Button>
            <Button onClick={() => push('/pos')}>{t('pos.shift.backToRegister')}</Button>
          </div>
        </section>
      </PosAdminPage>
    );
  }

  if (!shift) {
    return (
      <PosAdminPage
        icon={<CashDrawerIcon size={20} />}
        title={t('pos.shift.pageTitle')}
        subtitle={t('pos.shift.pageSubtitle')}
      >
        <section style={section}>
          <p style={muted}>{t('pos.shift.noneOpen')}</p>
          <div style={actions}>
            <Button onClick={() => push('/pos')}>{t('pos.shift.backToRegister')}</Button>
          </div>
        </section>
      </PosAdminPage>
    );
  }

  return (
    <PosAdminPage
        icon={<CashDrawerIcon size={20} />}
        title={t('pos.shift.pageTitle')}
        subtitle={t('pos.shift.pageSubtitle')}
      >
      <section style={section}>
        <ShiftReport shift={shift} totals={totals} formatPrice={formatPrice} />
        <div style={actions}>
          <Button variant="outline" onClick={() => setMovementKind('in')}>
            {t('pos.shift.cashIn')}
          </Button>
          <Button variant="outline" onClick={() => setMovementKind('out')}>
            {t('pos.shift.cashOut')}
          </Button>
          <Button onClick={() => setClosing(true)}>{t('pos.shift.close')}</Button>
        </div>
      </section>

      {shift.movements.length ? (
        <section style={section}>
          <strong>{t('pos.shift.movements')}</strong>
          {shift.movements.map((movement) => (
            <div key={movement.id} style={{ display: 'flex', gap: 12, fontSize: 13.5 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>
                {movement.kind === 'in' ? '+' : '−'}
                {formatPrice(movement.amount)}
              </span>
              <span>{movement.reason || t('pos.shift.noReason')}</span>
              <span style={muted}>{movement.byUserName}</span>
            </div>
          ))}
        </section>
      ) : null}

      <CashMovementDialog
        kind={movementKind}
        onOpenChange={(open) => setMovementKind(open ? movementKind : null)}
        onSubmit={async (amount, reason) => {
          if (!movementKind) return false;
          const ok = await cashMovement(movementKind, amount, reason);
          if (!ok) toast({ title: t('pos.shift.movementFailed'), variant: 'destructive' });
          return ok;
        }}
      />

      <CloseShiftDialog
        open={closing}
        onOpenChange={setClosing}
        totals={totals}
        formatPrice={formatPrice}
        onSubmit={onClose}
      />
    </PosAdminPage>
  );
}

/**
 * Money in or out, with a reason.
 *
 * The reason is required. A movement with no reason is a hole in the drawer
 * that balances on paper and explains nothing at the end of the week, which is
 * exactly the situation cash movements exist to prevent.
 */
function CashMovementDialog({
  kind,
  onOpenChange,
  onSubmit,
}: {
  kind: 'in' | 'out' | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amount: number, reason: string) => Promise<boolean>;
}) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const amount = parseAmount(typed.trim());
  const blocked = !typed.trim() || amount <= 0 || !reason.trim();

  const submit = async () => {
    if (blocked || saving) return;
    setSaving(true);
    const ok = await onSubmit(amount, reason);
    setSaving(false);
    if (!ok) return;
    setTyped('');
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={kind !== null}
      onOpenChange={onOpenChange}
      title={kind === 'out' ? t('pos.shift.cashOut') : t('pos.shift.cashIn')}
      maxWidth={420}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} disabled={blocked}>
            {t('pos.shift.record')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={field}>
          <span style={fieldLabel}>{t('pos.shift.amount')}</span>
          <Input value={typed} inputMode="decimal" autoFocus onChange={(e) => setTyped(e.target.value)} />
        </div>
        <div style={field}>
          <span style={fieldLabel}>{t('pos.shift.reason')}</span>
          <Input
            value={reason}
            placeholder={t('pos.shift.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Count the drawer and close.
 *
 * The variance is shown before anybody commits, and the close is never refused
 * for one. A till that would not let a cashier finish on a short drawer is a
 * till that teaches cashiers to make the number fit.
 */
function CloseShiftDialog({
  open,
  onOpenChange,
  totals,
  formatPrice,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totals: ShiftTotals;
  formatPrice: (amount: number) => string;
  onSubmit: (countedCash: number) => Promise<boolean>;
}) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);

  const raw = typed.trim();
  const counted = parseAmount(raw);
  // Shown live so a cashier sees the consequence of the figure before
  // committing to it, and can recount rather than explain later.
  const variance = raw ? Math.round((counted - totals.expectedCash) * 100) / 100 : null;

  const submit = async () => {
    if (!raw || saving) return;
    setSaving(true);
    const ok = await onSubmit(counted);
    setSaving(false);
    if (ok) {
      setTyped('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pos.shift.close')}
      maxWidth={440}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!raw}>
            {t('pos.shift.closeConfirm')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={muted}>{t('pos.shift.closeBody')}</p>
        <div style={field}>
          <span style={fieldLabel}>{t('pos.shift.counted')}</span>
          <Input value={typed} inputMode="decimal" autoFocus onChange={(e) => setTyped(e.target.value)} />
        </div>
        <div className="cpos-zreport">
          <div className="cpos-zreport__row">
            <span>{t('pos.shift.expected')}</span>
            <b>{formatPrice(totals.expectedCash)}</b>
          </div>
          {variance !== null ? (
            <div
              className={
                variance === 0
                  ? 'cpos-zreport__row cpos-zreport__row--total'
                  : variance < 0
                    ? 'cpos-zreport__row cpos-zreport__row--total cpos-zreport__row--short'
                    : 'cpos-zreport__row cpos-zreport__row--total cpos-zreport__row--over'
              }
            >
              {/* Named in words as well as coloured: colour is never the only signal. */}
              <span>
                {variance === 0
                  ? t('pos.shift.varianceExact')
                  : variance < 0
                    ? t('pos.shift.varianceShort')
                    : t('pos.shift.varianceOver')}
              </span>
              <b>{formatPrice(Math.abs(variance))}</b>
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
