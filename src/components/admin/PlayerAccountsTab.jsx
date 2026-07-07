import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function PlayerAccountsTab({ adminUser, onDeleteUser }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Selected player for history modal inspection
  const [inspectedUser, setInspectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState({
    deposits: [],
    withdrawals: [],
    holdAllotments: [],
    loading: false
  });

  // Debounce search typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, error, mutate } = useSWR(
    `/api/users?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`,
    fetcher
  );

  const users = data?.users || [];
  const totalUsers = data?.totalUsers || 0;
  const totalPages = data?.totalPages || 1;

  // Fetch inspected player's financial history dynamically
  useEffect(() => {
    if (!inspectedUser) return;

    const fetchHistory = async () => {
      setUserHistory((prev) => ({ ...prev, loading: true }));
      try {
        const [txRes, coinsRes] = await Promise.all([
          fetch(`/api/transactions?limit=1000&email=${encodeURIComponent(inspectedUser.email)}`).then((r) => r.json()),
          fetch(`/api/coins-notifications?limit=1000&email=${encodeURIComponent(inspectedUser.email)}`).then((r) => r.json())
        ]);

        const txs = txRes.transactions || [];
        const notis = coinsRes.coinsNotifications || [];

        setUserHistory({
          deposits: txs.filter((t) => t.type === 'DEPOSIT'),
          withdrawals: txs.filter((t) => t.type === 'WITHDRAW'),
          holdAllotments: notis.filter((n) => n.status === 'HOLD'),
          loading: false
        });
      } catch (err) {
        console.error('Failed to load user profile history:', err);
        setUserHistory((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchHistory();
  }, [inspectedUser]);

  const handleDelete = async (email) => {
    if (window.confirm(`Are you sure you want to delete user account "${email}"?`)) {
      await onDeleteUser(email);
      mutate();
    }
  };

  const handleReleaseHold = async (notiId) => {
    try {
      const response = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notiId, status: 'PENDING', holdNote: '' })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Allotment request successfully sent back to Coins Manager!');
        
        // Refresh local hold allotments list
        if (inspectedUser) {
          const coinsRes = await fetch(`/api/coins-notifications?limit=1000&email=${encodeURIComponent(inspectedUser.email)}`).then((r) => r.json());
          const notis = coinsRes.coinsNotifications || [];
          setUserHistory((prev) => ({
            ...prev,
            holdAllotments: notis.filter((n) => n.status === 'HOLD')
          }));
        }
      } else {
        alert(resData.message || 'Failed to release hold.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating allotment status.');
    }
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const isLoading = !data && !error;

  // Check if current logged in admin user is super admin or operational manager
  const cleanAdminRoles = (adminUser?.role || '').toLowerCase().split(',').map(r => r.trim());
  const isManagerOrAdmin = cleanAdminRoles.some(r => r === 'admin' || r === 'operation_admin');

  // Sum calculations for financial summaries
  const successDepositsSum = userHistory.deposits.filter((t) => t.status === 'SUCCESS').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const pendingDepositsSum = userHistory.deposits.filter((t) => t.status === 'PENDING').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const successWithdrawalsSum = userHistory.withdrawals.filter((t) => t.status === 'SUCCESS').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const pendingWithdrawalsSum = userHistory.withdrawals.filter((t) => t.status === 'PENDING' || t.status === 'PENDING_COINS').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h3><i className="fa-solid fa-users text-red"></i> Player Accounts ({totalUsers} Registered)</h3>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search players by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email Address</th>
              <th>Referral Code</th>
              <th>Privilege Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading accounts...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5" className="text-center text-muted">No matching players.</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.email}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#a855f7', fontWeight: 700 }}>
                      {user.referralCode || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge-preview b-new">PLAYER</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="action-row-btn"
                        onClick={() => setInspectedUser(user)}
                        title="Inspect Player Profile & History"
                        style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: 'var(--gold-primary)' }}
                      >
                        <i className="fa-solid fa-clock-history"></i>
                      </button>
                      <button
                        className="action-row-btn btn-delete"
                        onClick={() => handleDelete(user.email)}
                        title="Delete User"
                      >
                        <i className="fa-solid fa-user-minus"></i>
                      </button>
                    </div>
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
            Showing page {page} of {totalPages} ({totalUsers} entries)
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

      {/* INSPECTED PLAYER HISTORY OVERLAY MODAL */}
      {inspectedUser && (
        <div className="modal-backdrop-custom" onClick={() => setInspectedUser(null)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '90%' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-address-card gold-text"></i> Player History Profile
              </h3>
              <button type="button" className="close-modal" onClick={() => setInspectedUser(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{inspectedUser.name}</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Email: <strong>{inspectedUser.email}</strong>
                </p>
              </div>

              {userHistory.loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '0.5rem', display: 'block' }}></i>
                  <p style={{ fontSize: '0.75rem' }}>Loading player activity logs...</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                  
                  {/* Financial Summaries Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: 'rgba(74, 222, 128, 0.03)', border: '1px solid rgba(74, 222, 128, 0.1)', padding: '0.85rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#4ade80', fontWeight: 'bold' }}>Deposited Cash</span>
                      <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', margin: '0.25rem 0' }}>
                        ${successDepositsSum.toFixed(2)}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Pending Checkouts: ${pendingDepositsSum.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '0.85rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#f87171', fontWeight: 'bold' }}>Withdrawn Payouts</span>
                      <div style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 'bold', margin: '0.25rem 0' }}>
                        ${successWithdrawalsSum.toFixed(2)}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Pending Payouts: ${pendingWithdrawalsSum.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Hold Funds / Pending Coin Allotment Block */}
                  <div>
                    <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--gold-primary)', marginBottom: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
                      <i className="fa-solid fa-clock-rotate-left"></i> Allotment Funds On Hold / Pending
                    </h5>

                    {userHistory.holdAllotments.length === 0 ? (
                      <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', opacity: 0.7, fontStyle: 'italic', margin: '0.5rem 0' }}>
                        No coin allotment requests are currently placed on hold for this player.
                      </p>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table className="admin-table" style={{ fontSize: '0.725rem' }}>
                          <thead>
                            <tr>
                              <th>Game</th>
                              <th>Coins</th>
                              <th>Hold Reason</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userHistory.holdAllotments.map((noti) => (
                              <tr key={noti.id}>
                                <td>{noti.gameTitle}</td>
                                <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>{noti.totalCoins}</td>
                                <td style={{ color: '#ef4444' }}>{noti.holdNote || 'Unspecified'}</td>
                                <td>
                                  {isManagerOrAdmin ? (
                                    <button
                                      onClick={() => handleReleaseHold(noti.id)}
                                      style={{
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '0.2rem 0.4rem',
                                        fontSize: '0.6rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Release Hold & Request
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>No Auth</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
