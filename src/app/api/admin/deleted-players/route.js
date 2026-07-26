import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { invalidateTypeBDistributorCache } from '../../../../lib/typeBDistributors';
import { publishAdminEvent } from '../../../../lib/adminEvents';
import {
  clearSessionRevoke,
  createHqPendingAccountRequests,
  wipePlayerGameAccess
} from '../../../../lib/sessionRevoke';

/** Strip distributor ownership so HQ Super Admin owns this player's ops. */
async function movePlayerOpsToHq(db, cleanEmail, formerDistributorId = '') {
  const hqTag = {
    distributorId: '',
    distributorType: '',
    distributorName: ''
  };
  const emailFilter = { userEmail: cleanEmail };
  await Promise.all([
    db.collection('transactions').updateMany(emailFilter, {
      $set: {
        ...hqTag,
        ...(formerDistributorId
          ? { formerDistributorId: String(formerDistributorId) }
          : {})
      }
    }),
    db.collection('coinsNotifications').updateMany(emailFilter, { $set: hqTag }),
    db.collection('supportMessages').updateMany(emailFilter, { $set: hqTag }),
    db.collection('accountRequests').updateMany(emailFilter, { $set: hqTag })
  ]);
}

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

    // Restore a deleted distributor + re-link players / ops traffic back to them.
    if (deletedEntityType === 'distributor' || original.role === 'distributor') {
      const {
        linkedPlayerEmails,
        formerDistributorId,
        ...distOriginal
      } = original;

      const clash = await db.collection('distributors').findOne({
        $or: [{ id: distOriginal.id }, { email: cleanEmail }]
      });
      if (clash) {
        return NextResponse.json({ success: false, message: 'An active distributor with this id/email already exists now. Cannot restore.' }, { status: 400 });
      }

      const distId = String(distOriginal.id || formerDistributorId || '').trim();
      if (!distId) {
        return NextResponse.json({ success: false, message: 'Distributor id missing from archive.' }, { status: 400 });
      }

      await db.collection('distributors').insertOne({ ...distOriginal, id: distId });

      const emailsFromArchive = Array.isArray(linkedPlayerEmails)
        ? linkedPlayerEmails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean)
        : [];
      const formerLinked = await db.collection('users')
        .find({ formerDistributorId: distId, role: 'user' }, { projection: { email: 1 } })
        .toArray();
      const emailsFromFormer = formerLinked
        .map((u) => String(u.email || '').toLowerCase().trim())
        .filter(Boolean);
      const playerEmails = [...new Set([...emailsFromArchive, ...emailsFromFormer])];

      const distType = String(distOriginal.type || 'A');
      const distName = String(distOriginal.name || '');
      const distTag = {
        distributorId: distId,
        distributorType: distType,
        distributorName: distName
      };

      if (playerEmails.length > 0) {
        await Promise.all([
          db.collection('users').updateMany(
            {
              role: 'user',
              $or: [
                { email: { $in: playerEmails } },
                { formerDistributorId: distId }
              ]
            },
            { $set: { distributorId: distId }, $unset: { formerDistributorId: '' } }
          ),
          db.collection('accountRequests').updateMany(
            { userEmail: { $in: playerEmails } },
            { $set: distTag }
          ),
          db.collection('transactions').updateMany(
            { userEmail: { $in: playerEmails } },
            { $set: distTag }
          ),
          db.collection('coinsNotifications').updateMany(
            { userEmail: { $in: playerEmails } },
            { $set: distTag }
          )
        ]);
      }

      await db.collection('deletedUsers').deleteOne({ email: cleanEmail });
      clearSessionRevoke(cleanEmail);
      cache.del('admin_stats');
      cache.del('distributors_enriched');
      invalidateTypeBDistributorCache();
      return NextResponse.json({
        success: true,
        message: `Distributor restored. ${playerEmails.length} player(s) re-linked — requests/deposits go back to this distributor.`,
        reLinkedPlayers: playerEmails.length
      });
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
    const formerDistributorId = String(original.distributorId || '').trim();
    let requeued = 0;
    if (mustWipeGames) {
      restoreUser.distributorId = '';
      delete restoreUser.distributorType;
      delete restoreUser.distributorName;
      if (formerDistributorId) {
        restoreUser.formerDistributorId = formerDistributorId;
      }
    }

    await db.collection('users').insertOne(restoreUser);

    if (mustWipeGames) {
      // Old distributor game credentials stay wiped — HQ creates fresh accounts.
      await wipePlayerGameAccess(db, cleanEmail);

      // Move deposits / withdraws / coins / support queues to Super Admin panel
      await movePlayerOpsToHq(db, cleanEmail, formerDistributorId);

      // Re-queue PENDING create-account options under HQ Requests tab
      const titles = Array.isArray(restoreGameTitles) ? restoreGameTitles : [];
      requeued = await createHqPendingAccountRequests(
        db,
        cleanEmail,
        titles,
        restoreUser.name || ''
      );

      publishAdminEvent('requests', { distributorId: '', userEmail: cleanEmail });
      publishAdminEvent('transactions', { distributorId: '', userEmail: cleanEmail });
      publishAdminEvent('coins', { distributorId: '', userEmail: cleanEmail });
    }

    await db.collection('deletedUsers').deleteOne({ email: cleanEmail });

    // Allow login immediately after Undo
    clearSessionRevoke(cleanEmail);

    cache.del('admin_stats');

    let message = 'Player restored with their previous game accounts.';
    if (mustWipeGames) {
      message = requeued > 0
        ? `Player restored under YOUR panel (HQ). Old game accounts cleared. ${requeued} game(s) are in Requests — create new accounts there. Deposits/withdraws/support now come to you.`
        : 'Player restored under YOUR panel (HQ). Old game accounts cleared. Unlinked from distributor — player can Request / Create games. Deposits/withdraws/support now come to you.';
    }

    return NextResponse.json({
      success: true,
      message,
      wipedGameAccess: mustWipeGames,
      requeuedRequests: requeued,
      games: Array.isArray(restoreGameTitles) ? restoreGameTitles : []
    });
  } catch (err) {
    console.error('Restore Player Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
