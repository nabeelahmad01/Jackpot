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

export function invalidateTypeBDistributorCache() {
  cache.del(CACHE_KEY);
}
