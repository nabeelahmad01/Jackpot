/**
 * Format timestamps in the viewer's device local timezone.
 * Prefer ISO fields (createdAt / timestamp); fall back to legacy `date` strings.
 */

const DISPLAY_OPTS = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
};

export function parseDeviceDate(value) {
  if (value == null || value === '' || value === '—') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // ISO / RFC strings parse unambiguously as absolute instants
  const isoTry = Date.parse(raw);
  if (!Number.isNaN(isoTry) && (/^\d{4}-\d{2}-\d{2}/.test(raw) || /Z$|[+-]\d{2}:?\d{2}$/.test(raw))) {
    return new Date(isoTry);
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Full date + time in the device's local zone (e.g. ledger / request timestamps). */
export function formatDeviceDateTime(...candidates) {
  for (const value of candidates) {
    const d = parseDeviceDate(value);
    if (d) {
      try {
        return d.toLocaleString(undefined, DISPLAY_OPTS);
      } catch {
        return d.toLocaleString();
      }
    }
  }
  return '—';
}

/** Date only in the device's local zone. */
export function formatDeviceDate(...candidates) {
  for (const value of candidates) {
    const d = parseDeviceDate(value);
    if (d) {
      try {
        return d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        });
      } catch {
        return d.toLocaleDateString();
      }
    }
  }
  return '—';
}

/** Time only in the device's local zone. */
export function formatDeviceTime(...candidates) {
  for (const value of candidates) {
    const d = parseDeviceDate(value);
    if (d) {
      try {
        return d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
  }
  return '—';
}
