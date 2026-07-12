import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const adminRole = searchParams.get('adminRole');
    const adminDistributorId = searchParams.get('adminDistributorId');

    // Contextual cache key to prevent collision
    const cacheKey = `admin_stats_${adminRole || 'anon'}_${adminDistributorId || 'global'}`;
    const cachedStats = cache.get(cacheKey);
    if (cachedStats) {
      return NextResponse.json({ success: true, stats: cachedStats });
    }

    const db = await getDb();

    let baseQuery = {};
    if (adminRole && adminRole !== 'admin') {
      if (adminDistributorId) {
        baseQuery.distributorId = adminDistributorId;
      } else {
        const distributorsCollection = db.collection('distributors');
        const typeADistributors = await distributorsCollection.find({ type: 'A' }).project({ id: 1 }).toArray();
        const typeADistIds = typeADistributors.map(d => d.id);
        baseQuery.distributorId = { $in: [null, '', ...typeADistIds] };
      }
    }

    // Run pending queue counts in parallel
    const [
      pendingRequestsCount,
      pendingTransactionsCount,
      pendingCoinsCount,
      unreadChatUsers
    ] = await Promise.all([
      db.collection('accountRequests').countDocuments({ ...baseQuery, status: 'PENDING' }),
      db.collection('transactions').countDocuments({ ...baseQuery, status: 'PENDING' }),
      db.collection('coinsNotifications').countDocuments({ ...baseQuery, status: { $in: ['PENDING', 'CLAIM_REQUESTED'] } }),
      db.collection('supportMessages').distinct('userEmail', { senderType: 'player', read: false })
    ]);

    const pendingChatsCount = unreadChatUsers.length;

    // Fetch successful transactions with projection to compute financial summaries
    const successfulTx = await db.collection('transactions')
      .find(
        { ...baseQuery, status: 'SUCCESS' },
        { projection: { amount: 1, type: 1, date: 1 } }
      )
      .toArray();

    // Financial calculations
    let todayDeposits = 0;
    let todayWithdrawals = 0;
    let yesterdayDeposits = 0;
    let yesterdayWithdrawals = 0;

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toDateString();

    successfulTx.forEach((tx) => {
      const txDate = new Date(tx.date);
      const txDateStr = txDate.toDateString();
      const amount = parseFloat(tx.amount) || 0;

      if (txDateStr === todayStr) {
        if (tx.type === 'DEPOSIT') todayDeposits += amount;
        else if (tx.type === 'WITHDRAW') todayWithdrawals += amount;
      } else if (txDateStr === yesterdayStr) {
        if (tx.type === 'DEPOSIT') yesterdayDeposits += amount;
        else if (tx.type === 'WITHDRAW') yesterdayWithdrawals += amount;
      }
    });

    const stats = {
      todayDeposits,
      todayWithdrawals,
      yesterdayDeposits,
      yesterdayWithdrawals,
      pendingRequestsCount,
      pendingTransactionsCount,
      pendingCoinsCount,
      pendingChatsCount
    };

    // Cache the statistics for 60 seconds
    cache.set(cacheKey, stats, 60);

    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error('Fetch Admin Stats Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
