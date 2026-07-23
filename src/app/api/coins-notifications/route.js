import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { applyStaffGameFilter, staffCanAccessGame } from '../../../lib/staffGameAccess';
import { accountLookupKey, buildGameUsernameMap } from '../../../lib/resolveGameUsername';

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
      // When email is set, the player is viewing their OWN notifications — don't exclude!
      const typeBDists = await db.collection('distributors').find({ type: 'B' }).project({ id: 1 }).toArray();
      const typeBDistIds = typeBDists.map(d => d.id).filter(Boolean);
      if (typeBDistIds.length > 0) {
        query.distributorId = { $nin: typeBDistIds };
      }
    }

    if (search) {
      const cleanSearch = search.trim();
      const searchCriteria = {
        $or: [
          { userEmail: { $regex: cleanSearch, $options: 'i' } },
          { gameTitle: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
      if (email) {
        query = { $and: [query, searchCriteria] };
      } else {
        query = searchCriteria;
      }
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

    const totalNotifications = await notificationsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Fetch and sort at the DB level (highly optimized using timestamp index)
    const notifications = await notificationsCollection.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

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

      if (gameTitle && gameTitle !== 'Referral Reward' && gameTitle !== 'Lobby') {
        try {
          const gamesCollection = db.collection('games');
          const escaped = String(gameTitle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const game = await gamesCollection.findOne({ title: { $regex: new RegExp(`^${escaped}$`, 'i') } });
          if (game) {
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
          }
        } catch (poolErr) {
          console.error('Failed to deduct game coin pool for completed allotment:', poolErr);
        }
      }

      if (originalNoti.transactionId) {
        const transactionsCollection = db.collection('transactions');
        const parentTx = await transactionsCollection.findOne({ id: originalNoti.transactionId })
          || await transactionsCollection.findOne({ id: String(originalNoti.transactionId) });
        if (parentTx) {
          const txUpdate = { allottedBy: processedBy || originalNoti.processedBy || 'system' };
          if (parentTx.type === 'WITHDRAW') {
            txUpdate.status = 'PENDING';
            if (originalNoti.isFreeplayWithdraw) {
              txUpdate.payoutAmount = 30;
              txUpdate.amount = 30.0; // Cap the ledger/finance amount to $30 max cashout
              txUpdate.isFreeplayWithdraw = true;
              txUpdate.note = "Freeplay win capped at $30 max cashout.";
            }
          } else if (parentTx.type === 'DEPOSIT' || parentTx.type === 'BONUS') {
            txUpdate.status = 'SUCCESS';
          }
          await transactionsCollection.updateOne(
            parentTx._id ? { _id: parentTx._id } : { id: parentTx.id },
            { $set: txUpdate }
          );
        }
      }
    } else if (status === 'HOLD' && originalNoti.totalCoins < 0) {
      // If a withdrawal coin check is invalidated, directly fail the parent transaction
      if (originalNoti.transactionId) {
        const transactionsCollection = db.collection('transactions');
        const parentTx = await transactionsCollection.findOne({ id: originalNoti.transactionId })
          || await transactionsCollection.findOne({ id: String(originalNoti.transactionId) });
        if (parentTx) {
          const txUpdate = {
            status: 'FAILED',
            note: holdNote || 'Declined by Administrator.',
            allottedBy: processedBy || originalNoti.processedBy || 'system'
          };
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

