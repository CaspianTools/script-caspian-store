'use client';

import { useEffect } from 'react';
import { useTemplateRegistry } from '../provider/template-provider';
import { useScriptSettings } from './script-settings-context';

/**
 * Stable id for the `<style>` tag this component mounts in `<head>`.
 * Lets us update / remove the tag idempotently across re-renders and
 * across template switches without orphaning previous styles on the
 * page.
 */
const TEMPLATE_STYLE_ID = 'caspian-template-css';

/**
 * Applies the current theme tokens from script settings onto CSS custom
 * properties on the document root. Consumers can style their own components
 * against these variables too.
 *
 * v9.0.0-alpha.1 — also mounts the active template's optional `css` string
 * as a `<style id="caspian-template-css">` tag in `<head>`. The tag is
 * updated on template change and removed when no template is active (or
 * the template ships no `css` field). Templates use this for keyframes,
 * hover micro-interactions, or any rule that can't be expressed as a CSS
 * custom property. Convention is to prefix selectors with
 * `.caspian-tpl-<templateId>` for isolation; the active template's id is
 * also written to `<html data-caspian-template="<id>">` so selectors
 * can target it directly without a wrapper class.
 */
export function ThemeInjector() {
  const { settings } = useScriptSettings();
  const { activeTemplateId, css } = useTemplateRegistry();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const theme = settings.theme;
    root.style.setProperty('--caspian-primary', theme.primary);
    root.style.setProperty('--caspian-primary-foreground', theme.primaryForeground);
    root.style.setProperty('--caspian-accent', theme.accent);
    root.style.setProperty('--caspian-radius', theme.radius);
    if (theme.fontFamily) {
      root.style.setProperty('--caspian-font-family', theme.fontFamily);
    }
    if (theme.background) {
      root.style.setProperty('--caspian-background', theme.background);
    }
  }, [settings.theme]);

  // Mount / update / remove the template's CSS string.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Write the data attribute either way — empty string is fine and lets
    // template authors write `:root[data-caspian-template=""] { ... }` if
    // they ever need the default-template branch.
    if (activeTemplateId) {
      root.setAttribute('data-caspian-template', activeTemplateId);
    } else {
      root.removeAttribute('data-caspian-template');
    }

    let styleEl = document.getElementById(TEMPLATE_STYLE_ID) as HTMLStyleElement | null;

    if (!css) {
      // No CSS for the active template (or no template active) — remove
      // the tag entirely so the page is identical to a no-template install.
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = TEMPLATE_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== css) {
      styleEl.textContent = css;
    }

    // Cleanup on unmount: remove the tag so leaving a Caspian-rooted
    // page (e.g. consumer-side route swap to a non-storefront subtree)
    // doesn't leak template styles into unrelated pages.
    return () => {
      const el = document.getElementById(TEMPLATE_STYLE_ID);
      if (el) el.remove();
      root.removeAttribute('data-caspian-template');
    };
  }, [activeTemplateId, css]);

  return null;
}
