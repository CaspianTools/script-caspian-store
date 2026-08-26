import { PosGuard } from './pos/pos-guard';
import { PosRoot, PosShell } from './pos/pos-root';
import { PosLocalSessionProvider } from './pos/standalone/local-session-context';
import { PosRoleProvider } from './pos/standalone/role-context';
import { PosOpeningCashProvider } from './pos/standalone/opening-cash-context';

/**
 * The whole register, from the outside.
 *
 * This nesting used to live inside the library's `CaspianRoot`, as the branch
 * it took for `/pos` and `/pos/**`. It moved out with the till: the library no
 * longer routes to a register, so the app that *is* the register mounts its
 * own tree and dispatches its own routes through `PosRoot`.
 *
 * The order is unchanged and two rungs of it are deliberate.
 * `PosOpeningCashProvider` sits *inside* `PosGuard` because the guard has just
 * established that somebody is signed in and holds `register`, which is the
 * only circumstance in which a drawer count has anyone to belong to -- and
 * *above* `PosShell` because the top bar is where a standing count is shown.
 */
export function PosApp() {
  return (
    <PosLocalSessionProvider>
      <PosRoleProvider>
        <PosGuard>
          <PosOpeningCashProvider>
            <PosShell>
              <PosRoot />
            </PosShell>
          </PosOpeningCashProvider>
        </PosGuard>
      </PosRoleProvider>
    </PosLocalSessionProvider>
  );
}
