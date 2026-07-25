import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { invalidateTypeBDistributorCache } from '../../../../lib/typeBDistributors';
import {
  clearSessionRevoke,
  createHqPendingAccountRequests,
  wipePlayerGameAccess
} from '../../../../lib/sessionRevoke';

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

    const {
      deletedAt,
      _id,
      deletedEntityType,
      deletedBy,
      wipeGameAccess,
      restoreGameTitles,
      ...original
    } = deletedRecord;

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
      clearSessionRevoke(cleanEmail);
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

    const mustWipeGames =
      wipeGameAccess === true ||
      deletedBy === 'distributor';

    // Distributor-deleted player → unlink from distributor so new work is HQ Super Admin.
    const restoreUser = { ...original };
    let requeued = 0;
    if (mustWipeGames) {
      restoreUser.distributorId = '';
      delete restoreUser.distributorType;
      delete restoreUser.distributorName;
    }

    await db.collection('users').insertOne(restoreUser);

    if (mustWipeGames) {
      await wipePlayerGameAccess(db, cleanEmail);

      // Re-queue PENDING requests under HQ (no distributor) → Super Admin Requests tab
      const titles = Array.isArray(restoreGameTitles) ? restoreGameTitles : [];
      requeued = await createHqPendingAccountRequests(
        db,
        cleanEmail,
        titles,
        restoreUser.name || ''
      );
    }

    await db.collection('deletedUsers').deleteOne({ email: cleanEmail });

    // Allow login immediately after Undo
    clearSessionRevoke(cleanEmail);

    cache.del('admin_stats');

    let message = 'Player restored with their previous game accounts.';
    if (mustWipeGames) {
      message = requeued > 0
        ? `Player restored under HQ. ${requeued} game request(s) sent to your Requests tab.`
        : 'Player restored under HQ (unlinked from distributor). No prior games found — player can Request / Create.';
    }

    return NextResponse.json({
      success: true,
      message,
      wipedGameAccess: mustWipeGames,
      requeuedRequests: requeued
    });
  } catch (err) {
    console.error('Restore Player Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
