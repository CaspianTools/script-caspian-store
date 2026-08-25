# Changelog — the standalone till

Release history for the standalone register, the product built from this folder
and served from `pos/dist`. It versions and ships on its own; the library's
history is in [../CHANGELOG.md](../CHANGELOG.md) and the two numbers have
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
