import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

// GET all shift reports (for Boss and Operation Manager review)
export async function GET(req) {
  try {
    const db = await getDb();
    const reportsCollection = db.collection('shiftReports');

    // Retrieve all shift logs ordered by timestamp descending
    const reports = await reportsCollection
      .find({})
      .sort({ timestamp: -1 })
      .toArray();

    return NextResponse.json({ success: true, reports });
  } catch (err) {
    console.error('Fetch Shift Reports API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST submit a new shift report (completed by staff/coins admin at end of shift)
export async function POST(req) {
  try {
    const { staffEmail, shiftName, totalLoaded, notes } = await req.json();

    if (!staffEmail || !shiftName) {
      return NextResponse.json({ success: false, message: 'Staff email and shift name are required.' }, { status: 400 });
    }

    const loadedAmt = parseFloat(totalLoaded || 0);
    if (isNaN(loadedAmt) || loadedAmt < 0) {
      return NextResponse.json({ success: false, message: 'Total loaded coins must be a valid positive number.' }, { status: 400 });
    }

    const db = await getDb();
    const reportsCollection = db.collection('shiftReports');

    const reportObject = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      staffEmail: staffEmail.toLowerCase().trim(),
      shiftName: shiftName.trim(),
      date: new Date().toISOString(),
      totalLoaded: loadedAmt,
      notes: (notes || '').trim(),
      timestamp: new Date().toISOString()
    };

    await reportsCollection.insertOne(reportObject);

    return NextResponse.json({ success: true, message: 'End of shift report submitted successfully!' });
  } catch (err) {
    console.error('Submit Shift Report API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
