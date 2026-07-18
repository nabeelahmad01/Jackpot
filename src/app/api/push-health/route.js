import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic';

// Safe diagnostic: reports whether push is configured on THIS server.
// Returns booleans/counts only — never exposes any secret values.
export async function GET() {
  const vapidConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

  let firebaseEnvPresent = false;
  let firebaseParses = false;
  let firebaseError = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    firebaseEnvPresent = true;
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      const sa = JSON.parse(decoded);
      const hasFields = Boolean(sa.project_id && sa.client_email && sa.private_key);
      const hasNewlines = typeof sa.private_key === 'string' && sa.private_key.includes('\n');
      firebaseParses = hasFields && hasNewlines;
      if (!hasFields) firebaseError = 'B64 decoded but missing required fields.';
      else if (!hasNewlines) firebaseError = 'B64 private_key has no real newlines.';
    } catch (e) {
      firebaseError = 'B64 decode/parse failed: ' + e.message;
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    firebaseEnvPresent = true;
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      const hasFields = Boolean(sa.project_id && sa.client_email && sa.private_key);
      const hasNewlines = typeof sa.private_key === 'string' && sa.private_key.includes('\n');
      firebaseParses = hasFields && hasNewlines;
      if (!hasFields) firebaseError = 'JSON parsed but missing required fields.';
      else if (!hasNewlines) firebaseError = 'private_key has no real newlines (\\n got mangled).';
    } catch (e) {
      firebaseError = 'JSON.parse failed: ' + e.message;
    }
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    firebaseEnvPresent = true;
    firebaseParses = process.env.FIREBASE_PRIVATE_KEY.includes('\\n') || process.env.FIREBASE_PRIVATE_KEY.includes('\n');
  }

  let nativeSubs = null;
  let webSubs = null;
  try {
    const db = await getDb();
    nativeSubs = await db.collection('pushSubscriptions').countDocuments({ type: 'native' });
    webSubs = await db.collection('pushSubscriptions').countDocuments({ type: 'web' });
  } catch {
    // DB optional for this health check
  }

  return NextResponse.json({
    vapidConfigured,
    firebaseEnvPresent,
    firebaseParses,
    firebaseError,
    nativeSubs,
    webSubs
  });
}
