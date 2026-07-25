// Real-time polling — near-live without hammering Atlas on every tab.
export const POLL = {
  LIVE: 2500,   // Shift dashboard + coins allotment
  STATS: 4000,  // Sidebar badges + sound / desktop alerts
  QUEUES: 2500, // Requests, ledger, deposits
  LISTS: 5000,
  SUPPORT: 3000,
  CHAT: 2000,
  PLAYER: 5000,
  STATIC: 0
};

export function getPollingOptions(intervalMs, overrides = {}) {
  return {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
    dedupingInterval: intervalMs > 0 ? Math.min(1000, Math.floor(intervalMs / 2)) : 5000,
    ...overrides
  };
}
