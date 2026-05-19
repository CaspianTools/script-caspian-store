'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { TEMPLATE_LIST } from '../templates/catalog';
import {
  applyTemplate,
  countWipeImpact,
} from '../templates/apply-template';
import type {
  ApplyTemplateMode,
  ApplyTemplateResult,
  TemplateDefinition,
} from '../templates/types';
import { Badge } from '../ui/misc';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast';

export interface AdminTemplatesPageProps {
  className?: string;
}

/**
 * `/admin/templates` — browse the bundled storefront templates and apply
 * one to seed Firestore with theme + products + categories + pages +
 * journal. Mounted by the consumer's Next.js route file:
 *
 * ```tsx
 * import { AdminTemplatesPage } from '@caspian-explorer/script-caspian-store';
 * export default function Page() { return <AdminTemplatesPage />; }
 * ```
 *
 * Requires the caller to be an admin — relies on Firestore rules to
 * reject writes from non-admin users.
 */
export function AdminTemplatesPage({ className }: AdminTemplatesPageProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId
    ? TEMPLATE_LIST.find((t) => t.id === selectedId) ?? null
    : null;

  return (
    <div className={className}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Templates</h1>
      <p style={{ color: '#666', marginTop: 4, maxWidth: 720 }}>
        Apply a starter template to seed your storefront with sample products,
        categories, pages, and editorial content. Imagery uses royalty-free
        Unsplash URLs; replace any image after applying from the relevant
        admin page. Templates are non-destructive in <strong>Merge</strong>{' '}
        mode &mdash; only docs whose id is unused will be written.
      </p>

      <section
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {TEMPLATE_LIST.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            onPick={() => setSelectedId(tpl.id)}
          />
        ))}
      </section>

      {selected && (
        <ApplyDialog
          template={selected}
          db={db}
          onClose={() => setSelectedId(null)}
          onApplied={(result) => {
            const w = result.written;
            const s = result.skipped;
            toast({
              title: `Applied "${result.templateId}"`,
              description: `Wrote ${w.brands} brands, ${w.products} products, ${w.categories} categories, ${w.pages} pages, ${w.journal} journal posts. Skipped ${s.brands + s.products + s.categories + s.pages + s.journal} existing docs.`,
            });
            setSelectedId(null);
          }}
          onError={(err) => {
            toast({
              title: 'Apply failed',
              description: err.message,
              variant: 'destructive',
            });
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onPick,
}: {
  template: TemplateDefinition;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        cursor: 'pointer',
        textAlign: 'left',
        background: 'transparent',
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 150ms, transform 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--caspian-primary, #111)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#eee';
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: `url(${template.preview.heroImageUrl}) center / cover, ${template.preview.swatch[0]}`,
        }}
      />
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Badge variant="outline">{template.vertical}</Badge>
          <span style={{ fontSize: 11, color: '#999' }}>v{template.version}</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{template.name}</div>
        <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#666' }}>
          {template.description}
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {template.preview.swatch.map((color, i) => (
            <span
              key={i}
              title={color}
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                borderRadius: 4,
                background: color,
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}

interface ApplyDialogProps {
  template: TemplateDefinition;
  db: ReturnType<typeof useCaspianFirebase>['db'];
  onClose: () => void;
  onApplied: (result: ApplyTemplateResult) => void;
  onError: (err: Error) => void;
}

function ApplyDialog({ template, db, onClose, onApplied, onError }: ApplyDialogProps) {
  const [mode, setMode] = useState<ApplyTemplateMode>('merge');
  const [applying, setApplying] = useState(false);
  const [wipeImpact, setWipeImpact] = useState<{
    brands: number;
    categories: number;
    products: number;
    pages: number;
    journal: number;
  } | null>(null);
  const [dryRun, setDryRun] = useState<ApplyTemplateResult | null>(null);

  // Load both the dry-run diff and the wipe-impact counts as soon as the
  // dialog opens. The dry-run tells us what merge mode would write/skip;
  // the wipe-impact tells the user how many docs replace mode would
  // delete BEFORE writing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dry, impact] = await Promise.all([
          applyTemplate(db, template.id, { mode: 'merge', dryRun: true }),
          countWipeImpact(db),
        ]);
        if (cancelled) return;
        setDryRun(dry);
        setWipeImpact(impact);
      } catch (err) {
        if (cancelled) return;
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, template.id, onError]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      const result = await applyTemplate(db, template.id, { mode });
      onApplied(result);
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setApplying(false);
    }
  }, [db, template.id, mode, onApplied, onError]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 'var(--caspian-radius, 8px)',
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            width: '100%',
            aspectRatio: '21 / 9',
            background: `url(${template.preview.heroImageUrl}) center / cover, ${template.preview.swatch[0]}`,
          }}
        />
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Badge variant="outline">{template.vertical}</Badge>
            <span style={{ fontSize: 11, color: '#999' }}>v{template.version}</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{template.name}</h2>
          <p style={{ margin: '6px 0 16px', color: '#444', fontSize: 14 }}>
            {template.description}
          </p>

          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', margin: '16px 0 8px' }}>
            What this template includes
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#333' }}>
            <li>{template.products.length} products across {template.categories.length} categories ({template.brands.length} brand{template.brands.length === 1 ? '' : 's'})</li>
            <li>{template.pages.length} editable content pages (about, terms, privacy, shipping)</li>
            {template.journal && template.journal.length > 0 && (
              <li>{template.journal.length} journal articles</li>
            )}
            <li>Theme tokens + hero copy applied to your site settings</li>
            <li>Feature flag preset (reviews / wishlist / questions as configured)</li>
          </ul>

          <div
            style={{
              marginTop: 20,
              padding: 14,
              border: '1px solid #eee',
              borderRadius: 'var(--caspian-radius, 6px)',
              background: '#fafafa',
            }}
          >
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', margin: 0 }}>
              Apply mode
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <ModeOption
                value="merge"
                current={mode}
                onChange={setMode}
                label="Merge (recommended)"
                description={
                  dryRun
                    ? `Writes ${dryRun.written.brands + dryRun.written.products + dryRun.written.categories + dryRun.written.pages + dryRun.written.journal} new docs. Skips ${dryRun.skipped.brands + dryRun.skipped.products + dryRun.skipped.categories + dryRun.skipped.pages + dryRun.skipped.journal} that already exist. Idempotent.`
                    : 'Loading diff…'
                }
              />
              <ModeOption
                value="replace"
                current={mode}
                onChange={setMode}
                label="Replace (destructive)"
                description={
                  wipeImpact
                    ? `Deletes ${wipeImpact.products} existing products, ${wipeImpact.brands} brands, ${wipeImpact.categories} categories, ${wipeImpact.pages} pages, ${wipeImpact.journal} journal posts FIRST, then writes the template's content. Can't be undone.`
                    : 'Loading current site contents…'
                }
                destructive
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Button variant="ghost" onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              loading={applying}
              variant={mode === 'replace' ? 'destructive' : 'primary'}
            >
              {applying
                ? 'Applying…'
                : mode === 'replace'
                  ? `Wipe + apply ${template.name}`
                  : `Apply ${template.name}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeOption({
  value,
  current,
  onChange,
  label,
  description,
  destructive,
}: {
  value: ApplyTemplateMode;
  current: ApplyTemplateMode;
  onChange: (next: ApplyTemplateMode) => void;
  label: string;
  description: string;
  destructive?: boolean;
}) {
  const selected = current === value;
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        borderRadius: 'var(--caspian-radius, 6px)',
        border: selected
          ? `1px solid ${destructive ? '#dc2626' : 'var(--caspian-primary, #111)'}`
          : '1px solid #ddd',
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      <input
        type="radio"
        name="apply-mode"
        checked={selected}
        onChange={() => onChange(value)}
        style={{ marginTop: 3 }}
      />
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: destructive && selected ? '#991b1b' : '#111' }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{description}</div>
      </div>
    </label>
  );
}
