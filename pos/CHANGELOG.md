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
