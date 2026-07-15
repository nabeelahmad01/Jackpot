export function calcNetProfit(totalDeposits, totalWithdrawals) {
  return Math.max(0, (totalDeposits || 0) - (totalWithdrawals || 0));
}

export function calcCommissionFromProfit(totalDeposits, totalWithdrawals, ratePercent) {
  const profit = calcNetProfit(totalDeposits, totalWithdrawals);
  return profit * ((ratePercent || 0) / 100);
}
