import { deleteField, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { SiteSettings, SocialLink } from '../types';

/**
 * Loads the site-level settings doc (`settings/site`) that stores brand /
 * contact / logo / favicon / social links. Distinct from `scriptSettings/site`
 * (which holds theme + features + hero + fonts managed by the package).
 */
export async function getSiteSettings(db: Firestore): Promise<SiteSettings | null> {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  if (!snap.exists()) return null;
  return normalizeSiteSettings(snap.data());
}

const STRING_FIELDS = [
  'logoUrl',
  'faviconUrl',
  'brandName',
  'brandDescription',
  'contactEmail',
  'contactPhone',
  'contactAddress',
  'businessHours',
] as const;

/**
 * Coerces a stored `settings/site` doc into the shape the UI renders.
 * Stores migrated from other apps carry older shapes, and one bad field
 * crashed the whole Settings page (and the storefront footer). Known cases:
 * `socialLinks` saved as a `{ platform: url }` map instead of a list, and
 * text fields saved as null or numbers.
 */
export function normalizeSiteSettings(raw: Record<string, unknown>): SiteSettings {
  const out: Record<string, unknown> = { ...raw };
  for (const key of STRING_FIELDS) {
    const v = raw[key];
    out[key] = typeof v === 'string' ? v : v == null ? '' : String(v);
  }
  out.socialLinks = normalizeSocialLinks(raw.socialLinks);
  return out as unknown as SiteSettings;
}

function normalizeSocialLinks(raw: unknown): SocialLink[] {
  const valid = (platform: unknown, url: unknown): SocialLink | null =>
    typeof platform === 'string' && platform && typeof url === 'string' && url
      ? ({ platform, url } as SocialLink)
      : null;
  if (Array.isArray(raw)) {
    return raw
      .map((l) => (l && typeof l === 'object' ? valid((l as SocialLink).platform, (l as SocialLink).url) : null))
      .filter((l): l is SocialLink => l !== null);
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([platform, url]) => valid(platform, url))
      .filter((l): l is SocialLink => l !== null);
  }
  return [];
}

/**
 * Every write to `settings/site` touches only the top-level keys the caller
 * passed. Several admin pages (General, Shipping options, Taxonomies, the
 * setup wizard) each own a slice of the doc and load it at mount, so a full
 * overwrite from any one of them would clobber whatever another page saved
 * in the meantime. `mergeFields` (rather than `merge: true`) replaces each
 * listed key wholesale, so a nested map such as `taxConfig` is not deep-
 * merged with stale sub-keys. A key explicitly set to `undefined` is
 * deleted — Firestore rejects `undefined`, and stripping it would leave
 * the old value in place.
 */
async function writeSiteSettings(db: Firestore, input: Partial<SiteSettings>): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    const value = (input as Record<string, unknown>)[key];
    payload[key] = value === undefined ? deleteField() : value;
  }
  const keys = Object.keys(payload);
  if (keys.length === 0) return;
  await setDoc(doc(db, 'settings', 'site'), payload, { mergeFields: keys });
}

export async function saveSiteSettings(db: Firestore, input: SiteSettings): Promise<void> {
  await writeSiteSettings(db, input);
}

/** Writes only the given keys of `settings/site`, leaving every other key intact. */
export async function updateSiteSettings(
  db: Firestore,
  partial: Partial<SiteSettings>,
): Promise<void> {
  await writeSiteSettings(db, partial);
}
