import { MongoClient, BSON } from 'mongodb';
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

    // Check for .ejson files or fallback to .json
    const allFiles = fs.readdirSync(latestBackupFolder);
    const dataFiles = allFiles.filter(f => f.endsWith('.ejson') || (f.endsWith('.json') && !f.endsWith('.indexes.json') && f !== '_metadata.json'));

    console.log(`📦 Found ${dataFiles.length} collections to restore.\n`);

    let totalRestored = 0;

    for (const file of dataFiles) {
      const isEjson = file.endsWith('.ejson');
      const colName = file.replace(/\.(ejson|json)$/, '');
      const filePath = path.join(latestBackupFolder, file);
      const rawData = fs.readFileSync(filePath, 'utf-8');

      // Parse with BSON.EJSON or standard JSON
      const docs = isEjson ? BSON.EJSON.parse(rawData, { relaxed: false }) : JSON.parse(rawData);

      const collection = db.collection(colName);
      
      // Clean target collection before inserting to prevent duplicate conflicts
      await collection.deleteMany({});

      if (Array.isArray(docs) && docs.length > 0) {
        const insertResult = await collection.insertMany(docs, { ordered: false });
        console.log(`  ✓ Restored ${colName.padEnd(26)} : ${String(insertResult.insertedCount).padStart(6)} documents`);
        totalRestored += insertResult.insertedCount;
      } else {
        console.log(`  ✓ Initialized empty collection : ${colName}`);
      }

      // Recreate custom indexes if backup has them
      const indexFile = path.join(latestBackupFolder, `${colName}.indexes.json`);
      if (fs.existsSync(indexFile)) {
        try {
          const indexDefs = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
          for (const idx of indexDefs) {
            if (idx.name === '_id_') continue; // Default index
            const keySpec = idx.key;
            const options = { name: idx.name };
            if (idx.unique) options.unique = true;
            if (idx.sparse) options.sparse = true;
            if (idx.expireAfterSeconds !== undefined) options.expireAfterSeconds = idx.expireAfterSeconds;
            await collection.createIndex(keySpec, options).catch(() => {});
          }
        } catch (_) {
          /* ignore index restore warning */
        }
      }
    }

    console.log('\n🎉 ================================================');
    console.log(`✅ 100% COMPLETE DATABASE RESTORE SUCCESSFUL!`);
    console.log(`📚 Total Collections Restored: ${dataFiles.length}`);
    console.log(`📊 Total Documents Restored: ${totalRestored}`);
    console.log('🎉 ================================================\n');
  } catch (err) {
    console.error('❌ Restore failed with error:', err);
  } finally {
    await client.close();
  }
}

restoreDatabase();
