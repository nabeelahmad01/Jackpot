import { EventEmitter } from 'events';

/**
 * In-process pub/sub for admin SSE (Jackpot Portal + Distributor panel).
 * Works with `next start` / single Node process (VPS).
 */
function getBus() {
  if (!globalThis.__jackpotAdminEvents) {
    const bus = new EventEmitter();
    bus.setMaxListeners(200);
    globalThis.__jackpotAdminEvents = bus;
  }
  return globalThis.__jackpotAdminEvents;
}

/**
 * @param {'coins'|'transactions'|'requests'|'support'|'campaigns'|'stats'} type
 * @param {object} [payload]
 */
export function publishAdminEvent(type, payload = {}) {
  try {
    const event = {
      type: String(type || 'stats'),
      ts: Date.now(),
      distributorId: payload.distributorId != null ? String(payload.distributorId) : '',
      ...payload
    };
    getBus().emit('admin', event);
  } catch (err) {
    console.error('publishAdminEvent failed:', err?.message || err);
  }
}

export function subscribeAdminEvents(listener) {
  const bus = getBus();
  bus.on('admin', listener);
  return () => bus.off('admin', listener);
}
