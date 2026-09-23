'use client';

import { useEffect } from 'react';
import { useScriptSettings } from './script-settings-context';

/**
 * Lightweight Google Fonts loader + CSS-variable writer.
 *
 * When `scriptSettings.fonts.googleFamilies` lists families (e.g.
 * `["Montserrat:wght@400;500;600;700", "Lato:wght@400;700"]`), we inject a
 * single `<link>` tag into `document.head` matching `fonts.googleapis.com/css2?…`.
 *
 * Regardless of Google Fonts, we write `--caspian-font-body` and
 * `--caspian-font-headline` CSS custom properties from the `fonts.body` /
 * `fonts.headline` stacks, so consumer Tailwind themes (or any CSS) can
 * reference them.
 */
export function FontLoader() {
  const { settings } = useScriptSettings();
  const fonts = settings.fonts;

  useEffect(() => {
    if (typeof document === 'undefined' || !fonts) return;

    const root = document.documentElement;
    if (fonts.body) root.style.setProperty('--caspian-font-body', fonts.body);
    if (fonts.headline) root.style.setProperty('--caspian-font-headline', fonts.headline);

    const LINK_ID = 'caspian-google-fonts';
    const families = fonts.googleFamilies ?? [];
    if (families.length === 0) {
      // Otherwise the previous theme's stylesheet keeps loading its families.
      document.getElementById(LINK_ID)?.remove();
      return;
    }

    const href = `https://fonts.googleapis.com/css2?${families
      .map((f) => `family=${encodeURIComponent(f)}`)
      .join('&')}&display=swap`;

    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (link && link.href === href) return;
    if (!link) {
      link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = href;

    // Preconnect hints (idempotent).
    const ensurePreconnect = (id: string, connectHref: string, crossOrigin = false) => {
      if (document.getElementById(id)) return;
      const el = document.createElement('link');
      el.id = id;
      el.rel = 'preconnect';
      el.href = connectHref;
      if (crossOrigin) el.crossOrigin = 'anonymous';
      document.head.appendChild(el);
    };
    ensurePreconnect('caspian-google-fonts-pc-1', 'https://fonts.googleapis.com');
    ensurePreconnect('caspian-google-fonts-pc-2', 'https://fonts.gstatic.com', true);
  }, [fonts]);

  return null;
}
