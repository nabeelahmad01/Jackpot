import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

// GET Frontend Settings
export async function GET() {
  try {
    const cachedSettings = cache.get('frontend_settings_all');
    if (cachedSettings) {
      return NextResponse.json({ success: true, settings: cachedSettings });
    }

    const db = await getDb();
    const settingsCollection = db.collection('settings');
    
    let settings = await settingsCollection.findOne({ id: 'frontend_settings' });
    
    // Seed defaults if missing
    if (!settings) {
      settings = {
        id: 'frontend_settings',
        logoUrl: '/jackpot_lion_mascot.png?v=2',
        withdrawNotice: 'Fastest Withdrawals inside 5 Minutes!',
        cashoutNotice: 'Standard cashout processing hours: 9 AM - 11 PM EST',
        slides: ['/slide1.jpg', '/slide2.jpg', '/slide3.jpg'],
        chimeActive: true,
        venmoActive: true,
        cashappActive: true
      };
      await settingsCollection.insertOne(settings);
    }
    
    cache.set('frontend_settings_all', settings, 60);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('Fetch Frontend Settings API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT Update Frontend Settings (Main Boss / Super Admin only)
export async function PUT(req) {
  try {
    const body = await req.json();
    const { logoUrl, withdrawNotice, cashoutNotice, slides, chimeActive, venmoActive, cashappActive } = body;

    const db = await getDb();
    const settingsCollection = db.collection('settings');

    const updateFields = {};
    if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;
    if (withdrawNotice !== undefined) updateFields.withdrawNotice = withdrawNotice;
    if (cashoutNotice !== undefined) updateFields.cashoutNotice = cashoutNotice;
    if (slides !== undefined) updateFields.slides = slides;
    if (chimeActive !== undefined) updateFields.chimeActive = Boolean(chimeActive);
    if (venmoActive !== undefined) updateFields.venmoActive = Boolean(venmoActive);
    if (cashappActive !== undefined) updateFields.cashappActive = Boolean(cashappActive);

    await settingsCollection.updateOne(
      { id: 'frontend_settings' },
      { $set: updateFields },
      { upsert: true }
    );

    // Invalidate cache
    cache.del('frontend_settings_all');

    return NextResponse.json({ success: true, message: 'Frontend settings updated successfully!' });
  } catch (err) {
    console.error('Update Frontend Settings API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
