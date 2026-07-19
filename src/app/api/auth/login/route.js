import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const inputEmail = email.toLowerCase().trim();

    // -------------------------------------------------------------
    // Env-driven super admin (single source of truth).
    // Prefer server-only vars; fall back to the NEXT_PUBLIC_ ones that
    // may already be set on the hosting panel.
    // -------------------------------------------------------------
    const envAdminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '')
      .toLowerCase()
      .trim();
    const envAdminPassword = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

    if (envAdminEmail && envAdminPassword) {
      // When super admin credentials are configured via env, they are the
      // ONLY way to open the top-level admin account.
      if (inputEmail === envAdminEmail) {
        if (password === envAdminPassword) {
          return NextResponse.json({
            success: true,
            message: 'Login successful!',
            user: {
              name: 'System Admin',
              email: envAdminEmail,
              role: 'admin',
              coins: 0,
              referralCode: '',
              isSubscribed: false,
              distributorId: '',
              allowedGameIds: []
            }
          });
        }
        return NextResponse.json(
          { success: false, message: 'Incorrect email or password.' },
          { status: 401 }
        );
      }

      // Neutralise the legacy hard-coded default admin that was seeded into
      // the database, so only the env credentials can grant super-admin access.
      if (inputEmail === 'admin@jackpot.com') {
        return NextResponse.json(
          { success: false, message: 'Incorrect email or password.' },
          { status: 401 }
        );
      }
    }

    const db = await getDb();
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

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: { name: matchedUser.name, email: matchedUser.email, role: matchedUser.role, coins: matchedUser.coins || 0, referralCode: matchedUser.referralCode || '', isSubscribed: matchedUser.isSubscribed || false, distributorId: matchedUser.distributorId || '', allowedGameIds: matchedUser.allowedGameIds || [] }
    });
  } catch (err) {
    console.error('Login API Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during login: ' + err.message },
      { status: 500 }
    );
  }
}
