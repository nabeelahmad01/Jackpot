import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const adminDistributorId = searchParams.get('adminDistributorId');

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

    const txs = await transactionsCollection.find(matchCriteria)
      .project({ gateway: 1, amount: 1, type: 1 })
      .toArray();

    const gatewayMap = {};
    txs.forEach(tx => {
      const gw = (tx.gateway || 'Unknown').trim();
      if (!gatewayMap[gw]) {
        gatewayMap[gw] = { gateway: gw, received: 0, withdrawn: 0 };
      }
      const val = parseFloat(tx.amount || 0);
      if (!isNaN(val)) {
        if (tx.type === 'DEPOSIT') {
          gatewayMap[gw].received += val;
        } else if (tx.type === 'WITHDRAW') {
          gatewayMap[gw].withdrawn += val;
        }
      }
    });

    const stats = Object.values(gatewayMap).map(item => ({
      gateway: item.gateway,
      received: Math.round(item.received * 100) / 100,
      withdrawn: Math.round(item.withdrawn * 100) / 100,
      net: Math.round((item.received - item.withdrawn) * 100) / 100
    }));

    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error('Failed to fetch gateway stats:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
