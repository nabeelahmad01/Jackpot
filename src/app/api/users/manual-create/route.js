import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { name, email, referredBy, password } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: 'Full name and Email are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: `Account with email "${cleanEmail}" is already registered.` },
        { status: 400 }
      );
    }

    // Resolve referrer and inherit distributorId
    let resolvedReferrer = '';
    let inheritedDistributorId = '';
    if (referredBy && referredBy.trim() !== '') {
      const trimmedRef = referredBy.trim();
      const referrer = await usersCollection.findOne({
        $or: [
          { email: trimmedRef.toLowerCase() },
          { referralCode: trimmedRef.toUpperCase() }
        ]
      });
      if (referrer) {
        resolvedReferrer = referrer.email;
        if (referrer.distributorId) {
          inheritedDistributorId = referrer.distributorId;
        }
      } else {
        resolvedReferrer = trimmedRef; // fallback
      }
    }

    // Generate secure temporary password and a unique referral code
    const tempPassword = password && password.trim() ? password.trim() : Math.random().toString(36).substring(2, 10);
    const uniqueReferral = Math.random().toString(36).substring(2, 7).toUpperCase();

    const newUser = {
      name: name.trim(),
      email: cleanEmail,
      password: tempPassword,
      role: 'user', // default player role
      coins: 0,
      referralCode: uniqueReferral,
      referredBy: resolvedReferrer,
      distributorId: inheritedDistributorId,
      createdAt: new Date().toISOString()
    };

    await usersCollection.insertOne(newUser);

    return NextResponse.json({
      success: true,
      message: 'Player registered successfully!',
      player: {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        referralCode: newUser.referralCode
      }
    });
  } catch (err) {
    console.error('Manual Player Creation Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error: ' + err.message },
      { status: 500 }
    );
  }
}
