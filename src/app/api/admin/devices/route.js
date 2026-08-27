import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { blockDevicePermanently } from '../../../../lib/deviceBlock';

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

    // Get list of permanently blocked device IDs and fingerprints
    const blockedList = await blockedCollection.find({}).toArray();
    const blockedDeviceIds = new Set(blockedList.map(b => b.deviceId).filter(Boolean));
    const blockedFingerprints = new Set(blockedList.map(b => b.deviceFingerprint).filter(Boolean));

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
      if (roleFilter === 'staff') {
        query.role = { $in: ['financial_admin', 'coins_admin', 'support_admin', 'distributor_staff'] };
      } else {
        query.role = roleFilter;
      }
    }

    // Sync any users/staff from users collection that have device/activity info but no deviceSessions record yet
    try {
      const activeUsers = await db.collection('users').find(
        { email: { $exists: true, $ne: '' } },
        { projection: { email: 1, name: 1, role: 1, deviceId: 1, deviceFingerprint: 1, userAgent: 1, lastActive: 1, createdAt: 1 } }
      ).limit(100).toArray();

      for (const u of activeUsers) {
        if (!u.email) continue;
        const exists = await sessionsCollection.findOne({ email: u.email.toLowerCase().trim() });
        if (!exists) {
          await sessionsCollection.insertOne({
            email: u.email.toLowerCase().trim(),
            name: u.name || u.email.split('@')[0],
            role: u.role || 'player',
            postTitle: u.role === 'admin' ? 'Super Admin (Owner)' : (u.role?.replace('_', ' ') || 'Player Account'),
            postEmoji: u.role === 'admin' ? '👑' : '🎮',
            postColor: u.role === 'admin' ? '#facc15' : '#94a3b8',
            deviceId: u.deviceId || `dev-${Buffer.from(u.email).toString('hex').slice(0, 14)}`,
            deviceFingerprint: u.deviceFingerprint || '',
            os: 'Web Browser',
            browser: 'Browser Session',
            ip: 'Active',
            lastActive: u.lastActive || u.createdAt || new Date(),
            createdAt: u.createdAt || new Date(),
            status: 'ACTIVE'
          });
        }
      }
    } catch (syncErr) {
      console.error('Device sync error:', syncErr);
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

    // Metrics Stats
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      totalDevices: devices.length,
      activeToday: devices.filter(d => !d.isBlocked && d.lastActive && new Date(d.lastActive) >= oneDayAgo).length,
      staffDevices: devices.filter(d => d.role && d.role !== 'player' && d.role !== 'user').length,
      blockedCount: blockedList.length
    };

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
