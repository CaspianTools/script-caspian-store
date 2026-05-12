'use client';

import type { CSSProperties } from 'react';
import { useT } from '../../../i18n';
import type { WizardDraft } from '../setup-types';

export interface SummaryStepProps {
  draft: WizardDraft;
  onEdit: (stepIndex: number) => void;
}

export function SummaryStep({ draft, onEdit }: SummaryStepProps) {
  const t = useT();
  const enabledFeatures = (Object.keys(draft.features) as Array<keyof typeof draft.features>)
    .filter((key) => draft.features[key])
    .map((key) => t(`setup.features.${String(key)}.title`));

  // Step indices match setup-wizard.tsx (v8.7.0): 0 prereqs, 1 superAdmin,
  // 2 siteInfo, 3 branding, 4 features, 5 summary.
  const superAdminValue =
    draft.superAdmin.method === 'signin'
      ? draft.superAdmin.signedInUid
        ? t('setup.summary.superAdminSignedIn')
        : '—'
      : draft.superAdmin.email || '—';

  return (
    <div style={card}>
      <Row
        label={t('setup.summary.superAdmin')}
        value={superAdminValue}
        onEdit={() => onEdit(1)}
      />
      <Divider />
      <Row
        label={t('setup.summary.brand')}
        value={draft.siteInfo.brandName || '—'}
        onEdit={() => onEdit(2)}
      />
      <Row
        label={t('setup.summary.contactEmail')}
        value={draft.siteInfo.contactEmail || '—'}
        onEdit={() => onEdit(2)}
      />
      <Row
        label={t('setup.summary.currency')}
        value={draft.siteInfo.currency || 'USD'}
        onEdit={() => onEdit(2)}
      />
      <Divider />
      <Row
        label={t('setup.summary.theme')}
        value={draft.branding.themePreset || t('setup.summary.themeCustom')}
        onEdit={() => onEdit(3)}
      />
      <Row
        label={t('setup.summary.hero')}
        value={draft.branding.heroTitle || '—'}
        onEdit={() => onEdit(3)}
      />
      <Divider />
      <Row
        label={t('setup.summary.features')}
        value={enabledFeatures.length ? enabledFeatures.join(', ') : t('setup.summary.noFeatures')}
        onEdit={() => onEdit(4)}
      />
    </div>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div style={row}>
      <div style={rowText}>
        <span style={rowLabel}>{label}</span>
        <span style={rowValue}>{value}</span>
      </div>
      <button type="button" onClick={onEdit} style={editLink}>
        Edit
      </button>
    </div>
  );
}

function Divider() {
  return <div style={divider} />;
}

const card: CSSProperties = {
  background: '#F8FAFF',
  border: '1px solid #E4E8F2',
  borderRadius: 10,
  padding: '6px 18px',
};

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
};

const rowText: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
  minWidth: 0,
};

const rowLabel: CSSProperties = {
  fontSize: 12,
  color: '#6A7A8A',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
};

const rowValue: CSSProperties = {
  fontSize: 14,
  color: '#022959',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const editLink: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#022959',
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
};

const divider: CSSProperties = {
  height: 1,
  background: '#E4E8F2',
  margin: '2px 0',
};
