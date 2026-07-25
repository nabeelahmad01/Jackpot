import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { compressDataUrlIfNeeded } from '../../../../lib/serverImageCompress';

/**
 * Attach payment proof after a fast deposit create (body without base64).
 * Keeps the initial POST tiny so toast + admin ledger update immediately.
 */
export async function PUT(req) {
  try {
    const { id, screenshot, tagQrScreenshot, userEmail } = await req.json();

    if (!id || !userEmail) {
      return NextResponse.json({ success: false, message: 'Transaction id and userEmail are required.' }, { status: 400 });
    }
    if (!screenshot && !tagQrScreenshot) {
      return NextResponse.json({ success: false, message: 'No proof image provided.' }, { status: 400 });
    }

    const db = await getDb();
    const email = String(userEmail).toLowerCase().trim();
    const tx = await db.collection('transactions').findOne(
      { id: String(id), userEmail: email },
      { projection: { _id: 1, type: 1 } }
    );

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
    }

    const update = { proofPending: false };
    if (typeof screenshot === 'string' && screenshot.startsWith('data:image')) {
      update.screenshot = await compressDataUrlIfNeeded(screenshot, {
        maxChars: 160_000,
        maxSize: 1100,
        quality: 68
      });
      update.hasScreenshot = true;
    }
    if (typeof tagQrScreenshot === 'string' && tagQrScreenshot.startsWith('data:image')) {
      update.tagQrScreenshot = await compressDataUrlIfNeeded(tagQrScreenshot, {
        maxChars: 160_000,
        maxSize: 1100,
        quality: 68
      });
      update.hasTagQrScreenshot = true;
    }

    await db.collection('transactions').updateOne({ id: String(id), userEmail: email }, { $set: update });

    return NextResponse.json({ success: true, message: 'Payment proof attached.' });
  } catch (err) {
    console.error('Transaction proof upload error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
