/**
 * If a player's distributorId points at a distributor that no longer exists,
 * hand them to Super Admin HQ — KEEP game accounts / data, only clear the link
 * and strip Type B tags so HQ can see their requests & deposits.
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
    db.collection('users').updateOne(
      { email },
      { $set: { distributorId: '', formerDistributorId: distId } }
    ),
    db.collection('accountRequests').updateMany(
      { userEmail: email },
      { $set: { distributorId: '', distributorType: '', distributorName: '' } }
    ),
    db.collection('transactions').updateMany(
      { userEmail: email },
      { $set: { distributorId: '', distributorType: '', distributorName: '' } }
    ),
    db.collection('coinsNotifications').updateMany(
      { userEmail: email },
      { $set: { distributorId: '', distributorType: '', distributorName: '' } }
    )
  ]);

  return { ...user, distributorId: '', formerDistributorId: distId };
}
