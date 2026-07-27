/**
 * Client-side Meta Pixel helpers. Safe no-ops when fbq is not loaded.
 */

export function trackMetaEvent(eventName, params = {}, options = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
  try {
    if (options.eventID) {
      window.fbq('track', eventName, params, { eventID: options.eventID });
    } else {
      window.fbq('track', eventName, params);
    }
  } catch {
    /* ignore pixel errors */
  }
}

export function trackCompleteRegistration(method = 'email') {
  trackMetaEvent('CompleteRegistration', {
    content_name: 'signup',
    status: true,
    method
  });
}

/** Fired when player opens/confirms deposit checkout (funnel). */
export function trackInitiateCheckout({ value, currency = 'USD' } = {}) {
  const amount = Number(value);
  const params = { currency, content_name: 'deposit', content_category: 'deposit' };
  if (Number.isFinite(amount) && amount > 0) params.value = amount;
  trackMetaEvent('InitiateCheckout', params);
}

/**
 * Fired when deposit request is accepted by the API (player submitted "I HAVE PAID").
 * Uses Purchase so Meta can optimize for deposit value.
 */
export function trackDepositPurchase({ value, currency = 'USD', transactionId } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  trackMetaEvent(
    'Purchase',
    {
      value: amount,
      currency,
      content_name: 'deposit',
      content_category: 'deposit',
      content_type: 'product'
    },
    transactionId ? { eventID: `deposit_${transactionId}` } : {}
  );
}
