export function isRemainderFullyPaid(tx) {
  if (tx.remainderPaid === true) return true;
  return parseFloat(tx.payoutHold || 0) <= 0;
}

export function isRemainderClaimPending(tx, claimedIds = []) {
  if (claimedIds.includes(tx.id)) return true;
  return Boolean(tx.remainderRequested) && tx.remainderStatus !== 'FAILED';
}

export function getRemainderCountdown(tx, now = Date.now()) {
  if (!tx.remainderClaimAvailableAt) return null;
  const diff = new Date(tx.remainderClaimAvailableAt).getTime() - now;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { hours, minutes, seconds };
}

const CLAIMABLE_TYPES = ['WITHDRAW', 'COMMISSION_WITHDRAW', 'AFFILIATE_COMMISSION_WITHDRAW'];

export function canShowClaimRemainderButton(tx, claimedIds = [], now = Date.now()) {
  if (!CLAIMABLE_TYPES.includes(tx.type) || tx.status !== 'SUCCESS') return false;
  if (isRemainderFullyPaid(tx)) return false;
  if (parseFloat(tx.payoutHold || 0) <= 0) return false;
  if (isRemainderClaimPending(tx, claimedIds)) return false;

  if (tx.remainderClaimAvailableAt) {
    return new Date(tx.remainderClaimAvailableAt).getTime() <= now;
  }
  return true;
}

export function formatRemainderCountdown(countdown) {
  if (!countdown) return '';
  return `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;
}
