import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET settings
export async function GET() {
  try {
    const cachedSettings = cache.get('settings_all');
    if (cachedSettings) {
      return NextResponse.json({ success: true, settings: cachedSettings });
    }

    const db = await getDb();
    const settingsCollection = db.collection('settings');
    
    let settings = await settingsCollection.findOne({ id: 'global_settings' });
    
    // Seed defaults if missing
    if (!settings) {
      settings = { id: 'global_settings', firstDepositBonus: 300, regularDepositBonus: 20, referralBonus: 10, usdtAddress: '', usdtQrCode: '', affiliatePayoutNetwork: 'TRC20', affiliatePayoutWallet: '', affiliatePayoutQrCode: '', affiliatePlatformCommissionRate: 90 };
      await settingsCollection.insertOne(settings);
    } else {
      let needsUpdate = false;
      const updates = {};
      if (settings.referralBonus === undefined) {
        updates.referralBonus = 10;
        settings.referralBonus = 10;
        needsUpdate = true;
      }
      if (settings.usdtAddress === undefined) {
        updates.usdtAddress = '';
        settings.usdtAddress = '';
        needsUpdate = true;
      }
      if (settings.usdtQrCode === undefined) {
        updates.usdtQrCode = '';
        settings.usdtQrCode = '';
        needsUpdate = true;
      }
      if (settings.affiliatePayoutNetwork === undefined) {
        updates.affiliatePayoutNetwork = 'TRC20';
        settings.affiliatePayoutNetwork = 'TRC20';
        needsUpdate = true;
      }
      if (settings.affiliatePayoutWallet === undefined) {
        updates.affiliatePayoutWallet = '';
        settings.affiliatePayoutWallet = '';
        needsUpdate = true;
      }
      if (settings.affiliatePayoutQrCode === undefined) {
        updates.affiliatePayoutQrCode = '';
        settings.affiliatePayoutQrCode = '';
        needsUpdate = true;
      }
      if (settings.affiliatePlatformCommissionRate === undefined) {
        updates.affiliatePlatformCommissionRate = 90;
        settings.affiliatePlatformCommissionRate = 90;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await settingsCollection.updateOne({ id: 'global_settings' }, { $set: updates });
      }
    }
    
    cache.set('settings_all', settings, 60);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('Fetch Settings API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT / POST update settings (Super Admin only)
export async function PUT(req) {
  try {
    const { firstDepositBonus, regularDepositBonus, referralBonus, usdtAddress, usdtQrCode, affiliatePayoutNetwork, affiliatePayoutWallet, affiliatePayoutQrCode, affiliatePlatformCommissionRate } = await req.json();

    const db = await getDb();
    const settingsCollection = db.collection('settings');

    const updateFields = {};
    if (firstDepositBonus !== undefined) {
      updateFields.firstDepositBonus = Number(firstDepositBonus);
    }
    if (regularDepositBonus !== undefined) {
      updateFields.regularDepositBonus = Number(regularDepositBonus);
    }
    if (referralBonus !== undefined) {
      updateFields.referralBonus = Number(referralBonus);
    }
    if (usdtAddress !== undefined) {
      updateFields.usdtAddress = String(usdtAddress).trim();
    }
    if (usdtQrCode !== undefined) {
      updateFields.usdtQrCode = String(usdtQrCode);
    }
    if (affiliatePayoutNetwork !== undefined) {
      updateFields.affiliatePayoutNetwork = ['TRC20', 'BEP20'].includes(affiliatePayoutNetwork) ? affiliatePayoutNetwork : 'TRC20';
    }
    if (affiliatePayoutWallet !== undefined) {
      updateFields.affiliatePayoutWallet = String(affiliatePayoutWallet).trim();
    }
    if (affiliatePayoutQrCode !== undefined) {
      updateFields.affiliatePayoutQrCode = String(affiliatePayoutQrCode);
    }
    if (affiliatePlatformCommissionRate !== undefined) {
      updateFields.affiliatePlatformCommissionRate = Number(affiliatePlatformCommissionRate) || 90;
    }

    await settingsCollection.updateOne(
      { id: 'global_settings' },
      { $set: updateFields },
      { upsert: true }
    );

    // Invalidate caches
    cache.del('settings_all');
    cache.del('admin_stats'); // Settings can affect statistics/allotments

    return NextResponse.json({ success: true, message: 'Bonus settings updated successfully!' });
  } catch (err) {
    console.error('Update Settings API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

