import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '../../../../../lib/mongodb';

export const dynamic = 'force-dynamic';

function sanitizeUser(user) {
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    coins: user.coins || 100,
    referralCode: user.referralCode || '',
    isSubscribed: user.isSubscribed || false
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const db = await getDb();
    const mode = String(body.mode || '').trim();

    // App creates a pending session, then polls until Google completes in the system browser.
    if (mode === 'session') {
      const sid = crypto.randomBytes(24).toString('hex');
      await db.collection('oauthTickets').insertOne({
        sid,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
      return NextResponse.json({ success: true, sid });
    }

    // Callback page marks the session ready after Google OAuth succeeds.
    if (mode === 'complete') {
      const sid = String(body.sid || '').trim();
      const user = sanitizeUser(body.user);
      if (!sid || !user?.email) {
        return NextResponse.json({ success: false, message: 'Session and user are required.' }, { status: 400 });
      }

      const result = await db.collection('oauthTickets').updateOne(
        { sid, status: 'pending', expiresAt: { $gt: new Date() } },
        {
          $set: {
            status: 'ready',
            user,
            isNewUser: Boolean(body.isNewUser),
            completedAt: new Date()
          }
        }
      );

      if (!result.matchedCount) {
        return NextResponse.json({ success: false, message: 'Login session expired or invalid.' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // One-shot ticket (deep-link / query fallback)
    const user = sanitizeUser(body.user);
    if (!user?.email) {
      return NextResponse.json({ success: false, message: 'User is required.' }, { status: 400 });
    }

    const ticket = crypto.randomBytes(24).toString('hex');
    await db.collection('oauthTickets').insertOne({
      ticket,
      status: 'ready',
      user,
      isNewUser: Boolean(body.isNewUser),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error('Create Google ticket error:', error);
    return NextResponse.json({ success: false, message: 'Could not create login ticket.' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const sid = String(url.searchParams.get('sid') || '').trim();
    const ticket = String(url.searchParams.get('ticket') || '').trim();
    const db = await getDb();

    if (sid) {
      const doc = await db.collection('oauthTickets').findOne({
        sid,
        expiresAt: { $gt: new Date() }
      });

      if (!doc) {
        return NextResponse.json({ success: false, status: 'expired', message: 'Login session expired.' }, { status: 404 });
      }

      if (doc.status === 'pending') {
        return NextResponse.json({ success: true, status: 'pending' });
      }

      if (doc.status === 'ready' && doc.user) {
        await db.collection('oauthTickets').deleteOne({ _id: doc._id });
        return NextResponse.json({
          success: true,
          status: 'ready',
          user: sanitizeUser(doc.user),
          isNewUser: Boolean(doc.isNewUser)
        });
      }

      return NextResponse.json({ success: true, status: doc.status || 'pending' });
    }

    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket or session id is required.' }, { status: 400 });
    }

    const doc = await db.collection('oauthTickets').findOneAndDelete({
      ticket,
      expiresAt: { $gt: new Date() }
    });

    const redeemed = doc?.value || doc;
    if (!redeemed?.user) {
      return NextResponse.json({ success: false, message: 'Login ticket expired or invalid.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: sanitizeUser(redeemed.user),
      isNewUser: Boolean(redeemed.isNewUser)
    });
  } catch (error) {
    console.error('Redeem Google ticket error:', error);
    return NextResponse.json({ success: false, message: 'Could not redeem login ticket.' }, { status: 500 });
  }
}
