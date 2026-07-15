import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';
import { calcCommissionFromProfit, calcNetProfit } from '../../../../../lib/commission';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');
    const dateParam = searchParams.get('date');

    if (!distributorId || !dateParam) {
      return NextResponse.json({ success: false, message: 'Missing distributorId or date.' }, { status: 400 });
    }

    const targetDate = new Date(dateParam);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ success: false, message: 'Invalid date format.' }, { status: 400 });
    }
    const targetDateStr = targetDate.toDateString();

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');
    const usersCollection = db.collection('users');
    const transactionsCollection = db.collection('transactions');

    // Find distributor to get rates
    const dist = await distributorsCollection.findOne({ id: distributorId });
    if (!dist) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    const commissionRate = parseFloat(dist.commissionRate || 0);
    const websiteCommissionRate = parseFloat(dist.websiteCommissionRate || 0);

    // Find referred players
    const players = await usersCollection.find(
      { distributorId, role: 'user' },
      { projection: { email: 1 } }
    ).toArray();

    const playerEmails = players.map(p => (p.email || '').toLowerCase().trim()).filter(Boolean);

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    if (playerEmails.length > 0) {
      // Find success transactions on that date
      const txs = await transactionsCollection.find({
        userEmail: { $in: playerEmails },
        status: 'SUCCESS'
      }).toArray();

      txs.forEach(tx => {
        if (!tx.date) return;
        const txDate = new Date(tx.date);
        if (txDate.toDateString() === targetDateStr) {
          const amt = parseFloat(tx.amount || 0);
          if (tx.type === 'DEPOSIT') {
            totalDeposits += amt;
          } else if (tx.type === 'WITHDRAW') {
            totalWithdrawals += amt;
          }
        }
      });
    }

    const netProfit = calcNetProfit(totalDeposits, totalWithdrawals);
    const commissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, commissionRate);
    const websiteCommissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, websiteCommissionRate);

    return NextResponse.json({
      success: true,
      date: dateParam,
      totalDeposits,
      totalWithdrawals,
      netProfit,
      commissionEarned,
      websiteCommissionEarned,
      commissionRate,
      websiteCommissionRate
    });
  } catch (err) {
    console.error('Distributor Date Stats Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
