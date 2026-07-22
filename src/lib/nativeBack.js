/**
 * Stack of optional back handlers (support chat, sidebar, etc.).
 * First handler that returns true consumes the Android/system back press.
 */
const handlers = [];

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

/** Close the topmost visible modal / sidebar overlay via its backdrop click. */
export function tryCloseTopOverlay() {
  if (typeof document === 'undefined') return false;
  const overlays = document.querySelectorAll(
    '.panel-modal-overlay, .modal-backdrop-custom, .admin-sidebar-overlay'
  );
  if (!overlays.length) return false;
  const top = overlays[overlays.length - 1];
  top.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
}

export function canHistoryGoBack() {
  if (typeof window === 'undefined') return false;
  // history.length is imperfect in WebViews but good enough with pushState tabs.
  return window.history.length > 1;
}
