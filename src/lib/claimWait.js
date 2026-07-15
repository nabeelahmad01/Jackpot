export function buildRemainderClaimAvailableAt(hours = 0, minutes = 0) {
  const h = Math.max(0, Number(hours) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  const totalMs = h * 3600000 + m * 60000;
  if (totalMs <= 0) return new Date().toISOString();
  return new Date(Date.now() + totalMs).toISOString();
}
