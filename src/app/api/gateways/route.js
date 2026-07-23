import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET all gateways
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');

    const cacheKey = distributorId ? `gateways_dist_${distributorId}` : 'gateways_all';
    const cachedGateways = cache.get(cacheKey);
    if (cachedGateways) {
      return NextResponse.json({ success: true, gateways: cachedGateways });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');
    
    let query = {};
    if (distributorId) {
      const distributorsCollection = db.collection('distributors');
      const dist = await distributorsCollection.findOne({ id: distributorId });
      if (dist && dist.type === 'B') {
        // Type B distributor -> only return their own gateways
        query.distributorId = distributorId;
      } else {
        // Type A distributor or main platform -> return main platform gateways
        query = { $or: [{ distributorId: { $exists: false } }, { distributorId: '' }] };
      }
    } else {
      // Main platform gateways
      query = { $or: [{ distributorId: { $exists: false } }, { distributorId: '' }] };
    }

    const gateways = await gatewaysCollection.find(query).toArray();
    
    cache.set(cacheKey, gateways, 60);
    return NextResponse.json({ success: true, gateways });
  } catch (err) {
    console.error('Fetch Gateways API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new gateway (Admin action)
export async function POST(req) {
  try {
    const gateway = await req.json();
    if (!gateway.name) {
      return NextResponse.json({ success: false, message: 'Gateway name is required.' }, { status: 400 });
    }

    const theme = gateway.theme || 'cashapp';
    const isLinkPay = theme === 'cashapp' || theme === 'stripe' || Boolean(String(gateway.redirectUrl || '').trim());
    const tag = String(gateway.tag || '').trim() || (isLinkPay ? `${theme}-pay` : '');
    if (!isLinkPay && !tag) {
      return NextResponse.json({ success: false, message: 'Name and payment tag/handle are required.' }, { status: 400 });
    }
    if (isLinkPay && !String(gateway.redirectUrl || '').trim()) {
      return NextResponse.json({ success: false, message: 'Pay redirect URL is required for Cash App / Stripe.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const newGateway = {
      id: gateway.id || Date.now().toString(),
      name: gateway.name,
      subtitle: gateway.subtitle || '',
      tag,
      phone: isLinkPay ? '' : (gateway.phone || ''),
      theme,
      qrImage: isLinkPay
        ? ''
        : (gateway.qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(gateway.name + '-' + tag)}`),
      redirectUrl: String(gateway.redirectUrl || '').trim(),
      isWithdrawActive: Boolean(gateway.isWithdrawActive),
      requireNameOnTag: Boolean(gateway.requireNameOnTag),
      requireTag: Boolean(gateway.requireTag),
      requirePhoneOnTag: Boolean(gateway.requirePhoneOnTag),
      requireEmailOnTag: Boolean(gateway.requireEmailOnTag)
    };

    await gatewaysCollection.insertOne(newGateway);
    
    // Invalidate caches
    cache.del('gateways_all');

    return NextResponse.json({ success: true, gateway: newGateway, message: 'Payment gateway added successfully!' });
  } catch (err) {
    console.error('Create Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT (update) gateway (Admin action)
export async function PUT(req) {
  try {
    const gateway = await req.json();
    if (!gateway.id) {
      return NextResponse.json({ success: false, message: 'Gateway ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const updateFields = {
      name: gateway.name,
      subtitle: gateway.subtitle,
      tag: gateway.tag,
      phone: gateway.phone,
      theme: gateway.theme,
      qrImage: gateway.qrImage,
      redirectUrl: gateway.redirectUrl !== undefined ? String(gateway.redirectUrl || '').trim() : undefined,
      isWithdrawActive: gateway.isWithdrawActive !== undefined ? Boolean(gateway.isWithdrawActive) : undefined,
      requireNameOnTag: gateway.requireNameOnTag !== undefined ? Boolean(gateway.requireNameOnTag) : undefined,
      requireTag: gateway.requireTag !== undefined ? Boolean(gateway.requireTag) : undefined,
      requirePhoneOnTag: gateway.requirePhoneOnTag !== undefined ? Boolean(gateway.requirePhoneOnTag) : undefined,
      requireEmailOnTag: gateway.requireEmailOnTag !== undefined ? Boolean(gateway.requireEmailOnTag) : undefined
    };

    // Clean undefined fields
    Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

    await gatewaysCollection.updateOne({ id: gateway.id }, { $set: updateFields });
    
    // Invalidate caches
    cache.del('gateways_all');

    return NextResponse.json({ success: true, message: 'Payment gateway updated successfully!' });
  } catch (err) {
    console.error('Update Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE gateway (Admin action)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Gateway ID parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    await gatewaysCollection.deleteOne({ id });
    
    // Invalidate caches
    cache.del('gateways_all');

    return NextResponse.json({ success: true, message: 'Payment gateway deleted successfully!' });
  } catch (err) {
    console.error('Delete Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

