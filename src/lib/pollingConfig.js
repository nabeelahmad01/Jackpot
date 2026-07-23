// Real-time polling — keep ops queues snappy for coins / shift staff
export const POLL = {
  LIVE: 1000,   // Shift dashboard + coins allotment (near real-time)
  STATS: 1500,  // Sidebar badges + sound / desktop alerts
  QUEUES: 1500, // Requests, ledger, deposits
  LISTS: 3000,
  SUPPORT: 2000,
  CHAT: 1500,
  PLAYER: 4000,
  STATIC: 0
};

export function getPollingOptions(intervalMs, overrides = {}) {
  return {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
    dedupingInterval: intervalMs > 0 ? Math.min(800, Math.floor(intervalMs / 2)) : 5000,
    ...overrides
  };
}
