/**
 * Per-template component overrides — foundation for v9.0.0 (alpha.1).
 *
 * Templates can register replacements for well-known storefront slots
 * (Hero, HomePage, ProductCard, ProductDetailPage, LayoutShell) under
 * `TemplateDefinition.components`. The storefront entry points resolve
 * the active template's override via `useTemplateComponent()` at render
 * time and fall back to the default implementation when no override is
 * registered. This is what makes "templates ship their own React
 * components" possible, distinct from theme tokens and content seeding.
 *
 * Phase 1 (alpha.1) ships the infrastructure only — no slots are wired
 * yet. Each subsequent phase wraps one slot and adds variants:
 *   - alpha.2: Hero
 *   - alpha.3: HomePage, ProductCard
 *   - alpha.4: ProductDetailPage
 *
 * The TemplateComponents type intentionally keeps the value as
 * `ComponentType<unknown>` to avoid a circular-import hellscape
 * (template definitions live in `src/templates`, component prop types
 * live in `src/components` and `src/admin`; importing both directions
 * would form a loop). The `useTemplateComponent<TProps>(slot, fallback)`
 * hook narrows the return type from the fallback's signature, so each
 * call site is correctly typed against its fallback. Template authors
 * are responsible for ensuring their override's prop signature matches
 * the slot's documented contract.
 */

import type { ComponentType } from 'react';

/**
 * Stable identifiers for the slots templates can override. Adding a new
 * slot is a *breaking change for templates that omit it from `components`
 * — they fall back to the default, which is exactly the desired
 * behaviour, so adding new slots between phases is non-breaking. Be
 * careful when *renaming* a slot — existing templates referencing the
 * old name silently lose their override.
 */
export type TemplateComponentSlotId =
  | 'Hero'
  | 'HomePage'
  | 'ProductCard'
  | 'ProductDetailPage'
  | 'LayoutShell';

/**
 * The map a template registers under `TemplateDefinition.components`.
 * All slots are optional; missing slots fall through to the default
 * implementation at runtime.
 *
 * The value is typed as `ComponentType<unknown>` deliberately — see the
 * file-level doc for the rationale and how the hook narrows it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional: see file-level doc
export type TemplateComponents = Partial<Record<TemplateComponentSlotId, ComponentType<any>>>;

/**
 * Shape of the value carried by `<TemplateProvider>`. Storefront
 * primitives use `useTemplateComponent()` to read it; consumers
 * generally don't touch this directly.
 */
export interface TemplateRegistryValue {
  /** `scriptSettings.activeTemplateId` — empty string when no template is active. */
  activeTemplateId: string;
  /** The active template's component overrides (or empty if no template). */
  components: TemplateComponents;
  /**
   * The active template's extra CSS string (mounted as a `<style>` tag
   * by `<ThemeInjector>`). Templates use this for keyframes, hover
   * micro-interactions, or any rule that can't be expressed as a CSS
   * custom property. Empty string when no template is active.
   */
  css: string;
}

/**
 * Default registry value — used when no template is active. The
 * default-export pattern makes the provider's initial state a stable
 * reference, avoiding "ctx is undefined" branches inside the hook.
 */
export const EMPTY_TEMPLATE_REGISTRY: TemplateRegistryValue = {
  activeTemplateId: '',
  components: {},
  css: '',
};
