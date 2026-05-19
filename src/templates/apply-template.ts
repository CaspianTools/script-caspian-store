/**
 * `applyTemplate()` — seed a Firestore project with the bundled content
 * from a [TemplateDefinition](./types.ts). Called from the
 * `/admin/templates` page after admin confirmation, and from the setup
 * wizard's template-picker step on wizard completion.
 *
 * Two modes:
 *   - `merge` (default, idempotent): for each collection, write only docs
 *     whose id is unused. Re-applying the same template is a no-op.
 *   - `replace` (destructive, requires UI confirm): wipe the relevant
 *     collections first, then write the template. Used by the "reset to
 *     sample data" affordance.
 *
 * Settings docs (`scriptSettings/site`, `settings/site`) follow the same
 * semantics — merge fills in blank fields, replace overwrites.
 *
 * This function runs against the **client** Firestore SDK with the
 * caller's auth — they must have `users/{uid}.role === 'admin'` for the
 * Firestore rules to allow the writes.
 */

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type {
  ApplyTemplateMode,
  ApplyTemplateOptions,
  ApplyTemplateResult,
  TemplateDefinition,
} from './types';
import { TEMPLATE_CATALOG } from './catalog';

/**
 * Resolve a template by id and apply it. Throws if the id is unknown.
 */
export async function applyTemplate(
  db: Firestore,
  templateId: string,
  options: ApplyTemplateOptions = {},
): Promise<ApplyTemplateResult> {
  const template = TEMPLATE_CATALOG[templateId];
  if (!template) {
    throw new Error(
      `Unknown template id: "${templateId}". Known ids: ${Object.keys(TEMPLATE_CATALOG).join(', ')}.`,
    );
  }
  const mode: ApplyTemplateMode = options.mode ?? 'merge';
  const dryRun = options.dryRun ?? false;

  if (dryRun) {
    return computeDryRun(db, template, mode);
  }

  if (mode === 'replace') {
    await wipeTemplateCollections(db);
  }

  const written = {
    brands: 0,
    categories: 0,
    products: 0,
    pages: 0,
    journal: 0,
    settings: false,
  };
  const skipped = {
    brands: 0,
    categories: 0,
    products: 0,
    pages: 0,
    journal: 0,
  };

  // 1. Brands. Must land before products so the admin Products page can
  //    resolve each product's `brand` field to a brand doc id and skip
  //    the "legacy free-text brand" warning. v8.23.2+.
  for (const brand of template.brands) {
    const ref = doc(db, 'productBrands', brand.id);
    const exists = mode === 'merge' && (await getDoc(ref)).exists();
    if (exists) {
      skipped.brands += 1;
      continue;
    }
    await setDoc(ref, {
      ...brand,
      createdAt: serverTimestamp(),
    });
    written.brands += 1;
  }

  // 3. Categories.
  for (const cat of template.categories) {
    const ref = doc(db, 'productCategories', cat.id);
    const exists = mode === 'merge' && (await getDoc(ref)).exists();
    if (exists) {
      skipped.categories += 1;
      continue;
    }
    await setDoc(ref, {
      ...cat,
      createdAt: serverTimestamp(),
    });
    written.categories += 1;
  }

  // 4. Products.
  for (const product of template.products) {
    const ref = doc(db, 'products', product.id);
    const exists = mode === 'merge' && (await getDoc(ref)).exists();
    if (exists) {
      skipped.products += 1;
      continue;
    }
    await setDoc(ref, {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    written.products += 1;
  }

  // 5. Pages.
  for (const page of template.pages) {
    const ref = doc(db, 'pageContents', page.id);
    const exists = mode === 'merge' && (await getDoc(ref)).exists();
    if (exists) {
      skipped.pages += 1;
      continue;
    }
    await setDoc(ref, {
      ...page,
      updatedAt: serverTimestamp(),
    });
    written.pages += 1;
  }

  // 6. Journal (optional).
  for (const article of template.journal ?? []) {
    const ref = doc(db, 'journal', article.id);
    const exists = mode === 'merge' && (await getDoc(ref)).exists();
    if (exists) {
      skipped.journal += 1;
      continue;
    }
    await setDoc(ref, {
      ...article,
      createdAt: serverTimestamp(),
    });
    written.journal += 1;
  }

  // 7. Settings docs. Always written (no skip in merge mode for settings —
  //    the assumption is the admin picked this template to set the look,
  //    which means overwriting the existing theme/hero is desired). In
  //    merge mode we still preserve fields the template doesn't specify
  //    (brandName, defaultCurrency, etc.) by reading the current settings
  //    doc first and spreading.
  await applySettings(db, template, mode);
  written.settings = true;

  return {
    ok: true,
    templateId: template.id,
    mode,
    written,
    skipped,
  };
}

/**
 * Delete all docs in the template-managed collections. Used by replace
 * mode. We delete one-by-one (no batch) because the client SDK's batch
 * is capped at 500 operations and we want forward-compatibility with
 * larger consumer datasets — chunking would just complicate the surface
 * for the same effective speed.
 *
 * v8.23.2 adds `productBrands` to the wiped list so replace mode also
 * resets brand references the template will recreate.
 */
async function wipeTemplateCollections(db: Firestore): Promise<void> {
  const collections = [
    'productBrands',
    'productCategories',
    'products',
    'pageContents',
    'journal',
  ];
  for (const name of collections) {
    const snap = await getDocs(collection(db, name));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }
}

/**
 * Write the template's theme + hero + feature flags to `scriptSettings/site`,
 * and the optional branding defaults to `settings/site`. Reads the existing
 * settings first to preserve unrelated fields (brand name, currency, etc.).
 */
async function applySettings(
  db: Firestore,
  template: TemplateDefinition,
  mode: ApplyTemplateMode,
): Promise<void> {
  // scriptSettings/site
  const scriptRef = doc(db, 'scriptSettings', 'site');
  const scriptSnap = await getDoc(scriptRef);
  const existingScript = scriptSnap.exists() ? scriptSnap.data() : {};
  await setDoc(
    scriptRef,
    {
      ...existingScript,
      theme: template.theme,
      hero: template.hero,
      features: { ...existingScript.features, ...template.features },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  // settings/site — only touch when the template ships branding defaults.
  if (template.branding) {
    const siteRef = doc(db, 'settings', 'site');
    const siteSnap = await getDoc(siteRef);
    const existingSite = siteSnap.exists() ? siteSnap.data() : {};
    const patch: Record<string, unknown> = {};
    if (template.branding.logoUrl !== undefined) {
      patch.logoUrl =
        mode === 'replace' || !existingSite.logoUrl
          ? template.branding.logoUrl
          : existingSite.logoUrl;
    }
    if (template.branding.faviconUrl !== undefined) {
      patch.faviconUrl =
        mode === 'replace' || !existingSite.faviconUrl
          ? template.branding.faviconUrl
          : existingSite.faviconUrl;
    }
    if (template.branding.brandDescription !== undefined) {
      patch.brandDescription =
        mode === 'replace' || !existingSite.brandDescription
          ? template.branding.brandDescription
          : existingSite.brandDescription;
    }
    if (Object.keys(patch).length > 0) {
      await setDoc(siteRef, patch, { merge: true });
    }
  }
}

/**
 * Compute what `applyTemplate()` would write/skip without touching
 * Firestore. Used by the admin UI to render the diff preview.
 */
async function computeDryRun(
  db: Firestore,
  template: TemplateDefinition,
  mode: ApplyTemplateMode,
): Promise<ApplyTemplateResult> {
  const written = {
    brands: 0,
    categories: 0,
    products: 0,
    pages: 0,
    journal: 0,
    settings: true,
  };
  const skipped = {
    brands: 0,
    categories: 0,
    products: 0,
    pages: 0,
    journal: 0,
  };

  if (mode === 'replace') {
    // Every bundled doc will be written; nothing is skipped.
    written.brands = template.brands.length;
    written.categories = template.categories.length;
    written.products = template.products.length;
    written.pages = template.pages.length;
    written.journal = template.journal?.length ?? 0;
    return { ok: true, templateId: template.id, mode, written, skipped };
  }

  // Merge mode — check each id against Firestore.
  for (const brand of template.brands) {
    const exists = (await getDoc(doc(db, 'productBrands', brand.id))).exists();
    if (exists) skipped.brands += 1;
    else written.brands += 1;
  }
  for (const cat of template.categories) {
    const exists = (await getDoc(doc(db, 'productCategories', cat.id))).exists();
    if (exists) skipped.categories += 1;
    else written.categories += 1;
  }
  for (const product of template.products) {
    const exists = (await getDoc(doc(db, 'products', product.id))).exists();
    if (exists) skipped.products += 1;
    else written.products += 1;
  }
  for (const page of template.pages) {
    const exists = (await getDoc(doc(db, 'pageContents', page.id))).exists();
    if (exists) skipped.pages += 1;
    else written.pages += 1;
  }
  for (const article of template.journal ?? []) {
    const exists = (await getDoc(doc(db, 'journal', article.id))).exists();
    if (exists) skipped.journal += 1;
    else written.journal += 1;
  }

  return { ok: true, templateId: template.id, mode, written, skipped };
}

/**
 * Count the docs that replace mode would delete. Used by the admin UI
 * to size the "this will wipe X products / Y categories / ..." confirmation
 * line before the destructive action.
 */
export async function countWipeImpact(db: Firestore): Promise<{
  brands: number;
  categories: number;
  products: number;
  pages: number;
  journal: number;
}> {
  const [brands, cats, products, pages, journal] = await Promise.all([
    getDocs(collection(db, 'productBrands')),
    getDocs(collection(db, 'productCategories')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'pageContents')),
    getDocs(collection(db, 'journal')),
  ]);
  return {
    brands: brands.size,
    categories: cats.size,
    products: products.size,
    pages: pages.size,
    journal: journal.size,
  };
}

/**
 * Re-export the helper so consumers can stamp template product objects
 * with the same Timestamp shape we use internally. Useful if a consumer
 * builds a one-off template at runtime and wants `createdAt` / `updatedAt`
 * to look like the script-generated values.
 */
export function nowTimestamp(): Timestamp {
  return Timestamp.now();
}
