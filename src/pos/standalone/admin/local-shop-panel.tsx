'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { readLocalShopSettings, writeLocalShopSettings } from '../local-db';
import { DEFAULT_LOCAL_SHOP_SETTINGS, type LocalShopSettings } from '../types';
import { actions, field, fieldLabel, muted, row, section } from './panel-styles';

/**
 * The shop record on a standalone till: what prints on a receipt, and in what
 * currency. The local twin of `SiteSettings.pos` on a cloud store.
 */
export function LocalShopPanel() {
  const t = useT();
  const { toast } = useToast();
  const [draft, setDraft] = useState<LocalShopSettings>(DEFAULT_LOCAL_SHOP_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void readLocalShopSettings().then((s) => {
      if (!alive) return;
      setDraft(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    const saved = await writeLocalShopSettings({
      ...draft,
      commissionedAtMillis: draft.commissionedAtMillis || Date.now(),
    });
    setDraft(saved);
    toast({ title: t('pos.admin.shop.saved') });
  };

  if (!loaded) return <div style={muted}>{t('common.loading')}</div>;

  return (
    <div>
      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.shop.detailsTitle')}</span>
        <div style={row}>
          <div style={{ ...field, flex: '2 1 220px' }}>
            <label style={fieldLabel}>{t('pos.admin.shop.name')}</label>
            <Input
              value={draft.shopName}
              onChange={(e) => setDraft({ ...draft, shopName: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.shop.currency')}</label>
            <Input
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
            />
            <FieldDescription>{t('pos.admin.shop.currencyHelp')}</FieldDescription>
          </div>
        </div>
      </section>

      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.shop.receiptTitle')}</span>
        <div style={field}>
          <label style={fieldLabel}>{t('pos.admin.shop.receiptHeader')}</label>
          <textarea
            rows={3}
            value={draft.receiptHeader}
            onChange={(e) => setDraft({ ...draft, receiptHeader: e.target.value })}
            style={textarea}
          />
          <FieldDescription>{t('pos.admin.shop.receiptHeaderHelp')}</FieldDescription>
        </div>
        <div style={field}>
          <label style={fieldLabel}>{t('pos.admin.shop.receiptFooter')}</label>
          <textarea
            rows={2}
            value={draft.receiptFooter}
            onChange={(e) => setDraft({ ...draft, receiptFooter: e.target.value })}
            style={textarea}
          />
        </div>
        <div style={row}>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.shop.receiptPrefix')}</label>
            <Input
              value={draft.receiptPrefix}
              onChange={(e) => setDraft({ ...draft, receiptPrefix: e.target.value })}
            />
            <FieldDescription>{t('pos.admin.shop.receiptPrefixHelp')}</FieldDescription>
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.shop.roundCashTo')}</label>
            <Input
              value={String(draft.roundCashTo)}
              inputMode="decimal"
              onChange={(e) => setDraft({ ...draft, roundCashTo: Number(e.target.value) || 0 })}
            />
            <FieldDescription>{t('pos.admin.shop.roundCashToHelp')}</FieldDescription>
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={draft.showTaxOnReceipt}
            onChange={(e) => setDraft({ ...draft, showTaxOnReceipt: e.target.checked })}
          />
          {t('pos.admin.shop.showTax')}
        </label>
      </section>

      <div style={actions}>
        <Button onClick={() => void save()}>{t('common.save')}</Button>
      </div>
    </div>
  );
}

const textarea: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 'var(--caspian-radius, 8px)',
  border: '1px solid var(--cpos-border-strong, rgba(0,0,0,0.15))',
  font: 'inherit',
  resize: 'vertical',
};
