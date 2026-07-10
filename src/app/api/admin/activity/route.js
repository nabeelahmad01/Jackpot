import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

// GET gets all staff members (non-user roles) and their last active status
export async function GET(req) {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');

    // Fetch staff (roles: support_admin, financial_admin, coins_admin)
    const staff = await usersCollection.find(
      { role: { $in: ['support_admin', 'financial_admin', 'coins_admin'] } },
      { projection: { name: 1, email: 1, role: 1, lastActive: 1 } }
    ).toArray();

    // Calculate active staff list (heartbeat in the last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeStaff = staff.filter(s => s.lastActive && new Date(s.lastActive) > tenMinutesAgo);

    let hasUnrespondedRequest = false;
    let pendingCount = 0;

    if (activeStaff.length > 0) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      // Check accountRequests
      const pendingAccounts = await db.collection('accountRequests').find({ status: 'PENDING' }).toArray();
      const unrespondedAccounts = pendingAccounts.filter(r => {
        const time = r.timestamp || r.date;
        return time && new Date(time) < twoMinutesAgo;
      });

      // Check transactions
      const pendingTx = await db.collection('transactions').find({ status: 'PENDING' }).toArray();
      const unrespondedTx = pendingTx.filter(t => {
        const time = t.date;
        return time && new Date(time) < twoMinutesAgo;
      });

      // Check coinsNotifications
      const pendingCoins = await db.collection('coinsNotifications').find({ status: { $in: ['PENDING', 'CLAIM_REQUESTED'] } }).toArray();
      const unrespondedCoins = pendingCoins.filter(n => {
        const time = n.timestamp || n.date;
        return time && new Date(time) < twoMinutesAgo;
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
