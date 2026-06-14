import type { Timestamp } from 'firebase/firestore';
import type { DecidedRow, ImportSummary, RowAction, RowPlan, RowResult } from './types';

/** Split a `;`/`,`-delimited cell into a trimmed, non-empty list. */
export function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join a list back into a `;`-delimited cell. */
export function joinList(items: readonly string[] | undefined): string {
  return (items ?? []).join(';');
}

/** Tolerant boolean parse: true / 1 / yes / y → true. Blank → `fallback`. */
export function parseBool(raw: string | undefined, fallback = false): boolean {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return fallback;
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

/** Parse a finite number, or null when blank/invalid. */
export function parseNumber(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Encode a `Record<size, qty>` stock map as `S:3;M:5;L:0`. */
export function joinStock(stock: Record<string, number> | undefined): string {
  if (!stock) return '';
  return Object.entries(stock)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

/** Decode a `S:3;M:5` stock cell back to a `Record<size, qty>` map. */
export function parseStock(raw: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of parseList(raw)) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const size = part.slice(0, idx).trim();
    const qty = Number(part.slice(idx + 1).trim());
    if (size && Number.isFinite(qty)) out[size] = qty;
  }
  return out;
}

/** ISO-8601 string from a Firestore Timestamp, or '' when absent. */
export function isoFromTs(ts: Timestamp | undefined | null): string {
  return ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : '';
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Roll per-row results up into an `ImportSummary`. */
export function summarize(results: RowResult[]): ImportSummary {
  const summary: ImportSummary = {
    total: results.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    results,
  };
  for (const r of results) {
    if (r.status === 'created') summary.created += 1;
    else if (r.status === 'updated') summary.updated += 1;
    else if (r.status === 'skipped') summary.skipped += 1;
    else summary.errors += 1;
  }
  return summary;
}

// --- RowPlan constructors ---------------------------------------------------

export function invalidPlan(row: number, error: string, summary = ''): RowPlan {
  return { row, kind: 'invalid', key: null, summary, error, allowedActions: [], defaultAction: 'skip' };
}

export function newPlan(row: number, key: string | null, summary: string, payload: unknown): RowPlan {
  return {
    row,
    kind: 'new',
    key,
    summary,
    payload,
    allowedActions: ['create', 'skip'],
    defaultAction: 'create',
  };
}

export function duplicatePlan(
  row: number,
  key: string | null,
  summary: string,
  existingId: string,
  payload: unknown,
  actions: RowAction[] = ['skip', 'overwrite'],
): RowPlan {
  return {
    row,
    kind: 'duplicate',
    key,
    summary,
    existingId,
    payload,
    allowedActions: actions,
    defaultAction: 'skip',
  };
}

/**
 * Drive a per-row write loop with consistent skip/invalid/error handling.
 * `write` is only called for rows the user chose to create or overwrite; it
 * returns the row's success result. Used by the simpler datasets whose write
 * step is a single create/update call.
 */
export async function applyWrites<P>(
  decided: DecidedRow[],
  write: (
    payload: P,
    action: 'create' | 'overwrite',
    existingId: string | undefined,
    isNew: boolean,
  ) => Promise<{ status: 'created' | 'updated' | 'skipped'; key?: string }>,
): Promise<ImportSummary> {
  const results: RowResult[] = [];
  for (const { plan, action } of decided) {
    if (plan.kind === 'invalid') {
      results.push({ row: plan.row, status: 'error', message: plan.error });
      continue;
    }
    if (action === 'skip') {
      results.push({ row: plan.row, status: 'skipped', key: plan.key ?? undefined });
      continue;
    }
    try {
      const res = await write(plan.payload as P, action, plan.existingId, plan.kind === 'new');
      results.push({ row: plan.row, status: res.status, key: res.key });
    } catch (err) {
      results.push({ row: plan.row, status: 'error', message: errMsg(err) });
    }
  }
  return summarize(results);
}
