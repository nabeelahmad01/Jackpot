import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const adminDistributorId = searchParams.get('adminDistributorId');
    const monthParam = searchParams.get('month') || 'current'; // 'current' | 'YYYY-MM' | 'all'

    const cacheKey = `gateway_stats_${adminDistributorId || 'platform'}_${monthParam}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, stats: cached, month: monthParam });
    }

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    const conditions = [
      { status: 'SUCCESS' },
      { type: { $in: ['DEPOSIT', 'WITHDRAW'] } }
    ];

    if (adminDistributorId) {
      conditions.push({ distributorId: adminDistributorId });
    } else {
      conditions.push({
        $or: [
          { distributorId: { $exists: false } },
          { distributorId: null },
          { distributorId: '' }
        ]
      });
    }

    if (monthParam !== 'all') {
      let year, monthIdx;
      const now = new Date();

      if (monthParam === 'current') {
        year = now.getFullYear();
        monthIdx = now.getMonth();
      } else {
        const parts = monthParam.split('-');
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          year = parseInt(parts[0], 10);
          monthIdx = parseInt(parts[1], 10) - 1;
        } else {
          year = now.getFullYear();
          monthIdx = now.getMonth();
        }
      }

      const startOfMonth = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
      const startIso = startOfMonth.toISOString();
      const endIso = endOfMonth.toISOString();

      conditions.push({
        $or: [
          { createdAt: { $gte: startIso, $lte: endIso } },
          { date: { $gte: startIso, $lte: endIso } }
        ]
      });
    }

    const matchCriteria = { $and: conditions };

    const rows = await transactionsCollection
      .aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: { $ifNull: ['$gateway', 'Unknown'] },
            received: {
              $sum: {
                $cond: [
                  { $eq: ['$type', 'DEPOSIT'] },
                  { $toDouble: { $ifNull: ['$amount', 0] } },
                  0
                ]
              }
            },
            withdrawn: {
              $sum: {
                $cond: [
                  { $eq: ['$type', 'WITHDRAW'] },
                  { $toDouble: { $ifNull: ['$payoutSent', { $ifNull: ['$amount', 0] }] } },
                  0
                ]
              }
            }
          }
        }
      ])
      .toArray();

    const stats = rows.map((item) => {
      const received = Math.round((item.received || 0) * 100) / 100;
      const withdrawn = Math.round((item.withdrawn || 0) * 100) / 100;
      return {
        gateway: String(item._id || 'Unknown').trim() || 'Unknown',
        received,
        withdrawn,
        net: Math.round((received - withdrawn) * 100) / 100
      };
    });

    cache.set(cacheKey, stats, 30);
    return NextResponse.json({ success: true, stats, month: monthParam });
  } catch (err) {
    console.error('Failed to fetch gateway stats:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
