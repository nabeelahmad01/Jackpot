import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET settings
export async function GET() {
  try {
    const db = await getDb();
    const settingsCollection = db.collection('settings');
    
    let settings = await settingsCollection.findOne({ id: 'global_settings' });
    
    // Seed defaults if missing
    if (!settings) {
      settings = { id: 'global_settings', firstDepositBonus: 300, regularDepositBonus: 20 };
      await settingsCollection.insertOne(settings);
    }
    
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('Fetch Settings API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT / POST update settings (Super Admin only)
export async function PUT(req) {
  try {
    const { firstDepositBonus, regularDepositBonus } = await req.json();

    const db = await getDb();
    const settingsCollection = db.collection('settings');

    const updateFields = {};
    if (firstDepositBonus !== undefined) {
      updateFields.firstDepositBonus = Number(firstDepositBonus);
    }
    if (regularDepositBonus !== undefined) {
      updateFields.regularDepositBonus = Number(regularDepositBonus);
    }

    await settingsCollection.updateOne(
      { id: 'global_settings' },
      { $set: updateFields },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Bonus percentages updated successfully!' });
  } catch (err) {
    console.error('Update Settings API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
