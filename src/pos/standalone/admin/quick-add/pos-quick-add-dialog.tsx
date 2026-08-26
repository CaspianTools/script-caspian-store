'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../../../i18n/locale-context';
import { FolderIcon, PlusIcon, SearchIcon, TagIcon, TruckIcon, UsersIcon } from '../../../../ui/icons';
import { cn } from '../../../../utils/cn';
import { PosDialog } from '../../ui/pos-dialog';
import { usePosLocalSession } from '../../local-session-context';
import { usePosRoles } from '../../role-context';
import { usePosShopSettings } from '../../shop-settings-context';
import type { LocalShopSettings, PosLocalCapability } from '../../types';
import { LocalProductForm } from './local-product-form';
import { LocalCategoryForm } from './local-category-form';
import { LocalSupplierForm } from './local-supplier-form';
import { LocalPersonForm } from './local-person-form';
import type { QuickAddEntry } from './pos-quick-add-context';

interface EntryDefinition {
  value: QuickAddEntry;
  labelKey: string;
  blurbKey: string;
  icon: (size: number) => ReactNode;
  capability: PosLocalCapability;
  /** The shop switch this record hides behind, if it has one. */
  flag?: keyof LocalShopSettings;
}

/**
 * What the till can make.
 *
 * Deliberately not everything that can be written. A delivery is missing because
 * it is a working screen with line entry and a saved draft, not a form -- it
 * lives at /pos/store/receive and Quick add would only be a worse way in. Roles
 * are missing because they are App admin's, and App admin is the one screen that
 * is not about the shop's day.
 */
const ENTRIES: EntryDefinition[] = [
  {
    value: 'product',
    labelKey: 'pos.quickAdd.entry.product',
    blurbKey: 'pos.quickAdd.entry.productBlurb',
    icon: (s) => <TagIcon size={s} />,
    capability: 'store.edit',
  },
  {
    value: 'category',
    labelKey: 'pos.quickAdd.entry.category',
    blurbKey: 'pos.quickAdd.entry.categoryBlurb',
    icon: (s) => <FolderIcon size={s} />,
    capability: 'store.edit',
    flag: 'categoriesEnabled',
  },
  {
    value: 'supplier',
    labelKey: 'pos.quickAdd.entry.supplier',
    blurbKey: 'pos.quickAdd.entry.supplierBlurb',
    icon: (s) => <TruckIcon size={s} />,
    capability: 'store.edit',
    flag: 'suppliersEnabled',
  },
  {
    value: 'person',
    labelKey: 'pos.quickAdd.entry.person',
    blurbKey: 'pos.quickAdd.entry.personBlurb',
    icon: (s) => <UsersIcon size={s} />,
    capability: 'people.edit',
  },
];

export interface PosQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which record to land on. Null lands on the first one this role can make. */
  initialEntry: QuickAddEntry | null;
  onSaved: () => void;
}

/**
 * The two-pane add dialog: what you can make on the left, the form on the right.
 *
 * The list is searchable because it is meant to grow -- four records today, and
 * a till that gains a fifth should not need the dialog redesigned. Entries a
 * role cannot use, or a shop has switched off, are absent rather than disabled,
 * which is the rule the Store tabs already follow: a disabled entry is a promise
 * of a form that is never coming.
 */
export function PosQuickAddDialog({
  open,
  onOpenChange,
  initialEntry,
  onSaved,
}: PosQuickAddDialogProps) {
  const t = useT();
  const formId = useId();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();

  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<QuickAddEntry | null>(initialEntry);
  // Remounts the form after a save, which is how every form resets itself
  // without each one growing its own clear-the-draft branch. The dialog stays
  // open on purpose: somebody entering a delivery by hand adds six products in
  // a row, and closing after each one would cost them six more clicks.
  const [formKey, setFormKey] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const available = useMemo(
    () =>
      ENTRIES.filter(
        (item) =>
          can(session.user?.role, item.capability) &&
          (!item.flag || settings[item.flag] === true),
      ),
    [can, session.user?.role, settings],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return available;
    return available.filter(
      (item) =>
        t(item.labelKey).toLowerCase().includes(needle) ||
        t(item.blurbKey).toLowerCase().includes(needle),
    );
  }, [available, search, t]);

  // Reset on every open, so a dialog reopened from a different Add button lands
  // where that button asked rather than where it was left.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFormKey(0);
    setChosen(
      initialEntry && available.some((item) => item.value === initialEntry)
        ? initialEntry
        : (available[0]?.value ?? null),
    );
  }, [open, initialEntry, available]);

  // A search that filters the chosen entry out of the list would otherwise leave
  // the form on the right answering for something no longer on the left.
  useEffect(() => {
    if (!open || visible.length === 0) return;
    if (!visible.some((item) => item.value === chosen)) setChosen(visible[0]!.value);
  }, [open, visible, chosen]);

  const current = available.find((item) => item.value === chosen) ?? null;

  const saved = () => {
    onSaved();
    setFormKey((n) => n + 1);
  };

  /** Up and down move through the list from inside the search box. */
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (visible.length === 0) return;
    const at = visible.findIndex((item) => item.value === chosen);
    const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
    const wrapped = (next + visible.length) % visible.length;
    setChosen(visible[wrapped]!.value);
    listRef.current?.children[wrapped]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <PosDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pos.quickAdd.title')}
      description={current ? t(current.blurbKey) : undefined}
      size="split"
      bodyFlush
      foot={
        current ? (
          <>
            <button
              type="button"
              className="cpos-btn cpos-btn--outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.close')}
            </button>
            <button type="submit" form={formId} className="cpos-btn cpos-btn--primary">
              <PlusIcon size={16} />
              {t(`pos.quickAdd.action.${current.value}`)}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </button>
        )
      }
    >
      <div className="cpos-quickadd">
        <div className="cpos-quickadd__list">
          <div className="cpos-searchbox" style={{ flex: 'none' }}>
            <span className="cpos-searchbox__icon">
              <SearchIcon size={16} />
            </span>
            <input
              className="cpos-input"
              type="search"
              value={search}
              placeholder={t('pos.quickAdd.search')}
              aria-label={t('pos.quickAdd.search')}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>

          <div className="cpos-quickadd__items" role="listbox" ref={listRef}>
            {visible.map((item) => (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={chosen === item.value}
                className={cn(
                  'cpos-quickadd__item',
                  chosen === item.value && 'cpos-quickadd__item--on',
                )}
                onClick={() => setChosen(item.value)}
              >
                <span className="cpos-quickadd__icon">{item.icon(17)}</span>
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="cpos-muted">{t('pos.quickAdd.noMatch')}</div>
          ) : null}
        </div>

        <div className="cpos-quickadd__pane">
          {current === null ? (
            <div className="cpos-quickadd__none">
              <p className="cpos-empty__title">{t('pos.quickAdd.nothingTitle')}</p>
              <p className="cpos-empty__text" style={{ marginInline: 'auto' }}>
                {t('pos.quickAdd.nothingHelp')}
              </p>
            </div>
          ) : (
            <div className="cpos-quickadd__body" key={`${current.value}-${formKey}`}>
              {current.value === 'product' ? (
                <LocalProductForm formId={formId} onSaved={saved} />
              ) : current.value === 'category' ? (
                <LocalCategoryForm formId={formId} onSaved={saved} />
              ) : current.value === 'supplier' ? (
                <LocalSupplierForm formId={formId} onSaved={saved} />
              ) : (
                <LocalPersonForm formId={formId} onSaved={saved} />
              )}
            </div>
          )}
        </div>
      </div>
    </PosDialog>
  );
}
