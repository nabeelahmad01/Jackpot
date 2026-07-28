import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { buildRemainderClaimAvailableAt } from '../../../lib/claimWait';
import { calcCommissionFromProfit } from '../../../lib/commission';
import { typeBExclusionFilter } from '../../../lib/typeBDistributors';
import { notifyStaffAndDistributorAsync } from '../../../lib/pushNotifications';
import { publishAdminEvent } from '../../../lib/adminEvents';
import { accountLookupKey, buildGameUsernameMap } from '../../../lib/resolveGameUsername';
import { compressDataUrlIfNeeded } from '../../../lib/serverImageCompress';
import { applyStaffGameFilter } from '../../../lib/staffGameAccess';

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
      Object.assign(query, await typeBExclusionFilter(db));
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

    // Coins staff: only their assigned games (Shift Dashboard COINS_LOADING fallback)
    const adminEmail = searchParams.get('adminEmail');
    if (adminEmail) {
      query = await applyStaffGameFilter(db, query, adminEmail);
    }

    const totalTransactions = await transactionsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Sort by id descending in database (highly optimized using id index)
    const transactions = await transactionsCollection.find(query)
      .project({
        screenshot: { $cond: { if: { $eq: [ { $ifNull: [ "$screenshot", "" ] }, "" ] }, then: false, else: true } },
        tagQrScreenshot: { $cond: { if: { $eq: [ { $ifNull: [ "$tagQrScreenshot", "" ] }, "" ] }, then: false, else: true } },
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
        gameAmount: 1,
        proofPending: 1,
        coinsHoldNote: 1,
        coinsHoldAt: 1,
        distributorId: 1,
        distributorType: 1
      })
      .sort({ id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Live username from Requests credentials / gameAccounts (fixes VEGAS X vs Vegas x duplicates)
    const txPairs = transactions.filter((t) => t.gameTitle && t.userEmail);
    let accountsMap = {};
    if (txPairs.length > 0) {
      const uniqueEmails = Array.from(new Set(txPairs.map((t) => t.userEmail.toLowerCase().trim())));
      accountsMap = await buildGameUsernameMap(db, uniqueEmails, { dedupe: false });
    }

    for (const tx of transactions) {
      if (tx.gameTitle && tx.userEmail) {
        tx.gameUsername = accountsMap[accountLookupKey(tx.userEmail, tx.gameTitle)] || '';
      } else {
        tx.gameUsername = '';
      }
    }

    // Heal: proof already in DB but flag stuck on "uploading" (failed client ack / race)
    const healedIds = transactions
      .filter((t) => t.proofPending && t.screenshot)
      .map((t) => t.id);
    if (healedIds.length > 0) {
      for (const t of transactions) {
        if (healedIds.includes(t.id)) t.proofPending = false;
      }
      void transactionsCollection.updateMany(
        { id: { $in: healedIds }, screenshot: { $type: 'string', $ne: '' } },
        { $set: { proofPending: false, hasScreenshot: true } }
      ).catch(() => {});
    }

    // COINS_LOADING feed is only for Shift synthetic fallback when a deposit has
    // NO coinsNotification yet. If any noti exists (PENDING/CLAIM/HOLD/COMPLETED),
    // hide the tx here — otherwise Verified Deposits shows noti + synthetic twice.
    // COMPLETED notis also heal the parent out of COINS_LOADING.
    const statusIsCoinsLoading =
      status &&
      String(status)
        .toUpperCase()
        .split(',')
        .map((s) => s.trim())
        .includes('COINS_LOADING');
    let visibleTransactions = transactions;
    if (statusIsCoinsLoading && transactions.length > 0) {
      const txIds = transactions.map((t) => t.id).filter(Boolean);
      const txIdStrs = txIds.map(String);
      const coveringNotis = await db.collection('coinsNotifications')
        .find({
          transactionId: { $in: [...txIds, ...txIdStrs] }
        })
        .project({ transactionId: 1, status: 1 })
        .toArray();
      const coveredTxIds = new Set(
        coveringNotis.map((n) => String(n.transactionId || '')).filter(Boolean)
      );
      const doneTxIds = new Set(
        coveringNotis
          .filter((n) => String(n.status || '').toUpperCase() === 'COMPLETED')
          .map((n) => String(n.transactionId || ''))
          .filter(Boolean)
      );
      if (coveredTxIds.size > 0) {
        visibleTransactions = transactions.filter((t) => !coveredTxIds.has(String(t.id)));
      }
      if (doneTxIds.size > 0) {
        const healIds = transactions.filter((t) => doneTxIds.has(String(t.id))).map((t) => t.id);
        void transactionsCollection.updateMany(
          {
            id: { $in: healIds },
            status: 'COINS_LOADING',
            type: { $in: ['DEPOSIT', 'BONUS'] }
          },
          { $set: { status: 'SUCCESS', coinsAllottedAt: new Date().toISOString() } }
        ).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      transactions: visibleTransactions,
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

    // Deposit proofs attach via /api/transactions/proof after a tiny create POST.
    // Only compress images that are actually present on this request (withdrawals).
    const proofPending = Boolean(newTx.proofPending) && newTx.type === 'DEPOSIT';
    if (!proofPending && typeof newTx.screenshot === 'string' && newTx.screenshot.startsWith('data:image')) {
      newTx.screenshot = await compressDataUrlIfNeeded(newTx.screenshot);
    }
    if (typeof newTx.tagQrScreenshot === 'string' && newTx.tagQrScreenshot.startsWith('data:image')) {
      newTx.tagQrScreenshot = await compressDataUrlIfNeeded(newTx.tagQrScreenshot);
    }
    // Never store a multi-MB proof on the fast deposit create path
    if (proofPending) {
      delete newTx.screenshot;
    }
    delete newTx.proofPending;

    // Legacy PENDING freeplay heal — never block a new claim (background)
    if (newTx.type === 'BONUS') {
      Promise.resolve().then(async () => {
        const orphanedFreeplay = await transactionsCollection.find({
          userEmail,
          type: 'BONUS',
          code: { $in: ['SIGNUP-FREE3', 'FREEPLAY'] },
          status: 'PENDING'
        }).project({ id: 1, userEmail: 1, gameTitle: 1, amount: 1, distributorId: 1 }).toArray();
        if (orphanedFreeplay.length === 0) return;
        const notificationsCollection = db.collection('coinsNotifications');
        for (const fp of orphanedFreeplay) {
          await transactionsCollection.updateOne({ id: fp.id }, { $set: { status: 'COINS_LOADING' } });
          const existingNoti = await notificationsCollection.findOne(
            { transactionId: fp.id },
            { projection: { _id: 1 } }
          );
          if (!existingNoti) {
            await notificationsCollection.insertOne({
              id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
              userEmail: fp.userEmail,
              gameTitle: fp.gameTitle || 'Lobby',
              depositAmount: 0,
              bonusApplied: -3,
              isFreeplay: true,
              totalCoins: Math.floor(parseFloat(fp.amount) || 0),
              status: 'PENDING',
              read: false,
              timestamp: new Date().toISOString(),
              transactionId: fp.id,
              distributorId: fp.distributorId || ''
            });
          }
        }
      }).catch((err) => console.error('Orphan freeplay heal failed:', err));
    }

    // Retrieve the player profile to extract distributorId
    const userDoc = await db.collection('users').findOne(
      { email: userEmail },
      { projection: { email: 1, distributorId: 1 } }
    );
    const distId = userDoc ? (userDoc.distributorId || '') : '';
    let distType = '';
    if (distId) {
      const distCacheKey = `dist_type_${distId}`;
      let cachedType = cache.get(distCacheKey);
      if (cachedType == null) {
        const distDoc = await db.collection('distributors').findOne({ id: distId }, { projection: { type: 1 } });
        cachedType = distDoc?.type || '';
        cache.set(distCacheKey, cachedType, 120);
      }
      distType = cachedType;
    }

    if (newTx.isRemainderRequest) {
      const parentTx = await transactionsCollection.findOne({ id: newTx.parentTxId });
      const parentType = parentTx ? parentTx.type : 'WITHDRAW';

      // Create remainder payout request
      const txObject = {
        id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
        userEmail: newTx.userEmail.toLowerCase().trim(),
        date: new Date().toISOString(),
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
        distributorType: distType,
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
      publishAdminEvent('transactions', { distributorId: txObject.distributorId || '' });

      notifyStaffAndDistributorAsync(db, {
        title: 'Remainder Payout Request',
        body: `${txObject.userEmail} · $${parseFloat(txObject.amount || 0).toFixed(2)}`,
        url: '/admin',
        tag: `tx-${txObject.id}`,
        gameTitle: txObject.gameTitle || parentTx?.gameTitle || '',
        alertKind: 'game'
      }, txObject.distributorId);

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

    if (isFreeplayBonus) {
      if (!newTx.gameTitle || String(newTx.gameTitle).trim() === '') {
        return NextResponse.json({
          success: false,
          message: 'Select a game to claim freeplay.'
        }, { status: 400 });
      }

      const isPromoFreeplay = /promo freeplay/i.test(String(newTx.note || ''));

      // Parallel: pending guard + latest success freeplay (no full history scan)
      const [pendingFreeplay, lastFp] = await Promise.all([
        transactionsCollection.findOne(
          {
            userEmail,
            type: 'BONUS',
            code: { $in: ['SIGNUP-FREE3', 'FREEPLAY'] },
            status: { $in: ['COINS_LOADING', 'PENDING', 'PENDING_COINS'] }
          },
          { projection: { _id: 1 } }
        ),
        isPromoFreeplay
          ? Promise.resolve(null)
          : transactionsCollection.findOne(
              {
                userEmail,
                type: 'BONUS',
                code: { $in: ['SIGNUP-FREE3', 'FREEPLAY'] },
                status: 'SUCCESS'
              },
              { sort: { id: -1 }, projection: { id: 1 } }
            )
      ]);

      if (pendingFreeplay) {
        return NextResponse.json({
          success: false,
          message: 'You already have a freeplay request pending. Please wait for it to be processed.'
        }, { status: 400 });
      }

      if (!isPromoFreeplay) {
        if (lastFp) {
          // Cashout after freeplay resets $25 progress — only count deposits after last cashout (or freeplay)
          const lastCashoutAfterFp = await transactionsCollection.findOne(
            {
              userEmail,
              type: 'WITHDRAW',
              status: { $ne: 'FAILED' },
              id: { $gt: lastFp.id }
            },
            { sort: { id: -1 }, projection: { id: 1 } }
          );
          const depositAfterId = lastCashoutAfterFp ? lastCashoutAfterFp.id : lastFp.id;

          const depositAgg = await transactionsCollection.aggregate([
            {
              $match: {
                userEmail,
                type: 'DEPOSIT',
                status: 'SUCCESS',
                id: { $gt: depositAfterId }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } }
              }
            }
          ]).toArray();
          const depositTotal = depositAgg[0]?.total || 0;
          if (depositTotal < 25) {
            return NextResponse.json({
              success: false,
              message: lastCashoutAfterFp
                ? `Cashout reset freeplay progress. Deposit at least $25.00 since your last cashout. Current: $${depositTotal.toFixed(2)}.`
                : `Deposit at least $25.00 after your last freeplay to claim again. Current: $${depositTotal.toFixed(2)}.`
            }, { status: 400 });
          }
          newTx.code = 'FREEPLAY';
          newTx.gateway = newTx.gateway || 'Freeplay';
        } else {
          newTx.code = 'SIGNUP-FREE3';
          newTx.gateway = newTx.gateway || 'Signup Bonus';
        }
      }
    }

    const txObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      userEmail,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      // Freeplay goes directly to coins admin (COINS_LOADING), not finance (PENDING)
      status: newTx.type === 'WITHDRAW' ? 'PENDING_COINS' : isFreeplayBonus ? 'COINS_LOADING' : newTx.type === 'BONUS' ? 'SUCCESS' : 'PENDING',
      note: '',
      distributorId: distId,
      distributorType: distType,
      ...newTx,
      proofPending: Boolean(proofPending),
      hasScreenshot: Boolean(newTx.screenshot && String(newTx.screenshot).trim())
    };

    if (txObject.type === 'WITHDRAW') {
      let frontendSettings = cache.get('frontend_settings_all');
      if (!frontendSettings) {
        frontendSettings = await db.collection('settings').findOne({ id: 'frontend_settings' }) || {};
      }
      const requireGameShot = frontendSettings.withdrawRequireGameScreenshot === true;
      const requireTagQr = frontendSettings.withdrawRequireTagQrScreenshot !== false;

      if (requireGameShot && (!txObject.screenshot || String(txObject.screenshot).trim() === '')) {
        return NextResponse.json({ success: false, message: 'Game screenshot is required for withdrawals.' }, { status: 400 });
      }
      if (requireTagQr && (!txObject.tagQrScreenshot || String(txObject.tagQrScreenshot).trim() === '')) {
        return NextResponse.json({ success: false, message: 'Tag QR screenshot is required for withdrawals.' }, { status: 400 });
      }
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
      if (txObject.isFreeplayWithdraw && parseFloat(txObject.amount) < 100) {
        return NextResponse.json(
          { success: false, message: 'Freeplay withdraw request must be at least $100.' },
          { status: 400 }
        );
      }
    }

    // Freeplay / withdraw: write tx + coins task together so admin queue is ready when response returns
    const notificationsCollection = db.collection('coinsNotifications');
    const writeOps = [transactionsCollection.insertOne(txObject)];

    let coinGameUsername = '';
    if (txObject.type === 'WITHDRAW' || isFreeplayBonus) {
      try {
        const umap = await buildGameUsernameMap(db, [String(txObject.userEmail || '').toLowerCase().trim()], { dedupe: false });
        coinGameUsername = umap[accountLookupKey(txObject.userEmail, txObject.gameTitle || 'Lobby')] || '';
      } catch {
        /* ignore */
      }
    }

    if (txObject.type === 'WITHDRAW') {
      writeOps.push(notificationsCollection.insertOne({
        id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
        userEmail: txObject.userEmail,
        gameTitle: txObject.gameTitle || 'Lobby',
        gameUsername: coinGameUsername,
        depositAmount: parseFloat(txObject.amount),
        bonusApplied: -1, // Indicates deduction/withdrawal action
        totalCoins: -Math.floor(parseFloat(txObject.amount) || 0), // whole coins only
        status: 'PENDING',
        read: false,
        timestamp: new Date().toISOString(),
        transactionId: txObject.id,
        isFreeplayWithdraw: Boolean(txObject.isFreeplayWithdraw),
        distributorId: distId,
        distributorType: distType
      }));
    }

    if (isFreeplayBonus) {
      writeOps.push(notificationsCollection.insertOne({
        id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
        userEmail: txObject.userEmail,
        gameTitle: txObject.gameTitle || 'Lobby',
        gameUsername: coinGameUsername,
        depositAmount: 0,
        bonusApplied: -3, // indicates freeplay
        isFreeplay: true,
        totalCoins: Math.floor(parseFloat(txObject.amount) || 0),
        status: 'PENDING',
        read: false,
        timestamp: new Date().toISOString(),
        transactionId: txObject.id,
        distributorId: distId,
        distributorType: distType
      }));
    }

    await Promise.all(writeOps);

    // Alert Jackpot Portal + owning Distributor APK — never touches player promo push.
    const alertType = String(txObject.type || 'REQUEST').replace(/_/g, ' ');
    notifyStaffAndDistributorAsync(db, {
      title: `New ${alertType}`,
      body: `${txObject.userEmail || 'Player'} · $${parseFloat(txObject.amount || 0).toFixed(2)}${txObject.gameTitle ? ` · ${txObject.gameTitle}` : ''}`,
      url: '/admin',
      tag: `tx-${txObject.id}`,
      gameTitle: txObject.gameTitle || '',
      alertKind: 'game'
    }, txObject.distributorId);

    // Invalidate stats cache + instant admin SSE
    cache.del('admin_stats');
    const distKey = txObject.distributorId || '';
    publishAdminEvent('transactions', { distributorId: distKey, txType: txObject.type });
    if (txObject.type === 'WITHDRAW' || isFreeplayBonus) {
      publishAdminEvent('coins', { distributorId: distKey, transactionId: txObject.id });
    }

    // Don't echo multi-MB base64 proofs back to the client — DB still has them.
    const {
      screenshot: _shot,
      tagQrScreenshot: _tagQr,
      payoutProof: _payout,
      ...txWithoutProofs
    } = txObject;
    return NextResponse.json({
      success: true,
      transaction: {
        ...txWithoutProofs,
        hasScreenshot: Boolean(_shot),
        hasTagQrScreenshot: Boolean(_tagQr)
      },
      message: 'Transaction request submitted successfully!'
    });
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

    // Slim read for approve/reject — never load multi-MB screenshots into memory
    const originalTx = await transactionsCollection.findOne(
      { id },
      {
        projection: {
          screenshot: 0,
          tagQrScreenshot: 0,
          payoutProof: 0,
          paymentProof: 0
        }
      }
    );
    if (!originalTx) {
      return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
    }

    const isFreeplayBonusTx = originalTx.type === 'BONUS' && (originalTx.code === 'SIGNUP-FREE3' || originalTx.code === 'FREEPLAY');
    if (isFreeplayBonusTx && originalTx.status === 'COINS_LOADING') {
      return NextResponse.json({ success: false, message: 'Freeplay requests are handled by the Coins team only.' }, { status: 400 });
    }

    const isCoinsApproval =
      status === 'SUCCESS' &&
      (originalTx.type === 'DEPOSIT' || originalTx.type === 'BONUS') &&
      originalTx.status !== 'SUCCESS' &&
      originalTx.status !== 'COINS_LOADING';

    let finalStatus = status;
    if (isCoinsApproval) {
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
      // Large phone screenshots as raw base64 make this PUT hang / fail on shared hosting.
      updateFields.payoutProof = await compressDataUrlIfNeeded(payoutProof, {
        maxChars: 160_000,
        maxSize: 1000,
        quality: 65
      });
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

    // For deposit/bonus approval, create the fully calculated coins task FIRST.
    // If COINS_LOADING is exposed before that task exists, Shift Dashboard creates
    // a temporary synthetic row with 0% bonus (10), then replaces it with 12.
    if (!isCoinsApproval) {
      await transactionsCollection.updateOne({ id }, { $set: updateFields });
    }

    if (status === 'SUCCESS' && originalTx.parentTxId) {
      try {
        const finalChildHold = payoutHold !== undefined ? Number(payoutHold) : parseFloat(originalTx.payoutHold || 0);

        // The claim button lives on the LATEST request line (this child). When it
        // is only partially paid, the child keeps the remaining hold + its own
        // timer (set above) and shows the next claim button — we must NOT revive
        // the ancestor's button. When it is fully paid, settle the whole ancestor
        // chain so no button or "Remainder Requested" label lingers anywhere.
        if (finalChildHold <= 0) {
          let ancestorId = originalTx.parentTxId;
          let guard = 0;
          while (ancestorId && guard < 25) {
            const ancestor = await transactionsCollection.findOne({ id: ancestorId });
            if (!ancestor) break;
            await transactionsCollection.updateOne(
              { id: ancestorId },
              { $set: { remainderPaid: true, remainderStatus: 'SUCCESS', payoutHold: 0, remainderRequested: false } }
            );
            ancestorId = ancestor.parentTxId;
            guard += 1;
          }
        } else {
          // Keep the immediate parent flagged as requested so it shows no button
          // (its remainder has been handed down to this child).
          await transactionsCollection.updateOne(
            { id: originalTx.parentTxId },
            { $set: { remainderRequested: true, remainderStatus: '' } }
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
        const title = String(originalTx.gameTitle || '').trim();
        let game = title ? await gamesCollection.findOne({ title }) : null;
        if (!game && title) {
          const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          game = await gamesCollection.findOne({ title: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }
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

    // Trigger Coins notification if this transaction is approved as SUCCESS and it is a DEPOSIT or a BONUS.
    // COINS_LOADING means it was already approved once — re-approving must never create a second
    // allotment task (or a second referral reward).
    if (isCoinsApproval) {
      try {
        // Proof still uploading from player two-phase deposit — don't approve yet
        // (If screenshot already landed, clear the stuck flag and continue.)
        if (originalTx.type === 'DEPOSIT' && originalTx.proofPending === true) {
          const hasProof = typeof originalTx.screenshot === 'string' && originalTx.screenshot.startsWith('data:image');
          if (hasProof) {
            await transactionsCollection.updateOne(
              { id },
              { $set: { proofPending: false, hasScreenshot: true } }
            );
          } else {
            return NextResponse.json({
              success: false,
              message: 'Payment proof is still uploading. Wait a moment and try again.'
            }, { status: 409 });
          }
        }

        const userEmail = originalTx.userEmail.toLowerCase();
        const settingsCollection = db.collection('settings');
        const notificationsCollection = db.collection('coinsNotifications');

        // Cached settings + findOne (not count) for first-deposit check — fewer Atlas round-trips
        let settings = cache.get('global_settings');
        let frontendSettings = cache.get('frontend_settings_all');
        const [priorSuccessDeposit, settingsFresh, frontendFresh, depositor] = await Promise.all([
          transactionsCollection.findOne(
            { userEmail, type: 'DEPOSIT', status: 'SUCCESS', id: { $ne: id } },
            { projection: { _id: 1 } }
          ),
          settings ? Promise.resolve(null) : settingsCollection.findOne({ id: 'global_settings' }),
          frontendSettings ? Promise.resolve(null) : settingsCollection.findOne({ id: 'frontend_settings' }),
          db.collection('users').findOne(
            { email: userEmail },
            { projection: { email: 1, referredBy: 1, pendingDepositBonusPercent: 1, pendingBonusFreeplay: 1, pendingBonusPromoId: 1, pendingBonusPromoTitle: 1 } }
          )
        ]);
        if (settingsFresh) {
          settings = settingsFresh;
          cache.set('global_settings', settingsFresh, 60);
        }
        if (frontendFresh) {
          frontendSettings = frontendFresh;
          cache.set('frontend_settings_all', frontendFresh, 60);
        }

        const isFirstDeposit = !priorSuccessDeposit;

        const firstBonusPercent = (frontendSettings && frontendSettings.firstDepositBonus !== undefined)
          ? Number(frontendSettings.firstDepositBonus)
          : (settings ? Number(settings.firstDepositBonus) : 300);

        // Promo deposit bonus: if the player claimed a "deposit bonus" promotion,
        // their next approved deposit uses that promo % instead of the default
        // first/regular bonus, and any bundled freeplay is auto-granted below.
        const rawPromoBonus = depositor ? depositor.pendingDepositBonusPercent : undefined;
        const promoBonusPercent = (rawPromoBonus !== undefined && rawPromoBonus !== null) ? Number(rawPromoBonus) : null;
        const usePromoBonus = originalTx.type === 'DEPOSIT' && promoBonusPercent !== null && promoBonusPercent > 0;

        const isBonus = originalTx.type === 'BONUS';
        const bonusPercentage = isBonus
          ? 0
          : (usePromoBonus ? promoBonusPercent : (isFirstDeposit ? firstBonusPercent : (settings ? Number(settings.regularDepositBonus) : 20)));
        
        // Calculate total coins to allot (whole coins only — drop cents after bonus)
        const amount = parseFloat(originalTx.amount);
        const rawCoins = isBonus ? amount : (amount * (1 + bonusPercentage / 100));
        const totalCoins = Math.floor(Number(rawCoins) || 0);

        // Coins Manager task — upsert keyed on transactionId so two overlapping
        // approve requests can only ever produce ONE allotment row.
        const isFreeplayNoti =
          originalTx.type === 'BONUS' && (originalTx.code === 'SIGNUP-FREE3' || originalTx.code === 'FREEPLAY');

        // Resolve username once at insert so slim list polls stay fast (no join every 0.5s)
        const gameTitleForNoti = originalTx.gameTitle || 'Lobby';
        let gameUsername = '';
        try {
          const umap = await buildGameUsernameMap(db, [userEmail], { dedupe: false });
          gameUsername = umap[accountLookupKey(userEmail, gameTitleForNoti)] || '';
        } catch (unameErr) {
          console.warn('gameUsername resolve on approve:', unameErr?.message || unameErr);
        }

        // Always string — prevents duplicate tasks when id is number in one path / string in another
        const txIdKey = String(originalTx.id);
        const tidVariants = [originalTx.id, txIdKey];
        if (!Number.isNaN(Number(txIdKey)) && String(Number(txIdKey)) === txIdKey) {
          tidVariants.push(Number(txIdKey));
        }

        const existingCoinTask = await notificationsCollection.findOne({
          transactionId: { $in: tidVariants }
        });

        let createdCoinTask = false;
        let shouldNotifyCoins = false;
        const existingStatus = String(existingCoinTask?.status || '').toUpperCase();

        if (existingCoinTask) {
          // Already have a task for this deposit — never insert a duplicate.
          // Only re-ping staff if it is still waiting to be loaded.
          shouldNotifyCoins = existingStatus === 'PENDING' || existingStatus === 'CLAIM_REQUESTED';
        } else {
          const notiDoc = isFreeplayNoti
            ? {
                id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
                userEmail,
                gameTitle: gameTitleForNoti,
                gameUsername,
                depositAmount: 0,
                bonusApplied: -3, // indicates signup freeplay
                isFreeplay: true,
                totalCoins: Math.floor(parseFloat(originalTx.amount) || 0),
                status: 'PENDING',
                read: false,
                timestamp: new Date().toISOString(),
                transactionId: txIdKey,
                distributorId: originalTx.distributorId || '',
                distributorType: originalTx.distributorType || ''
              }
            : {
                id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
                userEmail,
                gameTitle: gameTitleForNoti,
                gameUsername,
                depositAmount: amount,
                bonusApplied: bonusPercentage,
                totalCoins,
                status: 'PENDING',
                read: false,
                timestamp: new Date().toISOString(),
                transactionId: txIdKey,
                distributorId: originalTx.distributorId || '',
                distributorType: originalTx.distributorType || ''
              };

          const coinTaskResult = await notificationsCollection.updateOne(
            { transactionId: txIdKey },
            { $setOnInsert: notiDoc },
            { upsert: true }
          );
          createdCoinTask = coinTaskResult.upsertedCount === 1;
          shouldNotifyCoins = createdCoinTask || coinTaskResult.matchedCount > 0;
        }

        // If this deposit was already Loaded, force SUCCESS (even if stuck on COINS_LOADING)
        if (existingStatus === 'COMPLETED') {
          updateFields.status = 'SUCCESS';
          await transactionsCollection.updateOne({ id }, { $set: updateFields });
        } else {
          // Publish COINS_LOADING only after the real notification (with bonus) exists.
          await transactionsCollection.updateOne(
            {
              id,
              status: { $ne: 'COINS_LOADING' }
            },
            { $set: updateFields }
          );
        }

        // Ping coins staff / Shift APK + SSE so open tabs refresh instantly
        if (shouldNotifyCoins && existingStatus !== 'COMPLETED' && existingStatus !== 'HOLD') {
          const coinsLabel = isFreeplayNoti
            ? `Freeplay $${parseFloat(originalTx.amount || 0).toFixed(2)}`
            : `Deposit $${amount.toFixed(2)} → ${totalCoins} coins`;
          notifyStaffAndDistributorAsync(db, {
            title: 'Coins allotment ready',
            body: `${userEmail} · ${coinsLabel}${originalTx.gameTitle ? ` · ${originalTx.gameTitle}` : ''}`,
            url: '/admin',
            tag: `coins-${originalTx.id}`,
            gameTitle: originalTx.gameTitle || '',
            alertKind: 'coins'
          }, originalTx.distributorId);
          publishAdminEvent('coins', {
            distributorId: originalTx.distributorId || '',
            transactionId: originalTx.id
          });
          publishAdminEvent('transactions', {
            distributorId: originalTx.distributorId || '',
            status: 'COINS_LOADING'
          });
        }

        // Consume promo / referral off the hot path
        if (createdCoinTask && usePromoBonus) {
          Promise.resolve(
            db.collection('users').updateOne(
              { email: userEmail },
              { $unset: { pendingDepositBonusPercent: '', pendingBonusFreeplay: '', pendingBonusPromoId: '', pendingBonusPromoTitle: '' } }
            )
          ).catch((err) => console.error('Promo bonus consume failed:', err));
        }

        if (
          createdCoinTask &&
          depositor &&
          depositor.referredBy &&
          originalTx.type === 'DEPOSIT' &&
          isFirstDeposit
        ) {
          const referrerEmail = depositor.referredBy.toLowerCase().trim();
          const refBonusPercent = (settings && settings.referralBonus !== undefined) ? Number(settings.referralBonus) : 10;
          if (refBonusPercent > 0) {
            const rewardCoins = amount * (refBonusPercent / 100);
            Promise.resolve(
              db.collection('pendingReferrals').insertOne({
                id: Date.now().toString() + Math.floor(Math.random() * 100 + 1).toString(),
                referrerEmail,
                refereeEmail: userEmail,
                rewardCoins: Math.round(rewardCoins * 100) / 100,
                status: 'PENDING',
                timestamp: new Date().toISOString()
              })
            ).catch((err) => console.error('Referral reward insert failed:', err));
          }
        }
      } catch (notiErr) {
        console.error('Failed to generate coin allotment notification:', notiErr);
        // Do not report finance approval as successful without its coins task.
        throw notiErr;
      }
    }

    // Invalidate stats cache + SSE (withdraw approve / fail / non-coins paths)
    cache.del('admin_stats');
    if (!isCoinsApproval) {
      publishAdminEvent('transactions', {
        distributorId: originalTx.distributorId || '',
        status: finalStatus
      });
    }

    // Include created coins task so approving client can refresh siblings instantly
    let coinsNotification = null;
    if (isCoinsApproval) {
      try {
        coinsNotification = await db.collection('coinsNotifications').findOne(
          { transactionId: id },
          { projection: { _id: 0 } }
        );
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      success: true,
      message: `Transaction status updated to ${status}!`,
      status: finalStatus,
      coinsNotification
    });
  } catch (err) {
    console.error('Update Transaction API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

