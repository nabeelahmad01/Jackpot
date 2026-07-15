export function parseAffiliatePayoutFields(tx) {
  const note = tx?.note || '';
  let method = tx?.gateway || '';
  let account = tx?.code || '';

  if (!method || method === '—') {
    const methodMatch = note.match(/Cashout\s*-\s*[^-]+-\s*(.+?)\s*-\s*Acc:/i);
    if (methodMatch) method = methodMatch[1].trim();
  }

  if (!account || String(account).startsWith('AGENT-COMM-')) {
    const accMatch = note.match(/Acc:\s*(.+)$/i);
    if (accMatch) account = accMatch[1].trim();
    else {
      const cryptoMatch = note.match(/(TRC20|BEP20|ERC20):\s*(\S+)/i);
      if (cryptoMatch) account = cryptoMatch[2];
    }
  }

  if (method.includes('TRC20') || method.includes('BEP20')) {
    method = method.includes('BEP20') ? 'USDT (BEP20)' : 'USDT (TRC20)';
  }

  return {
    method: method || '—',
    account: account || '—',
    holder: tx?.nameOnTag || '—',
    qr: tx?.payoutQr || ''
  };
}
