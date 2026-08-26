'use client';

import { useState } from 'react';
import { useT } from '../../../../i18n/locale-context';
import { useToast } from '../../../../ui/toast';
import { PosField } from '../../ui/pos-field';
import { makeLocalSupplier, saveLocalSupplier } from '../../local-db';
import type { LocalSupplier } from '../../types';

const BLANK = { name: '', contactName: '', phone: '', email: '', address: '', note: '' };

export interface LocalSupplierFormProps {
  formId: string;
  /** Absent when adding. */
  supplier?: LocalSupplier | null;
  onSaved?: (supplier: LocalSupplier) => void;
}

/**
 * Who the shop buys from.
 *
 * Lifted out of the dialog that used to live inside the Suppliers list, so that
 * Quick add, the list and the supplier's own page all edit the same fields. Only
 * the name is required -- a delivery frozen against a supplier with nothing but
 * a name still names who it came from, which is the whole job of this record.
 */
export function LocalSupplierForm({ formId, supplier, onSaved }: LocalSupplierFormProps) {
  const t = useT();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() =>
    supplier
      ? {
          name: supplier.name,
          contactName: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          note: supplier.note,
        }
      : BLANK,
  );

  const save = async () => {
    if (!draft.name.trim()) {
      toast({ title: t('pos.store.supplier.needsName'), variant: 'destructive' });
      return;
    }
    const saved = makeLocalSupplier({ ...(supplier ?? {}), ...draft });
    await saveLocalSupplier(saved);
    onSaved?.(saved);
    toast({ title: t('pos.store.supplier.saved') });
  };

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="cpos-form"
    >
      <div className="cpos-row">
        <PosField label={t('pos.store.supplier.name')} style={{ flex: '2 1 200px' }}>
          <input
            className="cpos-input"
            value={draft.name}
            autoFocus
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </PosField>
        <PosField label={t('pos.store.supplier.contact')} style={{ flex: '1 1 160px' }}>
          <input
            className="cpos-input"
            value={draft.contactName}
            onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
          />
        </PosField>
      </div>
      <div className="cpos-row">
        <PosField label={t('pos.store.supplier.phone')} style={{ flex: '1 1 140px' }}>
          <input
            className="cpos-input"
            value={draft.phone}
            inputMode="tel"
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </PosField>
        <PosField label={t('pos.store.supplier.email')} style={{ flex: '2 1 200px' }}>
          <input
            className="cpos-input"
            value={draft.email}
            inputMode="email"
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </PosField>
      </div>
      <PosField label={t('pos.store.supplier.address')}>
        <input
          className="cpos-input"
          value={draft.address}
          onChange={(e) => setDraft({ ...draft, address: e.target.value })}
        />
      </PosField>
      <PosField label={t('pos.store.adjust.note')}>
        <textarea
          className="cpos-textarea"
          value={draft.note}
          rows={2}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </PosField>
    </form>
  );
}
