'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT, cn } from '@caspian-explorer/script-caspian-store';
import {
  ChevronRightIcon,
  FolderIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from '../../../../icons';
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
  /** Which record to land on. Null opens the list of what can be made. */
  initialEntry: QuickAddEntry | null;
  onSaved: () => void;
}

/**
 * The add dialog: pick what you are making, then fill it in.
 *
 * Two steps rather than the two panes it had until v1.6.0. The panes gave the
 * list a 232px rail, which is wide enough for a word and not for the sentence
 * saying what the word means -- so "Category" and "Supplier" sat there
 * unexplained, and the blurb only ever appeared as the dialog's own subtitle,
 * for whichever entry happened to be highlighted. A full-width row fits the
 * icon, the name and the sentence, and the form then gets the whole panel
 * instead of two thirds of it.
 *
 * Entries a role cannot use, or a shop has switched off, are absent rather than
 * disabled, which is the rule the Store tabs already follow: a disabled entry is
 * a promise of a form that is never coming.
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
  // Null is the picker. This is the step rather than a selection, which is why
  // an Add button that already names a record can open straight on its form and
  // Back still has a list to reveal.
  const [chosen, setChosen] = useState<QuickAddEntry | null>(initialEntry);
  const [highlight, setHighlight] = useState<QuickAddEntry | null>(null);
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

  // Read inside the reset below without putting `available` in its dependencies.
  // A roles refresh or a shop switch changes that array, and the reset would
  // then fire mid-form and send somebody back to the list with their half-typed
  // product discarded -- which the two-pane version got away with only because
  // resetting landed on the same form it was already showing.
  const availableRef = useRef(available);
  availableRef.current = available;

  // Reset on the way open, so a dialog reopened from a different Add button
  // lands where that button asked rather than where it was left. Everything else
  // opens on the list: landing on a form nobody picked is what the panes did.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFormKey(0);
    const list = availableRef.current;
    setChosen(
      initialEntry && list.some((item) => item.value === initialEntry) ? initialEntry : null,
    );
  }, [open, initialEntry]);

  // The highlight is the arrow keys' cursor, so it follows the filtered list
  // rather than surviving a search that no longer contains it.
  useEffect(() => {
    setHighlight((at) =>
      at && visible.some((item) => item.value === at) ? at : (visible[0]?.value ?? null),
    );
  }, [visible]);

  const current = available.find((item) => item.value === chosen) ?? null;

  const saved = () => {
    onSaved();
    setFormKey((n) => n + 1);
  };

  /** Up and down move the highlight from inside the search box; Enter opens it. */
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlight) setChosen(highlight);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (visible.length === 0) return;
    const at = visible.findIndex((item) => item.value === highlight);
    const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
    const wrapped = (next + visible.length) % visible.length;
    setHighlight(visible[wrapped]!.value);
    listRef.current?.children[wrapped]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <PosDialog
      closeLabel={t('common.close')}
      open={open}
      onOpenChange={onOpenChange}
      title={current ? t(`pos.quickAdd.new.${current.value}`) : t('pos.quickAdd.title')}
      description={current ? t(current.blurbKey) : t('pos.quickAdd.pickHelp')}
      size={current ? 'lg' : 'md'}
      onBack={current ? () => setChosen(null) : undefined}
      backLabel={t('common.back')}
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
        ) : undefined
      }
    >
      {current ? (
        <div key={`${current.value}-${formKey}`}>
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
      ) : available.length === 0 ? (
        <div className="cpos-empty">
          <span className="cpos-empty__icon cpos-empty__icon--neutral">
            <PlusIcon size={26} />
          </span>
          <p className="cpos-empty__title">{t('pos.quickAdd.nothingTitle')}</p>
          <p className="cpos-empty__text">{t('pos.quickAdd.nothingHelp')}</p>
        </div>
      ) : (
        <div className="cpos-quickadd">
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

          {visible.length === 0 ? (
            <div className="cpos-empty">
              <span className="cpos-empty__icon cpos-empty__icon--neutral">
                <SearchIcon size={26} />
              </span>
              <p className="cpos-empty__title">{t('pos.quickAdd.noMatch')}</p>
            </div>
          ) : (
            <div
              className="cpos-quickadd__items"
              ref={listRef}
              aria-label={t('pos.quickAdd.pickHelp')}
            >
              {visible.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    'cpos-quickadd__item',
                    highlight === item.value && 'cpos-quickadd__item--on',
                  )}
                  onClick={() => setChosen(item.value)}
                  onMouseEnter={() => setHighlight(item.value)}
                >
                  <span className="cpos-quickadd__icon">{item.icon(19)}</span>
                  <span className="cpos-quickadd__text">
                    <span className="cpos-quickadd__name">{t(item.labelKey)}</span>
                    <span className="cpos-quickadd__blurb">{t(item.blurbKey)}</span>
                  </span>
                  <ChevronRightIcon size={16} className="cpos-quickadd__go" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </PosDialog>
  );
}
