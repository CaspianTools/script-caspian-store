'use client';

import { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { updateProfileFields } from '../../services/user-service';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Input, Label } from '../../ui/input';
import { useToast } from '../../ui/toast';

export function ProfileCard({ className }: { className?: string }) {
  const { user, userProfile, refreshProfile } = useAuth();
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userProfile?.displayName ?? '');
  const [phone, setPhone] = useState(userProfile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  if (!user || !userProfile) return null;

  const startEdit = () => {
    setName(userProfile.displayName ?? '');
    setPhone(userProfile.phone ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t('profile.nameRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateProfileFields(db, user.uid, {
        displayName: name.trim(),
        phone: phone.trim(),
      });
      await refreshProfile();
      toast({ title: t('profile.updated') });
      setEditing(false);
    } catch (error) {
      console.error('[caspian-store] Profile update failed:', error);
      toast({ title: t('profile.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(userProfile.displayName ?? '');
    setPhone(userProfile.phone ?? '');
    setEditing(false);
  };

  return (
    <section
      className={className}
      style={{ padding: 20, border: '1px solid #eee', borderRadius: 'var(--caspian-radius, 8px)' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('profile.title')}</h2>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            {t('common.edit')}
          </Button>
        )}
      </header>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label>{t('profile.displayName')}</Label>
            <Input
              autoComplete="name"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('profile.email')}</Label>
            <Input value={userProfile.email} disabled readOnly />
            <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
              {t('profile.emailReadonly')}
            </p>
          </div>
          <div>
            <Label>{t('profile.phone')}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('profile.phonePlaceholder')}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              enterKeyHint="done"
            />
          </div>
          <div className="caspian-stack-mobile" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label={t('profile.displayName')} value={userProfile.displayName || '—'} />
          <Row label={t('profile.email')} value={userProfile.email} />
          <Row label={t('profile.phone')} value={userProfile.phone || '—'} />
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 140px) minmax(0, 1fr)', gap: 8, fontSize: 14 }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
