import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { getVapidPublicKey } from '../../../lib/pushNotifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = getVapidPublicKey();
  return NextResponse.json({
    success: Boolean(publicKey),
    publicKey,
    message: publicKey ? undefined : 'Push notifications are not configured yet.'
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const userEmail = String(body.email || '').trim().toLowerCase();
    const subscription = body.subscription;
    const nativeToken = String(body.nativeToken || '').trim();
    const endpoint = subscription?.endpoint || (nativeToken ? `native:${nativeToken}` : '');

    const hasWebSubscription = Boolean(
      subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth
    );
    const hasNativeSubscription = nativeToken.length >= 20 && body.platform === 'android';
    if (!userEmail || (!hasWebSubscription && !hasNativeSubscription)) {
      return NextResponse.json(
        { success: false, message: 'A valid user and push subscription are required.' },
        { status: 400 }
      );
    }

    if (hasWebSubscription) {
      let parsedEndpoint;
      try {
        parsedEndpoint = new URL(endpoint);
      } catch {
        return NextResponse.json({ success: false, message: 'Invalid push endpoint.' }, { status: 400 });
      }
      if (parsedEndpoint.protocol !== 'https:') {
        return NextResponse.json({ success: false, message: 'Push endpoint must use HTTPS.' }, { status: 400 });
      }
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: userEmail }, { projection: { _id: 1 } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User account was not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    await db.collection('pushSubscriptions').updateOne(
      { endpoint },
      {
        $set: {
          endpoint,
          userEmail,
          type: hasNativeSubscription ? 'native' : 'web',
          platform: hasNativeSubscription ? 'android' : 'web',
          subscription: hasWebSubscription ? subscription : null,
          nativeToken: hasNativeSubscription ? nativeToken : null,
          userAgent: String(body.userAgent || '').slice(0, 500),
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscription save error:', error);
    return NextResponse.json(
      { success: false, message: 'Could not save this notification subscription.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const userEmail = String(body.email || '').trim().toLowerCase();
    const endpoint = String(body.endpoint || '').trim();
    if (!userEmail || !endpoint) {
      return NextResponse.json({ success: false, message: 'Email and endpoint are required.' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection('pushSubscriptions').deleteOne({ userEmail, endpoint });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscription delete error:', error);
    return NextResponse.json(
      { success: false, message: 'Could not remove this notification subscription.' },
      { status: 500 }
    );
  }
}
