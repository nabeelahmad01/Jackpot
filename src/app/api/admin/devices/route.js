import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { blockDevicePermanently, trackDeviceSession, parseUserAgent, getRolePostTitle } from '../../../../lib/deviceBlock';

function isSuperAdminUser(adminRole, adminEmail) {
  if (adminRole === 'admin') return true;
  const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
  if (envAdminEmail && String(adminEmail || '').toLowerCase().trim() === envAdminEmail) return true;
  return false;
}

function getRoleFilterConditions(roleFilter, adminEmailClean) {
  const rf = String(roleFilter || '').toLowerCase().trim();
  switch (rf) {
    case 'admin':
    case 'super_admin':
      return [
        { role: { $in: ['admin', 'super_admin', 'owner', 'ADMIN', 'SUPER_ADMIN'] } },
        { postTitle: { $regex: 'Super Admin|Owner', $options: 'i' } },
        ...(adminEmailClean ? [{ email: adminEmailClean }] : [])
      ];
    case 'financial_admin':
    case 'finance':
      return [
        { role: { $in: ['financial_admin', 'financial', 'FINANCIAL_ADMIN'] } },
        { postTitle: { $regex: 'Financial', $options: 'i' } }
      ];
    case 'coins_admin':
    case 'coins':
      return [
        { role: { $in: ['coins_admin', 'coins', 'COINS_ADMIN'] } },
        { postTitle: { $regex: 'Coins', $options: 'i' } }
      ];
    case 'support_admin':
    case 'support':
      return [
        { role: { $in: ['support_admin', 'support', 'SUPPORT_ADMIN'] } },
        { postTitle: { $regex: 'Support', $options: 'i' } }
      ];
    case 'distributor':
      return [
        { role: { $in: ['distributor', 'DISTRIBUTOR'] } },
        { postTitle: { $regex: 'Distributor Office', $options: 'i' } }
      ];
    case 'distributor_staff':
      return [
        { role: { $in: ['distributor_staff', 'DISTRIBUTOR_STAFF'] } },
        { postTitle: { $regex: 'Distributor Staff', $options: 'i' } }
      ];
    case 'agent':
    case 'affiliate':
      return [
        { role: { $in: ['agent', 'affiliate', 'affiliate_agent', 'AGENT', 'AFFILIATE'] } },
        { postTitle: { $regex: 'Affiliate|Agent', $options: 'i' } }
      ];
    case 'player':
    case 'user':
      return [
        { role: { $in: ['player', 'user', 'PLAYER', 'USER', null, ''] } },
        { role: { $exists: false } },
        { postTitle: { $regex: 'Player', $options: 'i' } }
      ];
    case 'staff':
      return [
        { role: { $in: ['financial_admin', 'coins_admin', 'support_admin', 'distributor_staff', 'operation_admin'] } },
        { postTitle: { $regex: 'Admin|Staff|Agent', $options: 'i' } }
      ];
    default:
      return [
        { role: { $regex: `^${rf}$`, $options: 'i' } },
        { postTitle: { $regex: rf, $options: 'i' } }
      ];
  }
}

// GET list of active & blocked devices (Super Admin Only)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const adminRole = searchParams.get('adminRole') || '';
    const adminEmail = searchParams.get('adminEmail') || '';

    if (!isSuperAdminUser(adminRole, adminEmail)) {
      return NextResponse.json({ success: false, message: 'Access denied. Super Admin access required.' }, { status: 403 });
    }

    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || '';
    const statusFilter = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = await getDb();
    const sessionsCollection = db.collection('deviceSessions');
    const blockedCollection = db.collection('blockedDevices');

    // 1. Automatically register/update the Super Admin's current device session
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Current Session';
    const userAgent = req.headers.get('user-agent') || '';
    const adminEmailClean = String(adminEmail || process.env.ADMIN_EMAIL || 'admin@jackpot.com').toLowerCase().trim();

    await trackDeviceSession(db, {
      email: adminEmailClean,
      name: 'Super Admin (Owner)',
      role: 'admin',
      deviceId: `super-admin-${Buffer.from(adminEmailClean).toString('hex').slice(0, 10)}`,
      userAgent,
      ip
    }).catch(() => {});

    // 2. Sync registered users/staff/distributors into deviceSessions if not present
    try {
      const allUsers = await db.collection('users').find(
        { email: { $exists: true, $ne: '' } },
        { projection: { email: 1, name: 1, role: 1, deviceId: 1, deviceFingerprint: 1, userAgent: 1, lastActive: 1, createdAt: 1 } }
      ).limit(300).toArray();

      for (const u of allUsers) {
        if (!u.email) continue;
        const cleanEmail = u.email.toLowerCase().trim();
        const exists = await sessionsCollection.findOne({ email: cleanEmail });
        const postInfo = getRolePostTitle(u.role || 'player');

        if (!exists) {
          await sessionsCollection.insertOne({
            email: cleanEmail,
            name: u.name || cleanEmail.split('@')[0],
            role: u.role || 'player',
            postTitle: postInfo.title,
            postEmoji: postInfo.emoji,
            postColor: postInfo.color,
            deviceId: u.deviceId || `dev-${Buffer.from(cleanEmail).toString('hex').slice(0, 14)}`,
            deviceFingerprint: u.deviceFingerprint || '',
            os: u.userAgent ? parseUserAgent(u.userAgent).os : 'Web Browser',
            browser: u.userAgent ? parseUserAgent(u.userAgent).browser : 'Active Session',
            ip: 'Active',
            lastActive: u.lastActive ? new Date(u.lastActive) : (u.createdAt ? new Date(u.createdAt) : new Date()),
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            status: 'ACTIVE'
          });
        } else if (!exists.postTitle || !exists.role) {
          await sessionsCollection.updateOne(
            { _id: exists._id },
            { $set: { role: u.role || exists.role || 'player', postTitle: postInfo.title, postEmoji: postInfo.emoji, postColor: postInfo.color } }
          );
        }
      }

      // Also sync distributors
      const dists = await db.collection('distributors').find(
        { email: { $exists: true, $ne: '' } },
        { projection: { email: 1, name: 1, lastActive: 1, createdAt: 1 } }
      ).limit(100).toArray();

      for (const d of dists) {
        if (!d.email) continue;
        const cleanEmail = d.email.toLowerCase().trim();
        const exists = await sessionsCollection.findOne({ email: cleanEmail });
        const postInfo = getRolePostTitle('distributor');

        if (!exists) {
          await sessionsCollection.insertOne({
            email: cleanEmail,
            name: d.name || 'Distributor Office',
            role: 'distributor',
            postTitle: postInfo.title,
            postEmoji: postInfo.emoji,
            postColor: postInfo.color,
            deviceId: `dist-${Buffer.from(cleanEmail).toString('hex').slice(0, 14)}`,
            deviceFingerprint: '',
            os: 'Web Browser',
            browser: 'Active Session',
            ip: 'Active',
            lastActive: d.lastActive ? new Date(d.lastActive) : (d.createdAt ? new Date(d.createdAt) : new Date()),
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            status: 'ACTIVE'
          });
        }
      }
    } catch (syncErr) {
      console.error('Device sync error:', syncErr);
    }

    // 3. Get list of permanently blocked device IDs and fingerprints
    const blockedList = await blockedCollection.find({}).toArray();
    const blockedDeviceIds = new Set(blockedList.map(b => b.deviceId).filter(Boolean));
    const blockedFingerprints = new Set(blockedList.map(b => b.deviceFingerprint).filter(Boolean));

    // 4. Compute GLOBAL Platform Metrics Stats across the entire system
    const allGlobalSessions = await sessionsCollection.find({}).toArray();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      totalDevices: allGlobalSessions.length,
      activeToday: allGlobalSessions.filter(d => !blockedDeviceIds.has(d.deviceId) && !blockedFingerprints.has(d.deviceFingerprint) && d.lastActive && new Date(d.lastActive) >= oneDayAgo).length,
      staffDevices: allGlobalSessions.filter(d => d.role && d.role !== 'player' && d.role !== 'user').length,
      blockedCount: blockedList.length
    };

    // 5. Build filter query for table rows
    const andClauses = [];

    if (search.trim()) {
      const cleanSearch = search.trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andClauses.push({
        $or: [
          { email: { $regex: escaped, $options: 'i' } },
          { name: { $regex: escaped, $options: 'i' } },
          { role: { $regex: escaped, $options: 'i' } },
          { postTitle: { $regex: escaped, $options: 'i' } },
          { deviceId: { $regex: escaped, $options: 'i' } },
          { ip: { $regex: escaped, $options: 'i' } },
          { os: { $regex: escaped, $options: 'i' } },
          { browser: { $regex: escaped, $options: 'i' } }
        ]
      });
    }

    if (roleFilter) {
      const roleConditions = getRoleFilterConditions(roleFilter, adminEmailClean);
      andClauses.push({ $or: roleConditions });
    }

    const query = andClauses.length > 1 ? { $and: andClauses } : (andClauses[0] || {});

    const allSessions = await sessionsCollection.find(query).sort({ lastActive: -1 }).toArray();

    // Map blocked status dynamically
    const devices = allSessions.map((session) => {
      const isBlocked = blockedDeviceIds.has(session.deviceId) || blockedFingerprints.has(session.deviceFingerprint);
      return {
        ...session,
        id: session._id?.toString(),
        isBlocked,
        status: isBlocked ? 'PERMANENTLY_BLOCKED' : (session.status || 'ACTIVE')
      };
    });

    // Apply status filter if present
    let filteredDevices = devices;
    if (statusFilter === 'BLOCKED') {
      filteredDevices = devices.filter(d => d.isBlocked);
    } else if (statusFilter === 'ACTIVE') {
      filteredDevices = devices.filter(d => !d.isBlocked);
    }

    // Pagination
    const totalCount = filteredDevices.length;
    const skip = (page - 1) * limit;
    const paginatedDevices = filteredDevices.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      devices: paginatedDevices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      stats
    });
  } catch (err) {
    console.error('Fetch devices API error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST block device permanently (Super Admin Only)
export async function POST(req) {
  try {
    const { deviceId, deviceFingerprint, reason, adminRole, adminEmail } = await req.json();

    if (!isSuperAdminUser(adminRole, adminEmail)) {
      return NextResponse.json({ success: false, message: 'Access denied. Super Admin access required.' }, { status: 403 });
    }

    if (!deviceId && !deviceFingerprint) {
      return NextResponse.json({ success: false, message: 'Device ID or Fingerprint is required to block a device.' }, { status: 400 });
    }

    const db = await getDb();
    const record = await blockDevicePermanently(db, {
      deviceId,
      deviceFingerprint,
      blockedBy: adminEmail || 'super_admin',
      reason: reason || 'Permanently blocked by Super Admin'
    });

    return NextResponse.json({
      success: true,
      message: 'Device has been permanently blocked! All active sessions on this device have been revoked.',
      blocked: record
    });
  } catch (err) {
    console.error('Block device API error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
