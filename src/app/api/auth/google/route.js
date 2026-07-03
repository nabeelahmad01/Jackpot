import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { email, name } = await req.json();

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
      // Automatically register brand-new Google users
      matchedUser = {
        name: name.trim(),
        email: cleanEmail,
        password: 'OAuth-Google-Login',
        role: 'user',
        coins: 100
      };
      const result = await usersCollection.insertOne(matchedUser);
      matchedUser._id = result.insertedId;
      isNewUser = true;
    }

    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Google account registered successfully!' : 'Welcome back!',
      isNewUser,
      user: { name: matchedUser.name, email: matchedUser.email, role: matchedUser.role, coins: matchedUser.coins || 100 }
    });
  } catch (err) {
    console.error('Google OAuth API Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during Google authentication: ' + err.message },
      { status: 500 }
    );
  }
}
