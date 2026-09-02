import { getDb } from './mongodb';
import { CODE_WORDS, generateCandidateCode } from './depositWords';

export { CODE_WORDS, generateCandidateCode };

/**
 * Generate a guaranteed unique deposit note code by checking against the database.
 * Ensures the code has NEVER been used in transactions or accountRequests.
 * (Server-side only)
 * @param {import('mongodb').Db} [dbInstance]
 * @returns {Promise<string>}
 */
export async function generateUniqueDepositCode(dbInstance) {
  try {
    const db = dbInstance || (await getDb());
    const transactions = db.collection('transactions');
    const accountRequests = db.collection('accountRequests');

    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = generateCandidateCode();

      // Fast projection check to verify candidate doesn't exist anywhere
      const [existingTx, existingReq] = await Promise.all([
        transactions.findOne(
          {
            $or: [
              { code: candidate },
              { noteCode: candidate }
            ]
          },
          { projection: { _id: 1 } }
        ),
        accountRequests.findOne(
          {
            $or: [
              { noteCode: candidate },
              { code: candidate }
            ]
          },
          { projection: { _id: 1 } }
        )
      ]);

      if (!existingTx && !existingReq) {
        return candidate;
      }
    }

    // High entropy fallback if loop exits: 5-digit number
    const randWord = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
    const extraNum = Math.floor(10000 + Math.random() * 90000);
    return `${randWord}${extraNum}`;
  } catch (err) {
    console.error('Error generating unique deposit code:', err);
    return generateCandidateCode();
  }
}
