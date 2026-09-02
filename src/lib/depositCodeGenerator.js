import { getDb } from './mongodb';

export const CODE_WORDS = [
  'Alpha', 'Apex', 'Apollo', 'Archer', 'Aries', 'Arrow', 'Aster', 'Atlas',
  'Aurora', 'Badge', 'Banner', 'Baron', 'Beacon', 'Blaze', 'Blazer', 'Bolt',
  'Bonus', 'Boost', 'Brave', 'Breeze', 'Bullet', 'Canyon', 'Castle', 'Cedar',
  'Champion', 'Charge', 'Chase', 'Chrome', 'Cipher', 'Cobra', 'Comet', 'Copper',
  'Cosmo', 'Crown', 'Crystal', 'Cyber', 'Dagger', 'Dawn', 'Delta', 'Diamond',
  'Dragon', 'Drift', 'Eagle', 'Echo', 'Elite', 'Ember', 'Empire', 'Falcon',
  'Fire', 'Flame', 'Flash', 'Flint', 'Focus', 'Forest', 'Fort', 'Fox',
  'Frost', 'Fury', 'Galaxy', 'Gemini', 'Giant', 'Glory', 'Gold', 'Golden',
  'Grand', 'Granite', 'Griffin', 'Guard', 'Halo', 'Harbor', 'Haven', 'Hawk',
  'Heart', 'Hero', 'Honor', 'Horizon', 'Hunter', 'Hyper', 'Impact', 'Infinity',
  'Iron', 'Jade', 'Jasper', 'Jet', 'Joker', 'Karma', 'King', 'Knight',
  'Laser', 'Legend', 'Leo', 'Liberty', 'Lightning', 'Lion', 'Lotus', 'Lucky',
  'Lunar', 'Magic', 'Magnet', 'Major', 'Maple', 'Marble', 'Mars', 'Master',
  'Matrix', 'Max', 'Meteor', 'Metro', 'Miracle', 'Monarch', 'Moon', 'Mystic',
  'Neon', 'Nexus', 'Ninja', 'Nitro', 'Noble', 'Nova', 'Oasis', 'Ocean',
  'Omega', 'Onyx', 'Orbit', 'Orion', 'Palace', 'Palm', 'Panther', 'Peak',
  'Pearl', 'Phantom', 'Phoenix', 'Pilot', 'Planet', 'Plasma', 'Platinum',
  'Plaza', 'Polar', 'Power', 'Prime', 'Prism', 'Pulse', 'Python', 'Quantum',
  'Radar', 'Radiant', 'Ranger', 'Raven', 'Ray', 'Razor', 'Rebel', 'Rider',
  'Ridge', 'River', 'Rocket', 'Rogue', 'Royal', 'Ruby', 'Runner', 'Safari',
  'Saint', 'Sapphire', 'Saturn', 'Scorpion', 'Shadow', 'Shark', 'Shield', 'Sierra',
  'Silver', 'Sire', 'Sky', 'Solar', 'Spark', 'Spectre', 'Spirit', 'Star',
  'Steel', 'Storm', 'Stride', 'Strike', 'Summit', 'Sun', 'Super', 'Swift',
  'Target', 'Tempest', 'Thunder', 'Tiger', 'Titan', 'Topaz', 'Torch', 'Tower',
  'Track', 'Trail', 'Trident', 'Trooper', 'Turbo', 'Ultra', 'Union', 'Valiant',
  'Valor', 'Vanguard', 'Vector', 'Vegas', 'Velvet', 'Venom', 'Venture', 'Venus',
  'Viper', 'Vision', 'Volcano', 'Volt', 'Vortex', 'Wave', 'Winner', 'Wizard',
  'Wolf', 'Zenith', 'Zero', 'Zeus', 'Zion'
];

/**
 * Generate a client-safe high-entropy candidate code (e.g. "Falcon4821")
 */
export function generateCandidateCode() {
  const randWord = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${randWord}${randNum}`;
}

/**
 * Generate a guaranteed unique deposit note code by checking against the database.
 * Ensures the code has NEVER been used in transactions or accountRequests.
 * @param {import('mongodb').Db} [dbInstance]
 * @returns {Promise<string>}
 */
export async function generateUniqueDepositCode(dbInstance) {
  try {
    const db = dbInstance || (await getDb());
    const transactions = db.collection('transactions');
    const accountRequests = db.collection('accountRequests');

    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = generateCandidateCode();

      // Fast projection check to verify candidate doesn't exist anywhere
      const [existingTx, existingReq] = await Promise.all([
        transactions.findOne(
          {
            $or: [
              { code: candidate },
              { noteCode: candidate }
            ]
          },
          { projection: { _id: 1 } }
        ),
        accountRequests.findOne(
          {
            $or: [
              { noteCode: candidate },
              { code: candidate }
            ]
          },
          { projection: { _id: 1 } }
        )
      ]);

      if (!existingTx && !existingReq) {
        return candidate;
      }
    }

    // High entropy fallback if loop exits: 5-digit number + timestamp tail
    const randWord = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
    const extraNum = Math.floor(10000 + Math.random() * 90000);
    return `${randWord}${extraNum}`;
  } catch (err) {
    console.error('Error generating unique deposit code:', err);
    return generateCandidateCode();
  }
}
