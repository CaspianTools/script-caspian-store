import type { CSSProperties } from 'react';
import type { BlockStyle, BoxSpacing, Breakpoint, PageBlock } from '../types';

const px = (n: number | undefined): string | undefined =>
  n == null || Number.isNaN(n) ? undefined : `${n}px`;

/** Named box-shadow presets (v9.5). A `shadow` value that isn't a key is treated as custom CSS. */
export const SHADOW_PRESETS: Record<string, string> = {
  sm: '0 1px 2px rgba(0,0,0,0.08)',
  md: '0 4px 12px rgba(0,0,0,0.12)',
  lg: '0 10px 30px rgba(0,0,0,0.16)',
  xl: '0 24px 60px rgba(0,0,0,0.22)',
};

/** Reject CSS values that could smuggle an external fetch / import out of admin input. */
const UNSAFE_CSS = /url\(|image-set|expression|@import|javascript:/i;

/** Resolve a `shadow` value: a preset token → its CSS, else a sanitized custom box-shadow. */
function resolveShadow(shadow: string | undefined): string | undefined {
  if (!shadow) return undefined;
  if (SHADOW_PRESETS[shadow]) return SHADOW_PRESETS[shadow];
  if (UNSAFE_CSS.test(shadow)) return undefined;
  return shadow.replace(/[{}<>;]/g, '').trim() || undefined;
}

/** Sanitize a free-text CSS gradient (must be a `*-gradient(...)`, never a url()/import). */
function resolveGradient(gradient: string | undefined): string | undefined {
  if (!gradient) return undefined;
  if (UNSAFE_CSS.test(gradient)) return undefined;
  if (!/gradient\(/i.test(gradient)) return undefined;
  return gradient.replace(/[{}<>;]/g, '').trim() || undefined;
}

/** A single radius value or four per-corner values → a CSS border-radius string. */
function resolveRadius(radius: BlockStyle['radius']): string | undefined {
  if (radius == null) return undefined;
  if (typeof radius === 'number') return Number.isNaN(radius) ? undefined : `${radius}px`;
  const corners = [radius.topLeft, radius.topRight, radius.bottomRight, radius.bottomLeft];
  if (corners.every((c) => c == null)) return undefined;
  return corners.map((c) => `${c ?? 0}px`).join(' ');
}

/** A length in the box's chosen unit (absent unit ⇒ px, so old saves are unchanged). */
const len = (n: number | undefined, unit: BoxSpacing['unit']): string | undefined =>
  n == null || Number.isNaN(n) ? undefined : `${n}${unit ?? 'px'}`;

function spacing(s: BoxSpacing | undefined, prop: 'padding' | 'margin'): CSSProperties {
  if (!s) return {};
  const cap = prop === 'padding' ? 'padding' : 'margin';
  return {
    [`${cap}Top`]: len(s.top, s.unit),
    [`${cap}Right`]: len(s.right, s.unit),
    [`${cap}Bottom`]: len(s.bottom, s.unit),
    [`${cap}Left`]: len(s.left, s.unit),
  } as CSSProperties;
}

/** True when a block carries any per-instance visual override worth wrapping for. */
export function hasStyle(style: BlockStyle | undefined): boolean {
  if (!style) return false;
  const bg = style.background;
  const box = (s?: BoxSpacing) => s && (s.top != null || s.right != null || s.bottom != null || s.left != null);
  return Boolean(
    bg?.color ||
      bg?.imageUrl ||
      bg?.gradient ||
      box(style.padding) ||
      box(style.margin) ||
      style.align ||
      style.width ||
      style.textColor ||
      style.typography ||
      style.border ||
      style.radius != null ||
      style.shadow,
  );
}

/**
 * Resolves a {@link BlockStyle} to inline CSS applied to the block's wrapper.
 * `undefined` values are dropped by React, so an empty style yields `{}` and
 * the block renders exactly as its component's own CSS dictates.
 */
export function blockStyleToCss(style: BlockStyle | undefined): CSSProperties {
  if (!style) return {};
  const bg = style.background;
  // An overlay is a translucent color laid over the image (darken/tint), done
  // with a two-stop gradient stacked above the image layer. Strip quotes /
  // backslashes from the URL so an admin-pasted value can't break out of the
  // `url("…")` token in the generated `@media` stylesheet.
  const safeUrl = bg?.imageUrl ? bg.imageUrl.replace(/["\\]/g, '') : '';
  const overlayLayer = resolveGradient(bg?.overlayGradient) ?? (bg?.overlay ? `linear-gradient(${bg.overlay}, ${bg.overlay})` : undefined);
  const gradientBg = resolveGradient(bg?.gradient);
  // Compose the background as an ordered layer list (top layer first): an
  // optional overlay, then the image; or — with no image — a standalone gradient.
  const bgImage = safeUrl
    ? [overlayLayer, `url("${safeUrl}")`].filter(Boolean).join(', ')
    : gradientBg;
  const border = style.border;
  const typo = style.typography;
  return {
    backgroundColor: bg?.color || undefined,
    backgroundImage: bgImage || undefined,
    backgroundSize: bg?.imageUrl ? bg.size || 'cover' : undefined,
    backgroundPosition: bg?.imageUrl ? bg.position || 'center' : undefined,
    backgroundRepeat: bg?.imageUrl ? (bg.repeat ? 'repeat' : 'no-repeat') : undefined,
    ...spacing(style.padding, 'padding'),
    ...spacing(style.margin, 'margin'),
    textAlign: style.align,
    color: style.textColor || undefined,
    maxWidth: style.width || undefined,
    marginLeft: style.width ? 'auto' : undefined,
    marginRight: style.width ? 'auto' : undefined,
    fontSize: typo?.fontSize || undefined,
    fontWeight: typo?.fontWeight || undefined,
    lineHeight: typo?.lineHeight || undefined,
    letterSpacing: typo?.letterSpacing || undefined,
    textTransform: typo?.textTransform || undefined,
    borderWidth: border?.width != null ? px(border.width) : undefined,
    borderStyle: border?.width != null ? border.style || 'solid' : undefined,
    borderColor: border?.width != null ? border.color || undefined : undefined,
    borderRadius: resolveRadius(style.radius),
    boxShadow: resolveShadow(style.shadow),
  };
}

/** Shallow + nested merge of a breakpoint override over a base style. */
export function mergeStyles(base: BlockStyle | undefined, over: BlockStyle | undefined): BlockStyle {
  if (!over) return base ?? {};
  if (!base) return over;
  return {
    ...base,
    ...over,
    background:
      base.background || over.background ? { ...base.background, ...over.background } : undefined,
    padding: base.padding || over.padding ? { ...base.padding, ...over.padding } : undefined,
    margin: base.margin || over.margin ? { ...base.margin, ...over.margin } : undefined,
    typography:
      base.typography || over.typography ? { ...base.typography, ...over.typography } : undefined,
    border: base.border || over.border ? { ...base.border, ...over.border } : undefined,
    // radius (number | object) and shadow (string) are replaced wholesale by the
    // top-level `...over` spread — an override sets its own value.
  };
}

/**
 * The style that should render for a block at a given breakpoint: the base
 * `style` for desktop, else the base merged with that breakpoint's override.
 * Used inline by the editor to preview the active device.
 */
export function effectiveStyle(block: PageBlock, breakpoint: Breakpoint): BlockStyle | undefined {
  if (breakpoint === 'desktop') return block.style;
  return mergeStyles(block.style, block.responsive?.[breakpoint]?.style);
}

const BP_MEDIA: Record<'tablet' | 'mobile', string> = {
  tablet: '(max-width: 1024px)',
  mobile: '(max-width: 767px)',
};

/** Strip characters that could break out of a CSS declaration (admin input). */
const cssValue = (v: string): string => v.replace(/[{}<>;]/g, '').trim();

function cssPropsToString(props: CSSProperties): string {
  const out: string[] = [];
  for (const [k, val] of Object.entries(props)) {
    if (val == null || val === '') continue;
    const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    out.push(`${kebab}: ${cssValue(String(val))}`);
  }
  return out.join('; ');
}

/**
 * Builds the `@media` stylesheet for a block tree's tablet/mobile overrides,
 * targeting each block by its `data-pb-id`. Inline styles can't express media
 * queries, so the renderer emits this once and the runtime applies it. Mobile
 * rules come after tablet so they win on the narrowest screens.
 */
export function collectResponsiveCss(blocks: PageBlock[]): string {
  const byBp: Record<'tablet' | 'mobile', string[]> = { tablet: [], mobile: [] };
  const walk = (list: PageBlock[]) => {
    for (const b of list) {
      const r = b.responsive;
      if (r) {
        (['tablet', 'mobile'] as const).forEach((bp) => {
          const entry = r[bp];
          if (!entry) return;
          const decls: string[] = [];
          if (entry.style) {
            const s = cssPropsToString(blockStyleToCss(entry.style));
            if (s) decls.push(s);
          }
          if (entry.hidden) decls.push('display: none');
          if (decls.length) byBp[bp].push(`[data-pb-id="${b.id}"]{${decls.join('; ')}}`);
        });
      }
      if (b.children) walk(b.children);
    }
  };
  walk(blocks);
  let css = '';
  if (byBp.tablet.length) css += `@media ${BP_MEDIA.tablet}{${byBp.tablet.join('')}}`;
  if (byBp.mobile.length) css += `@media ${BP_MEDIA.mobile}{${byBp.mobile.join('')}}`;
  return css;
}
