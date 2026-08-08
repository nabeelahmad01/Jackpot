'use client';

import React, { useState, useEffect } from 'react';
import usePollingSWR from '../../hooks/usePollingSWR';
import { POLL } from '../../lib/pollingConfig';
import { formatDeviceDateTime } from '../../lib/formatDateTime';

export default function CoinsAllotmentTab({
  onUpdateCoinsNotification,
  completedActionIds = {},
  processingIds,
  wrapAction,
  adminUser
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [activeHoldId, setActiveHoldId] = useState(null);
  const [holdNoteText, setHoldNoteText] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // New work + history: PENDING/CLAIM/HOLD on top, COMPLETED below (API sorts).
  // Search covers both. Optimistic hide only for just-completed rows still in-flight.
  const { data, error, mutate } = usePollingSWR(
    `/api/coins-notifications?status=PENDING,CLAIM_REQUESTED,HOLD,COMPLETED&page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&adminRole=${adminUser?.role || ''}&adminDistributorId=${adminUser?.distributorId || ''}&adminEmail=${encodeURIComponent(adminUser?.email || '')}&slim=1`,
    POLL.LIVE,
    { refreshWhenHidden: true, keepPreviousData: false, dedupingInterval: 200 }
  );

  const notifications = (data?.coinsNotifications || []).filter((n) => {
    const st = String(n.status || '').toUpperCase();
    if (st === 'COMPLETED') return true;
    if (completedActionIds[n.id] || completedActionIds[String(n.id)]) return false;
    return ['PENDING', 'CLAIM_REQUESTED', 'HOLD'].includes(st);
  });
  const totalNotifications = data?.totalNotifications || 0;
  const totalPages = data?.totalPages || 1;

  const handleUpdate = async (id, status, read, holdNote) => {
    await onUpdateCoinsNotification(id, status, read, holdNote);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3><i className="fa-solid fa-coins gold-text"></i> Pending Game Coin Allotment Tasks</h3>
          <span className="game-tap-tip" style={{ float: 'right' }}>
            New requests on top · completed history below · search works on both
          </span>
        </div>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search tasks by player email or game..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User Email</th>
              <th>Target Game</th>
              <th>Deposit Cash</th>
              <th>Bonus Applied</th>
              <th>Allotment Target (Coins)</th>
              <th>Timestamp</th>
              <th>Read Indicator</th>
              <th>Allotment Status</th>
              <th>Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading allotment queue...
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No coin allotment tasks found.
                </td>
              </tr>
            ) : (
              notifications.map((noti, idx) => (
                <tr key={noti.id} style={{ opacity: noti.status === 'COMPLETED' ? 0.6 : 1 }}>
                  <td>{(page - 1) * limit + idx + 1}</td>
                  <td>
                    <strong>{noti.userEmail}</strong>
                    {noti.gameUsername && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>
                        <i className="fa-solid fa-gamepad" style={{ marginRight: '3px' }}></i> {noti.gameUsername}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                      <span className={`admin-badge-preview ${noti.totalCoins < 0 ? 'b-new' : 'b-hot'}`}>{noti.gameTitle}</span>
                      {noti.isDepositFromCashout && (
                        <div style={{ fontSize: '0.6rem', color: '#ffe16c', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block' }}>
                          🎁 DEPOSIT FROM CASHOUT
                        </div>
                      )}
                      {noti.isFreeplayWithdraw && (
                        <div style={{ fontSize: '0.6rem', color: '#ff4d6d', background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.25)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block' }}>
                          ⚠️ FREEPLAY WIN: MAX PAYOUT $30
                        </div>
                      )}
                    </div>
                    {noti.holdNote && (
                      <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.25rem', maxWidth: '200px', whiteSpace: 'normal', fontStyle: 'italic' }}>
                        Note: "{noti.holdNote}"
                      </div>
                    )}
                  </td>
                  <td>
                    {noti.bonusApplied === -1 ? (
                      <span style={{ color: '#ff4d6d' }}>${parseFloat(noti.depositAmount).toFixed(2)} (Cashout)</span>
                    ) : noti.bonusApplied === -2 ? (
                      <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>Referral Claim</span>
                    ) : (
                      `$${parseFloat(noti.depositAmount).toFixed(2)}`
                    )}
                  </td>
                  <td>
                    {noti.bonusApplied === -1 ? (
                      <span style={{ color: '#ff4d6d', fontWeight: 'bold' }}>DEDUCTION</span>
                    ) : noti.bonusApplied === -2 ? (
                      <span style={{ color: '#a855f7', fontWeight: 'bold' }}>100% REFERRAL</span>
                    ) : noti.bonusApplied === -3 || noti.isFreeplay || (noti.bonusApplied === 100 && parseFloat(noti.depositAmount || 0) === 0) ? (
                      <span style={{ color: '#00ff66', fontWeight: 'bold' }}>FREEPLAY</span>
                    ) : (
                      `${noti.bonusApplied}% Bonus`
                    )}
                  </td>
                  <td>
                    {noti.totalCoins < 0 ? (
                      <strong style={{ color: '#ff4d6d', fontSize: '0.9rem' }}><i className="fa-solid fa-coins" style={{ marginRight: '4px' }}></i> -{Math.floor(Math.abs(Number(noti.totalCoins) || 0))} (Deduct)</strong>
                    ) : (
                      <strong style={{ color: '#00ff66', fontSize: '0.9rem' }}><i className="fa-solid fa-coins" style={{ color: '#00ff66', marginRight: '4px' }}></i> {Math.floor(Number(noti.totalCoins) || 0)}</strong>
                    )}
                  </td>
                  <td style={{ fontSize: '0.7rem' }}>{formatDeviceDateTime(noti.timestamp, noti.createdAt, noti.date)}</td>
                  <td>
                    <button
                      disabled={processingIds[noti.id]}
                      onClick={wrapAction(noti.id, () => handleUpdate(noti.id, undefined, !noti.read))}
                      className="action-row-btn"
                      style={{
                        background: noti.read ? 'rgba(255,255,255,0.05)' : 'rgba(255,215,0,0.15)',
                        border: noti.read ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ffd700',
                        color: noti.read ? '#a0aec0' : '#ffd700',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        padding: '0.2rem 0.5rem',
                        width: 'auto',
                        opacity: processingIds[noti.id] ? 0.6 : 1
                      }}
                    >
                      {processingIds[noti.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : (noti.read ? 'READ' : 'UNREAD')}
                    </button>
                  </td>
                  <td>
                    <span className={`admin-badge-preview b-${noti.status === 'PENDING' ? 'none' : noti.status === 'HOLD' ? 'new' : noti.status === 'CLAIM_REQUESTED' ? 'hot' : 'ready'}`}>
                      {noti.status === 'HOLD' ? 'ON HOLD' : noti.status === 'CLAIM_REQUESTED' ? 'CLAIM REQUESTED' : noti.status}
                    </span>
                  </td>
                  <td>
                    {noti.status === 'PENDING' || noti.status === 'CLAIM_REQUESTED' || noti.status === 'HOLD' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '150px' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            disabled={processingIds[noti.id]}
                            onClick={wrapAction(noti.id, () => handleUpdate(noti.id, 'COMPLETED', true))}
                            className="submit-btn"
                            style={{ background: 'linear-gradient(135deg, #00ff66 0%, #00a844 100%)', color: '#000', margin: 0, padding: '0.35rem 0.5rem', width: 'auto', display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontWeight: 'bold', opacity: processingIds[noti.id] ? 0.6 : 1 }}
                          >
                            {processingIds[noti.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-circle-check"></i>}
                            <span style={{ fontSize: '0.65rem' }}>DONE</span>
                          </button>
                          
                          {(noti.status === 'PENDING' || noti.status === 'CLAIM_REQUESTED') && (
                            <>
                              <button
                                onClick={() => {
                                  setActiveHoldId(noti.id);
                                  setHoldNoteText("");
                                }}
                                className="submit-btn"
                                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000', margin: 0, padding: '0.35rem 0.5rem', width: 'auto', display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontWeight: 'bold' }}
                              >
                                <i className="fa-solid fa-pause"></i>
                                <span style={{ fontSize: '0.65rem' }}>HOLD</span>
                              </button>

                              <button
                                disabled={processingIds[noti.id]}
                                onClick={wrapAction(noti.id, async () => {
                                  if (window.confirm('Are you sure you want to cancel this coins allotment request?')) {
                                    await handleUpdate(noti.id, 'CANCELLED', true, 'Cancelled by Administrator');
                                  }
                                })}
                                className="submit-btn"
                                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff', margin: 0, padding: '0.35rem 0.5rem', width: 'auto', display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontWeight: 'bold', opacity: processingIds[noti.id] ? 0.6 : 1 }}
                                title="Cancel coins allotment directly"
                              >
                                {processingIds[noti.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-xmark"></i>}
                                <span style={{ fontSize: '0.65rem' }}>CANCEL</span>
                              </button>
                            </>
                          )}
                        </div>

                        {activeHoldId === noti.id && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <textarea
                              value={holdNoteText}
                              onChange={(e) => setHoldNoteText(e.target.value)}
                              style={{ width: '100%', minHeight: '60px', background: '#070913', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.7rem', padding: '0.35rem', borderRadius: '4px', resize: 'vertical' }}
                              placeholder="Type instructions manually..."
                            />
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setActiveHoldId(null)}
                                className="action-row-btn"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: '#fff', width: 'auto' }}
                              >
                                Cancel
                              </button>
                              <button
                                disabled={processingIds[noti.id]}
                                onClick={wrapAction(noti.id, async () => {
                                  await handleUpdate(noti.id, 'HOLD', undefined, holdNoteText);
                                  setActiveHoldId(null);
                                })}
                                className="submit-btn"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', background: '#f59e0b', color: '#000', width: 'auto', margin: 0 }}
                              >
                                Send Note
                              </button>
                            </div>
                          </div>
                        )}

                        {noti.distributorType === 'B' && (
                          <span style={{ fontSize: '0.6rem', color: '#3b82f6', display: 'block' }}>
                            Managed by {noti.distributorName || 'Distributor'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Fulfilled</span>
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
            Showing page {page} of {totalPages} ({totalNotifications} entries)
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
    </section>
  );
}
