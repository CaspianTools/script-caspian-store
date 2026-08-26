# DESIGN.md — the register's design system

What the standalone till is built out of. [CLAUDE.md](CLAUDE.md) says which
*cycle* a change follows and where the standalone boundary runs; this file says
which *button* to reach for once you are inside it.

It is not a manual. [../docs/pos-manual.html](../docs/pos-manual.html) tells a
shop owner what a screen does; this tells whoever builds the next screen what to
build it from. Like `CLAUDE.md`, `pos/` is not in the library's
`package.json#files`, so nothing here ships to anybody.

**Why it exists.** The till spent its first thirteen releases with two looks. The
counter screens were built from the register's own classes; every back-office
screen and every popup instead imported the library's shared web controls plus an
inline style module, so a cashier moving from the register to the Store screen
changed design system — different heights, different corners, a dropdown that
stayed light grey in dark mode. That happened because the first look was never
written down: a session adding a screen had no page telling it which button to
reach for, so it reached for the one it could see in the library's `src/ui/`.
v1.4.0 swept the second look away and wrote this file so the sweep is the last
one. Since v14.0.0 the till is a separate app and most of that set is not even
importable, but the discipline still has to be written down: the few library
controls that *are* imported are listed in rule 1 below, and the list is closed.

**Standing rule.** Any change that adds, removes or alters a control, a token or
a layout primitive updates this file in the same change. That is the same posture
the repo already takes with the manuals — and, as with the manuals' prose,
**nothing enforces it in CI**. `check-manuals.mjs` guards the manuals' shape;
there is no equivalent here. The only guard is the person making the change.

---

## 1. Where the design lives

One file: [src/pos/theme/pos-stylesheet.ts](src/pos/theme/pos-stylesheet.ts),
a `String.raw` template exported as `POS_STYLESHEET` and rendered into the tree
by `PosStyleScope`. Four facts about that arrangement, each load-bearing:

1. **It is a string, not a `.css` file, and it must not move into
   `src/styles/globals.css`.** That file ships as a passthrough the consumer
   imports once at their app root. Every other component in the library is
   inline-styled, so a consumer who never added that import still gets a working
   storefront. Moving the register onto classes in that file would have made the
   import load-bearing, and a shop upgrading would have opened the till to
   unstyled HTML. Releases must never require a consumer hand-edit.
2. **`PosStyleScope` dedupes through React context, not a module-level flag.**
   `PosGuard` and `PosShell` are both public exports and either can be mounted
   alone, so both carry the scope; the normal arrangement nests them. A module
   flag would leak between requests on a shared server.
3. **Tokens live on `:root`, under a `--cpos-` prefix used by nothing outside
   `src/pos/`.** They are at the document root rather than on `.cpos-shell`
   because `DropdownMenu`, `Dialog` and the toast stack all portal into
   `document.body` — a token scoped to the shell would leave every portalled
   surface reading a different palette from the screen that opened it.
4. **Brand hues are derived, never restated.** `--cpos-brand` is whatever
   `--caspian-primary` resolves to; the tint, line, hover and glow are
   `color-mix()`ed off it behind an `@supports` fallback. Theming the store red
   themes the till red. The chrome this replaced hardcoded
   `rgba(26,115,232,0.25)` — the RGB of the default blue — in four places, and
   those glows stayed blue on every other theme.

Dark mode is `:root[data-cpos-theme="dark"]`, written by `PosChromeProvider`. It
is a **device** preference (`pos-preferences.ts`), beside the scanner gap, for
the same reason: one counter faces a window and another is in a stockroom, and
the shop has no opinion about either.

---

## 2. The tokens

Every colour, radius, shadow and duration in the till comes from this table.
A component that writes a hex value or an `rgba()` is a bug.

### Brand — derived from the store's theme

| Token | For | Light | Dark |
| --- | --- | --- | --- |
| `--cpos-brand` | primary buttons, active nav, focus borders | `--caspian-primary` | same |
| `--cpos-brand-fg` | text on `--cpos-brand` | `--caspian-primary-foreground` | same |
| `--cpos-accent` | reserved; falls back to brand | `--caspian-accent` | same |
| `--cpos-brand-soft` | tinted panels, `--brand` badges and notes | mix 10% on white | mix 22% on surface |
| `--cpos-brand-soft-fg` | text on `--cpos-brand-soft` | mix 78% on black | mix 42% on white |
| `--cpos-brand-line` | borders on tinted panels | mix 28% on white | mix 40% on surface |
| `--cpos-brand-glow` | button and mark shadows, the focus ring | mix 28% on transparent | same |
| `--cpos-brand-hover` | primary button hover | mix 86% on black | mix 82% on white |

### Surfaces and text

| Token | For | Light | Dark |
| --- | --- | --- | --- |
| `--cpos-bg` | the shell behind everything | `#f6f7f9` | `#0b1020` |
| `--cpos-surface` | cards, sections, inputs, modal panels | `#ffffff` | `#131a2c` |
| `--cpos-surface-2` | table row hover, search box rest state | `#f8fafc` | `#1a2337` |
| `--cpos-surface-3` | ghost button hover, icon button hover | `#f1f5f9` | `#222c43` |
| `--cpos-fg` | body text, headings | `#0f172a` | `#eef2f8` |
| `--cpos-fg-muted` | secondary text, `.cpos-muted`, help text | `#64748b` | `#93a1b8` |
| `--cpos-fg-subtle` | placeholders, hints, disabled glyphs | `#94a3b8` | `#6b7a92` |
| `--cpos-border` | default 1px borders | `#e6e9ee` | `#253048` |
| `--cpos-border-strong` | input hover, outline buttons, scrollbar thumb | `#cbd5e1` | `#33415c` |

### Sidebar — its own palette, dark in both themes

`--cpos-sidebar-bg`, `-fg`, `-fg-dim`, `-line`, `-hover`. The nav is a dark
column whichever theme the till is on; it is chrome, not content.

### Status — three tones, each with a `-soft` fill and a `-line` border

`--cpos-success` / `-soft` / `-line`, `--cpos-warning` / `-soft` / `-line`,
`--cpos-danger` / `-soft` / `-line`. Used by `.cpos-note`, `.cpos-badge`,
`.cpos-btn--danger` and `.cpos-btn--success`. In dark mode the base colour gets
*lighter* and the soft fill gets darker — do not assume the pair inverts.

### Shape, depth and motion

| Token | Value | Reach for it |
| --- | --- | --- |
| `--cpos-r-xs` … `--cpos-r-full` | 6 / 8 / 12 / 16 / 22 / 999px | `xs` chips · `sm` small buttons, textarea · `md` buttons, inputs, selects · `lg` sections, big buttons · `xl` cards, modal panels · `full` pills, avatars |
| `--cpos-sh-xs` … `--cpos-sh-xl` | five steps | `xs` sections · `sm` cards · `md` hover lift · `lg` gate panels · `xl` modal panels |
| `--cpos-ring` | `0 0 0 3px var(--cpos-brand-glow)` | **every** `:focus-visible`. Never `outline: none` without it. |
| `--cpos-dur-fast` / `-dur` / `-dur-slow` | 120 / 200 / 320ms | control states · layout · entrances |
| `--cpos-ease` / `-ease-out` | two cubic-beziers | movement · entrances |

### `--cpos-touch: 44px`

The floor every interactive control in the register is built to, because a
cashier taps this screen with a finger and often a gloved one. Nothing is
smaller. The two documented exceptions are `.cpos-btn--sm` (36px, and it is
raised back to 40px under `@media (pointer: coarse)`) and the 26px clear button
that sits *inside* the search box, which is a shortcut for something you can also
do by selecting the text.

`--cpos-sidebar-w` 248px, `--cpos-sidebar-w-rail` 72px, `--cpos-topbar-h` 60px
size the shell. `--cpos-font` follows `--caspian-font-family`.

---

## 3. The controls

### Buttons — `.cpos-btn`

`<button type="button" className="cpos-btn cpos-btn--primary">`. The base rule
gives the 44px floor, `--cpos-r-md`, 14px/600 text, an `:active` 1px press,
`--cpos-ring` on `:focus-visible`, and `opacity: .5` when disabled.

| Variant | Looks like | Use for |
| --- | --- | --- |
| `--primary` | brand fill, brand glow | the one action the screen exists for |
| `--outline` | surface fill, strong border | everything alongside it |
| `--ghost` | transparent, muted text | row actions, back links, tertiary |
| `--danger` | danger fill, white text | delete, and only delete |
| `--success` | success fill, white text | confirm-and-finish at the counter |

| Size | Height | Use for |
| --- | --- | --- |
| *(none)* | 44px | the default everywhere |
| `--sm` | 36px (40px on touch) | inside a table row or a dense toolbar |
| `--lg` | 56px | a gate screen's single action |
| `--block` | full width | stacked in a narrow panel |
| `--pay` | 64px, two lines | the register's money button only |

Icons go inside as siblings of the label; the base rule already sets `gap: 8px`.

**`.cpos-iconbtn`** — a 40px square for an icon with no label. Needs an
`aria-label`. `--bordered` gives it a border and surface fill; `--onbrand`
recolours it for the sidebar.

### Text — `.cpos-input`

`<input className="cpos-input">`. Full width, 44px floor, `--cpos-r-md`,
`--cpos-surface` fill, `--cpos-fg` text, `--cpos-fg-subtle` placeholder, brand
border plus `--cpos-ring` on focus. `type="search"`, `type="number"` and
`readOnly` all use the same class.

**`.cpos-textarea`** — `.cpos-input` metrics with `min-height: 88px`,
`resize: vertical` and comfortable line height. Never inline-style a `<textarea>`.

**`.cpos-select`** — `.cpos-input` metrics with the native arrow removed and a
chevron drawn as a `background-image`, so it needs no wrapper element. Its
padding is logical (`padding-inline-end`), so the chevron flips under
`[dir="rtl"]`. Reach for `PosSelect` rather than the raw class when you have an
options array.

**`.cpos-searchbox`** — wraps a `.cpos-input` with a leading icon and a trailing
clear button.

### Choosing

| Class | Shape | Use for |
| --- | --- | --- |
| `.cpos-switch` | 44×26 track and knob | one setting, on or off, written on the flip |
| `.cpos-switchrow` | title + description + switch | a switch inside a settings list |
| `.cpos-radio` | bordered row, `--on` when picked | one of a short set, all visible |
| `.cpos-check` | bordered row with a checkbox | any of a short set, all visible |
| `.cpos-choice` / `.cpos-choices` | pill row, `--on` when picked | 2–4 icon-and-label options, e.g. the theme picker |
| `.cpos-stepper` | −/value/+ | a quantity at the counter |

**The register has its own switch, and [`<Switch>`](../../src/ui/switch.tsx) is not
it.** `.cpos-switch` — rendered by
[pos-switch.tsx](src/pos/standalone/admin/pos-switch.tsx) — is built to the
44px floor and resolves through the `--cpos-*` tokens. The library's `<Switch>`
is 38×22 and hardcodes `rgba(0,0,0,0.22)` and `#fff`, so on a till in dark mode
it is near-black on near-black. It stays correct on the always-light admin and
storefront surfaces that use it; the two surfaces have different floors, so do
not "fix" it by widening its colours, and do not import it here.

### Fields

```
.cpos-field                 column, 6px gap
  .cpos-field__label        12.5px / 650
  <control>
  <FieldDescription>        muted help text, optional
```

`PosField` renders exactly that. `.cpos-field__control` wraps a control that
carries an adornment (the password reveal button).

**A group of related boxes is one field, not several.** Where one label covers a
run of controls whose number is not known until render — the per-size stock
counts on the item form — use `PosField asDiv` around a `.cpos-row` of nested
`PosField`s, and put the group's help text inside it. `asDiv` exists for exactly
this: a `<label>` wrapping several controls sends every click to the first one.
It needs no new class — `.cpos-field` is a column with a gap, so it nests.

---

## 4. The layout primitives

| Class | What it is |
| --- | --- |
| `.cpos-page` | every screen's outer div — 22px padding, 1080px max, centred. `--wide` removes the cap |
| `.cpos-pagehead` | the icon + title + subtitle block at the top of a screen |
| `.cpos-section` | the standard white card: column, 14px gap, 18px padding, `--cpos-r-lg` |
| `.cpos-section__title` | its 15px/700 heading |
| `.cpos-row` | a horizontal run of fields, wrapping, bottom-aligned |
| `.cpos-actions` | a right-aligned, wrapping row of buttons |
| `.cpos-form` | a `<form>` that has to be one element so a foot button can point at it with `form=`; gives its fields the body's own 14px rhythm |
| `.cpos-rowlink` | the first cell of a table row, as the way into that record's page |
| `.cpos-muted` | 12px secondary text |
| `.cpos-divider` | a 1px rule |
| `.cpos-stats` / `.cpos-stat` | auto-fit grid of figure tiles — `__label` (uppercase), `__value` (23px, tabular), `__hint` |
| `.cpos-tablewrap` / `.cpos-table` | the till's only table. `.cpos-table__num` right-aligns and tabularises a numeric column |
| `.cpos-empty` | the "nothing here yet" block — `__icon`, `__title`, `__text` |
| `.cpos-note` | a boxed message. Tones: `--brand`, `--success`, `--warning`, `--danger` |
| `.cpos-badge` | an inline pill. Same four tones plus a neutral default |
| `.cpos-strip` | a full-width banner under the top bar |
| `.cpos-card` / `.cpos-cardhead` | a framed surface with a head; the register's two panes |
| `.cpos-settings__grid` + `.cpos-jump` | the sidebar-and-body layout used by Settings and App admin; `.cpos-jump__item--on` marks the current section |
| `.cpos-segmented` | the second-level tab strip across the Store screens |
| `.cpos-collapse` | a disclosure row with a caret, a summary and a body |
| `.cpos-modal` | see below |
| `.cpos-fadein` | a one-frame entrance; key it on the section id so switching sections animates |
| `.cpos-version` | the version line at the foot of a settings body |

### Modals — `.cpos-modal`

```
.cpos-modal                       fixed, scrim, blur, centres its panel
  .cpos-modal__panel--framed      480px default, 92dvh cap, xl radius + shadow
    .cpos-modal__head             title + close button
    .cpos-modal__body             scrolls; min-height: 0; 14px column rhythm
    .cpos-modal__foot             right-aligned actions, top border
```

Width modifiers on the panel: `--md` 600px (a short form), `--lg` 760px (a long
one), `--split` 960px (Quick Add's two panes). The unmodified 480px is the tender
dialog's, and stays. `--framed` is what drops the panel's own padding so the
head, body and foot can own theirs; `--flush` on the body drops its padding in
turn, for a child that draws its own panes.

The body scrolls, not the panel. A Save button that scrolls off the bottom of a
modal is a Save button a cashier cannot find, and `min-height: 0` is what lets
the body shrink inside the flex column rather than pushing the panel past its
`92dvh` cap.

Reach for `PosDialog`, never the raw markup — it owns Escape, the backdrop click,
the body scroll lock and focus return.

**A submit button in the foot reaches its form by `form=`.** The foot is outside
the `<form>`, so the button carries `type="submit" form={formId}` and the form
carries the matching `id`. Native HTML, no ref to thread, and the button stays
pinned while the fields scroll under it.

---

## 5. Page anatomy

Every screen in the till is one of three shapes. Copy the skeleton; do not invent
a fourth.

### A list page

Canonical example:
[local-store-panel.tsx](src/pos/standalone/admin/local-store-panel.tsx).

```jsx
<div className="cpos-page">
  <div className="cpos-pagehead">…icon, h1, sub…</div>
  <StoreScreenNav current="products" />

  <section className="cpos-section">
    <div className="cpos-row" style={{ alignItems: 'center' }}>
      <span className="cpos-section__title">{count}</span>
      <div style={{ marginInlineStart: 'auto' }}>…search, filter, Add…</div>
    </div>

    {loadFailed ? <PanelLoadError … />
      : rows === null ? <div className="cpos-muted">…loading…</div>
      : rows.length === 0 ? <div className="cpos-empty">…</div>
      : <div className="cpos-tablewrap"><table className="cpos-table">…</table></div>}
  </section>
</div>
```

Four states, always all four: **failed**, **loading**, **empty**, **rows**. A
panel that handles only the last two is how a blocked IndexedDB became a spinner
that never stopped — indistinguishable, at the counter, from the shop's records
having been erased.

The first cell of each row is a `<button className="cpos-rowlink">` that opens the
record. A link, not a row click: a row that navigates also swallows the Delete
button sitting inside it. A `<button>` rather than an `<a>` because the register
navigates through its adapter.

### A record page

Canonical examples:
[local-product-page.tsx](src/pos/standalone/admin/local-product-page.tsx),
[local-category-page.tsx](src/pos/standalone/admin/local-category-page.tsx),
[local-supplier-page.tsx](src/pos/standalone/admin/local-supplier-page.tsx).

```jsx
<div className="cpos-page">
  <div className="cpos-pagehead">…name, and the codes under it…</div>
  <StoreScreenNav current="…" />

  <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
    <button className="cpos-btn cpos-btn--ghost">← back to the list</button>
    …edit, and the verbs this record has…
  </div>

  <section className="cpos-section">
    <h2 className="cpos-section__title">Figures</h2>
    <div className="cpos-stats">…</div>
  </section>

  …one section per table…
</div>
```

The back button **pushes the list**, never `back()`. The register's navigation
adapter keeps a route stack and the way in is often not the list — arriving from
Receive stock, or from a reload — so `back()` would send somebody to the delivery
they had just posted.

### A form dialog

Canonical example:
[local-product-form-dialog.tsx](src/pos/standalone/admin/local-product-form-dialog.tsx)
— a thin shell over `LocalProductForm`, which Quick Add renders too.

```jsx
<PosDialog open={open} onOpenChange={…} title={…} size="lg"
  foot={<>
    <button type="button" className="cpos-btn cpos-btn--outline">Cancel</button>
    <button type="submit" form={formId} className="cpos-btn cpos-btn--primary">Save</button>
  </>}>
  <form id={formId} className="cpos-form" onSubmit={…}>
    <div className="cpos-row">
      <PosField label="Name" style={{ flex: '2 1 180px' }}>
        <input className="cpos-input" … />
      </PosField>
      …
    </div>
  </form>
</PosDialog>
```

`PosDialog` renders nothing while closed, so the form unmounts and its state
resets on its own. A form whose state lives in the *dialog shell* instead needs
an effect to clear it on open — which is what the product form used to have, and
why it is now the form that owns the draft.

**A form body is a component, and the dialog is a shell over it.** Creating goes
through Quick Add and editing goes through the record's own dialog; both render
the same form, so validation lives in one place. Two copies of a price parser is
how two screens end up disagreeing about what `12,50` means.

---

## 6. The rules

1. **The till does not draw with the library's controls.** Not `Button`,
   `Input`, `Select`, `Dialog`, `Table` or `Switch`, even though the barrel
   exports every one of them. Use `.cpos-btn`, `.cpos-input`, `PosSelect`,
   `PosDialog`, `.cpos-table` and `.cpos-switch`. Three exceptions, because all
   three already resolve through `--cpos-*` tokens and so are already correct in
   dark mode: `useToast` (a provider, not a control), `FieldDescription`, and
   `DropdownMenu`. Icons are the fourth thing that came across, and they came as
   a copy — [src/icons.tsx](src/icons.tsx), not an import.
2. **No inline `style` for anything a class covers.** Inline stays for genuinely
   one-off values — a `flex` basis on one field, a `maxWidth` on one search box,
   `marginInlineStart: 'auto'` to push a toolbar right. If you write the same
   inline object twice, it wanted a class.
3. **Every interactive target clears `--cpos-touch`.** If it cannot, it is a
   shortcut for something reachable another way, and the comment beside it says so.
4. **Every colour comes from a token.** No hex, no `rgba()`, in a component.
5. **`:focus-visible` always gets `--cpos-ring`.** Removing an outline without
   replacing it makes the till unusable from a keyboard, which is how a barcode
   scanner drives it.
6. **Check both themes before calling a screen done.** Dark is where borrowed
   controls fail, and it is one click away in the top bar.
7. **New rules go in `pos-stylesheet.ts`, never `globals.css`** (§1), and — while
   the change is a standalone one — never as a rule a cloud-rendered component
   could match. Editing an existing rule a cloud screen carries is a library
   change; adding a class only standalone screens wear is not. See the boundary
   table in [CLAUDE.md](CLAUDE.md).
8. **Absent, not disabled.** A control a role cannot use, or a screen the shop
   has switched off, is not rendered. A disabled tab is a promise of a screen
   that is never coming. The exception is a deliberate gap the manual also
   documents — the read-only storage radios, the parked printer transports —
   where a disabled control shown with its explanation is the honest answer.
9. **No emoji.** Icons come from [`src/icons.tsx`](src/icons.tsx) — the till's
   own copy of the 37 it draws with, not the library's set.

---

## 7. Adding a control

1. **Read §3 and §4 first.** Most "new" controls are an existing one with a
   modifier.
2. If nothing fits, add the rule to `pos-stylesheet.ts`, beside its nearest
   relative, with a comment saying *why* — the sheet's existing comments are the
   model.
3. **Document it here in the same change**, and name the screen it was added for.
4. If it needs a component (state, focus management, an options array), put it in
   [`src/pos/standalone/ui/`](src/pos/standalone/ui/) beside `PosDialog`,
   `PosField`, `PosSelect` and `PosCheck`. Two files is the current size of that
   directory and it should stay small: the till's idiom is *classes on plain
   elements*, and a wrapper earns its place only by owning behaviour, never by
   owning a `className`. `PosSelect` is the borderline case that was allowed —
   it exists because eight call sites hand it an options array, and mapping that
   to `<option>` elements at each of them is eight chances to forget the `key`.
