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

const sourceUri = process.env.MONGODB_URI;

if (!sourceUri) {
  console.error('❌ Error: MONGODB_URI not found in environment variables (.env.local or .env).');
  process.exit(1);
}

const backupDir = path.resolve(process.cwd(), 'db-backups', `backup_${Date.now()}`);

async function backupDatabase() {
  console.log('🚀 Connecting to MongoDB Atlas...');
  const client = new MongoClient(sourceUri, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to MongoDB Atlas.');

    const db = client.db();
    const dbName = db.databaseName;
    console.log(`📂 Database Name: "${dbName}"`);

    // Fetch ALL collections in database
    const collections = await db.listCollections({}, { nameOnly: false }).toArray();

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`📦 Found ${collections.length} total collections to backup.\n`);

    let totalDocs = 0;
    const metadata = {
      dbName,
      timestamp: new Date().toISOString(),
      collections: []
    };

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const collection = db.collection(colName);
      process.stdout.write(`  ⏳ ${colName.padEnd(26)} : Checking... `);

      const totalInCol = await collection.countDocuments().catch(() => 0);
      const docs = [];
      const PAGE_SIZE = 25;

      if (totalInCol === 0) {
        // empty collection
      } else {
        for (let skip = 0; skip < totalInCol; skip += PAGE_SIZE) {
          const chunk = await collection
            .find({})
            .sort({ _id: 1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .toArray();

          docs.push(...chunk);
          const percent = Math.min(100, Math.round((docs.length / totalInCol) * 100));
          process.stdout.write(`\r  ⏳ ${colName.padEnd(26)} : ${docs.length} / ${totalInCol} docs (${percent}%)... `);
        }
      }

      const indexes = await collection.indexes().catch(() => []);

      // Use BSON Extended JSON to preserve 100% data types
      const ejsonString = BSON.EJSON.stringify(docs, { relaxed: false });
      const filePath = path.join(backupDir, `${colName}.ejson`);
      fs.writeFileSync(filePath, ejsonString, 'utf-8');

      // Save collection index definitions
      const indexFilePath = path.join(backupDir, `${colName}.indexes.json`);
      fs.writeFileSync(indexFilePath, JSON.stringify(indexes, null, 2), 'utf-8');

      process.stdout.write(`\r  ✓ ${colName.padEnd(26)} : ${String(docs.length).padStart(6)} documents, ${indexes.length} indexes\n`);
      totalDocs += docs.length;

      metadata.collections.push({
        name: colName,
        count: docs.length,
        indexesCount: indexes.length
      });
    }

    fs.writeFileSync(path.join(backupDir, '_metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    console.log('\n🎉 ================================================');
    console.log(`✅ 100% COMPLETE DATABASE BACKUP SUCCESSFUL!`);
    console.log(`📁 Backup folder: ${backupDir}`);
    console.log(`📚 Total Collections Saved: ${metadata.collections.length}`);
    console.log(`📊 Total Documents Saved: ${totalDocs}`);
    console.log('🎉 ================================================\n');
  } catch (err) {
    console.error('❌ Backup failed with error:', err);
  } finally {
    await client.close();
  }
}

backupDatabase();
