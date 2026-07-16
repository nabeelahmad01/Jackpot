// Real-time polling — fast enough for cross-screen approve/notify flow
export const POLL = {
  STATS: 3000,
  QUEUES: 2000,
  LISTS: 4000,
  SUPPORT: 2500,
  CHAT: 2000,
  PLAYER: 4000,
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
