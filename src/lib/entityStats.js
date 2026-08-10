import { calcCommissionFromProfit, calcNetProfit } from './commission';

function buildEmailTotals(txRows) {
  const map = {};
  for (const row of txRows) {
    const email = (row._id?.email || row._id || '').toLowerCase().trim();
    const type = row._id?.type;
    if (!email || !type) continue;
    if (!map[email]) map[email] = { deposits: 0, withdrawals: 0 };
    if (type === 'DEPOSIT') map[email].deposits += row.total || 0;
    if (type === 'WITHDRAW') map[email].withdrawals += row.total || 0;
  }
  return map;
}

async function aggregateTxByEmails(db, emails) {
  if (!emails.length) return [];
  return db.collection('transactions').aggregate([
    {
      $match: {
        userEmail: { $in: emails },
        status: 'SUCCESS',
        type: { $in: ['DEPOSIT', 'WITHDRAW'] },
        isDepositFromCashout: { $ne: true }
      }
    },
    {
      $group: {
        _id: { email: { $toLower: '$userEmail' }, type: '$type' },
        total: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'WITHDRAW'] },
              { $toDouble: { $ifNull: ['$payoutSent', { $ifNull: ['$amount', 0] }] } },
              { $toDouble: { $ifNull: ['$amount', 0] } }
            ]
          }
        }
      }
    }
  ]).toArray();
}

function sumEntityFromEmails(emailList, emailTotals) {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const email of emailList) {
    const stats = emailTotals[email];
    if (!stats) continue;
    totalDeposits += stats.deposits;
    totalWithdrawals += stats.withdrawals;
  }
  return { totalDeposits, totalWithdrawals };
}

export async function enrichDistributorsWithStats(db, distributors) {
  const distIds = distributors.map((d) => d.id).filter(Boolean);
  if (!distIds.length) return distributors;

  const playerGroups = await db.collection('users').aggregate([
    { $match: { role: 'user', distributorId: { $in: distIds } } },
    {
      $group: {
        _id: '$distributorId',
        count: { $sum: 1 },
        emails: { $push: { $toLower: '$email' } }
      }
    }
  ]).toArray();

  const playersByDist = {};
  const allEmails = [];
  for (const group of playerGroups) {
    const emails = (group.emails || []).map((e) => e.toLowerCase().trim()).filter(Boolean);
    playersByDist[group._id] = { count: group.count || 0, emails };
    allEmails.push(...emails);
  }

  const uniqueEmails = [...new Set(allEmails)];
  const txRows = await aggregateTxByEmails(db, uniqueEmails);
  const emailTotals = buildEmailTotals(txRows);

  return distributors.map((dist) => {
    const players = playersByDist[dist.id] || { count: 0, emails: [] };
    const { totalDeposits, totalWithdrawals } = sumEntityFromEmails(players.emails, emailTotals);
    const netProfit = calcNetProfit(totalDeposits, totalWithdrawals);
    return {
      ...dist,
      playersCount: players.count,
      totalDeposits,
      totalWithdrawals,
      netProfit,
      commissionEarned: calcCommissionFromProfit(totalDeposits, totalWithdrawals, dist.commissionRate),
      websiteCommissionEarned: calcCommissionFromProfit(totalDeposits, totalWithdrawals, dist.websiteCommissionRate)
    };
  });
}

export async function enrichAgentsWithStats(db, agents) {
  if (!agents.length) return agents;

  const agentCodeMap = {};
  const teamCountMap = {};
  for (const agent of agents) {
    agentCodeMap[agent.agentCode] = agent;
    const parent = (agent.parentAgentCode || '').toUpperCase();
    if (parent) teamCountMap[parent] = (teamCountMap[parent] || 0) + 1;
  }

  const agentCodes = agents.map((a) => a.agentCode).filter(Boolean);
  const playerGroups = await db.collection('users').aggregate([
    { $match: { role: 'user', agentCode: { $in: agentCodes } } },
    {
      $group: {
        _id: '$agentCode',
        count: { $sum: 1 },
        emails: { $push: { $toLower: '$email' } }
      }
    }
  ]).toArray();

  const playersByCode = {};
  const allEmails = [];
  for (const group of playerGroups) {
    const emails = (group.emails || []).map((e) => e.toLowerCase().trim()).filter(Boolean);
    playersByCode[group._id] = { count: group.count || 0, emails };
    allEmails.push(...emails);
  }

  const uniqueEmails = [...new Set(allEmails)];
  const agentEmails = agents.map((a) => a.email.toLowerCase().trim()).filter(Boolean);

  const [txRows, withdrawRows] = await Promise.all([
    aggregateTxByEmails(db, uniqueEmails),
    agentEmails.length
      ? db.collection('transactions').aggregate([
          {
            $match: {
              userEmail: { $in: agentEmails },
              type: 'AFFILIATE_COMMISSION_WITHDRAW',
              status: { $in: ['SUCCESS', 'PENDING'] }
            }
          },
          {
            $group: {
              _id: { $toLower: '$userEmail' },
              total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } }
            }
          }
        ]).toArray()
      : Promise.resolve([])
  ]);

  const emailTotals = buildEmailTotals(txRows);
  const withdrawnByEmail = {};
  for (const row of withdrawRows) {
    withdrawnByEmail[row._id] = row.total || 0;
  }

  return agents.map((agent) => {
    const players = playersByCode[agent.agentCode] || { count: 0, emails: [] };
    const { totalDeposits, totalWithdrawals } = sumEntityFromEmails(players.emails, emailTotals);
    const netProfit = calcNetProfit(totalDeposits, totalWithdrawals);
    const commissionEarned = calcCommissionFromProfit(totalDeposits, totalWithdrawals, agent.commissionRate);
    const totalWithdrawn = withdrawnByEmail[agent.email.toLowerCase().trim()] || 0;
    const parentAgent = agent.parentAgentCode ? agentCodeMap[agent.parentAgentCode] : null;

    return {
      ...agent,
      accountType: agent.accountType || (agent.agentCode?.startsWith('SUB') ? 'sub-distributor' : 'agent'),
      role: agent.role || (agent.agentCode?.startsWith('SUB') ? 'Sub-Distributor' : 'Agent'),
      status: agent.status || 'ACTIVE',
      playersCount: players.count,
      teamMembersCount: teamCountMap[(agent.agentCode || '').toUpperCase()] || 0,
      parentAgentName: parentAgent ? parentAgent.name : '—',
      totalDeposits,
      totalWithdrawals,
      netProfit,
      commissionEarned,
      totalWithdrawn,
      availableBalance: Math.max(0, commissionEarned - totalWithdrawn)
    };
  });
}
