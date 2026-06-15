import {
  BookmarkIcon,
  RefreshIcon,
  TicketIcon,
  StarIcon,
  LayersIcon,
  PaletteIcon,
  PackageIcon,
  TableIcon,
  UserIcon,
  UsersIcon,
  MapPinIcon,
  CheckIcon,
} from '../ui/icons';
import type { TaxonomyDef, TaxonomyGroupDef } from './types';

const SZ = 16;

/** Display order of the catalog's category groups. */
export const TAXONOMY_GROUPS: TaxonomyGroupDef[] = [
  { id: 'merchandising', labelKey: 'admin.taxonomies.group.merchandising' },
  { id: 'attributes', labelKey: 'admin.taxonomies.group.attributes' },
  { id: 'audience', labelKey: 'admin.taxonomies.group.audience' },
  { id: 'careOrigin', labelKey: 'admin.taxonomies.group.careOrigin' },
];

/**
 * The common product taxonomies a store may enable. Brands is the one bespoke
 * entry (its own page + collection); the rest are generic flat term lists.
 * Add a taxonomy by appending an entry here — the Settings toggles, the
 * onboarding step, and the Taxonomies sidebar are all driven off this list.
 */
export const COMMON_TAXONOMIES: TaxonomyDef[] = [
  // --- Merchandising ---
  {
    id: 'brands',
    labelKey: 'admin.taxonomies.def.brands.label',
    descriptionKey: 'admin.taxonomies.def.brands.desc',
    icon: <BookmarkIcon size={SZ} />,
    group: 'merchandising',
    defaultEnabled: true,
    kind: 'brands',
  },
  {
    id: 'seasons',
    labelKey: 'admin.taxonomies.def.seasons.label',
    descriptionKey: 'admin.taxonomies.def.seasons.desc',
    icon: <RefreshIcon size={SZ} />,
    group: 'merchandising',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'occasions',
    labelKey: 'admin.taxonomies.def.occasions.label',
    descriptionKey: 'admin.taxonomies.def.occasions.desc',
    icon: <TicketIcon size={SZ} />,
    group: 'merchandising',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'trends',
    labelKey: 'admin.taxonomies.def.trends.label',
    descriptionKey: 'admin.taxonomies.def.trends.desc',
    icon: <StarIcon size={SZ} />,
    group: 'merchandising',
    defaultEnabled: false,
    kind: 'generic',
  },

  // --- Attributes ---
  {
    id: 'materials',
    labelKey: 'admin.taxonomies.def.materials.label',
    descriptionKey: 'admin.taxonomies.def.materials.desc',
    icon: <LayersIcon size={SZ} />,
    group: 'attributes',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'colors',
    labelKey: 'admin.taxonomies.def.colors.label',
    descriptionKey: 'admin.taxonomies.def.colors.desc',
    icon: <PaletteIcon size={SZ} />,
    group: 'attributes',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'sizes',
    labelKey: 'admin.taxonomies.def.sizes.label',
    descriptionKey: 'admin.taxonomies.def.sizes.desc',
    icon: <PackageIcon size={SZ} />,
    group: 'attributes',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'patterns',
    labelKey: 'admin.taxonomies.def.patterns.label',
    descriptionKey: 'admin.taxonomies.def.patterns.desc',
    icon: <TableIcon size={SZ} />,
    group: 'attributes',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'fit',
    labelKey: 'admin.taxonomies.def.fit.label',
    descriptionKey: 'admin.taxonomies.def.fit.desc',
    icon: <UserIcon size={SZ} />,
    group: 'attributes',
    defaultEnabled: false,
    kind: 'generic',
  },

  // --- Audience ---
  {
    id: 'gender',
    labelKey: 'admin.taxonomies.def.gender.label',
    descriptionKey: 'admin.taxonomies.def.gender.desc',
    icon: <UsersIcon size={SZ} />,
    group: 'audience',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'ageGroup',
    labelKey: 'admin.taxonomies.def.ageGroup.label',
    descriptionKey: 'admin.taxonomies.def.ageGroup.desc',
    icon: <UserIcon size={SZ} />,
    group: 'audience',
    defaultEnabled: false,
    kind: 'generic',
  },

  // --- Care & origin ---
  {
    id: 'care',
    labelKey: 'admin.taxonomies.def.care.label',
    descriptionKey: 'admin.taxonomies.def.care.desc',
    icon: <RefreshIcon size={SZ} />,
    group: 'careOrigin',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'countryOfOrigin',
    labelKey: 'admin.taxonomies.def.countryOfOrigin.label',
    descriptionKey: 'admin.taxonomies.def.countryOfOrigin.desc',
    icon: <MapPinIcon size={SZ} />,
    group: 'careOrigin',
    defaultEnabled: false,
    kind: 'generic',
  },
  {
    id: 'certifications',
    labelKey: 'admin.taxonomies.def.certifications.label',
    descriptionKey: 'admin.taxonomies.def.certifications.desc',
    icon: <CheckIcon size={SZ} />,
    group: 'careOrigin',
    defaultEnabled: false,
    kind: 'generic',
  },
];

export const TAXONOMY_BY_ID: Record<string, TaxonomyDef> = Object.fromEntries(
  COMMON_TAXONOMIES.map((t) => [t.id, t]),
);

/** Generic taxonomy ids (everything except bespoke Brands) — used by import/export. */
export const GENERIC_TAXONOMY_IDS: string[] = COMMON_TAXONOMIES.filter(
  (t) => t.kind === 'generic',
).map((t) => t.id);

/**
 * Resolve the effective set of enabled taxonomy ids. When the store has never
 * set `enabledTaxonomies` (undefined), fall back to the catalog defaults so
 * existing stores keep Brands with no migration. Filters out unknown ids.
 */
export function resolveEnabledTaxonomies(enabled: string[] | undefined): string[] {
  if (enabled) return enabled.filter((id) => id in TAXONOMY_BY_ID);
  return COMMON_TAXONOMIES.filter((t) => t.defaultEnabled).map((t) => t.id);
}

/** The catalog entries that are currently enabled, in catalog order. */
export function enabledTaxonomyDefs(enabled: string[] | undefined): TaxonomyDef[] {
  const set = new Set(resolveEnabledTaxonomies(enabled));
  return COMMON_TAXONOMIES.filter((t) => set.has(t.id));
}
