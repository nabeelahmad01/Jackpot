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

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    isNativePlatform()
  );
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
      userAgent: navigator.userAgent
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
      'On iPhone, open Jackpot Royals from the Home Screen icon first, then enable notifications.'
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

  const keyResponse = await fetch('/api/push-subscriptions', { cache: 'no-store' });
  const keyData = await keyResponse.json();
  if (!keyResponse.ok || !keyData.publicKey) {
    throw new Error(keyData.message || 'Push notifications are not configured yet.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not allowed.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
    });
  }

  const resolvedAudience =
    audience === 'distributor' ? 'distributor' : audience === 'staff' ? 'staff' : 'player';

  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(userEmail || '').trim().toLowerCase(),
      subscription: subscription.toJSON(),
      audience: resolvedAudience,
      distributorId: resolvedAudience === 'distributor' ? String(distributorId || '').trim() : '',
      userAgent: navigator.userAgent
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Could not enable notifications.');
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
