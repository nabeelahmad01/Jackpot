/**
 * If a player's distributorId points at a distributor that no longer exists,
 * clear the link and wipe their game accounts + account requests so they can
 * re-request under super admin — same outcome as distributor DELETE.
 */
export async function healOrphanedDistributorPlayer(db, user) {
  if (!user || user.role !== 'user') return user;

  const distId = String(user.distributorId || '').trim();
  if (!distId) return user;

  const distributor = await db.collection('distributors').findOne({ id: distId });
  if (distributor) return user;

  const email = String(user.email || '').toLowerCase().trim();
  if (!email) return user;

  await Promise.all([
    db.collection('users').updateOne({ email }, { $set: { distributorId: '' } }),
    db.collection('gameAccounts').deleteMany({ userEmail: email }),
    db.collection('accountRequests').deleteMany({ userEmail: email })
  ]);

  return { ...user, distributorId: '' };
}
