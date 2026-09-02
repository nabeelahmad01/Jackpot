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

const sourceUri = process.env.MONGODB_URI;

if (!sourceUri) {
  console.error('❌ Error: MONGODB_URI not found in environment variables (.env.local or .env).');
  process.exit(1);
}

const backupDir = path.resolve(process.cwd(), 'db-backups', `backup_${Date.now()}`);

async function backupDatabase() {
  console.log('🚀 Connecting to MongoDB Atlas...');
  const client = new MongoClient(sourceUri);

  try {
    await client.connect();
    console.log('✅ Connected successfully to MongoDB Atlas.');

    const db = client.db();
    const collections = await db.listCollections().toArray();

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`📦 Found ${collections.length} collections to export.\n`);

    let totalDocs = 0;

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const collection = db.collection(colName);
      const docs = await collection.find({}).toArray();
      const filePath = path.join(backupDir, `${colName}.json`);

      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      console.log(`  ✓ Exported ${colName}: ${docs.length} documents -> ${colName}.json`);
      totalDocs += docs.length;
    }

    console.log('\n🎉 ================================================');
    console.log(`✅ FULL DATABASE BACKUP COMPLETED!`);
    console.log(`📁 Backup folder: ${backupDir}`);
    console.log(`📊 Total documents saved: ${totalDocs}`);
    console.log('🎉 ================================================\n');
  } catch (err) {
    console.error('❌ Backup failed with error:', err);
  } finally {
    await client.close();
  }
}

backupDatabase();
