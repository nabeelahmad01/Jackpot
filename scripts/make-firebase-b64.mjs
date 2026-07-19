/**
 * Regenerate a CORRECT base64 of the Firebase service account from the valid
 * FIREBASE_SERVICE_ACCOUNT_JSON in .env.local, so it can replace the corrupted
 * FIREBASE_SERVICE_ACCOUNT_B64 on the hosting panel.
 *
 * Output is written to firebase-b64-correct.txt (gitignored) — never printed.
 *
 * Usage: node scripts/make-firebase-b64.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createPrivateKey } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const outPath = path.join(__dirname, '..', 'firebase-b64-correct.txt');

const raw = readFileSync(envPath, 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
}

const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!json) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON not found in .env.local');
  process.exit(1);
}

const sa = JSON.parse(json);
if (typeof sa.private_key === 'string') sa.private_key = sa.private_key.replace(/\\n/g, '\n');

// Validate before emitting.
createPrivateKey(sa.private_key);

const b64 = Buffer.from(JSON.stringify(sa), 'utf8').toString('base64');
writeFileSync(outPath, b64 + '\n');

console.log('✅ Valid service account key confirmed.');
console.log(`✅ Correct base64 written to: ${outPath}`);
console.log(`   Length: ${b64.length} chars`);
console.log('\nOpen that file, copy the whole line, and paste it as');
console.log('FIREBASE_SERVICE_ACCOUNT_B64 on Hostinger, then redeploy.');
