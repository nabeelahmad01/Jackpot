'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load the sub-tab components to optimize bundle size and initial load speed
const OverviewTab = lazy(() => import('./admin/OverviewTab'));
const GamesLibraryTab = lazy(() => import('./admin/GamesLibraryTab'));
const PlayerAccountsTab = lazy(() => import('./admin/PlayerAccountsTab'));
const RequestsTab = lazy(() => import('./admin/RequestsTab'));
const LedgerTab = lazy(() => import('./admin/LedgerTab'));
const GatewaysTab = lazy(() => import('./admin/GatewaysTab'));
const CoinsAllotmentTab = lazy(() => import('./admin/CoinsAllotmentTab'));
const SupportTab = lazy(() => import('./admin/SupportTab'));
const StaffTab = lazy(() => import('./admin/StaffTab'));
const SettingsTab = lazy(() => import('./admin/SettingsTab'));
const FrontendSettingsTab = lazy(() => import('./admin/FrontendSettingsTab'));
const ShiftReportsTab = lazy(() => import('./admin/ShiftReportsTab'));
const ShiftDashboardTab = lazy(() => import('./admin/ShiftDashboardTab'));
const PromotionsTab = lazy(() => import('./admin/PromotionsTab'));
const TxSearchTab = lazy(() => import('./admin/TxSearchTab'));
const DistributorsTab = lazy(() => import('./admin/DistributorsTab'));
const DeletedPlayersTab = lazy(() => import('./admin/DeletedPlayersTab'));
const WebsitePaymentsTab = lazy(() => import('./admin/WebsitePaymentsTab'));

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function AdminDashboard({
  adminUser,
  completedActionIds = {},
  onLogout,
  onAddGameClick,
  onEditGameClick,
  onDeleteGame,
  onDeleteUser,
  onApproveRequest,
  onApproveTransaction,
  onFailTransaction,
  onInspectProof,
  onAddGatewayClick,
  onEditGatewayClick,
  onDeleteGateway,
  onCreateAdmin,
  onUpdateSettings,
  onUpdateCoinsNotification,
  onUpdateGameCoinsPool
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync tab state changes to browser URL pathnames
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    const basePrefix = parts[0] || 'admin';
    const targetPath = `/${basePrefix}/${activeTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [activeTab]);

  // Sync browser back/forward buttons (popstate) to local state
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
    handlePathChange(); // Sync initial view on mount
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);
  const [processingIds, setProcessingIds] = useState({});

  // Use SWR to poll counts/stats for the sidebar badges
  const { data: statsData } = useSWR(
    `/api/admin/stats?adminRole=${adminUser?.role || ''}&adminDistributorId=${adminUser?.distributorId || ''}`,
    fetcher,
    {
      refreshInterval: 4000
    }
  );

  const { data: settingsData } = useSWR('/api/settings/frontend', fetcher);

  const pendingRequestsCount = statsData?.stats?.pendingRequestsCount || 0;
  const pendingTransactionsCount = statsData?.stats?.pendingTransactionsCount || 0;
  const pendingCoinsCount = statsData?.stats?.pendingCoinsCount || 0;

  const prevCountsRef = React.useRef({ requests: 0, transactions: 0, coins: 0, chats: 0 });

  const playSynthesizedBackup = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playTone(523.25, now, 0.12);
      playTone(659.25, now + 0.08, 0.25);
    } catch (e) {
      console.log('Synthesized audio failed:', e);
    }
  };

  const playAlertSound = () => {
    try {
      const customSound = settingsData?.settings?.notificationSoundUrl;
      if (customSound) {
        const cleanUrl = customSound.replace(/^data:video\/[^;]+;/, 'data:audio/mpeg;');
        const audio = new Audio(cleanUrl);
        audio.play().catch(err => {
          console.log('Autoplay blocked custom audio playing, trying synthesizer tone as backup:', err);
          playSynthesizedBackup();
        });
      } else {
        playSynthesizedBackup();
      }
    } catch (e) {
      console.log('Audio playback failed:', e);
      playSynthesizedBackup();
    }
  };

  useEffect(() => {
    if (!statsData?.stats) return;
    const { pendingRequestsCount, pendingTransactionsCount, pendingCoinsCount, pendingChatsCount } = statsData.stats;
    const prev = prevCountsRef.current;
    
    const hasNewRequest = pendingRequestsCount > prev.requests;
    const hasNewTx = pendingTransactionsCount > prev.transactions;
    const hasNewCoin = pendingCoinsCount > prev.coins;
    const hasNewChat = pendingChatsCount > prev.chats;
    
    const countChanged =
      pendingRequestsCount !== prev.requests ||
      pendingTransactionsCount !== prev.transactions ||
      pendingCoinsCount !== prev.coins ||
      pendingChatsCount !== prev.chats;

    if (hasNewRequest || hasNewTx || hasNewCoin || hasNewChat) {
      playAlertSound();
    }

    if (countChanged) {
      mutate((key) => true);
    }
    
    prevCountsRef.current = {
      requests: pendingRequestsCount,
      transactions: pendingTransactionsCount,
      coins: pendingCoinsCount,
      chats: pendingChatsCount
    };
  }, [statsData]);

  useEffect(() => {
    if (!adminUser?.email) return;

    // Heartbeat ping tracker for current admin
    let lastPing = 0;
    const sendPing = async () => {
      const now = Date.now();
      if (now - lastPing < 30000) return; // limit to once every 30s
      lastPing = now;
      try {
        await fetch('/api/admin/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: adminUser.email })
        });
      } catch (err) {
        console.error('Heartbeat update failed:', err);
      }
    };

    sendPing();
    const triggerPing = () => sendPing();
    window.addEventListener('mousemove', triggerPing);
    window.addEventListener('keydown', triggerPing);
    window.addEventListener('click', triggerPing);

    return () => {
      window.removeEventListener('mousemove', triggerPing);
      window.removeEventListener('keydown', triggerPing);
      window.removeEventListener('click', triggerPing);
    };
  }, [adminUser]);



  const wrapAction = (id, actionFn) => async (...args) => {
    if (processingIds[id]) return;
    setProcessingIds(prev => ({ ...prev, [id]: true }));
    try {
      await actionFn(...args);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // Helper: tab permissions checking based on role
  const hasAccess = (tabName) => {
    if (!adminUser?.role) return false;
    const roleString = adminUser.role.toLowerCase();
    
    // Split roles by comma for multi-role access checks
    const roles = roleString.split(',').map(r => r.trim());
    
    return roles.some((role) => {
      if (role === 'admin') return true; // Super Admin has full access
      
      if (tabName === 'shift_dashboard') return role === 'operation_admin' || role === 'coins_admin';
      if (tabName === 'promotions') return role === 'operation_admin';
      // Frontend Settings tab is strictly reserved for main boss (Super Admin)
      if (tabName === 'frontend_settings') return false;
      if (tabName === 'shift_reports') return role === 'operation_admin';

      if (role === 'operation_admin') return !['staff', 'settings'].includes(tabName); // Operational Manager has access to all EXCEPT staff and settings
      if (role === 'financial_admin') return ['dashboard', 'ledger', 'gateways', 'tx_search'].includes(tabName);
      if (role === 'support_admin') return ['dashboard', 'support'].includes(tabName);
      if (role === 'coins_admin') return ['dashboard', 'games', 'requests', 'coins', 'tx_search', 'shift_dashboard'].includes(tabName);
      return false;
    });
  };

  return (
    <div id="view-admin-dashboard" className="admin-dashboard-layout">
      {/* Mobile Top Header Bar */}
      <div className="admin-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.35rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Toggle Menu"
          >
            <i className={`fa-solid ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
          
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '1px solid rgba(255,215,0,0.4)',
            background: '#000',
            boxShadow: '0 0 10px rgba(255,215,0,0.3)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img src="/jackpot_lion_mascot.png?v=2" alt="Mascot Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', clipPath: 'circle(50%)' }} />
          </div>

          <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#fff', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
            JACKPOT<span style={{ color: 'var(--gold-primary)' }}>ROYALS</span>
          </span>
        </div>
        <button className="lobby-nav-btn logout-btn" onClick={onLogout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', margin: 0, width: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <i className="fa-solid fa-right-from-bracket"></i> <span>LOGOUT</span>
        </button>
      </div>

      {/* Left Sidebar Menu */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'mobile-show' : ''}`}>
        {/* Brand logo */}
        <div className="admin-logo" style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fa-solid fa-crown gold-text" style={{ fontSize: '1.5rem' }}></i>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
            JACKPOT<span className="accent-red" style={{ color: '#ef4444' }}>ROYALS</span>
          </h2>
        </div>

        {/* Tab List */}
        <nav style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto' }}>
          {hasAccess('dashboard') && (
            <button
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'dashboard' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'dashboard' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-chart-line" style={{ width: '18px' }}></i>
              <span>Overview Welcome</span>
            </button>
          )}

          {hasAccess('shift_dashboard') && (
            <button
              onClick={() => { setActiveTab('shift_dashboard'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'shift_dashboard' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'shift_dashboard' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-business-time" style={{ width: '18px' }}></i>
              <span>Shift Dashboard</span>
              {(pendingRequestsCount + pendingCoinsCount) > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {pendingRequestsCount + pendingCoinsCount}
                </span>
              )}
            </button>
          )}

          {hasAccess('promotions') && (
            <button
              onClick={() => { setActiveTab('promotions'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'promotions' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'promotions' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-bullhorn" style={{ width: '18px' }}></i>
              <span>Promotions & Segments</span>
            </button>
          )}

          {hasAccess('games') && (
            <button
              onClick={() => { setActiveTab('games'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'games' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'games' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-gamepad" style={{ width: '18px' }}></i>
              <span>Games Library</span>
            </button>
          )}

          {hasAccess('users') && (
            <button
              onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'users' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'users' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-users" style={{ width: '18px' }}></i>
              <span>Player Accounts</span>
            </button>
          )}

          {hasAccess('requests') && (
            <button
              onClick={() => { setActiveTab('requests'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'requests' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'requests' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-user-plus" style={{ width: '18px' }}></i>
              <span>Requests</span>
              {pendingRequestsCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}

          {hasAccess('ledger') && (
            <button
              onClick={() => { setActiveTab('ledger'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'ledger' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'ledger' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-wallet" style={{ width: '18px' }}></i>
              <span>Ledger</span>
              {pendingTransactionsCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {pendingTransactionsCount}
                </span>
              )}
            </button>
          )}

          {hasAccess('gateways') && (
            <button
              onClick={() => { setActiveTab('gateways'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'gateways' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'gateways' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-sliders" style={{ width: '18px' }}></i>
              <span>Payment Gateways</span>
            </button>
          )}

          {hasAccess('tx_search') && (
            <button
              onClick={() => { setActiveTab('tx_search'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'tx_search' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'tx_search' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-clock-rotate-left" style={{ width: '18px' }}></i>
              <span>Transaction Logs</span>
            </button>
          )}

          {hasAccess('coins') && (
            <button
              onClick={() => { setActiveTab('coins'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'coins' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'coins' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-coins" style={{ width: '18px' }}></i>
              <span>Coins Allotment</span>
              {pendingCoinsCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {pendingCoinsCount}
                </span>
              )}
            </button>
          )}

          {hasAccess('shift_reports') && (
            <button
              onClick={() => { setActiveTab('shift_reports'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'shift_reports' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'shift_reports' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-clock-rotate-left" style={{ width: '18px' }}></i>
              <span>Shift Reports</span>
            </button>
          )}

          {hasAccess('support') && (
            <button
              onClick={() => { setActiveTab('support'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'support' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'support' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-comments" style={{ width: '18px' }}></i>
              <span>Live Chat Support</span>
              {statsData?.stats?.pendingChatsCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {statsData.stats.pendingChatsCount}
                </span>
              )}
            </button>
          )}

          {hasAccess('staff') && (
            <button
              onClick={() => { setActiveTab('staff'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'staff' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'staff' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-user-shield" style={{ width: '18px' }}></i>
              <span>Staff Management</span>
            </button>
          )}

          {hasAccess('distributors') && (
            <button
              onClick={() => { setActiveTab('distributors'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'distributors' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'distributors' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-users-gear" style={{ width: '18px' }}></i>
              <span>Distributors</span>
            </button>
          )}

          {!adminUser?.distributorId && adminUser?.role === 'admin' && (
            <button
              onClick={() => { setActiveTab('website_payments'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'website_payments' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'website_payments' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-file-invoice-dollar" style={{ width: '18px' }}></i>
              <span>Website Payments</span>
              {statsData?.stats?.pendingWebsitePaymentsCount > 0 && (
                <span className="notification-badge" style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.35rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {statsData.stats.pendingWebsitePaymentsCount}
                </span>
              )}
            </button>
          )}

          {!adminUser?.distributorId && adminUser?.role === 'admin' && (
            <button
              onClick={() => { setActiveTab('deleted_accounts'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'deleted_accounts' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'deleted_accounts' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-trash-arrow-up" style={{ width: '18px' }}></i>
              <span>Deleted Accounts</span>
            </button>
          )}

          {hasAccess('settings') && (
            <button
              onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'settings' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'settings' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-sliders" style={{ width: '18px' }}></i>
              <span>System Settings</span>
            </button>
          )}

          {hasAccess('frontend_settings') && (
            <button
              onClick={() => { setActiveTab('frontend_settings'); setSidebarOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: activeTab === 'frontend_settings' ? 'var(--gold-primary)' : 'none',
                color: activeTab === 'frontend_settings' ? '#111' : '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-palette" style={{ width: '18px' }}></i>
              <span>Frontend CMS</span>
            </button>
          )}
        </nav>

        {/* Profile Card & Logout */}
        <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>{adminUser?.name || 'System Admin'}</span>
            <span style={{ fontSize: '0.65rem', color: '#ffd700', textTransform: 'uppercase', marginTop: '0.15rem' }}>
              <i className="fa-solid fa-shield-halved"></i> {adminUser?.role?.replace('_', ' ') || 'Super Admin'}
            </span>
          </div>
          <button className="lobby-nav-btn logout-btn" onClick={onLogout} style={{ width: '100%', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: 0 }}>
            <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace Wrapper */}
      <main className="admin-main-workspace" style={activeTab === 'support' ? { overflowY: 'hidden', height: '100vh' } : {}}>
        <Suspense fallback={
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
            <p>Loading tab content...</p>
          </div>
        }>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ width: '100%', height: '100%' }}
            >
              {activeTab === 'dashboard' && hasAccess('dashboard') && (
                <OverviewTab adminUser={adminUser} onUpdateGameCoinsPool={onUpdateGameCoinsPool} />
              )}
              {activeTab === 'games' && hasAccess('games') && (
                <GamesLibraryTab onAddGameClick={onAddGameClick} onEditGameClick={onEditGameClick} onDeleteGame={onDeleteGame} />
              )}
              {activeTab === 'users' && hasAccess('users') && (
                <PlayerAccountsTab adminUser={adminUser} onDeleteUser={onDeleteUser} />
              )}
              {activeTab === 'requests' && hasAccess('requests') && (
                <RequestsTab adminUser={adminUser} onApproveRequest={onApproveRequest} completedActionIds={completedActionIds} processingIds={processingIds} wrapAction={wrapAction} />
              )}
              {activeTab === 'ledger' && hasAccess('ledger') && (
                <LedgerTab
                  onInspectProof={onInspectProof}
                  onApproveTransaction={onApproveTransaction}
                  onFailTransaction={onFailTransaction}
                  completedActionIds={completedActionIds}
                  processingIds={processingIds}
                  wrapAction={wrapAction}
                  adminUser={adminUser}
                />
              )}
              {activeTab === 'gateways' && hasAccess('gateways') && (
                <GatewaysTab onAddGatewayClick={onAddGatewayClick} onEditGatewayClick={onEditGatewayClick} onDeleteGateway={onDeleteGateway} />
              )}
              {activeTab === 'coins' && hasAccess('coins') && (
                <CoinsAllotmentTab
                  onUpdateCoinsNotification={onUpdateCoinsNotification}
                  completedActionIds={completedActionIds}
                  processingIds={processingIds}
                  wrapAction={wrapAction}
                  adminUser={adminUser}
                />
              )}
              {activeTab === 'support' && hasAccess('support') && (
                <SupportTab adminUser={adminUser} />
              )}
              {activeTab === 'staff' && hasAccess('staff') && (
                <StaffTab adminUser={adminUser} onCreateAdmin={onCreateAdmin} onDeleteUser={onDeleteUser} />
              )}
              {activeTab === 'distributors' && hasAccess('distributors') && (
                <DistributorsTab />
              )}
              {activeTab === 'deleted_accounts' && !adminUser?.distributorId && adminUser?.role === 'admin' && (
                <DeletedPlayersTab />
              )}
              {activeTab === 'website_payments' && !adminUser?.distributorId && adminUser?.role === 'admin' && (
                <WebsitePaymentsTab
                  onInspectProof={onInspectProof}
                  completedActionIds={completedActionIds}
                  adminUser={adminUser}
                />
              )}
              {activeTab === 'settings' && hasAccess('settings') && (
                <SettingsTab onUpdateSettings={onUpdateSettings} />
              )}
              {activeTab === 'frontend_settings' && hasAccess('frontend_settings') && (
                <FrontendSettingsTab adminUser={adminUser} />
              )}
              {activeTab === 'shift_reports' && hasAccess('shift_reports') && (
                <ShiftReportsTab />
              )}
              {activeTab === 'shift_dashboard' && hasAccess('shift_dashboard') && (
                <ShiftDashboardTab adminUser={adminUser} />
              )}
              {activeTab === 'promotions' && hasAccess('promotions') && (
                <PromotionsTab adminUser={adminUser} />
              )}
              {activeTab === 'tx_search' && hasAccess('tx_search') && (
                <TxSearchTab onInspectProof={onInspectProof} adminUser={adminUser} />
              )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
}
