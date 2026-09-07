import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';
import { calcCommissionFromProfit, calcNetProfit } from '../../../../../lib/commission';

function isSameCalendarDay(raw, targetYear, targetMonth, targetDay, dateParam) {
  if (!raw) return false;

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return false;
    if (raw.getUTCFullYear() === targetYear && (raw.getUTCMonth() + 1) === targetMonth && raw.getUTCDate() === targetDay) return true;
    if (raw.getFullYear() === targetYear && (raw.getMonth() + 1) === targetMonth && raw.getDate() === targetDay) return true;
    const pkt = new Date(raw.getTime() + 5 * 3600000);
    if (pkt.getUTCFullYear() === targetYear && (pkt.getUTCMonth() + 1) === targetMonth && pkt.getUTCDate() === targetDay) return true;
    return false;
  }

  const str = String(raw).trim();
  if (!str) return false;

  if (str.startsWith(dateParam)) return true;

  const y = String(targetYear);
  const m = String(targetMonth);
  const mPad = String(targetMonth).padStart(2, '0');
  const d = String(targetDay);
  const dPad = String(targetDay).padStart(2, '0');

  const prefixes = [
    `${m}/${d}/${y}`,
    `${mPad}/${dPad}/${y}`,
    `${m}/${dPad}/${y}`,
    `${mPad}/${d}/${y}`,
    `${y}-${mPad}-${dPad}`,
    `${y}-${m}-${d}`,
    `${y}/${mPad}/${dPad}`,
    `${y}/${m}/${d}`
  ];

  for (const prefix of prefixes) {
    if (str.startsWith(prefix)) return true;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    if (parsed.getUTCFullYear() === targetYear && (parsed.getUTCMonth() + 1) === targetMonth && parsed.getUTCDate() === targetDay) return true;
    if (parsed.getFullYear() === targetYear && (parsed.getMonth() + 1) === targetMonth && parsed.getDate() === targetDay) return true;
    const pkt = new Date(parsed.getTime() + 5 * 3600000);
    if (pkt.getUTCFullYear() === targetYear && (pkt.getUTCMonth() + 1) === targetMonth && pkt.getUTCDate() === targetDay) return true;
  }

  return false;
}

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

    if (playerEmails.length > 0) {
      const txs = await transactionsCollection.find(
        {
          userEmail: { $in: playerEmails },
          status: 'SUCCESS',
          type: { $in: ['DEPOSIT', 'WITHDRAW'] },
          isDepositFromCashout: { $ne: true }
        },
        { projection: { amount: 1, payoutSent: 1, type: 1, date: 1, createdAt: 1, isDepositFromCashout: 1 } }
      ).toArray();

      txs.forEach(tx => {
        const isMatch = isSameCalendarDay(tx.date, targetYear, targetMonth, targetDay, dateParam) ||
                        isSameCalendarDay(tx.createdAt, targetYear, targetMonth, targetDay, dateParam);
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
