/**
 * Resolve live in-game usernames for admin/distributor ledgers.
 * Prefer READY account-request credentials, then the gameAccounts row that
 * matches that request's game title casing — never a stale casing duplicate
 * (e.g. "Vegas x" vs "VEGAS X").
 */

export function gameTitleKey(title) {
  return String(title || '').toLowerCase().trim();
}

export function accountLookupKey(email, title) {
  return `${String(email || '').toLowerCase().trim()}_${gameTitleKey(title)}`;
}

/**
 * @param {import('mongodb').Db} db
 * @param {string[]} emails
 * @param {{ dedupe?: boolean }} [options]
 * @returns {Promise<Record<string, string>>} map of email_gametitleLower -> username
 */
export async function buildGameUsernameMap(db, emails, options = {}) {
  const { dedupe = false } = options;
  const cleanEmails = Array.from(
    new Set((emails || []).map((e) => String(e || '').toLowerCase().trim()).filter(Boolean))
  );
  if (cleanEmails.length === 0) return {};

  const [accounts, requests] = await Promise.all([
    db.collection('gameAccounts')
      .find({ userEmail: { $in: cleanEmails } })
      .project({ userEmail: 1, gameTitle: 1, username: 1, _id: 1 })
      .toArray(),
    db
      .collection('accountRequests')
      .find({
        userEmail: { $in: cleanEmails },
        status: { $in: ['READY', 'COMPLETED'] }
      })
      .project({
        userEmail: 1,
        gameTitle: 1,
        gameAccountUsername: 1,
        id: 1,
        createdAt: 1
      })
      .toArray()
  ]);

  // Latest READY request per email+game (by id / createdAt)
  const fromRequest = {};
  const requestTitle = {};
  [...requests]
    .sort((a, b) => {
      const idCmp = String(b.id || '').localeCompare(String(a.id || ''));
      if (idCmp) return idCmp;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    })
    .forEach((r) => {
      const key = accountLookupKey(r.userEmail, r.gameTitle);
      if (!requestTitle[key] && r.gameTitle) {
        requestTitle[key] = String(r.gameTitle).trim();
      }
      const uname = String(r.gameAccountUsername || '').trim();
      if (uname && !fromRequest[key]) {
        fromRequest[key] = uname;
      }
    });

  const byKey = {};
  accounts.forEach((a) => {
    const key = accountLookupKey(a.userEmail, a.gameTitle);
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(a);
  });

  const map = {};
  const deleteIds = [];
  const fixOps = [];

  for (const [key, list] of Object.entries(byKey)) {
    const preferredName = fromRequest[key] || '';
    const preferredTitle = requestTitle[key] || '';

    let winner = null;
    if (preferredName) {
      winner = list.find((a) => String(a.username || '').trim() === preferredName) || null;
    }
    if (!winner && preferredTitle) {
      winner = list.find((a) => a.gameTitle === preferredTitle) || null;
    }
    if (!winner) {
      winner = [...list].sort((a, b) => String(b._id || '').localeCompare(String(a._id || '')))[0];
    }

    if (!winner) continue;

    const finalUsername = preferredName || String(winner.username || '').trim();
    map[key] = finalUsername;

    if (dedupe) {
      list.forEach((a) => {
        if (String(a._id) !== String(winner._id)) deleteIds.push(a._id);
      });
      const setFields = {};
      if (preferredName && String(winner.username || '').trim() !== preferredName) {
        setFields.username = preferredName;
      }
      if (preferredTitle && winner.gameTitle !== preferredTitle) {
        setFields.gameTitle = preferredTitle;
      }
      if (Object.keys(setFields).length > 0) {
        fixOps.push({ _id: winner._id, setFields });
      }
    }
  }

  // Request-only (credentials on request but account row missing)
  Object.keys(fromRequest).forEach((key) => {
    if (!map[key]) map[key] = fromRequest[key];
  });

  if (dedupe) {
    const ops = [];
    if (deleteIds.length > 0) {
      ops.push(db.collection('gameAccounts').deleteMany({ _id: { $in: deleteIds } }));
    }
    fixOps.forEach(({ _id, setFields }) => {
      ops.push(db.collection('gameAccounts').updateOne({ _id }, { $set: setFields }));
    });
    if (ops.length > 0) await Promise.all(ops);
  }

  return map;
}
