import { getDb } from './mongodb';
import { cache } from './cache';

const CACHE_KEY = 'type_b_dist_ids';
const CACHE_TTL = 300;

export async function getTypeBDistributorIds(db) {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const conn = db || await getDb();
  const rows = await conn.collection('distributors').find({ type: 'B' }).project({ id: 1 }).toArray();
  const ids = rows.map((d) => d.id).filter(Boolean);
  cache.set(CACHE_KEY, ids, CACHE_TTL);
  return ids;
}

export async function isTypeBDistributor(db, distributorId) {
  const id = String(distributorId || '').trim();
  if (!id) return false;
  const ids = await getTypeBDistributorIds(db);
  return ids.includes(id);
}

/**
 * Mongo filter that hides Type B distributor traffic from global HQ admin views.
 * Flat fields (not nested $and) so status indexes can still be used.
 */
export async function typeBExclusionFilter(db) {
  const typeBDistIds = await getTypeBDistributorIds(db);
  const filter = { distributorType: { $ne: 'B' } };
  if (typeBDistIds.length > 0) {
    filter.distributorId = { $nin: typeBDistIds };
  }
  return filter;
}

export function invalidateTypeBDistributorCache() {
  cache.del(CACHE_KEY);
}
