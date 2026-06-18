'use client';

import { ProfilePhotoCard } from '../components/auth/profile-photo-card';
import { ProfileCard } from '../components/auth/profile-card';
import { ChangePasswordCard } from '../components/auth/change-password-card';

export interface AdminAccountPageProps {
  className?: string;
}

/**
 * `/admin/account` — the signed-in admin's own account page, rendered inside
 * the admin chrome. Reuses the storefront account cards (self-styled, so they
 * sit fine on the admin panel). Scope is the admin's own details + security:
 * profile (name/phone), photo, and password. Email stays read-only; no
 * delete-account here (an owner locking themselves out is too easy). The page
 * sits behind `AdminGuard`, so the cards always have a signed-in user.
 */
export function AdminAccountPage({ className }: AdminAccountPageProps) {
  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>My account</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          Manage your name, contact details, photo, and password.
        </p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, minWidth: 0 }}>
        <ProfilePhotoCard />
        <ProfileCard />
        <ChangePasswordCard />
      </div>
    </div>
  );
}
