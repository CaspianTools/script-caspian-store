import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { onUserCreate } from './on-user-create';
export { claimAdmin } from './claim-admin';
export { ensureAdminClaim } from './ensure-admin-claim';
// Exported under its original name on purpose — see the docblock in
// sync-user-role-claim.ts. The deployed function name must not change.
export { syncUserRoleClaim as syncAdminClaim } from './sync-user-role-claim';
export { setUserRole } from './set-user-role';
export { promoteUserToAdmin } from './promote-user-to-admin';
export { demoteAdminToCustomer } from './demote-admin-to-customer';
export { runRetentionCleanup } from './retention-cleanup';
export { runScheduledPublish } from './scheduled-publish';
export { linkGuestOrdersOnUserCreate } from './link-guest-orders';
export { getGuestOrder } from './get-guest-order';
