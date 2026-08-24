'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readLocalRoles, writeLocalRoles } from './local-db';
import { BUILTIN_ROLES, type PosLocalArea, type PosLocalRole, type RoleDefinition } from './types';

interface PosRoleContextValue {
  roles: RoleDefinition[];
  loading: boolean;
  refresh: () => Promise<void>;
  saveRoles: (roles: RoleDefinition[]) => Promise<void>;
  canAccess: (role: PosLocalRole | null | undefined, area: PosLocalArea) => boolean;
  enabledRoles: RoleDefinition[];
}

const PosRoleContext = createContext<PosRoleContextValue | null>(null);

/**
 * Loads role definitions from the till's disk and exposes a `canAccess` that
 * respects the App Admin configuration.
 *
 * Built-in roles are merged with stored definitions so the app keeps working
 * even if the role store is empty or from an older version.
 */
export function PosRoleProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<RoleDefinition[]>(BUILTIN_ROLES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const stored = await readLocalRoles();
      const merged = mergeWithBuiltins(stored);
      setRoles(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveRoles = useCallback(async (next: RoleDefinition[]) => {
    const merged = mergeWithBuiltins(next);
    await writeLocalRoles(merged);
    setRoles(merged);
  }, []);

  const canAccess = useCallback(
    (role: PosLocalRole | null | undefined, area: PosLocalArea): boolean => {
      if (!role) return false;
      const def = roles.find((r) => r.id === role);
      if (!def || !def.enabled) return false;
      return def.areas.includes(area);
    },
    [roles],
  );

  const enabledRoles = useMemo(() => roles.filter((r) => r.enabled), [roles]);

  const value = useMemo(
    () => ({ roles, loading, refresh, saveRoles, canAccess, enabledRoles }),
    [roles, loading, refresh, saveRoles, canAccess, enabledRoles],
  );

  return <PosRoleContext.Provider value={value}>{children}</PosRoleContext.Provider>;
}

function mergeWithBuiltins(stored: RoleDefinition[]): RoleDefinition[] {
  const map = new Map(stored.map((r) => [r.id, r]));
  for (const builtIn of BUILTIN_ROLES) {
    if (!map.has(builtIn.id)) {
      map.set(builtIn.id, builtIn);
    }
  }
  return Array.from(map.values());
}

export function usePosRoles(): PosRoleContextValue {
  const ctx = useContext(PosRoleContext);
  if (!ctx) throw new Error('usePosRoles must be used inside PosRoleProvider');
  return ctx;
}

/**
 * The same value, or null when no provider is above.
 *
 * `PosGuard` is exported on its own and a consumer may well have mounted it
 * without the provider, so the gate on the register cannot be written against a
 * hook that throws. Callers fall back to the static `canAccess`, which is what
 * the guard did everywhere before role definitions existed.
 */
export function usePosRolesOptional(): PosRoleContextValue | null {
  return useContext(PosRoleContext);
}
