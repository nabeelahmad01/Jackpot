/**
 * Send a test push notification to the registered devices, so we can confirm
 * delivery + lock-screen behaviour.
 *
 * Usage:
 *   node scripts/test-push.mjs                 # send to ALL subscriptions
 *   node scripts/test-push.mjs you@email.com   # send only to one user's devices
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';
import webpush from 'web-push';
import { createPrivateKey } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

function loadEnv() {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const emailFilter = (process.argv[2] || '').trim().toLowerCase();

const TITLE = 'Jackpot Royals';
const BODY = 'Test notification — reply and tell us if this reached your lock screen!';

function normalize(sa) {
  if (sa && typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  return sa;
}

function keyIsValid(sa) {
  try {
    createPrivateKey(sa.private_key);
    return true;
  } catch {
    return false;
  }
}

function getServiceAccount() {
  const candidates = [];
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      candidates.push(normalize(JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'))));
    } catch { /* ignore */ }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      candidates.push(normalize(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)));
    } catch { /* ignore */ }
  }
  return candidates.find(keyIsValid) || candidates[0] || null;
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const query = emailFilter ? { userEmail: emailFilter } : {};
  const subs = await db.collection('pushSubscriptions').find(query).toArray();
  const native = subs.filter((s) => s.type === 'native' && s.nativeToken);
  const web = subs.filter((s) => s.type !== 'native' && s.subscription);

  console.log(`Found ${subs.length} subscription(s): ${native.length} native (APK), ${web.length} web.`);
  if (subs.length === 0) {
    console.log('No devices registered. Open the app, allow notifications, then retry.');
    await client.close();
    return;
  }

  // ---- Native (Android APK) via Firebase ----
  const serviceAccount = getServiceAccount();
  if (native.length > 0 && serviceAccount) {
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    const messaging = getMessaging(app);
    const res = await messaging.sendEachForMulticast({
      tokens: native.map((s) => s.nativeToken),
      notification: { title: TITLE, body: BODY },
      data: { url: '/lobby' },
      android: {
        priority: 'high',
        notification: { channelId: 'jackpot_promotions', sound: 'default' }
      }
    });
    console.log(`Native push → success: ${res.successCount}, failed: ${res.failureCount}`);
    res.responses.forEach((r, i) => {
      if (!r.success) console.log(`  token#${i} error: ${r.error?.code} ${r.error?.message}`);
    });
  } else if (native.length > 0) {
    console.log('Native devices exist but no Firebase service account found in .env.local.');
  }

  // ---- Web push ----
  if (web.length > 0 && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@jackpotroyals.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    const payload = JSON.stringify({ title: TITLE, body: BODY, url: '/lobby', tag: 'test-push' });
    let ok = 0;
    let bad = 0;
    for (const record of web) {
      try {
        await webpush.sendNotification(record.subscription, payload);
        ok += 1;
      } catch (e) {
        bad += 1;
        console.log(`  web error: ${e.statusCode || e.message}`);
      }
    }
    console.log(`Web push → success: ${ok}, failed: ${bad}`);
  }

  await client.close();
  console.log('\nDone. Check your device now.');
}

main().catch((err) => {
  console.error('Test push failed:', err);
  process.exit(1);
});
