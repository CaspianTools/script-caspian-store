'use client';

import type { CSSProperties } from 'react';
import { useT } from '../../../i18n';
import { Switch } from '../../../ui/switch';
import { COMMON_TAXONOMIES, TAXONOMY_GROUPS } from '../../../taxonomies/catalog';
import type { TaxonomiesDraft } from '../setup-types';

export interface TaxonomiesStepProps {
  draft: TaxonomiesDraft;
  onChange: (next: TaxonomiesDraft) => void;
}

export function TaxonomiesStep({ draft, onChange }: TaxonomiesStepProps) {
  const t = useT();
  const enabled = new Set(draft.enabled);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(id);
    else next.delete(id);
    onChange({ enabled: COMMON_TAXONOMIES.filter((tx) => next.has(tx.id)).map((tx) => tx.id) });
  };

  return (
    <div style={groups}>
      {TAXONOMY_GROUPS.map((group) => {
        const items = COMMON_TAXONOMIES.filter((tx) => tx.group === group.id);
        return (
          <div key={group.id} style={groupBlock}>
            <span style={groupTitle}>{t(group.labelKey)}</span>
            <div style={list}>
              {items.map((def) => {
                const on = enabled.has(def.id);
                return (
                  <div
                    key={def.id}
                    style={{ ...row, ...(on ? rowSelected : null) }}
                    onClick={() => toggle(def.id, !on)}
                  >
                    <div style={rowText}>
                      <span style={rowTitle}>{t(def.labelKey)}</span>
                      <span style={rowDesc}>{t(def.descriptionKey)}</span>
                    </div>
                    <span style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={on}
                        onChange={(next) => toggle(def.id, next)}
                        ariaLabel={t(def.labelKey)}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const groups: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const groupBlock: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const groupTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#51607A',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
};

const list: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  border: '1px solid #D6D9E6',
  borderRadius: 8,
  cursor: 'pointer',
  background: '#FFFFFF',
  transition: 'border-color 140ms ease, background 140ms ease',
};

const rowSelected: CSSProperties = {
  borderColor: '#022959',
  background: '#F2F6FF',
};

const rowText: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const rowTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#022959',
};

const rowDesc: CSSProperties = {
  fontSize: 13,
  color: '#6A7A8A',
};
