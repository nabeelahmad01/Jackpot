import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function LedgerTab({
  onInspectProof,
  onApproveTransaction,
  onFailTransaction,
  completedActionIds = {},
  processingIds,
  wrapAction
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // SWR automatically polls every 4s for ledger transactions
  const { data, error, mutate } = useSWR(
    `/api/transactions?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  const transactions = (data?.transactions || []).filter((t) => !completedActionIds[t.id]);
  const totalTransactions = data?.totalTransactions || 0;
  const totalPages = data?.totalPages || 1;

  const depositsLedger = transactions.filter((t) => t.type === 'DEPOSIT');
  const withdrawalsLedger = transactions.filter((t) => t.type === 'WITHDRAW' || t.type === 'BONUS');

  const handleApprove = async (txId) => {
    await onApproveTransaction(txId);
    mutate();
  };

  const handleFail = async (txId) => {
    await onFailTransaction(txId);
    mutate();
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const isLoading = !data && !error;

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h3><i className="fa-solid fa-wallet text-red"></i> Financial Transaction Ledger</h3>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search ledger by email, gateway, or deposit/withdraw..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
          <p>Loading transaction logs...</p>
        </div>
      ) : (
        <>
          {/* DEPOSITS SECTION */}
          <div className="section-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--gold-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <i className="fa-solid fa-circle-arrow-down"></i> DEPOSIT REQUESTS & LOGS ({depositsLedger.length} on page)
            </h4>
          </div>

          <div className="table-responsive" style={{ marginBottom: '2.5rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User Email</th>
                  <th>Game Title</th>
                  <th>Tx Type</th>
                  <th>Amount</th>
                  <th>Gateway Details</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Payment Screenshot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {depositsLedger.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                      No successful or pending deposit transactions found on this page.
                    </td>
                  </tr>
                ) : (
                  depositsLedger.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td>{(page - 1) * limit + idx + 1}</td>
                      <td>
                        <div>{tx.userEmail}</div>
                        {tx.gameUsername && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>
                            <i className="fa-solid fa-gamepad" style={{ marginRight: '3px' }}></i> {tx.gameUsername}
                          </div>
                        )}
                      </td>
                      <td><strong>{tx.gameTitle}</strong></td>
                      <td>
                        <span className="admin-badge-preview b-hot">
                          {tx.type}
                        </span>
                      </td>
                      <td><strong>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                      <td>
                        <span style={{ fontSize: '0.725rem', opacity: 0.9 }}>
                          {tx.gateway} ({tx.code})
                        </span>
                        {tx.nameOnTag && (
                          <div style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: '#ffd700' }}>Name: {tx.nameOnTag}</span>
                            {tx.phoneOnTag && <span style={{ color: 'var(--text-muted)' }}>Phone: {tx.phoneOnTag}</span>}
                          </div>
                        )}
                        {tx.note && <p style={{ fontSize: '0.65rem', color: '#ff8787', margin: '0.2rem 0 0 0' }}>{tx.note}</p>}
                      </td>
                      <td style={{ fontSize: '0.7rem' }}>{tx.date}</td>
                      <td>
                        <span className={`admin-badge-preview b-${tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase()}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>
                        {tx.screenshot ? (
                          <button
                            onClick={() => onInspectProof(tx.screenshot)}
                            className="submit-btn"
                            style={{ background: '#3498db', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                          >
                            <i className="fa-solid fa-receipt"></i> <span style={{ fontSize: '0.65rem' }}>View Proof</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No Screenshot</span>
                        )}
                      </td>
                      <td>
                        {tx.status === 'PENDING' ? (
                          <div className="table-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                            <button
                              disabled={processingIds[tx.id]}
                              onClick={wrapAction(tx.id, () => handleApprove(tx.id))}
                              className="action-row-btn btn-edit"
                              style={{ background: '#22c55e', color: '#fff', opacity: processingIds[tx.id] ? 0.5 : 1 }}
                              title="Approve Payment"
                            >
                              {processingIds[tx.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                            </button>
                            <button
                              disabled={processingIds[tx.id]}
                              onClick={wrapAction(tx.id, () => handleFail(tx.id))}
                              className="action-row-btn btn-delete"
                              style={{ background: '#ef4444', color: '#fff', opacity: processingIds[tx.id] ? 0.5 : 1 }}
                              title="Fail/Reject Payment"
                            >
                              {processingIds[tx.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-xmark"></i>}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* WITHDRAWALS SECTION */}
          <div className="section-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '1rem', color: '#ff4d6d', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <i className="fa-solid fa-circle-arrow-up"></i> WITHDRAWAL REQUESTS & LOGS ({withdrawalsLedger.length} on page)
            </h4>
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
                  <th>Gateway Details</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Game Screenshot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalsLedger.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                      No successful or pending withdrawal transactions found on this page.
                    </td>
                  </tr>
                ) : (
                  withdrawalsLedger.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td>{(page - 1) * limit + idx + 1}</td>
                      <td>
                        <div>{tx.userEmail}</div>
                        {tx.gameUsername && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>
                            <i className="fa-solid fa-gamepad" style={{ marginRight: '3px' }}></i> {tx.gameUsername}
                          </div>
                        )}
                      </td>
                      <td><strong>{tx.gameTitle}</strong></td>
                      <td>
                        <span className="admin-badge-preview b-new">
                          {tx.type}
                        </span>
                      </td>
                      <td><strong>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                      <td>
                        <span style={{ fontSize: '0.725rem', opacity: 0.9 }}>
                          {tx.gateway} ({tx.code})
                        </span>
                        {tx.nameOnTag && (
                          <div style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: '#ffd700' }}>Name: {tx.nameOnTag}</span>
                            {tx.phoneOnTag && <span style={{ color: 'var(--text-muted)' }}>Phone: {tx.phoneOnTag}</span>}
                          </div>
                        )}
                        {tx.note && <p style={{ fontSize: '0.65rem', color: '#ff8787', margin: '0.2rem 0 0 0' }}>{tx.note}</p>}
                      </td>
                      <td style={{ fontSize: '0.7rem' }}>{tx.date}</td>
                      <td>
                        <span className={`admin-badge-preview b-${tx.status === 'PENDING_COINS' ? 'new' : (tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase())}`}>
                          {tx.status === 'PENDING_COINS' ? 'VERIFYING COINS' : tx.status}
                        </span>
                      </td>
                      <td>
                        {tx.screenshot ? (
                          <button
                            onClick={() => onInspectProof(tx.screenshot)}
                            className="submit-btn"
                            style={{ background: '#eab308', color: '#000', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                          >
                            <i className="fa-solid fa-gamepad"></i> <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>View Game Balance</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No Screenshot</span>
                        )}
                      </td>
                      <td>
                        {tx.status === 'PENDING' ? (
                          <div className="table-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                            <button
                              disabled={processingIds[tx.id]}
                              onClick={wrapAction(tx.id, () => handleApprove(tx.id))}
                              className="action-row-btn btn-edit"
                              style={{ background: '#22c55e', color: '#fff', opacity: processingIds[tx.id] ? 0.5 : 1 }}
                              title="Approve Payment"
                            >
                              {processingIds[tx.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                            </button>
                            <button
                              disabled={processingIds[tx.id]}
                              onClick={wrapAction(tx.id, () => handleFail(tx.id))}
                              className="action-row-btn btn-delete"
                              style={{ background: '#ef4444', color: '#fff', opacity: processingIds[tx.id] ? 0.5 : 1 }}
                              title="Fail/Reject Payment"
                            >
                              {processingIds[tx.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-xmark"></i>}
                            </button>
                          </div>
                        ) : tx.status === 'PENDING_COINS' ? (
                          <span style={{ fontSize: '0.7rem', color: '#ffb703', fontWeight: 'bold' }}>Waiting on Coins Manager</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Showing page {page} of {totalPages} ({totalTransactions} entries)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="action-row-btn"
                  style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  &larr; Prev
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                  className="action-row-btn"
                  style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
