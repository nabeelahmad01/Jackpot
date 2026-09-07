import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = String(searchParams.get('date') || '').trim(); // Expected format: YYYY-MM-DD

    if (!dateParam) {
      return NextResponse.json({ success: false, message: 'Date parameter is required.' }, { status: 400 });
    }

    const parts = dateParam.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return NextResponse.json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    const [targetYear, targetMonth, targetDay] = parts;

    // Buffer range for MongoDB query
    const startWindow = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay - 2, 0, 0, 0, 0));
    const endWindow = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 2, 23, 59, 59, 999));

    const db = await getDb();

    const transactions = await db.collection('transactions')
      .find(
        {
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
      )
      .toArray();

    let totalIn = 0;
    let totalOut = 0;

    const matchesTargetDate = (rawDate) => {
      if (!rawDate) return false;
      const str = String(rawDate).trim();
      if (str.startsWith(dateParam)) return true;

      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return false;

      // 1. UTC match
      if (d.getUTCFullYear() === targetYear && (d.getUTCMonth() + 1) === targetMonth && d.getUTCDate() === targetDay) {
        return true;
      }
      // 2. Local match
      if (d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth && d.getDate() === targetDay) {
        return true;
      }
      // 3. PKT / Asian timezone (UTC+5) match
      const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
      if (pkt.getUTCFullYear() === targetYear && (pkt.getUTCMonth() + 1) === targetMonth && pkt.getUTCDate() === targetDay) {
        return true;
      }
      return false;
    };

    transactions.forEach((tx) => {
      const isMatch = matchesTargetDate(tx.date) || matchesTargetDate(tx.createdAt);
      if (!isMatch) return;

      const amount = parseFloat(tx.amount) || 0;
      if (tx.type === 'DEPOSIT') {
        totalIn += amount;
      } else if (tx.type === 'WITHDRAW') {
        const val = (tx.payoutSent !== undefined && tx.payoutSent !== null && tx.payoutSent !== '') 
          ? parseFloat(tx.payoutSent) 
          : amount;
        totalOut += val;
      }
    });

    return NextResponse.json({
      success: true,
      date: dateParam,
      totalIn,
      totalOut
    });
  } catch (err) {
    console.error('Fetch Date Stats API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
