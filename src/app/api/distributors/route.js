import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { enrichDistributorsWithStats } from '../../../lib/entityStats';
import { invalidateTypeBDistributorCache } from '../../../lib/typeBDistributors';
import { jsonOk } from '../../../lib/apiResponse';
import { purgeAccountAccess, revokeSession } from '../../../lib/sessionRevoke';

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
// Players KEEP all game data. They are handed to Super Admin HQ so requests /
// deposits / coins traffic show under HQ. Undo re-links players back to this
// distributor. Staff + gateways are removed (distributor portal is gone).
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');
    const usersCollection = db.collection('users');

    const distDoc = await distributorsCollection.findOne({ id });
    if (!distDoc) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    // Snapshot players BEFORE clearing links (needed for Undo re-link)
    const players = await usersCollection
      .find({ distributorId: id, role: 'user' }, { projection: { email: 1 } })
      .toArray();
    const playerEmails = [
      ...new Set(
        players
          .map((p) => String(p.email || '').toLowerCase().trim())
          .filter(Boolean)
      )
    ];

    const hqClear = {
      distributorId: '',
      distributorType: '',
      distributorName: ''
    };

    // KEEP gameAccounts. Reassign ops tags → HQ (clear Type B so Super Admin sees them).
    await Promise.all([
      usersCollection.updateMany(
        { distributorId: id, role: 'user' },
        { $set: { distributorId: '', formerDistributorId: id } }
      ),
      db.collection('accountRequests').updateMany(
        { $or: [{ distributorId: id }, ...(playerEmails.length ? [{ userEmail: { $in: playerEmails } }] : [])] },
        { $set: hqClear }
      ),
      db.collection('transactions').updateMany(
        { $or: [{ distributorId: id }, ...(playerEmails.length ? [{ userEmail: { $in: playerEmails } }] : [])] },
        { $set: hqClear }
      ),
      db.collection('coinsNotifications').updateMany(
        { $or: [{ distributorId: id }, ...(playerEmails.length ? [{ userEmail: { $in: playerEmails } }] : [])] },
        { $set: hqClear }
      )
    ]);

    // Remove distributor row
    await distributorsCollection.deleteOne({ id });

    // Staff + gateways (portal gone). Force-logout owner + staff.
    const staffToKick = await usersCollection
      .find({ distributorId: id, role: { $ne: 'user' } }, { projection: { email: 1, name: 1, role: 1, distributorId: 1 } })
      .toArray();
    await usersCollection.deleteMany({ distributorId: id, role: { $ne: 'user' } });
    await db.collection('gateways').deleteMany({ distributorId: id });

    for (const staff of staffToKick) {
      if (staff?.email) await purgeAccountAccess(db, staff.email, staff, { deletedBy: 'admin' });
    }

    // Archive distributor LAST (do not let purge overwrite this row)
    const deletedCollection = db.collection('deletedUsers');
    await deletedCollection.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 2592000 });
    const { _id, ...distFields } = distDoc;
    const ownerEmail = String(distDoc.email || '').toLowerCase().trim();
    if (ownerEmail) {
      revokeSession(ownerEmail);
      try {
        await db.collection('pushSubscriptions').deleteMany({ userEmail: ownerEmail });
      } catch {
        /* ignore */
      }
    }
    await deletedCollection.updateOne(
      { email: ownerEmail || `distributor:${id}` },
      {
        $set: {
          ...distFields,
          email: ownerEmail || `distributor:${id}`,
          deletedEntityType: 'distributor',
          deletedAt: new Date(),
          linkedPlayerEmails: playerEmails,
          formerDistributorId: id
        }
      },
      { upsert: true }
    );

    cache.del('admin_stats');
    cache.del('distributors_enriched');
    invalidateTypeBDistributorCache();
    return NextResponse.json({
      success: true,
      message: `Distributor deleted. ${playerEmails.length} player(s) kept with full data — requests/deposits now go to Super Admin. Undo will return them to this distributor.`
    });
  } catch (err) {
    console.error('Delete Distributor API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
