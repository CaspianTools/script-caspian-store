'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useCart } from '../context/cart-context';
import { useAuth } from '../context/auth-context';
import { listPaymentPluginInstalls } from '../services/payment-plugin-service';
import { getPaymentPlugin } from '../payments/catalog';
import type { PaymentPlugin, StartCheckoutOptions } from '../payments/types';
import type { PaymentPluginInstall } from '../types';

// Re-exported for backwards-compatible imports. New code should import from '../payments'.
export type { StartCheckoutOptions, CheckoutShippingInfoInput } from '../payments/types';

interface ActiveCheckout {
  install: PaymentPluginInstall;
  plugin: PaymentPlugin;
  config: Record<string, unknown>;
}

/**
 * Client hook to start a checkout session via the active payment plugin.
 *
 * Picks the first enabled install in `paymentPluginInstalls` (by `order`).
 * If none is installed-and-enabled, `startCheckout` throws and the returned
 * `activeInstall` / `activePlugin` are null so the UI can render guidance
 * toward `/admin/plugins/payments`.
 */
export function useCheckout() {
  const { db, functions, auth } = useCaspianFirebase();
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveCheckout | null>(null);

  useEffect(() => {
    let alive = true;
    listPaymentPluginInstalls(db, { onlyEnabled: true })
      .then((installs) => {
        if (!alive) return;
        if (installs.length === 0) {
          setActive(null);
          return;
        }
        if (installs.length > 1) {
          console.info(
            '[caspian-store] More than one payment plugin is enabled; using the first in order:',
            installs[0].name,
          );
        }
        const [install] = installs;
        const plugin = getPaymentPlugin(install.pluginId);
        if (!plugin) {
          console.error(
            '[caspian-store] Enabled payment plugin install refers to unknown pluginId:',
            install.pluginId,
          );
          setActive(null);
          return;
        }
        try {
          const config = plugin.validateConfig(install.config);
          setActive({ install, plugin, config: config as Record<string, unknown> });
        } catch (err) {
          console.error(
            `[caspian-store] Payment plugin "${plugin.id}" config is invalid:`,
            err,
          );
          setActive(null);
        }
      })
      .catch((err) => {
        console.error('[caspian-store] Failed to load payment plugin installs:', err);
        if (alive) setActive(null);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const startCheckout = useCallback(
    async (options: StartCheckoutOptions) => {
      // Read the user from Firebase directly (not the React-state `user` from
      // useAuth) so guest-checkout flows that promote anonymous → real account
      // mid-handler see the post-promotion user immediately — React state lags
      // by a tick because it's driven by the onAuthStateChanged listener.
      const currentUser = auth.currentUser ?? user;
      if (!currentUser) {
        const msg = 'You must be signed in to check out.';
        setError(msg);
        throw new Error(msg);
      }
      if (items.length === 0) {
        const msg = 'Your cart is empty.';
        setError(msg);
        throw new Error(msg);
      }
      if (!active) {
        const msg =
          'No payment provider is configured. Ask an admin to install a payment plugin.';
        setError(msg);
        throw new Error(msg);
      }

      setLoading(true);
      setError(null);

      try {
        const result = await active.plugin.startCheckout(
          {
            functions,
            auth,
            user: currentUser,
            items,
            config: active.config,
          },
          options,
        );

        clearCart();
        if (result.redirectUrl && typeof window !== 'undefined') {
          window.location.href = result.redirectUrl;
        }
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Checkout failed.';
        setError(msg);
        setLoading(false);
        throw e;
      }
    },
    [active, auth, functions, items, user, clearCart],
  );

  return {
    startCheckout,
    loading,
    error,
    activePlugin: active?.plugin ?? null,
    activeInstall: active?.install ?? null,
  };
}
