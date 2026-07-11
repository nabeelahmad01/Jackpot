import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

// POST login distributor
export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }

    const db = await getDb();
    const distributorsCollection = db.collection('distributors');

    const matched = await distributorsCollection.findOne({
      email: email.toLowerCase().trim(),
      password: password.trim()
    });

    if (!matched) {
      return NextResponse.json({ success: false, message: 'Incorrect email or password.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      distributor: {
        id: matched.id,
        name: matched.name,
        email: matched.email,
        role: 'distributor',
        type: matched.type,
        commissionRate: matched.commissionRate
      }
    });
  } catch (err) {
    console.error('Distributor Login API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
