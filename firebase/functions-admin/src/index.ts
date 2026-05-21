import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { onUserCreate } from './on-user-create';
export { claimAdmin } from './claim-admin';
export { ensureAdminClaim } from './ensure-admin-claim';
export { syncAdminClaim } from './sync-admin-claim';
export { promoteUserToAdmin } from './promote-user-to-admin';
export { demoteAdminToCustomer } from './demote-admin-to-customer';
export { runRetentionCleanup } from './retention-cleanup';
export { linkGuestOrdersOnUserCreate } from './link-guest-orders';
export { getGuestOrder } from './get-guest-order';
