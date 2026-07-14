import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

// GET gets all staff members (non-user roles) and their last active status
export async function GET(req) {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');

    // Fetch staff (roles: support_admin, financial_admin, coins_admin, operation_admin, admin, distributor_staff)
    const staff = await usersCollection.find(
      { role: { $in: ['admin', 'operation_admin', 'financial_admin', 'coins_admin', 'support_admin', 'distributor_staff'] } },
      { projection: { name: 1, email: 1, role: 1, lastActive: 1 } }
    ).toArray();

    // Calculate active staff list (heartbeat in the last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeStaff = staff.filter(s => s.lastActive && new Date(s.lastActive) > tenMinutesAgo);

    let hasUnrespondedRequest = false;
    let pendingCount = 0;

    const parseDateSafe = (dateStr) => {
      if (!dateStr) return 0;
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) return parsed;
      // Fallback for localized string formats like "7/14/2026, 7:52:08 AM"
      try {
        const clean = dateStr.replace(/[^0-9a-zA-Z\s\/\:\,]/g, '');
        const parts = clean.split(',');
        if (parts.length > 0) {
          const parsedClean = Date.parse(parts[0] + (parts[1] || ''));
          if (!isNaN(parsedClean)) return parsedClean;
        }
      } catch (e) {}
      return 0;
    };

    if (activeStaff.length > 0) {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

      // Check accountRequests
      const pendingAccounts = await db.collection('accountRequests').find({ status: 'PENDING' }).toArray();
      const unrespondedAccounts = pendingAccounts.filter(r => {
        const time = r.createdAt || r.timestamp || r.date;
        const parsedTime = parseDateSafe(time);
        return parsedTime > 0 && parsedTime < twoMinutesAgo;
      });

      // Check transactions
      const pendingTx = await db.collection('transactions').find({ status: 'PENDING' }).toArray();
      const unrespondedTx = pendingTx.filter(t => {
        const time = t.createdAt || t.timestamp || t.date;
        const parsedTime = parseDateSafe(time);
        return parsedTime > 0 && parsedTime < twoMinutesAgo;
      });

      // Check coinsNotifications
      const pendingCoins = await db.collection('coinsNotifications').find({ status: { $in: ['PENDING', 'CLAIM_REQUESTED'] } }).toArray();
      const unrespondedCoins = pendingCoins.filter(n => {
        const time = n.createdAt || n.timestamp || n.date;
        const parsedTime = parseDateSafe(time);
        return parsedTime > 0 && parsedTime < twoMinutesAgo;
      });

      pendingCount = unrespondedAccounts.length + unrespondedTx.length + unrespondedCoins.length;
      if (pendingCount > 0) {
        hasUnrespondedRequest = true;
      }
    }

    return NextResponse.json({
      success: true,
      staff,
      activeStaffCount: activeStaff.length,
      activeStaffList: activeStaff,
      hasUnrespondedRequest,
      pendingCount
    });
  } catch (err) {
    console.error('Fetch Activity API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST updates lastActive heartbeat for an administrator
export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    await usersCollection.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { lastActive: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true, message: 'Heartbeat registered.' });
  } catch (err) {
    console.error('Update Heartbeat API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
