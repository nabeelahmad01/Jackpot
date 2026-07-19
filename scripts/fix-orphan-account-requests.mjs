/**
 * Fix players who are "stuck": they have an approved (READY/COMPLETED) account
 * request but no matching game account (e.g. after their distributor was
 * deleted and game accounts were removed). Such orphan requests block the lobby
 * from showing the "Request / Create Account" option, so we delete them and the
 * player can request fresh — routed to the super admin.
 *
 * Usage:
 *   node scripts/fix-orphan-account-requests.mjs            # dry run
 *   node scripts/fix-orphan-account-requests.mjs --confirm  # actually delete
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
for (const line of raw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
}

const confirm = process.argv.includes('--confirm');
const norm = (v) => String(v || '').toLowerCase().trim();

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const requests = await db.collection('accountRequests')
    .find({ status: { $in: ['READY', 'COMPLETED'] } })
    .toArray();
  const accounts = await db.collection('gameAccounts').find({}).toArray();

  const accountKey = new Set(accounts.map((a) => `${norm(a.userEmail)}||${norm(a.gameTitle)}`));

  const orphans = requests.filter(
    (r) => !accountKey.has(`${norm(r.userEmail)}||${norm(r.gameTitle)}`)
  );

  console.log(`\nApproved requests: ${requests.length}, game accounts: ${accounts.length}`);
  console.log(`Orphan requests (no matching game account): ${orphans.length}\n`);
  orphans.forEach((r) => console.log(`  ${r.userEmail}  ·  ${r.gameTitle}  ·  ${r.status}`));

  if (orphans.length && confirm) {
    const ids = orphans.map((r) => r.id).filter(Boolean);
    const res = await db.collection('accountRequests').deleteMany({ id: { $in: ids } });
    console.log(`\nDeleted ${res.deletedCount} orphan request(s). Those players can now re-request.`);
  } else if (orphans.length) {
    console.log('\nRun again with --confirm to delete these orphan requests.');
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
