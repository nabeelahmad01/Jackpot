import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { enrichDistributorsWithStats } from '../../../lib/entityStats';
import { invalidateTypeBDistributorCache } from '../../../lib/typeBDistributors';
import { jsonOk } from '../../../lib/apiResponse';
import { purgeAccountAccess } from '../../../lib/sessionRevoke';

// GET list of distributors (with dynamic statistics)
export async function GET() {
  try {
    const cached = cache.get('distributors_enriched');
    if (cached) {
      return jsonOk({ success: true, distributors: cached }, { cacheSeconds: 45 });
    }

    const db = await getDb();
    const distributors = await db.collection('distributors').find({}, {
      projection: { password: 0 }
    }).toArray();

    const enrichedDistributors = await enrichDistributorsWithStats(db, distributors);
    cache.set('distributors_enriched', enrichedDistributors, 45);

    return jsonOk({ success: true, distributors: enrichedDistributors }, { cacheSeconds: 45 });
  } catch (err) {
    console.error('Fetch Distributors API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create a new distributor
export async function POST(req) {
  try {
    const { name, email, password, type, commissionRate, websiteCommissionRate } = await req.json();

    if (!name || !email || !password || !type) {
      return NextResponse.json({ success: false, message: 'Missing required distributor fields.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');

    const existing = await distributorsCollection.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ success: false, message: 'A distributor with this email is already registered.' }, { status: 400 });
    }

    const id = 'dist_' + Math.random().toString(36).substring(2, 7);

    const newDist = {
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      role: 'distributor',
      type: type,
      commissionRate: parseFloat(commissionRate || 0),
      websiteCommissionRate: parseFloat(websiteCommissionRate || 0),
      createdAt: new Date().toISOString()
    };

    await distributorsCollection.insertOne(newDist);
    cache.del('admin_stats');
    cache.del('distributors_enriched');
    invalidateTypeBDistributorCache();

    return NextResponse.json({ success: true, distributor: newDist, message: 'Distributor successfully registered!' });
  } catch (err) {
    console.error('Create Distributor API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT edit distributor details
export async function PUT(req) {
  try {
    const { id, name, email, password, type, commissionRate, websiteCommissionRate } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (email !== undefined) updateFields.email = email.toLowerCase().trim();
    if (password !== undefined && password.trim() !== '') updateFields.password = password.trim();
    if (type !== undefined) updateFields.type = type;
    if (commissionRate !== undefined) updateFields.commissionRate = parseFloat(commissionRate || 0);
    if (websiteCommissionRate !== undefined) updateFields.websiteCommissionRate = parseFloat(websiteCommissionRate || 0);

    const result = await distributorsCollection.updateOne({ id }, { $set: updateFields });

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    cache.del('admin_stats');
    cache.del('distributors_enriched');
    invalidateTypeBDistributorCache();
    return NextResponse.json({ success: true, message: 'Distributor details updated successfully!' });
  } catch (err) {
    console.error('Update Distributor API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE a distributor.
// The distributor's players are handed over to the super admin: their
// distributorId is cleared (so they become direct players), their existing game
// accounts are removed so they must re-request fresh accounts, and all of their
// records (requests, transactions, coins notifications) are reassigned to the
// super admin. The distributor's own staff logins are removed too.
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');

    const distDoc = await distributorsCollection.findOne({ id });
    const result = await distributorsCollection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    // Archive the deleted distributor so it shows in the "Deleted Accounts" view
    // and is auto-purged after 30 days (TTL index on the Date `deletedAt`).
    if (distDoc) {
      const deletedCollection = db.collection('deletedUsers');
      await deletedCollection.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 2592000 });
      const { _id, ...distFields } = distDoc;
      await deletedCollection.insertOne({
        ...distFields,
        deletedEntityType: 'distributor',
        deletedAt: new Date()
      });
    }

    const usersCollection = db.collection('users');

    // Players belonging to this distributor.
    const players = await usersCollection
      .find({ distributorId: id, role: 'user' }, { projection: { email: 1 } })
      .toArray();
    // gameAccounts / accountRequests always store lowercased emails
    const playerEmails = [
      ...new Set(
        players
          .map((p) => String(p.email || '').toLowerCase().trim())
          .filter(Boolean)
      )
    ];

    // Remove their game accounts AND their old account requests so each player
    // starts fresh: the lobby will show the "Request / Create Account" option
    // again, and the new request will route to the super admin (their
    // distributorId is now cleared).
    if (playerEmails.length > 0) {
      const emailMatchers = playerEmails.map(
        (email) => new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      );
      await db.collection('gameAccounts').deleteMany({ userEmail: { $in: emailMatchers } });
      await db.collection('accountRequests').deleteMany({ userEmail: { $in: emailMatchers } });
    }

    // Hand players (and their financial records) over to the super admin.
    await usersCollection.updateMany(
      { distributorId: id, role: 'user' },
      { $set: { distributorId: '' } }
    );
    await db.collection('transactions').updateMany(
      { distributorId: id },
      { $set: { distributorId: '' } }
    );
    await db.collection('coinsNotifications').updateMany(
      { distributorId: id },
      { $set: { distributorId: '' } }
    );

    // Remove the distributor's own staff logins and gateways (they belong to the
    // now-deleted distributor and would otherwise be orphaned). Force-logout
    // owner + staff so any open portal session dies immediately.
    const staffToKick = await usersCollection
      .find({ distributorId: id, role: { $ne: 'user' } }, { projection: { email: 1 } })
      .toArray();
    await usersCollection.deleteMany({ distributorId: id, role: { $ne: 'user' } });
    await db.collection('gateways').deleteMany({ distributorId: id });

    if (distDoc?.email) {
      await purgeAccountAccess(db, distDoc.email, distDoc);
    }
    for (const staff of staffToKick) {
      if (staff?.email) await purgeAccountAccess(db, staff.email, staff);
    }

    cache.del('admin_stats');
    cache.del('distributors_enriched');
    invalidateTypeBDistributorCache();
    return NextResponse.json({
      success: true,
      message: `Distributor deleted. ${playerEmails.length} player(s) moved to super admin; their game accounts were reset.`
    });
  } catch (err) {
    console.error('Delete Distributor API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
