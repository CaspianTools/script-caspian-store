'use client';

import { useEffect, useState } from 'react';
import type { ShippingOptions } from '../types';
import { getSiteSettings, updateSiteSettings } from '../services/site-settings-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { FieldDescription } from '../ui/field-description';
import { FieldHelp } from '../ui/field-help';
import { useToast } from '../ui/toast';

const DEFAULT_SHIPPING_OPTIONS: ShippingOptions = {
  hideRatesUntilAddressEntered: false,
  hideRatesWhenFreeAvailable: false,
};

export interface AdminShippingOptionsPageProps {
  className?: string;
}

/**
 * Site-wide shipping behavior toggles that used to live at the top of
 * AdminShippingPluginsPage. Moved to Settings in v7.1.0 because they
 * configure checkout presentation, not the plugins themselves — merchants
 * looking to adjust these were hunting in the wrong sidebar section.
 */
export function AdminShippingOptionsPage({ className }: AdminShippingOptionsPageProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const [options, setOptions] = useState<ShippingOptions>(DEFAULT_SHIPPING_OPTIONS);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setLoadError(false);
    getSiteSettings(db)
      .then((s) => {
        if (!alive) return;
        // A fresh store has no `settings/site` yet; the defaults are a valid
        // draft and Save is a merge write, so nothing else is needed.
        setOptions(s?.shippingOptions ?? DEFAULT_SHIPPING_OPTIONS);
        setDirty(false);
        setLoaded(true);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load shipping options:', error);
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const update = (patch: Partial<ShippingOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!loaded) return;
    setSaving(true);
    try {
      await updateSiteSettings(db, { shippingOptions: options });
      setDirty(false);
      toast({ title: 'Shipping options saved' });
    } catch (error) {
      console.error('[caspian-store] Failed to save shipping options:', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Shipping options
          <FieldHelp>
            Controls when shipping rates appear at checkout. These toggles apply to every
            shipping install — they don&apos;t replace per-install eligibility.
          </FieldHelp>
        </h1>
        <p style={{ color: '#666', marginTop: 6, fontSize: 14 }}>
          Site-wide checkout behavior for shipping rate calculation.
        </p>
      </header>

      {loadError && (
        <p
          role="alert"
          style={{
            margin: '0 0 16px',
            padding: 12,
            borderRadius: 'var(--caspian-radius, 8px)',
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: 14,
          }}
        >
          Could not load the current shipping options. Reload the page to try again.
        </p>
      )}

      <section
        style={{
          border: '1px solid #eee',
          borderRadius: 'var(--caspian-radius, 8px)',
          padding: 16,
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              style={{ marginTop: 3 }}
              checked={options.hideRatesUntilAddressEntered}
              onChange={(e) =>
                update({ hideRatesUntilAddressEntered: e.target.checked })
              }
            />
            <span>
              Hide rates until the shopper has entered a country and postcode
              <FieldDescription style={{ marginTop: 2 }}>
                Useful when rates vary by region and a pre-address estimate would mislead the
                shopper.
              </FieldDescription>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              style={{ marginTop: 3 }}
              checked={options.hideRatesWhenFreeAvailable}
              onChange={(e) =>
                update({ hideRatesWhenFreeAvailable: e.target.checked })
              }
            />
            <span>
              Hide paid options when free shipping is available
              <FieldDescription style={{ marginTop: 2 }}>
                When any rate resolves to 0, every paid option is suppressed so the shopper
                auto-lands on the free rate.
              </FieldDescription>
            </span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || !loaded}
              loading={saving}
            >
              Save shipping options
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
