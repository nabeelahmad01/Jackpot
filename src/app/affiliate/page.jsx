'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function AffiliatePortal() {
  const [mounted, setMounted] = useState(false);
  const [agentSession, setAgentSession] = useState(null);

  // Login credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Change Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changePwLoading, setChangePwLoading] = useState(false);

  // Withdraw Commission
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawName, setWithdrawName] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawBank, setWithdrawBank] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Invite link copy
  const [copiedLink, setCopiedLink] = useState(false);

  // Ads Request form
  const [adsMsg, setAdsMsg] = useState('');
  const [adsLoading, setAdsLoading] = useState(false);

  // Sync tab to URL path
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetPath = `/affiliate/${activeTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [activeTab]);

  // Sync popstate to tab
  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 1) {
        setActiveTab(parts[1]);
      } else {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('popstate', handlePathChange);
    handlePathChange();
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // Mount and session restore
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('jackpot_agent_session');
    if (saved) {
      setAgentSession(JSON.parse(saved));
    }
  }, []);

  // Stats SWR (only when logged in)
  const agentCode = agentSession?.agentCode;
  const { data: statsData, mutate: mutateStats } = useSWR(
    agentCode ? `/api/agents/stats?agentCode=${encodeURIComponent(agentCode)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const stats = statsData?.stats || {};
  const players = statsData?.players || [];
  const commissionWithdrawals = statsData?.commissionWithdrawals || [];

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/agents/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('jackpot_agent_session', JSON.stringify(data.agent));
        setAgentSession(data.agent);
        setActiveTab('dashboard');
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

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('jackpot_agent_session');
    setAgentSession(null);
  };

  // Copy invite link
  const handleCopyInvite = () => {
    const link = `${window.location.origin}/agent-player-login?agent=${agentSession?.agentCode || ''}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Commission withdraw request
  const handleWithdrawRequest = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (amount > (stats.availableBalance || 0)) {
      alert('Amount exceeds available balance.');
      return;
    }
    setWithdrawLoading(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: agentSession.email,
          type: 'COMMISSION_WITHDRAW',
          amount: amount,
          gateway: withdrawBank || 'Bank Transfer',
          code: `AGENT-COMM-${agentSession.agentCode}`,
          status: 'PENDING',
          note: `Agent Commission Cashout - ${withdrawName || agentSession.name} - Acc: ${withdrawAccount || 'N/A'}`,
          date: new Date().toISOString()
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('Withdrawal request submitted successfully! It will be processed shortly.');
        setWithdrawAmount('');
        setWithdrawName('');
        setWithdrawAccount('');
        setWithdrawBank('');
        mutateStats();
      } else {
        alert(data.message || 'Failed to submit withdrawal request.');
      }
    } catch (err) {
      console.error(err);
      alert('Connection error submitting request.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Change password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) {
      alert('All password fields are required.');
      return;
    }
    if (newPw !== confirmPw) {
      alert('New password and confirm password do not match.');
      return;
    }
    if (newPw.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }
    setChangePwLoading(true);
    try {
      // Verify current password by attempting login
      const verifyRes = await fetch('/api/agents/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agentSession.email, password: currentPw })
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        alert('Current password is incorrect.');
        setChangePwLoading(false);
        return;
      }
      // Update password
      const updateRes = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentSession.id, password: newPw })
      });
      const updateData = await updateRes.json();
      if (updateData.success) {
        alert('Password changed successfully!');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        alert(updateData.message || 'Failed to change password.');
      }
    } catch (err) {
      console.error(err);
      alert('Error changing password.');
    } finally {
      setChangePwLoading(false);
    }
  };

  if (!mounted) return null;

  /* ===================== LOGIN SCREEN ===================== */
  if (!agentSession) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #040509 0%, #0a0c1a 50%, #0d0f25 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "var(--font-body), 'Inter', sans-serif"
      }}>
        <div className="aurora-bg"></div>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(11, 13, 22, 0.8)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 215, 0, 0.15)',
          borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.05)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <i className="fa-solid fa-user-tie" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)', marginBottom: '0.75rem', display: 'block' }}></i>
            <h2 style={{ color: 'var(--gold-primary)', fontWeight: '800', fontSize: '1.75rem', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-heading)' }}>
              Affiliate Login
            </h2>
            <p style={{ color: '#888', fontSize: '0.8rem' }}>
              Access your affiliate performance portal and referral analytics.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.6rem', borderRadius: '8px', fontSize: '0.75rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i> {loginError}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.6rem 0.85rem' }}>
                <i className="fa-solid fa-envelope" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                <input
                  type="email"
                  placeholder="name@affiliate.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Access Password</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.6rem 0.85rem' }}>
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

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: 'linear-gradient(135deg, var(--gold-primary), #d4a017)',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: isLoggingIn ? 'wait' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(255, 215, 0, 0.25)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ===================== MAIN DASHBOARD ===================== */

  // Helper: stat card renderer
  const StatCard = ({ icon, iconBg, label, value, valueColor }) => (
    <div className="stat-card" style={{ background: '#0b0d16', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg || 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
          <i className={icon}></i>
        </div>
      </div>
      <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: valueColor || '#fff' }}>{value}</div>
    </div>
  );

  return (
    <div className="admin-dashboard-layout" style={{ minHeight: '100vh', background: '#060812', color: '#fff', fontFamily: "var(--font-body), 'Inter', sans-serif" }}>
      
      {/* MOBILE HAMBURGER */}
      <button
        className="admin-mobile-hamburger"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 3000, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '8px', color: 'var(--gold-primary)', padding: '0.5rem 0.65rem', cursor: 'pointer', fontSize: '1.1rem', display: 'none' }}
      >
        <i className={sidebarOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
      </button>

      {/* SIDEBAR */}
      <aside className={`admin-sidebar-nav ${sidebarOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <i className="fa-solid fa-user-tie" style={{ fontSize: '1.5rem', color: 'var(--gold-primary)' }}></i>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>
              Affiliate Portal
            </h2>
            <span style={{ fontSize: '0.55rem', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', padding: '0.1rem 0.3rem', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 'bold', display: 'inline-block', marginTop: '0.15rem' }}>
              Agent Network
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
          {[
            { id: 'dashboard', icon: 'fa-solid fa-chart-line', label: 'Dashboard' },
            { id: 'team', icon: 'fa-solid fa-users', label: 'Team' },
            { id: 'daily_transactions', icon: 'fa-solid fa-clock-rotate-left', label: 'Daily Transactions' },
            { id: 'signup_report', icon: 'fa-solid fa-clipboard-list', label: 'Signup Report' },
            { id: 'ads_request', icon: 'fa-solid fa-bullhorn', label: 'Ads Request' },
            { id: 'change_password', icon: 'fa-solid fa-key', label: 'Change Password' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === item.id ? 'var(--gold-primary)' : 'none',
                color: activeTab === item.id ? '#000' : '#fff',
                border: 'none',
                padding: '0.7rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className={item.icon} style={{ width: '16px' }}></i>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{agentSession.name}</div>
            <div style={{ fontSize: '0.6rem', color: '#888' }}>{agentSession.email}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginTop: '0.15rem' }}>Code: {agentSession.agentCode}</div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <i className="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main-workspace" style={{ padding: '2rem', overflowY: 'auto' }}>

        {/* ============== TAB: DASHBOARD ============== */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Welcome Header */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>AFFILIATE PERFORMANCE PORTAL</span>
              <h1 style={{ fontSize: '2rem', fontWeight: '900', fontFamily: 'var(--font-heading)', margin: '0.25rem 0' }}>
                Welcome back,<br />{agentSession.name}
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#888' }}>
                Agent account • Commission rate {agentSession.commissionRate || 0}%.
                <br />Showing only your direct-link players.
              </p>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginTop: '0.5rem' }}>
                ${(stats.availableBalance || 0).toFixed(2)}
              </h2>
              <span style={{ fontSize: '0.7rem', color: '#888' }}>Available Balance</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('daily_transactions')} className="submit-btn" style={{ background: '#2ecc71', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                  <i className="fa-solid fa-money-bill-transfer" style={{ marginRight: '0.3rem' }}></i> Withdraw
                </button>
                <button onClick={() => setActiveTab('daily_transactions')} className="submit-btn" style={{ background: 'rgba(255,215,0,0.15)', color: 'var(--gold-primary)', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(255,215,0,0.2)', cursor: 'pointer' }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '0.3rem' }}></i> Daily Transactions
                </button>
                <button onClick={() => setActiveTab('team')} className="submit-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  <i className="fa-solid fa-users" style={{ marginRight: '0.3rem' }}></i> Team
                </button>
                <button onClick={handleLogout} className="submit-btn" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                  <i className="fa-solid fa-right-from-bracket" style={{ marginRight: '0.3rem' }}></i> Logout
                </button>
              </div>
            </div>

            {/* Invite Link Card */}
            <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem', maxWidth: '450px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Your Invite Link</h3>
              <p style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.75rem' }}>Share this link with players. New signups will be tracked under your agent account.</p>
              <div style={{ background: '#040509', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem', color: '#ccc', wordBreak: 'break-all', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/agent-player-login?agent=${agentSession.agentCode}` : ''}
              </div>
              <button
                onClick={handleCopyInvite}
                style={{ width: '100%', background: copiedLink ? '#2ecc71' : 'var(--gold-primary)', color: copiedLink ? '#fff' : '#000', border: 'none', borderRadius: '8px', padding: '0.55rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s ease' }}
              >
                {copiedLink ? '✓ Copied!' : 'Copy Invite Link'}
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <div style={{ flex: 1, background: '#040509', borderRadius: '8px', padding: '0.75rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.15rem' }}>DIRECT</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stats.totalPlayers || 0}</div>
                </div>
                <div style={{ flex: 1, background: '#040509', borderRadius: '8px', padding: '0.75rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.15rem' }}>REFERRAL</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '900' }}>0</div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.75rem', color: '#f87171', marginBottom: '1.5rem' }}>
              Dashboard totals below show your own direct-link players and all agents under you.
            </div>

            {/* Stats Cards Grid - Row 1: Player Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <StatCard icon="fa-solid fa-users" iconBg="rgba(168,85,247,0.1)" label="TOTAL PLAYERS" value={stats.totalPlayers || 0} valueColor="#a855f7" />
              <StatCard icon="fa-solid fa-user-check" iconBg="rgba(46,204,113,0.1)" label="VERIFIED PLAYERS" value={stats.verifiedPlayers || 0} valueColor="#2ecc71" />
              <StatCard icon="fa-solid fa-triangle-exclamation" iconBg="rgba(239,68,68,0.1)" label="UNVERIFIED PLAYERS" value={stats.unverifiedPlayers || 0} valueColor="#ef4444" />
              <StatCard icon="fa-solid fa-user-plus" iconBg="rgba(59,130,246,0.1)" label="DEPOSITING PLAYERS" value={stats.depositingPlayers || 0} valueColor="#3b82f6" />
            </div>

            {/* Stats Cards Grid - Row 2: Financial Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <StatCard icon="fa-solid fa-coins" iconBg="rgba(255,215,0,0.1)" label="TOTAL DEPOSIT" value={`$${(stats.totalDeposits || 0).toFixed(2)}`} valueColor="#2ecc71" />
              <StatCard icon="fa-solid fa-money-bill-wave" iconBg="rgba(234,179,8,0.1)" label="TOTAL CASHOUT" value={`$${(stats.totalWithdrawals || 0).toFixed(2)}`} valueColor="#ef4444" />
              <StatCard icon="fa-solid fa-chart-bar" iconBg="rgba(139,92,246,0.1)" label="NET PROFIT" value={`$${(stats.netProfit || 0).toFixed(2)}`} />
              <StatCard icon="fa-solid fa-coins" iconBg="rgba(59,130,246,0.1)" label="TOTAL COINS USED" value="0.00" />
            </div>

            {/* Stats Cards Grid - Row 3: Today Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <StatCard icon="fa-solid fa-arrow-down" iconBg="rgba(46,204,113,0.1)" label="TODAY DEPOSIT" value={`$${(stats.todayDeposits || 0).toFixed(2)}`} valueColor="#2ecc71" />
              <StatCard icon="fa-solid fa-arrow-up" iconBg="rgba(234,179,8,0.1)" label="TODAY CASHOUT" value={`$${(stats.todayWithdrawals || 0).toFixed(2)}`} valueColor="#ef4444" />
              <StatCard icon="fa-solid fa-money-check-dollar" iconBg="rgba(139,92,246,0.1)" label="TOTAL WITHDRAWN" value={`$${(stats.totalWithdrawn || 0).toFixed(2)}`} />
              <StatCard icon="fa-solid fa-hourglass-half" iconBg="rgba(59,130,246,0.1)" label="PENDING WITHDRAWALS" value={`$${(stats.pendingWithdrawals || 0).toFixed(2)}`} />
            </div>

            {/* Stats Cards Grid - Row 4: Commissions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <StatCard icon="fa-solid fa-hand-holding-dollar" iconBg="rgba(255,215,0,0.1)" label="ACCOUNT SHARE" value={`$${(stats.commissionEarned || 0).toFixed(2)}`} valueColor="#2ecc71" />
              <StatCard icon="fa-solid fa-wallet" iconBg="rgba(46,204,113,0.15)" label="AVAILABLE BALANCE" value={`$${(stats.availableBalance || 0).toFixed(2)}`} valueColor="#2ecc71" />
              <StatCard icon="fa-solid fa-user" iconBg="rgba(59,130,246,0.1)" label="DIRECT PLAYERS" value={stats.totalPlayers || 0} />
            </div>

            {/* Withdrawal History */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Withdrawal History</h2>
                <button
                  onClick={() => setActiveTab('daily_transactions')}
                  style={{ background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Request
                </button>
              </div>

              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>AMOUNT</th>
                      <th>NAME</th>
                      <th>ACCOUNT</th>
                      <th>BANK</th>
                      <th>STATUS</th>
                      <th>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionWithdrawals.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                          No withdrawal history found.
                        </td>
                      </tr>
                    ) : (
                      commissionWithdrawals.map((tx, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 'bold' }}>${parseFloat(tx.amount || 0).toFixed(2)}</td>
                          <td>{agentSession.name}</td>
                          <td>{tx.note?.match(/Acc: (.+)/)?.[1] || 'N/A'}</td>
                          <td>{tx.gateway || 'N/A'}</td>
                          <td>
                            <span className={`admin-badge-preview b-${tx.status?.toLowerCase() === 'success' ? 'ready' : tx.status?.toLowerCase() === 'pending' ? 'hot' : 'none'}`}>
                              {tx.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.65rem', color: '#888' }}>{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============== TAB: TEAM ============== */}
        {activeTab === 'team' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Team Overview</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>All players registered through your invite link.</p>

            <div className="table-responsive">
              <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Total Deposits</th>
                    <th>Total Cashouts</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>
                        No players registered under your affiliate code yet.
                      </td>
                    </tr>
                  ) : (
                    players.map((player, idx) => (
                      <tr key={player.id || idx}>
                        <td style={{ fontWeight: 'bold', color: 'var(--gold-primary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{player.name}</td>
                        <td style={{ color: '#aaa', fontSize: '0.7rem' }}>{player.email}</td>
                        <td>
                          <span className={`admin-badge-preview b-${player.status?.toLowerCase() === 'active' ? 'ready' : 'none'}`}>
                            {player.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#2ecc71' }}>${parseFloat(player.totalDeposits || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold', color: '#ef4444' }}>${parseFloat(player.totalWithdrawals || 0).toFixed(2)}</td>
                        <td style={{ fontSize: '0.65rem', color: '#888' }}>{player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== TAB: DAILY TRANSACTIONS (Withdrawal Request) ============== */}
        {activeTab === 'daily_transactions' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Daily Transactions & Withdraw</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>Request commission payouts and track withdrawal history.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem' }}>
              {/* Left: Request Form */}
              <div className="section-card" style={{ height: 'fit-content' }}>
                <h3 className="section-card-title">Request Withdrawal</h3>
                <p style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.5rem' }}>
                  Available Balance: <strong style={{ color: 'var(--gold-primary)' }}>${(stats.availableBalance || 0).toFixed(2)}</strong>
                </p>

                <form onSubmit={handleWithdrawRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.7rem' }}>Amount ($)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50.00"
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      max={stats.availableBalance || 0}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.7rem' }}>Account Holder Name</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={withdrawName}
                      onChange={(e) => setWithdrawName(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.7rem' }}>Account Number / Tag</label>
                    <input
                      type="text"
                      placeholder="Account number"
                      value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.7rem' }}>Bank / Payment Method</label>
                    <input
                      type="text"
                      placeholder="e.g. CashApp, Venmo"
                      value={withdrawBank}
                      onChange={(e) => setWithdrawBank(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                      required
                    />
                  </div>
                  <button type="submit" className="submit-btn" disabled={withdrawLoading} style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                    {withdrawLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              </div>

              {/* Right: Withdrawal History */}
              <div className="section-card">
                <h3 className="section-card-title">Withdrawal History</h3>
                <div className="table-responsive">
                  <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th>AMOUNT</th>
                        <th>NAME</th>
                        <th>ACCOUNT</th>
                        <th>BANK</th>
                        <th>STATUS</th>
                        <th>DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionWithdrawals.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                            No withdrawal history found.
                          </td>
                        </tr>
                      ) : (
                        commissionWithdrawals.map((tx, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 'bold' }}>${parseFloat(tx.amount || 0).toFixed(2)}</td>
                            <td>{agentSession.name}</td>
                            <td>{tx.note?.match(/Acc: (.+)/)?.[1] || 'N/A'}</td>
                            <td>{tx.gateway || 'N/A'}</td>
                            <td>
                              <span className={`admin-badge-preview b-${tx.status?.toLowerCase() === 'success' ? 'ready' : tx.status?.toLowerCase() === 'pending' ? 'hot' : 'none'}`}>
                                {tx.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.65rem', color: '#888' }}>{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============== TAB: SIGNUP REPORT ============== */}
        {activeTab === 'signup_report' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Signup Report</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>All player registrations through your invite link.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <StatCard icon="fa-solid fa-users" iconBg="rgba(168,85,247,0.1)" label="TOTAL SIGNUPS" value={stats.totalPlayers || 0} valueColor="#a855f7" />
              <StatCard icon="fa-solid fa-user-check" iconBg="rgba(46,204,113,0.1)" label="VERIFIED" value={stats.verifiedPlayers || 0} valueColor="#2ecc71" />
              <StatCard icon="fa-solid fa-user-plus" iconBg="rgba(59,130,246,0.1)" label="DEPOSITING" value={stats.depositingPlayers || 0} valueColor="#3b82f6" />
            </div>

            <div className="table-responsive">
              <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>First Deposit</th>
                    <th>Signup Date</th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>
                        No signups found under your affiliate code.
                      </td>
                    </tr>
                  ) : (
                    players.map((player, idx) => (
                      <tr key={player.id || idx}>
                        <td style={{ fontWeight: 'bold', color: 'var(--gold-primary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{player.name}</td>
                        <td style={{ color: '#aaa', fontSize: '0.7rem' }}>{player.email}</td>
                        <td>
                          <span className={`admin-badge-preview b-${(player.totalDeposits || 0) > 0 ? 'ready' : 'none'}`}>
                            {(player.totalDeposits || 0) > 0 ? 'DEPOSITING' : 'REGISTERED'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#2ecc71' }}>${parseFloat(player.totalDeposits || 0).toFixed(2)}</td>
                        <td style={{ fontSize: '0.65rem', color: '#888' }}>{player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== TAB: ADS REQUEST ============== */}
        {activeTab === 'ads_request' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Ads Request</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>Submit marketing material or advertisement requests to admin.</p>

            <div className="section-card" style={{ maxWidth: '500px' }}>
              <h3 className="section-card-title">Submit Request</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!adsMsg.trim()) { alert('Please enter your request message.'); return; }
                setAdsLoading(true);
                try {
                  // Using support tickets system for ads requests
                  const res = await fetch('/api/support', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: agentSession.email,
                      name: agentSession.name,
                      message: `[ADS REQUEST from Agent ${agentSession.agentCode}]\n\n${adsMsg}`,
                      subject: 'Affiliate Ads Request'
                    })
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert('Ads request submitted successfully! Admin will review it.');
                    setAdsMsg('');
                  } else {
                    alert(data.message || 'Failed to submit request.');
                  }
                } catch (err) {
                  console.error(err);
                  alert('Error submitting request.');
                } finally {
                  setAdsLoading(false);
                }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.7rem' }}>Request Details</label>
                  <textarea
                    placeholder="Describe the marketing material or ad campaign you need..."
                    value={adsMsg}
                    onChange={(e) => setAdsMsg(e.target.value)}
                    rows={6}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.6rem', borderRadius: '8px', fontSize: '0.75rem', outline: 'none', resize: 'vertical' }}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={adsLoading} style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                  {adsLoading ? 'Submitting...' : 'Submit Ads Request'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============== TAB: CHANGE PASSWORD ============== */}
        {activeTab === 'change_password' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Change Password</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>Update your affiliate portal access credentials.</p>

            <div className="section-card" style={{ maxWidth: '420px' }}>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.7rem' }}>Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                    required
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '0.7rem' }}>New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                    required
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '0.7rem' }}>Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={changePwLoading} style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                  {changePwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
