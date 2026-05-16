'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScriptSettings } from '../../context/script-settings-context';
import { useT } from '../../i18n';
import { useCaspianFirebase, useCaspianNavigation } from '../../provider/caspian-store-provider';
import { getSiteSettings, saveSiteSettings } from '../../services/site-settings-service';
import { applyTemplate } from '../../templates/apply-template';
import { getTemplate } from '../../templates/catalog';
import { DEFAULT_SCRIPT_SETTINGS, type SiteSettings } from '../../types';
import { SetupShell } from './setup-shell';
import type { SetupStep } from './setup-stepper';
import { SetupButton } from './setup-ui';
import { PrereqsStep, isPrereqsComplete } from './steps/prereqs-step';
import { SuperAdminStep, isSuperAdminComplete } from './steps/super-admin-step';
import { SiteInfoStep } from './steps/site-info-step';
import { TemplatePickerStep } from './steps/template-picker-step';
import { BrandingStep } from './steps/branding-step';
import { FeaturesStep } from './steps/features-step';
import { SummaryStep } from './steps/summary-step';
import type { BrandingDraft, WizardDraft } from './setup-types';

export interface SetupWizardProps {
  /** Destination after the user clicks "Open my store" on the summary step. */
  finishHref?: string;
}

type FieldErrors = { brandName?: string; contactEmail?: string };

const emptyDraft = (): WizardDraft => ({
  prereqs: {
    firebaseProject: false,
    firebaseWebConfig: false,
    serviceAccount: false,
    brandAssets: false,
    contactEmail: false,
    toolchain: false,
    stripeKeys: false,
  },
  superAdmin: {
    method: 'signin',
    email: '',
    signedInUid: '',
  },
  siteInfo: {
    brandName: '',
    brandDescription: '',
    contactEmail: '',
    currency: DEFAULT_SCRIPT_SETTINGS.defaultCurrency,
  },
  template: {
    templateId: '',
  },
  branding: {
    themePreset: '',
    theme: { ...DEFAULT_SCRIPT_SETTINGS.theme },
    heroTitle: DEFAULT_SCRIPT_SETTINGS.hero?.title ?? '',
    heroSubtitle: DEFAULT_SCRIPT_SETTINGS.hero?.subtitle ?? '',
    heroCta: DEFAULT_SCRIPT_SETTINGS.hero?.cta ?? '',
  },
  features: { ...DEFAULT_SCRIPT_SETTINGS.features },
});

// Step indices — bumped from 0..5 in v8.7.x to 0..6 in v8.23.0 with the
// addition of the template-picker step (3). Branding/features/summary
// shifted by +1.
const STEP_PREREQS = 0;
const STEP_SUPER_ADMIN = 1;
const STEP_SITE_INFO = 2;
const STEP_TEMPLATE = 3;
const STEP_BRANDING = 4;
const STEP_FEATURES = 5;
const STEP_SUMMARY = 6;

export function SetupWizard({ finishHref = '/admin' }: SetupWizardProps) {
  const t = useT();
  const { db } = useCaspianFirebase();
  const navigation = useCaspianNavigation();
  const scriptSettings = useScriptSettings();

  const [currentIndex, setCurrentIndex] = useState(STEP_PREREQS);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Seed draft with any existing settings/site on mount.
  useEffect(() => {
    let cancelled = false;
    getSiteSettings(db)
      .then((existing) => {
        if (cancelled || !existing) return;
        setDraft((d) => ({
          ...d,
          siteInfo: {
            brandName: existing.brandName || d.siteInfo.brandName,
            brandDescription: existing.brandDescription || d.siteInfo.brandDescription,
            contactEmail: existing.contactEmail || d.siteInfo.contactEmail,
            currency: existing.currency || d.siteInfo.currency,
          },
        }));
      })
      .catch(() => {
        // Swallow — wizard stays with defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Seed draft from scriptSettings once they load.
  useEffect(() => {
    if (scriptSettings.loading) return;
    setDraft((d) => ({
      ...d,
      branding: {
        themePreset: d.branding.themePreset,
        theme: scriptSettings.settings.theme,
        heroTitle: scriptSettings.settings.hero?.title ?? d.branding.heroTitle,
        heroSubtitle: scriptSettings.settings.hero?.subtitle ?? d.branding.heroSubtitle,
        heroCta: scriptSettings.settings.hero?.cta ?? d.branding.heroCta,
      },
      features: scriptSettings.settings.features,
    }));
  }, [scriptSettings.loading, scriptSettings.settings]);

  const steps: SetupStep[] = useMemo(
    () => [
      { key: 'prereqs', label: t('setup.steps.prereqs') },
      { key: 'super-admin', label: t('setup.steps.superAdmin') },
      { key: 'site-info', label: t('setup.steps.siteInfo') },
      { key: 'template', label: 'Template' },
      { key: 'branding', label: t('setup.steps.branding') },
      { key: 'features', label: t('setup.steps.features') },
      { key: 'summary', label: t('setup.steps.summary') },
    ],
    [t],
  );

  const validateSiteInfo = useCallback((): FieldErrors => {
    const errors: FieldErrors = {};
    if (!draft.siteInfo.brandName.trim()) {
      errors.brandName = t('setup.errors.brandNameRequired');
    }
    const email = draft.siteInfo.contactEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.contactEmail = t('setup.errors.contactEmailInvalid');
    }
    return errors;
  }, [draft.siteInfo.brandName, draft.siteInfo.contactEmail, t]);

  const commitStep = useCallback(async () => {
    if (currentIndex === STEP_PREREQS) {
      if (!isPrereqsComplete(draft.prereqs)) {
        throw new Error('prereqs-incomplete');
      }
      return;
    }
    if (currentIndex === STEP_SUPER_ADMIN) {
      if (!isSuperAdminComplete(draft.superAdmin)) {
        throw new Error('super-admin-incomplete');
      }
      return;
    }
    if (currentIndex === STEP_SITE_INFO) {
      const errors = validateSiteInfo();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        throw new Error('validation');
      }
      const existing = await getSiteSettings(db);
      const merged: SiteSettings = {
        logoUrl: existing?.logoUrl ?? '',
        faviconUrl: existing?.faviconUrl,
        brandName: draft.siteInfo.brandName.trim(),
        brandDescription: draft.siteInfo.brandDescription.trim(),
        contactEmail: draft.siteInfo.contactEmail.trim(),
        contactPhone: existing?.contactPhone ?? '',
        contactAddress: existing?.contactAddress ?? '',
        businessHours: existing?.businessHours ?? '',
        currency: draft.siteInfo.currency.trim() || undefined,
        timezone: existing?.timezone,
        country: existing?.country,
        socialLinks: existing?.socialLinks ?? [],
      };
      await saveSiteSettings(db, merged);
      return;
    }
    if (currentIndex === STEP_TEMPLATE) {
      // No Firestore writes here — the actual `applyTemplate()` call runs
      // in `finish()` on wizard completion (after the owner has had a
      // chance to tweak branding + features). When a template is picked
      // we pre-populate the branding draft with its theme + hero so the
      // owner sees the template's design on the next screen.
      const tpl = draft.template.templateId
        ? getTemplate(draft.template.templateId)
        : undefined;
      if (tpl) {
        setDraft((d) => ({
          ...d,
          branding: {
            themePreset: '',
            theme: tpl.theme,
            heroTitle: tpl.hero.title,
            heroSubtitle: tpl.hero.subtitle,
            heroCta: tpl.hero.cta,
          },
        }));
      }
      return;
    }
    if (currentIndex === STEP_BRANDING) {
      await scriptSettings.save({
        brandName: draft.siteInfo.brandName.trim() || scriptSettings.settings.brandName,
        defaultCurrency:
          draft.siteInfo.currency.trim() || scriptSettings.settings.defaultCurrency,
        theme: draft.branding.theme,
        hero: {
          title: draft.branding.heroTitle,
          subtitle: draft.branding.heroSubtitle,
          cta: draft.branding.heroCta,
          ctaHref: scriptSettings.settings.hero?.ctaHref ?? '/collections',
          imageUrl: scriptSettings.settings.hero?.imageUrl,
        },
      });
      return;
    }
    if (currentIndex === STEP_FEATURES) {
      await scriptSettings.save({ features: draft.features });
      return;
    }
  }, [currentIndex, draft, db, scriptSettings, validateSiteInfo]);

  const next = useCallback(async () => {
    setSaving(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      await commitStep();
      setCurrentIndex((i) => Math.min(steps.length - 1, i + 1));
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'validation') return; // field errors set
        if (err.message === 'prereqs-incomplete') {
          setSubmitError(t('setup.prereqs.incomplete'));
          return;
        }
        if (err.message === 'super-admin-incomplete') {
          setSubmitError(t('setup.superAdmin.incomplete'));
          return;
        }
      }
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message)
          : t('setup.errors.saveFailed');
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  }, [commitStep, steps.length, t]);

  const back = useCallback(() => {
    setSubmitError(null);
    setFieldErrors({});
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const finish = useCallback(async () => {
    // v8.23.0 — if the owner picked a template at the template step, apply
    // it now (after branding + features have been tuned to their liking).
    // Merge mode so we never destroy data they might have entered while
    // the wizard was open. Failures are surfaced but do not block the
    // redirect — the admin can re-apply from /admin/templates if needed.
    setSubmitError(null);
    if (draft.template.templateId) {
      setSaving(true);
      try {
        await applyTemplate(db, draft.template.templateId, { mode: 'merge' });
      } catch (err) {
        setSubmitError(
          err instanceof Error
            ? `Template apply failed: ${err.message}`
            : 'Template apply failed.',
        );
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    navigation.push(finishHref);
  }, [draft.template.templateId, db, navigation, finishHref]);

  const isLast = currentIndex === STEP_SUMMARY;
  const isFirst = currentIndex === STEP_PREREQS;
  const headings = useMemo(
    () => [
      { heading: t('setup.prereqs.heading'), subhead: t('setup.prereqs.subhead') },
      { heading: t('setup.superAdmin.heading'), subhead: t('setup.superAdmin.subhead') },
      { heading: t('setup.siteInfo.heading'), subhead: t('setup.siteInfo.subhead') },
      {
        heading: 'Pick a starter template',
        subhead:
          'Seed your storefront with sample content + theme, or start blank.',
      },
      { heading: t('setup.branding.heading'), subhead: t('setup.branding.subhead') },
      { heading: t('setup.features.heading'), subhead: t('setup.features.subhead') },
      { heading: t('setup.summary.heading'), subhead: t('setup.summary.subhead') },
    ],
    [t],
  );

  const content = (() => {
    switch (currentIndex) {
      case STEP_PREREQS:
        return (
          <PrereqsStep
            draft={draft.prereqs}
            onChange={(patch) =>
              setDraft((d) => ({ ...d, prereqs: { ...d.prereqs, ...patch } }))
            }
          />
        );
      case STEP_SUPER_ADMIN:
        return (
          <SuperAdminStep
            draft={draft.superAdmin}
            onChange={(patch) =>
              setDraft((d) => ({ ...d, superAdmin: { ...d.superAdmin, ...patch } }))
            }
          />
        );
      case STEP_SITE_INFO:
        return (
          <SiteInfoStep
            draft={draft.siteInfo}
            onChange={(patch) =>
              setDraft((d) => ({ ...d, siteInfo: { ...d.siteInfo, ...patch } }))
            }
            errors={fieldErrors}
          />
        );
      case STEP_TEMPLATE:
        return (
          <TemplatePickerStep
            draft={draft.template}
            onChange={(patch) =>
              setDraft((d) => ({ ...d, template: { ...d.template, ...patch } }))
            }
          />
        );
      case STEP_BRANDING:
        return (
          <BrandingStep
            draft={draft.branding}
            onChange={(patch: Partial<BrandingDraft>) =>
              setDraft((d) => ({ ...d, branding: { ...d.branding, ...patch } }))
            }
          />
        );
      case STEP_FEATURES:
        return (
          <FeaturesStep
            draft={draft.features}
            onChange={(patch) =>
              setDraft((d) => ({ ...d, features: { ...d.features, ...patch } }))
            }
          />
        );
      case STEP_SUMMARY:
        return <SummaryStep draft={draft} onEdit={(i) => setCurrentIndex(i)} />;
      default:
        return null;
    }
  })();

  const completed = Array.from({ length: currentIndex }, (_, i) => i);

  // Step-zero CTA reads "Begin installation" rather than "Next step" so the
  // prereqs gate is obvious. Other steps keep the standard "Next step".
  const nextLabel = isFirst ? t('setup.prereqs.begin') : t('setup.next');

  return (
    <SetupShell
      steps={steps}
      currentIndex={currentIndex}
      completedIndices={completed}
      heading={headings[currentIndex]?.heading ?? ''}
      subhead={headings[currentIndex]?.subhead}
      footer={
        <>
          {!isFirst ? (
            <SetupButton variant="ghost" onClick={back} disabled={saving}>
              {t('setup.back')}
            </SetupButton>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {submitError && (
              <span style={{ fontSize: 12, color: '#DF4747' }}>{submitError}</span>
            )}
            {isLast ? (
              <SetupButton onClick={finish} disabled={saving}>
                {t('setup.summary.confirm')}
              </SetupButton>
            ) : (
              <SetupButton onClick={next} disabled={saving}>
                {saving ? t('setup.saving') : nextLabel}
              </SetupButton>
            )}
          </div>
        </>
      }
    >
      {content}
    </SetupShell>
  );
}
