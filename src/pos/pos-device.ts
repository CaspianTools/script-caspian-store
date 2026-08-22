'use client';

/**
 * This register's identity, held on the computer it runs on.
 *
 * The device id is the anchor for three separate things, which is why it is
 * generated once and never regenerated:
 *
 *   - **Idempotency.** Sale ids are `deviceId-counter`, and that id becomes the
 *     Firestore document id. Two registers can mint sale #7 on the same day
 *     without colliding, and one register replaying sale #7 after an outage
 *     collides with *itself* — which is exactly the behaviour that makes an
 *     offline replay commit exactly once.
 *   - **Attribution.** Every sale carries `deviceId`, so a shift report can be
 *     read per till and not just per cashier.
 *   - **Licensing.** A licence seat binds to this id, which is what makes
 *     "one licence per computer" mean anything.
 *
 * Clearing browser storage mints a new id. That is unavoidable in a browser,
 * and it is the reason the licence seat can be released and re-bound from the
 * admin panel rather than being a one-way door.
 */

const DEVICE_ID_KEY = 'caspian:pos:deviceId';
const DEVICE_LABEL_KEY = 'caspian:pos:deviceLabel';
const SALE_COUNTER_KEY = 'caspian:pos:saleCounter';

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked. The caller still gets a usable value for this session;
    // it just won't survive a reload, and a fresh id is harmless.
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  // Older webviews and non-secure contexts have no randomUUID. getRandomValues
  // is far more widely available; Math.random is the last resort and only
  // affects collision odds between registers, not correctness on one.
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}

/** This computer's register id, minting one on first call. */
export function getPosDeviceId(): string {
  const existing = readLocal(DEVICE_ID_KEY);
  if (existing && existing.length >= 8) return existing;
  const next = randomId();
  writeLocal(DEVICE_ID_KEY, next);
  return next;
}

export function getPosDeviceLabel(): string {
  return readLocal(DEVICE_LABEL_KEY) ?? '';
}

export function setPosDeviceLabel(label: string): void {
  writeLocal(DEVICE_LABEL_KEY, label.trim());
}

/**
 * Next sale id for this register: `deviceId-<counter>`.
 *
 * The counter is bumped and persisted *before* the sale is attempted, so a
 * crash mid-commit burns an id rather than reusing one. A gap in the sequence
 * costs nothing — receipt numbers are allocated server-side and stay
 * contiguous — whereas a reused id would silently return the previous sale as
 * a duplicate and lose the new one.
 */
export function nextPosSaleId(): string {
  const deviceId = getPosDeviceId();
  const current = Number.parseInt(readLocal(SALE_COUNTER_KEY) ?? '0', 10);
  const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
  writeLocal(SALE_COUNTER_KEY, String(next));
  return `${deviceId}-${next}`;
}
