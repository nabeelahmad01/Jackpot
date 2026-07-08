import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

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

    const newAccount = {
      gameTitle,
      userEmail: userEmail.toLowerCase().trim(),
      username,
      password,
      status: 'READY'
    };

    await gameAccountsCollection.insertOne(newAccount);
    return NextResponse.json({ success: true, gameAccount: newAccount, message: 'Credentials generated successfully!' });
  } catch (err) {
    console.error('Create Game Account API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update or create game credentials manually (Admin adjustment)
export async function PUT(req) {
  try {
    const { gameTitle, userEmail, username, password } = await req.json();

    if (!gameTitle || !userEmail || !username || !password) {
      return NextResponse.json({ success: false, message: 'Missing credentials parameters.' }, { status: 400 });
    }

    const db = await getDb();
    const gameAccountsCollection = db.collection('gameAccounts');

    const cleanEmail = userEmail.toLowerCase().trim();

    // Use updateOne with upsert to update if exists or insert if new
    await gameAccountsCollection.updateOne(
      { userEmail: cleanEmail, gameTitle },
      {
        $set: {
          username: username.trim(),
          password: password.trim(),
          status: 'READY'
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'In-game credentials updated successfully!'
    });
  } catch (err) {
    console.error('Update Game Account API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
