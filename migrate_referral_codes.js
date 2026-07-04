// Migration script: Add unique referralCode to all existing users who don't have one
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
});

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function migrate() {
  const uri = envVars.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB.');

    const db = client.db();
    const usersCollection = db.collection('users');

    const usersWithout = await usersCollection.find({
      $or: [
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: '' }
      ]
    }).toArray();

    console.log(`Found ${usersWithout.length} users without a referralCode.`);

    const existingCodes = new Set(
      (await usersCollection.find({ referralCode: { $exists: true, $ne: '' } }, { projection: { referralCode: 1 } }).toArray())
        .map(u => u.referralCode)
    );

    let updated = 0;

    for (const user of usersWithout) {
      let code = generateReferralCode();
      while (existingCodes.has(code)) {
        code = generateReferralCode();
      }
      existingCodes.add(code);

      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { referralCode: code } }
      );

      console.log(`  > ${user.email} -> ${code}`);
      updated++;
    }

    console.log(`\nMigration complete. Updated ${updated} users.`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.close();
  }
}

migrate();
