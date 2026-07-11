import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

// GET distributor gateways
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');
    const gateways = await gatewaysCollection.find({ distributorId }).toArray();

    return NextResponse.json({ success: true, gateways });
  } catch (err) {
    console.error('Fetch Distributor Gateways API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create distributor gateway
export async function POST(req) {
  try {
    const { name, subtitle, tag, phone, theme, qrImage, isWithdrawActive, requireNameOnTag, requireTag, requirePhoneOnTag, requireEmailOnTag, distributorId } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }
    if (!name || !tag) {
      return NextResponse.json({ success: false, message: 'Name and tag/handle are required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const newGateway = {
      id: Date.now().toString(),
      name,
      subtitle: subtitle || '',
      tag,
      phone: phone || '',
      theme: theme || 'cashapp',
      qrImage: qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(name + '-' + tag)}`,
      isWithdrawActive: Boolean(isWithdrawActive),
      requireNameOnTag: Boolean(requireNameOnTag),
      requireTag: Boolean(requireTag),
      requirePhoneOnTag: Boolean(requirePhoneOnTag),
      requireEmailOnTag: Boolean(requireEmailOnTag),
      distributorId: distributorId
    };

    await gatewaysCollection.insertOne(newGateway);
    cache.del('gateways_all');

    return NextResponse.json({ success: true, gateway: newGateway, message: 'Gateway created successfully!' });
  } catch (err) {
    console.error('Create Distributor Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT edit distributor gateway
export async function PUT(req) {
  try {
    const { id, name, subtitle, tag, phone, theme, qrImage, isWithdrawActive, requireNameOnTag, requireTag, requirePhoneOnTag, requireEmailOnTag, distributorId } = await req.json();

    if (!id || !distributorId) {
      return NextResponse.json({ success: false, message: 'Gateway ID and Distributor ID are required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const updateFields = {
      name,
      subtitle,
      tag,
      phone,
      theme,
      qrImage,
      isWithdrawActive: isWithdrawActive !== undefined ? Boolean(isWithdrawActive) : undefined,
      requireNameOnTag: requireNameOnTag !== undefined ? Boolean(requireNameOnTag) : undefined,
      requireTag: requireTag !== undefined ? Boolean(requireTag) : undefined,
      requirePhoneOnTag: requirePhoneOnTag !== undefined ? Boolean(requirePhoneOnTag) : undefined,
      requireEmailOnTag: requireEmailOnTag !== undefined ? Boolean(requireEmailOnTag) : undefined
    };

    // Clean undefined fields
    Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

    const result = await gatewaysCollection.updateOne(
      { id, distributorId },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Gateway not found or access denied.' }, { status: 404 });
    }

    cache.del('gateways_all');
    return NextResponse.json({ success: true, message: 'Gateway updated successfully!' });
  } catch (err) {
    console.error('Update Distributor Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE distributor gateway
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const distributorId = searchParams.get('distributorId');

    if (!id || !distributorId) {
      return NextResponse.json({ success: false, message: 'Gateway ID and Distributor ID parameters are required.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const result = await gatewaysCollection.deleteOne({ id, distributorId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Gateway not found or access denied.' }, { status: 404 });
    }

    cache.del('gateways_all');
    return NextResponse.json({ success: true, message: 'Gateway deleted successfully!' });
  } catch (err) {
    console.error('Delete Distributor Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
