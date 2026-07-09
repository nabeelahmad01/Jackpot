'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function ShiftDashboardTab({ adminUser }) {
  // SWR endpoints polling every 10 seconds
  const { data: reqData, mutate: mutateRequests } = useSWR('/api/account-requests?status=PENDING&limit=50', fetcher, {
    refreshInterval: 10000
  });

  const { data: coinData, mutate: mutateCoins } = useSWR('/api/coins-notifications?limit=50', fetcher, {
    refreshInterval: 10000
  });

  const { data: txData, mutate: mutateTx } = useSWR('/api/transactions?type=WITHDRAW&status=PENDING&limit=50', fetcher, {
    refreshInterval: 10000
  });

  // Local input states for Game Credentials
  const [credsInput, setCredsInput] = useState({}); // { requestId: { username, password } }
  const [savingCredsId, setSavingCredsId] = useState(null);

  // Local input states for Coin Allotments invalidation reasons
  const [invalidReasons, setInvalidReasons] = useState({}); // { notificationId: reason }
  const [processingCoinId, setProcessingCoinId] = useState(null);

  // Payout states for withdrawals
  const [selectedTx, setSelectedTx] = useState(null);
  const [payoutSentAmount, setPayoutSentAmount] = useState('');
  const [payoutHoldAmount, setPayoutHoldAmount] = useState('');
  const [payoutCustomNote, setPayoutCustomNote] = useState('');
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  const pendingRequests = reqData?.accountRequests || [];
  const pendingCoins = (coinData?.coinsNotifications || []).filter(n => n.status === 'PENDING' || n.status === 'CLAIM_REQUESTED');
  const pendingWithdraws = txData?.transactions || [];

  // Handle saving credentials
  const handleSaveCredentials = async (reqItem) => {
    const fields = credsInput[reqItem.id] || {};
    const username = (fields.username || '').trim();
    const password = (fields.password || '').trim();

    if (!username || !password) {
      alert('Please fill in both Username and Password fields.');
      return;
    }

    setSavingCredsId(reqItem.id);
    try {
      // 1. Create/Save Game Account
      const credResponse = await fetch('/api/game-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: reqItem.gameTitle,
          userEmail: reqItem.userEmail,
          username,
          password
        })
      });
      const credResult = await credResponse.json();

      // 2. Mark Request READY
      const reqResponse = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqItem.id,
          status: 'READY'
        })
      });
      const reqResult = await reqResponse.json();

      if (credResult.success && reqResult.success) {
        alert(`Account credentials saved for ${reqItem.userEmail}!`);
        mutateRequests();
      } else {
        alert(credResult.message || reqResult.message || 'Failed to allot credentials.');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving credentials.');
    } finally {
      setSavingCredsId(null);
    }
  };

  // Handle Allotment Loaded (Success)
  const handleCoinAllotmentSuccess = async (notiId) => {
    setProcessingCoinId(notiId);
    try {
      const res = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notiId, status: 'COMPLETED', read: true, processedBy: adminUser?.email || 'admin@jackpot.com' })
      });
      const data = await res.json();
      if (data.success) {
        mutateCoins();
      } else {
        alert(data.message || 'Failed to update status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    } finally {
      setProcessingCoinId(null);
    }
  };

  // Handle Allotment Invalid (Hold / Notes)
  const handleCoinAllotmentInvalid = async (notiId) => {
    const reason = (invalidReasons[notiId] || '').trim();
    if (!reason) {
      alert('Please enter a reason for invalidating this transaction.');
      return;
    }

    setProcessingCoinId(notiId);
    try {
      const res = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notiId, status: 'HOLD', read: true, holdNote: reason, processedBy: adminUser?.email || 'admin@jackpot.com' })
      });
      const data = await res.json();
      if (data.success) {
        setInvalidReasons(prev => {
          const next = { ...prev };
          delete next[notiId];
          return next;
        });
        mutateCoins();
      } else {
        alert(data.message || 'Failed to set hold note.');
      }
    } catch (err) {
      console.error(err);
      alert('Error setting hold note.');
    } finally {
      setProcessingCoinId(null);
    }
  };

  // Open payout Modal for withdrawal
  const handleOpenPayout = (tx) => {
    setSelectedTx(tx);
    setPayoutSentAmount(tx.amount.toString());
    setPayoutHoldAmount('0');
    setPayoutCustomNote(`Full payout processed to ${tx.gateway || 'Chime'}`);
    setPayoutModalOpen(true);
  };

  // Payout Sent Change listener
  const handleSentChange = (val) => {
    setPayoutSentAmount(val);
    if (!selectedTx) return;
    const total = parseFloat(selectedTx.amount || 0);
    const sent = parseFloat(val || 0);
    const hold = Math.max(0, total - sent);
    setPayoutHoldAmount(hold.toString());
    setPayoutCustomNote(`$${sent} sent to your ${selectedTx.gateway || 'Chime'} & $${hold} is on hold`);
  };

  // Payout Hold Change listener
  const handleHoldChange = (val) => {
    setPayoutHoldAmount(val);
    if (!selectedTx) return;
    const total = parseFloat(selectedTx.amount || 0);
    const hold = parseFloat(val || 0);
    const sent = Math.max(0, total - hold);
    setPayoutSentAmount(sent.toString());
    setPayoutCustomNote(`$${sent} sent to your ${selectedTx.gateway || 'Chime'} & $${hold} is on hold`);
  };

  // Confirm Payout submission
  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;

    setIsProcessingPayout(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTx.id,
          status: 'SUCCESS',
          note: payoutCustomNote.trim(),
          payoutSent: parseFloat(payoutSentAmount || 0),
          payoutHold: parseFloat(payoutHoldAmount || 0),
          processedBy: adminUser?.email || 'admin@jackpot.com'
        })
      });
      const data = await res.json();
      if (data.success) {
        setPayoutModalOpen(false);
        mutateTx();
      } else {
        alert(data.message || 'Failed to confirm payout.');
      }
    } catch (err) {
      console.error(err);
      alert('Error processing payout.');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Decline withdrawal
  const handleDeclineWithdrawal = async (txId) => {
    const reason = window.prompt('Enter reason for declining this withdrawal:', 'Invalid game balance');
    if (reason === null) return;

    try {
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, status: 'FAILED', note: reason, processedBy: adminUser?.email || 'admin@jackpot.com' })
      });
      const data = await res.json();
      if (data.success) {
        mutateTx();
      } else {
        alert(data.message || 'Failed to decline transaction.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating transaction.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
      
      {/* SECTION 1: GAME ACCOUNTS CREDENTIALS */}
      <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Game Accounts Credentials</h3>
            <span className="game-tap-tip">Only accounts missing username/password are shown. Live updates every 10 seconds.</span>
          </div>
          <span className="admin-badge-preview b-ready" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>SECURE</span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>GAME</th>
                <th>USERNAME</th>
                <th>PASSWORD</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '1.5rem' }}>No credentials requests pending.</td>
                </tr>
              ) : (
                pendingRequests.map((req) => (
                  <tr key={req.id}>
                    <td><strong>{req.userEmail}</strong></td>
                    <td><span className="admin-badge-preview b-new" style={{ fontSize: '0.65rem' }}>{req.gameTitle}</span></td>
                    <td>
                      <input
                        type="text"
                        placeholder="Enter username"
                        value={credsInput[req.id]?.username || ''}
                        onChange={(e) => setCredsInput(prev => ({
                          ...prev,
                          [req.id]: { ...(prev[req.id] || {}), username: e.target.value }
                        }))}
                        style={{ background: '#070912', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.35rem 0.5rem', borderRadius: '6px', width: '150px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Enter password"
                        value={credsInput[req.id]?.password || ''}
                        onChange={(e) => setCredsInput(prev => ({
                          ...prev,
                          [req.id]: { ...(prev[req.id] || {}), password: e.target.value }
                        }))}
                        style={{ background: '#070912', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.35rem 0.5rem', borderRadius: '6px', width: '150px' }}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => handleSaveCredentials(req)}
                        disabled={savingCredsId === req.id}
                        className="submit-btn"
                        style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', margin: 0, padding: '0.35rem 1rem', width: 'auto', fontSize: '0.7rem' }}
                      >
                        {savingCredsId === req.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: VERIFIED TRANSACTIONS (COIN ALLOTMENTS) */}
      <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Verified Transactions</h3>
            <span className="game-tap-tip">Mark verified deposits/withdrawals as processed or invalid.</span>
          </div>
          <span className="admin-badge-preview b-ready" style={{ background: 'rgba(34,197,94,0.15)', color: '#2ecc71', border: '1px solid rgba(34,197,94,0.25)' }}>LIVE</span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>USERNAME</th>
                <th>GAME</th>
                <th>TYPE</th>
                <th>LD AMOUNT</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pendingCoins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '1.5rem' }}>No pending transactions to allot.</td>
                </tr>
              ) : (
                pendingCoins.map((noti) => (
                  <tr key={noti.id}>
                    <td>
                      <strong>{noti.userEmail}</strong>
                      {noti.gameUsername && <div style={{ fontSize: '0.65rem', color: 'var(--gold-primary)' }}>({noti.gameUsername})</div>}
                    </td>
                    <td><span className="admin-badge-preview b-hot" style={{ fontSize: '0.65rem' }}>{noti.gameTitle}</span></td>
                    <td>
                      <span style={{ fontSize: '0.725rem', color: noti.totalCoins < 0 ? '#ff4d6d' : '#2ecc71', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {noti.totalCoins < 0 ? 'withdraw' : 'deposit'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: noti.totalCoins < 0 ? '#ff4d6d' : 'var(--gold-primary)', fontSize: '0.85rem' }}>
                        {Math.abs(noti.totalCoins).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleCoinAllotmentSuccess(noti.id)}
                          disabled={processingCoinId === noti.id}
                          className="submit-btn"
                          style={{ background: '#7c3aed', color: '#fff', margin: 0, padding: '0.35rem 0.85rem', width: 'auto', fontSize: '0.7rem', fontWeight: 'bold' }}
                        >
                          Loaded
                        </button>
                        <input
                          type="text"
                          placeholder="Reason (required)"
                          value={invalidReasons[noti.id] || ''}
                          onChange={(e) => setInvalidReasons(prev => ({ ...prev, [noti.id]: e.target.value }))}
                          style={{ background: '#070912', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.725rem', padding: '0.35rem 0.5rem', borderRadius: '6px', width: '140px' }}
                        />
                        <button
                          onClick={() => handleCoinAllotmentInvalid(noti.id)}
                          disabled={processingCoinId === noti.id}
                          className="submit-btn"
                          style={{ background: '#ef4444', color: '#fff', margin: 0, padding: '0.35rem 0.85rem', width: 'auto', fontSize: '0.7rem', fontWeight: 'bold' }}
                        >
                          Invalid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: WITHDRAWAL REQUESTS */}
      <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Withdrawal Requests</h3>
            <span className="game-tap-tip">Redeem or mark as invalid with a note.</span>
          </div>
          <span className="admin-badge-preview b-hot" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>ACTION</span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>TYPE</th>
                <th>USERNAME</th>
                <th>AMOUNT</th>
                <th>LAST DEPOSIT</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pendingWithdraws.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '1.5rem' }}>No withdrawal requests.</td>
                </tr>
              ) : (
                pendingWithdraws.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className="admin-badge-preview b-new" style={{ fontSize: '0.65rem' }}>{tx.type}</span>
                    </td>
                    <td>
                      <strong>{tx.userEmail}</strong>
                      {tx.gameUsername && <div style={{ fontSize: '0.65rem', color: 'var(--gold-primary)', marginTop: '0.15rem' }}>({tx.gameUsername})</div>}
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Tag: {tx.code} ({tx.gateway})</div>
                    </td>
                    <td>
                      <strong style={{ color: '#ff4d6d', fontSize: '0.85rem' }}>
                        ${parseFloat(tx.amount).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.725rem' }}>{tx.gateway || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleOpenPayout(tx)}
                          className="submit-btn"
                          style={{ background: '#22c55e', color: '#fff', margin: 0, padding: '0.35rem 0.85rem', width: 'auto', fontSize: '0.7rem', fontWeight: 'bold' }}
                        >
                          Process
                        </button>
                        <button
                          onClick={() => handleDeclineWithdrawal(tx.id)}
                          className="submit-btn"
                          style={{ background: '#ef4444', color: '#fff', margin: 0, padding: '0.35rem 0.85rem', width: 'auto', fontSize: '0.7rem', fontWeight: 'bold' }}
                        >
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PAYOUT MODAL OVERLAY */}
      {payoutModalOpen && selectedTx && (
        <div className="modal-backdrop-custom" onClick={() => setPayoutModalOpen(false)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-money-bill-transfer gold-text"></i> Process Payout
              </h3>
              <button type="button" className="close-modal" onClick={() => setPayoutModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div>Player: <strong style={{ color: '#fff' }}>{selectedTx.userEmail}</strong></div>
                <div style={{ marginTop: '0.25rem' }}>Gateway: <strong>{selectedTx.gateway}</strong> • Tag: <strong>{selectedTx.code}</strong></div>
                <div style={{ marginTop: '0.25rem' }}>Total Requested: <strong style={{ color: 'var(--gold-primary)' }}>${parseFloat(selectedTx.amount).toFixed(2)}</strong></div>
              </div>

              <form onSubmit={handlePayoutSubmit} noValidate>
                <div className="input-group">
                  <label htmlFor="sent-amount">Amount Sent Now ($)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-circle-dollar-to-slot input-icon"></i>
                    <input
                      type="number"
                      id="sent-amount"
                      value={payoutSentAmount}
                      onChange={(e) => handleSentChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="hold-amount">Amount Put On Hold ($)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-lock input-icon"></i>
                    <input
                      type="number"
                      id="hold-amount"
                      value={payoutHoldAmount}
                      onChange={(e) => handleHoldChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="payout-note">Payout Note (Shown to Player)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-note-sticky input-icon"></i>
                    <input
                      type="text"
                      id="payout-note"
                      value={payoutCustomNote}
                      onChange={(e) => setPayoutCustomNote(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isProcessingPayout}>
                  {isProcessingPayout ? 'Processing...' : 'Confirm Payout'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
