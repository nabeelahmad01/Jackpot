import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET active promotions for user or all promotions for admin
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    if (!email) {
      // Admin request — return all promotions
      const promos = await promotionsCollection.find({}).sort({ timestamp: -1 }).toArray();
      return NextResponse.json({ success: true, promotions: promos });
    }

    // Player request — filter target promotions
    const cleanEmail = email.toLowerCase().trim();
    const user = await db.collection('users').findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const allPromos = await promotionsCollection.find({}).sort({ timestamp: -1 }).toArray();

    // Check if player has successful deposits
    const depositCount = await db.collection('transactions').countDocuments({
      userEmail: cleanEmail,
      type: 'DEPOSIT',
      status: 'SUCCESS'
    });
    const isActivePlayer = depositCount > 0;

    const filtered = allPromos.filter(promo => {
      const tg = (promo.targetGroup || '').toLowerCase();
      if (tg === 'all') return true;
      if (tg === 'subscribed') return !!user.isSubscribed;
      if (tg === 'unsubscribed') return !user.isSubscribed;
      if (tg === 'active') return isActivePlayer;
      return false;
    });

    return NextResponse.json({ success: true, promotions: filtered });
  } catch (err) {
    console.error('Fetch promotions error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create/broadcast a promotion
export async function POST(req) {
  try {
    const body = await req.json();
    const { title, message, targetGroup, image } = body;

    if (!title || !message || !targetGroup) {
      return NextResponse.json({ success: false, message: 'Title, message, and target group are required.' }, { status: 400 });
    }

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    const promoObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      title: title.trim(),
      message: message.trim(),
      targetGroup, // 'all' | 'subscribed' | 'unsubscribed' | 'active'
      image: image || '',
      timestamp: new Date().toISOString()
    };

    await promotionsCollection.insertOne(promoObject);
    return NextResponse.json({ success: true, promotion: promoObject });
  } catch (err) {
    console.error('Create promotion error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE delete a promotion campaign
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Promotion ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    await promotionsCollection.deleteOne({ id });
    return NextResponse.json({ success: true, message: 'Promotion deleted successfully.' });
  } catch (err) {
    console.error('Delete promotion error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
