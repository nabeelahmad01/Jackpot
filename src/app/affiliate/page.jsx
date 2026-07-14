'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

import { SupportModal } from '../../components/Modals';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function AffiliatePortal() {
  const [mounted, setMounted] = useState(false);
  const [agentSession, setAgentSession] = useState(null);
  const [supportOpen, setSupportOpen] = useState(false);

  // Login & Registration credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration states
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegisteringSubmit, setIsRegisteringSubmit] = useState(false);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setRegError('Name, email and password are required.');
      return;
    }
    setRegError('');
    setIsRegisteringSubmit(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.toLowerCase().trim(),
          password: regPassword.trim(),
          commissionRate: 10, // default 10%
          agentCode: regCode.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        // Auto login on successful register
        localStorage.setItem('jackpot_agent_session', JSON.stringify(data.agent));
        setAgentSession(data.agent);
        setActiveTab('dashboard');
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setRegCode('');
        setIsRegistering(false);
      } else {
        setRegError(data.message || 'Registration failed.');
      }
    } catch (err) {
      console.error(err);
      setRegError('Connection failure.');
    } finally {
      setIsRegisteringSubmit(false);
    }
  };

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

  // Ads Campaign Request form states
  const [adsBudget, setAdsBudget] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [facebookLink, setFacebookLink] = useState('');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [campaignNotes, setCampaignNotes] = useState('');
  const [campaignProof, setCampaignProof] = useState('');
  const [adsLoading, setAdsLoading] = useState(false);

  // Daily Transactions date filter
  const [txDate, setTxDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  // Signup Report date range
  const [signupFromDate, setSignupFromDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [signupToDate, setSignupToDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [ownershipFilter, setOwnershipFilter] = useState('All Players');

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
      if (parts.length > 1) setActiveTab(parts[1]);
      else setActiveTab('dashboard');
    };
    window.addEventListener('popstate', handlePathChange);
    handlePathChange();
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // Mount and session restore
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('jackpot_agent_session');
    if (saved) setAgentSession(JSON.parse(saved));
  }, []);

  // Stats SWR
  const agentCode = agentSession?.agentCode;
  const { data: statsData, mutate: mutateStats } = useSWR(
    agentCode ? `/api/agents/stats?agentCode=${encodeURIComponent(agentCode)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: campaignsData, mutate: mutateCampaigns } = useSWR(
    agentSession?.email ? `/api/campaign-requests?agentEmail=${encodeURIComponent(agentSession.email)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: signupReportData, mutate: mutateSignupReport } = useSWR(
    agentCode ? `/api/agents/signup-report?agentCode=${encodeURIComponent(agentCode)}&fromDate=${signupFromDate}&toDate=${signupToDate}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const stats = statsData?.stats || {};
  const players = statsData?.players || [];
  const commissionWithdrawals = statsData?.commissionWithdrawals || [];
  const campaignsList = campaignsData?.campaigns || [];
  const remainingLimit = campaignsData?.remainingLimit !== undefined ? campaignsData.remainingLimit : 6000.00;

  const signupStats = signupReportData?.stats || {};
  const campaignBreakdown = signupReportData?.campaignBreakdown || [];
  const playersList = signupReportData?.playersList || [];

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setLoginError('Please enter both email and password.'); return; }
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
    } catch (err) { console.error(err); setLoginError('Connection failure.'); }
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => { localStorage.removeItem('jackpot_agent_session'); setAgentSession(null); };

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
    if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
    if (amount > (stats.availableBalance || 0)) { alert('Amount exceeds available balance.'); return; }
    setWithdrawLoading(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: agentSession.email, type: 'COMMISSION_WITHDRAW', amount,
          gateway: withdrawBank || 'Bank Transfer',
          code: `AGENT-COMM-${agentSession.agentCode}`, status: 'PENDING',
          note: `Agent Commission Cashout - ${withdrawName || agentSession.name} - Acc: ${withdrawAccount || 'N/A'}`,
          date: new Date().toISOString()
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('Withdrawal request submitted!');
        setWithdrawAmount(''); setWithdrawName(''); setWithdrawAccount(''); setWithdrawBank('');
        mutateStats();
      } else { alert(data.message || 'Failed.'); }
    } catch (err) { console.error(err); alert('Connection error.'); }
    finally { setWithdrawLoading(false); }
  };

  // Change password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) { alert('All password fields are required.'); return; }
    if (newPw !== confirmPw) { alert('Passwords do not match.'); return; }
    if (newPw.length < 6) { alert('Min 6 characters.'); return; }
    setChangePwLoading(true);
    try {
      const verifyRes = await fetch('/api/agents/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agentSession.email, password: currentPw })
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) { alert('Current password is incorrect.'); setChangePwLoading(false); return; }
      const updateRes = await fetch('/api/agents', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentSession.id, password: newPw })
      });
      const updateData = await updateRes.json();
      if (updateData.success) { alert('Password changed!'); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
      else { alert(updateData.message || 'Failed.'); }
    } catch (err) { console.error(err); alert('Error.'); }
    finally { setChangePwLoading(false); }
  };

  if (!mounted) return null;

  /* ===================== LOGIN SCREEN ===================== */
  if (!agentSession) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #040509 0%, #0a0c1a 50%, #0d0f25 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: "var(--font-body), 'Inter', sans-serif" }}>
        <div className="aurora-bg"></div>
        <div style={{ width: '100%', maxWidth: '420px', background: 'rgba(11, 13, 22, 0.8)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 215, 0, 0.15)', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.05)', padding: '2.5rem 2rem', position: 'relative', zIndex: 1 }}>
          
          {!isRegistering ? (
            /* LOGIN VIEW */
            <>
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <i className="fa-solid fa-user-tie" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)', marginBottom: '0.75rem', display: 'block' }}></i>
                <h2 style={{ color: 'var(--gold-primary)', fontWeight: '800', fontSize: '1.75rem', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-heading)' }}>Affiliate Login</h2>
                <p style={{ color: '#888', fontSize: '0.8rem' }}>Access your affiliate performance portal and analytics.</p>
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
                    <input type="email" placeholder="name@affiliate.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }} required />
                  </div>
                </div>
                <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Access Password</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.6rem 0.85rem' }}>
                    <i className="fa-solid fa-lock" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                    <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }} required />
                  </div>
                </div>
                <button type="submit" disabled={isLoggingIn} style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--gold-primary), #d4a017)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem', cursor: isLoggingIn ? 'wait' : 'pointer', boxShadow: '0 4px 20px rgba(255, 215, 0, 0.25)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {isLoggingIn ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
              <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
                Don't have an account?{' '}
                <button onClick={() => { setIsRegistering(true); setLoginError(''); }} style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', fontWeight: 'bold', padding: 0, fontSize: '0.8rem' }}>
                  Register Here
                </button>
              </div>
            </>
          ) : (
            /* REGISTER VIEW */
            <>
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <i className="fa-solid fa-user-plus" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)', marginBottom: '0.75rem', display: 'block' }}></i>
                <h2 style={{ color: 'var(--gold-primary)', fontWeight: '800', fontSize: '1.75rem', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-heading)' }}>Affiliate Register</h2>
                <p style={{ color: '#888', fontSize: '0.8rem' }}>Join our network and start earning commissions.</p>
              </div>
              <form onSubmit={handleRegisterSubmit}>
                {regError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.6rem', borderRadius: '8px', fontSize: '0.75rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i> {regError}
                  </div>
                )}
                <div style={{ marginBottom: '1.1rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.55rem 0.8rem' }}>
                    <i className="fa-solid fa-user" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                    <input type="text" placeholder="John Doe" value={regName} onChange={(e) => setRegName(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }} required />
                  </div>
                </div>
                <div style={{ marginBottom: '1.1rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.55rem 0.8rem' }}>
                    <i className="fa-solid fa-envelope" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                    <input type="email" placeholder="name@affiliate.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }} required />
                  </div>
                </div>
                <div style={{ marginBottom: '1.1rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.35rem' }}>Access Password</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.55rem 0.8rem' }}>
                    <i className="fa-solid fa-lock" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                    <input type="password" placeholder="••••••••" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }} required />
                  </div>
                </div>
                <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.35rem' }}>Custom Promo Code (Optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.55rem 0.8rem' }}>
                    <i className="fa-solid fa-tag" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                    <input type="text" placeholder="e.g. MYCODE10" value={regCode} onChange={(e) => setRegCode(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }} />
                  </div>
                </div>
                <button type="submit" disabled={isRegisteringSubmit} style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--gold-primary), #d4a017)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem', cursor: isRegisteringSubmit ? 'wait' : 'pointer', boxShadow: '0 4px 20px rgba(255, 215, 0, 0.25)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {isRegisteringSubmit ? 'Creating Account...' : 'Register Now'}
                </button>
              </form>
              <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
                Already have an account?{' '}
                <button onClick={() => { setIsRegistering(false); setRegError(''); }} style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', fontWeight: 'bold', padding: 0, fontSize: '0.8rem' }}>
                  Login Here
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    );
  }

  /* ===================== MAIN DASHBOARD ===================== */
  const today = new Date();
  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const sidebarItems = [
    { id: 'dashboard', icon: 'fa-solid fa-house', label: 'Dashboard' },
    { id: 'team', icon: 'fa-solid fa-users', label: 'Team' },
    { id: 'daily_transactions', icon: 'fa-solid fa-bolt', label: 'Daily Transactions' },
    { id: 'signup_report', icon: 'fa-solid fa-clipboard-list', label: 'Signup Report' },
    { id: 'ads_request', icon: 'fa-solid fa-bullhorn', label: 'Ads Request' },
    { id: 'change_password', icon: 'fa-solid fa-key', label: 'Change Password' },
  ];

  const inputStyle = { width: '100%', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '0.55rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' };

  return (
    <div className="admin-dashboard-layout" style={{ minHeight: '100vh', background: '#060812', color: '#fff', fontFamily: "var(--font-body), 'Inter', sans-serif" }}>

      {/* MOBILE HEADER */}
      <div className="admin-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fa-solid fa-user-tie" style={{ color: 'var(--gold-primary)', fontSize: '1.1rem' }}></i>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Affiliate Portal</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }}>
          <i className={sidebarOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'mobile-show' : ''}`}>
        <div style={{ padding: '1.5rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.75rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-user-tie" style={{ color: 'var(--gold-primary)', fontSize: '1.1rem' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0, lineHeight: 1.2 }}>Agent & Distributor<br/>Network</h2>
              <span style={{ fontSize: '0.55rem', color: '#888' }}>Performance Control Room</span>
            </div>
          </div>

          {/* Nav Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, overflowY: 'auto' }}>
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: activeTab === item.id ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.2))' : 'transparent',
                  color: activeTab === item.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: activeTab === item.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                  padding: '0.7rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: activeTab === item.id ? 'bold' : '500', fontSize: '0.8rem', textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className={item.icon} style={{ width: '18px', fontSize: '0.85rem', color: activeTab === item.id ? '#a855f7' : 'rgba(255,255,255,0.4)' }}></i>
                {item.label}
              </button>
            ))}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: 'transparent', color: '#f87171',
                border: '1px solid transparent',
                padding: '0.7rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                fontWeight: '500', fontSize: '0.8rem', textAlign: 'left', marginTop: '0.25rem'
              }}
            >
              <i className="fa-solid fa-right-from-bracket" style={{ width: '18px', fontSize: '0.85rem' }}></i>
              Logout
            </button>
          </div>

          {/* Footer Info Box */}
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.65rem', color: '#666', lineHeight: 1.5 }}>
              Live reports, private owner link, withdrawals, ads requests, and player activity in one place.
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="admin-main-workspace" style={{ padding: '2rem', overflowY: 'auto' }}>

        {/* ============== DASHBOARD TAB ============== */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Top Row: Welcome + Invite Link */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Welcome Section */}
              <div>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#a855f7', fontWeight: 'bold' }}>AFFILIATE PERFORMANCE PORTAL</span>
                <h1 style={{ fontSize: '2.25rem', fontWeight: '900', fontFamily: 'var(--font-heading)', margin: '0.3rem 0 0.15rem', lineHeight: 1.15 }}>
                  Welcome back,<br/>{agentSession.name}
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>
                  Sub Distributor account • Commission rate {agentSession.commissionRate || 0}.00%
                </p>
                <p style={{ fontSize: '0.7rem', color: '#666' }}>Showing only your direct-link players and your agents.</p>
                <h2 style={{ fontSize: '2.75rem', fontWeight: '900', margin: '0.75rem 0 0.15rem' }}>${(stats.availableBalance || 0).toFixed(2)}</h2>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>Available Balance</span>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setActiveTab('daily_transactions')} style={{ background: '#2ecc71', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="fa-solid fa-money-bill-transfer"></i> Withdraw
                  </button>
                  <button onClick={() => setActiveTab('daily_transactions')} style={{ background: 'rgba(255,215,0,0.12)', color: 'var(--gold-primary)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(255,215,0,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="fa-solid fa-clock-rotate-left"></i> Daily Transactions
                  </button>
                  <button onClick={() => setActiveTab('team')} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="fa-solid fa-users"></i> Team
                  </button>
                  <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="fa-solid fa-right-from-bracket"></i> Logout
                  </button>
                </div>
              </div>

              {/* Invite Link Card */}
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Your Invite Link</h3>
                <p style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.85rem' }}>Share this link with players. New signups will be tracked under your owner account.</p>
                <div style={{ background: '#040509', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.7rem', color: '#aaa', wordBreak: 'break-all', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/agent-player-login?agent=${agentSession.agentCode}` : ''}
                </div>
                <button onClick={handleCopyInvite} style={{ width: '100%', background: copiedLink ? '#2ecc71' : 'linear-gradient(135deg, #2ecc71, #27ae60)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s ease' }}>
                  {copiedLink ? '✓ Copied!' : 'Copy Invite Link'}
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                  <div style={{ flex: 1, background: '#040509', borderRadius: '10px', padding: '0.7rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '0.55rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>DIRECT</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '900' }}>{stats.totalPlayers || 0}</div>
                  </div>
                  <div style={{ flex: 1, background: '#040509', borderRadius: '10px', padding: '0.7rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '0.55rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>REFERRAL</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '900' }}>0</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '0.65rem 1rem', fontSize: '0.75rem', color: '#f87171', marginBottom: '1.5rem' }}>
              Dashboard totals below show your own direct-link players and all agents under you.
            </div>

            {/* Stats Cards - Row 1: Player Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
              {[
                { icon: 'fa-solid fa-users', iconBg: 'rgba(168,85,247,0.12)', iconColor: '#a855f7', label: 'TOTAL PLAYERS', value: stats.totalPlayers || 0, valueColor: '#a855f7' },
                { icon: 'fa-solid fa-user-check', iconBg: 'rgba(46,204,113,0.12)', iconColor: '#2ecc71', label: 'VERIFIED PLAYERS', value: stats.verifiedPlayers || 0, valueColor: '#2ecc71' },
                { icon: 'fa-solid fa-triangle-exclamation', iconBg: 'rgba(239,68,68,0.12)', iconColor: '#ef4444', label: 'UNVERIFIED PLAYERS', value: stats.unverifiedPlayers || 0, valueColor: '#ef4444' },
                { icon: 'fa-solid fa-user-plus', iconBg: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6', label: 'DEPOSITING PLAYERS', value: stats.depositingPlayers || 0, valueColor: '#3b82f6' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                    <i className={c.icon}></i>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Stats Cards - Row 2: Financial */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
              {[
                { icon: 'fa-solid fa-coins', iconBg: 'rgba(255,215,0,0.12)', iconColor: 'var(--gold-primary)', label: 'TOTAL DEPOSIT', value: `$${(stats.totalDeposits||0).toFixed(2)}`, sub: 'Dashboard scope only', valueColor: '#2ecc71' },
                { icon: 'fa-solid fa-money-bill-wave', iconBg: 'rgba(234,179,8,0.12)', iconColor: '#eab308', label: 'TOTAL CASHOUT', value: `$${(stats.totalWithdrawals||0).toFixed(2)}`, sub: 'Dashboard scope only', valueColor: '#ef4444' },
                { icon: 'fa-solid fa-chart-bar', iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6', label: 'NET PROFIT', value: `$${(stats.netProfit||0).toFixed(2)}`, sub: 'Deposit minus cashout' },
                { icon: 'fa-solid fa-coins', iconBg: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6', label: 'TOTAL COINS USED', value: '0.00', sub: 'Deposit coins only' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                    <i className={c.icon}></i>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor || '#fff' }}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '0.15rem' }}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Stats Cards - Row 3: Today + Withdrawn */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
              {[
                { icon: 'fa-solid fa-arrow-down', iconBg: 'rgba(46,204,113,0.12)', iconColor: '#2ecc71', label: 'TODAY DEPOSIT', value: `$${(stats.todayDeposits||0).toFixed(2)}`, valueColor: '#2ecc71' },
                { icon: 'fa-solid fa-arrow-up', iconBg: 'rgba(234,179,8,0.12)', iconColor: '#eab308', label: 'TODAY CASHOUT', value: `$${(stats.todayWithdrawals||0).toFixed(2)}`, valueColor: '#ef4444' },
                { icon: 'fa-solid fa-money-check-dollar', iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6', label: 'TOTAL WITHDRAWN', value: `$${(stats.totalWithdrawn||0).toFixed(2)}` },
                { icon: 'fa-solid fa-hourglass-half', iconBg: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6', label: 'PENDING WITHDRAWALS', value: `$${(stats.pendingWithdrawals||0).toFixed(2)}` },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                    <i className={c.icon}></i>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor || '#fff' }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Stats Cards - Row 4: Account Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {[
                { icon: 'fa-solid fa-hand-holding-dollar', iconBg: 'rgba(255,215,0,0.12)', iconColor: 'var(--gold-primary)', label: 'ACCOUNT SHARE', value: `$${(stats.commissionEarned||0).toFixed(2)}`, sub: 'Based on account commission rules', valueColor: '#2ecc71' },
                { icon: 'fa-solid fa-wallet', iconBg: 'rgba(46,204,113,0.15)', iconColor: '#2ecc71', label: 'AVAILABLE BALANCE', value: `$${(stats.availableBalance||0).toFixed(2)}`, sub: 'After paid and pending withdrawals', valueColor: '#2ecc71' },
                { icon: 'fa-solid fa-user', iconBg: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6', label: 'DIRECT PLAYERS', value: stats.totalPlayers || 0, sub: 'Players without player referral' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                    <i className={c.icon}></i>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor || '#fff' }}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '0.15rem' }}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Withdrawal History */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Withdrawal History</h2>
                <button onClick={() => setActiveTab('daily_transactions')} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.45rem 1rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>Request</button>
              </div>
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead><tr><th>AMOUNT</th><th>NAME</th><th>ACCOUNT</th><th>BANK</th><th>STATUS</th><th>DATE</th></tr></thead>
                  <tbody>
                    {commissionWithdrawals.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No withdrawal history found.</td></tr>
                    ) : commissionWithdrawals.map((tx, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>${parseFloat(tx.amount||0).toFixed(2)}</td>
                        <td>{agentSession.name}</td>
                        <td>{tx.note?.match(/Acc: (.+)/)?.[1] || 'N/A'}</td>
                        <td>{tx.gateway || 'N/A'}</td>
                        <td><span className={`admin-badge-preview b-${tx.status?.toLowerCase()==='success'?'ready':tx.status?.toLowerCase()==='pending'?'hot':'none'}`}>{tx.status}</span></td>
                        <td style={{ fontSize: '0.65rem', color: '#888' }}>{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============== TEAM TAB ============== */}
        {activeTab === 'team' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-users" style={{ fontSize: '1.25rem', color: '#a855f7' }}></i>
                </div>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>Team Management</h1>
                  <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>Manage your sub-distributors and agents from one clean dashboard.</p>
                </div>
              </div>
              <button onClick={() => setActiveTab('dashboard')} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Dashboard
              </button>
            </div>

            {/* Referral Link */}
            <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>Your Referral Link</h3>
                  <p style={{ fontSize: '0.7rem', color: '#888', margin: 0 }}>Share this link to bring players directly under your account.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <span style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold' }}>Type: Sub-Distributor</span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold' }}>Code: {agentSession.agentCode}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1, background: '#040509', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem', color: '#aaa', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/agent-player-login?agent=${agentSession.agentCode}` : ''}
                </div>
                <button onClick={handleCopyInvite} style={{ background: copiedLink ? '#2ecc71' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 0.85rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copiedLink ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* My Team Table */}
            <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(46,204,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-bolt" style={{ color: '#2ecc71', fontSize: '0.8rem' }}></i>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>My Team</h3>
                </div>
                <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}>{players.length} Accounts</span>
              </div>
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead><tr><th>NAME</th><th>EMAIL</th><th>STATUS</th><th>TOTAL DEPOSITS</th><th>TOTAL CASHOUTS</th><th>JOINED</th></tr></thead>
                  <tbody>
                    {players.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>No team accounts created yet.</td></tr>
                    ) : players.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                        <td style={{ color: '#aaa', fontSize: '0.7rem' }}>{p.email}</td>
                        <td><span className={`admin-badge-preview b-${p.status?.toLowerCase()==='active'?'ready':'none'}`}>{p.status || 'ACTIVE'}</span></td>
                        <td style={{ fontWeight: 'bold', color: '#2ecc71' }}>${parseFloat(p.totalDeposits||0).toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold', color: '#ef4444' }}>${parseFloat(p.totalWithdrawals||0).toFixed(2)}</td>
                        <td style={{ fontSize: '0.65rem', color: '#888' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============== DAILY TRANSACTIONS TAB ============== */}
        {activeTab === 'daily_transactions' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-calendar-days" style={{ fontSize: '1.25rem', color: '#3b82f6' }}></i>
                </div>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>Daily Transactions</h1>
                  <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>
                    <i className="fa-solid fa-calendar" style={{ marginRight: '0.3rem' }}></i>
                    Gaming day: {formatDisplayDate(txDate)} 04:55 AM → {formatDisplayDate(new Date(new Date(txDate).getTime() + 86400000).toISOString().split('T')[0])} 04:54 AM
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveTab('dashboard')} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Dashboard
              </button>
            </div>

            {/* Date Picker */}
            <div style={{ background: '#0b0d16', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold' }}>SELECT DATE</span>
              <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} style={{ ...inputStyle, maxWidth: '180px' }} />
              <button style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.45rem 0.85rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fa-solid fa-filter"></i> Filter
              </button>
              <button onClick={() => setTxDate(new Date().toISOString().split('T')[0])} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem 0.85rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>Clear</button>
            </div>

            {/* Sub-Distributor Daily Transactions */}
            <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Sub-Distributor Daily Transactions</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{formatDisplayDate(txDate)}</span>
              </div>
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead><tr><th>OWNER TYPE</th><th>TOTAL DEPOSIT</th><th>TOTAL CASHOUT</th><th>NET PROFIT</th><th>TOTAL SIGNUP PLAYERS</th><th>TOTAL VERIFIED PLAYERS</th><th>FIRST TIME DEPOSITED</th><th>ACTION</th></tr></thead>
                  <tbody>
                    <tr>
                      <td><div style={{ fontWeight: 'bold' }}>Direct Player</div><div style={{ fontSize: '0.6rem', color: '#888' }}>Sub Distributor Direct</div></td>
                      <td style={{ fontWeight: 'bold' }}>${(stats.todayDeposits||0).toFixed(2)}</td>
                      <td style={{ fontWeight: 'bold' }}>${(stats.todayWithdrawals||0).toFixed(2)}</td>
                      <td style={{ fontWeight: 'bold' }}>${Math.max(0, (stats.todayDeposits||0) - (stats.todayWithdrawals||0)).toFixed(2)}</td>
                      <td>{stats.totalPlayers || 0}</td>
                      <td>{stats.verifiedPlayers || 0}</td>
                      <td>{stats.depositingPlayers || 0}</td>
                      <td><button onClick={() => setActiveTab('team')} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.65rem', fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer' }}>View History</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grand Total */}
            <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Grand Total</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{formatDisplayDate(txDate)}</span>
              </div>
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead><tr><th>OWNER TYPE</th><th>TOTAL DEPOSIT</th><th>TOTAL CASHOUT</th><th>NET PROFIT</th><th>TOTAL SIGNUP PLAYERS</th><th>TOTAL VERIFIED PLAYERS</th></tr></thead>
                  <tbody>
                    <tr>
                      <td><div style={{ fontWeight: 'bold' }}>Grand Total</div><div style={{ fontSize: '0.6rem', color: '#888' }}>All visible network data</div></td>
                      <td style={{ fontWeight: 'bold' }}>${(stats.totalDeposits||0).toFixed(2)}</td>
                      <td style={{ fontWeight: 'bold' }}>${(stats.totalWithdrawals||0).toFixed(2)}</td>
                      <td style={{ fontWeight: 'bold' }}>${(stats.netProfit||0).toFixed(2)}</td>
                      <td>{stats.totalPlayers || 0}</td>
                      <td>{stats.verifiedPlayers || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Withdrawal Request Form */}
            <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Request Commission Withdrawal</h3>
              <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: '1rem' }}>Available: <strong style={{ color: 'var(--gold-primary)' }}>${(stats.availableBalance||0).toFixed(2)}</strong></p>
              <form onSubmit={handleWithdrawRequest} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Amount ($)</label><input type="number" placeholder="50.00" step="0.01" value={withdrawAmount} onChange={(e)=>setWithdrawAmount(e.target.value)} max={stats.availableBalance||0} style={inputStyle} required /></div>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Account Holder</label><input type="text" placeholder="Full name" value={withdrawName} onChange={(e)=>setWithdrawName(e.target.value)} style={inputStyle} required /></div>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Account Number</label><input type="text" placeholder="Account number" value={withdrawAccount} onChange={(e)=>setWithdrawAccount(e.target.value)} style={inputStyle} required /></div>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Bank / Method</label><input type="text" placeholder="CashApp, Venmo" value={withdrawBank} onChange={(e)=>setWithdrawBank(e.target.value)} style={inputStyle} required /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" disabled={withdrawLoading} style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>{withdrawLoading ? 'Submitting...' : 'Submit Request'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============== SIGNUP REPORT TAB ============== */}
        {activeTab === 'signup_report' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-clipboard-list" style={{ fontSize: '1.25rem', color: '#ef4444' }}></i>
                </div>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>Signup Report</h1>
                  <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>
                    <i className="fa-solid fa-calendar" style={{ marginRight: '0.3rem' }}></i>
                    {formatDisplayDate(signupFromDate)} → {formatDisplayDate(signupToDate)}
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveTab('dashboard')} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Dashboard
              </button>
            </div>

            {/* Date Range Picker */}
            <div style={{ background: '#0b0d16', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>FROM DATE</label>
                <input type="date" value={signupFromDate} onChange={(e) => setSignupFromDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>TO DATE</label>
                <input type="date" value={signupToDate} onChange={(e) => setSignupToDate(e.target.value)} style={inputStyle} />
              </div>
              <button onClick={() => mutateSignupReport()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-end' }}>
                <i className="fa-solid fa-filter"></i> Apply Filters
              </button>
            </div>

            {/* Signup Stats - Row 1: Signups */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
              {[
                { icon: 'fa-solid fa-users', iconBg: 'rgba(168,85,247,0.12)', iconColor: '#a855f7', label: 'TOTAL SIGNUPS', value: signupStats.totalPlayers || 0 },
                { icon: 'fa-solid fa-link', iconBg: 'rgba(168,85,247,0.08)', iconColor: '#a855f7', label: 'REFERRAL SIGNUPS', value: signupStats.referralSignups || 0 },
                { icon: 'fa-brands fa-facebook', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#3b82f6', label: 'FACEBOOK SIGNUPS', value: signupStats.facebookSignups || 0 },
                { icon: 'fa-solid fa-leaf', iconBg: 'rgba(46,204,113,0.1)', iconColor: '#2ecc71', label: 'ORGANIC SIGNUPS', value: signupStats.organicSignups || 0, valueColor: '#eab308' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}><i className={c.icon}></i></div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor || '#fff' }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Row 2: Verified */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
              {[
                { icon: 'fa-solid fa-shield-halved', iconBg: 'rgba(239,68,68,0.12)', iconColor: '#ef4444', label: 'TOTAL VERIFIED PLAYERS', value: signupStats.totalVerified || 0, valueColor: '#ef4444' },
                { icon: 'fa-solid fa-square-check', iconBg: 'rgba(46,204,113,0.12)', iconColor: '#2ecc71', label: 'REFERRAL VERIFIED', value: signupStats.referralVerified || 0 },
                { icon: 'fa-brands fa-facebook', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#3b82f6', label: 'FACEBOOK VERIFIED', value: signupStats.facebookVerified || 0 },
                { icon: 'fa-solid fa-leaf', iconBg: 'rgba(46,204,113,0.1)', iconColor: '#2ecc71', label: 'ORGANIC VERIFIED', value: signupStats.organicVerified || 0 },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}><i className={c.icon}></i></div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor || '#fff' }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Row 3: Deposited */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {[
                { icon: 'fa-solid fa-credit-card', iconBg: 'rgba(59,130,246,0.12)', iconColor: '#3b82f6', label: 'TOTAL DEPOSITED PLAYERS', value: signupStats.totalDeposited || 0 },
                { icon: 'fa-solid fa-users', iconBg: 'rgba(168,85,247,0.08)', iconColor: '#a855f7', label: 'REFERRAL DEPOSITED', value: signupStats.referralDeposited || 0 },
                { icon: 'fa-brands fa-facebook', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#3b82f6', label: 'FACEBOOK DEPOSITED', value: signupStats.facebookDeposited || 0 },
                { icon: 'fa-solid fa-leaf', iconBg: 'rgba(46,204,113,0.1)', iconColor: '#2ecc71', label: 'ORGANIC DEPOSITED', value: signupStats.organicDeposited || 0, valueColor: '#2ecc71' },
                { icon: 'fa-solid fa-clock-rotate-left', iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6', label: 'OLD SIGNUP DEPOSITED', value: signupStats.oldSignupDeposited || 0, valueColor: '#eab308' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0b0d16', padding: '1.15rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.iconBg, color: c.iconColor, fontSize: '0.95rem', marginBottom: '0.6rem' }}><i className={c.icon}></i></div>
                  <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{c.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: c.valueColor || '#fff' }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Campaign Breakdown Table */}
            <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-chart-pie text-gold" style={{ color: 'var(--gold-primary)' }}></i> Campaign Breakdown
              </h3>
              <div className="table-responsive">
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>CAMPAIGN</th>
                      <th>TOTAL SIGNUPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan="2" className="text-center text-muted" style={{ padding: '1.5rem' }}>No campaign data found.</td>
                      </tr>
                    ) : (
                      campaignBreakdown.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{row.campaign}</strong></td>
                          <td><strong>{row.totalSignups}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Players List Table */}
            <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-users text-gold" style={{ color: 'var(--gold-primary)' }}></i> Players List
              </h3>

              {/* Ownership Filters */}
              <div style={{ background: '#07090f', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <span style={{ fontSize: '0.725rem', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Ownership Source Filter</span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Filter players by distributor own link, direct agent, sub-distributor own link, or sub-distributor agent.</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={ownershipFilter}
                    onChange={(e) => setOwnershipFilter(e.target.value)}
                    style={{ background: '#0b0d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', padding: '0.45rem 1rem', fontSize: '0.75rem', outline: 'none' }}
                  >
                    <option value="All Players">All Players</option>
                    <option value="Distributor Own Link">Distributor Own Link</option>
                    <option value="Direct Agent">Direct Agent</option>
                    <option value="Sub-Distributor Own Link">Sub-Distributor Own Link</option>
                    <option value="Sub-Distributor Agent">Sub-Distributor Agent</option>
                  </select>
                  <button
                    onClick={() => {
                      const headers = ['ID', 'NAME', 'EMAIL', 'OWNER TYPE', 'OWNER NAME', 'OWNER CODE', 'DISTRIBUTOR', 'SUB-DISTRIBUTOR', 'AGENT', 'NETWORK PATH', 'SIGNUP DATE', 'FIRST DEPOSIT DATE', 'VERIFICATION'];
                      const rows = playersList.map(p => [
                        p.id, p.name, p.email, p.ownerType, p.ownerName, p.ownerCode, p.distributor, p.subDistributor, p.agent, p.networkPath, p.signupDate, p.firstDepositDate, p.verification
                      ]);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `signup_report_${new Date().toISOString().slice(0,10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid var(--gold-primary)', color: 'var(--gold-primary)', borderRadius: '6px', padding: '0.45rem 1rem', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <i className="fa-solid fa-download"></i> Download CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="table-responsive">
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>NAME</th>
                      <th>OWNER TYPE</th>
                      <th>OWNER NAME</th>
                      <th>OWNER CODE</th>
                      <th>DISTRIBUTOR</th>
                      <th>SUB-DISTRIBUTOR</th>
                      <th>AGENT</th>
                      <th>NETWORK PATH</th>
                      <th>SIGNUP DATE</th>
                      <th>FIRST DEPOSIT DATE</th>
                      <th>VERIFICATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersList.length === 0 ? (
                      <tr>
                        <td colSpan="12" className="text-center text-muted" style={{ padding: '2rem' }}>No players found.</td>
                      </tr>
                    ) : (
                      playersList
                        .filter(p => {
                          if (ownershipFilter === 'Distributor Own Link') return p.campaign?.toLowerCase().includes('distributor');
                          if (ownershipFilter === 'Direct Agent') return p.ownerType === 'Agent';
                          if (ownershipFilter === 'Sub-Distributor Own Link') return p.campaign?.toLowerCase().includes('sub-distributor');
                          if (ownershipFilter === 'Sub-Distributor Agent') return p.campaign?.toLowerCase().includes('sub-agent');
                          return true;
                        })
                        .map((p, idx) => (
                          <tr key={idx}>
                            <td>#{p.id.slice(-6)}</td>
                            <td><strong>{p.name}</strong><br/><span style={{ fontSize: '0.65rem', color: '#888' }}>{p.email}</span></td>
                            <td>{p.ownerType}</td>
                            <td>{p.ownerName}</td>
                            <td><code>{p.ownerCode}</code></td>
                            <td>{p.distributor}</td>
                            <td>{p.subDistributor}</td>
                            <td>{p.agent}</td>
                            <td style={{ fontSize: '0.65rem', opacity: 0.8 }}>{p.networkPath}</td>
                            <td style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>{p.signupDate}</td>
                            <td style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>{p.firstDepositDate}</td>
                            <td>
                              <span className={`admin-badge-preview b-${p.verification === 'VERIFIED' ? 'ready' : 'unverified'}`}>
                                {p.verification}
                              </span>
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

        {/* ============== ADS REQUEST TAB ============== */}
        {activeTab === 'ads_request' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(234,179,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-bullhorn" style={{ fontSize: '1.25rem', color: '#eab308' }}></i>
                </div>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>Ads Request</h1>
                  <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>Submit Facebook advertisement campaigns and get your custom tracking links.</p>
                </div>
              </div>
              <button onClick={() => setActiveTab('dashboard')} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Dashboard
              </button>
            </div>

            {/* Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start', marginBottom: '2rem' }}>
              
              {/* Left Column: Form & Payment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Form Card */}
                <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fa-solid fa-file-invoice-dollar text-gold" style={{ color: 'var(--gold-primary)' }}></i> Campaign Details
                  </h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!adsBudget || isNaN(parseFloat(adsBudget)) || parseFloat(adsBudget) <= 0) {
                      alert('Please enter a valid campaign budget.');
                      return;
                    }
                    if (parseFloat(adsBudget) > remainingLimit) {
                      alert(`Budget exceeds your remaining limit of $${remainingLimit.toFixed(2)}`);
                      return;
                    }
                    if (!campaignName.trim() || !facebookLink.trim() || !campaignStart || !campaignEnd) {
                      alert('Please fill out all required campaign fields.');
                      return;
                    }

                    setAdsLoading(true);
                    try {
                      const res = await fetch('/api/campaign-requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          agentEmail: agentSession.email,
                          agentCode: agentSession.agentCode,
                          budget: parseFloat(adsBudget),
                          campaignName: campaignName.trim(),
                          facebookPageLink: facebookLink.trim(),
                          startDate: campaignStart,
                          endDate: campaignEnd,
                          notes: campaignNotes.trim(),
                          paymentProof: campaignProof
                        })
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert('Campaign request submitted successfully!');
                        setAdsBudget('');
                        setCampaignName('');
                        setFacebookLink('');
                        setCampaignStart('');
                        setCampaignEnd('');
                        setCampaignNotes('');
                        setCampaignProof('');
                        mutateCampaigns();
                      } else {
                        alert(data.message || 'Submission failed.');
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Connection error submitting campaign request.');
                    } finally {
                      setAdsLoading(false);
                    }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
                      <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>ADS BUDGET ($)</label>
                        <div className="input-wrapper" style={{ background: '#07090f' }}>
                          <i className="fa-solid fa-dollar-sign input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                          <input type="number" placeholder="Enter campaign budget" value={adsBudget} onChange={(e) => setAdsBudget(e.target.value)} required />
                        </div>
                      </div>
                      <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>CAMPAIGN NAME</label>
                        <div className="input-wrapper" style={{ background: '#07090f' }}>
                          <i className="fa-solid fa-bullhorn input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                          <input type="text" placeholder="Summer Promo, Casino Campaign..." value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
                        </div>
                      </div>
                    </div>

                    <div className="input-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>FACEBOOK PAGE LINK</label>
                      <div className="input-wrapper" style={{ background: '#07090f' }}>
                        <i className="fa-brands fa-facebook input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                        <input type="url" placeholder="https://facebook.com/yourpage" value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} required />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
                      <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>START DATE & TIME</label>
                        <input type="datetime-local" value={campaignStart} onChange={(e) => setCampaignStart(e.target.value)} style={inputStyle} required />
                      </div>
                      <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>END DATE & TIME</label>
                        <input type="datetime-local" value={campaignEnd} onChange={(e) => setCampaignEnd(e.target.value)} style={inputStyle} required />
                      </div>
                    </div>

                    <div className="input-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.35rem' }}>NOTES (OPTIONAL)</label>
                      <textarea placeholder="Target audience, states, interests, special instructions..." value={campaignNotes} onChange={(e) => setCampaignNotes(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
                    </div>

                    {/* Payment proof file attachment input */}
                    <div style={{ background: '#07090f', padding: '0.75rem', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>
                        Attach Payment Proof Screenshot (Required)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 8 * 1024 * 1024) {
                            alert('Screenshot image must be under 8MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => setCampaignProof(reader.result);
                          reader.readAsDataURL(file);
                        }}
                        style={{ fontSize: '0.75rem', color: '#fff' }}
                        required={!campaignProof}
                      />
                      {campaignProof && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.65rem', color: '#2ecc71' }}>✓ Screenshot attached successfully!</span>
                          <button type="button" onClick={() => setCampaignProof('')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}>Remove</button>
                        </div>
                      )}
                    </div>

                    <button type="submit" disabled={adsLoading} style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--gold-primary), #d4a017)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', cursor: adsLoading ? 'wait' : 'pointer', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.5rem' }}>
                      {adsLoading ? 'Submitting Campaign...' : '🚀 Submit Ads Campaign Request'}
                    </button>
                  </form>
                </div>

                {/* Payment Details Card */}
                <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fa-solid fa-wallet text-gold" style={{ color: 'var(--gold-primary)' }}></i> Payment Details
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: '#888' }}>Network</span>
                      <strong style={{ color: '#fff' }}>BNB Smart Chain (BEP20)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: '#888' }}>Remaining Limit</span>
                      <strong style={{ color: 'var(--gold-primary)' }}>${remainingLimit.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.75rem' }}>
                      <span style={{ color: '#888' }}>Wallet Address</span>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#07090f', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.725rem', fontFamily: 'monospace', color: '#fff', wordBreak: 'break-all', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span>0xbe912598c0f2a38365ac1f6838f943935326be74</span>
                        <button onClick={() => {
                          navigator.clipboard.writeText('0xbe912598c0f2a38365ac1f6838f943935326be74');
                          alert('Wallet address copied to clipboard!');
                        }} style={{ background: '#6366f1', border: 'none', borderRadius: '4px', color: '#fff', padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}>Copy</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                      {/* BNB BEP20 QR Logo Mascot rendering */}
                      <div style={{ background: '#fff', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '90px', height: '90px' }}>
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=0xbe912598c0f2a38365ac1f6838f943935326be74" alt="BSC BEP20 Wallet Address QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                        <p style={{ margin: '0 0 0.25rem 0' }}>Scan this QR code to transfer your ad budget directly using BNB Smart Chain (BEP20).</p>
                        <strong style={{ color: 'var(--gold-primary)' }}>Important:</strong> Send only USDT/BNB via BEP20. Transfers on other chains cannot be processed.
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Instructions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* How It Works */}
                <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '14px', padding: '1.5rem', color: '#cbd5e1' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fa-solid fa-circle-question" style={{ color: '#8b5cf6' }}></i> How It Works
                  </h3>
                  <p style={{ fontSize: '0.75rem', lineHeight: '1.5', margin: 0 }}>
                    Submit your campaign request, send payment to the wallet provided, upload payment proof and our marketing team will start reviewing your campaign.
                  </p>
                </div>

                {/* Process Steps */}
                <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fa-solid fa-list-ol text-gold" style={{ color: 'var(--gold-primary)' }}></i> Campaign Launch Process
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { step: 1, text: 'Submit campaign details.' },
                      { step: 2, text: 'Send payment to the provided wallet.' },
                      { step: 3, text: 'Upload payment proof.' },
                      { step: 4, text: 'Our team verifies and launches the campaign.' }
                    ].map((item) => (
                      <div key={item.step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--gold-primary)', color: '#000', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {item.step}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Campaign History Log */}
            <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                My Campaign Requests
              </h3>
              <div className="table-responsive">
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Campaign</th>
                      <th>Budget</th>
                      <th>Status</th>
                      <th>Tracking Link</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignsList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                          No campaign requests found.
                        </td>
                      </tr>
                    ) : (
                      campaignsList.map((c) => (
                        <tr key={c.id}>
                          <td>#{c.id.slice(-6)}</td>
                          <td><strong>{c.campaignName}</strong></td>
                          <td><strong style={{ color: 'var(--gold-primary)' }}>${parseFloat(c.budget).toFixed(2)}</strong></td>
                          <td>
                            <span className={`admin-badge-preview b-${c.status.toLowerCase() === 'ready' ? 'ready' : c.status.toLowerCase()}`}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.725rem', fontFamily: 'monospace' }}>
                            {c.status === 'APPROVED' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: '#2ecc71', wordBreak: 'break-all' }}>{c.trackingLink}</span>
                                <button onClick={() => {
                                  navigator.clipboard.writeText(c.trackingLink);
                                  alert('Tracking link copied!');
                                }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.1rem 0.3rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem' }}>Copy</button>
                              </div>
                            ) : (
                              <span style={{ opacity: 0.4 }}>Pending Link Assignment</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.725rem' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ============== CHANGE PASSWORD TAB ============== */}
        {activeTab === 'change_password' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-key" style={{ fontSize: '1.25rem', color: '#8b5cf6' }}></i>
                </div>
                <div>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>Change Password</h1>
                  <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>Update your affiliate portal access credentials.</p>
                </div>
              </div>
              <button onClick={() => setActiveTab('dashboard')} style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fa-solid fa-arrow-left"></i> Dashboard
              </button>
            </div>
            <div style={{ background: '#0b0d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', padding: '1.25rem', maxWidth: '450px' }}>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Current Password</label><input type="password" placeholder="Enter current password" value={currentPw} onChange={(e)=>setCurrentPw(e.target.value)} style={inputStyle} required /></div>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>New Password</label><input type="password" placeholder="Enter new password" value={newPw} onChange={(e)=>setNewPw(e.target.value)} style={inputStyle} required /></div>
                <div><label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '0.3rem' }}>Confirm New Password</label><input type="password" placeholder="Re-enter new password" value={confirmPw} onChange={(e)=>setConfirmPw(e.target.value)} style={inputStyle} required /></div>
                <button type="submit" disabled={changePwLoading} style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', padding: '0.65rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>{changePwLoading ? 'Updating...' : 'Update Password'}</button>
              </form>
            </div>
          </div>
        )}

      {agentSession && !supportOpen && (
        <button
          onClick={() => setSupportOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 99999,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffd700 0%, #cca000 100%)',
            color: '#000',
            border: 'none',
            boxShadow: '0 8px 30px rgba(255,215,0,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 10px 35px rgba(255,215,0,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,215,0,0.35)';
          }}
        >
          <i className="fa-solid fa-headset"></i>
        </button>
      )}

      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        currentUser={agentSession}
      />

      </main>
    </div>
  );
}
