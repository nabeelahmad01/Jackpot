import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1).trim();
        }
        process.env[m[1]] = val;
      }
    }
  }
}
loadEnv();

function matchesDate(dateValue, dateParam) {
  if (!dateValue) return false;
  const str = String(dateValue).trim();
  const [targetY, targetM, targetD] = dateParam.split('-').map(Number);

  // 1. Direct prefix matches
  // e.g. "2026-09-06" or "2026-9-6"
  if (str.startsWith(dateParam)) return true;
  
  // e.g. "9/6/2026" or "09/06/2026" or "9/06/2026"
  const m1 = `${targetM}/${targetD}/${targetY}`;
  const m2 = `${String(targetM).padStart(2, '0')}/${String(targetD).padStart(2, '0')}/${targetY}`;
  const m3 = `${targetM}/${String(targetD).padStart(2, '0')}/${targetY}`;
  const m4 = `${String(targetM).padStart(2, '0')}/${targetD}/${targetY}`;

  if (str.startsWith(m1) || str.startsWith(m2) || str.startsWith(m3) || str.startsWith(m4)) {
    return true;
  }

  // 2. Parse Date
  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) {
    if (d.getFullYear() === targetY && (d.getMonth() + 1) === targetM && d.getDate() === targetD) return true;
    if (d.getUTCFullYear() === targetY && (d.getUTCMonth() + 1) === targetM && d.getUTCDate() === targetD) return true;
    const pkt = new Date(d.getTime() + 5 * 3600000);
    if (pkt.getUTCFullYear() === targetY && (pkt.getUTCMonth() + 1) === targetM && pkt.getUTCDate() === targetD) return true;
  }
  return false;
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jackpot';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const allSuccessTxs = await db.collection('transactions').find({ status: 'SUCCESS' }).toArray();
  console.log(`Total SUCCESS transactions in DB: ${allSuccessTxs.length}`);

  // Group by date
  const countsByDate = {};
  allSuccessTxs.forEach((tx) => {
    const raw = String(tx.date || tx.createdAt || '');
    const d = new Date(raw);
    let key = 'unknown';
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      key = `${y}-${m}-${day}`;
    }
    countsByDate[key] = (countsByDate[key] || 0) + 1;
  });

  console.log('Transaction counts by date in DB:');
  console.table(countsByDate);

  // Test date matching for 2026-07-26 and 2026-07-25
  for (const testDate of ['2026-07-26', '2026-07-25', '2026-09-06', '2026-09-07']) {
    const matched = allSuccessTxs.filter(t => matchesDate(t.date, testDate) || matchesDate(t.createdAt, testDate));
    const inTotal = matched.filter(t => t.type === 'DEPOSIT').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const outTotal = matched.filter(t => t.type === 'WITHDRAW').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    console.log(`Test Date: ${testDate} => Matched: ${matched.length} txs | In: $${inTotal} | Out: $${outTotal}`);
  }

  await client.close();
}

main().catch(console.error);
