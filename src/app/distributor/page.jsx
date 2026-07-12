'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import TxSearchTab from '../../components/admin/TxSearchTab';
import SupportTab from '../../components/admin/SupportTab';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function DistributorPortal() {
  const [mounted, setMounted] = useState(false);
  const [distSession, setDistSession] = useState(null);
  const [proofModalUrl, setProofModalUrl] = useState('');

  const handleInspectProof = (url) => {
    if (url) setProofModalUrl(url);
  };

  // Login credentials states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sidebar navigation tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Stats SWR
  const distId = distSession?.id;
  const { data: statsData, mutate: mutateStats } = useSWR(
    distId ? `/api/distributors/stats?distributorId=${distId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Gateways SWR (For Type B)
  const { data: gatewaysData, mutate: mutateGateways } = useSWR(
    distId && distSession?.type === 'B' ? `/api/distributors/gateways?distributorId=${distId}` : null,
    fetcher
  );

  // Staff SWR (For Type B)
  const { data: staffData, mutate: mutateStaff } = useSWR(
    distId && distSession?.type === 'B' ? `/api/distributors/staff?distributorId=${distId}` : null,
    fetcher
  );

  // Dynamic operations queues (Requests & Coins check for Type B players)
  const { data: allRequestsData, mutate: mutateAllRequests } = useSWR(
    distId && distSession?.type === 'B' ? `/api/account-requests?adminRole=distributor&adminDistributorId=${distId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: allCoinsData, mutate: mutateAllCoins } = useSWR(
    distId && distSession?.type === 'B' ? `/api/coins-notifications?adminRole=distributor&adminDistributorId=${distId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: commTxData, mutate: mutateCommTx } = useSWR(
    distSession ? `/api/transactions?email=${encodeURIComponent(distSession.email)}&type=COMMISSION_WITHDRAW` : null,
    fetcher
  );

  // Filter player queues to show only referred players' requests
  const players = statsData?.players || [];
  const playerEmails = players.map(p => (p.email || '').toLowerCase().trim()).filter(Boolean);

  const referredRequests = (allRequestsData?.accountRequests || []).filter(req =>
    req.email && playerEmails.includes(req.email.toLowerCase().trim())
  );

  const referredCoins = (allCoinsData?.coinsNotifications || []).filter(noti =>
    noti.email && playerEmails.includes(noti.email.toLowerCase().trim())
  );

  // Form states for creating Gateway (Type B)
  const [gwName, setGwName] = useState('');
  const [gwSubtitle, setGwSubtitle] = useState('');
  const [gwTag, setGwTag] = useState('');
  const [gwPhone, setGwPhone] = useState('');
  const [gwTheme, setGwTheme] = useState('cashapp');
  const [gwQr, setGwQr] = useState('');
  const [gwWithdraw, setGwWithdraw] = useState(false);
  const [isSubmittingGateway, setIsSubmittingGateway] = useState(false);

  // Form states for creating Staff (Type B)
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('coins_admin');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // Commission Withdraw Form States
  const [commAmount, setCommAmount] = useState('');
  const [commGateway, setCommGateway] = useState('Chime');
  const [commCode, setCommCode] = useState('');
  const [isSubmittingComm, setIsSubmittingComm] = useState(false);
  const [commMsg, setCommMsg] = useState('');

  // Invalidation reason modal (Type B allotments)
  const [invalidatingNoti, setInvalidatingNoti] = useState(null);
  const [holdReason, setHoldReason] = useState('');

  // Referral Link copy
  const [copiedLink, setCopiedLink] = useState(false);

  const handleRequestCommWithdraw = async (e) => {
    e.preventDefault();
    if (!commAmount || !commCode) return;
    const reqVal = parseFloat(commAmount);
    if (isNaN(reqVal) || reqVal <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    
    const commWithdrawals = commTxData?.transactions || [];
    const totalWithdrawn = commWithdrawals.filter(tx => tx.status === 'SUCCESS' || tx.status === 'PENDING').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const availableCommission = Math.max(0, (stats.commissionEarned || 0) - totalWithdrawn);

    if (reqVal > availableCommission) {
      alert('Request amount exceeds available commission.');
      return;
    }

    setIsSubmittingComm(true);
    setCommMsg('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: distSession.email,
          amount: reqVal,
          gateway: commGateway,
          code: commCode,
          type: 'COMMISSION_WITHDRAW',
          gameTitle: 'Distributor Payout',
          status: 'PENDING'
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommAmount('');
        setCommCode('');
        setCommMsg('Commission payout request submitted successfully!');
        mutateCommTx();
      } else {
        setCommMsg(data.message || 'Request failed.');
      }
    } catch (err) {
      setCommMsg('Server error submitting request.');
    } finally {
      setIsSubmittingComm(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('jackpot_distributor_session');
    if (saved) {
      setDistSession(JSON.parse(saved));
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/distributors/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('jackpot_distributor_session', JSON.stringify(data.distributor));
        setDistSession(data.distributor);
        setActiveTab('overview');
      } else {
        setLoginError(data.message || 'Invalid credentials.');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Connection failure.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jackpot_distributor_session');
    setDistSession(null);
  };

  // Add Gateway (Type B)
  const handleAddGateway = async (e) => {
    e.preventDefault();
    if (!gwName.trim() || !gwTag.trim()) {
      alert('Gateway Name and tag are required.');
      return;
    }
    setIsSubmittingGateway(true);
    try {
      const res = await fetch('/api/distributors/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: gwName.trim(),
          subtitle: gwSubtitle.trim(),
          tag: gwTag.trim(),
          phone: gwPhone.trim(),
          theme: gwTheme,
          qrImage: gwQr.trim() || undefined,
          isWithdrawActive: gwWithdraw,
          distributorId: distId
        })
      });
      const data = await res.json();
      if (data.success) {
        setGwName('');
        setGwSubtitle('');
        setGwTag('');
        setGwPhone('');
        setGwQr('');
        setGwWithdraw(false);
        mutateGateways();
        alert('Gateway created successfully!');
      } else {
        alert(data.message || 'Failed to create gateway.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingGateway(false);
    }
  };

  // Delete Gateway (Type B)
  const handleDeleteGateway = async (id) => {
    if (window.confirm('Delete this payment gateway?')) {
      try {
        const res = await fetch(`/api/distributors/gateways?id=${id}&distributorId=${distId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          mutateGateways();
          alert('Gateway deleted.');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Add Staff (Type B)
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      alert('Please fill out all staff fields.');
      return;
    }
    setIsSubmittingStaff(true);
    try {
      const res = await fetch('/api/distributors/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffName.trim(),
          email: staffEmail.toLowerCase().trim(),
          password: staffPassword.trim(),
          role: staffRole,
          distributorId: distId
        })
      });
      const data = await res.json();
      if (data.success) {
        setStaffName('');
        setStaffEmail('');
        setStaffPassword('');
        mutateStaff();
        alert('Staff account registered successfully!');
      } else {
        alert(data.message || 'Failed to register staff.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Delete Staff (Type B)
  const handleDeleteStaff = async (staffEmailAddress) => {
    if (window.confirm(`Delete staff registry account "${staffEmailAddress}"?`)) {
      try {
        const res = await fetch(`/api/distributors/staff?email=${staffEmailAddress}&distributorId=${distId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          mutateStaff();
          alert('Staff account deleted.');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Approve Credentials Request (Type B)
  const handleApproveRequest = async (reqId, gameAccountUsername, gameAccountPassword) => {
    const username = prompt("Enter Game Username:", gameAccountUsername || "");
    const password = prompt("Enter Game Password:", gameAccountPassword || "12345");
    if (!username || !password) return;

    try {
      const res = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId, status: 'COMPLETED', gameAccountUsername: username, gameAccountPassword: password, processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        mutateAllRequests();
        alert('Credentials approved and dispatched!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reject Credentials Request (Type B)
  const handleRejectRequest = async (reqId) => {
    const reason = prompt("Enter Rejection Reason:");
    if (!reason) return;

    try {
      const res = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId, status: 'FAILED', rejectionReason: reason, processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        mutateAllRequests();
        alert('Credentials request rejected.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Complete Coin Allotment / Loading (Type B)
  const handleCompleteAllotment = async (noti) => {
    if (!window.confirm("Complete this coin transaction?")) return;
    try {
      const res = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noti.id, status: 'COMPLETED', processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        mutateAllCoins();
        mutateStats();
        alert('Coin loading processed successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Invalidate Coin Allotment / Loading (Type B)
  const handleInvalidateAllotment = async (e) => {
    e.preventDefault();
    if (!holdReason.trim()) return;

    try {
      const res = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invalidatingNoti.id, status: 'HOLD', holdNote: holdReason.trim(), processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        setInvalidatingNoti(null);
        setHoldReason('');
        mutateAllCoins();
        mutateStats();
        alert('Allotment request invalidated.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy Referral link
  const copyReferralLink = () => {
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    const referralLink = `${domain}/?dist=${distId}`;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!mounted) return null;

  // 1) LOGIN SCREEN
  if (!distSession) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#040509 url("/gold_particles_pattern.png") no-repeat center/cover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(11, 13, 22, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 215, 0, 0.15)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          padding: '2.5rem 2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: 'var(--gold-primary)', fontWeight: '800', fontSize: '1.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Distributor Login
          </h2>
          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '2rem' }}>
            Access your custom panel and referral analytics dashboard.
          </p>

          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.6rem', borderRadius: '8px', fontSize: '0.75rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i> {loginError}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <i className="fa-solid fa-envelope" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                <input
                  type="email"
                  placeholder="name@distributor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Access Password</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <i className="fa-solid fa-lock" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                  required
                />
              </div>
            </div>

            <button type="submit" style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'LOGGING IN...' : 'LOGIN TO PORTAL ➔'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2) MAIN PORTAL LAYOUT
  const stats = statsData?.stats || {};
  const referredTransactions = statsData?.transactions || [];

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '260px 1fr', background: '#060812', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside style={{ background: '#0b0d16', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--gold-primary)', fontWeight: '900', letterSpacing: '0.5px', fontSize: '1.25rem', textTransform: 'uppercase' }}>
            Jackpot Royal
          </h3>
          <span style={{ fontSize: '0.6rem', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Distributor Portal
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'overview' ? 'var(--gold-primary)' : 'none', color: activeTab === 'overview' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
          >
            <i className="fa-solid fa-chart-line" style={{ width: '16px' }}></i>
            Overview & Analytics
          </button>

          <button
            onClick={() => setActiveTab('tx_logs')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'tx_logs' ? 'var(--gold-primary)' : 'none', color: activeTab === 'tx_logs' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
          >
            <i className="fa-solid fa-clock-rotate-left" style={{ width: '16px' }}></i>
            Transaction Logs
          </button>

          {distSession.type === 'B' && (
            <>
              <button
                onClick={() => setActiveTab('gateways')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'gateways' ? 'var(--gold-primary)' : 'none', color: activeTab === 'gateways' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
              >
                <i className="fa-solid fa-wallet" style={{ width: '16px' }}></i>
                My Gateways
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'staff' ? 'var(--gold-primary)' : 'none', color: activeTab === 'staff' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
              >
                <i className="fa-solid fa-user-shield" style={{ width: '16px' }}></i>
                My Staff
              </button>

              <button
                onClick={() => setActiveTab('operations')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: activeTab === 'operations' ? 'var(--gold-primary)' : 'none',
                  color: activeTab === 'operations' ? '#000' : '#fff',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  textAlign: 'left'
                }}
              >
                <i className="fa-solid fa-circle-play" style={{ width: '16px' }}></i>
                Operations Queue
                {(referredRequests.length + referredCoins.length) > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.625rem', padding: '0.15rem 0.35rem', borderRadius: '10px' }}>
                    {referredRequests.length + referredCoins.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('support')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: activeTab === 'support' ? 'var(--gold-primary)' : 'none',
                  color: activeTab === 'support' ? '#000' : '#fff',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  textAlign: 'left'
                }}
              >
                <i className="fa-solid fa-headset" style={{ width: '16px' }}></i>
                Live Chat Support
              </button>
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{distSession.name}</div>
            <div style={{ fontSize: '0.65rem', color: '#888' }}>{distSession.email}</div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
            Log Out Panel
          </button>
        </div>
      </aside>

      {/* PORTAL BODY CONTAINER */}
      <main style={{ padding: '2rem', overflowY: 'auto' }}>
        
        {/* TAB: TRANSACTION LOGS */}
        {activeTab === 'tx_logs' && (
          <TxSearchTab 
            onInspectProof={handleInspectProof} 
            adminUser={{
              role: distSession?.role || 'distributor',
              distributorId: distId
            }} 
          />
        )}

        {/* TAB: SUPPORT CHAT */}
        {activeTab === 'support' && (
          <SupportTab
            adminUser={{
              email: distSession?.email || '',
              role: distSession?.role || 'distributor',
              distributorId: distId
            }}
          />
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>Overview & Analytics</h1>
                <p style={{ fontSize: '0.75rem', color: '#888' }}>Track your referred players, deposits, and commission summaries.</p>
              </div>

              {/* REFERRAL LINK COPY CARD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0b0d16', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>Referral Link:</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontFamily: 'monospace' }}>?dist={distId}</span>
                <button onClick={copyReferralLink} style={{ background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {copiedLink ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>

            {/* METRICS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Referred Players</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#fff', marginTop: '0.25rem' }}>{stats.playersCount || 0}</div>
              </div>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Deposits</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#2ecc71', marginTop: '0.25rem' }}>${(stats.totalDeposits || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Withdrawals</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ef4444', marginTop: '0.25rem' }}>${(stats.totalWithdrawals || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>My Commission ({stats.commissionRate || 0}%)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--gold-primary)', marginTop: '0.25rem' }}>${(stats.commissionEarned || 0).toFixed(2)}</div>
              </div>
            </div>

            {/* TWO COLUMN GRID FOR PLAYERS & LEDGER */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
              {/* PLAYERS LIST */}
              <div style={{ background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-users gold-text"></i> Referred Players ({players.length})
                </h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {players.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '0.75rem', padding: '2rem' }}>No players registered.</div>
                  ) : (
                    players.map(p => (
                      <div key={p.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#040509', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{p.name}</div>
                          <div style={{ fontSize: '0.6rem', color: '#666' }}>{p.email}</div>
                        </div>
                        <span style={{ fontSize: '0.6rem', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TRANSACTIONS HIST */}
              <div style={{ background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-file-invoice-dollar gold-text"></i> Referred Players Transactions History
                </h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                        <th style={{ padding: '0.5rem' }}>PLAYER</th>
                        <th style={{ padding: '0.5rem' }}>TYPE</th>
                        <th style={{ padding: '0.5rem' }}>AMOUNT</th>
                        <th style={{ padding: '0.5rem' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No transactions recorded.</td>
                        </tr>
                      ) : (
                        referredTransactions.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.6rem 0.5rem' }}>{tx.userEmail}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{ color: tx.type === 'DEPOSIT' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>{tx.type}</span>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold' }}>${parseFloat(tx.amount || 0).toFixed(2)}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{
                                padding: '0.15rem 0.35rem',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                fontWeight: 'bold',
                                background: tx.status === 'SUCCESS' ? 'rgba(46,204,113,0.1)' : tx.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(241,196,15,0.1)',
                                color: tx.status === 'SUCCESS' ? '#2ecc71' : tx.status === 'FAILED' ? '#ef4444' : '#f1c40f'
                              }}>{tx.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* COMMISSION CASHOUT COMPONENT */}
            {(() => {
              const commWithdrawals = commTxData?.transactions || [];
              const totalWithdrawn = commWithdrawals.filter(tx => tx.status === 'SUCCESS' || tx.status === 'PENDING').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
              const availableCommission = Math.max(0, (stats.commissionEarned || 0) - totalWithdrawn);

              return (
                <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
                  <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>Request Commission</h3>
                    <p style={{ fontSize: '0.65rem', color: '#888', marginBottom: '1.25rem' }}>
                      Available Balance: <strong style={{ color: 'var(--gold-primary)' }}>${availableCommission.toFixed(2)}</strong>
                    </p>
                    <form onSubmit={handleRequestCommWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="input-group">
                        <label style={{ fontSize: '0.7rem' }}>Amount ($)</label>
                        <input
                          type="number"
                          placeholder="e.g. 50.00"
                          step="0.01"
                          value={commAmount}
                          onChange={(e) => setCommAmount(e.target.value)}
                          max={availableCommission}
                          style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: '0.7rem' }}>Gateway / Method</label>
                        <select
                          value={commGateway}
                          onChange={(e) => setCommGateway(e.target.value)}
                          style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                        >
                          <option value="Chime">Chime</option>
                          <option value="Zelle">Zelle</option>
                          <option value="CashApp">CashApp</option>
                          <option value="PayPal">PayPal</option>
                          <option value="Venmo">Venmo</option>
                        </select>
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: '0.7rem' }}>Payment Address / Tag</label>
                        <input
                          type="text"
                          placeholder="e.g. $cashtag or email"
                          value={commCode}
                          onChange={(e) => setCommCode(e.target.value)}
                          style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                          required
                        />
                      </div>
                      {commMsg && (
                        <p style={{ fontSize: '0.7rem', color: commMsg.includes('success') ? '#2ecc71' : '#ef4444', margin: '0.2rem 0' }}>{commMsg}</p>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingComm || availableCommission <= 0}
                        style={{ width: '100%', padding: '0.6rem', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', opacity: (isSubmittingComm || availableCommission <= 0) ? 0.5 : 1 }}
                      >
                        {isSubmittingComm ? 'Submitting...' : 'Request Cashout ➔'}
                      </button>
                    </form>
                  </div>

                  <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Commission Withdrawal Logs</h3>
                    <div style={{ maxHeight: '310px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                            <th style={{ padding: '0.5rem' }}>DATE</th>
                            <th style={{ padding: '0.5rem' }}>GATEWAY</th>
                            <th style={{ padding: '0.5rem' }}>ADDRESS</th>
                            <th style={{ padding: '0.5rem' }}>AMOUNT</th>
                            <th style={{ padding: '0.5rem' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commWithdrawals.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No commission withdrawals requested.</td>
                            </tr>
                          ) : (
                            commWithdrawals.map(tx => (
                              <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '0.6rem 0.5rem' }}>{tx.date}</td>
                                <td style={{ padding: '0.6rem 0.5rem' }}>{tx.gateway}</td>
                                <td style={{ padding: '0.6rem 0.5rem' }}>{tx.code}</td>
                                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--gold-primary)' }}>${parseFloat(tx.amount || 0).toFixed(2)}</td>
                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                  <span style={{
                                    padding: '0.15rem 0.35rem',
                                    borderRadius: '4px',
                                    fontSize: '0.6rem',
                                    fontWeight: 'bold',
                                    background: tx.status === 'SUCCESS' ? 'rgba(46,204,113,0.1)' : tx.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(241,196,15,0.1)',
                                    color: tx.status === 'SUCCESS' ? '#2ecc71' : tx.status === 'FAILED' ? '#ef4444' : '#f1c40f'
                                  }}>{tx.status}</span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* TAB 2: GATEWAYS MANAGEMENT (TYPE B) */}
        {activeTab === 'gateways' && distSession.type === 'B' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>My Payment Gateways</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Add or delete payment methods visible to your referred players.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Add Gateway</h3>
                <form onSubmit={handleAddGateway}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Gateway Name</label>
                    <input type="text" placeholder="Cash App, Venmo..." value={gwName} onChange={(e) => setGwName(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Subtitle</label>
                    <input type="text" placeholder="Instantly Loaded sweepstakes..." value={gwSubtitle} onChange={(e) => setGwSubtitle(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Payment Tag/Handle</label>
                    <input type="text" placeholder="$username" value={gwTag} onChange={(e) => setGwTag(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Phone Number (Optional)</label>
                    <input type="text" placeholder="+1234..." value={gwPhone} onChange={(e) => setGwPhone(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>QR Code Image (Optional)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (file.size > 3 * 1024 * 1024) {
                              alert('Image is too large. Please select a file smaller than 3MB.');
                              e.target.value = '';
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setGwQr(event.target.result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{ display: 'none' }}
                        id="dist-gw-qr-file"
                      />
                      <label 
                        htmlFor="dist-gw-qr-file"
                        style={{
                          background: '#040509',
                          border: '1px dashed rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          padding: '0.6rem',
                          color: 'var(--gold-primary)',
                          fontSize: '0.75rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'block'
                        }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '0.4rem' }}></i>
                        {gwQr ? 'CHANGE QR IMAGE' : 'CHOOSE QR IMAGE'}
                      </label>
                      {gwQr && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <img src={gwQr} alt="QR Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.625rem', color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>QR Image Selected</span>
                          <button 
                            type="button" 
                            onClick={() => setGwQr('')}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Theme Color</label>
                    <select value={gwTheme} onChange={(e) => setGwTheme(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }}>
                      <option value="cashapp">Green (Cash App)</option>
                      <option value="venmo">Blue (Venmo)</option>
                      <option value="chime">Lime (Chime)</option>
                      <option value="zelle">Purple (Zelle)</option>
                      <option value="apple">Dark/White (Apple Pay)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={gwWithdraw} onChange={(e) => setGwWithdraw(e.target.checked)} style={{ cursor: 'pointer' }} />
                    <label style={{ fontSize: '0.7rem', cursor: 'pointer' }}>Active for Withdrawals</label>
                  </div>

                  <button type="submit" style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '0.5rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }} disabled={isSubmittingGateway}>
                    {isSubmittingGateway ? 'CREATING...' : 'CREATE GATEWAY'}
                  </button>
                </form>
              </div>

              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>My Gateways Catalog</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  {(!gatewaysData?.gateways || gatewaysData.gateways.length === 0) ? (
                    <div style={{ colSpan: 2, color: '#666', fontSize: '0.75rem', padding: '1.5rem', textAlign: 'center', width: '100%' }}>No gateways registered yet.</div>
                  ) : (
                    gatewaysData.gateways.map(g => (
                      <div key={g.id} style={{ border: '1px solid rgba(255,255,255,0.05)', background: '#040509', padding: '1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>{g.name}</strong>
                          <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'monospace', marginTop: '0.15rem' }}>{g.tag}</div>
                          <div style={{ fontSize: '0.625rem', color: '#666', marginTop: '0.25rem' }}>Withdrawals: {g.isWithdrawActive ? 'ACTIVE' : 'INACTIVE'}</div>
                        </div>
                        <button onClick={() => handleDeleteGateway(g.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', border: 'none', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.65rem', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STAFF REGISTRY (TYPE B) */}
        {activeTab === 'staff' && distSession.type === 'B' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>My Staff Management</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Hire staff managers to process credentials and load coins allotments.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Register Staff</h3>
                <form onSubmit={handleAddStaff}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Full Name</label>
                    <input type="text" placeholder="e.g. Coins Handler" value={staffName} onChange={(e) => setStaffName(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Email</label>
                    <input type="email" placeholder="staff@distributor.com" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Password</label>
                    <input type="text" placeholder="StaffPassword123" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Authority Role</label>
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }}>
                      <option value="coins_admin">Coins Admin (Load allotments)</option>
                      <option value="support_admin">Support Admin (Live Chat support)</option>
                      <option value="financial_admin">Financial Admin (Audit ledger)</option>
                    </select>
                  </div>

                  <button type="submit" style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '0.5rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }} disabled={isSubmittingStaff}>
                    {isSubmittingStaff ? 'REGISTERING...' : 'REGISTER STAFF'}
                  </button>
                </form>
              </div>

              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Administrative Staff Registry</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                      <th style={{ padding: '0.5rem' }}>Name</th>
                      <th style={{ padding: '0.5rem' }}>Email</th>
                      <th style={{ padding: '0.5rem' }}>Role Permission</th>
                      <th style={{ padding: '0.5rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!staffData?.staff || staffData.staff.length === 0) ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No staff members registered.</td>
                      </tr>
                    ) : (
                      staffData.staff.map(s => (
                        <tr key={s.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.6rem 0.5rem' }}><strong>{s.name}</strong></td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>{s.email}</td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <span className="admin-badge-preview b-ready" style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}>
                              {s.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <button onClick={() => handleDeleteStaff(s.email)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', border: 'none', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.65rem', cursor: 'pointer' }}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: OPERATIONS QUEUE (TYPE B) */}
        {activeTab === 'operations' && distSession.type === 'B' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Operations Queue</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Process game credentials and loading/withdrawal allotments for your users.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              {/* Credentials Requests */}
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-key gold-text"></i> Player Credentials Requests ({referredRequests.length})
                </h3>
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {referredRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '0.75rem', padding: '2rem' }}>No credentials requests in queue.</div>
                  ) : (
                    referredRequests.map(req => (
                      <div key={req.id} style={{ background: '#040509', border: '1px solid rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.8rem' }}>{req.gameTitle}</strong>
                            <div style={{ fontSize: '0.65rem', color: '#888' }}>{req.email}</div>
                          </div>
                          <span style={{ background: 'rgba(241,196,15,0.1)', color: '#f1c40f', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                            {req.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#aaa', marginBottom: '0.75rem' }}>
                          Name requested: <strong>{req.nameOnGame}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleApproveRequest(req.id, req.gameAccountUsername, req.gameAccountPassword)} style={{ background: '#2ecc71', color: '#000', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            Approve & Send
                          </button>
                          <button onClick={() => handleRejectRequest(req.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Coins Allotments queue */}
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-coins gold-text"></i> Load & Withdrawal Checks ({referredCoins.length})
                </h3>
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {referredCoins.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '0.75rem', padding: '2rem' }}>No allotments requests in queue.</div>
                  ) : (
                    referredCoins.map(noti => (
                      <div key={noti.id} style={{ background: '#040509', border: '1px solid rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.8rem' }}>{noti.gameTitle}</strong>
                            <div style={{ fontSize: '0.65rem', color: '#888' }}>{noti.email}</div>
                            {noti.isFreeplayWithdraw && (
                              <div style={{ fontSize: '0.55rem', color: '#ff4d6d', fontWeight: 'bold', marginTop: '0.2rem' }}>
                                ⚠️ FREEPLAY WIN: MAX PAYOUT $30
                              </div>
                            )}
                          </div>
                          <span style={{
                            background: noti.totalCoins < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(46,204,113,0.15)',
                            color: noti.totalCoins < 0 ? '#f87171' : '#2ecc71',
                            padding: '0.15rem 0.35rem',
                            borderRadius: '4px',
                            fontSize: '0.6rem',
                            fontWeight: 'bold'
                          }}>
                            {noti.totalCoins < 0 ? 'WITHDRAWAL' : 'DEPOSIT'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#aaa', marginBottom: '0.75rem' }}>
                          Coins count: <strong style={{ color: '#fff' }}>{Math.abs(noti.totalCoins)}</strong>
                          {noti.accountNameOnTag && <div>Account Tag: <strong>{noti.accountNameOnTag}</strong></div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleCompleteAllotment(noti)} style={{ background: '#2ecc71', color: '#000', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            Load Complete
                          </button>
                          <button onClick={() => setInvalidatingNoti(noti)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            Mark Invalid
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* INVALIDATE ALLOTMENT MODAL */}
            {invalidatingNoti && (
              <div className="modal-backdrop-custom" onClick={() => setInvalidatingNoti(null)}>
                <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                  <div className="modal-header">
                    <h3>Invalidate Transaction Check</h3>
                    <button type="button" className="close-modal" onClick={() => setInvalidatingNoti(null)}>&times;</button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={handleInvalidateAllotment}>
                      <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Reason for Invalidation</label>
                        <textarea
                          placeholder="e.g. Invalid payment proof details provided."
                          value={holdReason}
                          onChange={(e) => setHoldReason(e.target.value)}
                          style={{ width: '100%', minHeight: '80px', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                          required
                        />
                      </div>
                      <button type="submit" className="submit-btn" style={{ background: '#ef4444', color: '#fff', fontWeight: 'bold' }}>
                        CONFIRM INVALID ➔
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      {proofModalUrl && (
        <div 
          onClick={() => setProofModalUrl('')}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
            <img src={proofModalUrl} alt="Deposit Proof" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', border: '2px solid var(--gold-primary)' }} />
            <button 
              onClick={() => setProofModalUrl('')}
              style={{
                position: 'absolute',
                top: '-2rem',
                right: 0,
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      </main>

    </div>
  );
}
