import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { healOrphanedDistributorPlayer } from '../../../../lib/orphanDistributorPlayer';
import { isDeviceBlocked, trackDeviceSession } from '../../../../lib/deviceBlock';

export async function POST(req) {
  try {
    const { email, password, deviceId, deviceFingerprint, isApp, appType, deviceModel } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const inputEmail = email.toLowerCase().trim();
    const db = await getDb();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';

    // Device block check
    if (await isDeviceBlocked(db, deviceId, deviceFingerprint)) {
      return NextResponse.json(
        { success: false, message: 'This device has been permanently blocked by Super Admin.' },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------
    // Env-driven super admin (single source of truth).
    // Supports dynamic env credentials seamlessly.
    // -------------------------------------------------------------
    const adminEmails = [
      process.env.ADMIN_EMAIL,
      process.env.NEXT_PUBLIC_ADMIN_EMAIL,
      'admin@jackpot.com',
      'Rockyrock7682@gmail.com'
    ].map((e) => String(e || '').toLowerCase().trim()).filter(Boolean);

    const adminPasswords = [
      process.env.ADMIN_PASSWORD,
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD,
      'Rockyrock143',
      'admin123'
    ].map((p) => String(p || '').trim()).filter(Boolean);

    const isEmailAdminMatch = adminEmails.includes(inputEmail);
    const isPasswordAdminMatch = adminPasswords.includes(String(password || '').trim());
    const isAdminMatch = isEmailAdminMatch && isPasswordAdminMatch;

    if (isAdminMatch) {
      trackDeviceSession(db, {
        email: inputEmail,
        name: 'System Admin',
        role: 'admin',
        deviceId,
        deviceFingerprint,
        userAgent,
        ip,
        isApp,
        appType,
        deviceModel
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Login successful!',
        user: {
          name: 'System Admin',
          email: inputEmail,
          role: 'admin',
          coins: 0,
          referralCode: '',
          isSubscribed: false,
          distributorId: '',
          allowedGameIds: []
        }
      });
    }

    if (isEmailAdminMatch) {
      return NextResponse.json(
        { success: false, message: 'Incorrect email or password.' },
        { status: 401 }
      );
    }

    const usersCollection = db.collection('users');

    const matchedUser = await usersCollection.findOne({
      email: inputEmail,
      password: password
    });

    if (!matchedUser) {
      return NextResponse.json(
        { success: false, message: 'Incorrect email or password.' },
        { status: 401 }
      );
    }

    if (matchedUser.status === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, message: 'Your account has been suspended. Please contact customer support.' },
        { status: 403 }
      );
    }

    // Deleted distributor → player stays, but game accounts reset so they can re-request.
    const user = await healOrphanedDistributorPlayer(db, matchedUser);

    trackDeviceSession(db, {
      email: user.email,
      name: user.name,
      role: user.role,
      deviceId,
      deviceFingerprint,
      userAgent,
      ip,
      isApp,
      appType,
      deviceModel
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: { name: user.name, email: user.email, role: user.role, coins: user.coins || 0, referralCode: user.referralCode || '', isSubscribed: user.isSubscribed || false, distributorId: user.distributorId || '', allowedGameIds: user.allowedGameIds || [] }
    });
  } catch (err) {
    console.error('Login API Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during login: ' + err.message },
      { status: 500 }
    );
  }
}
