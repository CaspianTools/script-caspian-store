import type { FeatureFlags, ThemeTokens } from '../../types';

/**
 * Pre-flight checklist (v8.7.0). Each entry maps to one row in the
 * <PrereqsStep>. The step is satisfied when every required entry is
 * acknowledged. Optional entries don't block "Begin installation."
 */
export interface PrereqsDraft {
  firebaseProject: boolean;
  firebaseWebConfig: boolean;
  serviceAccount: boolean;
  brandAssets: boolean;
  contactEmail: boolean;
  toolchain: boolean;
  /** Stripe is optional — only required if payments will be enabled. */
  stripeKeys: boolean;
}

/**
 * Super-admin designation step (v8.7.0). The installer either signs in
 * (and immediately becomes admin via `claimAdmin`) or designates a
 * future admin by email — that email lands in `pendingSuperAdmin/{email}`
 * and the `onUserCreate` Cloud Function promotes the matching account
 * on its first signup.
 */
export type SuperAdminMethod = 'signin' | 'email';

export interface SuperAdminDraft {
  method: SuperAdminMethod;
  /** When method='email', the address that will become admin on first signup. */
  email: string;
  /** When method='signin', the uid of the user who claimed admin in this session. */
  signedInUid: string;
}

export interface SiteInfoDraft {
  brandName: string;
  brandDescription: string;
  contactEmail: string;
  currency: string;
}

export interface BrandingDraft {
  /**
   * Name of the selected preset in `THEME_PRESETS` (currently `'cleanWhite'`),
   * or empty string for custom/unset.
   */
  themePreset: string;
  theme: ThemeTokens;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
}

/**
 * Template-picker draft (v8.23.0). The owner selects one of the bundled
 * storefront templates — or empty string for "Start blank". When
 * non-empty, the wizard:
 *   1. Pre-populates the branding step's theme + hero with the template's
 *      defaults (the owner can still edit before saving).
 *   2. Calls `applyTemplate(db, templateId, { mode: 'merge' })` on wizard
 *      completion, before redirecting to /admin.
 */
export interface TemplateDraft {
  /** Empty string for "Start blank — no template will be applied". */
  templateId: string;
}

export interface WizardDraft {
  prereqs: PrereqsDraft;
  superAdmin: SuperAdminDraft;
  siteInfo: SiteInfoDraft;
  template: TemplateDraft;
  branding: BrandingDraft;
  features: FeatureFlags;
}
