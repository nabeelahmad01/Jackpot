import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET transactions (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    if (search) {
      const cleanSearch = search.trim();
      const searchCriteria = {
        $or: [
          { userEmail: { $regex: cleanSearch, $options: 'i' } },
          { gateway: { $regex: cleanSearch, $options: 'i' } },
          { type: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
      if (email) {
        query = { $and: [query, searchCriteria] };
      } else {
        query = searchCriteria;
      }
    }

    const totalTransactions = await transactionsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Sort by id descending in database (highly optimized using id index)
    const transactions = await transactionsCollection.find(query)
      .sort({ id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Fetch user game usernames for transactions in a batch (optimized from N+1 queries)
    const txPairs = transactions.filter(t => t.gameTitle && t.userEmail);
    const accountsMap = {};
    
    if (txPairs.length > 0) {
      const matchCriteria = txPairs.map(t => ({
        userEmail: t.userEmail.toLowerCase().trim(),
        gameTitle: t.gameTitle
      }));
      const gameAccountsCollection = db.collection('gameAccounts');
      const accounts = await gameAccountsCollection.find({ $or: matchCriteria }).toArray();
      accounts.forEach(a => {
        const key = `${a.userEmail.toLowerCase().trim()}_${a.gameTitle}`;
        accountsMap[key] = a.username;
      });
    }

    for (const tx of transactions) {
      if (tx.gameTitle && tx.userEmail) {
        const key = `${tx.userEmail.toLowerCase().trim()}_${tx.gameTitle}`;
        tx.gameUsername = accountsMap[key] || '';
      } else {
        tx.gameUsername = '';
      }
    }

    return NextResponse.json({
      success: true,
      transactions,
      totalTransactions,
      totalPages: Math.ceil(totalTransactions / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Fetch Transactions API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST submit transaction (Deposit or Withdrawal request)
export async function POST(req) {
  try {
    const newTx = await req.json();

    if (!newTx.type || !newTx.amount || !newTx.userEmail) {
      return NextResponse.json({ success: false, message: 'Missing transaction details.' }, { status: 400 });
    }

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    const txObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      userEmail: newTx.userEmail.toLowerCase().trim(),
      date: new Date().toLocaleString(),
      status: newTx.type === 'WITHDRAW' ? 'PENDING_COINS' : newTx.type === 'BONUS' ? 'SUCCESS' : 'PENDING',
      note: '',
      ...newTx
    };

    await transactionsCollection.insertOne(txObject);

    if (txObject.type === 'WITHDRAW') {
      const notificationsCollection = db.collection('coinsNotifications');
      await notificationsCollection.insertOne({
        id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
        userEmail: txObject.userEmail,
        gameTitle: txObject.gameTitle || 'Lobby',
        depositAmount: parseFloat(txObject.amount),
        bonusApplied: -1, // Indicates deduction/withdrawal action
        totalCoins: -parseFloat(txObject.amount), // Negative value indicates deduction
        status: 'PENDING',
        read: false,
        timestamp: new Date().toISOString(),
        transactionId: txObject.id
      });
    } else if (txObject.type === 'BONUS' && txObject.code === 'SIGNUP-FREE3') {
      const notificationsCollection = db.collection('coinsNotifications');
      await notificationsCollection.insertOne({
        id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
        userEmail: txObject.userEmail,
        gameTitle: txObject.gameTitle || 'Lobby',
        depositAmount: 0,
        bonusApplied: 100, // 100% bonus indicator for signup freeplay
        totalCoins: parseFloat(txObject.amount),
        status: 'PENDING',
        read: false,
        timestamp: new Date().toISOString(),
        transactionId: txObject.id
      });
    }

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, transaction: txObject, message: 'Transaction request submitted successfully!' });
  } catch (err) {
    console.error('Create Transaction API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update transaction status (Admin action - approve/decline)
export async function PUT(req) {
  try {
    const { id, status, note } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'Transaction ID and status are required.' }, { status: 400 });
    }

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    const originalTx = await transactionsCollection.findOne({ id });
    if (!originalTx) {
      return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
    }

    const updateFields = { status };
    if (note !== undefined) {
      updateFields.note = note;
    }

    await transactionsCollection.updateOne({ id }, { $set: updateFields });

    // Trigger Coins notification if this transaction is approved as SUCCESS and it is a DEPOSIT or a BONUS
    if (status === 'SUCCESS' && (originalTx.type === 'DEPOSIT' || originalTx.type === 'BONUS') && originalTx.status !== 'SUCCESS') {
      try {
        const userEmail = originalTx.userEmail.toLowerCase();
        
        // 1. Count other existing successful deposits (uses compound index)
        const successfulDepositsCount = await transactionsCollection.countDocuments({
          userEmail,
          type: 'DEPOSIT',
          status: 'SUCCESS',
          id: { $ne: id }
        });

        const isFirstDeposit = successfulDepositsCount === 0;

        // 2. Fetch system settings
        const settingsCollection = db.collection('settings');
        let settings = await settingsCollection.findOne({ id: 'global_settings' });
        if (!settings) {
          settings = { firstDepositBonus: 300, regularDepositBonus: 20 };
        }

        const isBonus = originalTx.type === 'BONUS';
        const bonusPercentage = isBonus ? 0 : (isFirstDeposit ? settings.firstDepositBonus : settings.regularDepositBonus);
        
        // Calculate total coins to allot
        const amount = parseFloat(originalTx.amount);
        const totalCoins = isBonus ? amount : (amount * (1 + bonusPercentage / 100));

        // 3. Insert notification for the Coins Manager
        const notificationsCollection = db.collection('coinsNotifications');
        await notificationsCollection.insertOne({
          id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
          userEmail,
          gameTitle: originalTx.gameTitle || 'Lobby',
          depositAmount: amount,
          bonusApplied: bonusPercentage,
          totalCoins: Math.round(totalCoins * 100) / 100,
          status: 'PENDING',
          read: false,
          timestamp: new Date().toISOString()
        });

        // 4. Referral System Bonus: Check if this depositor was referred by someone
        const usersCollection = db.collection('users');
        const depositor = await usersCollection.findOne({ email: userEmail });
        if (depositor && depositor.referredBy && originalTx.type === 'DEPOSIT' && isFirstDeposit) {
          const referrerEmail = depositor.referredBy.toLowerCase().trim();
          
          // Get referral reward percentage (default: 10%)
          const refBonusPercent = (settings && settings.referralBonus !== undefined) ? Number(settings.referralBonus) : 10;
          
          if (refBonusPercent > 0) {
            const rewardCoins = amount * (refBonusPercent / 100);
            
            // Insert referral reward notification for the Coins Manager (to allot to the Referrer)
            await notificationsCollection.insertOne({
              id: Date.now().toString() + Math.floor(Math.random() * 100 + 1).toString(),
              userEmail: referrerEmail,
              gameTitle: 'Referral Reward', // Clearly labels this as a referral reward allotment
              depositAmount: amount, // The referred friend's deposit amount
              bonusApplied: refBonusPercent, // The config %
              totalCoins: Math.round(rewardCoins * 100) / 100, // Reward amount
              status: 'PENDING',
              read: false,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (notiErr) {
        console.error('Failed to generate coin allotment notification:', notiErr);
      }
    }

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: `Transaction status updated to ${status}!` });
  } catch (err) {
    console.error('Update Transaction API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

