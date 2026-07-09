import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { email, isSubscribed } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const cleanEmail = email.toLowerCase().trim();
    const user = await usersCollection.findOne({ email: cleanEmail });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    await usersCollection.updateOne(
      { email: cleanEmail },
      { $set: { isSubscribed: !!isSubscribed } }
    );

    return NextResponse.json({ success: true, message: 'Subscription status updated successfully.' });
  } catch (err) {
    console.error('Subscribe API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
