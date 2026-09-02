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
