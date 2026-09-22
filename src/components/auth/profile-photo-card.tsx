'use client';

import { useRef, useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import {
  MAX_PROFILE_PHOTO_BYTES,
  removeProfilePhoto,
  uploadProfilePhoto,
} from '../../services/storage-service';
import { Avatar } from '../../ui/misc';
import { Button } from '../../ui/button';
import { useToast } from '../../ui/toast';

export function ProfilePhotoCard({ className }: { className?: string }) {
  const { user, userProfile, refreshProfile } = useAuth();
  const { db, auth, storage } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user || !userProfile) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadProfilePhoto({ storage, db, auth, uid: user.uid, file });
      await refreshProfile();
      toast({ title: t('photo.uploaded') });
    } catch (error) {
      console.error('[caspian-store] Photo upload failed:', error);
      const msg = error instanceof Error ? error.message : t('photo.uploadFailed');
      toast({ title: t('photo.uploadFailed'), description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await removeProfilePhoto({ storage, db, auth, uid: user.uid });
      await refreshProfile();
      toast({ title: t('photo.removed') });
    } catch (error) {
      console.error('[caspian-store] Photo remove failed:', error);
      toast({ title: t('photo.uploadFailed'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      className={className}
      style={{
        padding: 20,
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 12 }}>{t('photo.title')}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar src={userProfile.photoURL} fallback={userProfile.displayName} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              style={{ minHeight: 44 }}
            >
              {uploading ? t('photo.uploading') : t('photo.change')}
            </Button>
            {userProfile.photoURL && (
              <Button type="button" variant="ghost" disabled={uploading} onClick={handleRemove} style={{ minHeight: 44 }}>
                {t('photo.remove')}
              </Button>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
            JPEG, PNG, or WebP · max {MAX_PROFILE_PHOTO_BYTES / 1024 / 1024} MB
          </p>
        </div>
      </div>
    </section>
  );
}
