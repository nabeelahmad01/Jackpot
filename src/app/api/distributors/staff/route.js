import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { purgeAccountAccess } from '../../../../lib/sessionRevoke';

// GET distributor staff list
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    // Find all users with staff roles belonging to this distributor
    const staff = await usersCollection.find({
      distributorId,
      role: { $in: ['admin', 'operation_admin', 'financial_admin', 'coins_admin', 'support_admin', 'distributor_staff'] }
    }).toArray();

    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error('Fetch Distributor Staff API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST register distributor staff
export async function POST(req) {
  try {
    const { name, email, password, role, distributorId, allowedGameIds } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }
    if (!name || !email || !password || !role) {
      return NextResponse.json({ success: false, message: 'Missing required staff registry fields.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existing = await usersCollection.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ success: false, message: 'A user account with this email is already registered.' }, { status: 400 });
    }

    const newStaff = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      role: role.trim(),
      coins: 0,
      distributorId: distributorId,
      createdAt: new Date().toISOString()
    };

    if (role.trim() === 'coins_admin') {
      const { validateAllowedGameIds } = await import('../../../../lib/staffGameAccess');
      const validation = await validateAllowedGameIds(db, allowedGameIds || [], distributorId);
      if (!validation.valid) {
        return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
      }
      newStaff.allowedGameIds = validation.allowedGameIds;
    }

    await usersCollection.insertOne(newStaff);

    return NextResponse.json({ success: true, staff: newStaff, message: 'Staff member registered successfully!' });
  } catch (err) {
    console.error('Create Distributor Staff API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT edit distributor staff
export async function PUT(req) {
  try {
    const { name, email, password, role, distributorId, allowedGameIds } = await req.json();

    if (!email || !distributorId) {
      return NextResponse.json({ success: false, message: 'Staff Email and Distributor ID are required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (role !== undefined) updateFields.role = role.trim();
    if (password !== undefined && password.trim() !== '') updateFields.password = password.trim();
    if (allowedGameIds !== undefined) {
      const targetRole = role !== undefined ? role.trim() : (await usersCollection.findOne({ email: email.toLowerCase().trim(), distributorId }))?.role;
      if (targetRole === 'coins_admin') {
        const { validateAllowedGameIds } = await import('../../../../lib/staffGameAccess');
        const validation = await validateAllowedGameIds(db, allowedGameIds, distributorId);
        if (!validation.valid) {
          return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
        }
        updateFields.allowedGameIds = validation.allowedGameIds;
      } else {
        updateFields.allowedGameIds = [];
      }
    }

    const result = await usersCollection.updateOne(
      { email: email.toLowerCase().trim(), distributorId },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Staff member not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Staff details updated successfully!' });
  } catch (err) {
    console.error('Update Distributor Staff API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE distributor staff — also force-logs out their live session
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const distributorId = searchParams.get('distributorId');

    if (!email || !distributorId) {
      return NextResponse.json({ success: false, message: 'Staff Email and Distributor ID parameters are required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');
    const cleanEmail = email.toLowerCase().trim();

    const userDoc = await usersCollection.findOne({
      email: cleanEmail,
      distributorId
    });

    const result = await usersCollection.deleteOne({
      email: cleanEmail,
      distributorId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Staff member not found or access denied.' }, { status: 404 });
    }

    await purgeAccountAccess(db, cleanEmail, userDoc);

    return NextResponse.json({ success: true, message: 'Staff member deleted successfully!' });
  } catch (err) {
    console.error('Delete Distributor Staff API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
