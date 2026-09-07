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

    const parts = dateParam.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return NextResponse.json({ success: false, message: 'Invalid date format.' }, { status: 400 });
    }
    const [targetYear, targetMonth, targetDay] = parts;

    const startWindow = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay - 2, 0, 0, 0, 0));
    const endWindow = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 2, 23, 59, 59, 999));

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');
    const usersCollection = db.collection('users');
    const transactionsCollection = db.collection('transactions');

    const dist = await distributorsCollection.findOne({ id: distributorId });
    if (!dist) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    const commissionRate = parseFloat(dist.commissionRate || 0);
    const websiteCommissionRate = parseFloat(dist.websiteCommissionRate || 0);

    const players = await usersCollection.find(
      { distributorId, role: 'user' },
      { projection: { email: 1 } }
    ).toArray();

    const playerEmails = players.map(p => (p.email || '').toLowerCase().trim()).filter(Boolean);

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    const matchesTargetDate = (rawDate) => {
      if (!rawDate) return false;
      const str = String(rawDate).trim();
      if (str.startsWith(dateParam)) return true;

      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return false;

      if (d.getUTCFullYear() === targetYear && (d.getUTCMonth() + 1) === targetMonth && d.getUTCDate() === targetDay) {
        return true;
      }
      if (d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth && d.getDate() === targetDay) {
        return true;
      }
      const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
      if (pkt.getUTCFullYear() === targetYear && (pkt.getUTCMonth() + 1) === targetMonth && pkt.getUTCDate() === targetDay) {
        return true;
      }
      return false;
    };

    if (playerEmails.length > 0) {
      const txs = await transactionsCollection.find(
        {
          userEmail: { $in: playerEmails },
          status: 'SUCCESS',
          type: { $in: ['DEPOSIT', 'WITHDRAW'] },
          isDepositFromCashout: { $ne: true },
          $or: [
            { date: { $regex: `^${dateParam}` } },
            { date: { $gte: startWindow.toISOString(), $lte: endWindow.toISOString() } },
            { date: { $gte: startWindow, $lte: endWindow } },
            { createdAt: { $gte: startWindow.toISOString(), $lte: endWindow.toISOString() } },
            { createdAt: { $gte: startWindow, $lte: endWindow } }
          ]
        },
        { projection: { amount: 1, payoutSent: 1, type: 1, date: 1, createdAt: 1, isDepositFromCashout: 1 } }
      ).toArray();

      txs.forEach(tx => {
        const isMatch = matchesTargetDate(tx.date) || matchesTargetDate(tx.createdAt);
        if (!isMatch) return;

        const amt = parseFloat(tx.amount || 0);
        if (tx.type === 'DEPOSIT') {
          totalDeposits += amt;
        } else if (tx.type === 'WITHDRAW') {
          const val = (tx.payoutSent !== undefined && tx.payoutSent !== null && tx.payoutSent !== '') 
            ? parseFloat(tx.payoutSent) 
            : amt;
          totalWithdrawals += val;
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
