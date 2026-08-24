'use client';

import { useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useToast } from '../../../ui/toast';
import { usePosRoles } from '../role-context';
import {
  BUILTIN_ROLES,
  POS_LOCAL_AREAS,
  type PosLocalRole,
  type RoleDefinition,
} from '../types';
import { actions, field, fieldLabel, muted, section } from './panel-styles';

/**
 * Roles that cannot be switched off.
 *
 * `superadmin` is the only role carrying the `support` area, and that area is
 * the only key to this page. Unticking it would take the register, the store,
 * the back office and this screen away from the account that did it, and a
 * standalone till has no server-side override to hand it back — a factory reset
 * would be the only way out.
 */
const LOCKED_IDS: readonly PosLocalRole[] = ['superadmin'];

/** Roles kept only so accounts already holding them keep working. */
const DUPLICATE_IDS: readonly PosLocalRole[] = ['cashier'];

export function PosAppAdminPage() {
  const t = useT();
  const { toast } = useToast();
  const { roles, saveRoles, loading } = usePosRoles();
  const [editing, setEditing] = useState<RoleDefinition | null>(null);

  const toggleBuiltIn = (id: PosLocalRole) => {
    if (LOCKED_IDS.includes(id)) return;
    const next = roles.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    void saveRoles(next).then(() => toast({ title: t('pos.settings.saved') }));
  };

  const startAdd = () => {
    setEditing({
      id: `custom-${Date.now()}`,
      name: '',
      enabled: true,
      areas: ['register'],
      builtIn: false,
    });
  };

  const saveCustom = () => {
    if (!editing || !editing.name.trim()) return;
    const exists = roles.some((r) => r.id === editing.id);
    const next = exists
      ? roles.map((r) => (r.id === editing.id ? editing : r))
      : [...roles, editing];
    void saveRoles(next).then(() => {
      setEditing(null);
      toast({ title: t('pos.appAdmin.roleSaved') });
    });
  };

  const removeCustom = (id: PosLocalRole) => {
    const next = roles.filter((r) => r.id !== id);
    void saveRoles(next).then(() => toast({ title: t('pos.appAdmin.roleDeleted') }));
  };

  /**
   * `t` echoes an unknown key straight back, which would paint
   * `pos.appAdmin.role.x` on the page. A built-in that outruns the message
   * table falls back to its own English name instead.
   */
  const roleLabel = (role: RoleDefinition) => {
    const key = `pos.appAdmin.role.${role.id}`;
    const translated = t(key);
    return translated === key ? role.name : translated;
  };

  const custom = roles.filter((r) => !r.builtIn);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('pos.appAdmin.title')}</h1>
        <p style={{ color: '#666', marginTop: 4, fontSize: 14 }}>{t('pos.appAdmin.subtitle')}</p>
      </header>

      {loading ? (
        <div style={muted}>{t('common.loading')}</div>
      ) : (
        <>
          <section style={section}>
            <span style={fieldLabel}>{t('pos.appAdmin.predefinedTitle')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/*
                Driven by BUILTIN_ROLES rather than a second list of ids kept
                beside it. Those two drifting apart is what made this page throw
                on every render from the day it shipped.
              */}
              {BUILTIN_ROLES.map((builtIn) => {
                const role = roles.find((r) => r.id === builtIn.id) ?? builtIn;
                const locked = LOCKED_IDS.includes(role.id);
                return (
                  <label key={builtIn.id} style={roleRow}>
                    <input
                      type="checkbox"
                      checked={role.enabled}
                      disabled={locked}
                      onChange={() => toggleBuiltIn(role.id)}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{roleLabel(role)}</strong>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {(role.areas ?? []).map((a) => t(`pos.appAdmin.area.${a}`)).join(' · ')}
                      </div>
                      {locked ? <div style={muted}>{t('pos.appAdmin.roleLocked')}</div> : null}
                      {DUPLICATE_IDS.includes(role.id) ? (
                        <div style={muted}>{t('pos.appAdmin.roleDuplicate')}</div>
                      ) : null}
                    </span>
                    <span style={{ fontSize: 12, color: role.enabled ? '#15803d' : '#666' }}>
                      {role.enabled ? t('pos.appAdmin.enabled') : t('pos.appAdmin.disabled')}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section style={section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={fieldLabel}>{t('pos.appAdmin.customTitle')}</span>
              <Button size="sm" onClick={startAdd}>
                {t('pos.appAdmin.addRole')}
              </Button>
            </div>

            {editing ? (
              <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 16 }}>
                <div style={field}>
                  <label style={fieldLabel}>{t('pos.appAdmin.roleName')}</label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <span style={fieldLabel}>{t('pos.appAdmin.areas')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                    {POS_LOCAL_AREAS.map((area) => (
                      <label key={area} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={editing.areas.includes(area)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...editing.areas, area]
                              : editing.areas.filter((a) => a !== area);
                            setEditing({ ...editing, areas: next });
                          }}
                        />
                        {t(`pos.appAdmin.area.${area}`)}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ ...actions, marginTop: 16 }}>
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={saveCustom}>{t('pos.appAdmin.saveRole')}</Button>
                </div>
              </div>
            ) : null}

            {custom.length === 0 ? (
              <div style={muted}>{t('pos.appAdmin.noRoles')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {custom.map((role) => (
                  <div key={role.id} style={roleRow}>
                    <span style={{ flex: 1 }}>
                      <strong>{role.name}</strong>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {(role.areas ?? []).map((a) => t(`pos.appAdmin.area.${a}`)).join(' · ')}
                      </div>
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeCustom(role.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const roleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 'var(--caspian-radius, 8px)',
};
