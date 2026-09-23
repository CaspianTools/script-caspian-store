/**
 * Server-only entry point. Only safe to import from Node contexts —
 * Next.js App Router `route.ts` handlers, `getServerSideProps`, scripts.
 *
 * Importing this module from client/storefront code will pull
 * `firebase-admin` (and Node built-ins like `node:child_process`) into
 * the browser bundle.
 *
 * Added in v7.4.0 to host the self-update HTTP handler that scaffolded
 * route.ts files used to inline. Future server-only helpers land here.
 */

export {
  caspianHandleSelfUpdate,
  type CaspianHandleSelfUpdateOptions,
} from './self-update';
export {
  caspianHandleApi,
  CASPIAN_SERVER_CALLABLES,
  type CaspianHandleApiOptions,
} from './api';
export {
  getFirebaseSetupStatus,
  installFirebaseSetup,
  type FirebaseSetupStatus,
  type FirebaseSetupResult,
  type RulesState,
} from './firebase-setup';
