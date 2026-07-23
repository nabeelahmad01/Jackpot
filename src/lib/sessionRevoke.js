import { cache } from './cache';

const revokeKey = (email) => `session_revoked_${String(email || '').toLowerCase().trim()}`;

/** Mark an email so active localStorage sessions are forced to log out. */
export function revokeSession(email, ttlSeconds = 60 * 60 * 24 * 30) {
  const clean = String(email || '').toLowerCase().trim();
  if (!clean) return;
  cache.set(revokeKey(clean), { revokedAt: Date.now() }, ttlSeconds);
}

export function isSessionRevoked(email) {
  const clean = String(email || '').toLowerCase().trim();
  if (!clean) return false;
  return Boolean(cache.get(revokeKey(clean)));
}

/**
 * Persist deleted user + revoke live sessions + drop push tokens.
 * Safe to call when userDoc is null (still revokes by email).
 */
export async function purgeAccountAccess(db, email, userDoc = null) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!cleanEmail) return;

  revokeSession(cleanEmail);

  try {
    const deletedCollection = db.collection('deletedUsers');
    await deletedCollection.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 2592000 });
    if (userDoc) {
      const { _id, ...rest } = userDoc;
      await deletedCollection.updateOne(
        { email: cleanEmail },
        { $set: { ...rest, email: cleanEmail, deletedAt: new Date().toISOString() } },
        { upsert: true }
      );
    } else {
      await deletedCollection.updateOne(
        { email: cleanEmail },
        { $set: { email: cleanEmail, deletedAt: new Date().toISOString() } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('purgeAccountAccess deletedUsers:', err);
  }

  try {
    await db.collection('pushSubscriptions').deleteMany({
      userEmail: cleanEmail
    });
  } catch (err) {
    console.error('purgeAccountAccess pushSubscriptions:', err);
  }
}
