import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { enrichDistributorsWithStats } from '../../../lib/entityStats';
import { invalidateTypeBDistributorCache } from '../../../lib/typeBDistributors';
import { jsonOk } from '../../../lib/apiResponse';

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

// DELETE a distributor (referred players remain unaffected)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');

    const result = await distributorsCollection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Distributor not found.' }, { status: 404 });
    }

    cache.del('admin_stats');
    cache.del('distributors_enriched');
    invalidateTypeBDistributorCache();
    return NextResponse.json({ success: true, message: 'Distributor deleted successfully!' });
  } catch (err) {
    console.error('Delete Distributor API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
