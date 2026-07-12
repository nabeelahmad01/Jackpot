import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET support chat messages
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    const adminDistributorId = searchParams.get('adminDistributorId');

    let baseQuery = {};
    if (adminDistributorId) {
      baseQuery.distributorId = adminDistributorId;
    }

    if (email) {
      // Return full conversation history for a specific player (usually small, but paginated/limited to protect DB)
      const skip = (page - 1) * limit;
      const messages = await supportCollection
        .find({ ...baseQuery, userEmail: email.toLowerCase().trim() })
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      return NextResponse.json({ success: true, messages });
    }

    // Admin view: get all messages, grouped or sorted so admin can list conversations
    // We fetch recent messages and let the backend/frontend group them by userEmail
    const skip = (page - 1) * limit;
    const messages = await supportCollection
      .find(baseQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({ success: true, messages });
  } catch (err) {
    console.error('Fetch Support Messages Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new support message (Player or Admin reply)
export async function POST(req) {
  try {
    const { userEmail, userName, message, attachment, senderType, senderEmail } = await req.json();

    if (!userEmail || !senderType) {
      return NextResponse.json({ success: false, message: 'User email and sender type are required.' }, { status: 400 });
    }

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    // Look up the player to tag their distributor settings
    const userDoc = await db.collection('users').findOne({ email: userEmail.toLowerCase().trim() });
    const distId = userDoc ? (userDoc.distributorId || '') : '';
    let distType = '';
    let distName = '';

    if (distId) {
      const distributor = await db.collection('distributors').findOne({ id: distId });
      if (distributor) {
        distType = distributor.type || 'A';
        distName = distributor.name || '';
      }
    }

    const newMsg = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      userEmail: userEmail.toLowerCase().trim(),
      userName: userName || 'Player',
      message: message ? message.trim() : '',
      attachment: attachment || '',
      senderType, // 'player' | 'admin'
      senderEmail: senderEmail ? senderEmail.toLowerCase().trim() : '',
      read: senderType === 'admin', // default to read if admin, unread if player
      timestamp: new Date().toISOString(),
      distributorId: distId,
      distributorType: distType,
      distributorName: distName
    };

    await supportCollection.insertOne(newMsg);

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Create Support Message Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT mark support messages as read
export async function PUT(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: 'User email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    // Update all player messages for this email to read: true
    await supportCollection.updateMany(
      { userEmail: email.toLowerCase().trim(), senderType: 'player', read: false },
      { $set: { read: true } }
    );

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Messages marked as read.' });
  } catch (err) {
    console.error('Update Support Messages Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

