import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

// GET gets all staff members (non-user roles) and their last active status
export async function GET(req) {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');

    // Fetch staff (roles: support_admin, financial_admin, coins_admin)
    const staff = await usersCollection.find(
      { role: { $in: ['support_admin', 'financial_admin', 'coins_admin'] } },
      { projection: { name: 1, email: 1, role: 1, lastActive: 1 } }
    ).toArray();

    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error('Fetch Activity API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST updates lastActive heartbeat for an administrator
export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    await usersCollection.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { lastActive: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true, message: 'Heartbeat registered.' });
  } catch (err) {
    console.error('Update Heartbeat API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
