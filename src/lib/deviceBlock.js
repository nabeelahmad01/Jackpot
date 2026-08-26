import { getDb } from './mongodb';

/**
 * Parses user agent string into human-friendly OS & Browser device details.
 */
export function parseUserAgent(uaString = '') {
  const ua = String(uaString);
  let os = 'Unknown OS';
  let browser = 'Browser';

  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS (iPhone/iPad)';
  else if (/Android/i.test(ua)) os = 'Android Device';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  if (/Chrome/i.test(ua) && !/Chromium|Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  return { os, browser, raw: ua };
}

/**
 * Returns human-friendly Post / Role title.
 */
export function getRolePostTitle(role = '') {
  const r = String(role || '').toLowerCase().trim();
  switch (r) {
    case 'admin':
    case 'super_admin':
      return { title: 'Super Admin (Owner)', emoji: '👑', color: '#facc15' };
    case 'financial_admin':
      return { title: 'Financial Admin', emoji: '💳', color: '#38bdf8' };
    case 'coins_admin':
      return { title: 'Coins Staff', emoji: '🪙', color: '#a855f7' };
    case 'support_admin':
      return { title: 'Support Agent', emoji: '🎧', color: '#4ade80' };
    case 'distributor':
      return { title: 'Distributor Office', emoji: '🏢', color: '#fb923c' };
    case 'distributor_staff':
      return { title: 'Distributor Staff', emoji: '👔', color: '#f472b6' };
    case 'agent':
      return { title: 'Affiliate Agent', emoji: '💼', color: '#818cf8' };
    default:
      return { title: 'Player Account', emoji: '🎮', color: '#94a3b8' };
  }
}

/**
 * Check if a device ID or fingerprint is permanently blocked in blockedDevices collection.
 */
export async function isDeviceBlocked(db, deviceId, deviceFingerprint) {
  if (!deviceId && !deviceFingerprint) return false;

  const cleanId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const cleanFp = typeof deviceFingerprint === 'string' ? deviceFingerprint.trim() : '';

  if (!cleanId && !cleanFp) return false;

  const conditions = [];
  if (cleanId) conditions.push({ deviceId: cleanId });
  if (cleanFp) conditions.push({ deviceFingerprint: cleanFp });

  const blocked = await db.collection('blockedDevices').findOne({
    $or: conditions
  });

  return Boolean(blocked);
}

/**
 * Permanently block a device ID and fingerprint. Irreversible operation.
 */
export async function blockDevicePermanently(db, { deviceId, deviceFingerprint, blockedBy, reason }) {
  const cleanId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const cleanFp = typeof deviceFingerprint === 'string' ? deviceFingerprint.trim() : '';

  if (!cleanId && !cleanFp) {
    throw new Error('Device ID or Fingerprint is required to block a device.');
  }

  const record = {
    deviceId: cleanId,
    deviceFingerprint: cleanFp,
    blockedBy: blockedBy || 'super_admin',
    reason: reason || 'Permanently blocked by Super Admin',
    isPermanent: true,
    blockedAt: new Date()
  };

  await db.collection('blockedDevices').updateOne(
    { $or: [{ deviceId: cleanId }, { deviceFingerprint: cleanFp }].filter((c) => Object.values(c)[0]) },
    { $set: record },
    { upsert: true }
  );

  // Update status in deviceSessions collection
  const updateFilter = [];
  if (cleanId) updateFilter.push({ deviceId: cleanId });
  if (cleanFp) updateFilter.push({ deviceFingerprint: cleanFp });

  await db.collection('deviceSessions').updateMany(
    { $or: updateFilter },
    { $set: { status: 'PERMANENTLY_BLOCKED', blockedAt: new Date() } }
  );

  return record;
}

/**
 * Log or update an active device session in MongoDB.
 */
export async function trackDeviceSession(db, { email, name, role, deviceId, deviceFingerprint, userAgent, ip }) {
  if (!email) return;

  const cleanEmail = email.toLowerCase().trim();
  const cleanId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const cleanFp = typeof deviceFingerprint === 'string' ? deviceFingerprint.trim() : '';

  if (!cleanId && !cleanFp) return;

  const uaParsed = parseUserAgent(userAgent);
  const postInfo = getRolePostTitle(role);

  const sessionDoc = {
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    role: role || 'player',
    postTitle: postInfo.title,
    postEmoji: postInfo.emoji,
    postColor: postInfo.color,
    deviceId: cleanId,
    deviceFingerprint: cleanFp,
    os: uaParsed.os,
    browser: uaParsed.browser,
    userAgent: uaParsed.raw,
    ip: ip || 'Unknown',
    lastActive: new Date(),
    status: 'ACTIVE'
  };

  await db.collection('deviceSessions').updateOne(
    { email: cleanEmail, deviceId: cleanId },
    {
      $set: sessionDoc,
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
}
