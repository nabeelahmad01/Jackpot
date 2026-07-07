const rateLimitStore = new Map();

/**
 * Basic in-memory rate limiter helper for serverless/development environments
 * @param {string} ip Client IP address
 * @param {number} limit Max requests allowed in the window
 * @param {number} windowMs Time window in milliseconds
 * @returns {boolean} True if within limit, false if rate limited
 */
export function checkRateLimit(ip, limit = 100, windowMs = 60000) {
  const now = Date.now();
  const clientData = rateLimitStore.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
  } else {
    clientData.count++;
  }

  rateLimitStore.set(ip, clientData);
  return clientData.count <= limit;
}
