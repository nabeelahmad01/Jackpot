import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { publishAdminEvent } from '../../../lib/adminEvents';

async function markMatchingRequestsReady(db, cleanEmail, cleanTitle, username, password, processedBy) {
  const titleRegex = new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const update = {
    status: 'READY',
    gameAccountUsername: username,
    gameAccountPassword: password
  };
  if (processedBy) update.processedBy = processedBy;

  const result = await db.collection('accountRequests').updateMany(
    {
      userEmail: cleanEmail,
      gameTitle: titleRegex,
      status: { $in: ['PENDING', 'READY'] }
    },
    { $set: update }
  );
  return result.modifiedCount || 0;
}

// GET game credentials (optionally filtered by email)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    const db = await getDb();
    const gameAccountsCollection = db.collection('gameAccounts');

    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    const accounts = await gameAccountsCollection.find(query).toArray();
    return NextResponse.json({ success: true, gameAccounts: accounts });
  } catch (err) {
    console.error('Fetch Game Accounts API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new game credentials (inserted by admin on approval)
export async function POST(req) {
  try {
    const { gameTitle, userEmail, username, password } = await req.json();

    if (!gameTitle || !userEmail || !username || !password) {
      return NextResponse.json({ success: false, message: 'Missing credentials information.' }, { status: 400 });
    }

    const db = await getDb();
    const gameAccountsCollection = db.collection('gameAccounts');

    const cleanEmail = userEmail.toLowerCase().trim();
    const cleanTitle = String(gameTitle).trim();
    const titleRegex = new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    // Prefer updating an existing row (any casing) instead of inserting a duplicate
    const existing = await gameAccountsCollection.findOne({
      userEmail: cleanEmail,
      gameTitle: titleRegex
    });

    let newAccount;
    if (existing) {
      await gameAccountsCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            gameTitle: cleanTitle,
            username,
            password,
            status: 'READY'
          }
        }
      );
      await gameAccountsCollection.deleteMany({
        userEmail: cleanEmail,
        gameTitle: titleRegex,
        _id: { $ne: existing._id }
      });
      newAccount = { ...existing, gameTitle: cleanTitle, username, password, status: 'READY' };
    } else {
      newAccount = {
        gameTitle: cleanTitle,
        userEmail: cleanEmail,
        username,
        password,
        status: 'READY'
      };
      await gameAccountsCollection.insertOne(newAccount);
    }
    return NextResponse.json({ success: true, gameAccount: newAccount, message: 'Credentials generated successfully!' });
  } catch (err) {
    console.error('Create Game Account API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update or create game credentials manually (Admin adjustment)
export async function PUT(req) {
  try {
    const { gameTitle, userEmail, username, password, markRequestReady, processedBy } = await req.json();

    if (!gameTitle || !userEmail || !username || !password) {
      return NextResponse.json({ success: false, message: 'Missing credentials parameters.' }, { status: 400 });
    }

    const db = await getDb();
    const gameAccountsCollection = db.collection('gameAccounts');

    const cleanEmail = userEmail.toLowerCase().trim();
    const cleanTitle = String(gameTitle).trim();
    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();
    const titleRegex = new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    // Case-insensitive match so "VEGAS X" / "Vegas x" don't create duplicate accounts
    const existing = await gameAccountsCollection.findOne({
      userEmail: cleanEmail,
      gameTitle: titleRegex
    });

    if (existing) {
      await gameAccountsCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            gameTitle: cleanTitle,
            username: cleanUser,
            password: cleanPass,
            status: 'READY'
          }
        }
      );

      // Remove casing-duplicate leftovers for the same player + game
      await gameAccountsCollection.deleteMany({
        userEmail: cleanEmail,
        gameTitle: titleRegex,
        _id: { $ne: existing._id }
      });
    } else {
      await gameAccountsCollection.insertOne({
        gameTitle: cleanTitle,
        userEmail: cleanEmail,
        username: cleanUser,
        password: cleanPass,
        status: 'READY',
        createdAt: new Date().toISOString()
      });
    }

    // Manual "Add Account" should also close matching PENDING requests so list updates
    if (markRequestReady !== false) {
      await markMatchingRequestsReady(
        db,
        cleanEmail,
        cleanTitle,
        cleanUser,
        cleanPass,
        processedBy || ''
      );
    }

    publishAdminEvent('requests', { gameTitle: cleanTitle });

    return NextResponse.json({
      success: true,
      message: 'In-game credentials updated successfully!'
    });
  } catch (err) {
    console.error('Update Game Account API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE game credentials for a user
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    let userEmail = searchParams.get('userEmail');
    let gameTitle = searchParams.get('gameTitle');

    if (!userEmail || !gameTitle) {
      try {
        const body = await req.json();
        userEmail = body.userEmail;
        gameTitle = body.gameTitle;
      } catch (e) {}
    }

    if (!userEmail || !gameTitle) {
      return NextResponse.json({ success: false, message: 'userEmail and gameTitle are required.' }, { status: 400 });
    }

    const db = await getDb();
    const gameAccountsCollection = db.collection('gameAccounts');

    const result = await gameAccountsCollection.deleteMany({
      userEmail: userEmail.toLowerCase().trim(),
      gameTitle: {
        $regex: new RegExp(`^${String(gameTitle).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'No matching game credentials found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Game credentials deleted successfully!' });
  } catch (err) {
    console.error('Delete Game Account API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
