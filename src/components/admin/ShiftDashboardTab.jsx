'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function ShiftDashboardTab({ adminUser }) {
  // SWR endpoints polling every 10 seconds
  const { data: reqData, mutate: mutateRequests } = useSWR(`/api/account-requests?status=PENDING&limit=50&adminRole=${adminUser?.role || ''}&adminDistributorId=${adminUser?.distributorId || ''}`, fetcher, {
    refreshInterval: 10000
  });

  const { data: coinData, mutate: mutateCoins } = useSWR(`/api/coins-notifications?limit=50&adminRole=${adminUser?.role || ''}&adminDistributorId=${adminUser?.distributorId || ''}`, fetcher, {
    refreshInterval: 10000
  });



  // Local input states for Game Credentials
  const [credsInput, setCredsInput] = useState({}); // { requestId: { username, password } }
  const [savingCredsId, setSavingCredsId] = useState(null);

  // Local input states for Coin Allotments invalidation reasons
  const [invalidReasons, setInvalidReasons] = useState({}); // { notificationId: reason }
  const [processingCoinId, setProcessingCoinId] = useState(null);

  const { data: settingsData } = useSWR('/api/settings/frontend', fetcher);
  const [prevPendingCount, setPrevPendingCount] = useState(null);

  const pendingRequests = reqData?.accountRequests || [];
  const pendingCoins = (coinData?.coinsNotifications || []).filter(n => n.status === 'PENDING' || n.status === 'CLAIM_REQUESTED');

  useEffect(() => {
    if (reqData && coinData) {
      const currentCount = pendingRequests.length + pendingCoins.length;
      if (prevPendingCount !== null && currentCount > prevPendingCount) {
        try {
          const rawUrl = settingsData?.settings?.notificationSoundUrl || 'https://raw.githubusercontent.com/AUTOMATIC1111/stable-diffusion-webui/master/notification.mp3';
          const cleanUrl = rawUrl.replace(/^data:video\/[^;]+;/, 'data:audio/mpeg;');
          const audio = new Audio(cleanUrl);
          audio.play().catch(err => console.log('Audio playback blocked or failed:', err));
        } catch (audioErr) {
          console.error('Audio play error:', audioErr);
        }
      }
      setPrevPendingCount(currentCount);
    }
  }, [reqData, coinData, pendingRequests.length, pendingCoins.length, settingsData]);


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
                      {req.distributorType === 'B' ? (
                        <span className="admin-badge-preview b-hold" style={{ fontSize: '0.65rem', background: '#3b82f6', color: '#fff', border: '1px solid rgba(59,130,246,0.3)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          Managed by {req.distributorName || 'Distributor'}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSaveCredentials(req)}
                          disabled={savingCredsId === req.id}
                          className="submit-btn"
                          style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', margin: 0, padding: '0.35rem 1rem', width: 'auto', fontSize: '0.7rem' }}
                        >
                          {savingCredsId === req.id ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: VERIFIED DEPOSITS */}
      <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Verified Deposits</h3>
            <span className="game-tap-tip">Mark verified deposits as processed (Loaded) or invalid.</span>
          </div>
          <span className="admin-badge-preview b-ready" style={{ background: 'rgba(34,197,94,0.15)', color: '#2ecc71', border: '1px solid rgba(34,197,94,0.25)' }}>LIVE DEPOSITS</span>
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
              {pendingCoins.filter(n => n.totalCoins >= 0).length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '1.5rem' }}>No pending deposits to allot.</td>
                </tr>
              ) : (
                pendingCoins.filter(n => n.totalCoins >= 0).map((noti) => (
                  <tr key={noti.id}>
                    <td>
                      <strong>{noti.userEmail}</strong>
                      {noti.gameUsername && <div style={{ fontSize: '0.65rem', color: 'var(--gold-primary)' }}>({noti.gameUsername})</div>}
                    </td>
                    <td><span className="admin-badge-preview b-hot" style={{ fontSize: '0.65rem' }}>{noti.gameTitle}</span></td>
                    <td>
                      <span style={{ fontSize: '0.725rem', color: '#2ecc71', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        deposit
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--gold-primary)', fontSize: '0.85rem' }}>
                        {Math.abs(noti.totalCoins).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      {noti.distributorType === 'B' ? (
                        <span className="admin-badge-preview b-hold" style={{ fontSize: '0.65rem', background: '#3b82f6', color: '#fff', border: '1px solid rgba(59,130,246,0.3)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          Managed by {noti.distributorName || 'Distributor'}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleCoinAllotmentSuccess(noti.id)}
                            disabled={processingCoinId === noti.id}
                            className="submit-btn"
                            style={{ background: '#22c55e', color: '#fff', margin: 0, padding: '0.35rem 0.85rem', width: 'auto', fontSize: '0.7rem', fontWeight: 'bold' }}
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
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: VERIFIED WITHDRAWALS */}
      <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)', marginTop: '1.5rem' }}>
        <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Verified Withdrawals</h3>
            <span className="game-tap-tip">Mark verified withdrawals as processed (Withdrawal) or invalid.</span>
          </div>
          <span className="admin-badge-preview b-hot" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>LIVE WITHDRAWALS</span>
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
              {pendingCoins.filter(n => n.totalCoins < 0).length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '1.5rem' }}>No pending withdrawals to allot.</td>
                </tr>
              ) : (
                pendingCoins.filter(n => n.totalCoins < 0).map((noti) => (
                  <tr key={noti.id}>
                    <td>
                      <strong>{noti.userEmail}</strong>
                      {noti.gameUsername && <div style={{ fontSize: '0.65rem', color: 'var(--gold-primary)' }}>({noti.gameUsername})</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                        <span className="admin-badge-preview b-hot" style={{ fontSize: '0.65rem' }}>{noti.gameTitle}</span>
                        {noti.isFreeplayWithdraw && (
                          <div style={{ fontSize: '0.55rem', color: '#ff4d6d', fontWeight: 'bold', marginTop: '0.15rem', display: 'inline-block' }}>
                            ⚠️ FREEPLAY WIN: MAX PAYOUT $30
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.725rem', color: '#ff4d6d', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        withdraw
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#ff4d6d', fontSize: '0.85rem' }}>
                        {Math.abs(noti.totalCoins).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      {noti.distributorType === 'B' ? (
                        <span className="admin-badge-preview b-hold" style={{ fontSize: '0.65rem', background: '#3b82f6', color: '#fff', border: '1px solid rgba(59,130,246,0.3)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          Managed by {noti.distributorName || 'Distributor'}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleCoinAllotmentSuccess(noti.id)}
                            disabled={processingCoinId === noti.id}
                            className="submit-btn"
                            style={{ background: '#e11d48', color: '#fff', margin: 0, padding: '0.35rem 0.85rem', width: 'auto', fontSize: '0.7rem', fontWeight: 'bold' }}
                          >
                            Withdrawal
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
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
