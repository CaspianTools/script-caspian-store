/**
 * The register's design system, as one stylesheet.
 *
 * Why a string and not a `.css` file: the library ships `src/styles/globals.css`
 * as a passthrough file the consumer imports once at their app root. A consumer
 * who never added that import still gets a working storefront today, because
 * every component is inline-styled. Moving the register's chrome onto classes
 * would have made that import load-bearing for the till — a shop that upgraded
 * would open the register to unstyled HTML. Releases must never require a
 * consumer hand-edit, so the register carries its own stylesheet and `<PosStyles>`
 * renders it into the tree. Same trick `pos-receipt.tsx` already uses for the
 * thermal-printer CSS.
 *
 * Rendering it as JSX rather than appending to `<head>` in an effect means it is
 * present on the very first paint, and it survives server rendering.
 *
 * Tokens are declared on `:root` under the `--cpos-` prefix. That prefix is used
 * by nothing outside `src/pos/`, so putting them at the document root cannot
 * disturb the storefront or the admin panel — and it is the only way portalled
 * surfaces (`DropdownMenu`, `Dialog`, `Toast` all render into `document.body`)
 * read the same palette as the shell they were opened from.
 *
 * The brand hues are *derived*, never restated: `--cpos-brand` is whatever
 * `--caspian-primary` resolves to, so theming the store red themes the till red.
 * The old chrome hardcoded `rgba(26,115,232,0.25)` glows — the RGB of the default
 * blue — in four places, which stayed blue on every other theme.
 */
export const POS_STYLESHEET = String.raw`
/* ============================================================ tokens */
:root {
  --cpos-brand: var(--caspian-primary, #4f46e5);
  --cpos-brand-fg: var(--caspian-primary-foreground, #ffffff);
  --cpos-accent: var(--caspian-accent, var(--cpos-brand));

  /* Tint + glow are colour-mixed off the brand below; these are the fallbacks
     a browser without color-mix() keeps. They match the default indigo. */
  --cpos-brand-soft: #eef2ff;
  --cpos-brand-soft-fg: #3730a3;
  --cpos-brand-line: #c7d2fe;
  --cpos-brand-glow: rgba(79, 70, 229, 0.28);
  --cpos-brand-hover: #4338ca;

  --cpos-bg: #f6f7f9;
  --cpos-surface: #ffffff;
  --cpos-surface-2: #f8fafc;
  --cpos-surface-3: #f1f5f9;
  --cpos-sidebar-bg: #0f1729;
  --cpos-sidebar-fg: #cbd5e1;
  --cpos-sidebar-fg-dim: #7c8ba1;
  --cpos-sidebar-line: rgba(255, 255, 255, 0.08);
  --cpos-sidebar-hover: rgba(255, 255, 255, 0.06);

  --cpos-fg: #0f172a;
  --cpos-fg-muted: #64748b;
  --cpos-fg-subtle: #94a3b8;
  --cpos-border: #e6e9ee;
  --cpos-border-strong: #cbd5e1;

  --cpos-success: #059669;
  --cpos-success-soft: #ecfdf5;
  --cpos-success-line: #a7f3d0;
  --cpos-warning: #b45309;
  --cpos-warning-soft: #fffbeb;
  --cpos-warning-line: #fde68a;
  --cpos-danger: #dc2626;
  --cpos-danger-soft: #fef2f2;
  --cpos-danger-line: #fecaca;

  --cpos-r-xs: 6px;
  --cpos-r-sm: 8px;
  --cpos-r-md: 12px;
  --cpos-r-lg: 16px;
  --cpos-r-xl: 22px;
  --cpos-r-full: 999px;

  --cpos-sh-xs: 0 1px 2px rgba(15, 23, 42, 0.06);
  --cpos-sh-sm: 0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04);
  --cpos-sh-md: 0 4px 12px rgba(15, 23, 42, 0.07), 0 1px 3px rgba(15, 23, 42, 0.05);
  --cpos-sh-lg: 0 12px 28px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.05);
  --cpos-sh-xl: 0 24px 56px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.06);

  --cpos-ring: 0 0 0 3px var(--cpos-brand-glow);
  --cpos-sidebar-w: 248px;
  --cpos-sidebar-w-rail: 72px;
  --cpos-topbar-h: 60px;

  /* A cashier taps this screen with a finger, often a gloved one. 44px is the
     floor every control in the register is built to; nothing here is smaller. */
  --cpos-touch: 44px;

  --cpos-dur-fast: 120ms;
  /* One value for every disabled control. Three different ones (0.5, 0.55,
     0.45) were in the sheet before, none of them chosen. */
  --cpos-disabled-fade: 0.55;
  --cpos-dur: 200ms;
  --cpos-dur-slow: 320ms;
  --cpos-ease: cubic-bezier(0.32, 0.72, 0, 1);
  --cpos-ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  --cpos-font: var(--caspian-font-family, 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif);
  --cpos-num: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

@supports (color: color-mix(in srgb, red 50%, blue)) {
  :root {
    --cpos-brand-soft: color-mix(in srgb, var(--cpos-brand) 10%, #ffffff);
    --cpos-brand-soft-fg: color-mix(in srgb, var(--cpos-brand) 78%, #000000);
    --cpos-brand-line: color-mix(in srgb, var(--cpos-brand) 28%, #ffffff);
    --cpos-brand-glow: color-mix(in srgb, var(--cpos-brand) 28%, transparent);
    --cpos-brand-hover: color-mix(in srgb, var(--cpos-brand) 86%, #000000);
  }
}

/* ------------------------------------------------------------ dark */
:root[data-cpos-theme='dark'] {
  --cpos-bg: #0b1020;
  --cpos-surface: #131a2c;
  --cpos-surface-2: #1a2337;
  --cpos-surface-3: #222c43;
  --cpos-sidebar-bg: #080c17;
  --cpos-sidebar-fg: #b6c2d4;
  --cpos-sidebar-fg-dim: #6b7a92;
  --cpos-sidebar-line: rgba(255, 255, 255, 0.07);
  --cpos-sidebar-hover: rgba(255, 255, 255, 0.05);

  --cpos-fg: #eef2f8;
  --cpos-fg-muted: #93a1b8;
  --cpos-fg-subtle: #6b7a92;
  --cpos-border: #253048;
  --cpos-border-strong: #33415c;

  --cpos-success: #34d399;
  --cpos-success-soft: #06281f;
  --cpos-success-line: #10603f;
  --cpos-warning: #fbbf24;
  --cpos-warning-soft: #2a1d05;
  --cpos-warning-line: #6b4a09;
  --cpos-danger: #f87171;
  --cpos-danger-soft: #2b1113;
  --cpos-danger-line: #6d2427;

  --cpos-sh-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --cpos-sh-sm: 0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
  --cpos-sh-md: 0 4px 14px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.35);
  --cpos-sh-lg: 0 14px 34px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
  --cpos-sh-xl: 0 28px 64px rgba(0, 0, 0, 0.62), 0 4px 12px rgba(0, 0, 0, 0.4);
}

@supports (color: color-mix(in srgb, red 50%, blue)) {
  :root[data-cpos-theme='dark'] {
    --cpos-brand-soft: color-mix(in srgb, var(--cpos-brand) 22%, #131a2c);
    --cpos-brand-soft-fg: color-mix(in srgb, var(--cpos-brand) 42%, #ffffff);
    --cpos-brand-line: color-mix(in srgb, var(--cpos-brand) 40%, #131a2c);
    --cpos-brand-hover: color-mix(in srgb, var(--cpos-brand) 82%, #ffffff);
  }
}

/* ============================================================ shell */
.cpos-shell {
  display: flex;
  height: 100dvh;
  min-height: 0;
  font-family: var(--cpos-font);
  background: var(--cpos-bg);
  color: var(--cpos-fg);
  color-scheme: light;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
:root[data-cpos-theme='dark'] .cpos-shell { color-scheme: dark; }

/* The shell is not the only root the till draws into. .cpos-modal renders
   outside it -- its parent chain is div.cpos-modal < div < body -- so scoping
   this reset to .cpos-shell alone left every control in every dialog on
   content-box. .cpos-input pads 14px a side and carries a 1px border, so a
   field sat 30px wider than the column holding it: the product form's four-up
   row ran past the panel edge, and its help text wrapped into a 120px ribbon.
   Same reason the --cpos-* tokens live on :root rather than on the shell. */
.cpos-shell *, .cpos-shell *::before, .cpos-shell *::after,
.cpos-modal *, .cpos-modal *::before, .cpos-modal *::after { box-sizing: border-box; }

.cpos-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.cpos-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--cpos-border-strong) transparent;
}
.cpos-main::-webkit-scrollbar, .cpos-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.cpos-main::-webkit-scrollbar-thumb, .cpos-scroll::-webkit-scrollbar-thumb {
  background: var(--cpos-border-strong);
  border: 3px solid transparent;
  border-radius: var(--cpos-r-full);
  background-clip: content-box;
}
.cpos-main::-webkit-scrollbar-track, .cpos-scroll::-webkit-scrollbar-track { background: transparent; }
.cpos-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--cpos-border-strong) transparent; }

/* ============================================================ sidebar */
.cpos-sidebar {
  position: relative;
  z-index: 30;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: var(--cpos-sidebar-w);
  background: var(--cpos-sidebar-bg);
  color: var(--cpos-sidebar-fg);
  border-inline-end: 1px solid var(--cpos-sidebar-line);
  padding-inline-start: env(safe-area-inset-left, 0px);
  transition: width var(--cpos-dur) var(--cpos-ease);
  overflow: hidden;
}
.cpos-sidebar--rail { width: var(--cpos-sidebar-w-rail); }

.cpos-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--cpos-topbar-h);
  flex-shrink: 0;
  padding-inline: 16px;
  border-bottom: 1px solid var(--cpos-sidebar-line);
  overflow: hidden;
}
.cpos-sidebar--rail .cpos-sidebar__brand { padding-inline: 14px; }

.cpos-sidebar__mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--cpos-r-md);
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 4px 12px var(--cpos-brand-glow);
}

.cpos-sidebar__wordmark {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  white-space: nowrap;
}
.cpos-sidebar__name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #fff;
}
.cpos-sidebar__sub {
  font-size: 11px;
  font-weight: 500;
  color: var(--cpos-sidebar-fg-dim);
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpos-sidebar__nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  scrollbar-width: thin;
  scrollbar-color: var(--cpos-sidebar-line) transparent;
}

.cpos-sidebar__grouplabel {
  padding: 14px 10px 6px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--cpos-sidebar-fg-dim);
  white-space: nowrap;
}
.cpos-sidebar--rail .cpos-sidebar__grouplabel {
  padding: 12px 0 6px;
  text-align: center;
  font-size: 0;
}
.cpos-sidebar--rail .cpos-sidebar__grouplabel::after {
  content: '';
  display: block;
  height: 1px;
  margin: 0 12px;
  background: var(--cpos-sidebar-line);
}

.cpos-navitem {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--cpos-touch);
  padding: 0 12px;
  border: 0;
  border-radius: var(--cpos-r-md);
  background: transparent;
  color: var(--cpos-sidebar-fg);
  font: inherit;
  font-size: 13.5px;
  font-weight: 550;
  text-align: start;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
.cpos-sidebar--rail .cpos-navitem { justify-content: center; padding: 0; }

.cpos-navitem:hover { background: var(--cpos-sidebar-hover); color: #fff; }
.cpos-navitem:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--cpos-sidebar-bg), 0 0 0 4px var(--cpos-brand);
}
.cpos-navitem__icon {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  opacity: 0.85;
}
.cpos-navitem__label { overflow: hidden; text-overflow: ellipsis; }

.cpos-navitem--active {
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 4px 14px var(--cpos-brand-glow);
}
.cpos-navitem--active:hover { background: var(--cpos-brand); color: var(--cpos-brand-fg); }
.cpos-navitem--active .cpos-navitem__icon { opacity: 1; }

/* The rail shows icons only, so the active item needs an edge marker a cashier
   can find without reading — the pill alone reads as "just another icon". */
.cpos-navitem--active::before {
  content: '';
  position: absolute;
  inset-inline-start: -7px;
  top: 50%;
  width: 3px;
  height: 20px;
  border-radius: var(--cpos-r-full);
  background: var(--cpos-brand);
  transform: translateY(-50%);
  opacity: 0;
}
.cpos-sidebar--rail .cpos-navitem--active::before { opacity: 1; }

.cpos-navitem__count {
  margin-inline-start: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-grid;
  place-items: center;
  border-radius: var(--cpos-r-full);
  background: var(--cpos-danger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cpos-navitem--active .cpos-navitem__count { background: rgba(0, 0, 0, 0.28); }
.cpos-sidebar--rail .cpos-navitem__count {
  position: absolute;
  top: 4px;
  inset-inline-end: 10px;
  margin: 0;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  font-size: 10px;
  border: 2px solid var(--cpos-sidebar-bg);
}

/* Collapsed labels become hover tooltips. Pure CSS so it costs no state and
   cannot get stuck open when a tap moves focus away mid-sale. */
.cpos-navitem__tip {
  position: absolute;
  inset-inline-start: calc(100% + 10px);
  top: 50%;
  z-index: 60;
  padding: 7px 11px;
  border-radius: var(--cpos-r-sm);
  background: var(--cpos-fg);
  color: var(--cpos-bg);
  font-size: 12.5px;
  font-weight: 600;
  box-shadow: var(--cpos-sh-lg);
  pointer-events: none;
  opacity: 0;
  transform: translateY(-50%) translateX(-6px);
  transition: opacity var(--cpos-dur-fast) ease, transform var(--cpos-dur-fast) var(--cpos-ease-out);
}
.cpos-sidebar--rail .cpos-navitem:hover .cpos-navitem__tip,
.cpos-sidebar--rail .cpos-navitem:focus-visible .cpos-navitem__tip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}
.cpos-sidebar:not(.cpos-sidebar--rail) .cpos-navitem__tip { display: none; }

.cpos-sidebar__foot {
  flex-shrink: 0;
  padding: 10px;
  border-top: 1px solid var(--cpos-sidebar-line);
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
}

.cpos-sidebar__who {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--cpos-r-md);
  background: var(--cpos-sidebar-hover);
  min-width: 0;
  white-space: nowrap;
}
.cpos-sidebar--rail .cpos-sidebar__who { justify-content: center; padding: 8px 0; background: transparent; }
.cpos-sidebar__whotext { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
.cpos-sidebar__whoname {
  font-size: 12.5px;
  font-weight: 650;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cpos-sidebar__whorole { font-size: 11px; color: var(--cpos-sidebar-fg-dim); overflow: hidden; text-overflow: ellipsis; }

/* ---------------------------------------------- off-canvas + scrim */
.cpos-scrim {
  position: fixed;
  inset: 0;
  z-index: 29;
  background: rgba(8, 12, 23, 0.55);
  backdrop-filter: blur(2px);
  border: 0;
  padding: 0;
  animation: cpos-fade-in var(--cpos-dur) var(--cpos-ease) both;
}

.cpos-sidebar--drawer {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  width: min(var(--cpos-sidebar-w), 84vw);
  box-shadow: var(--cpos-sh-xl);
  animation: cpos-slide-in-start var(--cpos-dur-slow) var(--cpos-ease-out) both;
}

/* ============================================================ topbar */
.cpos-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  height: var(--cpos-topbar-h);
  padding-inline: 14px;
  padding-inline-end: calc(14px + env(safe-area-inset-right, 0px));
  background: var(--cpos-surface);
  border-bottom: 1px solid var(--cpos-border);
  box-shadow: var(--cpos-sh-xs);
  position: relative;
  z-index: 20;
}

/* Below 1024px the side menu is a drawer, so this is the only thing naming
   the current screen -- it gives up width last, and only to a cap so it can
   never push the tools cluster off the end. */
.cpos-topbar__title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  max-width: 40%;
  flex-shrink: 0;
}
.cpos-topbar__h {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cpos-topbar__sub {
  font-size: 11.5px;
  color: var(--cpos-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cpos-topbar__spacer { flex: 1; min-width: 4px; }
.cpos-topbar__tools { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ============================================================ controls */
.cpos-iconbtn {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: var(--cpos-touch);
  height: var(--cpos-touch);
  border: 1px solid transparent;
  border-radius: var(--cpos-r-md);
  background: transparent;
  color: var(--cpos-fg-muted);
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease,
    border-color var(--cpos-dur-fast) ease, transform var(--cpos-dur-fast) ease;
}
.cpos-iconbtn:hover { background: var(--cpos-surface-3); color: var(--cpos-fg); }
.cpos-iconbtn:active { transform: scale(0.94); }
.cpos-iconbtn:focus-visible { outline: none; border-color: var(--cpos-brand); box-shadow: var(--cpos-ring); }
.cpos-iconbtn--bordered { border-color: var(--cpos-border); background: var(--cpos-surface); }
.cpos-iconbtn--onbrand { color: var(--cpos-sidebar-fg); }
.cpos-iconbtn--onbrand:hover { background: var(--cpos-sidebar-hover); color: #fff; }

.cpos-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--cpos-touch);
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: background var(--cpos-dur-fast) ease, border-color var(--cpos-dur-fast) ease,
    box-shadow var(--cpos-dur-fast) ease, transform var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
.cpos-btn:active:not(:disabled) { transform: translateY(1px); }
.cpos-btn:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
/* Flattened, not merely faded. .cpos-btn--primary keeps its brand fill AND
   its glow, so a disabled Pay button still read as the one thing on screen to
   press -- the shadow does not dim with opacity the way a colour does. The
   three ad-hoc values this replaces (0.5 here, 0.55 on select, 0.45 on switch)
   were never a decision; --cpos-disabled-fade is. */
.cpos-btn:disabled,
.cpos-btn[aria-disabled='true'] {
  background: var(--cpos-surface-3);
  color: var(--cpos-fg-subtle);
  border-color: var(--cpos-border);
  box-shadow: none;
  filter: none;
  opacity: var(--cpos-disabled-fade);
  cursor: not-allowed;
}
/* No rule existed for these at all, so a disabled field fell back to the user
   agent's grey -- a light box on a dark panel under data-cpos-theme="dark". */
.cpos-input:disabled,
.cpos-textarea:disabled {
  background: var(--cpos-surface-3);
  color: var(--cpos-fg-subtle);
  border-color: var(--cpos-border);
  opacity: var(--cpos-disabled-fade);
  cursor: not-allowed;
}

.cpos-btn--primary {
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12), 0 4px 14px var(--cpos-brand-glow);
}
.cpos-btn--primary:hover:not(:disabled) { background: var(--cpos-brand-hover); box-shadow: 0 2px 4px rgba(15,23,42,0.14), 0 8px 22px var(--cpos-brand-glow); }

.cpos-btn--outline { background: var(--cpos-surface); border-color: var(--cpos-border-strong); }
.cpos-btn--outline:hover:not(:disabled) { background: var(--cpos-surface-2); border-color: var(--cpos-fg-subtle); }

.cpos-btn--ghost { background: transparent; color: var(--cpos-fg-muted); }
.cpos-btn--ghost:hover:not(:disabled) { background: var(--cpos-surface-3); color: var(--cpos-fg); }

.cpos-btn--danger { background: var(--cpos-danger); color: #fff; box-shadow: var(--cpos-sh-sm); }
.cpos-btn--danger:hover:not(:disabled) { filter: brightness(0.93); }

.cpos-btn--success { background: var(--cpos-success); color: #fff; box-shadow: var(--cpos-sh-sm); }
.cpos-btn--success:hover:not(:disabled) { filter: brightness(0.93); }

.cpos-btn--sm { min-height: 36px; padding: 0 13px; font-size: 13px; border-radius: var(--cpos-r-sm); gap: 6px; }
.cpos-btn--lg { min-height: 56px; padding: 0 26px; font-size: 16px; border-radius: var(--cpos-r-lg); }
.cpos-btn--block { width: 100%; }

/* The register's money button. Big enough to hit without looking, and it says
   what it will charge so the cashier never confirms a total they cannot see. */
.cpos-btn--pay {
  flex-direction: column;
  gap: 3px;
  min-height: 64px;
  font-size: 15px;
}
.cpos-btn__paytotal { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }

.cpos-input {
  width: 100%;
  min-height: var(--cpos-touch);
  padding: 0 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  font: inherit;
  font-size: 14px;
  transition: border-color var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease, background var(--cpos-dur-fast) ease;
}
.cpos-input::placeholder { color: var(--cpos-fg-subtle); }
.cpos-input:hover { border-color: var(--cpos-border-strong); }
.cpos-input:focus { outline: none; border-color: var(--cpos-brand); box-shadow: var(--cpos-ring); }

/* The dropdown and the multi-line box, restating .cpos-input's metrics rather
   than joining its selector list. Grouping would be less to read, but .cpos-input
   is carried by cloud-rendered screens too and pos/CLAUDE.md only lets a
   standalone change add rules for classes a cloud register never wears -- so
   these two are written out and the rule above is left exactly as it was. */
.cpos-textarea {
  width: 100%;
  min-height: 88px;
  padding: 11px 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-sm);
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  font: inherit;
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
  transition: border-color var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease;
}
.cpos-textarea::placeholder { color: var(--cpos-fg-subtle); }
.cpos-textarea:hover { border-color: var(--cpos-border-strong); }
.cpos-textarea:focus { outline: none; border-color: var(--cpos-brand); box-shadow: var(--cpos-ring); }

/* The chevron is two gradients rather than an inlined SVG so it can be drawn in
   currentColor: a data-URI has to bake its stroke in as a literal, which would
   be the one hardcoded colour in this sheet and would stay slate grey on a dark
   till. Being background layers also means no wrapper element, so a select drops
   into a .cpos-field beside an input with nothing around it. */
.cpos-select {
  width: 100%;
  min-height: var(--cpos-touch);
  padding-block: 0;
  padding-inline: 14px 38px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background-color: var(--cpos-surface);
  color: var(--cpos-fg);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-size: 6px 6px, 6px 6px;
  background-position: right 20px top calc(50% + 1px), right 15px top calc(50% + 1px);
  background-repeat: no-repeat;
  transition: border-color var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease;
}
.cpos-select:hover { border-color: var(--cpos-border-strong); }
.cpos-select:focus { outline: none; border-color: var(--cpos-brand); box-shadow: var(--cpos-ring); }
.cpos-select:disabled { opacity: var(--cpos-disabled-fade); cursor: not-allowed; }
/* background-position takes no logical keywords, so the flip is spelled out. */
[dir='rtl'] .cpos-select {
  padding-inline: 38px 14px;
  background-position: left 20px top calc(50% + 1px), left 15px top calc(50% + 1px);
}
/* A select's options are painted by the OS, which reads color-scheme off the
   element -- without this a dark till drops a white menu out of a dark control. */
:root[data-cpos-theme='dark'] .cpos-select { color-scheme: dark; }

.cpos-searchbox { position: relative; display: flex; align-items: center; flex: 0 1 380px; min-width: 0; }
.cpos-searchbox__icon {
  position: absolute;
  inset-inline-start: 13px;
  display: inline-flex;
  color: var(--cpos-fg-subtle);
  pointer-events: none;
}
.cpos-searchbox .cpos-input { padding-inline-start: 40px; padding-inline-end: 38px; background: var(--cpos-surface-2); }
.cpos-searchbox .cpos-input:focus { background: var(--cpos-surface); }
.cpos-searchbox__clear {
  position: absolute;
  inset-inline-end: 8px;
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--cpos-r-full);
  background: var(--cpos-surface-3);
  color: var(--cpos-fg-muted);
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
.cpos-searchbox__clear:hover { background: var(--cpos-danger-soft); color: var(--cpos-danger); }

.cpos-avatar {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: var(--cpos-r-full);
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow: hidden;
  box-shadow: 0 2px 8px var(--cpos-brand-glow);
}
.cpos-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cpos-avatar--sm { width: 28px; height: 28px; font-size: 11px; }

.cpos-avatarbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--cpos-touch);
  padding: 0 8px 0 5px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-full);
  background: var(--cpos-surface);
  color: var(--cpos-fg-muted);
  cursor: pointer;
  transition: border-color var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease, background var(--cpos-dur-fast) ease;
}
.cpos-avatarbtn:hover { border-color: var(--cpos-border-strong); background: var(--cpos-surface-2); }
.cpos-avatarbtn:focus-visible { outline: none; border-color: var(--cpos-brand); box-shadow: var(--cpos-ring); }

/* ============================================================ surfaces */
.cpos-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-xl);
  background: var(--cpos-surface);
  box-shadow: var(--cpos-sh-sm);
}
.cpos-card--pad { padding: 20px; gap: 16px; }
.cpos-card--flush { border-radius: var(--cpos-r-lg); }

.cpos-cardhead {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.cpos-cardhead__icon {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: var(--cpos-r-md);
  background: var(--cpos-brand-soft);
  color: var(--cpos-brand-soft-fg);
}
.cpos-cardhead__icon--brand {
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 4px 12px var(--cpos-brand-glow);
}
.cpos-cardhead__icon--success { background: var(--cpos-success-soft); color: var(--cpos-success); }
.cpos-cardhead__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cpos-cardhead__title { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.cpos-cardhead__sub { font-size: 12px; color: var(--cpos-fg-muted); }
.cpos-cardhead__spacer { flex: 1; min-width: 4px; }

.cpos-page { padding: 22px; max-width: 1080px; margin-inline: auto; }
.cpos-page--wide { max-width: none; }
.cpos-pagehead { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.cpos-pagehead__text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.cpos-pagehead__h { margin: 0; font-size: 23px; font-weight: 750; letter-spacing: -0.022em; }
.cpos-pagehead__sub { margin: 0; font-size: 13.5px; color: var(--cpos-fg-muted); line-height: 1.5; max-width: 62ch; }

.cpos-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  margin-bottom: 16px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface);
  box-shadow: var(--cpos-sh-xs);
}
.cpos-section__title { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }

.cpos-field { display: flex; flex-direction: column; gap: 6px; }
.cpos-field__label { font-size: 12.5px; font-weight: 650; color: var(--cpos-fg); }
/* Says what is wrong, in the field it is wrong in. Sized with the help text it
   replaces so a field does not jump height as an error appears and clears. */
.cpos-field__error { font-size: 13px; line-height: 1.5; color: var(--cpos-danger); }
/* An invalid field keeps a danger border even while focused. --cpos-ring is the
   brand colour, so without this an invalid field that has just been focused
   looks focused-and-fine, which is the moment it most needs to look wrong. */
.cpos-input[aria-invalid='true'],
.cpos-textarea[aria-invalid='true'],
.cpos-select[aria-invalid='true'] { border-color: var(--cpos-danger); }
.cpos-input[aria-invalid='true']:focus-visible,
.cpos-textarea[aria-invalid='true']:focus-visible,
.cpos-select[aria-invalid='true']:focus-visible {
  border-color: var(--cpos-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cpos-danger) 30%, transparent);
}
/* A figure that has gone below zero. Never the only signal -- the screens that
   use it pair it with a badge, because colour alone is not a message. */
.cpos-neg { color: var(--cpos-danger); }
.cpos-muted { font-size: 12px; color: var(--cpos-fg-muted); line-height: 1.5; }
.cpos-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
.cpos-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.cpos-divider { height: 1px; background: var(--cpos-border); border: 0; margin: 0; }

/* ============================================================ status */
.cpos-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-full);
  background: var(--cpos-surface-2);
  color: var(--cpos-fg-muted);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cpos-badge--brand { background: var(--cpos-brand-soft); border-color: var(--cpos-brand-line); color: var(--cpos-brand-soft-fg); }
.cpos-badge--success { background: var(--cpos-success-soft); border-color: var(--cpos-success-line); color: var(--cpos-success); }
.cpos-badge--warning { background: var(--cpos-warning-soft); border-color: var(--cpos-warning-line); color: var(--cpos-warning); }
.cpos-badge--danger { background: var(--cpos-danger-soft); border-color: var(--cpos-danger-line); color: var(--cpos-danger); }

.cpos-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--cpos-r-full);
  background: currentColor;
  flex-shrink: 0;
}
.cpos-dot--live { animation: cpos-breathe 2.4s ease-in-out infinite; }

.cpos-note {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface-2);
  color: var(--cpos-fg-muted);
  font-size: 13px;
  line-height: 1.5;
  animation: cpos-fade-up var(--cpos-dur) var(--cpos-ease-out) both;
}
.cpos-note--brand { background: var(--cpos-brand-soft); border-color: var(--cpos-brand-line); color: var(--cpos-brand-soft-fg); }
.cpos-note--success { background: var(--cpos-success-soft); border-color: var(--cpos-success-line); color: var(--cpos-success); }
.cpos-note--warning { background: var(--cpos-warning-soft); border-color: var(--cpos-warning-line); color: var(--cpos-warning); }
.cpos-note--danger { background: var(--cpos-danger-soft); border-color: var(--cpos-danger-line); color: var(--cpos-danger); }

/* A full-width strip under the topbar — licence trouble, a waiting update. */
.cpos-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--cpos-warning-line);
  background: var(--cpos-warning-soft);
  color: var(--cpos-warning);
  font-size: 13px;
  font-weight: 550;
  animation: cpos-strip-in var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-strip--brand { background: var(--cpos-brand-soft); border-bottom-color: var(--cpos-brand-line); color: var(--cpos-brand-soft-fg); }
.cpos-strip__spacer { flex: 1; min-width: 4px; }

.cpos-strip__link { color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.cpos-strip__link:hover { opacity: 0.75; }

/* Kept below the tender dialog on purpose: the iOS install hint must never sit
   on top of the cash keypad. See the note in pos-install-button.tsx. */
.cpos-popover {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: 40;
  width: 264px;
  padding: 11px 13px;
  border-radius: var(--cpos-r-md);
  background: var(--cpos-fg);
  color: var(--cpos-bg);
  font-size: 12px;
  line-height: 1.55;
  box-shadow: var(--cpos-sh-lg);
  animation: cpos-fade-up var(--cpos-dur) var(--cpos-ease-out) both;
}

.cpos-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 180px;
  padding: 24px;
  text-align: center;
  animation: cpos-fade-in var(--cpos-dur-slow) var(--cpos-ease) both;
}
.cpos-empty__icon {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: var(--cpos-r-xl);
  background: var(--cpos-brand-soft);
  color: var(--cpos-brand-soft-fg);
}
.cpos-empty__icon--neutral { background: var(--cpos-surface-3); color: var(--cpos-fg-subtle); }
.cpos-empty__title { margin: 0; font-size: 15px; font-weight: 650; }
.cpos-empty__text { margin: 0; font-size: 13.5px; color: var(--cpos-fg-muted); max-width: 40ch; line-height: 1.55; }

/* ============================================================ register */
.cpos-register {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
  height: 100%;
  min-height: 0;
  align-items: stretch;
}

.cpos-scanbar { position: relative; display: flex; align-items: center; gap: 10px; }
.cpos-scanbar__icon {
  position: absolute;
  inset-inline-start: 16px;
  display: inline-flex;
  color: var(--cpos-fg-subtle);
  pointer-events: none;
  transition: color var(--cpos-dur) ease;
}
.cpos-scanbar__input {
  flex: 1;
  min-width: 0;
  min-height: 54px;
  padding-inline-start: 46px;
  font-size: 15.5px;
  font-weight: 550;
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface-2);
}
.cpos-scanbar__input:focus { background: var(--cpos-surface); }
.cpos-scanbar:focus-within .cpos-scanbar__icon { color: var(--cpos-brand); }

.cpos-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
  padding: 2px;
  overflow-y: auto;
  align-content: start;
}

.cpos-tile {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface);
  padding: 0;
  overflow: hidden;
  text-align: start;
  cursor: pointer;
  box-shadow: var(--cpos-sh-xs);
  transition: transform var(--cpos-dur-fast) var(--cpos-ease-out),
    box-shadow var(--cpos-dur) ease, border-color var(--cpos-dur-fast) ease;
  animation: cpos-fade-up var(--cpos-dur) var(--cpos-ease-out) both;
}
.cpos-tile:hover { transform: translateY(-3px); box-shadow: var(--cpos-sh-lg); border-color: var(--cpos-brand-line); }
.cpos-tile:active { transform: translateY(0) scale(0.985); box-shadow: var(--cpos-sh-xs); }
.cpos-tile:focus-visible { outline: none; border-color: var(--cpos-brand); box-shadow: var(--cpos-ring); }

.cpos-tile__media {
  position: relative;
  height: 96px;
  display: grid;
  place-items: center;
  background: var(--cpos-surface-3);
  color: var(--cpos-fg-subtle);
  overflow: hidden;
}
.cpos-tile__media img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--cpos-dur-slow) var(--cpos-ease-out); }
.cpos-tile:hover .cpos-tile__media img { transform: scale(1.06); }
.cpos-tile__body { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px 12px; }
.cpos-tile__name {
  font-size: 13px;
  font-weight: 620;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cpos-tile__price { font-size: 14px; font-weight: 750; color: var(--cpos-brand); font-variant-numeric: tabular-nums; }
.cpos-tile__stock { font-size: 11px; color: var(--cpos-fg-subtle); }

/* ---------------------------------------------------- ticket lines */
.cpos-lines { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow-y: auto; padding: 2px; }

.cpos-line {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 12px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface-2);
  transition: border-color var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease, background var(--cpos-dur-fast) ease;
  animation: cpos-line-in var(--cpos-dur) var(--cpos-ease-out) both;
}
.cpos-line:hover { border-color: var(--cpos-border-strong); background: var(--cpos-surface); box-shadow: var(--cpos-sh-xs); }
.cpos-line__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cpos-line__main { flex: 1 1 110px; min-width: 110px; }
.cpos-line__name { font-size: 13.5px; font-weight: 620; overflow-wrap: anywhere; line-height: 1.3; }
.cpos-line__meta { font-size: 11.5px; color: var(--cpos-fg-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.cpos-line__amount {
  min-width: 76px;
  text-align: end;
  font-size: 15px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.cpos-line__tools { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
/* Below the 44px floor on a mouse-driven counter monitor only; the coarse
   -pointer rule further down puts them back up to full size for a finger. */
.cpos-line__tools .cpos-iconbtn { width: 38px; height: 38px; }
.cpos-line__discount { font-size: 11.5px; font-weight: 650; color: var(--cpos-success); }
.cpos-line__editor { display: flex; align-items: center; gap: 6px; }

/* One stepper control rather than two loose buttons, so a mis-tap on the gap
   between them does nothing instead of changing the quantity by accident. */
.cpos-stepper {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  overflow: hidden;
}
.cpos-stepper__btn {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  background: transparent;
  color: var(--cpos-fg-muted);
  font-size: 17px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
.cpos-stepper__btn:hover { background: var(--cpos-brand-soft); color: var(--cpos-brand-soft-fg); }
.cpos-stepper__btn:active { background: var(--cpos-brand); color: var(--cpos-brand-fg); }
.cpos-stepper__btn:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--cpos-brand); }
.cpos-stepper__value {
  min-width: 34px;
  align-self: stretch;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 14.5px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  border-inline: 1px solid var(--cpos-border);
}

/* ---------------------------------------------------- totals */
.cpos-totals {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex-shrink: 0;
  padding: 16px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface-2);
}
.cpos-totals__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
.cpos-totals__label { color: var(--cpos-fg-muted); }
.cpos-totals__value { font-weight: 650; }
.cpos-totals__value--save { color: var(--cpos-success); }
.cpos-totals__grand {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-top: 3px;
  padding-top: 11px;
  border-top: 1px dashed var(--cpos-border-strong);
  font-size: 15px;
  font-weight: 650;
}
.cpos-totals__grandvalue {
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.cpos-totals__actions { display: flex; gap: 10px; margin-top: 4px; }

/* ---------------------------------------------------- sale complete */
.cpos-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 34px 22px;
  max-width: 520px;
  margin-inline: auto;
  text-align: center;
  animation: cpos-fade-up var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-done__seal {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin-bottom: 12px;
  border-radius: var(--cpos-r-full);
  background: var(--cpos-success-soft);
  color: var(--cpos-success);
  border: 1px solid var(--cpos-success-line);
  animation: cpos-pop var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-done__seal--held { background: var(--cpos-warning-soft); color: var(--cpos-warning); border-color: var(--cpos-warning-line); }
.cpos-done__h { margin: 0; font-size: 22px; font-weight: 750; letter-spacing: -0.02em; }
.cpos-done__receipt { margin: 0; font-size: 13px; color: var(--cpos-fg-muted); font-variant-numeric: tabular-nums; }
.cpos-done__total {
  margin: 14px 0 4px;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}
.cpos-done__change {
  margin-top: 10px;
  padding: 13px 20px;
  border-radius: var(--cpos-r-md);
  border: 1px solid var(--cpos-success-line);
  background: var(--cpos-success-soft);
  color: var(--cpos-success);
  font-size: 19px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.cpos-done__actions { display: flex; gap: 10px; justify-content: center; margin-top: 24px; width: 100%; }

/* ---------------------------------------------------- modal / tender */
.cpos-modal {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(8, 12, 23, 0.55);
  backdrop-filter: blur(3px);
  animation: cpos-fade-in var(--cpos-dur) var(--cpos-ease) both;
}
.cpos-modal__panel {
  width: min(480px, 100%);
  max-height: 92dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 22px;
  border-radius: var(--cpos-r-xl);
  border: 1px solid var(--cpos-border);
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  box-shadow: var(--cpos-sh-xl);
  animation: cpos-modal-in var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-modal__title { margin: 0; font-size: 18px; font-weight: 750; letter-spacing: -0.015em; }

/* Widths for the panels that hold a form rather than a tender. The base rule
   above stays at 480px, which is the tender dialog's and the only one that was
   ever tuned around a number pad. */
.cpos-modal__panel--md { width: min(600px, 100%); }
.cpos-modal__panel--lg { width: min(760px, 100%); }

/* A panel with a head and a foot scrolls its middle, not itself. The tender
   dialog is short enough that scrolling the whole panel is fine; a product form
   is not, and a Save button that scrolls off the bottom of a modal is a Save
   button a cashier cannot find. min-height: 0 is what lets the body shrink
   inside the flex column instead of pushing the panel past its 92dvh cap. */
/* The width eases because Quick add changes it between its two steps -- the
   list is a --md panel and the form an --lg one, and snapping between them
   reads as a second dialog rather than the same one moving on. Inert for every
   other framed dialog, none of which resize, and the reduced-motion block at
   the foot of this sheet already names .cpos-modal__panel. */
.cpos-modal__panel--framed {
  gap: 0;
  padding: 0;
  overflow: hidden;
  transition: width var(--cpos-dur) var(--cpos-ease);
}
.cpos-modal__head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--cpos-border);
}
/* The head's growing child is the title block, not the h2 inside it. Targeting
   the h2 -- which this rule did while the title was still a direct child --
   grows it down its own column and leaves the close button hugging the text
   instead of sitting at the end of the head. */
.cpos-modal__head .cpos-cardhead__text { flex: 1; min-width: 0; }
.cpos-modal__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--cpos-border-strong) transparent;
}

/* The same rhythm, for a <form> that has to be one element so a submit button
   in the pinned foot can point at it with form=. Without this the form is a
   single flex child of the body above and its own fields have no gap. */
.cpos-form { display: flex; flex-direction: column; gap: 14px; }
.cpos-modal__foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 13px 20px;
  border-top: 1px solid var(--cpos-border);
  background: var(--cpos-surface-2);
}

.cpos-modal__due {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 15px 17px;
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-brand-soft);
  border: 1px solid var(--cpos-brand-line);
  color: var(--cpos-brand-soft-fg);
}
.cpos-modal__duelabel { font-size: 13px; font-weight: 650; }
.cpos-modal__duevalue { font-size: 27px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }

.cpos-tender {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 13px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface-2);
  animation: cpos-line-in var(--cpos-dur) var(--cpos-ease-out) both;
}

/* ---------------------------------------------------- sign in */
.cpos-signin {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(400px, 100%);
  margin: min(9vh, 80px) auto;
  padding: 30px 28px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-xl);
  background: var(--cpos-surface);
  box-shadow: var(--cpos-sh-lg);
  animation: cpos-fade-up var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-signin__brand { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.cpos-signin__mark {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 8px 22px var(--cpos-brand-glow);
}
.cpos-signin__h { margin: 0; font-size: 20px; font-weight: 750; letter-spacing: -0.02em; }
.cpos-signin__sub { margin: 0; font-size: 13.5px; color: var(--cpos-fg-muted); line-height: 1.55; }
/* A dead end rather than a form: the mark drops the brand colour so the screen
   does not read as somewhere to type. */
.cpos-signin--notice { gap: 12px; }
.cpos-signin__mark--muted {
  background: var(--cpos-surface-2);
  color: var(--cpos-fg-muted);
  box-shadow: none;
}
/* Field help. Not .cpos-signin__sub, which is centred for the brand block. */
.cpos-signin__hint {
  margin: 0;
  font-size: 12px;
  color: var(--cpos-fg-muted);
  line-height: 1.5;
}
/* Under the card, not inside it: this is a property of the device, not of the
   account being signed into. */
.cpos-signin__lang {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: min(400px, 100%);
  margin: 0 auto 24px;
}

/* Deliberately understated. Almost everybody who reads the sign-in card is
   starting a shift; the way back into a locked-out till is a door, not an
   invitation, so it reads as a link rather than a third button. */
.cpos-signin__foot-link {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.85rem;
  color: var(--cpos-fg-muted);
  text-align: center;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.cpos-signin__foot-link:hover { color: var(--cpos-fg); }
.cpos-signin__foot-link:focus-visible { outline: 2px solid var(--cpos-brand); outline-offset: 2px; }

/* The reveal button sits inside the box, so the box has to hold it. */
.cpos-field__control { position: relative; display: flex; align-items: center; }
.cpos-input--revealable { padding-inline-end: 46px; }
.cpos-input__reveal {
  position: absolute;
  inset-inline-end: 6px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: var(--cpos-r-sm);
  background: transparent;
  color: var(--cpos-fg-muted);
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
.cpos-input__reveal:hover { background: var(--cpos-surface-2); color: var(--cpos-fg); }
.cpos-input__reveal:focus-visible { outline: none; box-shadow: var(--cpos-ring); }

/* The card was the one panel in the register with no narrow-screen rule, so a
   till in portrait kept a 9vh top margin and 30px of padding it could not
   afford. Mirrors the .cpos-opencash block above. */
@media (max-width: 640px) {
  .cpos-signin { margin: 12px auto; padding: 22px 18px; gap: 14px; border-radius: var(--cpos-r-lg); }
  .cpos-signin__mark { width: 46px; height: 46px; }
  .cpos-signin__h { font-size: 18px; }
  .cpos-signin__lang { margin-bottom: 16px; }
}

/* --------------------------------------- gate cards inside .cpos-main */
/* .cpos-gate is the neutral name for this card; .cpos-opencash is the original
   one and stays because the opening-cash screen and the manual both use it.
   Aliased rather than duplicated: three screens now render the same card --
   declare the drawer, name this counter, open a shift -- and a second copy of
   these rules is a second place for them to drift. */
/* Content inside .cpos-main, and emphatically not a guard screen: the sidebar,
   the top bar and every other route stay mounted and operable behind it, so it
   carries no 100dvh canvas and no fixed positioning.

   No dark block is needed -- every colour below is either overridden under
   :root[data-cpos-theme='dark'] or derived from the brand -- and no prefers-reduced-motion
   entry either: the '.cpos-shell *' rule in the a11y fence already covers
   anything rendered inside .cpos-main. (.cpos-modal is named there only because
   it is position: fixed and so sits outside the shell it was opened from.)
   Both were checked rather than forgotten. */
.cpos-opencash, .cpos-gate {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(460px, 100%);
  margin: min(7vh, 64px) auto;
  padding: 30px 28px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-xl);
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  box-shadow: var(--cpos-sh-lg);
  animation: cpos-fade-up var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-opencash__head, .cpos-gate__head { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.cpos-opencash__mark, .cpos-gate__mark {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 8px 22px var(--cpos-brand-glow);
}
.cpos-opencash__h, .cpos-gate__h { margin: 0; font-size: 20px; font-weight: 750; letter-spacing: -0.02em; }
.cpos-opencash__sub, .cpos-gate__sub { margin: 0; font-size: 13.5px; color: var(--cpos-fg-muted); line-height: 1.55; }

/* The figure is the whole screen, so it is sized like one. Tabular numerals and
   end alignment mean a slipped extra zero pushes the whole run sideways, where
   the eye catches it, instead of nudging one glyph inside a proportional run.
   The max() keeps it clear of the --cpos-touch floor even if that token grows. */
.cpos-opencash__amount, .cpos-gate__amount {
  min-height: max(var(--cpos-touch), 64px);
  padding: 0 18px;
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.02em;
  text-align: end;
  font-variant-numeric: tabular-nums;
}
.cpos-opencash__echo, .cpos-gate__echo {
  align-self: flex-end;
  font-size: 13px;
  font-weight: 650;
  color: var(--cpos-fg-muted);
  font-variant-numeric: tabular-nums;
}
/* A typed zero is a real answer -- a card-only counter opens empty -- but it
   reads quieter than a counted figure so it never looks like the default. */
.cpos-opencash__echo--zero, .cpos-gate__echo--zero { color: var(--cpos-fg-subtle); }
.cpos-opencash__foot, .cpos-gate__foot { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }

@media (max-width: 640px) {
  .cpos-opencash, .cpos-gate { margin: 12px auto; padding: 22px 18px; gap: 15px; border-radius: var(--cpos-r-lg); }
  .cpos-opencash__mark, .cpos-gate__mark { width: 46px; height: 46px; }
  .cpos-opencash__amount, .cpos-gate__amount { padding: 0 14px; font-size: 26px; }
}

/* ---------------------------------------------------- the shift strip */
/* Sits above the sale screen while a shift is open. Deliberately quiet: it is
   the one thing on the register that is not the sale, and a cashier reads it
   twice a day. Wraps rather than scrolls, because a till in portrait would
   otherwise hide the Close button off the right-hand edge -- which is the
   control somebody is looking for when they are trying to go home. */
.cpos-shiftstrip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface-2);
  color: var(--cpos-fg-muted);
  font-size: 13px;
}
.cpos-shiftstrip__who { font-weight: 650; color: var(--cpos-fg); }
.cpos-shiftstrip__fig { font-variant-numeric: tabular-nums; }
.cpos-shiftstrip__fig b { font-weight: 700; color: var(--cpos-fg); }
/* Pushes the buttons to the end on a wide till and lets them fall in line on a
   narrow one, without a second flex container to keep in step. */
.cpos-shiftstrip__spacer { flex: 1 1 auto; }
.cpos-shiftstrip__acts { display: flex; flex-wrap: wrap; gap: 8px; }

/* ---------------------------------------------------- the shift report */
/* One table of figures, used for the X-report on an open shift and the Z-report
   on a closed one. The two are the same rows; only the count and the variance
   are absent while it is open. */
.cpos-zreport { display: flex; flex-direction: column; gap: 6px; }
.cpos-zreport__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid var(--cpos-border);
  font-size: 14px;
}
.cpos-zreport__row:last-child { border-bottom: 0; }
.cpos-zreport__row b { font-variant-numeric: tabular-nums; }
/* The two rows somebody is actually looking for. */
.cpos-zreport__row--total { font-weight: 700; font-size: 15.5px; }
.cpos-zreport__row--total b { font-size: 17px; }
/* Colour is never the only signal -- the figure carries its own sign, and the
   row beside it is labelled "over" or "short" in words. */
.cpos-zreport__row--short b { color: var(--cpos-danger); }
.cpos-zreport__row--over b { color: var(--cpos-warning); }

/* ---------------------------------------------------- guard screens */
/* These render above PosShell, so they carry their own full-height canvas. */
.cpos-boot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: 100dvh;
  background: var(--cpos-bg);
  color: var(--cpos-brand);
  font-family: var(--cpos-font);
}
.cpos-boot__mark {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
  box-shadow: 0 10px 26px var(--cpos-brand-glow);
  animation: cpos-pop var(--cpos-dur-slow) var(--cpos-ease-out) both;
}
.cpos-boot .cpos-spinner { width: 20px; height: 20px; color: var(--cpos-fg-subtle); }

.cpos-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-height: 100dvh;
  padding: 40px 24px;
  justify-content: center;
  text-align: center;
  background: var(--cpos-bg);
  color: var(--cpos-fg);
  font-family: var(--cpos-font);
}
.cpos-notice__h { margin: 4px 0 0; font-size: 21px; font-weight: 750; letter-spacing: -0.02em; }
.cpos-notice__body { margin: 0; max-width: 46ch; font-size: 14px; line-height: 1.6; color: var(--cpos-fg-muted); }
.cpos-notice__foot { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 10px; }

.cpos-uid {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  box-shadow: var(--cpos-sh-xs);
}
.cpos-uid__value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }

/* The standalone sign-in also renders above the shell. */
.cpos-signin-canvas {
  min-height: 100dvh;
  padding: 20px;
  background: var(--cpos-bg);
  color: var(--cpos-fg);
  font-family: var(--cpos-font);
}

/* ============================================================ tables */
.cpos-tablewrap {
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface);
  overflow: auto;
  box-shadow: var(--cpos-sh-xs);
}
.cpos-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.cpos-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 11px 14px;
  text-align: start;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
  color: var(--cpos-fg-muted);
  background: var(--cpos-surface-2);
  border-bottom: 1px solid var(--cpos-border);
  white-space: nowrap;
}
.cpos-table td { padding: 12px 14px; border-bottom: 1px solid var(--cpos-border); vertical-align: middle; }
.cpos-table tbody tr { transition: background var(--cpos-dur-fast) ease; }
.cpos-table tbody tr:hover { background: var(--cpos-surface-2); }
.cpos-table tbody tr:last-child td { border-bottom: 0; }
.cpos-table__num { text-align: end; font-variant-numeric: tabular-nums; }
/* The element selector .cpos-table th is (0,1,1) and beats .cpos-table__num
   at (0,1,0), so a numeric HEADER kept the start alignment its cells had
   already left. The column read as ragged for as long as the class existed. */
.cpos-table th.cpos-table__num { text-align: end; }

/* The first cell of a row, as the way into that record's page. A button rather
   than an <a> because the register navigates through its adapter; a button in
   the cell rather than the whole row being clickable because a clickable row
   also swallows the Delete sitting inside it. The Store list had this as an
   eight-property inline object with no hover and no focus ring; three screens
   want it now, so it is a class with both. */
.cpos-rowlink {
  padding: 0;
  border: 0;
  border-radius: var(--cpos-r-xs);
  background: none;
  color: var(--cpos-brand);
  font: inherit;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}
.cpos-rowlink:hover { text-decoration: underline; text-underline-offset: 2px; }
.cpos-rowlink:focus-visible { outline: none; box-shadow: var(--cpos-ring); }

/* Stat tiles for the back office takings summary. */
.cpos-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.cpos-stat {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 15px 16px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface);
  box-shadow: var(--cpos-sh-xs);
  transition: transform var(--cpos-dur-fast) var(--cpos-ease-out), box-shadow var(--cpos-dur) ease;
}
.cpos-stat:hover { transform: translateY(-2px); box-shadow: var(--cpos-sh-md); }
.cpos-stat__label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--cpos-fg-muted); }
.cpos-stat__value { font-size: 23px; font-weight: 780; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; }
.cpos-stat__hint { font-size: 11.5px; color: var(--cpos-fg-subtle); }

/* ============================================================ settings */
.cpos-settings__grid { display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 24px; align-items: start; }
.cpos-settings__body { min-width: 0; }

/* An index of the sections below, not navigation -- the shell owns that now. */
.cpos-jump {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface);
  box-shadow: var(--cpos-sh-xs);
}
.cpos-jump__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 11px;
  border: 0;
  border-radius: var(--cpos-r-sm);
  background: transparent;
  color: var(--cpos-fg-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
.cpos-jump__item:hover { background: var(--cpos-surface-3); color: var(--cpos-fg); }
.cpos-jump__item:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
/* App Admin switches panes with this list rather than scrolling to them, so
   unlike the settings jump list it has a current item to mark. */
.cpos-jump__item--on,
.cpos-jump__item--on:hover {
  background: var(--cpos-brand-soft);
  color: var(--cpos-brand-soft-fg);
}
.cpos-jump__icon { display: inline-grid; place-items: center; width: 18px; flex-shrink: 0; }

/* ------------------------------------------------------------ quick add */
/* Step one of the add dialog: a search box over a stacked list of what this
   till can make. Full-width rows, because the thing being chosen between needs
   a sentence and not just a noun -- the 232px rail these replaced could hold
   "Category" and nowhere to say what one is for.

   No breakpoint. A column of rows is already what a narrow till wants, which
   is the other half of why the two panes went. */
.cpos-quickadd { display: flex; flex-direction: column; gap: 12px; }
.cpos-quickadd__items { display: flex; flex-direction: column; gap: 8px; }
.cpos-quickadd__item {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: var(--cpos-touch);
  padding: 11px 13px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-lg);
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, border-color var(--cpos-dur-fast) ease;
}
.cpos-quickadd__item:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
/* The hover and the arrow keys' cursor are one state on purpose: a row tinted
   rather than filled, because a full-width row filled with --cpos-brand reads
   as one already pressed. */
.cpos-quickadd__item:hover,
.cpos-quickadd__item--on {
  background: var(--cpos-brand-soft);
  border-color: var(--cpos-brand-line);
}
.cpos-quickadd__icon {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: var(--cpos-r-md);
  background: var(--cpos-brand-soft);
  color: var(--cpos-brand-soft-fg);
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease;
}
/* The tile fills as the row tints, or it would vanish into a row that has just
   taken the tile's own colour. */
.cpos-quickadd__item:hover .cpos-quickadd__icon,
.cpos-quickadd__item--on .cpos-quickadd__icon {
  background: var(--cpos-brand);
  color: var(--cpos-brand-fg);
}
.cpos-quickadd__text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.cpos-quickadd__name { font-size: 14.5px; font-weight: 650; }
.cpos-quickadd__blurb { font-size: 13px; color: var(--cpos-fg-muted); }
.cpos-quickadd__go { color: var(--cpos-fg-subtle); flex-shrink: 0; }
.cpos-quickadd__item:hover .cpos-quickadd__go,
.cpos-quickadd__item--on .cpos-quickadd__go { color: var(--cpos-brand-soft-fg); }

/* A row of mutually exclusive picks -- appearance today, anything similar later. */
.cpos-choices { display: flex; gap: 8px; flex-wrap: wrap; }
.cpos-choice {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: var(--cpos-touch);
  padding: 0 15px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  color: var(--cpos-fg-muted);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--cpos-dur-fast) ease, background var(--cpos-dur-fast) ease,
    color var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease;
}
.cpos-choice:hover { border-color: var(--cpos-border-strong); color: var(--cpos-fg); }
.cpos-choice:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
.cpos-choice--on {
  border-color: var(--cpos-brand);
  background: var(--cpos-brand-soft);
  color: var(--cpos-brand-soft-fg);
  box-shadow: var(--cpos-ring);
}
.cpos-choice__icon { display: inline-flex; }

.cpos-radio {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 13px 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  transition: border-color var(--cpos-dur-fast) ease, background var(--cpos-dur-fast) ease;
}
.cpos-radio--on { border-color: var(--cpos-brand-line); background: var(--cpos-brand-soft); }
.cpos-radio input { accent-color: var(--cpos-brand); margin-top: 2px; flex: 0 0 auto; }

/* The same row as .cpos-radio, for the questions that take more than one answer.
   Written separately rather than sharing the radio's rule: a selector named for
   a radio doing duty for a checkbox is the kind of thing that reads as a bug six
   months later, and the two are free to drift. */
.cpos-check {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  min-height: var(--cpos-touch);
  padding: 13px 14px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
  cursor: pointer;
  transition: border-color var(--cpos-dur-fast) ease, background var(--cpos-dur-fast) ease;
}
.cpos-check:hover { border-color: var(--cpos-border-strong); }
.cpos-check--on { border-color: var(--cpos-brand-line); background: var(--cpos-brand-soft); }
.cpos-check input { accent-color: var(--cpos-brand); margin-top: 1px; flex: 0 0 auto; width: 17px; height: 17px; }
.cpos-check__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; font-size: 14px; }
.cpos-check__sub { font-size: 12.5px; color: var(--cpos-fg-muted); line-height: 1.5; }

/* ------------------------------------------------------------ switch */
/* A switch, for a setting that lands the moment it is flipped.
   The library's <Switch> could not be used here: it is 38x22 -- half the
   register's 44px touch floor -- and it hardcodes rgba(0,0,0,0.22) and #fff,
   neither of them a --cpos-* token, so on a till in dark mode it is near-black
   on near-black. This one is built to the floor and reads the brand, so
   theming the store themes the till. The knob is white in both themes on
   purpose: it is the moving part, and it has to stay legible against a track
   that goes from a grey to the shop's own colour. */
.cpos-switch {
  position: relative;
  flex: 0 0 auto;
  width: 52px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--cpos-r-full);
  background: var(--cpos-border-strong);
  cursor: pointer;
  transition: background var(--cpos-dur) var(--cpos-ease);
  -webkit-tap-highlight-color: transparent;
}
/* The track is 52x32 so it reads as a switch rather than a slab; this pushes
   the hit area out to 64x44 for a gloved finger without moving the artwork. */
.cpos-switch::after { content: ''; position: absolute; inset: -6px; border-radius: var(--cpos-r-full); }
.cpos-switch__knob {
  position: absolute;
  top: 3px;
  inset-inline-start: 3px;
  width: 26px;
  height: 26px;
  border-radius: var(--cpos-r-full);
  background: #fff;
  box-shadow: var(--cpos-sh-sm);
  transition: transform var(--cpos-dur) var(--cpos-ease);
}
.cpos-switch--on { background: var(--cpos-brand); }
.cpos-switch--on .cpos-switch__knob { transform: translateX(20px); }
[dir='rtl'] .cpos-switch--on .cpos-switch__knob { transform: translateX(-20px); }
.cpos-switch:hover:not(:disabled) { background: var(--cpos-fg-subtle); }
.cpos-switch--on:hover:not(:disabled) { background: var(--cpos-brand-hover); }
.cpos-switch:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
.cpos-switch:disabled { opacity: var(--cpos-disabled-fade); cursor: not-allowed; }

/* A setting stated as a sentence with its switch at the end of the line. */
.cpos-switchrow { display: flex; align-items: center; gap: 14px; min-height: var(--cpos-touch); padding: 9px 0; }
.cpos-switchrow + .cpos-switchrow { border-top: 1px solid var(--cpos-border); }
.cpos-switchrow__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cpos-switchrow__title { font-size: 14px; font-weight: 620; color: var(--cpos-fg); }
.cpos-switchrow__sub { font-size: 12px; color: var(--cpos-fg-muted); line-height: 1.5; }

/* ------------------------------------------------------------ collapse */
/* A row that opens to show its own detail. Used by the roles list, where a
   till may carry a dozen roles and thirteen permissions each: printing all of
   it at once is 150 controls on one screen. */
.cpos-collapse {
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface);
}
.cpos-collapse + .cpos-collapse { margin-top: 10px; }
.cpos-collapse--open { border-color: var(--cpos-border-strong); box-shadow: var(--cpos-sh-xs); }
.cpos-collapse__head { display: flex; align-items: center; gap: 10px; padding: 4px 14px; min-height: var(--cpos-touch); }
.cpos-collapse__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 8px 0;
  margin: 0;
  border: 0;
  border-radius: var(--cpos-r-sm);
  background: none;
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.cpos-collapse__toggle:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
.cpos-collapse__caret {
  display: inline-grid;
  place-items: center;
  width: 18px;
  flex-shrink: 0;
  color: var(--cpos-fg-subtle);
  transition: transform var(--cpos-dur-fast) ease;
}
.cpos-collapse--open .cpos-collapse__caret { transform: rotate(90deg); }
[dir='rtl'] .cpos-collapse__caret { transform: rotate(180deg); }
[dir='rtl'] .cpos-collapse--open .cpos-collapse__caret { transform: rotate(90deg); }
.cpos-collapse__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cpos-collapse__title { font-size: 14px; font-weight: 650; }
.cpos-collapse__sub {
  font-size: 11.5px;
  color: var(--cpos-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cpos-collapse__body {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--cpos-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cpos-collapse__grouplabel {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--cpos-fg-muted);
  margin-top: 6px;
}

/* ------------------------------------------------------------ version */
/* The build number, at the foot of the screens where somebody who has been
   asked "which version is that till on?" would go looking for it. Deliberately
   quiet: it is an answer to a support question, not a setting. */
.cpos-version {
  margin-top: 20px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--cpos-fg-subtle);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 860px) {
  .cpos-settings__grid { grid-template-columns: minmax(0, 1fr); }
  .cpos-jump { position: static; flex-direction: row; overflow-x: auto; }
  .cpos-jump__item { flex: 0 0 auto; }
}

/* A segmented control, for switching panels inside one screen. */
.cpos-segmented {
  display: inline-flex;
  gap: 3px;
  max-width: 100%;
  margin-bottom: 18px;
  padding: 4px;
  border: 1px solid var(--cpos-border);
  border-radius: var(--cpos-r-md);
  background: var(--cpos-surface-2);
  overflow-x: auto;
  scrollbar-width: none;
}
.cpos-segmented::-webkit-scrollbar { display: none; }
.cpos-segmented__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--cpos-r-sm);
  background: transparent;
  color: var(--cpos-fg-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 620;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--cpos-dur-fast) ease, color var(--cpos-dur-fast) ease,
    box-shadow var(--cpos-dur-fast) ease;
}
.cpos-segmented__btn:hover { color: var(--cpos-fg); }
.cpos-segmented__btn:focus-visible { outline: none; box-shadow: var(--cpos-ring); }
.cpos-segmented__btn--on {
  background: var(--cpos-surface);
  color: var(--cpos-fg);
  box-shadow: var(--cpos-sh-sm);
}
.cpos-segmented__icon { display: inline-flex; opacity: 0.8; }

.cpos-fadein { animation: cpos-fade-up var(--cpos-dur) var(--cpos-ease-out) both; }

/* ============================================================ motion */
@keyframes cpos-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cpos-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes cpos-line-in { from { opacity: 0; transform: translateY(-5px) scale(0.99); } to { opacity: 1; transform: none; } }
@keyframes cpos-slide-in-start { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes cpos-strip-in { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: none; } }
@keyframes cpos-modal-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes cpos-pop {
  0% { opacity: 0; transform: scale(0.6); }
  60% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes cpos-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes cpos-spin { to { transform: rotate(360deg); } }
@keyframes cpos-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* caspian-pulse is referenced by every <Skeleton> in the library and has never
   been defined, so skeletons rendered as static grey blocks. Defining it here
   fixes the register; the storefront picks it up too if the consumer imports
   styles.css, which is where the matching copy lives. */
@keyframes caspian-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

.cpos-skeleton {
  border-radius: var(--cpos-r-sm);
  background: linear-gradient(90deg, var(--cpos-surface-3) 25%, var(--cpos-surface-2) 37%, var(--cpos-surface-3) 63%);
  background-size: 200% 100%;
  animation: cpos-shimmer 1.4s linear infinite;
}

.cpos-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--cpos-r-full);
  animation: cpos-spin 640ms linear infinite;
  flex-shrink: 0;
}

/* The RTL locales flip the drawer, so its slide-in has to flip with them. */
[dir='rtl'] .cpos-sidebar--drawer { animation-name: cpos-slide-in-end; }
@keyframes cpos-slide-in-end { from { transform: translateX(100%); } to { transform: translateX(0); } }

/* ============================================================ responsive */
/* A till is a counter monitor, a tablet on a stand, or a phone in a market --
   the manifest deliberately leaves orientation unpinned. Below the width where
   two panes stop being readable the register stacks, and the totals ride along
   as a sticky footer so the amount owed never scrolls off the bottom. */
@media (max-width: 1180px) {
  .cpos-register {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: min-content;
    height: auto;
    min-height: 100%;
    padding: 14px;
    gap: 14px;
  }
  .cpos-register__pane { max-height: none; }
  .cpos-lines { max-height: 46vh; }
  .cpos-totals { position: sticky; bottom: 0; z-index: 5; box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08); }
}

@media (max-width: 560px) {
  .cpos-searchbox { display: none; }
}

@media (max-width: 640px) {
  .cpos-page { padding: 14px; }
  .cpos-card--pad { padding: 15px; }
  .cpos-topbar { padding-inline: 10px; gap: 6px; }
  .cpos-topbar__title { display: none; }
  .cpos-searchbox { max-width: none; }
  .cpos-done__total { font-size: 33px; }
  .cpos-done__actions { flex-direction: column-reverse; }
  .cpos-totals__actions { flex-direction: column; }
  .cpos-tiles { grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); }
}

/* Coarse pointers get the full touch target on the controls that are allowed to
   shrink on a mouse-driven counter monitor. */
@media (pointer: coarse) {
  .cpos-stepper__btn { width: var(--cpos-touch); height: var(--cpos-touch); }
  .cpos-line__tools .cpos-iconbtn { width: var(--cpos-touch); height: var(--cpos-touch); }
  .cpos-btn--sm { min-height: 40px; }
}

/* ============================================================ a11y */
@media (prefers-reduced-motion: reduce) {
  .cpos-shell *,
  .cpos-scrim,
  .cpos-modal,
  .cpos-modal__panel,
  .cpos-sidebar--drawer {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .cpos-tile:hover { transform: none; }
  .cpos-stat:hover { transform: none; }
}

@media (prefers-contrast: more) {
  :root { --cpos-border: #94a3b8; --cpos-fg-muted: #334155; }
  .cpos-navitem--active { outline: 2px solid #fff; outline-offset: -2px; }
}

/* The shared <Button> primitive already carries caspian-btn on every instance
   but nothing has ever defined it, so ~25 transition: declarations across the
   library never fired. Activating it inside the register costs nothing and is
   scoped so the storefront and admin panel keep their current behaviour. */
.cpos-shell .caspian-btn { transition: filter var(--cpos-dur-fast) ease, box-shadow var(--cpos-dur-fast) ease, transform var(--cpos-dur-fast) ease; }
.cpos-shell .caspian-btn:hover:not(:disabled) { filter: brightness(0.94); }
.cpos-shell .caspian-btn:active:not(:disabled) { transform: translateY(1px); }
.cpos-shell .caspian-btn:focus-visible { outline: none; box-shadow: var(--cpos-ring); }

.cpos-shell :focus-visible { outline-color: var(--cpos-brand); }

/* Anything that only exists for a screen reader. */
.cpos-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Portalled surfaces sit outside .cpos-shell, so anything the register opens
   through DropdownMenu or Dialog needs classes that stand on their own. */
.cpos-menucard { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; }
.cpos-menucard__name { font-size: 13.5px; font-weight: 650; color: var(--cpos-fg); }
.cpos-menucard__mail { font-size: 11.5px; color: var(--cpos-fg-muted); }

@media print {
  .cpos-sidebar, .cpos-topbar, .cpos-strip, .cpos-scrim { display: none !important; }
}
`;
