/**
 * Returns a shallow copy of `obj` with `undefined`-valued keys omitted.
 *
 * Firestore's SDK rejects any document field whose value is `undefined`
 * (it accepts `null` or omitted keys, but not `undefined`). Service-layer
 * write functions that may receive optional/blank fields from forms route
 * their payloads through this helper before calling `addDoc`, `setDoc`, or
 * `updateDoc`.
 *
 * Preserves `null`, `false`, `0`, `''`, and empty arrays/objects — Firestore
 * accepts all of those.
 */
export function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}

/** True for a bare `{}` object literal (not an array, Date, Timestamp, class instance, …). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively strips `undefined`-valued keys from an object/array tree (the page
 * builder persists nested block trees, which the shallow variant can't clean).
 * `Timestamp`, `GeoPoint`, and `DocumentReference` are returned as-is, so
 * Firestore's special field types survive intact.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[key] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}
