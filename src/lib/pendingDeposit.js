const STORAGE_KEY = 'jackpot_pending_deposit';
export const DEPOSIT_CODE_TTL_MS = 10 * 60 * 1000;

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

const CODE_WORDS = [
  'Book', 'Car', 'Rocky', 'Apple', 'Tiger', 'Lion', 'Sky', 'Tree', 'Star',
  'Moon', 'Sun', 'River', 'Bird', 'Fish', 'Ring', 'King', 'Queen', 'Royal',
  'Club', 'Jack', 'Gold', 'Card', 'Play', 'Game', 'Win', 'Luck', 'Cash',
  'Ace', 'Diamond', 'Heart', 'Spade', 'Crown', 'Ruby', 'Pearl', 'Coin'
];

export function generateDepositNoteCode() {
  const randWord = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const randNum = Math.floor(100 + Math.random() * 900);
  return `${randWord}${randNum}`;
}

export function remainingSeconds(expiresAt) {
  return Math.max(0, Math.ceil((Number(expiresAt) - Date.now()) / 1000));
}
