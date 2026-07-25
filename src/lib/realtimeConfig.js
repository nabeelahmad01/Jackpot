/**
 * Realtime transport for admin panels.
 *
 * Hostinger Business / shared hosting: SSE long-lived streams are unreliable.
 * Default = polling + push only. On VPS you can enable SSE with:
 *   NEXT_PUBLIC_ENABLE_SSE=true
 */
export function isSseEnabled() {
  const raw = String(process.env.NEXT_PUBLIC_ENABLE_SSE || '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  return false;
}
