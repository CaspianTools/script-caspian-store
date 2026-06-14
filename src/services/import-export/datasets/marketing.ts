import type { PromoCode } from '../../../types';
import {
  createPromoCode,
  listPromoCodes,
  updatePromoCode,
  type PromoCodeWriteInput,
} from '../../promo-code-service';
import { listSubscribers, subscribeEmail } from '../../subscriber-service';
import {
  applyWrites,
  duplicatePlan,
  invalidPlan,
  isoFromTs,
  newPlan,
  parseBool,
  parseNumber,
} from '../helpers';
import type { ColumnMeta, DatasetDescriptor, RowPlan } from '../types';

// --- Promo codes ------------------------------------------------------------

interface PromoPayload {
  input: PromoCodeWriteInput;
  explicitId?: string;
}

const promoColumns: ColumnMeta[] = [
  { header: 'id', sample: '', help: 'Leave blank to create; fill to target an existing code.' },
  { header: 'code', required: true, sample: 'WELCOME10', help: 'Stored uppercase.' },
  { header: 'type', required: true, sample: 'percentage', help: 'percentage or fixed.' },
  { header: 'value', required: true, sample: '10', help: 'Percent (0–100) or a fixed amount.' },
  { header: 'minOrderAmount', sample: '', help: 'Minimum subtotal required, or blank.' },
  { header: 'maxDiscount', sample: '', help: 'Caps a percentage discount, or blank.' },
  { header: 'isActive', sample: 'true' },
];

export const PROMO_CODES_DATASET: DatasetDescriptor = {
  id: 'promo-codes',
  labelKey: 'admin.importExport.dataset.promo-codes',
  descriptionKey: 'admin.importExport.dataset.promo-codes.desc',
  canExport: true,
  canImport: true,
  columns: promoColumns,

  async exportMatrix(db) {
    const codes = await listPromoCodes(db);
    return codes.map((c) => [
      c.id,
      c.code,
      c.type,
      c.value,
      c.minOrderAmount ?? '',
      c.maxDiscount ?? '',
      c.isActive ?? true,
    ]);
  },

  async analyzeRows(db, records) {
    const existing = await listPromoCodes(db);
    const byId = new Map(existing.map((c) => [c.id, c]));
    const byCode = new Map<string, PromoCode>();
    for (const c of existing) byCode.set(c.code.toUpperCase(), c);

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const code = (rec.code ?? '').trim().toUpperCase();
      if (!code) return invalidPlan(row, 'Missing required value: code');
      const type = (rec.type ?? '').trim().toLowerCase();
      if (type !== 'percentage' && type !== 'fixed') {
        return invalidPlan(row, `Invalid type "${rec.type}" (expected percentage or fixed)`, code);
      }
      const value = parseNumber(rec.value);
      if (value === null) return invalidPlan(row, 'Missing or invalid value', code);
      const minOrderAmount = parseNumber(rec.minOrderAmount);
      const maxDiscount = parseNumber(rec.maxDiscount);
      const input: PromoCodeWriteInput = {
        code,
        type,
        value,
        isActive: parseBool(rec.isActive, true),
        ...(minOrderAmount !== null ? { minOrderAmount } : {}),
        ...(maxDiscount !== null ? { maxDiscount } : {}),
      };
      const explicitId = (rec.id ?? '').trim() || undefined;
      const payload: PromoPayload = { input, explicitId };
      const match = explicitId ? byId.get(explicitId) : byCode.get(code);
      const key = explicitId ?? code;
      return match
        ? duplicatePlan(row, key, code, match.id, payload, ['skip', 'overwrite', 'create'])
        : newPlan(row, key, code, payload);
    });
  },

  applyRows: (db, decided) =>
    applyWrites(decided, async (payload: PromoPayload, action, existingId, isNew) => {
      if (action === 'overwrite' && existingId) {
        await updatePromoCode(db, existingId, payload.input);
        return { status: 'updated', key: existingId };
      }
      const id = await createPromoCode(db, payload.input, isNew ? payload.explicitId : undefined);
      return { status: 'created', key: id };
    }),
};

// --- Subscribers ------------------------------------------------------------

const subscriberColumns: ColumnMeta[] = [
  { header: 'email', required: true, sample: 'shopper@example.com' },
  { header: 'subscribedAt', sample: '', help: 'Export only — ignored on import (the signup time is stamped automatically).' },
];

export const SUBSCRIBERS_DATASET: DatasetDescriptor = {
  id: 'subscribers',
  labelKey: 'admin.importExport.dataset.subscribers',
  descriptionKey: 'admin.importExport.dataset.subscribers.desc',
  canExport: true,
  canImport: true,
  columns: subscriberColumns,

  async exportMatrix(db) {
    const subs = await listSubscribers(db);
    return subs.map((s) => [s.email, isoFromTs(s.subscribedAt)]);
  },

  async analyzeRows(db, records) {
    const existing = await listSubscribers(db);
    const byEmail = new Map(existing.map((s) => [s.email.toLowerCase(), s]));

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const email = (rec.email ?? '').trim().toLowerCase();
      if (!email) return invalidPlan(row, 'Missing required value: email');
      const match = byEmail.get(email);
      // A subscriber is just an email — overwriting is meaningless, so dup → skip only.
      return match
        ? duplicatePlan(row, email, email, match.id, { email }, ['skip'])
        : newPlan(row, email, email, { email });
    });
  },

  applyRows: (db, decided) =>
    applyWrites(decided, async (payload: { email: string }) => {
      const result = await subscribeEmail(db, payload.email);
      return { status: result === 'subscribed' ? 'created' : 'skipped', key: payload.email };
    }),
};
