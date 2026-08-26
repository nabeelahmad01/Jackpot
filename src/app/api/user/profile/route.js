import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { calculatePlayerLevel } from '../../../../lib/levelTiers';

// GET user profile data, cumulative total deposit, deposit tier, and linked game accounts
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');

    if (!emailParam) {
      return NextResponse.json({ success: false, message: 'Email query parameter is required.' }, { status: 400 });
    }

    const cleanEmail = emailParam.toLowerCase().trim();
    const db = await getDb();

    const user = await db.collection('users').findOne(
      { email: cleanEmail },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ success: false, message: 'Player user profile not found.' }, { status: 404 });
    }

    // Compute cumulative total deposit from successful deposit transactions
    const successfulDeposits = await db.collection('transactions').aggregate([
      {
        $match: {
          userEmail: cleanEmail,
          type: 'DEPOSIT',
          status: 'SUCCESS'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]).toArray();

    const totalDeposit = successfulDeposits.length > 0 ? (successfulDeposits[0].total || 0) : 0;
    const levelInfo = calculatePlayerLevel(totalDeposit);

    // Fetch player game accounts
    const gameAccounts = await db.collection('gameAccounts').find({ userEmail: cleanEmail }).toArray();

    return NextResponse.json({
      success: true,
      user: {
        id: user._id?.toString(),
        name: user.name || '',
        email: user.email || cleanEmail,
        phone: user.phone || '',
        role: user.role || 'player',
        createdAt: user.createdAt || null
      },
      totalDeposit,
      levelInfo,
      gameAccountsCount: gameAccounts.length,
      gameAccounts: gameAccounts.map(ga => ({
        id: ga._id?.toString() || ga.id,
        gameTitle: ga.gameTitle,
        username: ga.username,
        status: ga.status || 'READY',
        createdAt: ga.createdAt || null
      }))
    });
  } catch (err) {
    console.error('Fetch user profile error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT update user profile (Full Name, Phone Number, and Password change)
export async function PUT(req) {
  try {
    const { email, name, phone, newPassword } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'User email is required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();
    const usersCollection = db.collection('users');

    const currentUser = await usersCollection.findOne({ email: cleanEmail });
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const updateFields = {};

    if (name !== undefined) {
      updateFields.name = String(name).trim();
    }

    if (phone !== undefined) {
      updateFields.phone = String(phone).trim();
    }

    if (newPassword !== undefined && String(newPassword).trim() !== '') {
      const cleanPass = String(newPassword).trim();
      if (cleanPass.length < 4) {
        return NextResponse.json({ success: false, message: 'Password must be at least 4 characters long.' }, { status: 400 });
      }
      updateFields.password = cleanPass;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ success: false, message: 'No fields provided to update.' }, { status: 400 });
    }

    updateFields.updatedAt = new Date();

    await usersCollection.updateOne(
      { email: cleanEmail },
      { $set: updateFields }
    );

    const updatedUser = await usersCollection.findOne(
      { email: cleanEmail },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: updatedUser._id?.toString(),
        name: updatedUser.name || '',
        email: updatedUser.email || cleanEmail,
        phone: updatedUser.phone || '',
        role: updatedUser.role || 'player'
      }
    });
  } catch (err) {
    console.error('Update user profile error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
