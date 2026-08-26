'use client';

import { useEffect, useState } from 'react';
import { useT, useToast } from '@caspian-explorer/script-caspian-store';
import { PosCheck, PosField } from '../ui/pos-field';
import { readLocalShopSettings, writeLocalShopSettings } from '../local-db';
import { DEFAULT_LOCAL_SHOP_SETTINGS, type LocalShopSettings } from '../types';

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

  if (!loaded) return <div className="cpos-muted">{t('common.loading')}</div>;

  return (
    <div>
      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.admin.shop.detailsTitle')}</h2>
        <div className="cpos-row">
          <PosField label={t('pos.admin.shop.name')} style={{ flex: '2 1 220px' }}>
            <input
              className="cpos-input"
              value={draft.shopName}
              onChange={(e) => setDraft({ ...draft, shopName: e.target.value })}
            />
          </PosField>
          <PosField
            label={t('pos.admin.shop.currency')}
            help={t('pos.admin.shop.currencyHelp')}
            style={{ flex: '1 1 120px' }}
          >
            <input
              className="cpos-input"
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
            />
          </PosField>
        </div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.admin.shop.receiptTitle')}</h2>
        <PosField
          label={t('pos.admin.shop.receiptHeader')}
          help={t('pos.admin.shop.receiptHeaderHelp')}
        >
          <textarea
            className="cpos-textarea"
            rows={3}
            value={draft.receiptHeader}
            onChange={(e) => setDraft({ ...draft, receiptHeader: e.target.value })}
          />
        </PosField>
        <PosField label={t('pos.admin.shop.receiptFooter')}>
          <textarea
            className="cpos-textarea"
            rows={2}
            value={draft.receiptFooter}
            onChange={(e) => setDraft({ ...draft, receiptFooter: e.target.value })}
          />
        </PosField>
        <div className="cpos-row">
          <PosField
            label={t('pos.admin.shop.receiptPrefix')}
            help={t('pos.admin.shop.receiptPrefixHelp')}
            style={{ flex: '1 1 120px' }}
          >
            <input
              className="cpos-input"
              value={draft.receiptPrefix}
              onChange={(e) => setDraft({ ...draft, receiptPrefix: e.target.value })}
            />
          </PosField>
          <PosField
            label={t('pos.admin.shop.roundCashTo')}
            help={t('pos.admin.shop.roundCashToHelp')}
            style={{ flex: '1 1 120px' }}
          >
            <input
              className="cpos-input"
              value={String(draft.roundCashTo)}
              inputMode="decimal"
              onChange={(e) => setDraft({ ...draft, roundCashTo: Number(e.target.value) || 0 })}
            />
          </PosField>
        </div>
        <PosCheck
          checked={draft.showTaxOnReceipt}
          onChange={(next) => setDraft({ ...draft, showTaxOnReceipt: next })}
          label={t('pos.admin.shop.showTax')}
        />
      </section>

      <div className="cpos-actions">
        <button type="button" className="cpos-btn cpos-btn--primary" onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
