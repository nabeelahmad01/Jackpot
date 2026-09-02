import { CODE_WORDS, generateCandidateCode } from './depositCodeGenerator';

const STORAGE_KEY = 'jackpot_pending_deposit';
export const DEPOSIT_CODE_TTL_MS = 10 * 60 * 1000;

export { CODE_WORDS };

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normTitle(title) {
  return String(title || '').trim().toLowerCase();
}

/** @returns {null | { userEmail: string, gameTitle: string, amount: number, gateway: object, noteCode: string, expiresAt: number }} */
export function readPendingDeposit(userEmail) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.noteCode || !data?.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() >= Number(data.expiresAt)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (userEmail && data.userEmail && data.userEmail !== normEmail(userEmail)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writePendingDeposit(payload) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        userEmail: normEmail(payload.userEmail),
        gameTitle: payload.gameTitle,
        amount: payload.amount,
        gateway: payload.gateway,
        noteCode: payload.noteCode,
        expiresAt: payload.expiresAt
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearPendingDeposit() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function pendingMatchesGame(pending, gameTitle) {
  if (!pending) return false;
  return normTitle(pending.gameTitle) === normTitle(gameTitle);
}

/**
 * Generate high-entropy deposit note code
 */
export function generateDepositNoteCode() {
  return generateCandidateCode();
}

/**
 * Fetch a guaranteed unique deposit note code from server, with high-entropy fallback
 */
export async function fetchUniqueDepositNoteCode() {
  try {
    const res = await fetch('/api/deposit-code', { cache: 'no-store' });
    const data = await res.json();
    if (data?.success && data?.noteCode) {
      return data.noteCode;
    }
  } catch (err) {
    console.warn('Could not fetch deposit code from server, falling back to local generator:', err);
  }
  return generateDepositNoteCode();
}

export function remainingSeconds(expiresAt) {
  return Math.max(0, Math.ceil((Number(expiresAt) - Date.now()) / 1000));
}
