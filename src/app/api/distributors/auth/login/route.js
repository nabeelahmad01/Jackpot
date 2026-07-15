import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

// POST login distributor or distributor staff
export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }

    const db = await getDb();
    
    // 1. Try finding in distributors collection
    const distributorsCollection = db.collection('distributors');
    const matchedDistributor = await distributorsCollection.findOne({
      email: email.toLowerCase().trim(),
      password: password.trim()
    });

    if (matchedDistributor) {
      return NextResponse.json({
        success: true,
        message: 'Login successful!',
        distributor: {
          id: matchedDistributor.id,
          name: matchedDistributor.name,
          email: matchedDistributor.email,
          role: 'distributor',
          type: matchedDistributor.type,
          commissionRate: matchedDistributor.commissionRate,
          isStaff: false
        }
      });
    }

    // 2. Try finding in users collection (for distributor staff)
    const usersCollection = db.collection('users');
    const matchedStaff = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
      password: password.trim()
    });

    if (matchedStaff && matchedStaff.distributorId && matchedStaff.distributorId !== '' && matchedStaff.role !== 'user') {
      if (matchedStaff.status === 'SUSPENDED') {
        return NextResponse.json({ success: false, message: 'Your account has been suspended.' }, { status: 403 });
      }

      // Fetch the parent distributor to get their details
      const parentDistributor = await distributorsCollection.findOne({ id: matchedStaff.distributorId });
      
      return NextResponse.json({
        success: true,
        message: 'Login successful!',
        distributor: {
          id: matchedStaff.distributorId,
          name: matchedStaff.name,
          email: matchedStaff.email,
          role: 'distributor_staff',
          staffRole: matchedStaff.role,
          allowedGameIds: matchedStaff.allowedGameIds || [],
          type: parentDistributor ? parentDistributor.type : 'B',
          isStaff: true,
          commissionRate: parentDistributor ? parentDistributor.commissionRate : 0
        }
      });
    }

    return NextResponse.json({ success: false, message: 'Incorrect email or password.' }, { status: 401 });
  } catch (err) {
    console.error('Distributor Login API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
