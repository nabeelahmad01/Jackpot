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
      if (m && !process.env[m[1]]) {
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1).trim();
        }
        process.env[m[1]] = val;
      }
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

const customTitle = process.argv[3];
const customBody = process.argv[4];

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const query = emailFilter ? { userEmail: { $regex: new RegExp(`^${emailFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } } : {};
  const subs = await db.collection('pushSubscriptions').find(query).toArray();
  const native = subs.filter((s) => s.type === 'native' && s.nativeToken);
  const web = subs.filter((s) => s.type !== 'native' && s.subscription);

  console.log(`\nFound ${subs.length} subscription(s) for query [${emailFilter || 'ALL'}]: ${native.length} native (APK), ${web.length} web.`);
  if (subs.length === 0) {
    console.log('No devices registered for this email. Open the app on the phone, tap "Sync / Enable Device Push", then retry.');
    await client.close();
    return;
  }

  // ---- Native (Android APK) via Firebase ----
  const serviceAccount = getServiceAccount();
  if (native.length > 0 && serviceAccount) {
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    const messaging = getMessaging(app);

    for (const sub of native) {
      const isStaff = sub.audience === 'staff' || sub.userEmail?.toLowerCase().includes('rocky') || sub.userEmail?.toLowerCase().includes('admin');
      const channelId = isStaff ? 'jackpot_portal_alerts' : (sub.audience === 'distributor' ? 'jackpot_distributor_alerts' : 'jackpot_promotions');
      const title = customTitle || (isStaff ? '🚨 Jackpot Portal Super Admin Alert' : 'Jackpot Royals');
      const body = customBody || (isStaff ? 'Demo test notification — Super Admin lock-screen push is working!' : 'Test notification — reply and tell us if this reached your lock screen!');
      const url = isStaff ? '/admin' : (sub.audience === 'distributor' ? '/distributor' : '/lobby');

      try {
        const res = await messaging.send({
          token: sub.nativeToken,
          notification: { title, body },
          data: { url, tag: 'demo-test' },
          android: {
            priority: 'high',
            notification: {
              channelId,
              sound: 'default'
            }
          }
        });
        console.log(`✅ Native APK Push Sent to [${sub.userEmail}] (${sub.platform || 'android'}) → MessageID: ${res}`);
      } catch (err) {
        console.log(`❌ Native APK Push Failed for [${sub.userEmail}]:`, err?.code || err?.message);
      }
    }
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
    for (const record of web) {
      const isStaff = record.audience === 'staff' || record.userEmail?.toLowerCase().includes('rocky') || record.userEmail?.toLowerCase().includes('admin');
      const title = customTitle || (isStaff ? '🚨 Jackpot Portal Alert' : 'Jackpot Royals');
      const body = customBody || (isStaff ? 'Demo test notification — Staff push is working!' : 'Test notification — reply and tell us if this reached your lock screen!');
      const url = isStaff ? '/admin' : '/lobby';
      const payload = JSON.stringify({ title, body, url, tag: 'test-push' });

      try {
        await webpush.sendNotification(record.subscription, payload);
        console.log(`✅ Web Push Sent to [${record.userEmail}]`);
      } catch (e) {
        console.log(`❌ Web push error for [${record.userEmail}]: ${e.statusCode || e.message}`);
      }
    }
  }

  await client.close();
  console.log('\nDone. Check your mobile lock screen now!');
}

main().catch((err) => {
  console.error('Test push failed:', err);
  process.exit(1);
});
