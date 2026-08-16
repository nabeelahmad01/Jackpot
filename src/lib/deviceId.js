// Client-Side Device Identification and Fingerprinting Utility
// Protects against multi-accounting and bonus fraud by persistently identifying unique devices.

const DEVICE_ID_KEY = 'jackpot_device_id';
const COOKIE_KEY = 'jackpot_did';
const FINGERPRINT_KEY = 'jackpot_device_fp';

/** Simple string hash (djb2 / murmur3 variant) for quick client hashing */
function hashString(str) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** Read a cookie by name */
function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

/** Set a persistent cookie with 5-year expiry */
function setCookie(name, value) {
  if (typeof document === 'undefined') return;
  const maxAge = 5 * 365 * 24 * 60 * 60; // 5 years
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Generate a cryptographically strong UUID */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'did_' + crypto.randomUUID().replace(/-/g, '');
  }
  return 'did_' + 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate Canvas 2D text fingerprint */
function getCanvasFingerprint() {
  try {
    if (typeof document === 'undefined') return 'no-dom';
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-ctx';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', 'Helvetica', sans-serif";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('JackpotRoyals-DeviceLock:1.0', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('JackpotRoyals-DeviceLock:1.0', 4, 17);

    return hashString(canvas.toDataURL());
  } catch (e) {
    return 'canvas-error';
  }
}

/** Generate WebGL renderer fingerprint */
function getWebGLFingerprint() {
  try {
    if (typeof document === 'undefined') return 'no-dom';
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    return hashString(`${vendor}~${renderer}`);
  } catch (e) {
    return 'webgl-error';
  }
}

/**
 * Get or create persistent Device ID
 * Stored across localStorage and persistent cookies for survival against single-storage clears.
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';

  let id = '';
  try {
    id = localStorage.getItem(DEVICE_ID_KEY) || '';
  } catch (e) {
    // localStorage might be restricted
  }

  if (!id) {
    id = getCookie(COOKIE_KEY);
  }

  if (!id) {
    id = generateUUID();
  }

  // Ensure persisted in both locations
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch (e) {}

  setCookie(COOKIE_KEY, id);

  return id;
}

/**
 * Get stable hardware/browser fingerprint hash
 */
export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return '';

  try {
    const cached = sessionStorage.getItem(FINGERPRINT_KEY);
    if (cached) return cached;
  } catch (e) {}

  const screenInfo = typeof window !== 'undefined' && window.screen
    ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.devicePixelRatio || 1}`
    : 'no-screen';

  const tz = typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    : '';

  const tzOffset = typeof Date !== 'undefined' ? new Date().getTimezoneOffset() : 0;
  const nav = typeof navigator !== 'undefined' ? navigator : {};

  const hardwareSignals = [
    screenInfo,
    tz,
    tzOffset,
    nav.language || '',
    (nav.languages || []).join(','),
    nav.hardwareConcurrency || '0',
    nav.maxTouchPoints || '0',
    nav.platform || '',
    getCanvasFingerprint(),
    getWebGLFingerprint()
  ].join('||');

  const fp = 'fp_' + hashString(hardwareSignals);

  try {
    sessionStorage.setItem(FINGERPRINT_KEY, fp);
  } catch (e) {}

  return fp;
}

/**
 * Get complete device payload for registration & auth calls
 */
export function getDevicePayload() {
  if (typeof window === 'undefined') {
    return { deviceId: '', deviceFingerprint: '' };
  }
  return {
    deviceId: getOrCreateDeviceId(),
    deviceFingerprint: getDeviceFingerprint()
  };
}
