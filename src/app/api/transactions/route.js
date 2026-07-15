import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { buildRemainderClaimAvailableAt } from '../../../lib/claimWait';
import { calcCommissionFromProfit } from '../../../lib/commission';

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
      if (tx.type === 'WEBSITE_COMMISSION_PAYMENT') {
        const adminRole = searchParams.get('adminRole') || '';
        const userEmailParam = searchParams.get('email') || '';
        const callerEmail = userEmailParam.toLowerCase().trim();
        const txEmail = (tx.userEmail || '').toLowerCase().trim();
        if (adminRole !== 'admin' && callerEmail !== txEmail) {
          return NextResponse.json({ success: false, message: 'Access denied.' }, { status: 403 });
        }
      }
      return NextResponse.json({ success: true, transaction: tx });
    }

    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const adminRole = searchParams.get('adminRole') || '';

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    const adminDistributorId = searchParams.get('adminDistributorId');

    if (adminDistributorId) {
      query.distributorId = adminDistributorId;
    } else if (!email) {
      // Only exclude Type B distributor transactions from Super Admin/global views
      // When email is set, the player is viewing their OWN transactions — don't exclude!
      const typeBDists = await db.collection('distributors').find({ type: 'B' }).project({ id: 1 }).toArray();
      const typeBDistIds = typeBDists.map(d => d.id).filter(Boolean);
      if (typeBDistIds.length > 0) {
        query.distributorId = { $nin: typeBDistIds };
      }
    }
    if (status) {
      const statuses = status.split(',').map(s => s.toUpperCase().trim());
      if (statuses.length > 1) {
        query.status = { $in: statuses };
      } else {
        query.status = statuses[0];
      }
    }
    const isSpecifyingType = type && type.trim() !== '';

    if (isSpecifyingType) {
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

    if (!isSpecifyingType) {
      const excludedTypes = ['WEBSITE_COMMISSION_PAYMENT', 'COMMISSION_WITHDRAW', 'AFFILIATE_COMMISSION_WITHDRAW'];
      if (query.$and) {
        query.$and.push({ type: { $nin: excludedTypes } });
      } else if (query.$or) {
        query = {
          $and: [
            query,
            { type: { $nin: excludedTypes } }
          ]
        };
      } else {
        query.type = { $nin: excludedTypes };
      }
    }

    const totalTransactions = await transactionsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Sort by id descending in database (highly optimized using id index)
    const transactions = await transactionsCollection.find(query)
      .project({
        screenshot: { $cond: { if: { $eq: [ { $ifNull: [ "$screenshot", "" ] }, "" ] }, then: false, else: true } },
        payoutProof: { $cond: { if: { $eq: [ { $ifNull: [ "$payoutProof", "" ] }, "" ] }, then: false, else: true } },
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
        remainderPaid: 1,
        remainderRequested: 1,
        remainderStatus: 1,
        remainderClaimAvailableAt: 1,
        remainderWaitHours: 1,
        remainderWaitMinutes: 1,
        payoutQr: 1,
        parentTxId: 1,
        payoutAmount: 1,
        approvedBy: 1,
        allottedBy: 1,
        isFreeplayWithdraw: 1,
        gameAmount: 1
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

    const userEmail = newTx.userEmail.toLowerCase().trim();

    // Migrate any legacy PENDING freeplay bonuses directly to coins queue
    const orphanedFreeplay = await transactionsCollection.find({
      userEmail,
      type: 'BONUS',
      code: { $in: ['SIGNUP-FREE3', 'FREEPLAY'] },
      status: 'PENDING'
    }).toArray();

    if (orphanedFreeplay.length > 0) {
      const notificationsCollection = db.collection('coinsNotifications');
      for (const fp of orphanedFreeplay) {
        await transactionsCollection.updateOne({ id: fp.id }, { $set: { status: 'COINS_LOADING' } });
        const existingNoti = await notificationsCollection.findOne({ transactionId: fp.id });
        if (!existingNoti) {
          await notificationsCollection.insertOne({
            id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
            userEmail: fp.userEmail,
            gameTitle: fp.gameTitle || 'Lobby',
            depositAmount: 0,
            bonusApplied: -3,
            isFreeplay: true,
            totalCoins: parseFloat(fp.amount),
            status: 'PENDING',
            read: false,
            timestamp: new Date().toISOString(),
            transactionId: fp.id,
            distributorId: fp.distributorId || ''
          });
        }
      }
    }

    // Retrieve the player profile to extract distributorId
    const userDoc = await db.collection('users').findOne({ email: userEmail });
    const distId = userDoc ? (userDoc.distributorId || '') : '';

    if (newTx.isRemainderRequest) {
      const parentTx = await transactionsCollection.findOne({ id: newTx.parentTxId });
      const parentType = parentTx ? parentTx.type : 'WITHDRAW';

      // Create remainder payout request
      const txObject = {
        id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
        userEmail: newTx.userEmail.toLowerCase().trim(),
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString(),
        status: 'PENDING', // Directly ready for payout ledger
        type: parentType,
        amount: parseFloat(newTx.amount),
        gateway: newTx.gateway || 'Chime',
        code: newTx.code || '—',
        gameTitle: newTx.gameTitle || 'Lobby',
        note: `Remaining payout request for Tx #${newTx.parentTxId}`,
        parentTxId: newTx.parentTxId,
        distributorId: distId,
        isFreeplayWithdraw: parentTx ? Boolean(parentTx.isFreeplayWithdraw) : false
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

    if (newTx.type === 'COMMISSION_WITHDRAW') {
      // 1. Fetch the distributor profile
      const distDoc = await db.collection('distributors').findOne({ email: newTx.userEmail.toLowerCase().trim() });
      if (!distDoc) {
        return NextResponse.json({ success: false, message: 'Distributor profile not found.' }, { status: 404 });
      }

      // 2. Fetch all successful & pending commission withdrawal amounts
      const withdrawals = await db.collection('transactions').find({
        userEmail: newTx.userEmail.toLowerCase().trim(),
        type: 'COMMISSION_WITHDRAW',
        status: { $in: ['PENDING', 'SUCCESS'] }
      }).toArray();
      const totalWithdrawn = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount || 0) - parseFloat(tx.payoutHold || 0), 0);

      // 3. Get total commission earned from referral stats
      const referredPlayers = await db.collection('users').find({ distributorId: distDoc.id }).toArray();
      const playerEmails = referredPlayers.map(p => p.email.toLowerCase().trim());
      
      let commissionEarned = 0;
      if (playerEmails.length > 0) {
        const playerTxs = await db.collection('transactions').find({
          userEmail: { $in: playerEmails },
          type: { $in: ['DEPOSIT', 'WITHDRAW'] },
          status: 'SUCCESS'
        }).toArray();
        const totalDeposits = playerTxs.filter((tx) => tx.type === 'DEPOSIT').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const totalWithdrawals = playerTxs.filter((tx) => tx.type === 'WITHDRAW').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        commissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, distDoc.commissionRate);
      }

      const availableCommission = commissionEarned - totalWithdrawn;
      const requestAmount = parseFloat(newTx.amount);

      if (requestAmount > availableCommission) {
        return NextResponse.json({ success: false, message: `Insufficient commission balance. Available: $${availableCommission.toFixed(2)}` }, { status: 400 });
      }
    }

    if (newTx.type === 'AFFILIATE_COMMISSION_WITHDRAW') {
      const agentDoc = await db.collection('agents').findOne({ email: newTx.userEmail.toLowerCase().trim() });
      if (!agentDoc) {
        return NextResponse.json({ success: false, message: 'Affiliate profile not found.' }, { status: 404 });
      }

      const withdrawals = await db.collection('transactions').find({
        userEmail: newTx.userEmail.toLowerCase().trim(),
        type: 'AFFILIATE_COMMISSION_WITHDRAW',
        status: { $in: ['PENDING', 'SUCCESS'] }
      }).toArray();
      const totalWithdrawn = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount || 0) - parseFloat(tx.payoutHold || 0), 0);

      const referredPlayers = await db.collection('users').find({ agentCode: agentDoc.agentCode, role: 'user' }).toArray();
      const playerEmails = referredPlayers.map((p) => p.email.toLowerCase().trim());

      let commissionEarned = 0;
      if (playerEmails.length > 0) {
        const playerTxs = await db.collection('transactions').find({
          userEmail: { $in: playerEmails },
          type: { $in: ['DEPOSIT', 'WITHDRAW'] },
          status: 'SUCCESS'
        }).toArray();
        const totalDeposits = playerTxs.filter((tx) => tx.type === 'DEPOSIT').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        const totalWithdrawals = playerTxs.filter((tx) => tx.type === 'WITHDRAW').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        commissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, agentDoc.commissionRate);
      }

      const pendingAmount = withdrawals
        .filter((tx) => tx.status === 'PENDING')
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
      const availableCommission = commissionEarned - totalWithdrawn - pendingAmount;
      const requestAmount = parseFloat(newTx.amount);

      if (requestAmount > availableCommission) {
        return NextResponse.json({ success: false, message: `Insufficient commission balance. Available: $${availableCommission.toFixed(2)}` }, { status: 400 });
      }
    }

    const isFreeplayBonus = newTx.type === 'BONUS' && (newTx.code === 'SIGNUP-FREE3' || newTx.code === 'FREEPLAY');

    const txObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      userEmail,
      date: new Date().toLocaleString(),
      createdAt: new Date().toISOString(),
      // Freeplay goes directly to coins admin (COINS_LOADING), not finance (PENDING)
      status: newTx.type === 'WITHDRAW' ? 'PENDING_COINS' : isFreeplayBonus ? 'COINS_LOADING' : newTx.type === 'BONUS' ? 'SUCCESS' : 'PENDING',
      note: '',
      distributorId: distId,
      ...newTx
    };

    if (txObject.type === 'WITHDRAW') {
      // Server-side freeplay session: last action was freeplay, no deposit or freeplay cashout after it
      try {
        const lastFreeplay = await transactionsCollection.findOne(
          { userEmail: txObject.userEmail, type: 'BONUS', code: { $in: ['SIGNUP-FREE3', 'FREEPLAY'] }, status: 'SUCCESS' },
          { sort: { id: -1 } }
        );
        if (lastFreeplay) {
          const hasDepositAfterFreeplay = await transactionsCollection.findOne({
            userEmail: txObject.userEmail,
            type: 'DEPOSIT',
            status: 'SUCCESS',
            id: { $gt: lastFreeplay.id }
          });
          const hasFreeplayWithdrawAfter = await transactionsCollection.findOne({
            userEmail: txObject.userEmail,
            type: 'WITHDRAW',
            isFreeplayWithdraw: true,
            id: { $gt: lastFreeplay.id }
          });
          txObject.isFreeplayWithdraw = !hasDepositAfterFreeplay && !hasFreeplayWithdrawAfter;
        } else {
          txObject.isFreeplayWithdraw = false;
        }
      } catch (checkErr) {
        console.error('Error checking freeplay session state:', checkErr);
        txObject.isFreeplayWithdraw = false;
      }
      // Keep full amount on the transaction — coins admin needs the real amount to deduct
      // The amount will be capped to $30 when the coins admin approves (in coins-notifications PUT)
    }

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
        transactionId: txObject.id,
        isFreeplayWithdraw: Boolean(txObject.isFreeplayWithdraw),
        distributorId: distId
      });
    }

    // Freeplay bonus goes DIRECTLY to coins admin — create coins notification immediately
    if (isFreeplayBonus) {
      const notificationsCollection = db.collection('coinsNotifications');
      await notificationsCollection.insertOne({
        id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
        userEmail: txObject.userEmail,
        gameTitle: txObject.gameTitle || 'Lobby',
        depositAmount: 0,
        bonusApplied: -3, // indicates freeplay
        isFreeplay: true,
        totalCoins: parseFloat(txObject.amount),
        status: 'PENDING',
        read: false,
        timestamp: new Date().toISOString(),
        transactionId: txObject.id,
        distributorId: distId
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
    const { id, status, note, payoutSent, payoutHold, processedBy, payoutProof, remainderWaitHours, remainderWaitMinutes } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'Transaction ID and status are required.' }, { status: 400 });
    }

    const db = await getDb();
    const transactionsCollection = db.collection('transactions');

    const originalTx = await transactionsCollection.findOne({ id });
    if (!originalTx) {
      return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
    }

    const isFreeplayBonusTx = originalTx.type === 'BONUS' && (originalTx.code === 'SIGNUP-FREE3' || originalTx.code === 'FREEPLAY');
    if (isFreeplayBonusTx && originalTx.status === 'COINS_LOADING') {
      return NextResponse.json({ success: false, message: 'Freeplay requests are handled by the Coins team only.' }, { status: 400 });
    }

    let finalStatus = status;
    if (status === 'SUCCESS' && (originalTx.type === 'DEPOSIT' || originalTx.type === 'BONUS') && originalTx.status !== 'SUCCESS' && originalTx.status !== 'COINS_LOADING') {
      finalStatus = 'COINS_LOADING';
    }
    const updateFields = { status: finalStatus };
    if (note !== undefined) {
      updateFields.note = note;
    }
    if (payoutSent !== undefined) {
      updateFields.payoutSent = Number(payoutSent);
    }
    if (payoutHold !== undefined) {
      const holdVal = Number(payoutHold);
      updateFields.payoutHold = holdVal;
      if (holdVal <= 0) {
        updateFields.remainderPaid = true;
        updateFields.payoutHold = 0;
      }
    }
    if (processedBy !== undefined) {
      updateFields.approvedBy = processedBy;
    }
    if (payoutProof !== undefined) {
      updateFields.payoutProof = payoutProof;
    }

    if (status === 'SUCCESS' && payoutHold !== undefined && Number(payoutHold) > 0) {
      const hours = remainderWaitHours !== undefined ? Math.max(0, Number(remainderWaitHours) || 0) : 0;
      const minutes = remainderWaitMinutes !== undefined ? Math.max(0, Number(remainderWaitMinutes) || 0) : 0;
      updateFields.remainderWaitHours = hours;
      updateFields.remainderWaitMinutes = minutes;
      updateFields.remainderClaimAvailableAt = buildRemainderClaimAvailableAt(hours, minutes);
      updateFields.remainderRequested = false;
      updateFields.remainderStatus = '';
    }

    await transactionsCollection.updateOne({ id }, { $set: updateFields });

    if (status === 'SUCCESS' && originalTx.parentTxId) {
      try {
        const finalChildHold = payoutHold !== undefined ? Number(payoutHold) : parseFloat(originalTx.payoutHold || 0);
        if (finalChildHold > 0) {
          const parentUpdate = {
            payoutHold: finalChildHold,
            remainderPaid: false,
            remainderRequested: false,
            remainderStatus: ''
          };
          const hours = remainderWaitHours !== undefined ? Math.max(0, Number(remainderWaitHours) || 0) : 0;
          const minutes = remainderWaitMinutes !== undefined ? Math.max(0, Number(remainderWaitMinutes) || 0) : 0;
          if (hours > 0 || minutes > 0) {
            parentUpdate.remainderWaitHours = hours;
            parentUpdate.remainderWaitMinutes = minutes;
            parentUpdate.remainderClaimAvailableAt = buildRemainderClaimAvailableAt(hours, minutes);
          } else {
            parentUpdate.remainderClaimAvailableAt = new Date().toISOString();
          }
          await transactionsCollection.updateOne(
            { id: originalTx.parentTxId },
            { $set: parentUpdate }
          );
        } else {
          await transactionsCollection.updateOne(
            { id: originalTx.parentTxId },
            { $set: { remainderPaid: true, remainderStatus: 'SUCCESS', payoutHold: 0, remainderRequested: false } }
          );
        }
      } catch (err) {
        console.error('Failed to update parent transaction remainder status:', err);
      }
    }

    // When a remainder child tx is FAILED, reset parent's remainderRequested so claim button reappears
    if (status === 'FAILED' && originalTx.parentTxId) {
      try {
        await transactionsCollection.updateOne(
          { id: originalTx.parentTxId },
          { $set: { remainderRequested: false, remainderStatus: 'FAILED' } }
        );
      } catch (err) {
        console.error('Failed to reset parent transaction remainder status on FAILED:', err);
      }
    }

    // Deduct/refund coins from dynamic game pools on successful withdrawal processing
    if (status === 'SUCCESS' && originalTx.type === 'WITHDRAW' && originalTx.status !== 'SUCCESS') {
      try {
        const gamesCollection = db.collection('games');
        const game = await gamesCollection.findOne({ title: { $regex: new RegExp(`^${originalTx.gameTitle}$`, 'i') } });
        if (game) {
          if (originalTx.distributorId) {
            const distGamesColl = db.collection('distributorGames');
            const dg = await distGamesColl.findOne({ distributorId: originalTx.distributorId, gameId: game.id });
            const currentCoins = parseFloat(dg?.availableCoins || 0);
            const newCoins = currentCoins + parseFloat(originalTx.amount || 0);
            const currentUsed = parseFloat(dg?.usedCoins || 0);
            const newUsed = originalTx.isFreeplayWithdraw ? currentUsed : Math.max(0, currentUsed - parseFloat(originalTx.amount || 0));
            await distGamesColl.updateOne(
              { distributorId: originalTx.distributorId, gameId: game.id },
              { $set: { availableCoins: newCoins, usedCoins: newUsed, title: originalTx.gameTitle } },
              { upsert: true }
            );
          } else {
            const currentCoins = parseFloat(game.availableCoins || 0);
            const newCoins = currentCoins + parseFloat(originalTx.amount || 0);
            const currentUsed = parseFloat(game.usedCoins || 0);
            const newUsed = originalTx.isFreeplayWithdraw ? currentUsed : Math.max(0, currentUsed - parseFloat(originalTx.amount || 0));
            await gamesCollection.updateOne({ id: game.id }, { $set: { availableCoins: newCoins, usedCoins: newUsed } });
            cache.del('games_all');
          }
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

        // 3. Insert notification for the Coins Manager (with duplicate prevention)
        const notificationsCollection = db.collection('coinsNotifications');
        const existingNoti = await notificationsCollection.findOne({ transactionId: originalTx.id });
        if (!existingNoti) {
          if (originalTx.type === 'BONUS' && (originalTx.code === 'SIGNUP-FREE3' || originalTx.code === 'FREEPLAY')) {
            // Freeplay bonus — special coins notification with isFreeplay flag
            await notificationsCollection.insertOne({
              id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
              userEmail,
              gameTitle: originalTx.gameTitle || 'Lobby',
              depositAmount: 0,
              bonusApplied: -3, // indicates signup freeplay
              isFreeplay: true,
              totalCoins: parseFloat(originalTx.amount),
              status: 'PENDING',
              read: false,
              timestamp: new Date().toISOString(),
              transactionId: originalTx.id,
              distributorId: originalTx.distributorId || ''
            });
          } else {
            // Regular deposit/bonus coins notification
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
              transactionId: originalTx.id, // Linked parent transaction!
              distributorId: originalTx.distributorId || ''
            });
          }
        }

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

