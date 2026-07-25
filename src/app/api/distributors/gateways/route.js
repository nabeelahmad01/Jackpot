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
    const cacheKey = `gateways_dist_${distributorId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, gateways: cached });
    }

    const gateways = await gatewaysCollection.find({ distributorId }).toArray();
    // Same lean QR proxy as /api/gateways — list JSON stays small
    const lean = gateways.map((g) => {
      const qr = g.qrImage || '';
      if (typeof qr === 'string' && qr.startsWith('data:image') && g.id) {
        return { ...g, qrImage: `/api/gateways/image?id=${encodeURIComponent(g.id)}` };
      }
      return g;
    });
    cache.set(cacheKey, lean, 60);

    return NextResponse.json({ success: true, gateways: lean });
  } catch (err) {
    console.error('Fetch Distributor Gateways API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create distributor gateway
export async function POST(req) {
  try {
    const { name, subtitle, tag, phone, theme, qrImage, redirectUrl, isWithdrawActive, requireNameOnTag, requireTag, requirePhoneOnTag, requireEmailOnTag, distributorId } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ success: false, message: 'Distributor ID is required.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ success: false, message: 'Gateway name is required.' }, { status: 400 });
    }

    const resolvedTheme = theme || 'cashapp';
    const isLinkPay = resolvedTheme === 'cashapp' || resolvedTheme === 'stripe' || Boolean(String(redirectUrl || '').trim());
    const resolvedTag = String(tag || '').trim() || (isLinkPay ? `${resolvedTheme}-pay` : '');
    const resolvedRedirect = String(redirectUrl || '').trim();

    if (!isLinkPay && !resolvedTag) {
      return NextResponse.json({ success: false, message: 'Name and tag/handle are required.' }, { status: 400 });
    }
    if (isLinkPay && !resolvedRedirect) {
      return NextResponse.json({ success: false, message: 'Pay redirect URL is required for Cash App / Stripe.' }, { status: 400 });
    }

    const db = await getDb();
    const gatewaysCollection = db.collection('gateways');

    const newGateway = {
      id: Date.now().toString(),
      name,
      subtitle: subtitle || '',
      tag: resolvedTag,
      phone: isLinkPay ? '' : (phone || ''),
      theme: resolvedTheme,
      qrImage: isLinkPay
        ? ''
        : (qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(name + '-' + resolvedTag)}`),
      redirectUrl: resolvedRedirect,
      isWithdrawActive: Boolean(isWithdrawActive),
      requireNameOnTag: isWithdrawActive ? requireNameOnTag !== false : false,
      requireTag: isWithdrawActive ? requireTag !== false : false,
      requirePhoneOnTag: isWithdrawActive ? requirePhoneOnTag !== false : false,
      requireEmailOnTag: Boolean(requireEmailOnTag),
      distributorId: distributorId
    };

    await gatewaysCollection.insertOne(newGateway);
    cache.del('gateways_all');
    cache.del(`gateways_dist_${distributorId}`);

    return NextResponse.json({ success: true, gateway: newGateway, message: 'Gateway created successfully!' });
  } catch (err) {
    console.error('Create Distributor Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT edit distributor gateway
export async function PUT(req) {
  try {
    const { id, name, subtitle, tag, phone, theme, qrImage, redirectUrl, isWithdrawActive, requireNameOnTag, requireTag, requirePhoneOnTag, requireEmailOnTag, distributorId } = await req.json();

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
      redirectUrl: redirectUrl !== undefined ? String(redirectUrl || '').trim() : undefined,
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
    cache.del(`gateways_dist_${distributorId}`);
    cache.del(`gateway_image_${id}`);
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
    cache.del(`gateways_dist_${distributorId}`);
    cache.del(`gateway_image_${id}`);
    return NextResponse.json({ success: true, message: 'Gateway deleted successfully!' });
  } catch (err) {
    console.error('Delete Distributor Gateway API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
