import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET requests (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    const requests = await requestsCollection.find(query).toArray();
    return NextResponse.json({ success: true, accountRequests: requests });
  } catch (err) {
    console.error('Fetch Account Requests API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new request (Player submission)
export async function POST(req) {
  try {
    const { gameTitle, userEmail } = await req.json();

    if (!gameTitle || !userEmail) {
      return NextResponse.json({ success: false, message: 'Game title and email are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    const newRequest = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      gameTitle,
      userEmail: userEmail.toLowerCase().trim(),
      status: 'PENDING',
      date: new Date().toLocaleString()
    };

    await requestsCollection.insertOne(newRequest);
    return NextResponse.json({ success: true, request: newRequest, message: 'Game account request submitted successfully!' });
  } catch (err) {
    console.error('Create Account Request API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT (update status) request (Admin approval/rejection)
export async function PUT(req) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'Request ID and status are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCollection = db.collection('accountRequests');

    await requestsCollection.updateOne({ id }, { $set: { status } });
    return NextResponse.json({ success: true, message: 'Account request status updated successfully!' });
  } catch (err) {
    console.error('Update Account Request API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
