import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET all users (Admin listing)
export async function GET() {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');
    // Fetch users (excluding password fields for security)
    const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error('Fetch Users API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update user details (Admin adjustment of coins or role modifications)
export async function PUT(req) {
  try {
    const { email, coins, role } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'User email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const updateFields = {};
    if (coins !== undefined) {
      updateFields.coins = Number(coins);
    }
    if (role !== undefined) {
      updateFields.role = role;
    }

    const result = await usersCollection.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User details updated successfully!' });
  } catch (err) {
    console.error('Update User API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE a user account (Admin action)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, message: 'User email parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    await usersCollection.deleteOne({ email: email.toLowerCase().trim() });
    return NextResponse.json({ success: true, message: 'User account deleted successfully.' });
  } catch (err) {
    console.error('Delete User API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
