import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

// GET all gateways
export async function GET() {
  try {
    const cachedGateways = cache.get('gateways_all');
    if (cachedGateways) {
      return NextResponse.json({ success: true, gateways: cachedGateways });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');
    const gateways = await gatewaysCollection.find().toArray();
    
    cache.set('gateways_all', gateways, 60);
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
    if (!gateway.name || !gateway.tag) {
      return NextResponse.json({ success: false, message: 'Name and payment tag/handle are required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const newGateway = {
      id: gateway.id || Date.now().toString(),
      name: gateway.name,
      subtitle: gateway.subtitle || '',
      tag: gateway.tag,
      phone: gateway.phone || '',
      theme: gateway.theme || 'cashapp',
      qrImage: gateway.qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(gateway.name + '-' + gateway.tag)}`
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
      qrImage: gateway.qrImage
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

