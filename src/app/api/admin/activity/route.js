import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { typeBExclusionFilter } from '../../../../lib/typeBDistributors';
import { cache } from '../../../../lib/cache';
import { notifyStaffAsync } from '../../../../lib/pushNotifications';

// Pending items older than this (with staff online) count as unresponded.
const UNRESPONDED_AFTER_MS = 5 * 60 * 1000;

// GET gets all staff members (non-user roles) and their last active status
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const adminDistributorId = searchParams.get('adminDistributorId');

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
    let unrespondedRequests = [];

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
      const staleBefore = Date.now() - UNRESPONDED_AFTER_MS;

      // 1. Build queries based on distributor role
      let accountReqQuery = { status: 'PENDING' };
      let txQuery = { status: 'PENDING' };
      let coinsNotiQuery = { status: { $in: ['PENDING', 'CLAIM_REQUESTED'] } };

      if (adminDistributorId) {
        accountReqQuery.distributorId = adminDistributorId;
        txQuery.distributorId = adminDistributorId;
        coinsNotiQuery.distributorId = adminDistributorId;
      } else {
        // Exclude Type B distributor account requests & transactions & coins notifications
        const exclusion = await typeBExclusionFilter(db);
        accountReqQuery = { $and: [accountReqQuery, exclusion] };
        txQuery = { $and: [txQuery, exclusion] };
        coinsNotiQuery = { $and: [coinsNotiQuery, exclusion] };
      }

      // Check accountRequests
      const pendingAccounts = await db.collection('accountRequests').find(accountReqQuery).toArray();
      const unrespondedAccounts = pendingAccounts.filter(r => {
        const time = r.createdAt || r.timestamp || r.date;
        const parsedTime = parseDateSafe(time);
        return parsedTime > 0 && parsedTime < staleBefore;
      });

      // Check transactions
      const pendingTx = await db.collection('transactions').find(txQuery).toArray();
      const unrespondedTx = pendingTx.filter(t => {
        const time = t.createdAt || t.timestamp || t.date;
        const parsedTime = parseDateSafe(time);
        return parsedTime > 0 && parsedTime < staleBefore;
      });

      // Check coinsNotifications
      const pendingCoins = await db.collection('coinsNotifications').find(coinsNotiQuery).toArray();
      const unrespondedCoins = pendingCoins.filter(n => {
        const time = n.createdAt || n.timestamp || n.date;
        const parsedTime = parseDateSafe(time);
        return parsedTime > 0 && parsedTime < staleBefore;
      });

      // Populate unresponded list
      unrespondedAccounts.forEach(r => {
        unrespondedRequests.push({
          id: r.id,
          type: 'Account Request',
          detail: `Game account creation request for ${r.gameTitle} (${r.userEmail})`,
          time: r.createdAt || r.timestamp || r.date
        });
      });

      unrespondedTx.forEach(t => {
        unrespondedRequests.push({
          id: t.id,
          type: `${t.type} Request`,
          detail: `${t.type} of $${parseFloat(t.amount || 0).toFixed(2)} for ${t.userEmail} on ${t.gameTitle || 'Lobby'}`,
          time: t.createdAt || t.timestamp || t.date
        });
      });

      unrespondedCoins.forEach(n => {
        const amt = parseFloat(n.totalCoins || 0);
        unrespondedRequests.push({
          id: n.id,
          type: 'Coins Allotment',
          detail: `${amt > 0 ? 'Add' : 'Deduct'} ${Math.abs(amt)} coins for ${n.userEmail} on ${n.gameTitle}`,
          time: n.createdAt || n.timestamp || n.date
        });
      });

      pendingCount = unrespondedRequests.length;
      if (pendingCount > 0) {
        hasUnrespondedRequest = true;
      }
    }

    // Portal lock-screen: remind staff once per window when work sits > 5 min
    // (HQ view only — distributor panels use their own distributor push path).
    if (hasUnrespondedRequest && !adminDistributorId) {
      const throttleKey = 'staff_unresponded_push_v1';
      if (!cache.get(throttleKey)) {
        cache.set(throttleKey, Date.now(), 5 * 60);
        notifyStaffAsync(db, {
          title: 'Requests waiting 5+ minutes',
          body: `${pendingCount} pending task(s) need a response. Open Jackpot Portal.`,
          url: '/admin',
          tag: 'staff-unresponded-5m',
          alertKind: 'general'
        });
      }
    }

    return NextResponse.json({
      success: true,
      staff,
      activeStaffCount: activeStaff.length,
      activeStaffList: activeStaff,
      hasUnrespondedRequest,
      pendingCount,
      unrespondedRequests
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
