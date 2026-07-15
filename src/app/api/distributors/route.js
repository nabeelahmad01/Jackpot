import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { calcCommissionFromProfit, calcNetProfit } from '../../../lib/commission';

// GET list of distributors (with dynamic statistics)
export async function GET() {
  try {
    const db = await getDb();
    const distributorsCollection = db.collection('distributors');
    const usersCollection = db.collection('users');
    const transactionsCollection = db.collection('transactions');

    const distributors = await distributorsCollection.find().toArray();

    // Compute stats for each distributor
    const enrichedDistributors = await Promise.all(distributors.map(async (dist) => {
      // 1. Get referred players list
      const players = await usersCollection.find({ distributorId: dist.id, role: 'user' }).toArray();
      const playerEmails = players.map(p => p.email.toLowerCase().trim());

      let totalDeposits = 0;
      let totalWithdrawals = 0;

      if (playerEmails.length > 0) {
        // 2. Aggregate successful deposits
        const depositDocs = await transactionsCollection.find({
          userEmail: { $in: playerEmails },
          type: 'DEPOSIT',
          status: 'SUCCESS'
        }).toArray();
        totalDeposits = depositDocs.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

        // 3. Aggregate successful withdrawals
        const withdrawDocs = await transactionsCollection.find({
          userEmail: { $in: playerEmails },
          type: 'WITHDRAW',
          status: 'SUCCESS'
        }).toArray();
        totalWithdrawals = withdrawDocs.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
      }

      const netProfit = calcNetProfit(totalDeposits, totalWithdrawals);
      const commissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, dist.commissionRate);
      const websiteCommissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, dist.websiteCommissionRate);

      return {
        ...dist,
        playersCount: playerEmails.length,
        totalDeposits,
        totalWithdrawals,
        netProfit,
        commissionEarned,
        websiteCommissionEarned
      };
    }));

    return NextResponse.json({ success: true, distributors: enrichedDistributors });
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

    // Check if email already exists
    const existing = await distributorsCollection.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ success: false, message: 'A distributor with this email is already registered.' }, { status: 400 });
    }

    // Generate unique alphanumeric ID tag (e.g. dist_abc12)
    const id = 'dist_' + Math.random().toString(36).substring(2, 7);

    const newDist = {
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      role: 'distributor',
      type: type, // 'A' or 'B'
      commissionRate: parseFloat(commissionRate || 0),
      websiteCommissionRate: parseFloat(websiteCommissionRate || 0),
      createdAt: new Date().toISOString()
    };

    await distributorsCollection.insertOne(newDist);
    cache.del('admin_stats');

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
    return NextResponse.json({ success: true, message: 'Distributor deleted successfully!' });
  } catch (err) {
    console.error('Delete Distributor API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
