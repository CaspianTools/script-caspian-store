'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { FolderIcon } from '../../../ui/icons';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import {
  adoptLocalCategoriesFromProducts,
  deleteLocalCategory,
  listLocalCategories,
  listLocalProducts,
  makeLocalCategory,
  renameLocalCategory,
  saveLocalCategory,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import type { LocalCategory } from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { PanelLoadError } from './panel-load-error';

/**
 * The shop's list of groups.
 *
 * A vocabulary, not a table products point at: a product stores the category
 * name, and renaming one here rewrites the products carrying it. That is what
 * lets this screen be switched off again without stranding a catalogue, and
 * what keeps the CSV and the backup unchanged.
 */
export function LocalCategoriesPanel() {
  const t = useT();
  const { toast } = useToast();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const mayEdit = can(session.user?.role, 'store.edit');

  const [categories, setCategories] = useState<LocalCategory[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    if ((categories ?? []).some((c) => c.nameLower === name.toLowerCase())) {
      toast({ title: t('pos.store.category.duplicate'), variant: 'destructive' });
      return;
    }
    await saveLocalCategory(makeLocalCategory({ name, sortOrder: (categories ?? []).length }));
    setAdding('');
    await refresh();
  };

  const rename = async () => {
    if (!editingId) return;
    await renameLocalCategory(editingId, editingName);
    setEditingId(null);
    setEditingName('');
    await refresh();
    toast({ title: t('pos.store.category.renamed') });
  };

  const remove = async (category: LocalCategory) => {
    const using = counts[category.name] ?? 0;
    if (!window.confirm(t('pos.store.category.confirmDelete', { name: category.name, count: using })))
      return;
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
    const target = index + delta;
    const a = rows[index];
    const b = rows[target];
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

      {mayEdit ? (
        <section className="cpos-section">
          <h2 className="cpos-section__title">{t('pos.store.category.add')}</h2>
          <div className="cpos-row">
            <Input
              style={{ maxWidth: 280 }}
              value={adding}
              placeholder={t('pos.store.category.namePlaceholder')}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add();
              }}
            />
            <Button onClick={() => void add()}>{t('pos.store.category.addAction')}</Button>
            <Button variant="outline" onClick={() => void adopt()}>
              {t('pos.store.category.adopt')}
            </Button>
          </div>
          <FieldDescription>{t('pos.store.category.adoptHelp')}</FieldDescription>
        </section>
      ) : null}

      <section className="cpos-section">
        <h2 className="cpos-section__title">
          {t('pos.store.category.listTitle', { count: categories?.length ?? 0 })}
        </h2>

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
                      {editingId === category.id ? (
                        <Input
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void rename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        category.name
                      )}
                    </td>
                    <td className="cpos-table__num">{counts[category.name] ?? 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {mayEdit && editingId === category.id ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                              {t('common.cancel')}
                            </Button>
                            <Button size="sm" onClick={() => void rename()}>
                              {t('common.save')}
                            </Button>
                          </>
                        ) : mayEdit ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => void move(index, -1)}
                            >
                              {t('pos.store.category.up')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={index === categories.length - 1}
                              onClick={() => void move(index, 1)}
                            >
                              {t('pos.store.category.down')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(category.id);
                                setEditingName(category.name);
                              }}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void remove(category)}
                            >
                              {t('common.delete')}
                            </Button>
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
