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

/**
 * Calculates milestone rewards earned based on total cumulative deposit:
 * - Bronze ($1,000 to $5,000): $5 per completed $1,000 milestone (e.g. $1,000 -> $5, $2,000 -> +$5, up to $5,000 -> $25 total)
 * - Silver ($5,001 to $10,000): $10 per completed $1,000 milestone (e.g. $6,000 -> +$10, up to $10,000 -> $50 total)
 * - Gold ($10,001 to $15,000): $15 per completed $1,000 milestone (e.g. $11,000 -> +$15, up to $15,000 -> $75 total)
 * - Platinum ($15,001 to $20,000): $20 per completed $1,000 milestone (e.g. $16,000 -> +$20, up to $20,000 -> $100 total)
 */
export function calculateMilestoneRewards(cumulativeDeposit = 0, claimedAmount = 0) {
  const deposit = Math.max(0, Number(cumulativeDeposit) || 0);
  const claimed = Math.max(0, Number(claimedAmount) || 0);

  let totalEarned = 0;
  const milestones = [];

  // Iterate over each $1,000 milestone from $1,000 to $20,000
  for (let m = 1000; m <= 20000; m += 1000) {
    if (deposit >= m) {
      let bonusForMilestone = 0;
      if (m <= 5000) bonusForMilestone = 5;
      else if (m <= 10000) bonusForMilestone = 10;
      else if (m <= 15000) bonusForMilestone = 15;
      else if (m <= 20000) bonusForMilestone = 20;

      totalEarned += bonusForMilestone;
      milestones.push({
        milestoneDeposit: m,
        bonus: bonusForMilestone,
        achieved: true
      });
    }
  }

  const unclaimed = Math.max(0, totalEarned - claimed);

  // Next milestone calculation
  let nextMilestoneDeposit = 1000;
  for (let m = 1000; m <= 20000; m += 1000) {
    if (deposit < m) {
      nextMilestoneDeposit = m;
      break;
    }
  }

  return {
    cumulativeDeposit: deposit,
    totalEarned,
    totalClaimed: claimed,
    unclaimedAmount: unclaimed,
    canClaim: unclaimed > 0,
    milestones,
    nextMilestoneDeposit,
    neededForNextMilestone: Math.max(0, nextMilestoneDeposit - deposit)
  };
}
