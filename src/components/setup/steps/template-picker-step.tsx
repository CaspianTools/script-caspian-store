'use client';

import type { CSSProperties } from 'react';
import { TEMPLATE_LIST } from '../../../templates/catalog';

export interface TemplatePickerStepProps {
  /** Empty string means "Start blank — no template will be applied". */
  draft: { templateId: string };
  onChange: (patch: { templateId: string }) => void;
}

/**
 * Setup-wizard step (v8.23.0) — owners pick one of the bundled
 * storefront templates (or "Start blank") before continuing to the
 * branding step. The chosen template's theme + hero pre-populate the
 * branding step. The actual `applyTemplate()` call runs on wizard
 * completion in [setup-wizard.tsx](../setup-wizard.tsx).
 */
export function TemplatePickerStep({ draft, onChange }: TemplatePickerStepProps) {
  return (
    <div>
      <p style={{ color: '#444', fontSize: 14, marginTop: 0, marginBottom: 16 }}>
        Pick a starter template to seed your storefront with sample products,
        categories, pages, and editorial content. You can change everything
        after, and apply a different template later from{' '}
        <strong>Admin → Settings → Templates</strong>. Or start blank.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {TEMPLATE_LIST.map((tpl) => {
          const selected = draft.templateId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange({ templateId: tpl.id })}
              aria-pressed={selected}
              style={tileStyle(selected)}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  background: `url(${tpl.preview.heroImageUrl}) center / cover, ${tpl.preview.swatch[0]}`,
                }}
              />
              <div style={{ padding: 12 }}>
                <div style={tileTagRow}>
                  <span style={tileTag}>{tpl.vertical}</span>
                </div>
                <div style={tileTitle}>{tpl.name}</div>
                <p style={tileDesc}>{tpl.description}</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  {tpl.preview.swatch.map((c, i) => (
                    <span key={i} style={{ ...tileSwatch, background: c }} />
                  ))}
                </div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChange({ templateId: '' })}
          aria-pressed={draft.templateId === ''}
          style={tileStyle(draft.templateId === '')}
        >
          <div
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              background:
                'repeating-linear-gradient(135deg, #f5f5f5 0 12px, #ffffff 12px 24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: '#bbb',
              fontWeight: 700,
            }}
          >
            ∅
          </div>
          <div style={{ padding: 12 }}>
            <div style={tileTagRow}>
              <span style={tileTag}>blank</span>
            </div>
            <div style={tileTitle}>Start blank</div>
            <p style={tileDesc}>
              Skip the sample data and start with an empty storefront. You
              can apply a template later from the admin.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function tileStyle(selected: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    textAlign: 'left',
    background: '#fff',
    border: selected
      ? '2px solid var(--caspian-primary, #111)'
      : '1px solid #eee',
    borderRadius: 'var(--caspian-radius, 8px)',
    overflow: 'hidden',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 150ms, box-shadow 150ms',
    boxShadow: selected ? '0 0 0 4px rgba(0, 0, 0, 0.04)' : 'none',
  };
}

const tileTagRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 6,
};

const tileTag: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid rgba(0,0,0,0.2)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tileTitle: CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  marginBottom: 4,
};

const tileDesc: CSSProperties = {
  margin: '0 0 10px',
  fontSize: 12,
  color: '#666',
  lineHeight: 1.4,
};

const tileSwatch: CSSProperties = {
  display: 'inline-block',
  width: 14,
  height: 14,
  borderRadius: 4,
  border: '1px solid rgba(0,0,0,0.1)',
};
