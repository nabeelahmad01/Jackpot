function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

let nativeActionListenerReady = false;

function isNativePlatform() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.isNativePlatform?.() === true) return true;
  // Capacitor WebView UA marker from MainActivity when bridge is slow to load
  return /JackpotRoyalsNative/i.test(navigator.userAgent || '');
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

async function subscribeToNativePush(userEmail) {
  // Access the native plugin through the runtime bridge instead of a static
  // import so the web build never hard-depends on @capacitor/push-notifications.
  // When the APK is built without Firebase, this plugin is absent and we throw,
  // which triggers the Web Push fallback below.
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

  if (Capacitor?.getPlatform?.() === 'android') {
    await PushNotifications.createChannel({
      id: 'jackpot_promotions',
      name: 'Promotions',
      description: 'Jackpot Royals offers and promotions',
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
      const url = notification?.data?.url || '/lobby';
      window.location.assign(url);
    });
  }

  return { nativeToken: token };
}

async function subscribeToWebPush(userEmail) {
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

  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(userEmail || '').trim().toLowerCase(),
      subscription: subscription.toJSON(),
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
      return await subscribeToNativePush(userEmail);
    } catch (error) {
      const message = String(error?.message || '');
      // Permission denied should not silently fall back.
      if (/permission was not allowed/i.test(message)) throw error;
      // Until Firebase is on the APK, use Web Push inside the WebView.
    }
  }

  return subscribeToWebPush(userEmail);
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
