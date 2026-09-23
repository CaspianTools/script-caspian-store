/**
 * Stand-in for `firebase-functions/v2/firestore` and `/v2/scheduler`.
 * Background triggers cannot run inside a request handler, so bundling a
 * source file that also declares one is harmless: the trigger is inert.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inert = (..._args: [unknown, (event: any) => unknown]) => ({ __caspianInert: true as const });
export const onDocumentCreated = inert;
export const onDocumentWritten = inert;
export const onDocumentUpdated = inert;
export const onDocumentDeleted = inert;
export const onSchedule = inert;
