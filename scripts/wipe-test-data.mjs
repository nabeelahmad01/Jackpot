/**
 * Wipe test/round data from MongoDB while keeping the core catalog.
 *
 * What it does:
 *   1. Connects to the same DB as the app (MONGODB_URI from .env.local).
 *   2. Backs up EVERY collection to backups/backup-<timestamp>.json first.
 *   3. Clears (deleteMany {}) every collection EXCEPT the ones in KEEP
 *      (games, gateways, settings) so you get a fresh testing round without
 *      losing your game list, payment gateways, or site settings.
 *
 * Safety:
 *   - Runs a DRY RUN by default (shows counts, deletes nothing).
 *   - You must pass --confirm to actually delete.
 *
 * Usage:
 *   node scripts/wipe-test-data.mjs            # dry run (safe preview)
 *   node scripts/wipe-test-data.mjs --confirm  # real wipe (after backup)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const backupsDir = path.join(__dirname, '..', 'backups');

// Collections to PRESERVE (never cleared).
const KEEP = ['games', 'gateways', 'settings'];

function loadEnv() {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const confirm = process.argv.includes('--confirm');

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'))
    .sort();

  // 1. Backup everything.
  const backup = {};
  for (const name of collections) {
    backup[name] = await db.collection(name).find({}).toArray();
  }
  mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupsDir, `backup-${stamp}.json`);
  writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\n✅ Backup saved: ${backupFile}`);

  // 2. Report + wipe.
  console.log(`\nMode: ${confirm ? 'REAL WIPE' : 'DRY RUN (nothing deleted)'}`);
  console.log(`Keeping: ${KEEP.join(', ')}\n`);

  let totalDeleted = 0;
  for (const name of collections) {
    const count = backup[name].length;
    if (KEEP.includes(name)) {
      console.log(`  keep    ${name} (${count} docs)`);
      continue;
    }
    if (confirm) {
      const res = await db.collection(name).deleteMany({});
      totalDeleted += res.deletedCount || 0;
      console.log(`  wiped   ${name} (${res.deletedCount} deleted)`);
    } else {
      console.log(`  would wipe ${name} (${count} docs)`);
      totalDeleted += count;
    }
  }

  console.log(
    `\n${confirm ? 'Deleted' : 'Would delete'} ${totalDeleted} docs total.`
  );
  if (!confirm) {
    console.log('\nRun again with --confirm to actually wipe (backup is already saved).');
  }

  await client.close();
}

main().catch((err) => {
  console.error('Wipe failed:', err);
  process.exit(1);
});
