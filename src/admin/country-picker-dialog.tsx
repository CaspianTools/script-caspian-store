'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { useT } from '../i18n/locale-context';
import { ALL_COUNTRIES, type IsoCountry } from '../utils/countries';

export type { IsoCountry } from '../utils/countries';

/**
 * Re-export of the full ISO 3166-1 alpha-2 list. Kept under the historical
 * `ISO_COUNTRIES` name so existing imports in shipping / site-settings admin
 * pages keep compiling without churn.
 */
export const ISO_COUNTRIES = ALL_COUNTRIES;

export interface CountryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Codes already selected — shown with an active check and preselected when re-opened. */
  selected: string[];
  /** Called when the admin confirms with the resulting set of codes. */
  onConfirm: (codes: string[]) => void;
  /**
   * Countries to offer. Defaults to `ISO_COUNTRIES`. Useful when an admin
   * needs to pick from a narrower set (e.g. "shipping-eligible" within an
   * already-whitelisted country set).
   */
  source?: readonly IsoCountry[];
  /** Override dialog title. */
  title?: string;
  /** Override confirm button label. */
  confirmLabel?: string;
}

/**
 * Check-many-at-once country picker. Search filter on top; a single column
 * of checkboxes grouped (by list order) below; footer buttons to Clear all,
 * Select all (visible), Cancel, Confirm. Confirming fires `onConfirm` with
 * the resulting code list and closes the dialog.
 *
 * State lives in the dialog until Confirm; Cancel/Escape discards.
 */
export function CountryPickerDialog({
  open,
  onOpenChange,
  selected,
  onConfirm,
  source = ISO_COUNTRIES,
  title,
  confirmLabel,
}: CountryPickerDialogProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));
  // Callers pass `selected` as a fresh array literal on every render, so it
  // cannot be an effect dependency: any parent re-render (e.g. a toast
  // dismissing) would wipe the admin's in-progress ticks. Read the latest
  // value through a ref and reset only on the closed → open transition.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (open) {
      setDraft(new Set(selectedRef.current));
      setQuery('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [source, query]);

  const toggle = (code: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAllVisible = () => {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const c of filtered) next.add(c.code);
      return next;
    });
  };

  const clearAll = () => setDraft(new Set());

  const handleConfirm = () => {
    onConfirm(Array.from(draft));
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t('admin.countryPicker.title')}
      description={t('admin.countryPicker.description')}
      maxWidth={560}
      footer={
        <>
          <Button variant="ghost" onClick={clearAll}>
            {t('admin.countryPicker.clearAll')}
          </Button>
          <Button variant="outline" onClick={selectAllVisible}>
            {t('admin.countryPicker.selectAllVisible', { count: filtered.length })}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm}>
            {confirmLabel ?? t('admin.countryPicker.confirm', { count: draft.size })}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.countryPicker.searchPlaceholder')}
          style={{
            padding: '10px 12px',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 'var(--caspian-radius, 8px)',
            fontSize: 14,
            outline: 'none',
            background: '#fafafa',
          }}
        />
        {filtered.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>
            {t('admin.countryPicker.noResults')}
          </p>
        ) : (
          <div
            style={{
              maxHeight: 380,
              overflowY: 'auto',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
            }}
          >
            {filtered.map((c) => {
              const checked = draft.has(c.code);
              return (
                <label
                  key={c.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    fontSize: 14,
                    background: checked ? 'rgba(0,0,0,0.03)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.code)}
                  />
                  <span style={{ fontFamily: 'monospace', color: '#666', width: 24 }}>
                    {c.code}
                  </span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
