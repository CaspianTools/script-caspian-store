'use client';

import { EditableText } from '../editor/editable';
import type { SectionComponentProps, SectionType } from '../types';

// Library port note: unlike luivante, this decouples from store `SiteSettings`
// (which has no `returns`/free-shipping fields in this library) — all four items
// are editable text, so any store can phrase its own reassurance points.
function TrustStripSection({ props }: SectionComponentProps) {
  const s = (k: string) => String(props[k] ?? '');
  return (
    <section className="home__strip">
      <div>
        <LeafIcon />
        <EditableText as="span" fieldKey="item1Label" value={s('item1Label')} />
      </div>
      <div>
        <TruckIcon />
        <EditableText as="span" fieldKey="item2Label" value={s('item2Label')} />
      </div>
      <div>
        <ShieldIcon />
        <EditableText as="span" fieldKey="item3Label" value={s('item3Label')} />
      </div>
      <div>
        <SparkleIcon />
        <EditableText as="span" fieldKey="item4Label" value={s('item4Label')} />
      </div>
    </section>
  );
}

export const TRUST_STRIP_SECTION: SectionType = {
  type: 'trust-strip',
  nameKey: 'pageBuilder.section.trustStrip.name',
  descriptionKey: 'pageBuilder.section.trustStrip.desc',
  fields: [
    { key: 'item1Label', labelKey: 'pageBuilder.field.trustItem1', type: 'text', inline: true },
    { key: 'item2Label', labelKey: 'pageBuilder.field.trustItem2', type: 'text', inline: true },
    { key: 'item3Label', labelKey: 'pageBuilder.field.trustItem3', type: 'text', inline: true },
    { key: 'item4Label', labelKey: 'pageBuilder.field.trustItem4', type: 'text', inline: true },
  ],
  defaultProps: {
    item1Label: 'Traceable supply',
    item2Label: 'Free shipping over $150',
    item3Label: '30-day returns',
    item4Label: 'Repaired in-house',
  },
  singleton: true,
  Component: TrustStripSection,
};

/* ── Icons (moved verbatim from the original home-page-default) ─────────── */

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...STROKE}>
      <path d="M20 4c-9 0-15 5-15 14 6 0 14-3 14-14M5 19l7-7" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...STROKE}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...STROKE}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...STROKE}>
      <path d="M12 3v6m0 6v6m-9-9h6m6 0h6" />
    </svg>
  );
}
