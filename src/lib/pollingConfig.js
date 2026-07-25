// Near-live polling for Hostinger Business (no SSE).
// Target feel: ~0.5s–1s updates on active admin queues.
export const POLL = {
  LIVE: 700,    // Shift dashboard + coins allotment
  STATS: 1000,  // Sidebar badges + sound / desktop alerts
  QUEUES: 800,  // Requests, ledger, deposits
  LISTS: 1000,
  SUPPORT: 900,
  CHAT: 600,
  PLAYER: 1000,
  STATIC: 0
};

export function getPollingOptions(intervalMs, overrides = {}) {
  return {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
    dedupingInterval: intervalMs > 0 ? Math.min(400, Math.floor(intervalMs / 2)) : 5000,
    ...overrides
  };
}
