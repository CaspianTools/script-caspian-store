'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { countNewContacts } from '../services/contact-service';
import { AdminContactsList } from './admin-contacts-list';

export interface AdminContactsPageProps {
  className?: string;
}

export function AdminContactsPage({ className }: AdminContactsPageProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [newCount, setNewCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      setNewCount(await countNewContacts(db));
    } catch (error) {
      console.error('[caspian-store] Failed to count new contacts:', error);
    }
  }, [db]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount, refreshKey]);

  const handleMutated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className={className}>
      <header className="caspian-admin-page-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('admin.contacts.title')}
          {newCount !== null && newCount > 0 ? ` (${newCount})` : ''}
        </h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.contacts.subtitle')}</p>
      </header>
      <AdminContactsList refreshKey={refreshKey} onMutated={handleMutated} />
    </div>
  );
}
