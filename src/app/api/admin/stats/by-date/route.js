import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date'); // Expected format: YYYY-MM-DD

    if (!dateParam) {
      return NextResponse.json({ success: false, message: 'Date parameter is required.' }, { status: 400 });
    }

    const targetDate = new Date(dateParam);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const targetDateStr = targetDate.toDateString();

    // Narrow Mongo scan (±1 day on createdAt) then apply the same toDateString filter as before
    const looseStart = new Date(targetDate);
    looseStart.setDate(looseStart.getDate() - 1);
    looseStart.setHours(0, 0, 0, 0);
    const looseEnd = new Date(targetDate);
    looseEnd.setDate(looseEnd.getDate() + 1);
    looseEnd.setHours(23, 59, 59, 999);

    const db = await getDb();

    const transactions = await db.collection('transactions')
      .find(
        {
          status: 'SUCCESS',
          $or: [
            { createdAt: { $gte: looseStart.toISOString(), $lte: looseEnd.toISOString() } },
            { createdAt: { $gte: looseStart, $lte: looseEnd } },
            { createdAt: { $exists: false } },
            { createdAt: null },
            { createdAt: '' }
          ]
        },
        { projection: { amount: 1, payoutSent: 1, type: 1, date: 1, isDepositFromCashout: 1 } }
      )
      .toArray();

    let totalIn = 0;
    let totalOut = 0;

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const txDate = new Date(tx.date);
      if (txDate.toDateString() === targetDateStr) {
        const amount = parseFloat(tx.amount) || 0;
        if (tx.type === 'DEPOSIT' && !tx.isDepositFromCashout) {
          totalIn += amount;
        } else if (tx.type === 'WITHDRAW') {
          const val = (tx.payoutSent !== undefined && tx.payoutSent !== null) ? parseFloat(tx.payoutSent) : amount;
          totalOut += val;
        }
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
