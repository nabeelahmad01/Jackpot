import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { applyStaffGameFilter, staffCanAccessGame } from '../../../lib/staffGameAccess';

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

    const adminRole = searchParams.get('adminRole');
    const adminDistributorId = searchParams.get('adminDistributorId');
    const adminEmail = searchParams.get('adminEmail');

    // 1. FAST PATH: No Search Active (Only fetch actual requests)
    if (!search) {
      let query = {};
      if (email) {
        query.userEmail = email.toLowerCase().trim();
      }

      // Player self-view (?email=) must see their own requests even under Type B distributors.
      // Type B exclusion only applies to global admin list views (no email, no adminDistributorId).
      if (adminDistributorId) {
        query.distributorId = adminDistributorId;
      } else if (!email) {
        const typeBDists = await db.collection('distributors').find({ type: 'B' }).project({ id: 1 }).toArray();
        const typeBDistIds = typeBDists.map(d => d.id).filter(Boolean);
        if (typeBDistIds.length > 0) {
          query.distributorId = { $nin: typeBDistIds };
        }
      }

      if (status) {
        query.status = status.toUpperCase().trim();
      }

      if (adminEmail) {
        query = await applyStaffGameFilter(db, query, adminEmail);
      }

      const totalRequests = await requestsCollection.countDocuments(query);
      const skip = (page - 1) * limit;

      const requests = await requestsCollection.find(query)
        .sort({ id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Batch look up existing game accounts for the unique request emails
      let enrichedRequests = [];
      if (requests.length > 0) {
        const uniqueEmails = Array.from(new Set(requests.map(r => r.userEmail.toLowerCase().trim())));
        const gameAccounts = await db.collection('gameAccounts').find({ userEmail: { $in: uniqueEmails } }).toArray();
        
        const accountsByEmail = {};
        gameAccounts.forEach(acc => {
          const emailKey = acc.userEmail.toLowerCase().trim();
          if (!accountsByEmail[emailKey]) {
            accountsByEmail[emailKey] = [];
          }
          accountsByEmail[emailKey].push({ gameTitle: acc.gameTitle, username: acc.username });
        });

        enrichedRequests = requests.map(r => {
          const emailKey = r.userEmail.toLowerCase().trim();
          return {
            ...r,
            existingAccounts: accountsByEmail[emailKey] || []
          };
        });
      }

      return NextResponse.json({
        success: true,
        accountRequests: enrichedRequests,
        totalRequests,
        totalPages: Math.ceil(totalRequests / limit),
        currentPage: page
      });
    }

    // 2. SEARCH PATH: Deep Search across Users, gameAccounts and accountRequests
    const cleanSearch = search.trim();

    // Query matched users
    const matchedUsers = await db.collection('users').find({
      $or: [
        { email: { $regex: cleanSearch, $options: 'i' } },
        { name: { $regex: cleanSearch, $options: 'i' } }
      ]
    }).project({ email: 1, distributorId: 1 }).toArray();

    // Query matched game accounts
    const matchedAccounts = await db.collection('gameAccounts').find({
      $or: [
        { username: { $regex: cleanSearch, $options: 'i' } },
        { userEmail: { $regex: cleanSearch, $options: 'i' } },
        { gameTitle: { $regex: cleanSearch, $options: 'i' } }
      ]
    }).toArray();

    // Query matched requests
    const matchedRequests = await requestsCollection.find({
      $or: [
        { userEmail: { $regex: cleanSearch, $options: 'i' } },
        { gameTitle: { $regex: cleanSearch, $options: 'i' } }
      ]
    }).toArray();

    // Gather unique emails
    const uniqueEmails = new Set();
    matchedUsers.forEach(u => {
      if (u.email) uniqueEmails.add(u.email.toLowerCase().trim());
    });
    matchedAccounts.forEach(acc => {
      if (acc.userEmail) uniqueEmails.add(acc.userEmail.toLowerCase().trim());
    });
    matchedRequests.forEach(req => {
      if (req.userEmail) uniqueEmails.add(req.userEmail.toLowerCase().trim());
    });

    const emailsArray = Array.from(uniqueEmails);
    if (emailsArray.length === 0) {
      return NextResponse.json({
        success: true,
        accountRequests: [],
        totalRequests: 0,
        totalPages: 0,
        currentPage: page
      });
    }

    // Resolve distributorId for all matching emails to check permissions
    const usersForEmails = await db.collection('users').find({
      email: { $in: emailsArray }
    }).project({ email: 1, distributorId: 1 }).toArray();

    const userDistMap = {};
    usersForEmails.forEach(u => {
      userDistMap[u.email.toLowerCase().trim()] = u.distributorId || '';
    });

    // Exclude Type B distributor players unless requested by that specific distributor
    const typeBDists = await db.collection('distributors').find({ type: 'B' }).project({ id: 1 }).toArray();
    const typeBDistIds = typeBDists.map(d => d.id).filter(Boolean);

    const filteredEmails = [];
    emailsArray.forEach(emailKey => {
      const userDistId = userDistMap[emailKey] || '';
      // When a specific player email is requested, do not hide Type B players from themselves
      if (email && emailKey === email.toLowerCase().trim()) {
        filteredEmails.push(emailKey);
        return;
      }
      if (adminDistributorId) {
        if (userDistId === adminDistributorId) {
          filteredEmails.push(emailKey);
        }
      } else if (!email) {
        if (!typeBDistIds.includes(userDistId)) {
          filteredEmails.push(emailKey);
        }
      } else {
        filteredEmails.push(emailKey);
      }
    });

    if (filteredEmails.length === 0) {
      return NextResponse.json({
        success: true,
        accountRequests: [],
        totalRequests: 0,
        totalPages: 0,
        currentPage: page
      });
    }

    // Retrieve real requests for these filtered user emails
    const realRequests = await requestsCollection.find({
      userEmail: { $in: filteredEmails }
    }).toArray();

    const emailsWithRequests = new Set(realRequests.map(r => r.userEmail.toLowerCase().trim()));

    // Synthesize pseudo-requests for matching users who do not have any requests record
    const syntheticRequests = [];
    filteredEmails.forEach(emailKey => {
      if (!emailsWithRequests.has(emailKey)) {
        const userDoc = usersForEmails.find(u => u.email.toLowerCase().trim() === emailKey);
        syntheticRequests.push({
          id: 'synthetic-' + emailKey + '-' + Date.now(),
          gameTitle: '—',
          userEmail: emailKey,
          status: 'READY',
          date: '—',
          createdAt: new Date().toISOString(),
          distributorId: userDoc?.distributorId || '',
          isSynthetic: true
        });
      }
    });

    // Combine and sort (PENDING statuses first, then rest)
    const combined = [...realRequests, ...syntheticRequests];
    combined.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      const dateA = a.createdAt || a.date || '';
      const dateB = b.createdAt || b.date || '';
      return dateB.localeCompare(dateA);
    });

    const totalRequests = combined.length;
    const skip = (page - 1) * limit;
    const paginated = combined.slice(skip, skip + limit);

    // Fetch and enrich paginated users with existing game accounts
    let enrichedRequests = [];
    if (paginated.length > 0) {
      const paginatedEmails = Array.from(new Set(paginated.map(r => r.userEmail.toLowerCase().trim())));
      const gameAccounts = await db.collection('gameAccounts').find({ userEmail: { $in: paginatedEmails } }).toArray();

      const accountsByEmail = {};
      gameAccounts.forEach(acc => {
        const emailKey = acc.userEmail.toLowerCase().trim();
        if (!accountsByEmail[emailKey]) {
          accountsByEmail[emailKey] = [];
        }
        accountsByEmail[emailKey].push({ gameTitle: acc.gameTitle, username: acc.username });
      });

      enrichedRequests = paginated.map(r => {
        const emailKey = r.userEmail.toLowerCase().trim();
        return {
          ...r,
          existingAccounts: accountsByEmail[emailKey] || []
        };
      });
    }

    return NextResponse.json({
      success: true,
      accountRequests: enrichedRequests,
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
    let distId = userDoc ? (userDoc.distributorId || '') : '';
    let distType = '';
    let distName = '';

    // Inherit distributor from referrer when player was referred by another player under a distributor
    if (!distId && userDoc?.referredBy) {
      const referrer = await db.collection('users').findOne({
        email: userDoc.referredBy.toLowerCase().trim()
      });
      if (referrer?.distributorId) {
        distId = referrer.distributorId;
      }
    }

    if (distId) {
      const distributor = await db.collection('distributors').findOne({ id: distId });
      if (distributor) {
        distType = distributor.type || 'A';
        distName = distributor.name || '';
      }
    }

    // Backfill distributorId on user profile when inherited from referrer
    if (userDoc && distId && !userDoc.distributorId) {
      await db.collection('users').updateOne(
        { email: userEmail.toLowerCase().trim() },
        { $set: { distributorId: distId } }
      );
    }

    const newRequest = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      gameTitle,
      userEmail: userEmail.toLowerCase().trim(),
      status: 'PENDING',
      date: new Date().toLocaleString(),
      createdAt: new Date().toISOString(),
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
    const { id, status, gameAccountUsername, gameAccountPassword, processedBy, rejectionReason, adminEmail } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'Request ID and status are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    const requestDoc = await requestsCollection.findOne({ id });
    if (!requestDoc) {
      return NextResponse.json({ success: false, message: 'Account request not found.' }, { status: 404 });
    }

    const actorEmail = adminEmail || processedBy;
    if (actorEmail && !(await staffCanAccessGame(db, actorEmail, requestDoc.gameTitle))) {
      return NextResponse.json({ success: false, message: 'You do not have access to process requests for this game.' }, { status: 403 });
    }

    // Normalize COMPLETED -> READY when credentials are provided (distributor approve flow)
    let finalStatus = status;
    if ((status === 'COMPLETED' || status === 'READY') && gameAccountUsername && gameAccountPassword) {
      finalStatus = 'READY';

      // Create or upsert the game account credentials
      const gameAccountsCollection = db.collection('gameAccounts');
      await gameAccountsCollection.updateOne(
        { userEmail: requestDoc.userEmail.toLowerCase().trim(), gameTitle: requestDoc.gameTitle },
        {
          $set: {
            username: gameAccountUsername.trim(),
            password: gameAccountPassword.trim(),
            status: 'READY'
          }
        },
        { upsert: true }
      );
    }

    const updateFields = { status: finalStatus };
    if (processedBy) updateFields.processedBy = processedBy;
    if (rejectionReason) updateFields.rejectionReason = rejectionReason;

    await requestsCollection.updateOne({ id }, { $set: updateFields });

    // Handle automated referral reward coin allotment if the account was approved (status READY)
    if (status === 'READY' && requestDoc.referralRewardId) {
      try {
        const pendingReferralsCollection = db.collection('pendingReferrals');
        const refDoc = await pendingReferralsCollection.findOne({ id: requestDoc.referralRewardId });
        
        if (refDoc && refDoc.status !== 'CLAIMED') {
          // 1. Fetch the referrer's profile to extract distributorId
          const referrerUser = await db.collection('users').findOne({ email: refDoc.referrerEmail.toLowerCase().trim() });
          const distId = referrerUser ? (referrerUser.distributorId || '') : '';

          // 2. Insert transaction record for referral bonus
          const txId = (Date.now() + Math.floor(Math.random() * 100)).toString();
          await db.collection('transactions').insertOne({
            id: txId,
            userEmail: refDoc.referrerEmail.toLowerCase().trim(),
            date: new Date().toLocaleString(),
            type: 'BONUS',
            amount: Number(refDoc.rewardCoins),
            gateway: 'REFERRAL BONUS',
            code: 'REFERRAL',
            status: 'SUCCESS',
            gameTitle: requestDoc.gameTitle || 'Lobby',
            note: `Referral reward for inviting ${refDoc.refereeEmail}`,
            distributorId: distId
          });

          // 3. Add the allotment notification task directly for the coins manager to fulfill
          await db.collection('coinsNotifications').insertOne({
            id: Date.now().toString() + Math.floor(Math.random() * 100 + 1).toString(),
            userEmail: refDoc.referrerEmail,
            gameTitle: requestDoc.gameTitle,
            depositAmount: 0,
            bonusApplied: -2, // -2 indicates Referral Reward
            totalCoins: Number(refDoc.rewardCoins),
            status: 'PENDING',
            read: false,
            timestamp: new Date().toISOString(),
            transactionId: txId,
            distributorId: distId
          });

          // 4. Mark pendingReferrals doc as CLAIMED
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

