/**
 * Helper utility for calculating Player Level, VIP Status, and Claimable Deposit Bonuses
 * according to total cumulative deposits.
 */

export const LEVEL_TIERS = [
  {
    tierKey: 'bronze',
    levelName: 'Bronze',
    badgeEmoji: '🥉',
    minDeposit: 1000,
    maxDeposit: 5000,
    bonusDesc: '$5 per $1,000',
    bonusPer1k: 5
  },
  {
    tierKey: 'silver',
    levelName: 'Silver',
    badgeEmoji: '🥈',
    minDeposit: 5001,
    maxDeposit: 10000,
    bonusDesc: '$10 per $1,000',
    bonusPer1k: 10
  },
  {
    tierKey: 'gold',
    levelName: 'Gold',
    badgeEmoji: '🥇',
    minDeposit: 10001,
    maxDeposit: 15000,
    bonusDesc: '$15 per $1,000',
    bonusPer1k: 15
  },
  {
    tierKey: 'platinum',
    levelName: 'Platinum',
    badgeEmoji: '💎',
    minDeposit: 15001,
    maxDeposit: 20000,
    bonusDesc: '$20 per $1,000',
    bonusPer1k: 20
  },
  {
    tierKey: 'vip',
    levelName: 'VIP',
    badgeEmoji: '👑',
    minDeposit: 20000,
    maxDeposit: Infinity,
    bonusDesc: '50% bonus on qualifying $300+ deposits',
    isVip: true
  }
];

export function calculatePlayerLevel(cumulativeDeposit = 0) {
  const deposit = Math.max(0, Number(cumulativeDeposit) || 0);

  if (deposit >= 20000) {
    return {
      tierKey: 'vip',
      levelName: 'VIP',
      badgeEmoji: '👑',
      badgeLabel: 'VIP MEMBER',
      isVip: true,
      currentDeposit: deposit,
      bonusDesc: '50% bonus on qualifying $300+ deposits',
      vipQualifyingMin: 300,
      vipBonusPercent: 50,
      nextTier: null,
      neededForNext: 0,
      progressPercent: 100
    };
  }

  if (deposit >= 15001) {
    const progress = Math.min(100, Math.round(((deposit - 15001) / (20000 - 15001)) * 100));
    return {
      tierKey: 'platinum',
      levelName: 'Platinum',
      badgeEmoji: '💎',
      badgeLabel: 'PLATINUM MEMBER',
      isVip: false,
      currentDeposit: deposit,
      bonusDesc: '$20 per $1,000',
      nextTier: 'VIP ($20,000+)',
      neededForNext: 20000 - deposit,
      progressPercent: progress
    };
  }

  if (deposit >= 10001) {
    const progress = Math.min(100, Math.round(((deposit - 10001) / (15000 - 10001)) * 100));
    return {
      tierKey: 'gold',
      levelName: 'Gold',
      badgeEmoji: '🥇',
      badgeLabel: 'GOLD MEMBER',
      isVip: false,
      currentDeposit: deposit,
      bonusDesc: '$15 per $1,000',
      nextTier: 'Platinum ($15,001)',
      neededForNext: 15001 - deposit,
      progressPercent: progress
    };
  }

  if (deposit >= 5001) {
    const progress = Math.min(100, Math.round(((deposit - 5001) / (10000 - 5001)) * 100));
    return {
      tierKey: 'silver',
      levelName: 'Silver',
      badgeEmoji: '🥈',
      badgeLabel: 'SILVER MEMBER',
      isVip: false,
      currentDeposit: deposit,
      bonusDesc: '$10 per $1,000',
      nextTier: 'Gold ($10,001)',
      neededForNext: 10001 - deposit,
      progressPercent: progress
    };
  }

  if (deposit >= 1000) {
    const progress = Math.min(100, Math.round(((deposit - 1000) / (5000 - 1000)) * 100));
    return {
      tierKey: 'bronze',
      levelName: 'Bronze',
      badgeEmoji: '🥉',
      badgeLabel: 'BRONZE MEMBER',
      isVip: false,
      currentDeposit: deposit,
      bonusDesc: '$5 per $1,000',
      nextTier: 'Silver ($5,001)',
      neededForNext: 5001 - deposit,
      progressPercent: progress
    };
  }

  const progress = Math.min(100, Math.round((deposit / 1000) * 100));
  return {
    tierKey: 'standard',
    levelName: 'Standard',
    badgeEmoji: '⭐',
    badgeLabel: 'STANDARD MEMBER',
    isVip: false,
    currentDeposit: deposit,
    bonusDesc: 'Deposit $1,000 to unlock Bronze bonuses',
    nextTier: 'Bronze ($1,000)',
    neededForNext: 1000 - deposit,
    progressPercent: progress
  };
}
