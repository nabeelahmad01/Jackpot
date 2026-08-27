import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { calculatePlayerLevel, calculateMilestoneRewards } from '../../../../lib/levelTiers';
import { publishAdminEvent } from '../../../../lib/adminEvents';
import { notifyStaffAndDistributorAsync } from '../../../../lib/pushNotifications';

// GET level rewards status for a player
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, message: 'User email is required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();

    // 1. Calculate cumulative successful deposits
    const depositTxs = await db.collection('transactions').find({
      userEmail: cleanEmail,
      type: 'DEPOSIT',
      status: 'SUCCESS'
    }).toArray();

    const totalDeposit = depositTxs.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    // 2. Fetch claimed level rewards history
    const claimedRewards = await db.collection('levelRewards').find({
      userEmail: cleanEmail,
      status: { $ne: 'REJECTED' }
    }).sort({ timestamp: -1 }).toArray();

    const totalClaimed = claimedRewards.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // 3. Compute level & milestone rewards
    const levelInfo = calculatePlayerLevel(totalDeposit);
    const milestoneRewards = calculateMilestoneRewards(totalDeposit, totalClaimed);

    // 4. Fetch player's game accounts
    const gameAccounts = await db.collection('gameAccounts').find({
      userEmail: cleanEmail
    }).project({ id: 1, gameTitle: 1, username: 1 }).toArray();

    return NextResponse.json({
      success: true,
      totalDeposit,
      levelInfo,
      milestoneRewards,
      gameAccounts,
      claimedHistory: claimedRewards
    });
  } catch (err) {
    console.error('Fetch level rewards error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST claim level milestone reward
export async function POST(req) {
  try {
    const { email, gameTitle } = await req.json();

    if (!email || !gameTitle) {
      return NextResponse.json({ success: false, message: 'User email and game title are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();

    // 1. Calculate cumulative deposit
    const depositTxs = await db.collection('transactions').find({
      userEmail: cleanEmail,
      type: 'DEPOSIT',
      status: 'SUCCESS'
    }).toArray();

    const totalDeposit = depositTxs.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    // 2. Fetch already claimed amount
    const claimedRewards = await db.collection('levelRewards').find({
      userEmail: cleanEmail,
      status: { $ne: 'REJECTED' }
    }).toArray();

    const totalClaimed = claimedRewards.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const milestoneRewards = calculateMilestoneRewards(totalDeposit, totalClaimed);

    if (milestoneRewards.unclaimedAmount <= 0) {
      return NextResponse.json({
        success: false,
        message: 'You have no unclaimed Level Rewards at this time. Deposit more to reach the next milestone!'
      }, { status: 400 });
    }

    const claimAmount = milestoneRewards.unclaimedAmount;
    const levelInfo = calculatePlayerLevel(totalDeposit);

    // 3. Verify user and game account
    const user = await db.collection('users').findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const gameAccount = await db.collection('gameAccounts').findOne({
      userEmail: cleanEmail,
      gameTitle: { $regex: new RegExp(`^${gameTitle.trim()}$`, 'i') }
    });

    const distId = user.distributorId || '';
    const claimId = (Date.now() + Math.floor(Math.random() * 1000)).toString();

    // 4. Save record in levelRewards collection
    const rewardRecord = {
      id: claimId,
      userEmail: cleanEmail,
      userName: user.name || cleanEmail.split('@')[0],
      gameTitle: gameTitle.trim(),
      gameUsername: gameAccount?.username || '',
      amount: claimAmount,
      rewardCoins: claimAmount,
      rewardLevel: levelInfo.levelName,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
      distributorId: distId
    };

    await db.collection('levelRewards').insertOne(rewardRecord);

    // 5. Create Coin Allotment Task for Coins Staff
    const notiId = (Date.now() + Math.floor(Math.random() * 1000 + 1)).toString();
    const notiRecord = {
      id: notiId,
      userEmail: cleanEmail,
      userName: user.name || cleanEmail.split('@')[0],
      gameTitle: gameTitle.trim(),
      gameUsername: gameAccount?.username || '',
      depositAmount: 0,
      bonusApplied: -4, // -4 indicates VIP Level Milestone Reward
      isLevelReward: true,
      rewardLevel: levelInfo.levelName,
      totalCoins: Number(claimAmount),
      status: 'PENDING',
      read: false,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      distributorId: distId
    };

    await db.collection('coinsNotifications').insertOne(notiRecord);

    // Invalidate stats cache
    cache.del('admin_stats');

    // Notify Staff & Distributor live
    notifyStaffAndDistributorAsync(db, {
      title: '👑 VIP Level Reward Claim',
      body: `${user.name || cleanEmail} · $${claimAmount} · ${gameTitle.trim()} (${levelInfo.levelName})`,
      adminUrl: '/admin/coins',
      distributorUrl: '/distributor/operations',
      url: '/admin/coins',
      tag: `level-reward-${claimId}`,
      gameTitle: gameTitle.trim(),
      alertKind: 'coins'
    }, distId);

    publishAdminEvent('coins', {
      distributorId: distId || '',
      transactionId: claimId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully claimed $${claimAmount} ${levelInfo.levelName} reward! Coins loading is in progress.`,
      reward: rewardRecord,
      notification: notiRecord
    });
  } catch (err) {
    console.error('Claim level reward error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
