/**
 * Diagnose native (APK) push subscriptions WITHOUT notifying anyone.
 * Uses Firebase dryRun to check which stored tokens are still valid.
 *
 * Usage: node scripts/push-diagnose.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';
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
  } catch { /* ignore */ }
}
loadEnv();

function normalize(sa) {
  if (sa && typeof sa.private_key === 'string') sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}
function keyOk(sa) { try { createPrivateKey(sa.private_key); return true; } catch { return false; } }
function getServiceAccount() {
  const c = [];
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) { try { c.push(normalize(JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')))); } catch {} }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) { try { c.push(normalize(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))); } catch {} }
  return c.find(keyOk) || c[0] || null;
}

function fmt(d) { return d ? new Date(d).toLocaleString() : '—'; }

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const subs = await db.collection('pushSubscriptions').find({ type: 'native' }).sort({ createdAt: -1 }).toArray();
  console.log(`\nNative (APK) subscriptions: ${subs.length}\n`);

  const sa = getServiceAccount();
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
  const messaging = getMessaging(app);

  let validCount = 0;
  for (const s of subs) {
    let state = 'unknown';
    try {
      await messaging.send(
        { token: s.nativeToken, notification: { title: 't', body: 'b' }, android: { notification: { channelId: 'jackpot_promotions' } } },
        true // dryRun — validates only, delivers nothing
      );
      state = 'VALID';
      validCount += 1;
    } catch (e) {
      state = e.code || e.message;
    }
    console.log(
      `${state.padEnd(42)} ${String(s.userEmail || '—').padEnd(30)} created:${fmt(s.createdAt)}  updated:${fmt(s.updatedAt)}  …${String(s.nativeToken || '').slice(-10)}`
    );
  }

  console.log(`\nValid tokens: ${validCount} / ${subs.length}`);
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
