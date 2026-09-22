'use client';

import { useEffect, useState } from 'react';
import { getCountFromServer, query, where } from 'firebase/firestore';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { caspianCollections } from '../firebase/collections';
import {
  DEFAULT_REPO_NAME,
  DEFAULT_REPO_OWNER,
  fetchRecentReleases,
  isUpdateAvailable,
} from '../services/github-updates-service';
import { CASPIAN_STORE_VERSION } from '../version';

export type AdminNotificationKind =
  | 'update-available'
  | 'pending-reviews'
  | 'pending-questions'
  | 'new-contacts';

export interface AdminNotification {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  description?: string;
  /** Internal link to resolve the notification (e.g. `/admin/about`). */
  href?: string;
  /** ISO timestamp for sort / display. Some notifications are live-state only. */
  createdAt?: string;
}

export interface UseAdminNotificationsOptions {
  /** Check GitHub Releases for an available library update. Default true. */
  checkForUpdates?: boolean;
  /** Count pending reviews + questions in Firestore. Default true. */
  checkModeration?: boolean;
  /** GitHub owner used for the update check. */
  updateCheckOwner?: string;
  /** GitHub repo used for the update check. */
  updateCheckRepo?: string;
}

export interface UseAdminNotificationsResult {
  notifications: AdminNotification[];
  loading: boolean;
  unreadCount: number;
  /** Force a re-fetch of both sources. */
  refresh: () => void;
}

/**
 * Derives a list of admin-facing notifications from live sources. Each source
 * is ephemeral — notifications disappear when the underlying condition is
 * resolved (version upgraded, reviews approved). No persistent read state.
 */
export function useAdminNotifications(
  options: UseAdminNotificationsOptions = {},
): UseAdminNotificationsResult {
  const {
    checkForUpdates = true,
    checkModeration = true,
    updateCheckOwner = DEFAULT_REPO_OWNER,
    updateCheckRepo = DEFAULT_REPO_NAME,
  } = options;
  const { db } = useCaspianFirebase();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const out: AdminNotification[] = [];

    const tasks: Array<Promise<void>> = [];

    if (checkForUpdates) {
      tasks.push(
        fetchRecentReleases(updateCheckOwner, updateCheckRepo, 1)
          .then((releases) => {
            const latest = releases[0];
            if (latest?.version && isUpdateAvailable(CASPIAN_STORE_VERSION, latest.version)) {
              out.push({
                id: `update-available:${latest.version}`,
                kind: 'update-available',
                title: `Update available — v${latest.version}`,
                description: latest.name ?? undefined,
                href: '/admin/about',
                createdAt: latest.publishedAt,
              });
            }
          })
          .catch(() => {
            // Silent — GitHub unreachable isn't a user-actionable notification.
          }),
      );
    }

    if (checkModeration) {
      const refs = caspianCollections(db);
      tasks.push(
        getCountFromServer(query(refs.reviews, where('status', '==', 'pending')))
          .then((snap) => {
            const count = snap.data().count;
            if (count > 0) {
              out.push({
                id: 'pending-reviews',
                kind: 'pending-reviews',
                title: `${count} pending review${count === 1 ? '' : 's'}`,
                description: 'Moderate new reviews',
                href: '/admin/reviews',
              });
            }
          })
          .catch(() => {
            // Rules may forbid the count; silent.
          }),
      );
      tasks.push(
        getCountFromServer(query(refs.questions, where('status', '==', 'pending')))
          .then((snap) => {
            const count = snap.data().count;
            if (count > 0) {
              out.push({
                id: 'pending-questions',
                kind: 'pending-questions',
                title: `${count} pending question${count === 1 ? '' : 's'}`,
                description: 'Moderate new product questions',
                href: '/admin/reviews',
              });
            }
          })
          .catch(() => {
            // Silent for the same reason.
          }),
      );
      tasks.push(
        getCountFromServer(query(refs.contacts, where('status', '==', 'new')))
          .then((snap) => {
            const count = snap.data().count;
            if (count > 0) {
              out.push({
                id: 'new-contacts',
                kind: 'new-contacts',
                title: `${count} new contact${count === 1 ? '' : 's'}`,
                description: 'Review incoming contact-form submissions',
                href: '/admin/contacts',
              });
            }
          })
          .catch(() => {
            // Silent — pre-v2.13 stores won't have the contacts collection yet.
          }),
      );
    }

    Promise.all(tasks).finally(() => {
      if (!alive) return;
      setNotifications(out);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [db, checkForUpdates, checkModeration, updateCheckOwner, updateCheckRepo, nonce]);

  return {
    notifications,
    loading,
    unreadCount: notifications.length,
    refresh: () => setNonce((n) => n + 1),
  };
}
