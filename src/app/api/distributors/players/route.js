import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { collectPlayerGameTitles, purgeAccountAccess } from '../../../../lib/sessionRevoke';

// GET players for a distributor (Fallback or direct list)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');
    const players = await usersCollection.find({ distributorId, role: 'user' }).toArray();

    return NextResponse.json({ success: true, players });
  } catch (err) {
    console.error('Fetch Distributor Players Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create player under distributor
export async function POST(req) {
  try {
    const { name, email, password, distributorId } = await req.json();

    if (!name || !email || !password || !distributorId) {
      return NextResponse.json({ success: false, message: 'Name, email, password and distributorId are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    
    // Check distributor exists
    const distributor = await db.collection('distributors').findOne({ id: distributorId });
    if (!distributor) {
      return NextResponse.json({ success: false, message: 'Parent distributor not found.' }, { status: 404 });
    }

    // Check user already exists
    const existing = await db.collection('users').findOne({ email: cleanEmail });
    if (existing) {
      return NextResponse.json({ success: false, message: `Account with email "${cleanEmail}" is already registered.` }, { status: 400 });
    }

    const uniqueReferral = Math.random().toString(36).substring(2, 7).toUpperCase();

    const newUser = {
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      role: 'user',
      coins: 0,
      referralCode: uniqueReferral,
      referredBy: '',
      distributorId: distributorId,
      createdAt: new Date().toISOString()
    };

    await db.collection('users').insertOne(newUser);
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Player registered successfully!', player: newUser });
  } catch (err) {
    console.error('Create Distributor Player Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT reset player password under distributor
export async function PUT(req) {
  try {
    const { email, password, distributorId } = await req.json();

    if (!email || !password || !distributorId) {
      return NextResponse.json({ success: false, message: 'Email, password and distributorId are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();

    // Verify player belongs to this distributor
    const player = await db.collection('users').findOne({ email: cleanEmail, distributorId });
    if (!player) {
      return NextResponse.json({ success: false, message: 'Player not found or does not belong to your distributor panel.' }, { status: 404 });
    }

    await db.collection('users').updateOne(
      { email: cleanEmail },
      { $set: { password: password.trim() } }
    );

    return NextResponse.json({ success: true, message: 'Player password reset successfully!' });
  } catch (err) {
    console.error('Reset Player Password Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE player under distributor (Soft Delete / Archive)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const distributorId = searchParams.get('distributorId');

    if (!email || !distributorId) {
      return NextResponse.json({ success: false, message: 'Email and distributorId parameters are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();

    // Verify player belongs to distributor
    const player = await db.collection('users').findOne({ email: cleanEmail, distributorId });
    if (!player) {
      return NextResponse.json({ success: false, message: 'Player not found or does not belong to your distributor panel.' }, { status: 404 });
    }

    // Snapshot games BEFORE wipe — Super Admin Undo re-queues HQ PENDING requests.
    const restoreGameTitles = await collectPlayerGameTitles(db, cleanEmail);

    // Archive + revoke. Wipe credentials so Undo does not restore distributor accounts.
    await db.collection('users').deleteOne({ email: cleanEmail });
    await purgeAccountAccess(db, cleanEmail, player, {
      deletedBy: 'distributor',
      wipeGameAccess: true,
      restoreGameTitles
    });
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Player account deleted successfully.' });
  } catch (err) {
    console.error('Delete Distributor Player Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
