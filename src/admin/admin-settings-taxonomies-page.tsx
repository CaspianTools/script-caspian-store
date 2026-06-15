'use client';

import { useEffect, useState } from 'react';
import { getCountFromServer, query, type Firestore } from 'firebase/firestore';
import type { SiteSettings } from '../types';
import { getSiteSettings, saveSiteSettings } from '../services/site-settings-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { caspianCollections } from '../firebase/collections';
import { countTerms } from '../services/taxonomy-term-service';
import {
  COMMON_TAXONOMIES,
  TAXONOMY_GROUPS,
  resolveEnabledTaxonomies,
} from '../taxonomies/catalog';
import type { TaxonomyDef } from '../taxonomies/types';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/misc';
import { Switch } from '../ui/switch';
import { FieldDescription } from '../ui/field-description';
import { useToast } from '../ui/toast';

const EMPTY_SETTINGS: SiteSettings = {
  logoUrl: '',
  brandName: '',
  brandDescription: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  businessHours: '',
  socialLinks: [],
};

/** Count terms under a taxonomy id — brands from their own collection, generic via the term service. */
async function countFor(db: Firestore, def: TaxonomyDef): Promise<number> {
  if (def.kind === 'brands') {
    const snap = await getCountFromServer(query(caspianCollections(db).productBrands));
    return snap.data().count;
  }
  return countTerms(db, def.id);
}

/**
 * Settings → Taxonomies. Enable/disable the common product taxonomies, by whole
 * category or a single one. A taxonomy that already has terms can't be disabled
 * (the toggle locks ON). Only enabled taxonomies show in /admin/taxonomies.
 * Persisted as `SiteSettings.enabledTaxonomies`.
 */
export function AdminSettingsTaxonomiesPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => alive && setSettings(s ?? EMPTY_SETTINGS))
      .catch(() => alive && setSettings(EMPTY_SETTINGS));
    return () => {
      alive = false;
    };
  }, [db]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        COMMON_TAXONOMIES.map(async (def) => {
          try {
            return [def.id, await countFor(db, def)] as const;
          } catch {
            return [def.id, 0] as const;
          }
        }),
      );
      if (alive) setCounts(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  if (!settings || counts === null) {
    return (
      <div className={className}>
        <Skeleton style={{ height: 320 }} />
      </div>
    );
  }

  const enabled = new Set(resolveEnabledTaxonomies(settings.enabledTaxonomies));
  const setEnabled = (next: Set<string>) =>
    setSettings((s) =>
      s
        ? { ...s, enabledTaxonomies: COMMON_TAXONOMIES.filter((tx) => next.has(tx.id)).map((tx) => tx.id) }
        : s,
    );

  // Locked ON: a taxonomy with terms can't be disabled. Enabling is always allowed.
  const isLocked = (id: string) => (counts[id] ?? 0) > 0 && enabled.has(id);

  const toggleItem = async (def: TaxonomyDef, on: boolean) => {
    if (on) {
      const next = new Set(enabled);
      next.add(def.id);
      setEnabled(next);
      return;
    }
    let n = counts[def.id] ?? 0;
    if (n === 0) {
      try {
        n = await countFor(db, def);
      } catch {
        n = 0;
      }
    }
    if (n > 0) {
      setCounts((c) => (c ? { ...c, [def.id]: n } : c));
      toast({ title: t('admin.taxonomies.settings.lockedToast'), variant: 'destructive' });
      return;
    }
    const next = new Set(enabled);
    next.delete(def.id);
    setEnabled(next);
  };

  const toggleGroup = (groupId: string, turnOn: boolean) => {
    const items = COMMON_TAXONOMIES.filter((tx) => tx.group === groupId);
    const next = new Set(enabled);
    for (const tx of items) {
      if (turnOn) next.add(tx.id);
      else if (!isLocked(tx.id)) next.delete(tx.id);
    }
    setEnabled(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSiteSettings(db, settings);
      toast({ title: t('admin.taxonomies.settings.saved') });
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: t('admin.taxonomies.settings.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('admin.settings.taxonomies.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.settings.taxonomies.subtitle')}</p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
        {TAXONOMY_GROUPS.map((group) => {
          const items = COMMON_TAXONOMIES.filter((tx) => tx.group === group.id);
          const onCount = items.filter((tx) => enabled.has(tx.id)).length;
          const allOn = onCount === items.length;

          return (
            <div key={group.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 8,
                  borderBottom: '1px solid #e8eaed',
                  marginBottom: 12,
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{t(group.labelKey)}</h2>
                <Switch
                  checked={allOn}
                  onChange={(next) => toggleGroup(group.id, next)}
                  ariaLabel={`${t(group.labelKey)} — ${t('admin.taxonomies.settings.toggleAll')}`}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {items.map((def) => {
                  const locked = isLocked(def.id);
                  const count = counts[def.id] ?? 0;
                  return (
                    <Switch
                      key={def.id}
                      checked={enabled.has(def.id)}
                      disabled={locked}
                      onChange={(next) => void toggleItem(def, next)}
                      label={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {def.icon}
                          {t(def.labelKey)}
                        </span>
                      }
                      description={
                        <FieldDescription style={{ marginTop: 2 }}>
                          {locked
                            ? t('admin.taxonomies.settings.lockedHint').replace('{count}', String(count))
                            : t(def.descriptionKey)}
                        </FieldDescription>
                      }
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={save} loading={saving}>
            {t('admin.taxonomies.settings.save')}
          </Button>
        </div>
      </section>
    </div>
  );
}
