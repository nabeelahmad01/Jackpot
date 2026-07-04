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

    const db = await getDb();
    const usersCollection = db.collection('users');

    const matchedUser = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (!matchedUser) {
      return NextResponse.json(
        { success: false, message: 'Incorrect email or password.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: { name: matchedUser.name, email: matchedUser.email, role: matchedUser.role, coins: matchedUser.coins || 0, referralCode: matchedUser.referralCode || '' }
    });
  } catch (err) {
    console.error('Login API Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during login: ' + err.message },
      { status: 500 }
    );
  }
}
