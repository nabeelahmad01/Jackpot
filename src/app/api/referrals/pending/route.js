import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

// GET pending referral rewards for a referrer
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, message: 'Referrer email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const pendingCollection = db.collection('pendingReferrals');

    const pending = searchParams.get('all') === '1'
      ? await pendingCollection
          .find({ referrerEmail: email.toLowerCase().trim() })
          .sort({ timestamp: -1 })
          .toArray()
      : await pendingCollection
          .find({
            referrerEmail: email.toLowerCase().trim(),
            status: 'PENDING'
          })
          .toArray();

    return NextResponse.json({ success: true, pending });
  } catch (err) {
    console.error('Fetch Pending Referrals API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST claim referral reward
export async function POST(req) {
  try {
    const { id, gameTitle } = await req.json();

    if (!id || !gameTitle) {
      return NextResponse.json({ success: false, message: 'Missing referral ID or game title.' }, { status: 400 });
    }

    const db = await getDb();
    const pendingCollection = db.collection('pendingReferrals');
    const gameAccountsCollection = db.collection('gameAccounts');
    const accountRequestsCollection = db.collection('accountRequests');
    const coinsNotificationsCollection = db.collection('coinsNotifications');

    // 1. Get the pending reward
    const referral = await pendingCollection.findOne({ id });
    if (!referral) {
      return NextResponse.json({ success: false, message: 'Referral reward not found.' }, { status: 404 });
    }

    if (referral.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: 'This referral reward has already been claimed or is processing.' }, { status: 400 });
    }

    const cleanReferrerEmail = referral.referrerEmail.toLowerCase().trim();

    // Fetch referrer's profile to extract distributorId
    const usersCollection = db.collection('users');
    const referrerUser = await usersCollection.findOne({ email: cleanReferrerEmail });
    const distId = referrerUser ? (referrerUser.distributorId || '') : '';

    // 2. Check if referrer has a game account for gameTitle
    const account = await gameAccountsCollection.findOne({
      userEmail: cleanReferrerEmail,
      gameTitle: { $regex: new RegExp(`^${gameTitle}$`, 'i') }
    });

    if (account) {
      // Direct allotment since game account exists
      await coinsNotificationsCollection.insertOne({
        id: Date.now().toString() + Math.floor(Math.random() * 100 + 1).toString(),
        userEmail: cleanReferrerEmail,
        gameTitle: gameTitle,
        depositAmount: 0,
        bonusApplied: -2, // -2 indicates Referral Reward
        totalCoins: Number(referral.rewardCoins),
        status: 'PENDING',
        read: false,
        timestamp: new Date().toISOString(),
        distributorId: distId
      });

      // Mark as CLAIMED
      await pendingCollection.updateOne({ id }, { $set: { status: 'CLAIMED', claimedAt: new Date().toISOString() } });

      // Invalidate stats cache
      cache.del('admin_stats');

      return NextResponse.json({
        success: true,
        action: 'ALLOTMENT_SUBMITTED',
        message: `Referral coins successfully requested for game account ${account.username}!`
      });
    } else {
      // Check if user already has a pending account request for this game
      const existingRequest = await accountRequestsCollection.findOne({
        userEmail: cleanReferrerEmail,
        gameTitle: { $regex: new RegExp(`^${gameTitle}$`, 'i') },
        status: 'PENDING'
      });

      if (!existingRequest) {
        // Create game account request first
        const requestId = Date.now().toString() + Math.floor(Math.random() * 100).toString();
        await accountRequestsCollection.insertOne({
          id: requestId,
          gameTitle,
          userEmail: cleanReferrerEmail,
          status: 'PENDING',
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          referralRewardId: id, // Link to pending referral
          distributorId: distId
        });
      } else {
        // Link the existing pending account request to this referral reward
        await accountRequestsCollection.updateOne(
          { id: existingRequest.id },
          { $set: { referralRewardId: id } }
        );
      }

      // Mark referral reward status as 'PENDING_ACCOUNT_APPROVAL' to prevent double submission
      await pendingCollection.updateOne({ id }, { $set: { status: 'PENDING_ACCOUNT_APPROVAL' } });

      // Invalidate stats cache
      cache.del('admin_stats');

      return NextResponse.json({
        success: true,
        action: 'ACCOUNT_REQUESTED',
        message: `Account request submitted for ${gameTitle}. Coins will be automatically added when approved!`
      });
    }
  } catch (err) {
    console.error('Claim Referral Reward API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
