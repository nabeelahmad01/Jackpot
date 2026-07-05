import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET all coins notifications (ordered by newest first)
export async function GET() {
  try {
    const db = await getDb();
    const notificationsCollection = db.collection('coinsNotifications');
    
    const notifications = await notificationsCollection.find().toArray();
    
    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return NextResponse.json({ success: true, coinsNotifications: notifications });
  } catch (err) {
    console.error('Fetch Coins Notifications Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update status or read indicator
export async function PUT(req) {
  try {
    const { id, status, read } = await req.json();

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
