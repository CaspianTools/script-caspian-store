# Changelog — the standalone till

Release history for the standalone register, the product built from this folder
and served from `apps/pos/dist`. It versions and ships on its own; the library's
history is in [../../CHANGELOG.md](../../CHANGELOG.md) and the two numbers have
nothing to say to each other.

<!--
Every entry MUST include exactly one of these two headings:

  ### Nothing to do on a till
  (followed by a one-line explanation — normally that the update strip in the
  register's own header picks it up between customers)

  ### Action needed on each till
  (followed by the exact per-device steps, in the order a shop should do them,
  and said plainly enough that a cashier can follow them)

This is the till's version of the root changelog's "consumer action" heading,
and it asks the till's question rather than npm's. A shop running the standalone
register never installs anything from GitHub, so an install command here would
be false. What a shop wants to know is whether somebody has to walk to each
counter.
-->

## v1.7.0 — Quick add asks one question at a time

Quick add used to open as two panes: a narrow column of four words down the left
and the form for whichever one was highlighted on the right. The column was wide
enough for "Category" and not for the sentence saying what a category is for, so
the sentence was banished to the dialog's subtitle, where it described only the
entry that happened to be selected. It also opened already on a form nobody had
picked.

It is now two steps. The window opens on a full-width list — icon, name and the
line saying what the thing is — and pressing a row turns the window into that
record's form, with a back arrow at the top left to return to the list.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers.
Same records, same forms, same data; a different way in.

### Changed

- Quick add opens on the list of what this till can make, rather than on the
  first form the signed-in role happens to have access to.
- Each row carries its own icon tile, its name and its description. All four
  descriptions are visible at once instead of one at a time.
- Choosing a record replaces the list with its form. The dialog's title names
  what is being made — "New product" — and a back arrow at the top left returns
  to the list without closing the window.
- An Add button pressed on the Store, Categories, Suppliers or People screen
  still lands straight on that record's form. The back arrow is there too, so
  those buttons are now also a way into the other forms.
- The search box keeps the arrow keys, and Enter now opens the row they have
  reached instead of only highlighting it.
- The dialog no longer becomes a horizontal strip of chips on a narrow till. A
  column of rows is what a narrow till wanted in the first place.
- A modal's close button now sits at the end of its header instead of hugging
  the title. The rule that was meant to push it there had been aimed at the
  heading rather than the block the heading moved inside, and had done nothing
  for some time.

## v1.6.1 — A folder of its own

Nothing at the counter changed. The till's source moved out of the library it
was stored in and into `apps/pos/`, where the rest of the app already lived, so
the register is now one directory rather than two halves of one.

### Nothing to do on a till

An installed till is unaffected: same screens, same data, same IndexedDB, same
service worker. This is where the code lives, not what it does.

### Changed

- The register's 116 source files moved from the library's `src/pos/` to
  `apps/pos/src/pos/`. Every screen, every gate and every store is unchanged.
- Every `pos.*` string — English plus the `az`, `ru` and `tr` overlays — moved to
  `src/i18n/` and reaches the provider through `messagesByLocale`. Each overlay
  is composed onto English there, so an untranslated key still renders in English
  rather than as a raw identifier.
- The 37 icons the register draws with are a copy in `src/icons.tsx` rather than
  an import from the library's `src/ui/`. DESIGN.md's rule was always that the
  till does not reach for the store's controls; these were the last symbols
  holding the two together.
- `main.tsx` mounts `<PosApp>` — the nesting that used to live inside the
  library's `CaspianRoot` — instead of `<CaspianRoot>`. There is no storefront
  behind this document to switch off, so `posOnly` went with it.
- `npm run check` builds `src/check-entry.ts` and runs the behaviour guard
  against it. It used to run against the library's `dist/`. All 166 checks are
  unchanged.
- `CLAUDE.md` is now the only source of truth for the till: the design system,
  the storage seam, the roles, the money arithmetic and the release cycle all
  moved here from the root file, and the six-file boundary table is gone. The
  directory is the boundary.
- The cloud-backed register came along dormant, in `src/cloud-admin/` and the
  cloud halves of `src/pos/storage/`, `offline/` and `license/`. It type-checks
  and nothing mounts it.
## v1.6.0 — Stock you can type a number into

Putting stock on an item did not work, and there was nothing on screen to say so.

The In stock box wanted a private syntax — `size:count`, semicolon-separated —
and threw away anything that did not match it. A shop that typed `12`, which is
what the box looks like it wants, saved an item with no stock at all. Worse, an
item with no sizes showed `_default:12` as its value when you opened it to edit,
so correcting a shelf figure to `13` wiped the twelve that were there. Neither
failure said anything: no message, no warning, just a Stock column reading 0.

It is boxes with numbers in them now.

### Changed

- **The In stock field is a number box.** An item with no sizes gets one box. An
  item with sizes gets one box per size, plus a **No size** box.
- **The No size box is the one the counter uses, and it now says so.** The
  register never asks a cashier which size, so a sale of an item with several
  sizes comes off the general count rather than off S, M or L. The old field
  offered no way to put stock there, so an item with three sizes could be fully
  stocked on paper and go negative on its first sale. The per-size counts are for
  your own records until the counter learns to ask.
- **A count that is not a whole number is refused**, with a message, instead of
  being dropped on the floor.
- **A size you have since removed keeps its box** while it still holds stock, so
  a renamed size cannot leave a count that is both invisible and non-zero. Set it
  to 0 to clear it.
- **A spreadsheet import accepts a plain count** in the `stock` column as well as
  the per-size form, and the template now shows the plain one.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers. No
data moves and no setting changes. Stock already recorded is read and shown
exactly as before — it is only the way you type it that changed.

Worth knowing afterwards: any item a shop *thought* it had stocked through the
old box has a count of 0, because nothing was ever saved. Those are worth a look
on the Store screen.

## v1.5.0 — Scanners that used to do nothing, and a way to see why

A shop plugged a scanner in, put a barcode on a product, scanned it — and the
till did nothing at all. No number on screen, no message, no line on the sale.

There were four separate reasons that all looked like that, and the till gave a
shop no way to tell them apart. Three of them are now fixed outright, and the
fourth — a scanner that is not talking to the computer at all, which is not the
till's fault and never was — now says so on screen instead of looking like a dead
register.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers. No
data moves and no setting changes.

If your scanner *still* does nothing after the update, that is what the new test
under **Settings → Scanner** is for: press **Test scanner**, scan anything, and it
will name the fault and — where the answer is a number — offer a button that
writes it for you.

### Fixed

- **A scanner that sends no Enter now works.** Plenty of scanners leave the
  factory with that suffix switched off. The till only ever finished a scan on
  Enter or Tab, so those filled its buffer with nothing to empty it and the
  screen never moved. A code now completes on the short pause after the last
  character as well. A scanner set to send Enter is still quicker and cannot be
  split in two, so the manual says to switch it on where you can.
- **A scanner slower than the speed setting no longer loses whole scans.** That
  part is unchanged — a slow scanner still needs the right number — but the
  number is now measured rather than guessed at, and the till offers it.
- **Scanners that hold AltGr are no longer thrown away.** Windows reports AltGr
  as Ctrl+Alt, and the till dropped any keystroke with a modifier held. On an
  Azerbaijani, Turkish or Russian keyboard layout that silently lost the whole
  scan.
- **A held-down key can no longer be read as a barcode.** Key repeat arrives fast
  enough to look exactly like a scanner, so it now clears the buffer instead.

### Added

- **Test the scanner**, under **Settings → Scanner**. Press it, scan anything, and
  it reports what actually reached this till: the code, its length, the slowest
  gap between two characters against your speed setting, whether the scanner
  pressed Enter at the end, whether it held any modifier keys, and whether that
  code is on one of your products. When the speed setting is wrong it offers a
  button that sets it. When nothing arrived at all it says so plainly, and points
  at the scanner rather than at the till.
- **The register shows a scan as it arrives.** Nothing is focused on the sale
  screen at rest, so a scanner's characters used to land nowhere you could see
  them. A line now reads *Reading… 590123* while the code comes in.

### Changed

- The **Scanner speed** help text no longer suggests guessing. It points at the
  test.

## v1.4.0 — One look, one way to add things, and a page behind every record

The till has looked like two products since it was built. The screens a cashier
uses at the counter were made of the register's own controls; every back-office
screen and every popup borrowed the storefront library's instead — 40px where the
counter uses 44, a different corner radius, a dropdown that stayed light grey in
dark mode, and a popup that arrived as a white sheet on a dark till. That is
fixed everywhere, and the reason it happened is fixed too: the register's design
system is now written down, in `pos/DESIGN.md`, so the next screen has something
to be built against.

Two other things follow from the same idea. Adding a thing used to look different
depending on where you started — a product from the top bar, from the Store
toolbar, from the product page or from a delivery; a category from a row wedged
into a table; a supplier from a dialog on its list. There is one dialog now, and
every Add button on every screen opens it. And categories and suppliers were rows
that could not be opened; both are records with their own page, alongside the one
products have had since v1.1.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers.
No data moves, no account is touched, and nothing that worked before has been
taken away — the buttons are in the same places, they just look like the rest of
the till now.

### Added

- **Quick add**, one dialog for everything the till creates. What you can make is
  a searchable list down the left, the form for the one you picked is on the
  right, and it stays open after a save so a delivery entered by hand does not
  cost six extra clicks. Products, categories, suppliers and people. Arrow keys
  move the list; Enter picks.
- **A page for every category.** Open one from the Categories list to see what is
  filed under it, what that stock is worth, and what it sold over Today, 7 days,
  30 days or all time — with the products in it listed by what each one sold, and
  each name a link through to its own page. Renaming and deleting live here now.
- **A page for every supplier.** Deliveries, what they have cost, when the last
  one arrived, what is still on the shelf out of their batches, and what has sold
  out of them. Editing, disabling and deleting moved here from the list, so
  nobody removes a supplier without first seeing what they have delivered.
- **Sales on the product page.** Units, revenue, gross profit, the average price
  actually charged, when it last sold, and the receipts it appeared on — over the
  same period picker the other two pages use. This sits beside the stock figures
  rather than inside them, because they answer different questions: the stock
  ledger counts what left the shelf, and this counts what was paid for it.
- **Settings shows one section at a time**, the way App admin already did. The
  address carries the section, so a reload and a bookmark both land where you
  were. Each section that has fields to fill in has its own Save.
- **`pos/DESIGN.md`** — every token, control and layout the register is made of,
  the three page shapes to copy, and the rules. Not a manual; it is for whoever
  builds the next screen.

### Changed

- **One set of controls across the whole till.** Every button, box, dropdown,
  text area, checkbox, table and popup on every back-office screen is now the
  register's own — correct in dark mode, at the 44px touch floor, and following
  the shop's colour. The old inline style module twelve panels shared is gone.
- **A supplier page says what it cannot know.** A sale records the product and
  never the delivery it came off, so stock is only traceable back to a supplier
  for items received in batches. Where that link exists the figures are exact;
  where it does not, the page says so in words rather than showing a zero that
  would read as "sold nothing". Those figures are reported at cost, not at
  revenue, because the cost is on the batch and the revenue would have to be
  guessed.
- **A category page says the same kind of thing.** A product carries its category
  as a name rather than a link, which is what lets the Categories screen be
  switched off without stranding a catalogue — and it means moving a product to
  another category moves its sales history with it. The page says so.
- **The till has its own top bar and its own Settings page.** Both were shared
  with the cloud-connected register and had grown a row of "only when this till
  runs on its own" branches. Nothing a cloud register shows has changed.
- **Adding a person happens in one place.** The People screen's Add button opens
  Quick add rather than a second dialog of its own.

### Fixed

- **A failed scan showed the words `common.error`** at the counter instead of a
  message. The English text for it had never been written, and only English was
  affected — a till set to Azerbaijani, Russian or Turkish always had it.
- **Row links on the Store list had no hover and no focus ring**, so a till
  driven from a keyboard or a scanner gave no sign of where it was. Categories
  and suppliers get the same link, and all three now show both.
- **A long form no longer scrolls its Save button off the bottom** of a popup.
  The buttons are pinned and the fields scroll under them.

## v1.3.0 — Counters, and a drawer that can be counted

A shop with more than one till could not say which one a sale came from, and no
till could be counted at the end of a turn. Both are here now, and both are off
until somebody switches them on.

The shape of it: a shop names its counters, each computer is paired to one with
a code typed once, and a cashier opens a shift with what is in the drawer, sells
against it, records anything paid in or out, and closes it against a count.

This finishes something the till deliberately stopped short of. `LocalOpeningCash`
has always refused to compute a variance, and said why: an expected figure built
from the opening float plus the day's cash is wrong the first time anybody takes
a note out to pay a delivery, "and a wrong variance is what shops discipline
staff on". Recording money in and out is the missing half, so the figure a
cashier is now measured against is one that can be defended.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers.
Nothing is stored differently, no account is touched, and every till carries on
exactly as it did until an owner names a counter. A shop that never opens App
admin will not notice this release.

### Added

- **Counters, under App admin.** Name the tills the way the shop does — "Front
  counter", "Kiosk 2" — rename them, and remove them. Each one produces a
  pairing code, shown once and stored only in the scrambled form a password is
  stored in, so nobody can read it back off the machine afterwards.
- **A till says which counter it is.** Once a shop has named any, a computer that
  has been paired to none asks for a code before it will sell. One code, typed
  once. Everything else on the till stays reachable while it asks — a cashier
  looking up a price, or an owner fixing the catalogue, is not made to pair
  anything first.
- **Shifts.** A cashier opens one with the cash in the drawer, and the sale
  screen carries a quiet strip saying whose turn it is, which counter, and what
  should be in the drawer. **Cash in** and **Cash out** record the money that is
  not a sale, each with a reason and the name of whoever recorded it. **Close**
  asks for the count, shows what should be there and the difference *before*
  anything is committed, and then produces the shift's report — printable, from
  the browser.
- **A short drawer never blocks the close.** The difference is recorded whatever
  it is. A till that refused to let a cashier finish on a short drawer would only
  teach cashiers to make the number fit.
- **Sales say where they were rung.** Every sale now carries its counter and its
  shift, and both appear in the sales export as two new columns at the end — at
  the end deliberately, so a spreadsheet built against the old export goes on
  working. Sales rung before a shop named its counters have both columns empty.
- **A Shifts tab under Sales**, listing every turn worked with its difference,
  and opening one shows the whole report. It appears only once a shop is running
  shifts.
- 24 new assertions in `scripts/check-standalone.mjs`, covering the pairing
  code's shape and its letter folding, the PBKDF2 round-trip with a
  one-character variant failing, change handed back not being counted as cash
  taken, a card sale moving the takings but not the drawer, movements in both
  directions, the sign of a variance, a hundred odd amounts not drifting by a
  cent, and all five answers the shift gate can give.

### Changed

- **Turning shifts on takes over the opening-cash question.** That older switch
  stays on the same page, greyed, saying so. The float typed when a shift opens
  *is* the drawer count, and asking both would put one question to a cashier
  twice and leave two different answers on file.
- **Shifts cannot be switched on until a counter has a name.** The switch is
  greyed with the reason beside it rather than hidden. A shift belongs to a
  counter, and one with nowhere to belong would have to invent a counter out of
  the machine's internal id — the sort of placeholder that survives into a
  shop's records.
- **A till whose last counter was removed says so.** Nothing stops an owner
  emptying the roster while shifts are on, and refusing would mean a shop could
  not tidy its own list. The register says there is nowhere to open a shift and
  what to do about it, rather than showing a cashier a float box whose Open
  button could only ever fail.
- **The backup carries the counters and the shifts**, and is version 5. A
  version 4 file restores into this release exactly as before; a version 5 file
  is refused by an older build rather than read with the drawer counts silently
  dropped. Restoring deliberately does **not** put the claims back — the machine
  doing the restoring is a different machine, or the same one with a fresh
  identity, so it is asked for a code of its own rather than quietly believing
  it is a counter it has never been paired to.
- **Settings shows which counter this computer is**, read-only, once the shop has
  named one. Re-pointing a till mid-day would put the rest of a shift's sales
  under the wrong name, so the way to move one is to free it under App admin and
  pair again.

### Known gaps, stated plainly

- **The list of counters does not sync, and cannot.** Two standalone tills never
  speak to each other — there is no server between them — so a counter claimed
  on the machine in the stockroom still shows as free on the one at the front.
  The list travels between tills the only way anything does: inside a backup.
  The manual says this in as many words rather than leaving a shop hunting for a
  sync that does not exist.
- **The register still cannot open a cash drawer.** There is no kick pulse and
  no setting for one. That has not changed and is not going to.
- **There is a report per shift and still no report per day.** Adding several
  shifts together is spreadsheet work, from the sales export.
- **The pairing code is not a lock.** It stops two tills quietly agreeing they
  are the same counter. Anybody standing at that keyboard can already wipe the
  machine through the browser's own settings, and the code changes nothing about
  that.
- **The seven new manual sections are English only for now.** The screens
  themselves are translated into Azerbaijani, Russian and Turkish in full — all
  123 new strings — but the manual pages describing them fall back to English
  with the "not translated yet" notice, which is the honest state rather than a
  machine translation presented as authoritative.

## v1.2.0 — App admin becomes the page a shop is handed

App admin was four settings and a role editor. It is the screen whoever installs
a till hands over when they leave, so it now carries the things that handover
actually needs: the staff accounts, the button that puts the register on the
computer, and the version number somebody will be asked for on the telephone.
The controls are switches throughout — one shape, read down a column, instead of
pairs of buttons naming both states in words.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers.
Nothing is stored differently, no role changes what it holds, and no account is
touched. A till whose App admin is never opened behaves exactly as it did.

### Added

- **People, inside App admin.** The staff list — add, change a role, reset a
  password, block, delete — is now a page of App admin as well as the People
  screen under Shop. It is the same screen in both places, not a copy, so the
  guards that stop a till losing its last App admin account hold on either. It
  appears for an account holding "Add and edit people", which out of the box is
  Support and nothing else.
- **An "Add them" button on the People screen.** Adding somebody used to be
  possible only from Quick add in the top bar, which is a shortcut — and a screen
  called People that could not add one sent the reader hunting for a screen that
  could.
- **Install, inside App admin.** The register installs itself from App admin now
  rather than from a button in the top bar, and unlike that button the page
  always says which of four situations you are in: ready to install, already
  installed, an iPad that needs Add to Home Screen, or a browser that cannot do
  it. The old button rendered nothing at all in two of those four, so "where did
  the Install button go?" had no screen to go and look at.
- **A search box inside every role.** Thirteen permissions per role is more than
  reads at a glance once a shop has a few roles, so an open role carries a box
  that narrows the list by name.
- **The register's version, quietly, at the foot of Settings and of every App
  admin page.** It is there so somebody on the telephone to support can read it
  out without hunting for it. On a till that runs on its own it is this number;
  on a till wired to a website it is the shop software's, which is a different
  number that moves at a different time.

### Changed

- **Every switch on App admin is a switch.** The opening-cash check and the three
  optional screens were pairs of buttons naming both states — "Ask for it" /
  "Do not ask", On / Off. They are single knobs on a row now. Naming both states
  was the safer shape while the page had four settings on it; it stops being
  safer at forty, where a column of pairs is harder to read down than a column of
  knobs that are either left or right.
- **Opening cash is one row, not one page.** It sits at the top of the new
  General page with the three optional screens under it, and the paragraph of
  explanation and the "See what has been counted" button are gone. What the
  paragraph said, the till already shows the moment the switch is on.
- **App admin's pages are now General, Roles, People, Install, Recovery code and
  Licence.** Opening cash and Optional screens were folded into General; links to
  the old addresses still land there.
- **Roles are one list that opens.** Built-ins and the shop's own roles are a
  single column of rows, each with a switch for whether anybody can be given it,
  and each opening to show all thirteen permissions with a switch apiece. The
  separate "Predefined roles" and "Custom roles" lists, the editor card, the Save
  button and the Enabled/Disabled wording are all gone.
- **Built-in roles can be changed.** All seven ship holding exactly what they
  held before, but their permissions are no longer fixed — so a shop that wants
  its Storekeeper to be able to sell can flip one switch instead of writing a
  custom role that duplicates the whole thing. Some switches still refuse to
  move: "Open app admin" and "Change roles" cannot be taken off Support or off
  whichever role you are signed in as, and neither of those two roles can be
  retired. A till with no website has no way to hand access back from somewhere
  else, so one flip would end your own access to the page for good.
- **Deleting a role asks first.** It used to go at once, with no confirmation.
- **A read-only App admin.** An account that can open App admin but does not hold
  "Change roles" now gets the roles page greyed with a line saying so, instead of
  controls that looked live.

### Fixed

- The roles list no longer reshuffles itself. It was drawn in whatever order
  storage returned, so a till that had saved its roles once showed them in a
  different order from one that had not.

## v1.1.0 — A way back into a till nobody can sign into

Until now, a shop that forgot its only Support password had exactly one option:
clear the browser's site data and start over. The till's IndexedDB is the only
copy of that shop's catalogue, its staff and every sale it has ever taken, so
the one available remedy destroyed the business's records. This release is the
alternative, and it is the last of the three that had a data-loss path behind it.

### Action needed on each till

Nothing breaks and no account is touched, but **every till already in service
has no recovery code** — it was set up before the register could make one. Make
one now, per till, before it is needed:

1. Sign in with an account that can open **App admin**.
2. Open **App admin → Recovery code**.
3. Press **Create a recovery code**.
4. Write the code on paper and keep it where the shop can reach it — not on the
   till. If that machine cannot be opened, nothing saved on it can be either.

A till set up from this release onward asks for this during setup and will not
create the account until somebody confirms they have written it down.

### Added

- **A recovery code, minted when the till is set up.** Twenty-five characters in
  five groups, from an alphabet with `I`, `L`, `O` and `U` taken out, because
  this string gets written on paper, read down a phone and typed on a tablet —
  and the box folds those letters back onto the digits they look like, so a shop
  is not locked out by its own handwriting. It does exactly one thing: set a new
  password on the one account it names. It never signs anybody in and grants no
  access of its own, which is what makes it safe to keep in a drawer. Only its
  scrambled form is stored; nobody, including whoever installed the till, can
  read it back off the machine.
- **It is not used up.** Using it mints a replacement and shows that once — a
  shop that has just used its way back in is exactly the shop that must not be
  left without one. The old code stops working at that moment.
- **"Locked out of this till?"**, at the foot of the sign-in card and only when
  nobody is signed in. Three ways back, in the order worth trying: the code; then
  asking anyone on the till who may add people, which fixes most real lockouts in
  seconds and needs no code at all; then starting the till over. That last one is
  collapsed until asked for, forces a backup download, and requires the shop's
  name typed out. It is offered because anybody standing at that machine can
  already do the same damage through the browser's own settings — without being
  made to take a backup first, and without being told what they are about to lose.
- **App admin → Recovery code**, for the tills that have none, with a standing
  warning while that is true. Deliberately not shown at the counter: a cashier
  warned about a missing recovery code can do nothing about it, and the sale
  screen is the one place that must carry no noise.
- **"Change my password"**, in Settings, on the account section. It asks for the
  current password first. There has never been a way for a cashier to change
  their own password without asking somebody else.
- **A weak-password refusal.** A short list of what a stranger tries first, in
  four languages, plus the rule worth more than all of it: a password may not be
  the account name.
- 15 new assertions in `scripts/check-standalone.mjs`, covering the code's shape,
  the letter folding, the PBKDF2 round-trip with a one-character variant failing,
  the recovery ladder charging from the first wrong try, and the settings
  defaults that let an upgrading till read the new fields back as "no code yet".

### Changed

- **Setting a password is a proper window now.** The People screen used a browser
  prompt, which printed the new password in clear text on a screen facing the
  shop floor, offered no confirmation box, and in an installed app renders as
  chrome some platforms suppress outright. It is now the same box the rest of the
  till uses, with the show button and the caps-lock warning.
- **The backup says what is in it.** The file carries the staff accounts and their
  scrambled passwords, and now the screen says so under both the manual download
  and the auto-backup folder picker. The accounts are deliberately *not* stripped:
  a backup that restores a till nobody can sign into is a worse failure than the
  exposure. It is deliberately not encrypted either — that would create a second
  forgettable secret whose loss destroys the shop's only copy, which is the exact
  hole this release exists to close.
- The App admin index has five pages rather than three. The manual had never been
  corrected for **Optional screens**, which arrived earlier; **Recovery code** is
  new here.

## v1.0.1 — Make the screen lock work the first time

Two faults in v1.0.0's screen lock, both on the path a shop takes the very first
time it uses the feature.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers.
No setting changes and nobody is signed out.

### Fixed

- **Choosing a lock time did nothing until the page was reloaded.** The register
  watched for the setting changing in *another* tab, which is every case except
  the one that happens: an owner picking a time at Settings and pressing Save on
  the till in front of them. They got a feature that looked broken, and the
  natural next move — trying a shorter time — looked broken too.
- **The lock screen never warned about caps lock.** The sign-in screen has warned
  since v1.0.0, but the lock screen carried a hand-copied password box that had
  the show button and not the warning. That is the wrong way round: a cashier
  coming back from a break is far likelier to have a shift key stuck down than
  one signing in at the start of a shift. Both screens now share one password
  box, so neither can drift from the other again.

### Added

- The delay after repeated wrong passwords is now written down in the manual, in
  two places — under setting a till up, for the owner, and under opening the till
  at the start of a shift, for the cashier who meets it. It shipped in v1.0.0
  with nothing on any screen or page explaining why the till had started asking
  somebody to wait.

## v1.0.0 — A till that does not hand itself over

The first release the standalone till has made under its own version. It was
cut as library v13.5.0 and reclassified before it shipped: the work is entirely
standalone, the shops running it install nothing from npm, and pinning it to the
storefront's release number told them nothing true. Till work before this point
is in the library's changelog up to v13.4.0.

Sign-in on a standalone till had no throttle of any kind, its session was a bare
user id that never expired and survived a password change, and the People screen
would let the last Support account be deleted.

### Nothing to do on a till

The update strip in the register's own header picks this up between customers.
Nothing is stored differently, no account is touched, and the screen lock is off
on every till until somebody switches it on.

### Added

- **A delay ladder after a wrong password.** The first three tries cost nothing —
  caps lock, a trailing space and the wrong keyboard layout are the three
  commonest reasons a correct password is refused, and charging for them stops a
  queue. The fourth waits 5s, then 15s, 30s, and 60s as a ceiling it never
  passes. It is a delay, never a lockout: keyed per username, so one cashier's
  typo does not hold up the next person, and with no "account locked" state,
  so nobody can lock a colleague out by guessing at their name. Forgotten after
  fifteen quiet minutes. The arithmetic is written out honestly in
  `sign-in-throttle.ts`: this defeats somebody trying twenty passwords at an
  unattended counter, and it does not pretend to defeat more than that.
- **An optional screen lock.** Off everywhere until switched on per device at
  `/pos/settings`, with the same posture the opening-cash check takes — a change
  of software must never be the reason a queue stops. It covers the screen
  without ending the session: the open sale, the cashier and the drawer count
  all survive, and unlocking does **not** mint a new sign-in, so nobody is asked
  to count the drawer again for turning round to serve a customer. Mounted
  inside `PosShell` rather than at the guard, so a till locked overnight keeps
  taking its automatic backups.
- **Rehash on sign-in.** `passwordIterations` was stored per account precisely so
  the cost could be raised later, and nothing ever acted on it. An account below
  the current cost is now re-hashed on the one occasion the password is in hand.
- `attemptLocalSignIn`, the `sign-in-throttle` reducer, `parseLocalSession`,
  `canRemoveLocalUser` / `canDisableLocalUser` and the idle-lock preference are
  exported. 14 new assertions in `scripts/check-standalone.mjs`, including the
  PBKDF2 round-trip and the one regression that would silently lock out every
  existing account the day the iteration count is raised.
- A POS-manual section, **Locking the screen when the till is left alone**.

### Changed

- **The session record grew from a bare user id to an envelope** carrying when it
  was issued, when the till was last touched, and a stamp of the password it was
  minted against. Resetting a cashier's password now ends their session instead
  of leaving it live until somebody happens to reload. The old bare-id record is
  still read, so no till in the field signs out on upgrade — there is a test
  holding that still.
- The provider re-checks the stored session every minute and whenever the tab
  becomes visible. Blocking somebody used to take effect on the next reload,
  which on a till that stays open all day meant "not today".
- A refused sign-in now says whether it was the password or the wait. Being told
  "wrong password" while the till is silently ignoring you is how somebody types
  it eight more times and makes the wait longer.

### Fixed

- **The last account that can open App admin can no longer be deleted or
  blocked.** App admin already refused to let the Support *role* be switched off
  for exactly this reason; the People screen only ever stopped you deleting
  *yourself*, so two Support accounts could delete each other and leave a till
  with a catalogue, a year of sales and nobody able to add a cashier.
- The People screen and the Add person dialog ask the live role definitions
  rather than the seven built-in ids, so a custom role granted App admin can hand
  out Support. `PosGuard` already worked this way; these two did not.
- `scripts/check-standalone.mjs` awaits async checks. Its helper called `fn()`
  and caught synchronously, so an async check would have reported "ok" the
  instant it started and its rejection would have landed nowhere — found while
  adding the first async checks to it.
