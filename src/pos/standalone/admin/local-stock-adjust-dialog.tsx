'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select } from '../../../ui/select';
import { Dialog } from '../../../ui/dialog';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { cn } from '../../../utils/cn';
import { adjustLocalStock } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { DEFAULT_SIZE_KEY } from '../lot-allocation';
import {
  LOCAL_STOCK_ADJUST_REASONS,
  type LocalProduct,
  type LocalStockAdjustReason,
  type LocalStockLot,
} from '../types';
import { field, fieldLabel, row } from './panel-styles';

export interface LocalStockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: LocalProduct;
  /** This product's lots, for naming which one moved. Empty is fine. */
  lots?: LocalStockLot[];
  onSaved?: () => void;
}

/**
 * Move stock by hand, and say why.
 *
 * The direction is its own control rather than being inferred from the reason.
 * Most reasons only go one way -- a return comes in, a breakage goes out -- but
 * a recount goes either, and a dialog that silently decided the sign from a
 * dropdown would be a dialog that occasionally doubled a discrepancy instead of
 * correcting it.
 */
export function LocalStockAdjustDialog({
  open,
  onOpenChange,
  product,
  lots = [],
  onSaved,
}: LocalStockAdjustDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();

  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('1');
  const [sizeKey, setSizeKey] = useState(DEFAULT_SIZE_KEY);
  const [lotId, setLotId] = useState('');
  const [reason, setReason] = useState<LocalStockAdjustReason>('customer-return');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection('in');
    setQuantity('1');
    setSizeKey(product.sizes[0] ?? DEFAULT_SIZE_KEY);
    setLotId('');
    setReason('customer-return');
    setNote('');
  }, [open, product]);

  const sizeLots = lots.filter((lot) => lot.sizeKey === sizeKey);

  const save = async () => {
    const size = Math.abs(Math.round(Number(quantity)));
    if (!Number.isFinite(size) || size <= 0) {
      toast({ title: t('pos.store.adjust.invalid'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await adjustLocalStock({
        productId: product.id,
        sizeKey,
        quantity: direction === 'in' ? size : -size,
        reason,
        note: note.trim(),
        userId: session.user?.id ?? '',
        userName: session.user?.displayName ?? '',
        lotId,
      });
      onOpenChange(false);
      onSaved?.();
      toast({ title: t('pos.store.adjust.saved') });
    } catch {
      toast({ title: t('pos.store.adjust.failed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pos.store.adjust.title', { name: product.name })}
      maxWidth={560}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {t('pos.store.adjust.confirm')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={field}>
          <span style={fieldLabel}>{t('pos.store.adjust.direction')}</span>
          <div className="cpos-choices" role="group" aria-label={t('pos.store.adjust.direction')}>
            {(['in', 'out'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn('cpos-choice', direction === value && 'cpos-choice--on')}
                aria-pressed={direction === value}
                onClick={() => setDirection(value)}
              >
                <span>
                  {t(value === 'in' ? 'pos.store.adjust.in' : 'pos.store.adjust.out')}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={row}>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.store.adjust.quantity')}</label>
            <Input
              value={quantity}
              inputMode="numeric"
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          {product.sizes.length ? (
            <div style={{ ...field, flex: '1 1 120px' }}>
              <label style={fieldLabel}>{t('pos.admin.products.sizes')}</label>
              <Select
                value={sizeKey}
                onChange={(e) => {
                  setSizeKey(e.target.value);
                  setLotId('');
                }}
                options={product.sizes.map((s) => ({ value: s, label: s }))}
              />
            </div>
          ) : null}
          <div style={{ ...field, flex: '2 1 200px' }}>
            <label style={fieldLabel}>{t('pos.store.adjust.reason')}</label>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value as LocalStockAdjustReason)}
              options={LOCAL_STOCK_ADJUST_REASONS.map((r) => ({
                value: r,
                label: t(`pos.store.adjust.reason.${r}`),
              }))}
            />
          </div>
        </div>

        {product.tracksLots && sizeLots.length ? (
          <div style={field}>
            <label style={fieldLabel}>{t('pos.store.lot.one')}</label>
            <Select
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              options={[
                { value: '', label: t('pos.store.adjust.lotAuto') },
                ...sizeLots.map((lot) => ({
                  value: lot.id,
                  label: `${lot.lotCode || t('pos.store.lot.untitled')}${
                    lot.expiresOn ? ` · ${lot.expiresOn}` : ''
                  } · ${lot.remainingQty}`,
                })),
              ]}
            />
            <FieldDescription>
              {t(direction === 'out' ? 'pos.store.adjust.lotOutHelp' : 'pos.store.adjust.lotInHelp')}
            </FieldDescription>
          </div>
        ) : null}

        <div style={field}>
          <label style={fieldLabel}>{t('pos.store.adjust.note')}</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {reason === 'customer-return' ? (
          <div className="cpos-note cpos-note--brand">{t('pos.store.adjust.returnNote')}</div>
        ) : null}
      </div>
    </Dialog>
  );
}
