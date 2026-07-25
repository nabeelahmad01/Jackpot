import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const adminDistributorId = searchParams.get('adminDistributorId');
    const cacheKey = `gateway_stats_${adminDistributorId || 'platform'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, stats: cached });
    }

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    const matchCriteria = {
      status: 'SUCCESS',
      type: { $in: ['DEPOSIT', 'WITHDRAW'] }
    };

    if (adminDistributorId) {
      matchCriteria.distributorId = adminDistributorId;
    } else {
      matchCriteria.$or = [
        { distributorId: { $exists: false } },
        { distributorId: null },
        { distributorId: '' }
      ];
    }

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
                  { $toDouble: { $ifNull: ['$amount', 0] } },
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

    cache.set(cacheKey, stats, 45);
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error('Failed to fetch gateway stats:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
