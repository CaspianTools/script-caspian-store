'use client';

/**
 * `<TemplateProvider>` and `useTemplateComponent()` — runtime side of
 * the per-template component override system introduced in v9.0.0-alpha.1.
 *
 * Flow:
 *   1. Admin applies a template via `applyTemplate()` or the setup
 *      wizard — `scriptSettings.activeTemplateId` is written to Firestore.
 *   2. `<ScriptSettingsProvider>` subscribes to that doc.
 *   3. `<TemplateProvider>` (nested inside) reads `activeTemplateId`,
 *      looks the template up in `TEMPLATE_CATALOG`, and exposes its
 *      `components` map + `css` via React context.
 *   4. Storefront primitives (`<Hero>`, `<ProductCard>`, ...) call
 *      `useTemplateComponent(slotId, FallbackComponent)` and render
 *      whichever component the active template registered for that slot,
 *      or the fallback when nothing is registered.
 *
 * Phase 1 (alpha.1) ships the provider + hook but no template actually
 * registers any slot yet, and no primitive is wrapped — runtime
 * behaviour is unchanged. Phase 2 wraps `<Hero>` and adds three hero
 * variants; subsequent phases wrap the remaining primitives.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useScriptSettings } from '../context/script-settings-context';
import { getTemplate } from '../templates/catalog';
import {
  EMPTY_TEMPLATE_REGISTRY,
  type TemplateComponentSlotId,
  type TemplateRegistryValue,
} from '../templates/components';

const TemplateContext = createContext<TemplateRegistryValue>(EMPTY_TEMPLATE_REGISTRY);

export interface TemplateProviderProps {
  children: ReactNode;
}

export function TemplateProvider({ children }: TemplateProviderProps) {
  const { settings } = useScriptSettings();
  const activeTemplateId = settings.activeTemplateId ?? '';

  const value = useMemo<TemplateRegistryValue>(() => {
    if (!activeTemplateId) return EMPTY_TEMPLATE_REGISTRY;
    const tpl = getTemplate(activeTemplateId);
    if (!tpl) {
      // Unknown id (e.g. consumer pinned to an old version that no longer
      // ships this template). Fail open to the default storefront rather
      // than breaking the whole storefront with a missing-id error.
      return EMPTY_TEMPLATE_REGISTRY;
    }
    return {
      activeTemplateId,
      components: tpl.components ?? {},
      css: tpl.css ?? '',
    };
  }, [activeTemplateId]);

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
}

/**
 * Low-level accessor for the active template's registry — `{ activeTemplateId,
 * components, css }`. Most callers want `useTemplateComponent()` instead;
 * this hook is exposed for surfaces that need the metadata (e.g. an admin
 * badge showing the active template name).
 */
export function useTemplateRegistry(): TemplateRegistryValue {
  return useContext(TemplateContext);
}

/**
 * Resolve the component for a slot — the active template's override if
 * registered, otherwise the supplied `fallback`. Use inside any
 * storefront primitive that should be overrideable per template.
 *
 * Typed generically on the fallback's prop signature so the caller gets
 * correct typing at the call site:
 *
 * ```tsx
 * export function Hero(props: HeroProps) {
 *   const Component = useTemplateComponent('Hero', DefaultHero);
 *   return <Component {...props} />;
 * }
 * ```
 *
 * The cast is unchecked at the registry level — template authors are
 * responsible for ensuring their override's prop signature is compatible
 * with the slot's fallback. See [components.ts](../templates/components.ts).
 */
export function useTemplateComponent<TProps>(
  slotId: TemplateComponentSlotId,
  fallback: ComponentType<TProps>,
): ComponentType<TProps> {
  const { components } = useTemplateRegistry();
  const override = components[slotId];
  return (override as ComponentType<TProps> | undefined) ?? fallback;
}
