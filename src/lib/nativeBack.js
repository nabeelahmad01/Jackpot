/**
 * Stack of optional back handlers (support chat, sidebar, etc.).
 * First handler that returns true consumes the Android/system back press.
 */
const handlers = [];

/** In-app pushState depth since this JS session started (ignores WebView preload history). */
let spaDepth = 0;
let historyTrackerInstalled = false;

/**
 * Capacitor / Chrome WebViews often start with history.length > 1 even on the
 * first screen, so history.length cannot decide whether to exit. We only count
 * pushState calls made after the app UI is running.
 */
export function installHistoryDepthTracker() {
  if (typeof window === 'undefined' || historyTrackerInstalled) return;
  historyTrackerInstalled = true;

  const origPush = window.history.pushState.bind(window.history);
  window.history.pushState = function patchedPushState(...args) {
    spaDepth += 1;
    return origPush(...args);
  };

  window.addEventListener('popstate', () => {
    spaDepth = Math.max(0, spaDepth - 1);
  });
}

export function getSpaHistoryDepth() {
  return spaDepth;
}

export function registerNativeBackHandler(handler) {
  if (typeof handler !== 'function') return () => {};
  handlers.unshift(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function runNativeBackHandlers() {
  for (const handler of handlers) {
    try {
      if (handler()) return true;
    } catch {
      // ignore broken handlers
    }
  }
  return false;
}

function isOverlayVisible(el) {
  if (!el || typeof window === 'undefined') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Close the topmost visible modal / sidebar overlay via its backdrop click. */
export function tryCloseTopOverlay() {
  if (typeof document === 'undefined') return false;
  const overlays = document.querySelectorAll(
    '.panel-modal-overlay, .modal-backdrop-custom, .admin-sidebar-overlay'
  );
  for (let i = overlays.length - 1; i >= 0; i -= 1) {
    const top = overlays[i];
    if (!isOverlayVisible(top)) continue;
    top.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }
  return false;
}

/**
 * True only when this session pushed in-app history we can undo.
 * Do NOT use window.history.length — WebViews inflate it and block App.exitApp().
 */
export function canHistoryGoBack() {
  return typeof window !== 'undefined' && spaDepth > 0;
}

/**
 * If the user opened a nested URL cold (refresh / deep link) with no spaDepth,
 * step up to the app root path so the next back can exit. Returns true if handled.
 */
export function tryStepUpNestedRoute() {
  if (typeof window === 'undefined') return false;
  const path = String(window.location.pathname || '').replace(/\/+$/, '') || '/';

  let parent = null;
  if (path.startsWith('/lobby/game/') || path === '/lobby/referrals') {
    parent = '/lobby';
  } else if (path === '/register' || path === '/forgot') {
    parent = '/login';
  } else if (/^\/admin\/.+/.test(path) && path !== '/admin/dashboard') {
    parent = '/admin/dashboard';
  } else if (/^\/distributor\/.+/.test(path) && path !== '/distributor/overview') {
    parent = '/distributor/overview';
  }

  if (!parent || path === parent) return false;

  window.history.replaceState({}, '', parent);
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}
