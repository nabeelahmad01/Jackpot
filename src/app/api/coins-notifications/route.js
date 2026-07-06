import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET all coins notifications (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    const db = await getDb();
    const notificationsCollection = db.collection('coinsNotifications');
    
    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    const notifications = await notificationsCollection.find(query).toArray();
    
    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return NextResponse.json({ success: true, coinsNotifications: notifications });
  } catch (err) {
    console.error('Fetch Coins Notifications Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update status, read indicator, or hold note
export async function PUT(req) {
  try {
    const { id, status, read, holdNote } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Notification ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const notificationsCollection = db.collection('coinsNotifications');

    const updateFields = {};
    if (status !== undefined) {
      updateFields.status = status;
    }
    if (read !== undefined) {
      updateFields.read = Boolean(read);
    }
    if (holdNote !== undefined) {
      updateFields.holdNote = holdNote;
    }

    await notificationsCollection.updateOne({ id }, { $set: updateFields });

    if (status === 'COMPLETED') {
      const originalNoti = await notificationsCollection.findOne({ id });
      if (originalNoti && originalNoti.transactionId) {
        const transactionsCollection = db.collection('transactions');
        await transactionsCollection.updateOne(
          { id: originalNoti.transactionId },
          { $set: { status: 'PENDING' } }
        );
      }
    }

    return NextResponse.json({ success: true, message: 'Notification updated successfully!' });
  } catch (err) {
    console.error('Update Coins Notification Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
