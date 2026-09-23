import { httpsCallable, type Functions } from 'firebase/functions';
import type { Auth } from 'firebase/auth';

interface LinkGuestOrdersResult {
  linked?: number;
}

/**
 * Attach guest orders placed with this account's email to the account.
 *
 * The `onUserCreate` trigger only links orders for sign-ins whose email is
 * already verified (OAuth providers). Email + password accounts verify later
 * and Firebase has no "email verified" trigger, so the client asks the
 * `linkMyGuestOrders` callable once the token carries `email_verified`.
 * Returns how many orders were linked; `0` when nothing matched, the user is
 * anonymous or unverified, or the callable is not deployed (older
 * `caspian-admin` Functions) — none of those is worth surfacing to a shopper.
 */
export async function tryLinkGuestOrders({
  functions,
  auth,
}: {
  functions: Functions;
  auth: Auth;
}): Promise<number> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !user.emailVerified) return 0;
  try {
    const callable = httpsCallable<unknown, LinkGuestOrdersResult>(functions, 'linkMyGuestOrders');
    const result = await callable({});
    return result.data?.linked ?? 0;
  } catch {
    return 0;
  }
}
