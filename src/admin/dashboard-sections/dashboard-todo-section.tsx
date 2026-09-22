'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminTodo } from '../../types';
import {
  createAdminTodo,
  deleteAdminTodo,
  listenAdminTodos,
  seedDefaultAdminTodos,
  updateAdminTodo,
} from '../../services/admin-todo-service';
import { verifyAdminTodos } from '../../services/admin-todo-detectors';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { CheckIcon, RefreshIcon } from '../../ui/icons';
import { Input } from '../../ui/input';
import { Badge, Skeleton } from '../../ui/misc';
import { useToast } from '../../ui/toast';
import { DashboardSection } from './dashboard-section';

export function DashboardTodoSection() {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [todos, setTodos] = useState<AdminTodo[] | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminTodo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const firstSnapshotRef = useRef(true);

  useEffect(() => {
    firstSnapshotRef.current = true;
    const unsubscribe = listenAdminTodos(
      db,
      async (next) => {
        setTodos(next);
        // Only the very first snapshot may auto-seed: an empty list later on
        // means the admin deleted every task on purpose, not a fresh store.
        const isFirst = firstSnapshotRef.current;
        firstSnapshotRef.current = false;
        if (isFirst && next.length === 0) {
          try {
            await seedDefaultAdminTodos(db);
          } catch (error) {
            console.error('[caspian-store] Auto-seed failed:', error);
          }
        }
      },
      (err) => {
        console.error('[caspian-store] Todos listener error:', err);
        setTodos((prev) => prev ?? []);
        toast({ title: t('admin.dashboard.todos.loadFailed'), variant: 'destructive' });
      },
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const progress = useMemo(() => {
    if (!todos || todos.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = todos.filter((t) => t.done).length;
    return { done, total: todos.length, pct: Math.round((done / todos.length) * 100) };
  }, [todos]);

  const visibleTodos = useMemo(() => {
    if (!todos) return null;
    const filtered = hideDone ? todos.filter((t) => !t.done) : todos;
    return showAll ? filtered : filtered.slice(0, 10);
  }, [todos, hideDone, showAll]);

  const pendingCount = useMemo(() => (todos ?? []).filter((t) => !t.done).length, [todos]);

  const handleToggle = async (todo: AdminTodo) => {
    try {
      await updateAdminTodo(db, todo.id, { done: !todo.done });
    } catch (error) {
      console.error('[caspian-store] Toggle failed:', error);
      toast({ title: t('admin.dashboard.todos.updateFailed'), variant: 'destructive' });
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const order = (todos?.length ?? 0) + 1;
      await createAdminTodo(db, { title: newTitle.trim(), order, isDefault: false });
      setNewTitle('');
    } catch (error) {
      console.error('[caspian-store] Add failed:', error);
      toast({ title: t('admin.dashboard.todos.addFailed'), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteAdminTodo(db, pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: t('admin.dashboard.todos.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const written = await seedDefaultAdminTodos(db);
      toast({
        title:
          written === 0
            ? t('admin.dashboard.todos.alreadySeeded')
            : t('admin.dashboard.todos.seeded', { count: written }),
      });
    } catch (error) {
      console.error('[caspian-store] Seed failed:', error);
      toast({ title: t('admin.dashboard.todos.seedFailed'), variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const handleVerify = async () => {
    if (!todos) return;
    setVerifying(true);
    try {
      const ids = await verifyAdminTodos(db, todos);
      if (ids.length === 0) {
        toast({ title: t('admin.dashboard.todos.verifyNothing') });
      } else {
        await Promise.all(ids.map((id) => updateAdminTodo(db, id, { done: true })));
        toast({ title: t('admin.dashboard.todos.verifyMarked', { count: ids.length }) });
      }
    } catch (error) {
      console.error('[caspian-store] Verify failed:', error);
      toast({ title: t('admin.dashboard.todos.verifyFailed'), variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const totalFiltered = (todos ?? []).filter((t) => (hideDone ? !t.done : true)).length;
  const hasMore = totalFiltered > 10 && !showAll;

  return (
    <DashboardSection
      title={t('admin.dashboard.todos.title')}
      subtitle={t('admin.dashboard.todos.subtitle')}
      count={pendingCount}
      defaultOpen={pendingCount > 0}
      anchorId="todos"
    >
      {todos !== null && todos.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 16px',
            background: '#f6f6f6',
            borderRadius: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              {t('admin.dashboard.todos.progress', {
                done: progress.done,
                total: progress.total,
                pct: progress.pct,
              })}
            </div>
            <div
              style={{
                height: 6,
                background: '#e5e5e5',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress.pct}%`,
                  background: 'var(--caspian-primary, #111)',
                  transition: 'width 200ms',
                }}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleVerify} loading={verifying}>
            <RefreshIcon size={14} /> {t('admin.dashboard.todos.verify')}
          </Button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            {t('admin.dashboard.todos.hideCompleted')}
          </label>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Input
          placeholder={t('admin.dashboard.todos.addPlaceholder')}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          style={{ flex: 1, minWidth: 240 }}
        />
        <Button onClick={handleAdd} loading={adding} disabled={!newTitle.trim()}>
          {t('admin.dashboard.todos.add')}
        </Button>
        <Button variant="outline" onClick={handleSeedDefaults} loading={seeding}>
          {t('admin.dashboard.todos.reseed')}
        </Button>
      </div>

      {visibleTodos === null ? (
        <Skeleton style={{ height: 200 }} />
      ) : visibleTodos.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: '#888',
            border: '1px dashed #ddd',
            borderRadius: 8,
          }}
        >
          {todos && todos.length > 0 && hideDone
            ? t('admin.dashboard.todos.allDone')
            : t('admin.dashboard.todos.empty')}
        </div>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleTodos.map((todo) => (
              <li
                key={todo.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 14,
                  border: '1px solid #eee',
                  borderRadius: 8,
                  background: todo.done ? '#fafafa' : '#fff',
                }}
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => handleToggle(todo)}
                  style={{ marginTop: 4, cursor: 'pointer' }}
                  aria-label={t(
                    todo.done ? 'admin.dashboard.todos.markNotDone' : 'admin.dashboard.todos.markDone',
                    { title: todo.title },
                  )}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                      fontSize: 15,
                      textDecoration: todo.done ? 'line-through' : 'none',
                      color: todo.done ? '#888' : '#111',
                    }}
                  >
                    {todo.done && <CheckIcon size={16} />}
                    {todo.title}
                    {todo.isDefault && (
                      <Badge variant="secondary">{t('admin.dashboard.todos.setupBadge')}</Badge>
                    )}
                  </div>
                  {todo.description && (
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: 13,
                        color: '#666',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {todo.description}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(todo)}>
                  {t('common.delete')}
                </Button>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                {t('admin.dashboard.todos.showAll', { count: totalFiltered })}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.confirm.deleteNamedTitle', { name: pendingDelete?.title ?? '' })}
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </DashboardSection>
  );
}
