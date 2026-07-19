import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { invalidateTypeBDistributorCache } from '../../../../lib/typeBDistributors';

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
    
    // Find the deleted record (player or distributor)
    const deletedRecord = await db.collection('deletedUsers').findOne({ email: cleanEmail });
    if (!deletedRecord) {
      return NextResponse.json({ success: false, message: 'Deleted account not found.' }, { status: 404 });
    }

    const { deletedAt, _id, deletedEntityType, ...original } = deletedRecord;

    // Restore a deleted distributor back into the distributors collection.
    if (deletedEntityType === 'distributor' || original.role === 'distributor') {
      const clash = await db.collection('distributors').findOne({
        $or: [{ id: original.id }, { email: cleanEmail }]
      });
      if (clash) {
        return NextResponse.json({ success: false, message: 'An active distributor with this id/email already exists now. Cannot restore.' }, { status: 400 });
      }
      await db.collection('distributors').insertOne(original);
      await db.collection('deletedUsers').deleteOne({ email: cleanEmail });
      cache.del('admin_stats');
      cache.del('distributors_enriched');
      invalidateTypeBDistributorCache();
      return NextResponse.json({ success: true, message: 'Distributor account restored successfully! (Its former players are not re-linked.)' });
    }

    // Check if player email already occupied in active users in the meantime
    const activeCheck = await db.collection('users').findOne({ email: cleanEmail });
    if (activeCheck) {
      return NextResponse.json({ success: false, message: 'An active user account with this email already exists now. Cannot restore.' }, { status: 400 });
    }

    // Restore to users collection
    await db.collection('users').insertOne(original);

    // Delete from deleted collection
    await db.collection('deletedUsers').deleteOne({ email: cleanEmail });
    
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Player account restored successfully!' });
  } catch (err) {
    console.error('Restore Player Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
