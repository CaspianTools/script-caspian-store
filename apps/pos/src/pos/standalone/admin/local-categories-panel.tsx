'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  useT,
  useToast,
  FieldDescription,
  useCaspianNavigation,
} from '@caspian-explorer/script-caspian-store';
import { FolderIcon, PlusIcon } from '../../../icons';
import {
  adoptLocalCategoriesFromProducts,
  deleteLocalCategory,
  listLocalCategories,
  listLocalProducts,
  saveLocalCategory,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import type { LocalCategory } from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { PanelLoadError } from './panel-load-error';
import { usePosQuickAdd } from './quick-add/pos-quick-add-context';
import { usePosConfirm } from '../ui/pos-confirm';

/**
 * The shop's list of groups.
 *
 * A vocabulary, not a table products point at: a product stores the category
 * name, and renaming one rewrites the products carrying it. That is what lets
 * this screen be switched off again without stranding a catalogue, and what
 * keeps the CSV and the backup unchanged.
 *
 * Adding moved to Quick add in v1.4.0, and renaming moved to the category's own
 * page. What is left here is the list, the order, and the way in.
 */
export function LocalCategoriesPanel() {
  const t = useT();
  const confirm = usePosConfirm();
  const { toast } = useToast();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const quickAdd = usePosQuickAdd();
  const mayEdit = can(session.user?.role, 'store.edit');

  const [categories, setCategories] = useState<LocalCategory[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [rows, products] = await Promise.all([listLocalCategories(), listLocalProducts()]);
      const tally: Record<string, number> = {};
      for (const p of products) {
        const name = p.category.trim();
        if (name) tally[name] = (tally[name] ?? 0) + 1;
      }
      setCategories(rows);
      setCounts(tally);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  // `savedCount` is what makes a category added from the top bar appear here
  // without this screen knowing Quick add exists.
  useEffect(() => {
    void refresh();
  }, [refresh, quickAdd.savedCount]);

  const remove = async (category: LocalCategory) => {
    const using = counts[category.name] ?? 0;
    const ok = await confirm({
      title: t('pos.store.category.deleteTitle'),
      body: t('pos.store.category.confirmDelete', { name: category.name, count: using }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    await deleteLocalCategory(category.id);
    await refresh();
  };

  const adopt = async () => {
    const found = await adoptLocalCategoriesFromProducts();
    await refresh();
    toast({
      title: found
        ? t('pos.store.category.adopted', { count: found })
        : t('pos.store.category.adoptedNone'),
    });
  };

  /** Moves a row one place, which is all the ordering a list this short needs. */
  const move = async (index: number, delta: number) => {
    const rows = [...(categories ?? [])];
    const a = rows[index];
    const b = rows[index + delta];
    if (!a || !b) return;
    await Promise.all([
      saveLocalCategory({ ...a, sortOrder: b.sortOrder }),
      saveLocalCategory({ ...b, sortOrder: a.sortOrder }),
    ]);
    await refresh();
  };

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <FolderIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.store.category.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.store.category.subtitle')}</p>
        </span>
      </div>

      <StoreScreenNav current="categories" />

      <section className="cpos-section">
        <div className="cpos-row" style={{ alignItems: 'center' }}>
          <span className="cpos-section__title">
            {t('pos.store.category.listTitle', { count: categories?.length ?? 0 })}
          </span>
          {mayEdit ? (
            <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="cpos-btn cpos-btn--outline"
                onClick={() => void adopt()}
              >
                {t('pos.store.category.adopt')}
              </button>
              <button
                type="button"
                className="cpos-btn cpos-btn--primary"
                onClick={() => quickAdd.open('category')}
              >
                <PlusIcon size={16} />
                {t('pos.store.category.addAction')}
              </button>
            </div>
          ) : null}
        </div>
        {mayEdit ? <FieldDescription>{t('pos.store.category.adoptHelp')}</FieldDescription> : null}

        {loadFailed ? (
          <PanelLoadError onRetry={() => void refresh()} />
        ) : categories === null ? (
          <div className="cpos-muted">{t('common.loading')}</div>
        ) : categories.length === 0 ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon cpos-empty__icon--neutral">
              <FolderIcon size={22} />
            </span>
            <p className="cpos-empty__title">{t('pos.store.category.empty')}</p>
            <p className="cpos-empty__text">{t('pos.store.category.emptyHelp')}</p>
          </div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.store.category.name')}</th>
                  <th className="cpos-table__num">{t('pos.store.category.usedBy')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((category, index) => (
                  <tr key={category.id}>
                    <td>
                      {/* A link rather than a row click: a row that navigates
                          also swallows the Delete button underneath it. */}
                      <button
                        type="button"
                        className="cpos-rowlink"
                        onClick={() => push(`/pos/store/categories/${category.id}`)}
                      >
                        {category.name}
                      </button>
                    </td>
                    <td className="cpos-table__num">{counts[category.name] ?? 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="cpos-btn cpos-btn--ghost cpos-btn--sm"
                          onClick={() => push(`/pos/store/categories/${category.id}`)}
                        >
                          {t('pos.store.open')}
                        </button>
                        {mayEdit ? (
                          <>
                            <button
                              type="button"
                              className="cpos-btn cpos-btn--ghost cpos-btn--sm"
                              disabled={index === 0}
                              onClick={() => void move(index, -1)}
                            >
                              {t('pos.store.category.up')}
                            </button>
                            <button
                              type="button"
                              className="cpos-btn cpos-btn--ghost cpos-btn--sm"
                              disabled={index === categories.length - 1}
                              onClick={() => void move(index, 1)}
                            >
                              {t('pos.store.category.down')}
                            </button>
                            <button
                              type="button"
                              className="cpos-btn cpos-btn--danger cpos-btn--sm"
                              onClick={() => void remove(category)}
                            >
                              {t('common.delete')}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
