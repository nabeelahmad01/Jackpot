'use client';

import React, { useState, useEffect } from 'react';
import usePollingSWR from '../../hooks/usePollingSWR';
import { POLL } from '../../lib/pollingConfig';
import { formatDeviceDateTime } from '../../lib/formatDateTime';

export default function TxSearchTab({ onInspectProof, adminUser }) {
  const [historySearch, setHistorySearch] = useState('');
  const [historyDebouncedSearch, setHistoryDebouncedSearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState(''); // '' (All), 'SUCCESS', 'FAILED', 'HOLD'
  const [historyType, setHistoryType] = useState(''); // '' (All), 'DEPOSIT', 'WITHDRAW', 'BONUS'
  const [historyPage, setHistoryPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const handler = setTimeout(() => {
      setHistoryDebouncedSearch(historySearch);
      setHistoryPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [historySearch]);

  const swrKey = `/api/transactions?page=${historyPage}&limit=${limit}&search=${encodeURIComponent(historyDebouncedSearch)}&status=${historyStatus}&type=${historyType}&adminRole=${adminUser?.role || ''}&adminDistributorId=${adminUser?.distributorId || ''}`;

  const { data, error, mutate } = usePollingSWR(swrKey, POLL.LISTS);

  const transactions = data?.transactions || [];
  const totalTransactions = data?.totalTransactions || 0;
  const totalPages = data?.totalPages || 1;

  const handleHistoryPrevPage = () => {
    if (historyPage > 1) setHistoryPage(historyPage - 1);
  };

  const handleHistoryNextPage = () => {
    if (historyPage < totalPages) setHistoryPage(historyPage + 1);
  };

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ marginBottom: '1rem' }}>
        <h3><i className="fa-solid fa-clock-rotate-left gold-text"></i> Transaction Logs Search</h3>
        <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
          Review full ledger transaction history, query player emails, usernames, and audit processing staff actions.
        </p>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', padding: '1rem', background: '#0b0d16', borderRadius: '8px' }}>
        <div className="input-wrapper search-wrapper" style={{ flex: 1, minWidth: '240px', background: '#07090f', margin: 0 }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search by player email, gateway or username..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', width: 'auto' }}>
          <select
            value={historyStatus}
            onChange={(e) => { setHistoryStatus(e.target.value); setHistoryPage(1); }}
            style={{
              background: '#07090f',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '0.5rem',
              borderRadius: '6px',
              fontSize: '0.725rem',
              cursor: 'pointer'
            }}
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="PENDING">PENDING</option>
            <option value="PENDING_COINS">VERIFYING COINS</option>
            <option value="FAILED">FAILED</option>
            <option value="HOLD">HOLD</option>
          </select>

          <select
            value={historyType}
            onChange={(e) => { setHistoryType(e.target.value); setHistoryPage(1); }}
            style={{
              background: '#07090f',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '0.5rem',
              borderRadius: '6px',
              fontSize: '0.725rem',
              cursor: 'pointer'
            }}
          >
            <option value="">All Types</option>
            <option value="DEPOSIT">DEPOSIT</option>
            <option value="WITHDRAW">WITHDRAW</option>
            <option value="BONUS">BONUS / ADJUSTMENT</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User Email</th>
              <th>Game Title</th>
              <th>Tx Type</th>
              <th>Amount</th>
              <th>Gateway Details / Notes</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Screenshot</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No matching transaction logs found.
                </td>
              </tr>
            ) : (
              transactions.map((tx, idx) => (
                <tr key={tx.id}>
                  <td>{(historyPage - 1) * limit + idx + 1}</td>
                  <td>
                    <div>{tx.userEmail}</div>
                    {tx.gameUsername && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>
                        <i className="fa-solid fa-gamepad" style={{ marginRight: '3px' }}></i> {tx.gameUsername}
                      </div>
                    )}
                  </td>
                  <td><strong>{tx.gameTitle || 'Lobby'}</strong></td>
                  <td>
                    <span className={`admin-badge-preview b-${tx.isFreeplayWithdraw ? 'vip' : (tx.type === 'DEPOSIT' ? 'hot' : tx.type === 'WITHDRAW' ? 'new' : 'ready')}`}>
                      {tx.isFreeplayWithdraw ? 'FREEPLAY' : tx.type}
                    </span>
                  </td>
                  <td><strong>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                  <td>
                    <span style={{ fontSize: '0.725rem', opacity: 0.9 }}>
                      {tx.gateway || '—'} {tx.code ? `(${tx.code})` : ''}
                    </span>
                    {tx.note && <p style={{ fontSize: '0.675rem', color: '#ffb703', margin: '0.2rem 0 0 0' }}>{tx.note}</p>}
                    
                    {/* Action Logger details */}
                    {tx.approvedBy && (
                      <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <i className="fa-solid fa-user-shield text-blue" style={{ fontSize: '0.65rem' }}></i>
                        <span>Approved By:</span>
                        <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{tx.approvedBy}</span>
                      </div>
                    )}
                    {tx.allottedBy && (
                      <div style={{ fontSize: '0.65rem', marginTop: '0.15rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <i className="fa-solid fa-circle-dollar-to-slot text-green" style={{ fontSize: '0.65rem' }}></i>
                        <span>Coins Allotted By:</span>
                        <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{tx.allottedBy}</span>
                      </div>
                    )}
                    {tx.payoutSent !== undefined && (
                      <div style={{ fontSize: '0.675rem', marginTop: '0.25rem', color: '#10b981', fontWeight: 'bold' }}>
                        <i className="fa-solid fa-circle-check"></i> Paid: ${parseFloat(tx.payoutSent).toFixed(2)}
                        {tx.payoutHold > 0 && <span style={{ color: '#f59e0b' }}> • Hold: ${parseFloat(tx.payoutHold).toFixed(2)}</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.7rem' }}>{formatDeviceDateTime(tx.createdAt, tx.date)}</td>
                  <td>
                    <span className={`admin-badge-preview b-${(tx.status === 'PENDING_COINS' || tx.status === 'COINS_LOADING') ? 'new' : (tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase())}`}>
                      {tx.status === 'PENDING_COINS' ? 'VERIFYING COINS' : (tx.status === 'COINS_LOADING' ? 'COINS LOADING' : tx.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                      {tx.screenshot ? (
                        <button
                          onClick={() => onInspectProof(tx.screenshot, tx.id, tx.type === 'WITHDRAW' ? 'screenshot' : null)}
                          className="submit-btn"
                          style={{ background: tx.type === 'WITHDRAW' ? '#eab308' : '#3498db', color: tx.type === 'WITHDRAW' ? '#000' : '#fff', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                        >
                          <i className={`fa-solid ${tx.type === 'WITHDRAW' ? 'fa-gamepad' : 'fa-receipt'}`}></i>{' '}
                          <span style={{ fontSize: '0.65rem' }}>{tx.type === 'WITHDRAW' ? 'Game Balance' : 'View Proof'}</span>
                        </button>
                      ) : null}
                      {tx.type === 'WITHDRAW' && tx.tagQrScreenshot ? (
                        <button
                          onClick={() => onInspectProof(tx.tagQrScreenshot, tx.id, 'tagQrScreenshot')}
                          className="submit-btn"
                          style={{ background: '#a855f7', color: '#fff', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                        >
                          <i className="fa-solid fa-qrcode"></i> <span style={{ fontSize: '0.65rem' }}>Tag QR</span>
                        </button>
                      ) : null}
                      {tx.type === 'WITHDRAW' && tx.payoutProof ? (
                        <button
                          onClick={() => onInspectProof(tx.payoutProof, tx.id, 'payoutProof')}
                          className="submit-btn"
                          style={{ background: '#10b981', color: '#fff', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                        >
                          <i className="fa-solid fa-money-check-dollar"></i> <span style={{ fontSize: '0.65rem' }}>Paid Receipt</span>
                        </button>
                      ) : null}
                      {!tx.screenshot && !(tx.type === 'WITHDRAW' && tx.tagQrScreenshot) && !(tx.type === 'WITHDRAW' && tx.payoutProof) && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* History Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing page {historyPage} of {totalPages} ({totalTransactions} entries)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleHistoryPrevPage}
              disabled={historyPage === 1}
              className="action-row-btn"
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: historyPage === 1 ? 0.4 : 1, cursor: historyPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              &larr; Prev
            </button>
            <button
              onClick={handleHistoryNextPage}
              disabled={historyPage === totalPages}
              className="action-row-btn"
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: historyPage === totalPages ? 0.4 : 1, cursor: historyPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
