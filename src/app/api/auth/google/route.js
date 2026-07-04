import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import crypto from 'crypto';

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function POST(req) {
  try {
    const { email, name, referredBy } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { success: false, message: 'Google account details missing.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const cleanEmail = email.toLowerCase().trim();
    let matchedUser = await usersCollection.findOne({ email: cleanEmail });
    let isNewUser = false;

    if (!matchedUser) {
      // Generate a unique referral code
      let referralCode = generateReferralCode();
      while (await usersCollection.findOne({ referralCode })) {
        referralCode = generateReferralCode();
      }

      // Resolve the referrer by referralCode
      let resolvedReferrer = '';
      if (referredBy) {
        const referrer = await usersCollection.findOne({ referralCode: referredBy.trim() });
        if (referrer) {
          resolvedReferrer = referrer.email;
        }
      }

      // Automatically register brand-new Google users
      matchedUser = {
        name: name.trim(),
        email: cleanEmail,
        password: 'OAuth-Google-Login',
        role: 'user',
        coins: 100,
        referralCode,
        referredBy: resolvedReferrer
      };
      const result = await usersCollection.insertOne(matchedUser);
      matchedUser._id = result.insertedId;
      isNewUser = true;
    }

    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Google account registered successfully!' : 'Welcome back!',
      isNewUser,
      user: { name: matchedUser.name, email: matchedUser.email, role: matchedUser.role, coins: matchedUser.coins || 100, referralCode: matchedUser.referralCode || '' }
    });
  } catch (err) {
    console.error('Google OAuth API Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during Google authentication: ' + err.message },
      { status: 500 }
    );
  }
}
