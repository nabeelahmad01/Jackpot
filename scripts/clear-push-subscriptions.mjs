/**
 * Back up and clear ALL push subscriptions so every device re-registers a
 * fresh token the next time its user opens the app.
 *
 * Usage: node scripts/clear-push-subscriptions.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const backupsDir = path.join(__dirname, '..', 'backups');

const raw = readFileSync(envPath, 'utf8');
for (const line of raw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const col = db.collection('pushSubscriptions');

  const all = await col.find({}).toArray();
  mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupsDir, `pushSubscriptions-${stamp}.json`);
  writeFileSync(file, JSON.stringify(all, null, 2));
  console.log(`Backed up ${all.length} subscription(s) → ${file}`);

  const res = await col.deleteMany({});
  console.log(`Deleted ${res.deletedCount} subscription(s). Collection is now empty.`);

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
