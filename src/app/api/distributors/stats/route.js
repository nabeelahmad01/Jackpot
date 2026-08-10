import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { calcCommissionFromProfit, calcNetProfit } from '../../../../lib/commission';

// GET stats, referred players, and transactions ledger for a distributor
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');
    const usersCollection = db.collection('users');
    const transactionsCollection = db.collection('transactions');

    const distributor = await distributorsCollection.findOne({ id: distributorId });
    if (!distributor) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    // 1. Fetch referred users
    const players = await usersCollection.find(
      { distributorId, role: 'user' },
      { projection: { name: 1, email: 1, role: 1, coins: 1, isSubscribed: 1 } }
    ).toArray();
    const playerEmails = players.map(p => (p.email || '').toLowerCase().trim()).filter(Boolean);

    // 2. Fetch transaction logs and compile totals
    let transactions = [];
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    if (playerEmails.length > 0) {
      // Find all successful transactions to compute totals
      const successTxs = await transactionsCollection.find({
        userEmail: { $in: playerEmails },
        status: 'SUCCESS'
      }).toArray();

      successTxs.forEach(tx => {
        if (tx.type === 'DEPOSIT' && !tx.isDepositFromCashout) {
          totalDeposits += parseFloat(tx.amount || 0);
        } else if (tx.type === 'WITHDRAW') {
          const val = (tx.payoutSent !== undefined && tx.payoutSent !== null) ? parseFloat(tx.payoutSent) : parseFloat(tx.amount || 0);
          totalWithdrawals += val;
        }
      });

      // Get full transaction history (all statuses) sorted by date/ID descending
      transactions = await transactionsCollection.find({
        userEmail: { $in: playerEmails }
      })
      .sort({ id: -1 })
      .toArray();
    }

    let pendingLedgerCount = 0;
    let unreadChatsCount = 0;

    if (playerEmails.length > 0) {
      const [pLedger, unreadChats] = await Promise.all([
        transactionsCollection.countDocuments({
          userEmail: { $in: playerEmails },
          status: { $in: ['PENDING', 'PENDING_COINS'] }
        }),
        db.collection('supportMessages').distinct('userEmail', { distributorId, senderType: 'player', read: false })
      ]);
      pendingLedgerCount = pLedger;
      unreadChatsCount = unreadChats.length;
    } else {
      const unreadChats = await db.collection('supportMessages').distinct('userEmail', { distributorId, senderType: 'player', read: false });
      unreadChatsCount = unreadChats.length;
    }

    const netProfit = calcNetProfit(totalDeposits, totalWithdrawals);
    const commissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, distributor.commissionRate);
    const websiteCommissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, distributor.websiteCommissionRate);

    return NextResponse.json({
      success: true,
      stats: {
        playersCount: players.length,
        totalDeposits,
        totalWithdrawals,
        netProfit,
        commissionEarned,
        commissionRate: distributor.commissionRate || 0,
        websiteCommissionEarned,
        websiteCommissionRate: distributor.websiteCommissionRate || 0,
        pendingLedgerCount,
        unreadChatsCount
      },
      players,
      transactions
    });
  } catch (err) {
    console.error('Fetch Distributor Stats API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
