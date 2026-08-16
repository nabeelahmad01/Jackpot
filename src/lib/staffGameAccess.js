import { cache } from './cache.js';

export function parseRoles(role) {
  return (role || '').toLowerCase().split(',').map((r) => r.trim()).filter(Boolean);
}

export function isCoinsAdminRole(role) {
  return parseRoles(role).includes('coins_admin');
}

export function isFullAccessRole(role) {
  const roles = parseRoles(role);
  return roles.includes('admin') || roles.includes('operation_admin');
}

export async function getStaffAllowedGameTitles(db, adminEmail) {
  if (!adminEmail) return null;

  const cleanEmail = String(adminEmail).toLowerCase().trim();
  const cacheKey = `staff_games_${cleanEmail}`;
  const cached = cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const staff = await db.collection('users').findOne(
    { email: cleanEmail },
    { projection: { role: 1, allowedGameIds: 1 } }
  );
  if (!staff) {
    cache.set(cacheKey, null, 60);
    return null;
  }
  if (isFullAccessRole(staff.role)) {
    cache.set(cacheKey, null, 120);
    return null;
  }
  if (!isCoinsAdminRole(staff.role)) {
    cache.set(cacheKey, null, 120);
    return null;
  }

  const allowedIds = Array.isArray(staff.allowedGameIds) ? staff.allowedGameIds.map(String) : [];
  if (allowedIds.length === 0) {
    cache.set(cacheKey, null, 60);
    return null;
  }

  const games = await db.collection('games').find({}).project({ id: 1, title: 1 }).toArray();
  const allGameIds = games.map((g) => String(g.id));

  // If coins staff had all (or nearly all) games assigned previously, auto-include newly added games
  const isAllGamesStaff = allGameIds.length > 0 && allowedIds.length >= Math.max(1, allGameIds.length - 1);
  let effectiveAllowedIds = allowedIds;
  if (isAllGamesStaff) {
    effectiveAllowedIds = allGameIds;
    if (allGameIds.some((id) => !allowedIds.includes(id))) {
      Promise.resolve(
        db.collection('users').updateOne(
          { email: cleanEmail },
          { $addToSet: { allowedGameIds: { $each: allGameIds } } }
        )
      ).catch(() => {});
    }
  }

  const titles = games
    .filter((g) => effectiveAllowedIds.includes(String(g.id)))
    .map((g) => g.title)
    .filter(Boolean);

  cache.set(cacheKey, titles, 60);
  return titles;
}

export async function applyStaffGameFilter(db, query, adminEmail) {
  const titles = await getStaffAllowedGameTitles(db, adminEmail);
  if (!titles) return query;

  const regexList = titles.map((t) => new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'));
  const gameFilter = regexList.length > 0 ? { $in: regexList } : { $in: ['__NONE__'] };
  if (query.$and) {
    query.$and.push({ gameTitle: gameFilter });
  } else if (Object.keys(query).length > 0) {
    query = { $and: [query, { gameTitle: gameFilter }] };
  } else {
    query.gameTitle = gameFilter;
  }
  return query;
}

export async function staffCanAccessGame(db, adminEmail, gameTitle) {
  const skipTitles = ['Lobby', 'Referral Reward', 'Distributor Payout', 'Platform Fees'];
  if (!gameTitle || skipTitles.includes(gameTitle)) return true;

  const titles = await getStaffAllowedGameTitles(db, adminEmail);
  if (titles === null) return true;
  if (!titles.length) return false;

  const cleanGame = String(gameTitle).toLowerCase().trim();
  return titles.some((t) => t.toLowerCase().trim() === cleanGame);
}

export function filterGamesForStaff(games, adminUser) {
  if (!Array.isArray(games) || !adminUser) return games || [];
  if (isFullAccessRole(adminUser.role)) return games;

  const roles = parseRoles(adminUser.role);
  if (!roles.includes('coins_admin')) return games;

  const allowedIds = Array.isArray(adminUser.allowedGameIds)
    ? adminUser.allowedGameIds.map(String)
    : [];
  if (allowedIds.length === 0) return [];

  return games.filter((g) => allowedIds.includes(String(g.id)));
}

export async function validateAllowedGameIds(db, allowedGameIds, distributorId = '') {
  if (!Array.isArray(allowedGameIds) || allowedGameIds.length === 0) {
    return { valid: false, message: 'Please select at least one game for coins admin access.' };
  }

  const requestedIds = [...new Set(allowedGameIds.map(String))];
  const games = await db.collection('games').find({}).toArray();
  const foundIds = new Set(games.map((g) => String(g.id)));
  const validIds = requestedIds.filter((id) => foundIds.has(id));

  if (validIds.length === 0) {
    return { valid: false, message: distributorId ? 'Selected games must exist in the catalog.' : 'One or more selected games are invalid.' };
  }

  if (validIds.length !== requestedIds.length) {
    return { valid: false, message: 'One or more selected games are invalid.' };
  }

  return { valid: true, allowedGameIds: validIds };
}
