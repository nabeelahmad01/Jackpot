import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET support chat messages
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    if (email) {
      // Return full conversation history for a specific player (usually small, but paginated/limited to protect DB)
      const skip = (page - 1) * limit;
      const messages = await supportCollection
        .find({ userEmail: email.toLowerCase().trim() })
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      return NextResponse.json({ success: true, messages });
    }

    // Admin view: get all messages, grouped or sorted so admin can list conversations
    // We fetch recent messages and let the backend/frontend group them by userEmail
    const skip = (page - 1) * limit;
    const allMessages = await supportCollection.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return NextResponse.json({ success: true, messages: allMessages });
  } catch (err) {
    console.error('Support Messages API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST send support message
export async function POST(req) {
  try {
    const { userEmail, userName, message, senderType, senderEmail } = await req.json();

    if (!userEmail || !message || !senderType || !senderEmail) {
      return NextResponse.json({ success: false, message: 'Missing message details.' }, { status: 400 });
    }

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    const newMsg = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      userEmail: userEmail.toLowerCase().trim(),
      userName: userName || 'Player',
      message: message.trim(),
      senderType, // 'player' | 'admin'
      senderEmail: senderEmail.toLowerCase().trim(),
      timestamp: new Date().toISOString()
    };

    await supportCollection.insertOne(newMsg);
    return NextResponse.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Create Support Message Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

