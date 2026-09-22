'use client';

import { useState, type FormEvent } from 'react';
import type { UserAddress } from '../../types';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from '../../services/user-service';
import { Button } from '../../ui/button';
import { Input, Label } from '../../ui/input';
import { Badge } from '../../ui/misc';
import { Dialog } from '../../ui/dialog';
import { SearchableSelect, type SearchableSelectOption } from '../../ui/searchable-select';
import { useToast } from '../../ui/toast';
import { useT } from '../../i18n/locale-context';
import { ALL_COUNTRIES, countryName, findCountryCode } from '../../utils/countries';

const COUNTRY_OPTIONS: SearchableSelectOption[] = ALL_COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
  hint: c.code,
}));

const emptyAddress: Omit<UserAddress, 'id'> = {
  name: '',
  address: '',
  city: '',
  zip: '',
  country: '',
  isDefault: false,
};

export function AddressBook({ className }: { className?: string }) {
  const { user, userProfile, refreshProfile } = useAuth();
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserAddress | null>(null);
  const [form, setForm] = useState<Omit<UserAddress, 'id'>>(emptyAddress);
  const [saving, setSaving] = useState(false);

  if (!user || !userProfile) return null;

  const addresses = userProfile.addresses ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyAddress);
    setDialogOpen(true);
  };

  const openEdit = (addr: UserAddress) => {
    setEditing(addr);
    setForm({
      name: addr.name,
      address: addr.address,
      city: addr.city,
      zip: addr.zip,
      country: findCountryCode(addr.country) ?? '',
      isDefault: addr.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateAddress(db, user.uid, { ...editing, ...form });
        toast({ title: t('addresses.updated'), variant: 'success' });
      } else {
        await addAddress(db, user.uid, form);
        toast({ title: t('addresses.added'), variant: 'success' });
      }
      await refreshProfile();
      setDialogOpen(false);
    } catch (error) {
      console.error('[caspian-store] Save address failed:', error);
      toast({ title: t('addresses.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addr: UserAddress) => {
    if (!confirm(t('addresses.deleteConfirm', { name: addr.name }))) return;
    try {
      await deleteAddress(db, user.uid, addr.id);
      await refreshProfile();
      toast({ title: t('addresses.deleted'), variant: 'success' });
    } catch (error) {
      console.error('[caspian-store] Delete address failed:', error);
      toast({ title: t('addresses.saveFailed'), variant: 'destructive' });
    }
  };

  const handleSetDefault = async (addr: UserAddress) => {
    try {
      await setDefaultAddress(db, user.uid, addr.id);
      await refreshProfile();
      toast({ title: t('addresses.updated'), variant: 'success' });
    } catch (error) {
      console.error('[caspian-store] Set default failed:', error);
      toast({ title: t('addresses.saveFailed'), variant: 'destructive' });
    }
  };

  return (
    <section
      className={className}
      style={{ padding: 20, border: '1px solid #eee', borderRadius: 'var(--caspian-radius, 8px)' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('addresses.title')}</h2>
        <Button variant="outline" size="sm" onClick={openCreate}>
          {t('addresses.add')}
        </Button>
      </header>

      {addresses.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14, padding: '16px 0', margin: 0 }}>
          {t('addresses.empty')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {addresses.map((addr) => (
            <li
              key={addr.id}
              className="caspian-stack-mobile"
              style={{
                padding: 12,
                border: '1px solid #eee',
                borderRadius: 'var(--caspian-radius, 6px)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>{addr.name}</p>
                  {addr.isDefault && <Badge variant="secondary">{t('addresses.default')}</Badge>}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555', lineHeight: 1.4 }}>
                  {addr.address}
                  <br />
                  {addr.city} {addr.zip}
                  <br />
                  {countryName(addr.country)}
                </p>
              </div>
              <div
                className="caspian-stack-mobile"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}
              >
                {!addr.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(addr)}>
                    {t('addresses.setDefault')}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openEdit(addr)}>
                  {t('common.edit')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(addr)}>
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('addresses.editTitle') : t('addresses.addTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="caspian-address-form" loading={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id="caspian-address-form"
          onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div>
            <Label>{t('addresses.fullName')}</Label>
            <Input
              autoComplete="name"
              enterKeyHint="next"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>{t('addresses.address')}</Label>
            <Input
              autoComplete="street-address"
              enterKeyHint="next"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <Label>{t('addresses.city')}</Label>
              <Input
                autoComplete="address-level2"
                enterKeyHint="next"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>{t('addresses.zip')}</Label>
              <Input
                autoComplete="postal-code"
                enterKeyHint="done"
                value={form.zip}
                onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <Label>{t('addresses.country')}</Label>
            <SearchableSelect
              value={form.country}
              onChange={(v) => setForm((f) => ({ ...f, country: v }))}
              options={COUNTRY_OPTIONS}
              placeholder={t('addresses.countrySelect')}
            />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            {t('addresses.makeDefault')}
          </label>
        </form>
      </Dialog>
    </section>
  );
}
