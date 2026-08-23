/**
 * `@caspian-explorer/script-caspian-store/pwa` — web app manifest builders.
 *
 * A fourth entry point exists for one reason: these are pure functions that a
 * **server** route handler needs to call, and the main entry is stamped with
 * `'use client'` by the build. Importing `buildWebManifest` from the main
 * barrel inside `app/manifest.webmanifest/route.ts` fails the Next.js build
 * with "Attempted to call buildWebManifest() from the server but
 * buildWebManifest is on the client" — which is what INSTALL.md told consumers
 * to do from v9.10.0 until v10.3.0.
 *
 * Nothing here touches React, Firebase, or the DOM, so this entry stays safe
 * to import from a route handler, a build script, or Node.
 */
export { buildWebManifest, type WebManifestInput, type WebManifestIcon } from './build-manifest';
export { buildPosWebManifest, type PosWebManifestInput } from './pos-manifest';
