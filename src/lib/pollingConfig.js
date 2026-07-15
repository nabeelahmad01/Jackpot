// Real-time polling — fast enough for cross-screen approve/notify flow
export const POLL = {
  STATS: 4000,
  QUEUES: 4000,
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
    dedupingInterval: intervalMs > 0 ? Math.min(2000, Math.floor(intervalMs / 2)) : 5000,
    ...overrides
  };
}
