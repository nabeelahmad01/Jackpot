import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

// Default initial data for seeding
const DEFAULT_SEEDS = {
  users: [
    { name: 'System Admin', email: 'admin@jackpot.com', password: 'admin123', role: 'admin' },
    { name: 'Demo Player', email: 'player@test.com', password: 'password123', role: 'user' }
  ],
  games: [
    { id: '1', title: 'JUWA', badge: 'hot', image: 'game_juwa.png', link: 'https://play.juwa.org/' },
    { id: '2', title: 'GAMEVAULT', badge: 'hot', image: 'game_gamevault.png', link: 'https://play.gamevault.com/' },
    { id: '3', title: 'VEGAS SWEEPS', badge: 'hot', image: 'game_vegassweeps.png', link: 'https://play.vegassweeps.com/' },
    { id: '4', title: 'ULTRAPANDA', badge: 'none', image: 'placeholder_1', link: 'https://play.ultrapanda.com/' },
    { id: '5', title: 'BLUE DRAGON', badge: 'none', image: 'placeholder_2', link: 'https://play.bluedragon.com/' },
    { id: '6', title: 'FIREKIRIN', badge: 'none', image: 'placeholder_3', link: 'https://play.firekirin.com/' }
  ],
  gateways: [
    {
      id: '1',
      name: 'Chime',
      subtitle: 'Fast bank transfer',
      tag: '$Autumn-King-34',
      phone: '3239902704',
      theme: 'chime',
      qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ChimeTag-Autumn-King-34'
    },
    {
      id: '2',
      name: 'Cash App',
      subtitle: 'Pay using your Cash App',
      tag: '$Autumn-King-34',
      phone: '3239902704',
      theme: 'cashapp',
      qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CashApp-Autumn-King-34'
    },
    {
      id: '3',
      name: 'Crypto',
      subtitle: 'Pay using USDT / crypto wallet',
      tag: '0x71C568971B9c7e73238971a153b8971a153b8971',
      phone: 'USDT (TRC20)',
      theme: 'crypto',
      qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=USDT-0x71C568971B9c7e73238971a153b8971a153b8971'
    }
  ],
  accountRequests: [],
  gameAccounts: [],
  transactions: []
};

// -------------------------------------------------------------
// MongoDB Atlas Driver Setup
// -------------------------------------------------------------
let client;
let clientPromise;

if (MONGODB_URI) {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(MONGODB_URI);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
  }
}

// Function to seed real MongoDB on start if collections are empty
async function seedRealMongo(db) {
  try {
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    for (const [key, value] of Object.entries(DEFAULT_SEEDS)) {
      if (!names.includes(key) || (await db.collection(key).countDocuments()) === 0) {
        if (value.length > 0) {
          await db.collection(key).insertMany(value);
          console.log(`[Seed Database] Populated ${key} with defaults in MongoDB Atlas.`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed real MongoDB:', err);
  }
}

// -------------------------------------------------------------
// In-Memory JSON File Emulator Database Setup (Fallback)
// -------------------------------------------------------------
class MemoryCollection {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  _load() {
    this.db.load();
    return this.db.data[this.name] || [];
  }

  _save(data) {
    this.db.data[this.name] = data;
    this.db.save();
  }

  find(query = {}) {
    let results = this._load();
    if (Object.keys(query).length > 0) {
      results = results.filter(doc => this._match(doc, query));
    }
    return {
      toArray: async () => JSON.parse(JSON.stringify(results)),
      limit: (n) => ({
        toArray: async () => JSON.parse(JSON.stringify(results.slice(0, n)))
      }),
      sort: (s) => ({
        toArray: async () => {
          // Simple sort logic if sorting by date or ID descending
          const sorted = [...results];
          const sortField = Object.keys(s)[0];
          const sortOrder = s[sortField];
          sorted.sort((a, b) => {
            const valA = a[sortField] || '';
            const valB = b[sortField] || '';
            if (valA < valB) return sortOrder === -1 ? 1 : -1;
            if (valA > valB) return sortOrder === -1 ? -1 : 1;
            return 0;
          });
          return JSON.parse(JSON.stringify(sorted));
        }
      })
    };
  }

  async findOne(query = {}) {
    const results = this.find(query);
    const arr = await results.toArray();
    return arr[0] || null;
  }

  async insertOne(doc) {
    const list = this._load();
    const newDoc = { ...doc };
    if (!newDoc._id) {
      newDoc._id = Math.random().toString(36).substring(2, 9) + Date.now().toString().slice(-4);
    }
    list.push(newDoc);
    this._save(list);
    return { acknowledged: true, insertedId: newDoc._id };
  }

  async updateOne(query, update, options = {}) {
    const list = this._load();
    const index = list.findIndex(doc => this._match(doc, query));

    if (index === -1) {
      if (options.upsert) {
        const newDoc = { ...query };
        this._applyUpdate(newDoc, update);
        await this.insertOne(newDoc);
        return { acknowledged: true, modifiedCount: 0, upsertedId: newDoc._id };
      }
      return { acknowledged: true, modifiedCount: 0 };
    }

    this._applyUpdate(list[index], update);
    this._save(list);
    return { acknowledged: true, modifiedCount: 1 };
  }

  async deleteOne(query) {
    const list = this._load();
    const index = list.findIndex(doc => this._match(doc, query));
    if (index > -1) {
      list.splice(index, 1);
      this._save(list);
      return { acknowledged: true, deletedCount: 1 };
    }
    return { acknowledged: true, deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    const list = this._load();
    let count = 0;
    const newList = list.filter(doc => {
      const match = this._match(doc, query);
      if (match) count++;
      return !match;
    });
    this._save(newList);
    return { acknowledged: true, deletedCount: count };
  }

  async countDocuments(query = {}) {
    const results = this.find(query);
    const arr = await results.toArray();
    return arr.length;
  }

  _match(doc, query) {
    return Object.entries(query).every(([key, val]) => {
      if (val && typeof val === 'object') {
        if (val.$regex) {
          const regex = new RegExp(val.$regex, val.$options || '');
          return regex.test(doc[key] || '');
        }
        if (val.$in) {
          return val.$in.includes(doc[key]);
        }
      }
      // Standard comparison
      return doc[key] === val;
    });
  }

  _applyUpdate(doc, update) {
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    if (update.$unset) {
      Object.keys(update.$unset).forEach(key => delete doc[key]);
    }
  }
}

class LocalJSONDatabase {
  constructor() {
    this.data = {};
    this.loaded = false;
  }

  load() {
    if (this.loaded) return;
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const fileContent = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_SEEDS));
        this.save();
      }
      this.loaded = true;
    } catch (err) {
      console.error('Failed to load local JSON DB:', err);
      this.data = JSON.parse(JSON.stringify(DEFAULT_SEEDS));
    }
  }

  save() {
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save local JSON DB:', err);
    }
  }

  collection(name) {
    return new MemoryCollection(this, name);
  }
}

const localDb = new LocalJSONDatabase();

// -------------------------------------------------------------
// Core Database Dispatcher (MongoDB or Fallback)
// -------------------------------------------------------------
export async function getDb() {
  if (MONGODB_URI && clientPromise) {
    try {
      const mongoClient = await clientPromise;
      const db = mongoClient.db(); // Uses db name from URI connection string
      await seedRealMongo(db);
      return db;
    } catch (dbErr) {
      if (!global._warnedAboutMongoFailure) {
        console.warn('-------------------------------------------------------------');
        console.warn('⚠️ MONGODB ATLAS CONNECTION FAILURE (IP Whitelist/SSL issue):');
        console.warn(dbErr.message || dbErr);
        console.warn(`📂 Falling back to Local JSON File database: ${LOCAL_DB_PATH}`);
        console.warn('To resolve: whitelist client IP address in MongoDB Atlas settings.');
        console.warn('-------------------------------------------------------------');
        global._warnedAboutMongoFailure = true;
      }
      localDb.load();
      return localDb;
    }
  } else {
    // If no URI, log simulator warning once
    if (!global._warnedAboutMongo) {
      console.log('-------------------------------------------------------------');
      console.log('ℹ️ MONGODB_URI is not set in .env.local.');
      console.log(`📂 Using Local JSON File database instead: ${LOCAL_DB_PATH}`);
      console.log('-------------------------------------------------------------');
      global._warnedAboutMongo = true;
    }
    localDb.load();
    return localDb;
  }
}
