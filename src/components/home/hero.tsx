'use client';

import { useTemplateComponent } from '../../provider/template-provider';
import type { HeroTokens } from '../../types';
import { HeroCentered } from './variants/hero-centered';

export interface HeroProps {
  /** Overrides script settings if provided. Otherwise pulls from `scriptSettings.hero`. */
  hero?: Partial<HeroTokens>;
  /** Full-bleed hero height. Default: 60vh desktop / 50vh mobile. */
  minHeightClass?: string;
  className?: string;
}

/**
 * Homepage hero — dispatched through `useTemplateComponent('Hero', …)`
 * so the active storefront template can register its own variant.
 *
 *   - **Default** / `fashion-minimal` → [`HeroCentered`](./variants/hero-centered.tsx)
 *   - `electronics-tech` → [`HeroFullBleed`](./variants/hero-full-bleed.tsx)
 *   - `home-goods` → [`HeroSplit`](./variants/hero-split.tsx)
 *
 * v9.0.0-alpha.2 — Phase 2 of the theme rearchitecture. The wrapper is
 * intentionally tiny: it picks the variant and forwards props. Consumers
 * who want a different layout still have three escape hatches:
 *   1. Apply a template that registers their preferred variant.
 *   2. Register a custom variant on a fork-of-template via `components.Hero`.
 *   3. Build their own hero component using `useScriptSettings()` and
 *      mount it directly in their app instead of `<Hero>`.
 *
 * Pre-v9 consumers calling `<Hero>` see no behaviour change when no
 * template is active — the dispatcher falls back to `HeroCentered`,
 * which is the v8.x implementation moved one file over.
 */
export function Hero(props: HeroProps) {
  const Component = useTemplateComponent('Hero', HeroCentered);
  return <Component {...props} />;
}
