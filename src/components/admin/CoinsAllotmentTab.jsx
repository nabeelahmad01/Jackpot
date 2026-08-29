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
  const { data, error, mutate, isValidating } = usePollingSWR(
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
  const searchSummary = data?.searchSummary;

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
  const isUpdating = isValidating && Boolean(data);

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-coins gold-text"></i>
            Game Coin Allotment Tasks & History
          </h3>
          <span className="game-tap-tip" style={{ float: 'right' }}>
            New requests on top · completed history below · search works across all records
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
          <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', flex: 1, margin: 0 }}>
            <i className="fa-solid fa-magnifying-glass input-icon"></i>
            <input
              type="text"
              placeholder="Search by game username (e.g. Wal321gv1), player email, game title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 0.5rem' }}
              >
                &times;
              </button>
            )}
          </div>
          {isUpdating && (
            <span style={{ fontSize: '0.725rem', color: '#facc15', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-spinner fa-spin"></i> Searching...
            </span>
          )}
        </div>

        {/* Live Search Summary Box showing total times loaded for this specific username */}
        {debouncedSearch && searchSummary && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(168, 85, 247, 0.12))',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              marginTop: '0.25rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(250, 204, 21, 0.2)',
                  border: '1px solid rgba(250, 204, 21, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#facc15',
                  fontSize: '1.25rem'
                }}
              >
                <i className="fa-solid fa-gamepad"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span>Coins Records for:</span>
                  <span style={{ color: '#facc15', background: 'rgba(250,204,21,0.15)', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(250,204,21,0.3)' }}>
                    {debouncedSearch}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  Total Loaded: <strong style={{ color: '#4ade80', fontSize: '0.85rem' }}>{searchSummary.completedLoads} time{searchSummary.completedLoads !== 1 ? 's' : ''}</strong>
                  {searchSummary.pendingLoads > 0 && (
                    <span style={{ color: '#facc15', marginLeft: '0.5rem', fontWeight: 'bold' }}>
                      · {searchSummary.pendingLoads} Pending Task{searchSummary.pendingLoads !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Coins Loaded
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#facc15' }}>
                  🪙 {Math.round(searchSummary.totalCoinsAllotted || 0).toLocaleString()} Coins
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Cash Deposited
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80' }}>
                  ${(searchSummary.totalDepositCash || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User & In-Game Username</th>
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
                <td colSpan="10" className="text-center text-muted" style={{ padding: '3rem 1rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '0.75rem', display: 'block' }}></i>
                  <span>Loading coin allotment tasks & history...</span>
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center text-muted" style={{ padding: '3rem 1rem' }}>
                  <i className="fa-solid fa-coins" style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block', opacity: 0.3, color: '#facc15' }}></i>
                  <strong style={{ color: '#fff', display: 'block', fontSize: '0.95rem' }}>No coin allotment tasks found.</strong>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {debouncedSearch ? `No coin records found for "${debouncedSearch}".` : 'There are no active or completed coins allotment tasks.'}
                  </p>
                </td>
              </tr>
            ) : (
              notifications.map((noti, idx) => (
                <tr key={noti.id} style={{ opacity: noti.status === 'COMPLETED' ? 0.7 : 1, background: noti.status === 'COMPLETED' ? 'rgba(0,0,0,0.15)' : 'transparent' }}>
                  <td>{(page - 1) * limit + idx + 1}</td>
                  <td>
                    <strong style={{ display: 'block', fontSize: '0.8rem', color: '#fff' }}>{noti.userEmail}</strong>
                    {noti.gameUsername ? (
                      <div style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 'bold', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(250, 204, 21, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                        <i className="fa-solid fa-gamepad"></i>
                        <span>{noti.gameUsername}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        —
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
                    ) : noti.bonusApplied === -4 || noti.isLevelReward ? (
                      <span style={{ color: '#facc15', fontWeight: 'bold' }}>Milestone Reward</span>
                    ) : (
                      `$${parseFloat(noti.depositAmount).toFixed(2)}`
                    )}
                  </td>
                  <td>
                    {noti.bonusApplied === -1 ? (
                      <span style={{ color: '#ff4d6d', fontWeight: 'bold' }}>DEDUCTION</span>
                    ) : noti.bonusApplied === -2 ? (
                      <span style={{ color: '#a855f7', fontWeight: 'bold' }}>100% REFERRAL</span>
                    ) : noti.bonusApplied === -4 || noti.isLevelReward ? (
                      <span style={{ color: '#facc15', fontWeight: 'bold' }}>👑 VIP LEVEL REWARD</span>
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
                    {noti.status === 'COMPLETED' ? (
                      <span className="admin-badge-preview b-ready" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <i className="fa-solid fa-check"></i> LOADED
                      </span>
                    ) : noti.status === 'PENDING' ? (
                      <span className="admin-badge-preview b-new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <i className="fa-solid fa-clock"></i> PENDING LOAD
                      </span>
                    ) : noti.status === 'CLAIM_REQUESTED' ? (
                      <span className="admin-badge-preview b-hot" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <i className="fa-solid fa-bell"></i> CLAIM REQUESTED
                      </span>
                    ) : noti.status === 'HOLD' ? (
                      <span className="admin-badge-preview" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <i className="fa-solid fa-pause"></i> ON HOLD
                      </span>
                    ) : (
                      <span className="admin-badge-preview b-none">
                        {noti.status}
                      </span>
                    )}
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
                      <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <i className="fa-solid fa-circle-check"></i> Fulfilled
                      </span>
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
