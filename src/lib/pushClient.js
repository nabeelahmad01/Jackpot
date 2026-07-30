function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

let nativeActionListenerReady = false;

function isPortalNative() {
  if (typeof window === 'undefined') return false;
  return /JackpotPortalNative/i.test(navigator.userAgent || '');
}

function isDistributorNative() {
  if (typeof window === 'undefined') return false;
  return /JackpotDistributorNative/i.test(navigator.userAgent || '');
}

function isNativePlatform() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.isNativePlatform?.() === true) return true;
  // Capacitor WebView UA markers (player / staff Portal / distributor APKs).
  return /JackpotRoyalsNative|JackpotPortalNative|JackpotDistributorNative/i.test(
    navigator.userAgent || ''
  );
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice() {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(window.navigator.userAgent || '');
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  if (isNativePlatform()) return true;
  try {
    if (window.navigator.standalone === true) return true;
  } catch {
    /* ignore */
  }
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function supportsWebPush() {
  if (isNativePlatform()) return true;
  // iOS only exposes PushManager after the site is added to the Home Screen
  // and opened from that icon (standalone). Asking earlier always fails.
  if (isIosDevice() && !isStandaloneDisplay()) return false;
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** UI helper: should we show an Enable Lock Screen banner? */
export function getWebPushPromptState() {
  if (typeof window === 'undefined') {
    return { show: false, reason: 'ssr' };
  }
  if (isNativePlatform()) {
    return { show: false, reason: 'native' };
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { show: true, reason: 'ios-needs-homescreen', canEnable: false };
  }
  if (!supportsWebPush()) {
    return { show: false, reason: 'unsupported' };
  }
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  if (permission === 'granted') {
    return { show: false, reason: 'granted', canEnable: false, permission };
  }
  if (permission === 'denied') {
    return { show: true, reason: 'denied', canEnable: false, permission };
  }
  return { show: true, reason: 'prompt', canEnable: true, permission: permission || 'default' };
}

function detectClientKind() {
  if (isNativePlatform()) return 'native';
  if (isIosDevice()) return isStandaloneDisplay() ? 'ios-pwa' : 'ios-browser';
  if (isAndroidDevice()) return isStandaloneDisplay() ? 'android-pwa' : 'android-chrome';
  return 'desktop';
}

export async function getExistingPushSubscription() {
  if (isNativePlatform()) return null;
  if (!supportsWebPush()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function subscribeToNativePush(userEmail, { audience = 'player', distributorId = '' } = {}) {
  // Access the native plugin through the runtime bridge instead of a static
  // import so the web build never hard-depends on @capacitor/push-notifications.
  const Capacitor = typeof window !== 'undefined' ? window.Capacitor : null;
  const PushNotifications = Capacitor?.Plugins?.PushNotifications;
  if (!PushNotifications) {
    throw new Error('Native push is not available on this build.');
  }

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') {
    throw new Error('Notification permission was not allowed.');
  }

  const resolvedAudience = audience === 'distributor' || isDistributorNative()
    ? 'distributor'
    : audience === 'staff' || isPortalNative()
      ? 'staff'
      : 'player';
  const channelId =
    resolvedAudience === 'distributor'
      ? 'jackpot_distributor_alerts'
      : resolvedAudience === 'staff'
        ? 'jackpot_portal_alerts'
        : 'jackpot_promotions';
  const channelName =
    resolvedAudience === 'distributor'
      ? 'Distributor Alerts'
      : resolvedAudience === 'staff'
        ? 'Portal Alerts'
        : 'Promotions';
  const channelDescription =
    resolvedAudience === 'distributor'
      ? 'Jackpot Distributor request alerts'
      : resolvedAudience === 'staff'
        ? 'Jackpot Portal request alerts'
        : 'Jackpot Royals offers and promotions';

  if (Capacitor?.getPlatform?.() === 'android') {
    await PushNotifications.createChannel({
      id: channelId,
      name: channelName,
      description: channelDescription,
      importance: 4,
      visibility: 1,
      vibration: true
    });
  }

  let resolveToken;
  let rejectToken;
  const tokenPromise = new Promise((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });
  const registrationHandle = await PushNotifications.addListener('registration', (result) => {
    resolveToken(result.value);
  });
  const errorHandle = await PushNotifications.addListener('registrationError', () => {
    rejectToken(new Error('This native build is not connected to Firebase/APNs yet.'));
  });
  const timeout = window.setTimeout(
    () => rejectToken(new Error('Push registration timed out.')),
    15000
  );

  let token;
  try {
    await PushNotifications.register();
    token = await tokenPromise;
  } finally {
    window.clearTimeout(timeout);
    await registrationHandle.remove();
    await errorHandle.remove();
  }

  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(userEmail || '').trim().toLowerCase(),
      nativeToken: token,
      platform: Capacitor?.getPlatform?.() || 'android',
      audience: resolvedAudience,
      distributorId: resolvedAudience === 'distributor' ? String(distributorId || '').trim() : '',
      userAgent: navigator.userAgent,
      clientKind: 'native',
      standalone: true
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Could not register this device.');
  }

  if (!nativeActionListenerReady) {
    nativeActionListenerReady = true;
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const fallback =
        resolvedAudience === 'distributor'
          ? '/distributor'
          : resolvedAudience === 'staff'
            ? '/admin'
            : '/lobby';
      const url = notification?.data?.url || fallback;
      window.location.assign(url);
    });
  }

  return { nativeToken: token };
}

async function subscribeToWebPush(userEmail, { audience = 'player', distributorId = '' } = {}) {
  if (isIosDevice() && !isStandaloneDisplay()) {
    throw new Error(
      'On iPhone, tap Share → Add to Home Screen, open Jackpot from that icon, then enable notifications.'
    );
  }
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    throw new Error('Push notifications are not supported on this device.');
  }

  // Ensure SW is controlling this page before PushManager.subscribe (required on iOS PWA).
  let registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    registration = await navigator.serviceWorker.ready;
  } catch (err) {
    throw new Error('Could not start notification service. Close the app and open it again from the Home Screen icon.');
  }

  const keyResponse = await fetch('/api/push-subscriptions', { cache: 'no-store' });
  const keyData = await keyResponse.json();
  if (!keyResponse.ok || !keyData.publicKey) {
    throw new Error(keyData.message || 'Push notifications are not configured yet.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not allowed. Check Settings → Notifications for Jackpot Royals.');
  }

  const appServerKey = urlBase64ToUint8Array(keyData.publicKey);
  let subscription = await registration.pushManager.getSubscription();

  // iOS is fragile if we unsubscribe every time — reuse a valid subscription.
  // Chrome/Android: refresh subscription when missing only; recreate on subscribe failure.
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey
    });
  }

  const resolvedAudience =
    audience === 'distributor' ? 'distributor' : audience === 'staff' ? 'staff' : 'player';

  const postBody = {
    email: String(userEmail || '').trim().toLowerCase(),
    subscription: subscription.toJSON(),
    audience: resolvedAudience,
    distributorId: resolvedAudience === 'distributor' ? String(distributorId || '').trim() : '',
    userAgent: navigator.userAgent,
    clientKind: detectClientKind(),
    standalone: isStandaloneDisplay()
  };

  let response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody)
  });
  let data = await response.json();

  // Stale VAPID / dead endpoint — recreate once (skip aggressive unsubscribe-first on iOS).
  if (!response.ok || !data.success) {
    try {
      await subscription.unsubscribe();
    } catch {
      /* ignore */
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey
    });
    postBody.subscription = subscription.toJSON();
    response = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });
    data = await response.json();
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Could not enable notifications.');
  }

  // Confirm lock-screen path works (local smoke test — does not use remote push).
  try {
    if (registration.showNotification) {
      await registration.showNotification('Jackpot Royals', {
        body: 'Lock screen notifications are on. You will get offers here.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'jr-push-enabled',
        data: { url: '/lobby' }
      });
    }
  } catch {
    /* some iOS builds only allow remote push display */
  }

  return subscription;
}

export async function subscribeToPromoPush(userEmail) {
  if (isNativePlatform()) {
    try {
      const audience = isDistributorNative()
        ? 'distributor'
        : isPortalNative()
          ? 'staff'
          : 'player';
      return await subscribeToNativePush(userEmail, { audience });
    } catch (error) {
      const message = String(error?.message || '');
      // Permission denied should not silently fall back.
      if (/permission was not allowed/i.test(message)) throw error;
      // Until Firebase is on the APK, use Web Push inside the WebView.
    }
  }

  return subscribeToWebPush(userEmail, { audience: 'player' });
}

/** Jackpot Portal (admin/staff) — lock-screen alerts for new requests. */
export async function subscribeToStaffPush(userEmail) {
  if (isNativePlatform()) {
    try {
      return await subscribeToNativePush(userEmail, { audience: 'staff' });
    } catch (error) {
      const message = String(error?.message || '');
      if (/permission was not allowed/i.test(message)) throw error;
    }
  }
  return subscribeToWebPush(userEmail, { audience: 'staff' });
}

/** Jackpot Distributor APK — lock-screen alerts for that distributor's requests. */
export async function subscribeToDistributorPush(userEmail, distributorId) {
  if (isNativePlatform()) {
    try {
      return await subscribeToNativePush(userEmail, {
        audience: 'distributor',
        distributorId
      });
    } catch (error) {
      const message = String(error?.message || '');
      if (/permission was not allowed/i.test(message)) throw error;
    }
  }
  return subscribeToWebPush(userEmail, {
    audience: 'distributor',
    distributorId
  });
}

export async function unsubscribeFromPromoPush(userEmail) {
  if (isNativePlatform()) return;
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  await fetch('/api/push-subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(userEmail || '').trim().toLowerCase(),
      endpoint: subscription.endpoint
    })
  });
  await subscription.unsubscribe();
}
