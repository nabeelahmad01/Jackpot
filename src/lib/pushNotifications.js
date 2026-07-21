import webpush from 'web-push';
import { createPrivateKey } from 'crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@jackpotroyals.com';

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function normalizeServiceAccount(sa) {
  if (sa && typeof sa.private_key === 'string') {
    // Node/OpenSSL 3 rejects keys whose newlines are still escaped as "\n".
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  return sa;
}

function serviceAccountHasValidKey(sa) {
  const key = sa?.private_key || sa?.privateKey;
  if (!key) return true; // individual-var form is validated by cert() later
  try {
    createPrivateKey(key);
    return true;
  } catch {
    return false;
  }
}

function getFirebaseMessaging() {
  if (getApps().length > 0) return getMessaging(getApps()[0]);

  // Collect every configured credential source, then pick the FIRST one whose
  // private key actually parses. This protects us when e.g. the base64 env var
  // got corrupted on paste but the plain JSON var is still good.
  const candidates = [];

  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      candidates.push(normalizeServiceAccount(JSON.parse(decoded)));
    } catch (error) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_B64:', error.message);
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      candidates.push(normalizeServiceAccount(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)));
    } catch (error) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error.message);
    }
  }
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    candidates.push({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
  }

  if (candidates.length === 0) return null;
  const serviceAccount = candidates.find(serviceAccountHasValidKey) || candidates[0];

  const app = initializeApp({ credential: cert(serviceAccount) });
  return getMessaging(app);
}

export async function sendPromotionPush(db, promotion, targetEmails) {
  if (!Array.isArray(targetEmails) || targetEmails.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const normalizedEmails = [...new Set(
    targetEmails.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)
  )];
  const subscriptions = await db.collection('pushSubscriptions')
    .find({ userEmail: { $in: normalizedEmails } })
    .toArray();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, skipped: false };
  }
  const webSubscriptions = subscriptions.filter(
    (record) => record.type !== 'native' && record.subscription
  );
  const nativeSubscriptions = subscriptions.filter(
    (record) => record.type === 'native' && record.nativeToken
  );

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://jackpotroyals.com')
    .replace(/\/$/, '');
  const remoteImage = /^https?:\/\//i.test(promotion.image || '') ? promotion.image : undefined;
  const payload = JSON.stringify({
    title: promotion.title || 'Jackpot Royals',
    body: promotion.message || 'A new offer is available.',
    icon: `${siteUrl}/icon-192.png`,
    badge: `${siteUrl}/icon-192.png`,
    image: remoteImage,
    tag: `promotion-${promotion.id}`,
    promotionId: promotion.id,
    url: `/lobby?promotion=${encodeURIComponent(promotion.id)}`
  });

  let sent = 0;
  let failed = 0;
  const expiredEndpoints = [];

  if (configureWebPush()) {
    for (let index = 0; index < webSubscriptions.length; index += 100) {
      const batch = webSubscriptions.slice(index, index + 100);
      const results = await Promise.allSettled(
        batch.map((record) => webpush.sendNotification(record.subscription, payload))
      );

      results.forEach((result, resultIndex) => {
        if (result.status === 'fulfilled') {
          sent += 1;
          return;
        }

        failed += 1;
        const statusCode = result.reason?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(batch[resultIndex].endpoint);
        }
        console.error('Promotion web push delivery failed:', statusCode || result.reason?.message);
      });
    }
  }

  const messaging = getFirebaseMessaging();
  if (messaging) {
    for (let index = 0; index < nativeSubscriptions.length; index += 500) {
      const batch = nativeSubscriptions.slice(index, index + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((record) => record.nativeToken),
        notification: {
          title: promotion.title || 'Jackpot Royals',
          body: promotion.message || 'A new offer is available.',
          ...(remoteImage ? { imageUrl: remoteImage } : {})
        },
        data: {
          url: `/lobby?promotion=${encodeURIComponent(promotion.id)}`,
          promotionId: String(promotion.id)
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'jackpot_promotions',
            sound: 'default'
          }
        }
      });

      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((result, resultIndex) => {
        const code = result.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          expiredEndpoints.push(batch[resultIndex].endpoint);
        }
      });
    }
  }

  if (expiredEndpoints.length > 0) {
    await db.collection('pushSubscriptions').deleteMany({
      endpoint: { $in: expiredEndpoints }
    });
  }

  return { sent, failed, skipped: false };
}

const STAFF_PUSH_ROLES = [
  'admin',
  'financial_admin',
  'coins_admin',
  'support_admin',
  'operation_admin'
];

/**
 * Lock-screen / native alerts for the Jackpot Portal (admin + staff) APK.
 * Only devices registered with audience: 'staff' receive these — the player APK
 * subscriptions are never touched.
 */
export async function sendStaffPush(db, { title, body, url = '/admin', tag = 'staff-alert' } = {}) {
  try {
    const subscriptions = await db.collection('pushSubscriptions')
      .find({ audience: 'staff' })
      .toArray();

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, skipped: true };
    }

    const webSubscriptions = subscriptions.filter(
      (record) => record.type !== 'native' && record.subscription
    );
    const nativeSubscriptions = subscriptions.filter(
      (record) => record.type === 'native' && record.nativeToken
    );

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://jackpotroyals.com')
      .replace(/\/$/, '');
    const safeTitle = String(title || 'Jackpot Portal').slice(0, 80);
    const safeBody = String(body || 'New request waiting in the portal.').slice(0, 180);
    const safeUrl = String(url || '/admin');
    const payload = JSON.stringify({
      title: safeTitle,
      body: safeBody,
      icon: `${siteUrl}/icon-192.png`,
      badge: `${siteUrl}/icon-192.png`,
      tag,
      url: safeUrl
    });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints = [];

    if (configureWebPush()) {
      for (const record of webSubscriptions) {
        try {
          await webpush.sendNotification(record.subscription, payload);
          sent += 1;
        } catch (error) {
          failed += 1;
          const statusCode = error?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            expiredEndpoints.push(record.endpoint);
          }
        }
      }
    }

    const messaging = getFirebaseMessaging();
    if (messaging && nativeSubscriptions.length > 0) {
      for (let index = 0; index < nativeSubscriptions.length; index += 500) {
        const batch = nativeSubscriptions.slice(index, index + 500);
        const response = await messaging.sendEachForMulticast({
          tokens: batch.map((record) => record.nativeToken),
          notification: {
            title: safeTitle,
            body: safeBody
          },
          data: {
            url: safeUrl,
            tag: String(tag)
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'jackpot_portal_alerts',
              sound: 'default'
            }
          }
        });

        sent += response.successCount;
        failed += response.failureCount;
        response.responses.forEach((result, resultIndex) => {
          const code = result.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            expiredEndpoints.push(batch[resultIndex].endpoint);
          }
        });
      }
    }

    if (expiredEndpoints.length > 0) {
      await db.collection('pushSubscriptions').deleteMany({
        endpoint: { $in: expiredEndpoints }
      });
    }

    return { sent, failed, skipped: false };
  } catch (error) {
    console.error('Staff push error:', error);
    return { sent: 0, failed: 0, skipped: true, error: error.message };
  }
}

export function isStaffRole(role) {
  const roles = String(role || '')
    .toLowerCase()
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return roles.some((r) => STAFF_PUSH_ROLES.includes(r));
}

/** Fire-and-forget helper so API handlers never block on push delivery. */
export function notifyStaffAsync(db, alert) {
  Promise.resolve()
    .then(() => sendStaffPush(db, alert))
    .catch((err) => console.error('notifyStaffAsync failed:', err));
}
