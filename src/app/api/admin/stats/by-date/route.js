import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

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
    const dateParam = String(searchParams.get('date') || '').trim(); // Expected format: YYYY-MM-DD

    if (!dateParam) {
      return NextResponse.json({ success: false, message: 'Date parameter is required.' }, { status: 400 });
    }

    const parts = dateParam.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return NextResponse.json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    const [targetYear, targetMonth, targetDay] = parts;

    const db = await getDb();

    const transactions = await db.collection('transactions')
      .find(
        {
          status: 'SUCCESS',
          type: { $in: ['DEPOSIT', 'WITHDRAW'] },
          isDepositFromCashout: { $ne: true }
        },
        { projection: { amount: 1, payoutSent: 1, type: 1, date: 1, createdAt: 1, isDepositFromCashout: 1 } }
      )
      .toArray();

    let totalIn = 0;
    let totalOut = 0;

    transactions.forEach((tx) => {
      const isMatch = isSameCalendarDay(tx.date, targetYear, targetMonth, targetDay, dateParam) ||
                      isSameCalendarDay(tx.createdAt, targetYear, targetMonth, targetDay, dateParam);
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
