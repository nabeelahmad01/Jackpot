import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET requests (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }
    const adminRole = searchParams.get('adminRole');
    const adminDistributorId = searchParams.get('adminDistributorId');

    if (adminDistributorId) {
      query.distributorId = adminDistributorId;
    }

    if (status) {
      query.status = status.toUpperCase().trim();
    }

    if (search) {
      const cleanSearch = search.trim();
      const searchCriteria = {
        $or: [
          { userEmail: { $regex: cleanSearch, $options: 'i' } },
          { gameTitle: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
      if (Object.keys(query).length > 0) {
        query = { $and: [query, searchCriteria] };
      } else {
        query = searchCriteria;
      }
    }

    const totalRequests = await requestsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    const requests = await requestsCollection.find(query)
      .sort({ id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      accountRequests: requests,
      totalRequests,
      totalPages: Math.ceil(totalRequests / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Fetch Account Requests API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new request (Player submission)
export async function POST(req) {
  try {
    const { gameTitle, userEmail } = await req.json();

    if (!gameTitle || !userEmail) {
      return NextResponse.json({ success: false, message: 'Game title and email are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    // Retrieve player's profile to extract distributor information
    const userDoc = await db.collection('users').findOne({ email: userEmail.toLowerCase().trim() });
    const distId = userDoc ? (userDoc.distributorId || '') : '';
    let distType = '';
    let distName = '';

    if (distId) {
      const distributor = await db.collection('distributors').findOne({ id: distId });
      if (distributor) {
        distType = distributor.type || 'A';
        distName = distributor.name || '';
      }
    }

    const newRequest = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      gameTitle,
      userEmail: userEmail.toLowerCase().trim(),
      status: 'PENDING',
      date: new Date().toLocaleString(),
      distributorId: distId,
      distributorType: distType,
      distributorName: distName
    };
    await requestsCollection.insertOne(newRequest);
    
    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, request: newRequest, message: 'Game account request submitted successfully!' });
  } catch (err) {
    console.error('Create Account Request API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT (update status) request (Admin approval/rejection)
export async function PUT(req) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'Request ID and status are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    const requestDoc = await requestsCollection.findOne({ id });
    if (!requestDoc) {
      return NextResponse.json({ success: false, message: 'Account request not found.' }, { status: 404 });
    }

    await requestsCollection.updateOne({ id }, { $set: { status } });

    // Handle automated referral reward coin allotment if the account was approved (status READY)
    if (status === 'READY' && requestDoc.referralRewardId) {
      try {
        const pendingReferralsCollection = db.collection('pendingReferrals');
        const refDoc = await pendingReferralsCollection.findOne({ id: requestDoc.referralRewardId });
        
        if (refDoc && refDoc.status !== 'CLAIMED') {
          // Add the allotment notification task directly for the coins manager to fulfill
          await db.collection('coinsNotifications').insertOne({
            id: Date.now().toString() + Math.floor(Math.random() * 100 + 1).toString(),
            userEmail: refDoc.referrerEmail,
            gameTitle: requestDoc.gameTitle,
            depositAmount: 0,
            bonusApplied: -2, // -2 indicates Referral Reward
            totalCoins: Number(refDoc.rewardCoins),
            status: 'PENDING',
            read: false,
            timestamp: new Date().toISOString()
          });

          // Mark pendingReferrals doc as CLAIMED
          await pendingReferralsCollection.updateOne(
            { id: requestDoc.referralRewardId },
            { $set: { status: 'CLAIMED', claimedAt: new Date().toISOString() } }
          );
        }
      } catch (refErr) {
        console.error('Failed to auto-allot referral bonus upon account request approval:', refErr);
      }
    }
    
    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Account request status updated successfully!' });
  } catch (err) {
    console.error('Update Account Request API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

