import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { parseDataUrlImage } from '../../../../lib/gameImages';

/**
 * Serve a gateway QR as binary (not base64 JSON) — keeps /api/gateways lean.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Gateway id required.' }, { status: 400 });
    }

    const perKey = `gateway_image_${id}`;
    let image = cache.get(perKey);

    if (!image) {
      const db = await getDb();
      const gateway = await db.collection('gateways').findOne(
        { id: String(id) },
        { projection: { _id: 0, qrImage: 1 } }
      );
      image = gateway?.qrImage || null;
      if (image) cache.set(perKey, image, 300);
    }

    if (!image) {
      return NextResponse.json({ success: false, message: 'Image not found.' }, { status: 404 });
    }

    if (!String(image).startsWith('data:')) {
      if (
        String(image).startsWith('http://') ||
        String(image).startsWith('https://') ||
        String(image).startsWith('/')
      ) {
        return NextResponse.redirect(new URL(image, req.url), 302);
      }
      return NextResponse.redirect(new URL('/' + String(image).replace(/^\//, ''), req.url), 302);
    }

    const parsed = parseDataUrlImage(image);
    if (!parsed) {
      return NextResponse.json({ success: false, message: 'Invalid image data.' }, { status: 500 });
    }

    return new NextResponse(parsed.buffer, {
      status: 200,
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
      }
    });
  } catch (err) {
    console.error('Gateway image API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
