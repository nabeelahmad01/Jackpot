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
    const user = sanitizeUser(body.user);
    if (!user?.email) {
      return NextResponse.json({ success: false, message: 'User is required.' }, { status: 400 });
    }

    const ticket = crypto.randomBytes(24).toString('hex');
    const db = await getDb();
    await db.collection('oauthTickets').insertOne({
      ticket,
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
    const ticket = String(new URL(req.url).searchParams.get('ticket') || '').trim();
    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket is required.' }, { status: 400 });
    }

    const db = await getDb();
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
