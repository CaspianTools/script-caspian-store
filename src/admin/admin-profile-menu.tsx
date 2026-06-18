'use client';

import { useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianNavigation } from '../provider/caspian-store-provider';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { ExternalLinkIcon, LogOutIcon, UserIcon } from '../ui/icons';
import { Avatar } from '../ui/misc';
import { useToast } from '../ui/toast';

export interface AdminProfileMenuProps {
  /** Storefront home URL. Default: `/`. */
  storefrontHref?: string;
  /** The admin's own account page. Default: `/admin/account` (in-chrome). */
  profileHref?: string;
  /** Where to send the user after sign-out. Default: `/login`. */
  afterSignOutHref?: string;
  /** Avatar size in px. Default: 36. */
  avatarSize?: number;
  className?: string;
}

/**
 * Drop-in header-right element for `<AdminShell>`: avatar + dropdown with
 * "View storefront", "My profile", "Sign out". Pulls the signed-in user from
 * `useAuth()` and falls back to initials if no photoURL.
 *
 * Renders nothing while auth is loading, and a skeleton circle for an
 * unauthenticated viewer (normally shouldn't happen since `<AdminGuard>`
 * protects the route).
 */
export function AdminProfileMenu({
  storefrontHref = '/',
  profileHref = '/admin/account',
  afterSignOutHref = '/login',
  avatarSize = 36,
  className,
}: AdminProfileMenuProps) {
  const { user, userProfile, loading, signOut } = useAuth();
  const nav = useCaspianNavigation();
  const { toast } = useToast();

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      nav.push(afterSignOutHref);
    } catch (error) {
      console.error('[caspian-store] Sign-out failed:', error);
      toast({ title: 'Sign-out failed', variant: 'destructive' });
    }
  }, [signOut, nav, afterSignOutHref, toast]);

  if (loading) return null;

  const displayName =
    userProfile?.displayName || user?.displayName || user?.email || '';
  const photoURL = userProfile?.photoURL ?? user?.photoURL ?? null;
  const fallback = (displayName || 'A').charAt(0);
  const email = user?.email ?? '';

  return (
    <DropdownMenu
      className={className}
      trigger={
        <button
          type="button"
          aria-label="Account menu"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            borderRadius: '50%',
            lineHeight: 0,
          }}
        >
          <Avatar src={photoURL} alt={displayName} fallback={fallback} size={avatarSize} />
        </button>
      }
      minWidth={220}
    >
      {displayName && (
        <>
          <div
            style={{
              padding: '8px 10px 4px',
              fontSize: 13,
              color: '#111',
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {displayName}
          </div>
          {email && (
            <div style={{ padding: '0 10px 8px', fontSize: 12, color: '#666', lineHeight: 1.3 }}>
              {email}
            </div>
          )}
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem
        icon={<ExternalLinkIcon size={14} />}
        onSelect={() => {
          window.open(storefrontHref, '_blank', 'noreferrer');
        }}
      >
        View storefront
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={<UserIcon size={14} />}
        onSelect={() => nav.push(profileHref)}
      >
        My profile
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        icon={<LogOutIcon size={14} />}
        destructive
        onSelect={handleSignOut}
      >
        Sign out
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
