import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { applyStaffGameFilter, staffCanAccessGame } from '../../../lib/staffGameAccess';
import { accountLookupKey, buildGameUsernameMap } from '../../../lib/resolveGameUsername';
import { typeBExclusionFilter } from '../../../lib/typeBDistributors';

// GET all coins notifications (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const db = await getDb();
    const notificationsCollection = db.collection('coinsNotifications');
    
    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    const adminDistributorId = searchParams.get('adminDistributorId');
    const adminEmail = searchParams.get('adminEmail');

    if (adminDistributorId) {
      query.distributorId = adminDistributorId;
    } else if (!email) {
      // Only exclude Type B distributor coin notifications from Super Admin/global views
      Object.assign(query, await typeBExclusionFilter(db));
    }

    if (search) {
      const cleanSearch = search.trim();
      const searchCriteria = {
        $or: [
          { userEmail: { $regex: cleanSearch, $options: 'i' } },
          { gameTitle: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
      // Always AND with existing filters (keeps Type B exclusion for HQ admin)
      query = Object.keys(query).length > 0 ? { $and: [query, searchCriteria] } : searchCriteria;
    }

    const statusParam = searchParams.get('status');
    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.toUpperCase().trim()).filter(Boolean);
      const statusFilter = statuses.length > 1 ? { $in: statuses } : statuses[0];
      if (query.$and) {
        query.$and.push({ status: statusFilter });
      } else if (Object.keys(query).length > 0) {
        query = { $and: [query, { status: statusFilter }] };
      } else {
        query.status = statusFilter;
      }
    }

    if (adminEmail) {
      query = await applyStaffGameFilter(db, query, adminEmail);
    }

    const skip = (page - 1) * limit;

    // Parallel count + page fetch (same results, one less serial round-trip)
    const [totalNotifications, notifications] = await Promise.all([
      notificationsCollection.countDocuments(query),
      notificationsCollection.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
    ]);

    // Live username from Requests credentials / gameAccounts
    const notiPairs = notifications.filter(
      (n) => n.gameTitle && n.userEmail && n.gameTitle !== 'Referral Reward'
    );
    let accountsMap = {};
    if (notiPairs.length > 0) {
      const uniqueEmails = Array.from(new Set(notiPairs.map((n) => n.userEmail.toLowerCase().trim())));
      // Read-only resolve — never mutate gameAccounts on every poll
      accountsMap = await buildGameUsernameMap(db, uniqueEmails, { dedupe: false });
    }

    for (const noti of notifications) {
      if (noti.gameTitle && noti.userEmail && noti.gameTitle !== 'Referral Reward') {
        noti.gameUsername = accountsMap[accountLookupKey(noti.userEmail, noti.gameTitle)] || '';
      } else {
        noti.gameUsername = '';
      }
    }
    
    return NextResponse.json({
      success: true,
      coinsNotifications: notifications,
      totalNotifications,
      totalPages: Math.ceil(totalNotifications / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Fetch Coins Notifications Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update status, read indicator, or hold note
export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, status, read, holdNote, processedBy, adminEmail } = body || {};

    if (id === undefined || id === null || id === '') {
      return NextResponse.json({ success: false, message: 'Notification ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const notificationsCollection = db.collection('coinsNotifications');

    // id may be stored as string or number depending on older inserts
    const idStr = String(id);
    let originalNoti = await notificationsCollection.findOne({ id: idStr });
    if (!originalNoti && !Number.isNaN(Number(idStr))) {
      originalNoti = await notificationsCollection.findOne({ id: Number(idStr) });
    }
    if (!originalNoti) {
      originalNoti = await notificationsCollection.findOne({ id });
    }

    // Shift Dashboard synthetic rows: tx-coins-<transactionId> for COINS_LOADING
    // deposits that never got a coinsNotifications document.
    // Keep this path FAST — no first-deposit bonus recount (finance already approved).
    if (!originalNoti && idStr.startsWith('tx-coins-')) {
      const txId = idStr.slice('tx-coins-'.length);
      const tx =
        (await db.collection('transactions').findOne({ id: txId })) ||
        (await db.collection('transactions').findOne({ id: String(txId) }));
      if (tx && (tx.type === 'DEPOSIT' || tx.type === 'BONUS')) {
        const existingByTx = await notificationsCollection.findOne({
          transactionId: { $in: [tx.id, String(tx.id)] }
        });
        if (existingByTx) {
          originalNoti = existingByTx;
        } else {
          const amount = parseFloat(tx.amount || 0);
          const isFreeplay = tx.type === 'BONUS' && (tx.code === 'SIGNUP-FREE3' || tx.code === 'FREEPLAY');
          const newNoti = {
            id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
            userEmail: tx.userEmail,
            gameTitle: tx.gameTitle || 'Lobby',
            depositAmount: amount,
            bonusApplied: isFreeplay ? -3 : 0,
            totalCoins: amount,
            ...(isFreeplay ? { isFreeplay: true } : {}),
            status: 'PENDING',
            read: false,
            timestamp: new Date().toISOString(),
            transactionId: tx.id,
            distributorId: tx.distributorId || '',
            distributorType: tx.distributorType || ''
          };
          await notificationsCollection.insertOne(newNoti);
          originalNoti = newNoti;
        }
      }
    }

    if (!originalNoti) {
      return NextResponse.json({ success: false, message: 'Notification not found.' }, { status: 404 });
    }

    const actorEmail = adminEmail || processedBy;
    if (actorEmail && !(await staffCanAccessGame(db, actorEmail, originalNoti.gameTitle))) {
      return NextResponse.json({ success: false, message: 'You do not have access to process notifications for this game.' }, { status: 403 });
    }

    const updateFields = {};
    if (status !== undefined) {
      if (status === 'HOLD' && originalNoti.totalCoins < 0) {
        updateFields.status = 'FAILED';
      } else {
        updateFields.status = status;
      }
      if (status === 'CLAIM_REQUESTED') {
        updateFields.timestamp = new Date().toISOString();
      }
    }
    if (read !== undefined) {
      updateFields.read = Boolean(read);
    }
    if (holdNote !== undefined) {
      updateFields.holdNote = holdNote;
    }
    if (processedBy !== undefined) {
      updateFields.processedBy = processedBy;
    }

    const notiQuery = originalNoti._id
      ? { _id: originalNoti._id }
      : { id: originalNoti.id };

    await notificationsCollection.updateOne(notiQuery, { $set: updateFields });

    if (status === 'COMPLETED' && originalNoti.status !== 'COMPLETED') {
      // Deduct coins from dynamic game pools on allotment completion
      const gameTitle = originalNoti.gameTitle;
      const amountToDeduct = parseFloat(originalNoti.totalCoins || 0);

      const poolPromise = (async () => {
        if (!gameTitle || gameTitle === 'Referral Reward' || gameTitle === 'Lobby') return;
        try {
          const gamesCollection = db.collection('games');
          let game = await gamesCollection.findOne({ title: gameTitle });
          if (!game) {
            const escaped = String(gameTitle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            game = await gamesCollection.findOne({ title: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          }
          if (!game) return;
          if (originalNoti.distributorId) {
            const distGamesColl = db.collection('distributorGames');
            const dg = await distGamesColl.findOne({ distributorId: originalNoti.distributorId, gameId: game.id });
            const currentCoins = parseFloat(dg?.availableCoins || 0);
            const newCoins = Math.max(0, currentCoins - amountToDeduct);
            const currentUsed = parseFloat(dg?.usedCoins || 0);
            const newUsed = originalNoti.isFreeplayWithdraw ? currentUsed : (currentUsed + amountToDeduct);
            await distGamesColl.updateOne(
              { distributorId: originalNoti.distributorId, gameId: game.id },
              { $set: { availableCoins: newCoins, usedCoins: newUsed, title: gameTitle } },
              { upsert: true }
            );
          } else {
            const currentCoins = parseFloat(game.availableCoins || 0);
            const newCoins = Math.max(0, currentCoins - amountToDeduct);
            const currentUsed = parseFloat(game.usedCoins || 0);
            const newUsed = originalNoti.isFreeplayWithdraw ? currentUsed : (currentUsed + amountToDeduct);
            await gamesCollection.updateOne({ id: game.id }, { $set: { availableCoins: newCoins, usedCoins: newUsed } });
            cache.del('games_all');
          }
        } catch (poolErr) {
          console.error('Failed to deduct game coin pool for completed allotment:', poolErr);
        }
      })();

      const parentPromise = (async () => {
        if (!originalNoti.transactionId) return;
        try {
          const transactionsCollection = db.collection('transactions');
          const parentTx = await transactionsCollection.findOne({
            id: { $in: [originalNoti.transactionId, String(originalNoti.transactionId)] }
          });
          if (!parentTx) return;
          const txUpdate = { allottedBy: processedBy || originalNoti.processedBy || 'system' };
          if (parentTx.type === 'WITHDRAW') {
            txUpdate.status = 'PENDING';
            if (originalNoti.isFreeplayWithdraw) {
              txUpdate.payoutAmount = 30;
              txUpdate.amount = 30.0;
              txUpdate.isFreeplayWithdraw = true;
              txUpdate.note = 'Freeplay win capped at $30 max cashout.';
            }
          } else if (parentTx.type === 'DEPOSIT' || parentTx.type === 'BONUS') {
            txUpdate.status = 'SUCCESS';
          }
          await transactionsCollection.updateOne(
            parentTx._id ? { _id: parentTx._id } : { id: parentTx.id },
            { $set: txUpdate }
          );
        } catch (txErr) {
          console.error('Failed to update parent transaction on allotment complete:', txErr);
        }
      })();

      await Promise.all([poolPromise, parentPromise]);
    } else if (status === 'HOLD') {
      // Withdrawals: Invalid → fail parent tx. Deposits: keep HOLD on noti (reclaimable)
      // but always stamp the reason on the parent so COINS_LOADING rows don't look "stuck".
      if (originalNoti.transactionId) {
        const transactionsCollection = db.collection('transactions');
        const parentTx = await transactionsCollection.findOne({
          id: { $in: [originalNoti.transactionId, String(originalNoti.transactionId)] }
        });
        if (parentTx) {
          const txUpdate = {
            note: holdNote || 'Declined by Administrator.',
            allottedBy: processedBy || originalNoti.processedBy || 'system',
            coinsHoldNote: holdNote || 'Declined by Administrator.',
            coinsHoldAt: new Date().toISOString()
          };
          if (originalNoti.totalCoins < 0) {
            txUpdate.status = 'FAILED';
          }
          await transactionsCollection.updateOne(
            parentTx._id ? { _id: parentTx._id } : { id: parentTx.id },
            { $set: txUpdate }
          );
        }
      }
    }

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Notification updated successfully!' });
  } catch (err) {
    console.error('Update Coins Notification Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

