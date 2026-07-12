import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function WebsitePaymentsTab({
  onInspectProof,
  completedActionIds = {},
  adminUser
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

  // SWR polls every 4s for website commission payments
  const swrKey = `/api/transactions?type=WEBSITE_COMMISSION_PAYMENT&page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`;
  const { data, error, mutate } = useSWR(swrKey, fetcher, { refreshInterval: 4000 });

  const rawTransactions = data?.transactions || [];
  const transactions = rawTransactions.filter((t) => !completedActionIds[t.id]);
  const totalTransactions = data?.totalTransactions || 0;
  const totalPages = data?.totalPages || 1;

  const pendingPayments = transactions.filter((t) => t.status === 'PENDING');
  const processedPayments = transactions.filter((t) => t.status !== 'PENDING');

  const handleApprove = async (tx) => {
    const confirmApprove = window.confirm(`Confirm receipt of $${parseFloat(tx.amount).toFixed(2)} website commission payout?`);
    if (!confirmApprove) return;

    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tx.id,
          status: 'SUCCESS',
          note: 'Confirmed by Admin',
          processedBy: adminUser?.email || 'admin@jackpot.com'
        })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Payment confirmed successfully!');
        mutate();
      } else {
        alert(resData.message || 'Failed to approve payment.');
      }
    } catch (err) {
      console.error(err);
      alert('Error approving payment.');
    }
  };

  const handleReject = async (tx) => {
    const feedbackMsg = window.prompt('Enter reason for rejecting this payment proof:', 'Payment proof invalid or screenshot unclear');
    if (feedbackMsg === null) return; // cancelled

    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tx.id,
          status: 'FAILED',
          note: feedbackMsg || 'Rejected by Admin',
          processedBy: adminUser?.email || 'admin@jackpot.com'
        })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Payment rejected.');
        mutate();
      } else {
        alert(resData.message || 'Failed to reject payment.');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting payment.');
    }
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
        <h3><i className="fa-solid fa-file-invoice-dollar text-red"></i> Website Commission Payments</h3>
        <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>Review and approve website commission deposits submitted by Type B distributors.</p>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
          <p>Loading payments queue...</p>
        </div>
      ) : (
        <>
          <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%', marginBottom: '1.25rem' }}>
            <i className="fa-solid fa-magnifying-glass input-icon"></i>
            <input
              type="text"
              placeholder="Search website payments by distributor email or tx hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* PENDING PAYMENTS SECTION */}
          <div className="section-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <i className="fa-solid fa-hourglass-half"></i> PENDING PROOFS ({pendingPayments.length} on page)
            </h4>
          </div>

          <div className="table-responsive" style={{ marginBottom: '2.5rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Distributor Email</th>
                  <th>Gateway</th>
                  <th>Tx Hash / Tag</th>
                  <th>Amount</th>
                  <th>Submitted At</th>
                  <th>Proof Screenshot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted" style={{ padding: '2rem' }}>
                      No pending website commission payments.
                    </td>
                  </tr>
                ) : (
                  pendingPayments.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td>{(page - 1) * limit + idx + 1}</td>
                      <td><strong>{tx.userEmail}</strong></td>
                      <td><span className="admin-badge-preview b-hot">{tx.gateway}</span></td>
                      <td><code style={{ fontSize: '0.7rem' }}>{tx.code}</code></td>
                      <td><strong style={{ color: '#00ff66' }}>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                      <td style={{ fontSize: '0.7rem' }}>{tx.date}</td>
                      <td>
                        {tx.screenshot ? (
                          <button
                            onClick={() => onInspectProof(tx.screenshot, tx.id)}
                            className="submit-btn"
                            style={{ background: '#3498db', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                          >
                            <i className="fa-solid fa-receipt"></i> <span style={{ fontSize: '0.65rem' }}>View Proof</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#666' }}>No receipt</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleApprove(tx)}
                            className="action-row-btn btn-edit"
                            style={{ background: '#22c55e', color: '#fff' }}
                            title="Confirm & Approve Payment"
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            onClick={() => handleReject(tx)}
                            className="action-row-btn btn-delete"
                            style={{ background: '#ef4444', color: '#fff' }}
                            title="Reject/Decline Proof"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* HISTORICAL PAYMENTS SECTION */}
          <div className="section-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#ff4d6d', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <i className="fa-solid fa-clock-rotate-left"></i> PROCESSED PAYMENT HISTORY ({processedPayments.length} on page)
            </h4>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Distributor Email</th>
                  <th>Gateway</th>
                  <th>Tx Hash / Tag</th>
                  <th>Amount</th>
                  <th>Processed At</th>
                  <th>Status</th>
                  <th>Processed By</th>
                  <th>Notes/Reasons</th>
                  <th>Screenshot</th>
                </tr>
              </thead>
              <tbody>
                {processedPayments.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                      No transaction history found on this page.
                    </td>
                  </tr>
                ) : (
                  processedPayments.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td>{(page - 1) * limit + idx + 1}</td>
                      <td>{tx.userEmail}</td>
                      <td><span className="admin-badge-preview b-new">{tx.gateway}</span></td>
                      <td><code style={{ fontSize: '0.7rem' }}>{tx.code}</code></td>
                      <td><strong>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                      <td style={{ fontSize: '0.7rem' }}>{tx.date}</td>
                      <td>
                        <span className={`admin-badge-preview b-${tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase()}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--gold-primary)' }}>{tx.approvedBy || '-'}</td>
                      <td>
                        <div style={{ fontSize: '0.7rem', color: '#aaa', maxWidth: '200px', whiteSpace: 'normal' }}>
                          {tx.note || '-'}
                        </div>
                      </td>
                      <td>
                        {tx.screenshot ? (
                          <button
                            onClick={() => onInspectProof(tx.screenshot, tx.id)}
                            className="submit-btn"
                            style={{ background: '#4b5563', color: '#fff', margin: 0, padding: '0.3rem 0.5rem', width: 'auto' }}
                          >
                            <span style={{ fontSize: '0.65rem' }}>View screenshot</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#666' }}>No screenshot</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
