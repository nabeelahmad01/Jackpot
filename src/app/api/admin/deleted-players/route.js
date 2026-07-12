import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

// GET deleted players list (Super Admin only)
export async function GET(req) {
  try {
    const db = await getDb();
    const deletedCollection = db.collection('deletedUsers');

    const deletedPlayers = await deletedCollection
      .find({})
      .sort({ deletedAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, deletedPlayers });
  } catch (err) {
    console.error('Fetch Deleted Players Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST restore player / Undo delete (Super Admin only)
export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Player email is required to restore.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    
    // Find player in deleted collection
    const deletedPlayer = await db.collection('deletedUsers').findOne({ email: cleanEmail });
    if (!deletedPlayer) {
      return NextResponse.json({ success: false, message: 'Deleted player account not found.' }, { status: 404 });
    }

    // Check if player email already occupied in active users in the meantime
    const activeCheck = await db.collection('users').findOne({ email: cleanEmail });
    if (activeCheck) {
      return NextResponse.json({ success: false, message: 'An active user account with this email already exists now. Cannot restore.' }, { status: 400 });
    }

    // Extract the original fields, excluding deletedAt
    const { deletedAt, _id, ...originalUser } = deletedPlayer;

    // Restore to users collection
    await db.collection('users').insertOne(originalUser);

    // Delete from deleted collection
    await db.collection('deletedUsers').deleteOne({ email: cleanEmail });
    
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Player account restored successfully!' });
  } catch (err) {
    console.error('Restore Player Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
