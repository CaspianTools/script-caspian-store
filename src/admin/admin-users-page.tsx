'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { USER_ROLES, type UserProfile, type UserRole } from '../types';
import { listUsers } from '../services/user-service';
import { reportServiceError } from '../services/error-log-service';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useAuth } from '../context/auth-context';
import { useT } from '../i18n/locale-context';
import { Badge, Skeleton } from '../ui/misc';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';

export interface AdminUsersPageProps {
  className?: string;
}

type RowState = { kind: 'busy' } | { kind: 'error'; message: string };

export function AdminUsersPage({ className }: AdminUsersPageProps) {
  const { db, functions } = useCaspianFirebase();
  const Link = useCaspianLink();
  const { user } = useAuth();
  const t = useT();
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    let alive = true;
    setUsers(null);
    listUsers(db)
      .then((list) => {
        if (alive) setUsers(list);
      })
      .catch((error) => {
        reportServiceError(db, 'admin-users-page.load', error);
        if (alive) setUsers([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && (u.role ?? 'customer') !== roleFilter) return false;
      if (!q) return true;
      return (
        Boolean(u.email?.toLowerCase().includes(q)) ||
        Boolean(u.displayName?.toLowerCase().includes(q))
      );
    });
  }, [users, search, roleFilter]);

  const CONFIRM_KEY: Record<UserRole, string> = {
    admin: 'admin.users.action.confirmMakeAdmin',
    staff: 'admin.users.action.confirmMakeStaff',
    customer: 'admin.users.action.confirmMakeCustomer',
  };

  const runRoleChange = async (target: UserProfile, nextRole: UserRole) => {
    if (typeof window !== 'undefined' && !window.confirm(t(CONFIRM_KEY[nextRole]))) return;

    setRowState((s) => ({ ...s, [target.uid]: { kind: 'busy' } }));
    try {
      // `setUserRole` supersedes the two-role promoteUserToAdmin /
      // demoteAdminToCustomer callables, which stay deployed for back-compat.
      await httpsCallable(functions, 'setUserRole')({ uid: target.uid, role: nextRole });
      // Optimistic local update — avoid a refetch round-trip.
      setUsers((prev) =>
        prev ? prev.map((u) => (u.uid === target.uid ? { ...u, role: nextRole } : u)) : prev,
      );
      setRowState((s) => {
        const next = { ...s };
        delete next[target.uid];
        return next;
      });
    } catch (error) {
      reportServiceError(db, 'admin-users-page.setRole', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : t('admin.users.action.errorGeneric');
      setRowState((s) => ({ ...s, [target.uid]: { kind: 'error', message } }));
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.users.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          {users === null ? t('admin.users.subtitle') : `${users.length} total`}
        </p>
      </header>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            placeholder={t('admin.users.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label={t('admin.users.col.role')}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
          options={[
            { value: 'all', label: t('admin.users.filter.all') },
            { value: 'admin', label: t('admin.users.filter.admins') },
            { value: 'staff', label: t('admin.users.filter.staff') },
            { value: 'customer', label: t('admin.users.filter.customers') },
          ]}
        />
      </div>

      {users === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : filtered.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>{t('admin.users.empty')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.users.col.name')}</TH>
              <TH>{t('admin.users.col.email')}</TH>
              <TH>{t('admin.users.col.role')}</TH>
              <TH>{t('admin.users.col.joined')}</TH>
              <TH>{t('admin.users.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((u) => {
              const state = rowState[u.uid];
              const busy = state?.kind === 'busy';
              const isSelf = !!user && u.uid === user.uid;
              const isAdmin = u.role === 'admin';
              return (
                <TR key={u.uid}>
                  <TD style={{ fontWeight: 500 }}>
                    <Link href={`/admin/users/${u.uid}`}>
                      {u.displayName || u.email || u.uid}
                    </Link>
                  </TD>
                  <TD style={{ fontSize: 13, color: '#333' }}>{u.email}</TD>
                  <TD>
                    <Badge variant={isAdmin ? 'secondary' : 'default'}>
                      {u.role ?? 'customer'}
                    </Badge>
                  </TD>
                  <TD style={{ color: '#888', fontSize: 13 }}>
                    {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString() : '—'}
                  </TD>
                  <TD>
                    {isAdmin && isSelf ? (
                      <span style={{ color: '#888', fontSize: 12 }}>
                        {t('admin.users.action.self')}
                      </span>
                    ) : (
                      // A picker rather than one toggle: there are three roles
                      // now, and "promote"/"demote" cannot express staff.
                      <Select
                        aria-label={t('admin.users.action.setRole')}
                        value={u.role ?? 'customer'}
                        disabled={busy}
                        onChange={(e) => runRoleChange(u, e.target.value as UserRole)}
                        options={USER_ROLES.map((r) => ({
                          value: r,
                          label: t(`admin.users.role.${r}`),
                        }))}
                      />
                    )}
                    {state?.kind === 'error' && (
                      <div style={{ color: '#c00', fontSize: 11, marginTop: 4, maxWidth: 220 }}>
                        {state.message}
                      </div>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
