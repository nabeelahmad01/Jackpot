import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { blockDevicePermanently, trackDeviceSession, parseUserAgent } from '../../../../lib/deviceBlock';

function isSuperAdminUser(adminRole, adminEmail) {
  if (adminRole === 'admin') return true;
  const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim();
  if (envAdminEmail && String(adminEmail || '').toLowerCase().trim() === envAdminEmail) return true;
  return false;
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

    // 2. Sync any registered users/staff/distributors into deviceSessions if not present
    try {
      const allUsers = await db.collection('users').find(
        { email: { $exists: true, $ne: '' } },
        { projection: { email: 1, name: 1, role: 1, deviceId: 1, deviceFingerprint: 1, userAgent: 1, lastActive: 1, createdAt: 1 } }
      ).limit(200).toArray();

      for (const u of allUsers) {
        if (!u.email) continue;
        const cleanEmail = u.email.toLowerCase().trim();
        const exists = await sessionsCollection.findOne({ email: cleanEmail });
        if (!exists) {
          const postInfo = u.role === 'admin' ? { title: 'Super Admin (Owner)', emoji: '👑', color: '#facc15' } :
            u.role === 'financial_admin' ? { title: 'Financial Admin', emoji: '💳', color: '#38bdf8' } :
            u.role === 'coins_admin' ? { title: 'Coins Staff', emoji: '🪙', color: '#a855f7' } :
            u.role === 'support_admin' ? { title: 'Support Agent', emoji: '🎧', color: '#4ade80' } :
            u.role === 'distributor_staff' ? { title: 'Distributor Staff', emoji: '👔', color: '#f472b6' } :
            { title: 'Player Account', emoji: '🎮', color: '#94a3b8' };

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
        }
      }

      // Also sync distributors
      const dists = await db.collection('distributors').find(
        { email: { $exists: true, $ne: '' } },
        { projection: { email: 1, name: 1, lastActive: 1, createdAt: 1 } }
      ).limit(50).toArray();

      for (const d of dists) {
        if (!d.email) continue;
        const cleanEmail = d.email.toLowerCase().trim();
        const exists = await sessionsCollection.findOne({ email: cleanEmail });
        if (!exists) {
          await sessionsCollection.insertOne({
            email: cleanEmail,
            name: d.name || 'Distributor Office',
            role: 'distributor',
            postTitle: 'Distributor Office',
            postEmoji: '🏢',
            postColor: '#fb923c',
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
    let query = {};
    if (search.trim()) {
      const cleanSearch = search.trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { email: { $regex: escaped, $options: 'i' } },
        { name: { $regex: escaped, $options: 'i' } },
        { role: { $regex: escaped, $options: 'i' } },
        { postTitle: { $regex: escaped, $options: 'i' } },
        { deviceId: { $regex: escaped, $options: 'i' } },
        { ip: { $regex: escaped, $options: 'i' } },
        { os: { $regex: escaped, $options: 'i' } },
        { browser: { $regex: escaped, $options: 'i' } }
      ];
    }

    if (roleFilter) {
      if (roleFilter === 'admin') {
        const adminOr = [
          { role: 'admin' },
          { role: 'super_admin' },
          { postTitle: { $regex: 'Super Admin', $options: 'i' } },
          { email: adminEmailClean }
        ];
        if (query.$or) {
          query = { $and: [query, { $or: adminOr }] };
        } else {
          query.$or = adminOr;
        }
      } else if (roleFilter === 'staff') {
        query.role = { $in: ['financial_admin', 'coins_admin', 'support_admin', 'distributor_staff', 'operation_admin'] };
      } else if (roleFilter === 'player') {
        query.role = { $in: ['player', 'user', null, ''] };
      } else if (roleFilter === 'distributor') {
        query.role = { $in: ['distributor', 'distributor_staff'] };
      } else {
        query.role = roleFilter;
      }
    }

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
