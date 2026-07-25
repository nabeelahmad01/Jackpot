// VPS-tuned near-live polling (SSE handles instant cross-tab; poll is backup).
export const POLL = {
  LIVE: 500,    // Shift dashboard + coins allotment
  STATS: 800,   // Sidebar badges + sound / desktop alerts
  QUEUES: 600,  // Requests, ledger, deposits
  LISTS: 1200,
  SUPPORT: 800,
  CHAT: 500,
  PLAYER: 1500,
  STATIC: 0
};

export function getPollingOptions(intervalMs, overrides = {}) {
  return {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
    dedupingInterval: intervalMs > 0 ? Math.min(250, Math.floor(intervalMs / 2)) : 5000,
    ...overrides
  };
}
