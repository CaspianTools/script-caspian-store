'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ContactStatus, ContactSubmission } from '../types';
import {
  deleteContact,
  listAllContacts,
  setContactStatus,
} from '../services/contact-service';
import { reportServiceError } from '../services/error-log-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Badge, Skeleton } from '../ui/misc';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Select } from '../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { Dialog } from '../ui/dialog';
import { Label } from '../ui/input';
import { useToast } from '../ui/toast';

type StatusFilter = 'all' | ContactStatus;

const FILTER_OPTIONS: StatusFilter[] = ['all', 'new', 'read', 'archived'];

const STATUS_VARIANT: Record<ContactStatus, 'default' | 'secondary' | 'destructive'> = {
  new: 'secondary',
  read: 'default',
  archived: 'destructive',
};

function fmtDate(ts: ContactSubmission['createdAt']) {
  return ts?.toDate ? ts.toDate().toLocaleString() : '—';
}

export interface AdminContactsListProps {
  className?: string;
  /** When true, the list refreshes from Firestore whenever this value flips. */
  refreshKey?: number;
  /** Fires after any local mutation (status change, delete) so parents can refresh counts. */
  onMutated?: () => void;
}

export function AdminContactsList({ className, refreshKey, onMutated }: AdminContactsListProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();

  const [contacts, setContacts] = useState<ContactSubmission[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('new');
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactSubmission | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContactSubmission | null>(null);

  useEffect(() => {
    let alive = true;
    setContacts(null);
    listAllContacts(db)
      .then((list) => {
        if (alive) setContacts(list);
      })
      .catch((error) => {
        reportServiceError(db, 'admin-contacts-list.load', error);
        if (!alive) return;
        setContacts([]);
        toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, refreshKey]);

  const filtered = useMemo(
    () =>
      contacts
        ? filter === 'all'
          ? contacts
          : contacts.filter((c) => c.status === filter)
        : [],
    [contacts, filter],
  );

  const mutateLocal = (id: string, patch: Partial<ContactSubmission>) =>
    setContacts((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) : prev));

  const handleStatus = async (contact: ContactSubmission, status: ContactStatus) => {
    setBusy(contact.id);
    try {
      await setContactStatus(db, contact.id, status);
      mutateLocal(contact.id, { status });
      onMutated?.();
      toast({ title: t(`admin.contacts.status.${status}`) });
    } catch (error) {
      reportServiceError(db, 'admin-contacts-list.setStatus', error);
      toast({ title: t('admin.common.actionFailed'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    const contact = pendingDelete;
    if (!contact) return;
    setBusy(contact.id);
    try {
      await deleteContact(db, contact.id);
      setContacts((prev) => (prev ? prev.filter((c) => c.id !== contact.id) : prev));
      onMutated?.();
      setPendingDelete(null);
      if (detail?.id === contact.id) setDetail(null);
      toast({ title: t('admin.common.deleted') });
    } catch (error) {
      reportServiceError(db, 'admin-contacts-list.delete', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({ title: t('admin.contacts.emailCopied') });
    } catch {
      // Silent — some browsers refuse clipboard without a direct gesture on older APIs.
    }
  };

  const openDetail = (contact: ContactSubmission) => {
    setDetail(contact);
    if (contact.status === 'new') {
      handleStatus(contact, 'read');
    }
  };

  return (
    <div className={className}>
      <div style={filterRowStyle}>
        <Label style={{ margin: 0, fontWeight: 500, color: '#666' }}>{t('admin.common.filter')}</Label>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          options={FILTER_OPTIONS.map((s) => ({
            value: s,
            label:
              s === 'all'
                ? t('admin.contacts.filterAll')
                : s === 'new'
                  ? t('admin.contacts.filterNew')
                  : s === 'read'
                    ? t('admin.contacts.filterRead')
                    : t('admin.contacts.filterArchived'),
          }))}
        />
      </div>

      {contacts === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : filtered.length === 0 ? (
        <p style={emptyStyle}>{t('admin.contacts.empty')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.contacts.col.name')}</TH>
              <TH>{t('admin.contacts.col.email')}</TH>
              <TH>{t('admin.contacts.col.subject')}</TH>
              <TH>{t('admin.contacts.col.message')}</TH>
              <TH>{t('admin.contacts.col.received')}</TH>
              <TH>{t('admin.contacts.col.status')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.contacts.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((c) => {
              const isBusy = busy === c.id;
              return (
                <TR key={c.id}>
                  <TD style={{ fontWeight: 500 }}>
                    <button type="button" onClick={() => openDetail(c)} style={rowButtonStyle}>
                      {c.name}
                    </button>
                  </TD>
                  <TD style={{ fontSize: 13, color: '#333' }}>{c.email}</TD>
                  <TD style={{ fontSize: 13, color: '#555' }}>
                    {c.subject || <span style={{ color: '#bbb' }}>—</span>}
                  </TD>
                  <TD style={{ maxWidth: 280 }}>
                    <button
                      type="button"
                      onClick={() => openDetail(c)}
                      style={rowButtonStyle}
                      aria-label={t('admin.contacts.openDetail', { name: c.name })}
                    >
                      <span style={snippetStyle}>{c.message}</span>
                    </button>
                  </TD>
                  <TD style={{ fontSize: 12, color: '#888' }}>{fmtDate(c.createdAt)}</TD>
                  <TD>
                    <Badge variant={STATUS_VARIANT[c.status]}>
                      {t(`admin.contacts.status.${c.status}`)}
                    </Badge>
                  </TD>
                  <TD data-label="" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {c.status === 'new' && (
                        <Button size="sm" disabled={isBusy} onClick={() => handleStatus(c, 'read')}>
                          {t('admin.contacts.markRead')}
                        </Button>
                      )}
                      {c.status === 'read' && (
                        <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleStatus(c, 'new')}>
                          {t('admin.contacts.markNew')}
                        </Button>
                      )}
                      {c.status !== 'archived' ? (
                        <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleStatus(c, 'archived')}>
                          {t('admin.contacts.archive')}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleStatus(c, 'read')}>
                          {t('admin.contacts.unarchive')}
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" disabled={isBusy} onClick={() => setPendingDelete(c)}>
                        {t('admin.contacts.delete')}
                      </Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
        title={detail ? detail.name : t('admin.contacts.detail.title')}
        description={detail ? fmtDate(detail.createdAt) : undefined}
        maxWidth={560}
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => copyEmail(detail.email)}>
                {t('admin.contacts.copyEmail')}
              </Button>
              <Button onClick={() => setDetail(null)}>{t('common.close')}</Button>
            </>
          ) : null
        }
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={detailRowStyle}>
              <strong>{t('contact.form.email')}:</strong>{' '}
              <a href={`mailto:${detail.email}`} style={{ color: 'var(--caspian-primary, #111)' }}>
                {detail.email}
              </a>
            </div>
            {detail.subject && (
              <div style={detailRowStyle}>
                <strong>{t('contact.form.subject')}:</strong> {detail.subject}
              </div>
            )}
            <div>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('contact.form.message')}:</strong>
              <div style={messageBoxStyle}>{detail.message}</div>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.confirm.deleteNamedTitle', { name: pendingDelete?.name ?? '' })}
        description={t('admin.contacts.deleteConfirm')}
        confirmLabel={t('common.delete')}
        destructive
        loading={pendingDelete !== null && busy === pendingDelete.id}
        onConfirm={handleDelete}
      />
    </div>
  );
}

const filterRowStyle: CSSProperties = {
  margin: '12px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const emptyStyle: CSSProperties = {
  color: '#888',
  padding: 32,
  textAlign: 'center',
};

// Text-styled button so the clickable name / message cells are reachable by
// keyboard — a bare `<td onClick>` is invisible to Tab and screen readers.
const rowButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 0,
  font: 'inherit',
  fontWeight: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  maxWidth: '100%',
};

const snippetStyle: CSSProperties = {
  margin: 0,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  fontSize: 13,
  color: '#333',
};

const detailRowStyle: CSSProperties = {
  fontSize: 14,
};

const messageBoxStyle: CSSProperties = {
  background: '#fafafa',
  padding: 12,
  borderRadius: 'var(--caspian-radius, 6px)',
  fontSize: 14,
  whiteSpace: 'pre-wrap',
  lineHeight: 1.5,
  border: '1px solid rgba(0,0,0,0.08)',
};
