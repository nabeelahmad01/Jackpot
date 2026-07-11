import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET transactions (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (id) {
      const db = await getDb();
      const tx = await db.collection('transactions').findOne({ id });
      if (!tx) {
        return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, transaction: tx });
    }

    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }
    if (status) {
      const statuses = status.split(',').map(s => s.toUpperCase().trim());
      if (statuses.length > 1) {
        query.status = { $in: statuses };
      } else {
        query.status = statuses[0];
      }
    }
    if (type) {
      query.type = type.toUpperCase().trim();
    }

    if (search) {
      const cleanSearch = search.trim();
      
      const gameAccountsCollection = db.collection('gameAccounts');
      const matchingAccs = await gameAccountsCollection.find({
        username: { $regex: cleanSearch, $options: 'i' }
      }).project({ userEmail: 1 }).toArray();
      const matchingEmails = Array.from(new Set(matchingAccs.map(a => a.userEmail.toLowerCase().trim())));

      const searchCriteria = {
        $or: [
          { userEmail: { $regex: cleanSearch, $options: 'i' } },
          { gateway: { $regex: cleanSearch, $options: 'i' } },
          { type: { $regex: cleanSearch, $options: 'i' } },
          { gameUsername: { $regex: cleanSearch, $options: 'i' } }
        ]
      };

      if (matchingEmails.length > 0) {
        searchCriteria.$or.push({ userEmail: { $in: matchingEmails } });
      }

      if (Object.keys(query).length > 0) {
        query = { $and: [query, searchCriteria] };
      } else {
        query = searchCriteria;
      }
    }

    const totalTransactions = await transactionsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Sort by id descending in database (highly optimized using id index)
    const transactions = await transactionsCollection.find(query)
      .project({
        screenshot: { $cond: { if: { $eq: [ { $ifNull: [ "$screenshot", "" ] }, "" ] }, then: false, else: true } },
        id: 1,
        userEmail: 1,
        date: 1,
        status: 1,
        note: 1,
        gameTitle: 1,
        type: 1,
        amount: 1,
        gateway: 1,
        code: 1,
        nameOnTag: 1,
        phoneOnTag: 1,
        payoutSent: 1,
        payoutHold: 1,
        approvedBy: 1,
        allottedBy: 1
      })
      .sort({ id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Fetch user game usernames for transactions in a batch (optimized from N+1 queries)
    const txPairs = transactions.filter(t => t.gameTitle && t.userEmail);
    const accountsMap = {};
    
    if (txPairs.length > 0) {
      const uniqueEmails = Array.from(new Set(txPairs.map(t => t.userEmail.toLowerCase().trim())));
      const gameAccountsCollection = db.collection('gameAccounts');
      const accounts = await gameAccountsCollection.find({ userEmail: { $in: uniqueEmails } }).toArray();
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

    if (!newTx.amount || !newTx.userEmail) {
      return NextResponse.json({ success: false, message: 'Missing transaction details.' }, { status: 400 });
    }

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    if (newTx.isRemainderRequest) {
      // Create remainder payout request
      const txObject = {
        id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
        userEmail: newTx.userEmail.toLowerCase().trim(),
        date: new Date().toLocaleString(),
        status: 'PENDING', // Directly ready for payout ledger (no coins verification needed!)
        type: 'WITHDRAW',
        amount: parseFloat(newTx.amount),
        gateway: newTx.gateway || 'Chime',
        code: newTx.code || '—',
        gameTitle: newTx.gameTitle || 'Lobby',
        note: `Remaining payout request for Tx #${newTx.parentTxId}`
      };

      await transactionsCollection.insertOne(txObject);

      // Update parent transaction
      await transactionsCollection.updateOne(
        { id: newTx.parentTxId },
        { $set: { remainderRequested: true } }
      );

      // Invalidate stats cache
      cache.del('admin_stats');

      return NextResponse.json({ success: true, transaction: txObject, message: 'Remaining payout request submitted successfully!' });
    }

    if (!newTx.type) {
      return NextResponse.json({ success: false, message: 'Missing transaction type.' }, { status: 400 });
    }

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
    const { id, status, note, payoutSent, payoutHold, processedBy } = await req.json();

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
    if (payoutSent !== undefined) {
      updateFields.payoutSent = Number(payoutSent);
    }
    if (payoutHold !== undefined) {
      updateFields.payoutHold = Number(payoutHold);
    }
    if (processedBy !== undefined) {
      updateFields.approvedBy = processedBy;
    }

    await transactionsCollection.updateOne({ id }, { $set: updateFields });

    // Deduct/refund coins from dynamic game pools on successful withdrawal processing
    if (status === 'SUCCESS' && originalTx.type === 'WITHDRAW' && originalTx.status !== 'SUCCESS') {
      try {
        const gamesCollection = db.collection('games');
        const game = await gamesCollection.findOne({ title: { $regex: new RegExp(`^${originalTx.gameTitle}$`, 'i') } });
        if (game) {
          const currentCoins = parseFloat(game.availableCoins || 0);
          const newCoins = currentCoins + parseFloat(originalTx.amount || 0);
          const currentUsed = parseFloat(game.usedCoins || 0);
          const newUsed = Math.max(0, currentUsed - parseFloat(originalTx.amount || 0));
          await gamesCollection.updateOne({ id: game.id }, { $set: { availableCoins: newCoins, usedCoins: newUsed } });
          cache.del('games_all');
        }
      } catch (poolErr) {
        console.error('Failed to update game coin pool for withdrawal success:', poolErr);
      }
    }

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
        let frontendSettings = await settingsCollection.findOne({ id: 'frontend_settings' });
        
        const firstBonusPercent = (frontendSettings && frontendSettings.firstDepositBonus !== undefined)
          ? Number(frontendSettings.firstDepositBonus)
          : (settings ? Number(settings.firstDepositBonus) : 300);

        const isBonus = originalTx.type === 'BONUS';
        const bonusPercentage = isBonus ? 0 : (isFirstDeposit ? firstBonusPercent : (settings ? Number(settings.regularDepositBonus) : 20));
        
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
          timestamp: new Date().toISOString(),
          transactionId: originalTx.id // Linked parent transaction!
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
            
            // Insert referral reward under pendingReferrals for user claim choice
            await db.collection('pendingReferrals').insertOne({
              id: Date.now().toString() + Math.floor(Math.random() * 100 + 1).toString(),
              referrerEmail,
              refereeEmail: userEmail,
              rewardCoins: Math.round(rewardCoins * 100) / 100,
              status: 'PENDING',
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

