import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { compressDataUrlIfNeeded } from '../../../../lib/serverImageCompress';
import { publishAdminEvent } from '../../../../lib/adminEvents';

/**
 * GET transaction proof screenshot or receipt image.
 * Supports direct <img> rendering (returns binary image buffer) or JSON payload with format=json.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const field = searchParams.get('field') || 'auto';
    const format = searchParams.get('format');
    const acceptHeader = req.headers.get('accept') || '';

    if (!id) {
      return NextResponse.json({ success: false, message: 'Transaction ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ id: String(id) });

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
    }

    // Merge proofs from parent transaction if remainder/child tx
    let tagQrScreenshot = tx.tagQrScreenshot;
    let screenshot = tx.screenshot;
    let payoutProof = tx.payoutProof;
    let payoutQr = tx.payoutQr;
    let proofUrl = tx.proofUrl;

    if (tx.parentTxId && (!tagQrScreenshot || !screenshot || !payoutProof)) {
      const parentTx = await db.collection('transactions').findOne({ id: String(tx.parentTxId) });
      if (parentTx) {
        if (!tagQrScreenshot && parentTx.tagQrScreenshot) tagQrScreenshot = parentTx.tagQrScreenshot;
        if (!screenshot && parentTx.screenshot) screenshot = parentTx.screenshot;
        if (!payoutProof && parentTx.payoutProof) payoutProof = parentTx.payoutProof;
        if (!payoutQr && parentTx.payoutQr) payoutQr = parentTx.payoutQr;
        if (!proofUrl && parentTx.proofUrl) proofUrl = parentTx.proofUrl;
      }
    }

    let targetImage = null;
    if (field === 'tagQrScreenshot') {
      targetImage = tagQrScreenshot;
    } else if (field === 'payoutProof') {
      targetImage = payoutProof;
    } else if (field === 'payoutQr') {
      targetImage = payoutQr;
    } else if (field === 'screenshot') {
      targetImage = screenshot || proofUrl;
    } else {
      // Auto fallback: payout receipt for withdraws, then deposit screenshot, proofUrl, tag QR, payout QR
      targetImage = payoutProof || screenshot || proofUrl || tagQrScreenshot || payoutQr;
    }

    if (!targetImage || targetImage === true || typeof targetImage !== 'string' || !targetImage.trim()) {
      return NextResponse.json({ success: false, message: 'No proof image found.' }, { status: 404 });
    }

    const trimmedImage = targetImage.trim();

    // If JSON format is explicitly requested
    if (format === 'json' || (!acceptHeader.includes('image/*') && acceptHeader.includes('application/json'))) {
      return NextResponse.json({ success: true, image: trimmedImage, field });
    }

    // Handle base64 Data URL (e.g. data:image/png;base64,...)
    if (trimmedImage.startsWith('data:')) {
      const match = trimmedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1] || 'image/jpeg';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Content-Length': String(buffer.length)
          }
        });
      }
    }

    // Handle external URL
    if (trimmedImage.startsWith('http://') || trimmedImage.startsWith('https://')) {
      return NextResponse.redirect(new URL(trimmedImage));
    }

    // Fallback JSON return
    return NextResponse.json({ success: true, image: trimmedImage, field });
  } catch (err) {
    console.error('Transaction proof GET error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

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
      { projection: { _id: 1, type: 1, distributorId: 1 } }
    );

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Transaction not found.' }, { status: 404 });
    }

    const update = { proofPending: false };
    if (typeof screenshot === 'string' && screenshot.startsWith('data:image')) {
      // Aggressive cap — proof is for admin glance/approve, not archival quality
      update.screenshot = await compressDataUrlIfNeeded(screenshot, {
        maxChars: 120_000,
        maxSize: 960,
        quality: 62
      });
      update.hasScreenshot = true;
    }
    if (typeof tagQrScreenshot === 'string' && tagQrScreenshot.startsWith('data:image')) {
      update.tagQrScreenshot = await compressDataUrlIfNeeded(tagQrScreenshot, {
        maxChars: 120_000,
        maxSize: 960,
        quality: 62
      });
      update.hasTagQrScreenshot = true;
    }

    await db.collection('transactions').updateOne({ id: String(id), userEmail: email }, { $set: update });

    // Instant ledger refresh (View Proof) without waiting for the next poll
    publishAdminEvent('transactions', {
      distributorId: tx.distributorId || '',
      txType: tx.type || 'DEPOSIT',
      proofAttached: true,
      transactionId: String(id)
    });

    return NextResponse.json({ success: true, message: 'Payment proof attached.' });
  } catch (err) {
    console.error('Transaction proof upload error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
