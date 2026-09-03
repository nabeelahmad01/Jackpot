export const CODE_WORDS = [
  'Ace', 'Alpha', 'Apex', 'Apollo', 'Apple', 'Archer', 'Aries', 'Arrow', 'Aster', 'Atlas',
  'Aurora', 'Badge', 'Bag', 'Ball', 'Bank', 'Banner', 'Baron', 'Beacon', 'Bear', 'Bed',
  'Bike', 'Bird', 'Black', 'Blaze', 'Blazer', 'Blue', 'Boat', 'Bolt', 'Bonus', 'Book',
  'Boost', 'Box', 'Brave', 'Bread', 'Breeze', 'Bullet', 'Bus', 'Cake', 'Canyon', 'Car',
  'Card', 'Cash', 'Castle', 'Cat', 'Cedar', 'Chair', 'Champion', 'Charge', 'Chase', 'Chrome',
  'Circle', 'City', 'Class', 'Cloud', 'Coat', 'Cobra', 'Coffee', 'Coin', 'Cold', 'Comet',
  'Copper', 'Cosmo', 'Cow', 'Cricket', 'Crown', 'Crystal', 'Cyber', 'Dagger', 'Dark', 'Dawn',
  'Day', 'Delta', 'Desk', 'Diamond', 'Dog', 'Door', 'Dragon', 'Drift', 'Eagle', 'Earth',
  'Echo', 'Elite', 'Ember', 'Empire', 'Falcon', 'Farm', 'Fast', 'Fire', 'Fish', 'Flame',
  'Flash', 'Flint', 'Focus', 'Food', 'Football', 'Forest', 'Fort', 'Fox', 'Free', 'Frost',
  'Fury', 'Galaxy', 'Game', 'Gas', 'Gemini', 'Giant', 'Glory', 'Gold', 'Golden', 'Good',
  'Grand', 'Granite', 'Green', 'Griffin', 'Guard', 'Halo', 'Happy', 'Harbor', 'Hat', 'Haven',
  'Hawk', 'Heart', 'Hero', 'Home', 'Honor', 'Horizon', 'Horse', 'Hot', 'Hotel', 'Hunter',
  'Hyper', 'Ice', 'Impact', 'Infinity', 'Iphone', 'Iron', 'Jack', 'Jackpot', 'Jade', 'Jasper',
  'Jet', 'Joker', 'Juice', 'Karma', 'Key', 'King', 'Knight', 'Laser', 'Legend', 'Lemon',
  'Leo', 'Liberty', 'Light', 'Lightning', 'Lion', 'Lock', 'Lotus', 'Love', 'Luck', 'Lucky',
  'Lunar', 'Magic', 'Magnet', 'Major', 'Mango', 'Maple', 'Marble', 'Mars', 'Master', 'Matrix',
  'Max', 'Meteor', 'Metro', 'Milk', 'Miracle', 'Monarch', 'Money', 'Moon', 'Mystic', 'Neon',
  'Nexus', 'Night', 'Ninja', 'Nitro', 'Noble', 'Nova', 'Oasis', 'Ocean', 'Omega', 'Onyx',
  'Orbit', 'Orion', 'Palace', 'Palm', 'Panther', 'Paper', 'Park', 'Peak', 'Pearl', 'Pen',
  'Petrol', 'Phantom', 'Phoenix', 'Phone', 'Pilot', 'Plane', 'Planet', 'Plasma', 'Platinum', 'Play',
  'Plaza', 'Polar', 'Power', 'Prime', 'Prism', 'Pulse', 'Python', 'Quantum', 'Queen', 'Radar',
  'Radiant', 'Rain', 'Ranger', 'Raven', 'Ray', 'Razor', 'Rebel', 'Red', 'Rice', 'Rider',
  'Ridge', 'Ring', 'River', 'Road', 'Rock', 'Rocket', 'Rocky', 'Rogue', 'Room', 'Royal',
  'Ruby', 'Run', 'Runner', 'Safari', 'Saint', 'Salt', 'Sapphire', 'Saturn', 'School', 'Scorpion',
  'Sea', 'Shadow', 'Shark', 'Shield', 'Ship', 'Shoe', 'Shop', 'Sierra', 'Silver', 'Sire',
  'Sky', 'Slow', 'Small', 'Solar', 'Spade', 'Spark', 'Spectre', 'Spidy', 'Spirit', 'Star',
  'Steel', 'Stop', 'Storm', 'Stride', 'Strike', 'Sugar', 'Summer', 'Summit', 'Sun', 'Super',
  'Swift', 'Target', 'Taxi', 'Tea', 'Tempest', 'Thunder', 'Tiger', 'Time', 'Titan', 'Top',
  'Topaz', 'Torch', 'Tower', 'Town', 'Track', 'Trail', 'Train', 'Tree', 'Trident', 'Trooper',
  'Truck', 'Turbo', 'Ultra', 'Union', 'Valiant', 'Valor', 'Vanguard', 'Vector', 'Vegas', 'Velvet',
  'Venom', 'Venture', 'Venus', 'Viper', 'Vision', 'Volcano', 'Volt', 'Vortex', 'Walk', 'Wall',
  'Water', 'Wave', 'White', 'Win', 'Wind', 'Winner', 'Winter', 'Wizard', 'Wolf', 'Work',
  'Zenith', 'Zero', 'Zeus', 'Zion'
];

/**
 * Generate a client-safe easy-to-read candidate code (e.g. "Car249", "Fish518", "Apple341")
 */
export function generateCandidateCode() {
  const randWord = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const randNum = Math.floor(100 + Math.random() * 900); // 3-digit easy numbers (100-999)
  return `${randWord}${randNum}`;
}
