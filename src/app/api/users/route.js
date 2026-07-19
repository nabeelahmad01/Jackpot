import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { isCoinsAdminRole } from '../../../lib/staffGameAccess';
import { getTypeBDistributorIds } from '../../../lib/typeBDistributors';

// GET users (Admin listing, or referrals query)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const referredBy = searchParams.get('referredBy');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const db = await getDb();
    const usersCollection = db.collection('users');

    if (referredBy) {
      // referredBy parameter is the referrer's email — find users referred by that email
      const referrals = await usersCollection.find(
        { referredBy: referredBy.toLowerCase().trim() },
        { projection: { name: 1, email: 1 } }
      ).toArray();
      return NextResponse.json({ success: true, referrals });
    }

    const segment = searchParams.get('segment');

    // Prepare search query
    let query = {};

    const adminDistributorId = searchParams.get('adminDistributorId');
    // The super-admin Player Accounts tab passes this to also surface Type B
    // distributor players (so they can be seen/kept even if the distributor is
    // later deleted). Other callers (promo targeting, etc.) omit it and keep the
    // original Type B exclusion, so nothing else changes.
    const includeDistributorPlayers = searchParams.get('includeDistributorPlayers') === '1';

    if (adminDistributorId) {
      query.distributorId = adminDistributorId;
      query.role = 'user';
    } else if (segment !== 'staff' && !includeDistributorPlayers) {
      const typeBDistIds = await getTypeBDistributorIds(db);
      if (typeBDistIds.length > 0) {
        query.$or = [
          { distributorId: { $nin: typeBDistIds } },
          { distributorId: { $in: typeBDistIds }, role: { $ne: 'user' } }
        ];
      }
    }
    if (segment === 'subscribed') {
      query.isSubscribed = true;
    } else if (segment === 'unsubscribed') {
      query.isSubscribed = { $ne: true };
    } else if (segment === 'staff') {
      query.role = { $nin: ['user', '', null] };
    } else if (segment === 'active') {
      const activeEmails = await db.collection('transactions').distinct('userEmail', {
        type: 'DEPOSIT',
        status: 'SUCCESS'
      });
      query.email = { $in: activeEmails.map((e) => e.toLowerCase().trim()) };
    }

    if (search) {
      const cleanSearch = search.trim();
      const searchCriteria = {
        $or: [
          { name: { $regex: cleanSearch, $options: 'i' } },
          { email: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
      if (Object.keys(query).length > 0) {
        query = { $and: [query, searchCriteria] };
      } else {
        query = searchCriteria;
      }
    }

    const totalUsers = await usersCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Fetch paginated users (excluding password fields for security)
    const users = await usersCollection.find(query, { projection: { password: 0 } })
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Fetch Users API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update user details (Admin adjustment of coins or role modifications)
export async function PUT(req) {
  try {
    const { email, coins, role, name, password, status, allowedGameIds } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'User email is required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    const usersCollection = db.collection('users');

    const currentUser = await usersCollection.findOne({ email: cleanEmail });
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const updateFields = {};
    let balanceChanged = false;
    const oldBalance = parseFloat(currentUser.coins || 0);
    let newBalance = oldBalance;

    if (coins !== undefined) {
      newBalance = parseFloat(coins);
      updateFields.coins = newBalance;
      balanceChanged = (newBalance !== oldBalance);
    }
    if (role !== undefined) {
      updateFields.role = role;
    }
    if (name !== undefined) {
      updateFields.name = name;
    }
    if (password !== undefined) {
      updateFields.password = password;
    }
    if (status !== undefined) {
      updateFields.status = status;
    }
    if (allowedGameIds !== undefined) {
      const roleToCheck = role !== undefined ? role : currentUser.role;
      if (isCoinsAdminRole(roleToCheck)) {
        const { validateAllowedGameIds } = await import('../../../lib/staffGameAccess');
        const validation = await validateAllowedGameIds(db, allowedGameIds, currentUser.distributorId || '');
        if (!validation.valid) {
          return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
        }
        updateFields.allowedGameIds = validation.allowedGameIds;
      } else {
        updateFields.allowedGameIds = [];
      }
    }

    const result = await usersCollection.updateOne(
      { email: cleanEmail },
      { $set: updateFields }
    );

    if (balanceChanged) {
      const diff = newBalance - oldBalance;
      const amountVal = Math.abs(diff);
      const diffText = diff > 0 ? `Credit of $${amountVal.toFixed(2)}` : `Debit of $${amountVal.toFixed(2)}`;
      
      const transactionsCollection = db.collection('transactions');
      const auditTx = {
        id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
        userEmail: cleanEmail,
        date: new Date().toLocaleString(),
        status: 'SUCCESS',
        type: 'BONUS',
        amount: amountVal,
        gateway: 'Admin Adjustment',
        gameTitle: 'Lobby',
        note: `Admin adjusted balance: ${diffText} (Previous: $${oldBalance.toFixed(2)}, New: $${newBalance.toFixed(2)})`
      };
      await transactionsCollection.insertOne(auditTx);
    }

    // Invalidate stats cache since coin/user edits could influence calculations
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'User details updated successfully!' });
  } catch (err) {
    console.error('Update User API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE a user account (Admin action)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, message: 'User email parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');
    const cleanEmail = email.toLowerCase().trim();

    const userDoc = await usersCollection.findOne({ email: cleanEmail });
    if (userDoc) {
      const deletedCollection = db.collection('deletedUsers');
      await deletedCollection.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL
      await deletedCollection.insertOne({
        ...userDoc,
        deletedAt: new Date().toISOString()
      });
      await usersCollection.deleteOne({ email: cleanEmail });
    }
    
    // Invalidate caches
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'User account deleted successfully.' });
  } catch (err) {
    console.error('Delete User API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

