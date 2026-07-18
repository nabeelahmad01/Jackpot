import webpush from 'web-push';
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

function getFirebaseMessaging() {
  if (getApps().length > 0) return getMessaging(getApps()[0]);

  let serviceAccount;
  // Preferred on hosting panels: base64 of the whole JSON. A single line with no
  // quotes/newlines, so it can never get mangled when pasted into an env var box.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } catch (error) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_B64:', error.message);
      return null;
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', error.message);
      return null;
    }
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  } else {
    return null;
  }

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
