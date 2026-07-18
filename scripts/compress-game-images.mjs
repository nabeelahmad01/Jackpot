/**
 * One-time migration: compress existing base64 game cover images.
 *
 * Older games stored full-size images (up to 2MB) as base64 data URLs inside
 * the games collection, which made /api/games return a huge payload and the
 * lobby load slowly. This script resizes each embedded image to max 512px and
 * re-encodes it as WebP so the payload becomes tiny.
 *
 * Usage:  node scripts/compress-game-images.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

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

const MAX_SIZE = 512;
const QUALITY = 72;

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const games = db.collection('games');

  const all = await games.find({}).toArray();
  console.log(`Found ${all.length} games.`);

  let changed = 0;
  let savedBytes = 0;

  for (const game of all) {
    const img = game.image;
    if (typeof img !== 'string' || !img.startsWith('data:image')) continue;

    const commaIdx = img.indexOf(',');
    if (commaIdx === -1) continue;
    const base64 = img.slice(commaIdx + 1);
    let inputBuf;
    try {
      inputBuf = Buffer.from(base64, 'base64');
    } catch {
      continue;
    }

    try {
      const outBuf = await sharp(inputBuf)
        .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();

      const newDataUrl = `data:image/webp;base64,${outBuf.toString('base64')}`;

      if (newDataUrl.length < img.length) {
        await games.updateOne({ id: game.id }, { $set: { image: newDataUrl } });
        const before = img.length;
        const after = newDataUrl.length;
        savedBytes += before - after;
        changed++;
        console.log(`✓ ${game.title}: ${kb(before)} -> ${kb(after)}`);
      } else {
        console.log(`• ${game.title}: already small, skipped.`);
      }
    } catch (err) {
      console.warn(`✗ ${game.title}: failed to compress (${err.message}). Left unchanged.`);
    }
  }

  console.log(`\nDone. Compressed ${changed} images. Total saved: ${kb(savedBytes)}.`);
  console.log('Note: restart the dev server / clear the games cache to see the effect.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
