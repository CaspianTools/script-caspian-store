'use client';

import { useState } from 'react';
import { useT, useToast } from '@caspian-explorer/script-caspian-store';
import { PosField } from '../../ui/pos-field';
import { listLocalCategories, makeLocalCategory, saveLocalCategory } from '../../local-db';
import type { LocalCategory } from '../../types';

export interface LocalCategoryFormProps {
  formId: string;
  onSaved?: (category: LocalCategory) => void;
}

/**
 * A new group for the catalogue.
 *
 * One field, because a category IS its name: `LocalProduct.category` stores the
 * name rather than an id, which is what lets the screen be switched off again
 * without stranding a catalogue. Everything else about a category -- where it
 * sits in the list, what it holds, what it sold -- belongs on its own page.
 *
 * Until v1.4.0 this was an inline row on the Categories list with its own Add
 * button, which is why adding a category looked nothing like adding a supplier.
 */
export function LocalCategoryForm({ formId, onSaved }: LocalCategoryFormProps) {
  const t = useT();
  const { toast } = useToast();
  const [name, setName] = useState('');

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: t('pos.store.category.needsName'), variant: 'destructive' });
      return;
    }
    // Read at save rather than held in state: Quick add can sit open while
    // somebody adds a category in another tab of the same till, and the check
    // that matters is the one against what is on disk now.
    const existing = await listLocalCategories();
    if (existing.some((c) => c.nameLower === trimmed.toLowerCase())) {
      toast({ title: t('pos.store.category.duplicate'), variant: 'destructive' });
      return;
    }
    const saved = makeLocalCategory({ name: trimmed, sortOrder: existing.length });
    await saveLocalCategory(saved);
    setName('');
    onSaved?.(saved);
    toast({ title: t('pos.store.category.added', { name: saved.name }) });
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
      <PosField
        label={t('pos.store.category.name')}
        help={t('pos.store.category.addHelp')}
        style={{ maxWidth: 340 }}
      >
        <input
          className="cpos-input"
          value={name}
          autoFocus
          placeholder={t('pos.store.category.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </PosField>
    </form>
  );
}
