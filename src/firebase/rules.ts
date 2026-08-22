/**
 * Firestore + Storage security rules for a Caspian Store installation.
 *
 * Both values are generated from `firebase/firestore.rules` and
 * `firebase/storage.rules` — the files consumers actually deploy — by the
 * pre-step in `tsup.config.ts`. Edit those files, then run `npm run build`;
 * editing the generated module directly is overwritten on the next build.
 *
 * Deploy with `firebase deploy --only firestore:rules,storage`, or the
 * simpler `npm run firebase:sync` in a scaffolded site, which copies
 * `firestore.rules` + `firestore.indexes.json` + `storage.rules` out of the
 * installed package before redeploying.
 *
 * Stale deployed rules are the #1 cause of both the
 * `Firebase Storage: User does not have permission ... (storage/unauthorized)`
 * error during admin image uploads and of "missing or insufficient
 * permissions" on newer collections — every release that adds a collection
 * needs a rules redeploy on the consumer side.
 *
 * Before v10.0.0 these were hand-maintained template literals kept in sync by
 * eye. `CASPIAN_FIRESTORE_RULES` had drifted 181 lines behind the deployed
 * file, so anyone following README's "deploy this constant" instructions got
 * rules that denied the setup wizard, the page builder, contact submissions,
 * and error logging. Generating them removes that failure mode entirely.
 */
export { CASPIAN_FIRESTORE_RULES, CASPIAN_STORAGE_RULES } from './rules.generated';
