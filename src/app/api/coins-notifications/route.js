import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET all coins notifications (supports filtering by email for users, or returning all for admins)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const db = await getDb();
    const notificationsCollection = db.collection('coinsNotifications');
    
    let query = {};
    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }

    if (search) {
      const cleanSearch = search.trim();
      const searchCriteria = {
        $or: [
          { userEmail: { $regex: cleanSearch, $options: 'i' } },
          { gameTitle: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
      if (email) {
        query = { $and: [query, searchCriteria] };
      } else {
        query = searchCriteria;
      }
    }

    const totalNotifications = await notificationsCollection.countDocuments(query);
    const skip = (page - 1) * limit;

    // Fetch and sort at the DB level (highly optimized using timestamp index)
    const notifications = await notificationsCollection.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    return NextResponse.json({
      success: true,
      coinsNotifications: notifications,
      totalNotifications,
      totalPages: Math.ceil(totalNotifications / limit),
      currentPage: page
    });
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

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Notification updated successfully!' });
  } catch (err) {
    console.error('Update Coins Notification Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

