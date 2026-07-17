'use client';

/**
 * Cross-device alert helper for staff dashboards (admin + distributor).
 * Adds three layers on top of the existing in-page sound:
 *   1. OS/desktop notification (PC, Mac, Android Chrome via service worker)
 *   2. Browser tab title flashing
 *   3. Favicon badge with an unseen count
 *
 * All functions are safe no-ops on the server or when a browser API is missing,
 * so they can never break the dashboards.
 */

let permissionAsked = false;
let listenersBound = false;

let titleFlashTimer = null;
let originalTitle = null;

let originalFaviconHref = null;
let baseFaviconImg = null;

let unseen = 0;

function clearAlerts() {
  unseen = 0;

  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  if (originalTitle !== null && typeof document !== 'undefined') {
    document.title = originalTitle;
  }
  restoreFavicon();
}

function bindClearListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  const maybeClear = () => {
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      clearAlerts();
    }
  };

  window.addEventListener('focus', maybeClear);
  document.addEventListener('visibilitychange', maybeClear);
}

/**
 * Register the service worker + prime notification permission on first gesture.
 * Call once when a staff dashboard mounts.
 */
export function initDesktopNotifications() {
  if (typeof window === 'undefined') return;

  // Ensure a service worker exists so mobile browsers can show notifications.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) {
          navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
      })
      .catch(() => {});
  }

  bindClearListeners();

  if (
    'Notification' in window &&
    Notification.permission === 'default' &&
    !permissionAsked
  ) {
    const ask = () => {
      permissionAsked = true;
      try {
        const result = Notification.requestPermission();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {
        // ignore
      }
      window.removeEventListener('pointerdown', ask);
      window.removeEventListener('keydown', ask);
      window.removeEventListener('touchstart', ask);
    };
    window.addEventListener('pointerdown', ask, { once: true, passive: true });
    window.addEventListener('keydown', ask, { once: true });
    window.addEventListener('touchstart', ask, { once: true, passive: true });
  }
}

function startTitleFlash() {
  if (typeof document === 'undefined') return;
  if (originalTitle === null) originalTitle = document.title;
  if (titleFlashTimer) return;

  let toggle = false;
  titleFlashTimer = window.setInterval(() => {
    document.title = toggle
      ? originalTitle
      : `\uD83D\uDD14 (${unseen}) New request!`;
    toggle = !toggle;
  }, 1000);
}

function ensureFaviconLink() {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

function drawFavicon(count, img) {
  try {
    const link = ensureFaviconLink();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 64, 64);
    if (img) {
      ctx.drawImage(img, 0, 0, 64, 64);
    } else {
      ctx.fillStyle = '#080a11';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('J', 26, 34);
    }

    ctx.beginPath();
    ctx.arc(46, 18, 17, 0, 2 * Math.PI);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count > 9 ? '9+' : String(count), 46, 19);

    link.href = canvas.toDataURL('image/png');
  } catch {
    // ignore favicon drawing errors
  }
}

function setFaviconBadge(count) {
  if (typeof document === 'undefined') return;
  try {
    const link = ensureFaviconLink();
    if (originalFaviconHref === null) {
      originalFaviconHref = link.getAttribute('href') || '/icon-192.png';
    }

    if (baseFaviconImg) {
      drawFavicon(count, baseFaviconImg);
      return;
    }

    if (originalFaviconHref && !originalFaviconHref.startsWith('data:')) {
      const img = new Image();
      img.onload = () => {
        baseFaviconImg = img;
        drawFavicon(count, img);
      };
      img.onerror = () => drawFavicon(count, null);
      img.src = originalFaviconHref;
    } else {
      drawFavicon(count, null);
    }
  } catch {
    // ignore
  }
}

function restoreFavicon() {
  if (typeof document === 'undefined') return;
  try {
    if (originalFaviconHref !== null) {
      const link = ensureFaviconLink();
      link.href = originalFaviconHref;
    }
  } catch {
    // ignore
  }
}

async function showDesktopNotification(title, body, url) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const targetUrl = url || window.location.pathname;
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'jackpot-staff-alert',
    renotify: true,
    data: { url: targetUrl }
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch {
    // fall through to legacy Notification
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: 'jackpot-staff-alert'
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore
      }
      notification.close();
    };
  } catch {
    // ignore
  }
}

/**
 * Fire all "away" alerts for new staff activity. Only triggers the extra
 * desktop/title/favicon layers when the tab is NOT actively focused, since a
 * visible dashboard already updates live and plays the in-page sound.
 */
export function notifyStaffActivity({ title = 'Jackpot Royals', body = 'New request received', url } = {}) {
  if (typeof window === 'undefined') return;

  const isActive =
    document.visibilityState === 'visible' && document.hasFocus();
  if (isActive) return;

  unseen += 1;
  startTitleFlash();
  setFaviconBadge(unseen);
  showDesktopNotification(title, body, url);
}
