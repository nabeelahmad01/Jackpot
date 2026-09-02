import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Helper to load environment variables from .env.local or .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const targetUri = process.env.LOCAL_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jackpot';

async function restoreDatabase() {
  const backupsRoot = path.resolve(process.cwd(), 'db-backups');
  if (!fs.existsSync(backupsRoot)) {
    console.error('❌ Error: db-backups directory not found.');
    process.exit(1);
  }

  // Find latest backup folder
  const subdirs = fs.readdirSync(backupsRoot)
    .filter(name => fs.statSync(path.join(backupsRoot, name)).isDirectory() && name.startsWith('backup_'))
    .sort()
    .reverse();

  if (subdirs.length === 0) {
    console.error('❌ Error: No backup folders found inside db-backups.');
    process.exit(1);
  }

  const latestBackupFolder = path.join(backupsRoot, subdirs[0]);
  console.log(`📂 Selected Backup: ${latestBackupFolder}`);
  console.log(`🚀 Connecting to Target MongoDB: ${targetUri}...`);

  const client = new MongoClient(targetUri);

  try {
    await client.connect();
    console.log('✅ Connected successfully to Target MongoDB.');

    const db = client.db();
    const files = fs.readdirSync(latestBackupFolder).filter(f => f.endsWith('.json'));

    console.log(`📦 Found ${files.length} collections to restore.\n`);

    let totalRestored = 0;

    for (const file of files) {
      const colName = path.basename(file, '.json');
      const filePath = path.join(latestBackupFolder, file);
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const docs = JSON.parse(rawData);

      if (!Array.isArray(docs) || docs.length === 0) {
        console.log(`  ⚠ Skipping empty collection: ${colName}`);
        continue;
      }

      const collection = db.collection(colName);
      
      // Clean target collection before inserting to prevent duplicate _id conflicts
      await collection.deleteMany({});
      
      const insertResult = await collection.insertMany(docs, { ordered: false });
      console.log(`  ✓ Restored ${colName}: ${insertResult.insertedCount} documents`);
      totalRestored += insertResult.insertedCount;
    }

    console.log('\n🎉 ================================================');
    console.log(`✅ DATABASE RESTORE COMPLETED SUCCESSFULLY!`);
    console.log(`📊 Total documents restored: ${totalRestored}`);
    console.log('🎉 ================================================\n');
  } catch (err) {
    console.error('❌ Restore failed with error:', err);
  } finally {
    await client.close();
  }
}

restoreDatabase();
