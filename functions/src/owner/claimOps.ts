import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ESTABLISHMENTS, OWNERS, CLAIM_REQUESTS } from '../lib/schema';

// NOTE: setGlobalOptions is called once in index.ts — do NOT call it here
// NOTE: initializeApp() is called once in index.ts — do NOT call it here

const db = getFirestore();
const auth = getAuth();

/** Admin-only: approve a pending claim request */
export const approveClaimRequest = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  // Verify caller is admin
  const callerDoc = await db.collection('admins').doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError('permission-denied', 'Admin only');

  const { claimRequestId } = request.data as { claimRequestId: string };
  if (!claimRequestId) throw new HttpsError('invalid-argument', 'claimRequestId required');

  const claimRef = db.collection(CLAIM_REQUESTS).doc(claimRequestId);
  const claimDoc = await claimRef.get();
  if (!claimDoc.exists) throw new HttpsError('not-found', 'Claim request not found');

  const claim = claimDoc.data()!;
  const { estId, uid, displayName, email } = claim as { estId: string; uid: string; displayName: string; email: string };

  const batch = db.batch();

  // 1. Add uid to establishment ownerUids
  batch.update(db.collection(ESTABLISHMENTS).doc(estId), {
    ownerUids: FieldValue.arrayUnion(uid),
    claimedByUid: uid,
    claimedAt: FieldValue.serverTimestamp(),
    isVerifiedBusiness: true,
  });

  // 2. Write owners/{uid} doc (upsert)
  const ownerRef = db.collection(OWNERS).doc(uid);
  const ownerDoc = await ownerRef.get();
  if (ownerDoc.exists) {
    batch.update(ownerRef, { establishmentIds: FieldValue.arrayUnion(estId) });
  } else {
    batch.set(ownerRef, {
      uid,
      displayName,
      email,
      establishmentIds: [estId],
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 3. Update claim request status
  batch.update(claimRef, {
    status: 'approved',
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: request.auth.uid,
  });

  await batch.commit();

  // 4. Set custom claim (best-effort — doesn't block response)
  try {
    await auth.setCustomUserClaims(uid, { businessOwner: true });
  } catch (e) {
    console.error('Failed to set custom claim', e);
  }

  return { success: true };
});

/** Admin-only: reject a pending claim request */
export const rejectClaimRequest = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  const callerDoc = await db.collection('admins').doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError('permission-denied', 'Admin only');

  const { claimRequestId, reason } = request.data as { claimRequestId: string; reason?: string };
  if (!claimRequestId) throw new HttpsError('invalid-argument', 'claimRequestId required');

  await db.collection(CLAIM_REQUESTS).doc(claimRequestId).update({
    status: 'rejected',
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy: request.auth.uid,
    rejectionReason: reason ?? '',
  });

  return { success: true };
});

/** Admin-only: invite an owner by email */
export const inviteOwner = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

  const callerDoc = await db.collection('admins').doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError('permission-denied', 'Admin only');

  const { email, estId, displayName } = request.data as { email: string; estId: string; displayName?: string };
  if (!email || !estId) throw new HttpsError('invalid-argument', 'email and estId required');

  let uid: string;
  let isNewUser = false;

  // Try to find existing user
  try {
    const existingUser = await auth.getUserByEmail(email);
    uid = existingUser.uid;
  } catch {
    // Create new user with random temp password
    isNewUser = true;
    const tempUser = await auth.createUser({ email, displayName: displayName ?? email.split('@')[0] });
    uid = tempUser.uid;
  }

  const batch = db.batch();

  // Write owners/{uid} doc
  const ownerRef = db.collection(OWNERS).doc(uid);
  const ownerDoc = await ownerRef.get();
  if (ownerDoc.exists) {
    batch.update(ownerRef, { establishmentIds: FieldValue.arrayUnion(estId) });
  } else {
    batch.set(ownerRef, {
      uid,
      displayName: displayName ?? email.split('@')[0],
      email,
      establishmentIds: [estId],
      createdAt: FieldValue.serverTimestamp(),
      invitedBy: request.auth.uid,
    });
  }

  // Add to establishment ownerUids
  batch.update(db.collection(ESTABLISHMENTS).doc(estId), {
    ownerUids: FieldValue.arrayUnion(uid),
    isVerifiedBusiness: true,
  });

  await batch.commit();

  // Set custom claim
  try {
    await auth.setCustomUserClaims(uid, { businessOwner: true });
  } catch (e) {
    console.error('Failed to set custom claim', e);
  }

  // Generate password reset link (works for both new and existing users)
  const resetLink = await auth.generatePasswordResetLink(email);

  // TODO: Send via SendGrid when vendor key is available
  // For now, return the link so admin can share manually
  console.log(`Invite link for ${email}: ${resetLink}`);

  return { success: true, isNewUser, resetLink };
});
