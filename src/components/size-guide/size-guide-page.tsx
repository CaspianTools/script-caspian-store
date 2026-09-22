'use client';

import type { SizeGuideConfig } from '../../types';
import { useScriptSettings } from '../../context/script-settings-context';
import { useT } from '../../i18n/locale-context';
import { Table, TBody, TD, TH, THead, TR } from '../../ui/table';
import { cn } from '../../utils/cn';

export interface SizeGuidePageProps {
  /** Override the script-settings size guide inline. */
  guide?: SizeGuideConfig;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const DEFAULT_SIZE_GUIDE: SizeGuideConfig = {
  tips: 'Between sizes? We recommend sizing up for a more relaxed fit.',
  tables: [
    {
      title: 'Tops',
      columns: ['Size', 'Bust (in)', 'Waist (in)', 'Hips (in)'],
      rows: [
        { label: 'XS', 'Bust (in)': '31-32', 'Waist (in)': '24-25', 'Hips (in)': '34-35' },
        { label: 'S', 'Bust (in)': '33-34', 'Waist (in)': '26-27', 'Hips (in)': '36-37' },
        { label: 'M', 'Bust (in)': '35-36', 'Waist (in)': '28-29', 'Hips (in)': '38-39' },
        { label: 'L', 'Bust (in)': '37-39', 'Waist (in)': '30-32', 'Hips (in)': '40-42' },
        { label: 'XL', 'Bust (in)': '40-42', 'Waist (in)': '33-35', 'Hips (in)': '43-45' },
      ],
    },
    {
      title: 'Bottoms',
      columns: ['Size', 'Waist (in)', 'Hips (in)', 'Inseam (in)'],
      rows: [
        { label: 'XS', 'Waist (in)': '24-25', 'Hips (in)': '34-35', 'Inseam (in)': '30' },
        { label: 'S', 'Waist (in)': '26-27', 'Hips (in)': '36-37', 'Inseam (in)': '30' },
        { label: 'M', 'Waist (in)': '28-29', 'Hips (in)': '38-39', 'Inseam (in)': '31' },
        { label: 'L', 'Waist (in)': '30-32', 'Hips (in)': '40-42', 'Inseam (in)': '31' },
        { label: 'XL', 'Waist (in)': '33-35', 'Hips (in)': '43-45', 'Inseam (in)': '32' },
      ],
    },
    {
      title: 'Shoes',
      columns: ['US', 'EU', 'UK', 'CM'],
      rows: [
        { label: '5', EU: '35', UK: '3', CM: '22' },
        { label: '6', EU: '36', UK: '4', CM: '23' },
        { label: '7', EU: '37', UK: '5', CM: '24' },
        { label: '8', EU: '38-39', UK: '6', CM: '25' },
        { label: '9', EU: '39-40', UK: '7', CM: '26' },
        { label: '10', EU: '40-41', UK: '8', CM: '27' },
      ],
    },
  ],
};

export function SizeGuidePage({ guide, title, subtitle, className }: SizeGuidePageProps) {
  const { settings } = useScriptSettings();
  const t = useT();
  const active: SizeGuideConfig = guide ?? settings.sizeGuide ?? DEFAULT_SIZE_GUIDE;

  return (
    <main
      className={cn('caspian-size-guide', 'caspian-page-gutter', className)}
      style={{ padding: '48px clamp(16px, 4vw, 24px)' }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {title ?? t('sizeGuide.title')}
          </h1>
          <p style={{ color: '#666', marginTop: 12, fontSize: 15 }}>
            {subtitle ?? t('sizeGuide.subtitle')}
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {active.tables.map((tbl, i) => (
            <section key={`${tbl.title}-${i}`}>
              <h2
                style={{
                  fontFamily: 'var(--caspian-font-headline, inherit)',
                  fontSize: 20,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                {tbl.title}
              </h2>
              {/* A size chart is read across a row, so it stays a real table
                  and scrolls sideways inside Table's overflow wrapper instead
                  of turning into per-size cards on phones. */}
              <Table responsive={false}>
                <THead>
                  <TR>
                    {tbl.columns.map((col) => (
                      <TH key={col}>{col}</TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {tbl.rows.map((row, rowIdx) => (
                    <TR key={rowIdx}>
                      {tbl.columns.map((col, colIdx) => (
                        <TD
                          key={col}
                          style={{ whiteSpace: 'nowrap', ...(colIdx === 0 ? { fontWeight: 600 } : { color: '#555' }) }}
                        >
                          {colIdx === 0 ? row.label : row[col] ?? '—'}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          ))}
        </div>

        {active.tips && (
          <aside
            style={{
              marginTop: 32,
              padding: 16,
              background: 'rgba(0,0,0,0.03)',
              borderRadius: 'var(--caspian-radius, 6px)',
              fontSize: 14,
              color: '#555',
            }}
          >
            {active.tips}
          </aside>
        )}
      </div>
    </main>
  );
}
