/**
 * Cashout minimum from last successful deposit:
 * - last deposit < $50  → amount × 5
 * - last deposit ≥ $50  → amount × 3
 * Returns null when there is no usable last deposit (caller keeps default $25).
 */
export function getDepositBasedMinWithdraw(lastDepositAmount) {
  const deposit = Number(lastDepositAmount);
  if (!Number.isFinite(deposit) || deposit <= 0) return null;
  const multiplier = deposit < 50 ? 5 : 3;
  return Math.round(deposit * multiplier * 100) / 100;
}

export function findLastSuccessDeposit(transactions, { userEmail, gameTitle } = {}) {
  const email = String(userEmail || '').toLowerCase().trim();
  const game = String(gameTitle || '').toLowerCase().trim();
  const rows = (Array.isArray(transactions) ? transactions : [])
    .filter((t) => {
      if (String(t.type || '').toUpperCase() !== 'DEPOSIT') return false;
      if (String(t.status || '').toUpperCase() !== 'SUCCESS') return false;
      if (email && String(t.userEmail || '').toLowerCase().trim() !== email) return false;
      if (game && String(t.gameTitle || '').toLowerCase().trim() !== game) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || a.date || 0) || 0;
      const tb = Date.parse(b.createdAt || b.date || 0) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  return rows[0] || null;
}
