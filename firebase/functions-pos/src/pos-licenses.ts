import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { assertStaff } from './auth';
import { isLicensingConfigured, verifyLicenseKey } from './license';

/**
 * Bind a licence to one computer.
 *
 * This is the only part of licensing with any teeth. The browser-side check is
 * a convenience; here the signature is re-verified with the Admin SDK and the
 * licence document records which `deviceId` claimed it first. A second computer
 * presenting the same key is told the seat is taken and the attempt is counted,
 * so the distributor has an auditable record.
 *
 * It still never blocks a sale. `commitPosSale` does not consult this, on
 * purpose: a shop that cannot ring up a customer because of a licence server is
 * a worse outcome than an unlicensed shop, and the enforcement posture chosen
 * for this product is warning-only.
 *
 * Idempotent: the same device re-presenting the same key just refreshes
 * `lastSeenAt`.
 */
export const activatePosLicense = onCall({ cors: true }, async (request: CallableRequest) => {
  const caller = await assertStaff(request);

  if (!isLicensingConfigured()) {
    // A deployment that does not sell licences answers honestly rather than
    // pretending every key is fine.
    return { ok: true, seat: 'bound', configured: false };
  }

  const data = (request.data ?? {}) as { licenseKey?: unknown; deviceId?: unknown };
  const licenseKey = typeof data.licenseKey === 'string' ? data.licenseKey.trim() : '';
  const deviceId = typeof data.deviceId === 'string' ? data.deviceId.trim() : '';
  if (!licenseKey) throw new HttpsError('invalid-argument', 'licenseKey is required.');
  if (!deviceId) throw new HttpsError('invalid-argument', 'deviceId is required.');

  const verdict = verifyLicenseKey(licenseKey);
  if (!verdict.ok) {
    throw new HttpsError('failed-precondition', `Licence rejected: ${verdict.reason}.`);
  }

  const db = getFirestore();
  const ref = db.collection('posLicenses').doc(verdict.payload.lic);

  const seat = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();

    if (!snap.exists) {
      tx.set(ref, {
        lic: verdict.payload.lic,
        name: verdict.payload.name,
        seats: verdict.payload.seats ?? 1,
        tier: verdict.payload.tier ?? '',
        issuedAt: verdict.payload.iat,
        expiresAt: verdict.payload.exp ?? null,
        deviceId,
        activatedBy: caller.uid,
        activatedAt: now,
        lastSeenAt: now,
        rejectedAttempts: 0,
      });
      return 'bound' as const;
    }

    const bound = snap.data()?.deviceId as string | undefined;
    if (!bound || bound === deviceId) {
      tx.update(ref, { deviceId, lastSeenAt: now });
      return 'bound' as const;
    }

    // A different computer. Record it — that record is the whole product of
    // this endpoint — but do not fail the call, so the register carries on.
    tx.update(ref, {
      lastSeenAt: now,
      rejectedAttempts: FieldValue.increment(1),
      lastRejectedDeviceId: deviceId,
      lastRejectedAt: now,
    });
    return 'taken' as const;
  });

  if (seat === 'taken') {
    logger.warn(
      `[activatePosLicense] lic=${verdict.payload.lic} presented by device=${deviceId} but already bound elsewhere.`,
    );
  }

  return { ok: true, seat, configured: true, name: verdict.payload.name, expiresAt: verdict.payload.exp ?? null };
});

function assertAdmin(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if ((request.auth.token as { role?: string }).role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admins only.');
  }
  return request.auth.uid;
}

/**
 * List sold licences for the admin panel.
 *
 * A callable rather than a Firestore read because `posLicenses` is server-only
 * in the rules: the documents carry customer names and, in a distributor's
 * deployment, whatever contact detail they choose to record. Keeping the
 * collection unreadable from the browser means a compromised admin session
 * cannot vacuum up a customer list through the SDK.
 */
export const listPosLicenses = onCall({ cors: true }, async (request: CallableRequest) => {
  assertAdmin(request);
  const db = getFirestore();
  const snap = await db.collection('posLicenses').orderBy('activatedAt', 'desc').limit(200).get();
  return {
    licenses: snap.docs.map((d) => {
      const v = d.data();
      return {
        lic: d.id,
        name: v.name ?? '',
        tier: v.tier ?? '',
        deviceId: v.deviceId ?? '',
        expiresAt: v.expiresAt ?? null,
        rejectedAttempts: v.rejectedAttempts ?? 0,
        lastRejectedDeviceId: v.lastRejectedDeviceId ?? '',
        activatedAtMillis: v.activatedAt?.toMillis?.() ?? null,
        lastSeenAtMillis: v.lastSeenAt?.toMillis?.() ?? null,
      };
    }),
  };
});

/**
 * Unbind a licence from its computer so it can be activated on another.
 *
 * This is the support path that makes per-computer licensing survive contact
 * with reality: tills get replaced, browsers get wiped, and a device id is
 * regenerated whenever site data is cleared. Without this, a customer who
 * bought a licence would be permanently locked out by their own IT.
 */
export const releasePosLicenseSeat = onCall({ cors: true }, async (request: CallableRequest) => {
  const actor = assertAdmin(request);
  const lic = typeof (request.data as { lic?: unknown })?.lic === 'string' ? (request.data as { lic: string }).lic : '';
  if (!lic) throw new HttpsError('invalid-argument', 'lic is required.');

  const db = getFirestore();
  const ref = db.collection('posLicenses').doc(lic);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such licence.');

  await ref.update({
    deviceId: '',
    releasedBy: actor,
    releasedAt: FieldValue.serverTimestamp(),
    rejectedAttempts: 0,
    lastRejectedDeviceId: '',
  });

  logger.info(`[releasePosLicenseSeat] actor=${actor} released lic=${lic}.`);
  return { ok: true };
});
