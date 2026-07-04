'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function AdminDashboard({
  games = [],
  users = [],
  accountRequests = [],
  transactions = [],
  gateways = [],
  coinsNotifications = [],
  systemSettings = { firstDepositBonus: 300, regularDepositBonus: 20 },
  adminUser,
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
  onUpdateUserCoins,
  onCreateAdmin,
  onUpdateSettings,
  onUpdateCoinsNotification,
  onUpdateGameCoinsPool
}) {
  // 1. Determine Initial activeTab based on permissions
  const getInitialTab = () => {
    return 'dashboard'; // Everyone defaults to the new Welcome Dashboard landing page
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingIds, setProcessingIds] = useState({});

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

  // 2. Search States
  const [gameSearch, setGameSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [gatewaySearch, setGatewaySearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [coinsNotiSearch, setCoinsNotiSearch] = useState('');

  // 3. Admin Creation Form State
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('financial_admin');

  // 4. Settings Form State
  const [firstBonusInput, setFirstBonusInput] = useState(systemSettings.firstDepositBonus);
  const [regularBonusInput, setRegularBonusInput] = useState(systemSettings.regularDepositBonus);

  // Sync settings inputs when prop loads
  useEffect(() => {
    setFirstBonusInput(systemSettings.firstDepositBonus);
    setRegularBonusInput(systemSettings.regularDepositBonus);
  }, [systemSettings]);

  // 5. Live Chat Support Console States
  const [conversations, setConversations] = useState([]); // List of grouped conversations
  const [activeChatEmail, setActiveChatEmail] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  const chatEndRef = useRef(null);
  const activeChatIntervalRef = useRef(null);

  // Synchronize Tab on Mount/Session updates
  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [adminUser]);

  // Load Grouped Conversations for Customer Support Tab
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/support');
      const data = await res.json();
      if (data.success && data.messages) {
        // Group messages by userEmail
        const groups = {};
        data.messages.forEach((msg) => {
          const email = msg.userEmail.toLowerCase();
          if (!groups[email]) {
            groups[email] = {
              email: msg.userEmail,
              name: msg.userName,
              lastMessage: msg.message,
              timestamp: msg.timestamp
            };
          }
        });
        setConversations(Object.values(groups));
      }
    } catch (err) {
      console.error('Failed to load support conversations:', err);
    }
  };

  // Poll conversation updates
  useEffect(() => {
    if (activeTab === 'support') {
      loadConversations();
      const interval = setInterval(loadConversations, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Active chat loading & polling
  const loadActiveChat = async (email) => {
    if (!email) return;
    try {
      const res = await fetch(`/api/support?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setChatMessages(data.messages);
      }
    } catch (err) {
      console.error('Error fetching live chat:', err);
    }
  };

  useEffect(() => {
    if (activeChatEmail) {
      loadActiveChat(activeChatEmail);
      if (activeChatIntervalRef.current) clearInterval(activeChatIntervalRef.current);
      activeChatIntervalRef.current = setInterval(() => loadActiveChat(activeChatEmail), 3000);
    }
    return () => {
      if (activeChatIntervalRef.current) clearInterval(activeChatIntervalRef.current);
    };
  }, [activeChatEmail]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !activeChatEmail || !adminUser) return;

    const replyMsg = adminReplyText;
    setAdminReplyText('');

    // OPTIMISTIC UPDATE: Instantly show message bubble
    const tempMessage = {
      id: 'temp-' + Date.now(),
      userEmail: activeChatEmail,
      userName: 'Support Agent',
      message: replyMsg,
      senderType: 'admin',
      senderEmail: adminUser.email,
      timestamp: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, tempMessage]);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: activeChatEmail,
          userName: 'Support Agent',
          message: replyMsg,
          senderType: 'admin',
          senderEmail: adminUser.email
        })
      });
      const data = await response.json();
      if (data.success) {
        // Replace temp message with real saved message
        setChatMessages((prev) => prev.map(m => m.id === tempMessage.id ? data.message : m));
        loadConversations();
      }
    } catch (err) {
      console.error('Send admin reply error:', err);
    }
  };

  // Staff creation submit handler
  const handleAddStaffSubmit = (e) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) return;

    onCreateAdmin({
      name: newAdminName,
      email: newAdminEmail,
      password: newAdminPassword,
      role: newAdminRole
    });

    setNewAdminName('');
    setNewAdminEmail('');
    setNewAdminPassword('');
    setNewAdminRole('financial_admin');
  };

  // Settings Save Submit
  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    onUpdateSettings(firstBonusInput, regularBonusInput);
  };

  // Game remaining pool coin balance editor trigger
  const triggerPoolUpdate = async (game) => {
    const promptVal = window.prompt(`Update available/remaining coins pool for ${game.title}:`, game.availableCoins || 0);
    if (promptVal === null) return; // Cancelled
    const val = parseInt(promptVal, 10);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid positive number.');
      return;
    }
    setProcessingIds(prev => ({ ...prev, [game.id]: true }));
    try {
      await onUpdateGameCoinsPool(game.id, val);
    } finally {
      setProcessingIds(prev => ({ ...prev, [game.id]: false }));
    }
  };

  // Helper: tab permissions checking
  const hasAccess = (tabName) => {
    if (!adminUser) return false;
    const role = adminUser.role;
    if (role === 'admin') return true; // Super Admin has access to all
    if (role === 'financial_admin') return ['dashboard', 'ledger'].includes(tabName);
    if (role === 'support_admin') return ['dashboard', 'support'].includes(tabName);
    if (role === 'coins_admin') return ['dashboard', 'games', 'users', 'requests', 'gateways', 'coins'].includes(tabName);
    return false;
  };

  // Users sorting/filtering
  const staffUsers = users.filter((u) => ['admin', 'financial_admin', 'coins_admin', 'support_admin'].includes(u.role));
  const normalUsers = users.filter((u) => u.role === 'user');

  // Search filtering logic
  const filteredGames = games.filter((g) => g.title.toLowerCase().includes(gameSearch.toLowerCase()));
  const filteredUsers = normalUsers.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredRequests = accountRequests.filter((r) => r.userEmail.toLowerCase().includes(requestSearch.toLowerCase()) || r.gameTitle.toLowerCase().includes(requestSearch.toLowerCase()));
  const filteredLedger = transactions.filter((t) => t.userEmail.toLowerCase().includes(ledgerSearch.toLowerCase()) || t.gateway.toLowerCase().includes(ledgerSearch.toLowerCase()) || t.type.toLowerCase().includes(ledgerSearch.toLowerCase()));
  const filteredGateways = gateways.filter((g) => g.name.toLowerCase().includes(gatewaySearch.toLowerCase()) || g.tag.toLowerCase().includes(gatewaySearch.toLowerCase()));
  const filteredStaff = staffUsers.filter((s) => s.name.toLowerCase().includes(staffSearch.toLowerCase()) || s.email.toLowerCase().includes(staffSearch.toLowerCase()) || s.role.toLowerCase().includes(staffSearch.toLowerCase()));
  const filteredConversations = conversations.filter((c) => c.email.toLowerCase().includes(chatSearch.toLowerCase()) || (c.name && c.name.toLowerCase().includes(chatSearch.toLowerCase())));
  const filteredCoinsNotifications = coinsNotifications.filter((n) => n.userEmail.toLowerCase().includes(coinsNotiSearch.toLowerCase()) || n.gameTitle.toLowerCase().includes(coinsNotiSearch.toLowerCase()));

  // Tab Badge counts
  const pendingRequestsCount = accountRequests.filter((r) => r.status === 'PENDING').length;
  const pendingTransactionsCount = transactions.filter((t) => t.status === 'PENDING').length;
  const pendingCoinsCount = coinsNotifications.filter((n) => n.status === 'PENDING').length;

  // Daily summary calculator
  const getDailySummary = () => {
    let todayDeposits = 0;
    let todayWithdrawals = 0;
    let yesterdayDeposits = 0;
    let yesterdayWithdrawals = 0;

    const now = new Date();
    const todayStr = now.toDateString();
    
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toDateString();

    transactions.forEach((tx) => {
      if (tx.status !== 'SUCCESS') return;

      const txDate = new Date(tx.date);
      const txDateStr = txDate.toDateString();
      const amount = parseFloat(tx.amount) || 0;

      if (txDateStr === todayStr) {
        if (tx.type === 'DEPOSIT') todayDeposits += amount;
        else if (tx.type === 'WITHDRAW') todayWithdrawals += amount;
      } else if (txDateStr === yesterdayStr) {
        if (tx.type === 'DEPOSIT') yesterdayDeposits += amount;
        else if (tx.type === 'WITHDRAW') yesterdayWithdrawals += amount;
      }
    });

    return { todayDeposits, todayWithdrawals, yesterdayDeposits, yesterdayWithdrawals };
  };

  const { todayDeposits, todayWithdrawals, yesterdayDeposits, yesterdayWithdrawals } = getDailySummary();

  return (
    <div id="view-admin-dashboard" className="admin-dashboard-layout">
      {/* Mobile Top Header Bar */}
      <div className="admin-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', marginRight: '0.25rem' }}
          >
            <i className={`fa-solid ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-heading)' }}>JACKPOT ROYALS</span>
        </div>
        <button className="lobby-nav-btn logout-btn" onClick={onLogout} style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', margin: 0, width: 'auto' }}>
          <i className="fa-solid fa-right-from-bracket"></i>
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
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-comments" style={{ width: '18px' }}></i>
              <span>Live Chat Support</span>
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
      <main className="admin-main-workspace">
        
        {/* ==============================================================
             WELCOME LANDING DASHBOARD
             ============================================================== */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
            
            {/* Daily Financial Summaries */}
            <section className="admin-stats-grid">
              <div className="stat-card" style={{ borderLeft: '4px solid #2ecc71' }}>
                <div className="stat-icon-wrapper green-bg"><i className="fa-solid fa-arrow-down-long"></i></div>
                <div className="stat-info">
                  <h3>${todayDeposits.toFixed(2)}</h3>
                  <p>Today's Total Deposits</p>
                </div>
              </div>
              
              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="stat-icon-wrapper red-bg"><i className="fa-solid fa-arrow-up-long"></i></div>
                <div className="stat-info">
                  <h3>${todayWithdrawals.toFixed(2)}</h3>
                  <p>Today's Total Withdrawals</p>
                </div>
              </div>

              <div className="stat-card" style={{ borderLeft: '4px solid #3498db' }}>
                <div className="stat-icon-wrapper gold-bg"><i className="fa-solid fa-calendar-day"></i></div>
                <div className="stat-info">
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Yesterday Details:</span>
                  <span style={{ fontSize: '0.8rem', color: '#2ecc71', fontWeight: 'bold' }}>📥 In: ${yesterdayDeposits.toFixed(2)}</span>
                  <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold', marginLeft: '0.5rem' }}>📤 Out: ${yesterdayWithdrawals.toFixed(2)}</span>
                </div>
              </div>
            </section>

            {/* Game coins pool status */}
            <section className="admin-section-card">
              <div className="section-card-header">
                <div>
                  <h3><i className="fa-solid fa-coins gold-text"></i> Game Coins Remaining Pool</h3>
                  <span className="game-tap-tip">Allotment reserves of active game platforms</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Game Title</th>
                      <th>Game Badge</th>
                      <th>Remaining Coins Balance</th>
                      <th>Fulfillment Portal</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">No games loaded in library.</td>
                      </tr>
                    ) : (
                      games.map((game) => (
                        <tr key={game.id}>
                          <td><strong>{game.title}</strong></td>
                          <td><span className={`admin-badge-preview b-${game.badge}`}>{game.badge}</span></td>
                          <td>
                            <strong style={{ fontSize: '0.95rem', color: (game.availableCoins || 0) < 5000 ? '#ef4444' : '#ffd700' }}>
                              🪙 {game.availableCoins || 0} Coins
                            </strong>
                          </td>
                          <td>
                            <a href={game.link} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
                              Open Panel &rarr;
                            </a>
                          </td>
                          <td>
                            {(adminUser?.role === 'admin' || adminUser?.role === 'coins_admin') ? (
                              <button
                                onClick={() => triggerPoolUpdate(game)}
                                className="action-row-btn btn-edit"
                                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                title="Update Remaining Pool"
                              >
                                <i className="fa-solid fa-pen-to-square"></i> Update Pool
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Restricted</span>
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
        )}

        {/* ==============================================================
             GAMES LIBRARY TAB
             ============================================================== */}
        {activeTab === 'games' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3><i className="fa-solid fa-gamepad gold-text"></i> Game Library Manager</h3>
                <button className="submit-btn add-game-trigger" onClick={onAddGameClick} style={{ width: 'auto', marginTop: 0 }}>
                  <i className="fa-solid fa-plus"></i> Add New Game
                </button>
              </div>
              
              <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass input-icon"></i>
                <input
                  type="text"
                  placeholder="Search games by title..."
                  value={gameSearch}
                  onChange={(e) => setGameSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Game Cover</th>
                    <th>Game Title</th>
                    <th>Badge Type</th>
                    <th>Target Play Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.length === 0 ? (
                    <tr><td colSpan="5" className="text-center text-muted">No games matching criteria found.</td></tr>
                  ) : (
                    filteredGames.map((game) => (
                      <tr key={game.id}>
                        <td>
                          <div className="admin-game-th-img">
                            {game.image.startsWith('data:') || game.image.startsWith('game_') || game.image.startsWith('http') ? (
                              <img src={game.image} alt="cover" style={{ borderRadius: '6px' }} />
                            ) : (
                              <div className={`game-placeholder-card ${game.image === 'placeholder_2' ? 'pc-red' : game.image === 'placeholder_3' ? 'pc-blue' : 'pc-gold'}`} style={{ fontSize: '1rem', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {game.title.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td><strong>{game.title}</strong></td>
                        <td><span className={`admin-badge-preview b-${game.badge}`}>{game.badge}</span></td>
                        <td>
                          <a href={game.link} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
                            {game.link.slice(0, 24)}...
                          </a>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button className="action-row-btn btn-edit" onClick={() => onEditGameClick(game)} title="Edit game"><i className="fa-solid fa-pen"></i></button>
                            <button className="action-row-btn btn-delete" onClick={() => onDeleteGame(game.id)} title="Delete game"><i className="fa-solid fa-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             USER ACCOUNTS TAB (No Wallet adjustment)
             ============================================================== */}
        {activeTab === 'users' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h3><i className="fa-solid fa-users text-red"></i> Player Accounts</h3>
              
              <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass input-icon"></i>
                <input
                  type="text"
                  placeholder="Search players by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
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
                    <th>Referrals</th>
                    <th>Status Privilege</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan="6" className="text-center text-muted">No matching players.</td></tr>
                  ) : (
                    filteredUsers.map((user) => {
                      // Count how many users have this user's email as their referredBy
                      const referralCount = users.filter(u => u.referredBy && u.referredBy.toLowerCase() === user.email.toLowerCase()).length;
                      return (
                        <tr key={user.email}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#a855f7', fontWeight: 700 }}>
                              {user.referralCode || '—'}
                            </span>
                          </td>
                          <td>
                            {referralCount > 0 ? (
                              <span className="admin-badge-preview b-hot" style={{ cursor: 'default' }}>
                                {referralCount} {referralCount === 1 ? 'referral' : 'referrals'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                          <td>
                            <span className="admin-badge-preview b-new">PLAYER</span>
                          </td>
                          <td>
                            <button className="action-row-btn btn-delete" onClick={() => onDeleteUser(user.email)} title="Delete User"><i className="fa-solid fa-user-minus"></i></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             TAB: LOBBY REQUESTS
             ============================================================== */}
        {activeTab === 'requests' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3><i className="fa-solid fa-user-plus gold-text"></i> Pending Lobby Game Account Requests</h3>
                <span className="game-tap-tip" style={{ float: 'right' }}>Allot player login credentials</span>
              </div>
              
              <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass input-icon"></i>
                <input
                  type="text"
                  placeholder="Search requests by email or game portal..."
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User Email</th>
                    <th>Requested Game</th>
                    <th>Request Timestamp</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No pending game account requests match criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req, idx) => (
                      <tr key={req.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{req.userEmail}</strong></td>
                        <td><span className="admin-badge-preview b-hot">{req.gameTitle}</span></td>
                        <td>{req.date}</td>
                        <td>
                          <span className={`admin-badge-preview b-${req.status.toLowerCase() === 'ready' ? 'ready' : req.status.toLowerCase()}`}>
                            {req.status}
                          </span>
                        </td>
                        <td>
                          {req.status === 'PENDING' ? (
                            <button
                              disabled={processingIds[req.id]}
                              onClick={wrapAction(req.id, () => onApproveRequest(req))}
                              className="submit-btn"
                              style={{ background: '#22c55e', margin: 0, padding: '0.4rem 0.85rem', width: 'auto', display: 'inline-flex', gap: '0.4rem', alignItems: 'center', opacity: processingIds[req.id] ? 0.6 : 1 }}
                            >
                              {processingIds[req.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-user-check"></i>}
                              <span style={{ fontSize: '0.7rem' }}>
                                {processingIds[req.id] ? 'Approving...' : 'Approve Request'}
                              </span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Credentials Issued</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             TAB: FINANCIAL LEDGER
             ============================================================== */}
        {activeTab === 'ledger' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h3><i className="fa-solid fa-wallet text-red"></i> Financial Transaction Ledger</h3>
              
              <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass input-icon"></i>
                <input
                  type="text"
                  placeholder="Search ledger by email, gateway, or deposit/withdraw..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User Email</th>
                    <th>Game Title</th>
                    <th>Tx Type</th>
                    <th>Amount</th>
                    <th>Gateway Details</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Payment Screenshot</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No ledger transactions matching criteria found.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((tx, idx) => (
                      <tr key={tx.id}>
                        <td>{idx + 1}</td>
                        <td>{tx.userEmail}</td>
                        <td><strong>{tx.gameTitle}</strong></td>
                        <td>
                          <span className={`admin-badge-preview ${tx.type === 'DEPOSIT' ? 'b-hot' : 'b-new'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td><strong>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                        <td>
                          <span style={{ fontSize: '0.725rem', opacity: 0.9 }}>
                            {tx.gateway} ({tx.code})
                          </span>
                          {tx.nameOnTag && (
                            <div style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <span style={{ color: '#ffd700' }}>Name: {tx.nameOnTag}</span>
                              {tx.phoneOnTag && <span style={{ color: 'var(--text-muted)' }}>Phone: {tx.phoneOnTag}</span>}
                            </div>
                          )}
                          {tx.note && <p style={{ fontSize: '0.65rem', color: '#ff8787', margin: '0.2rem 0 0 0' }}>{tx.note}</p>}
                        </td>
                        <td style={{ fontSize: '0.7rem' }}>{tx.date}</td>
                        <td>
                          <span className={`admin-badge-preview b-${tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase()}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td>
                          {tx.screenshot ? (
                            <button
                              onClick={() => onInspectProof(tx.screenshot)}
                              className="submit-btn"
                              style={{ background: '#3498db', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                            >
                              <i className="fa-solid fa-receipt"></i> <span style={{ fontSize: '0.65rem' }}>View Proof</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No Screenshot</span>
                          )}
                        </td>
                        <td>
                          {tx.status === 'PENDING' ? (
                            <div className="table-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                              <button
                                disabled={processingIds[tx.id]}
                                onClick={wrapAction(tx.id, () => onApproveTransaction(tx.id))}
                                className="action-row-btn btn-edit"
                                style={{ background: '#22c55e', color: '#fff', opacity: processingIds[tx.id] ? 0.5 : 1 }}
                                title="Approve Payment"
                              >
                                {processingIds[tx.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                              </button>
                              <button
                                disabled={processingIds[tx.id]}
                                onClick={wrapAction(tx.id, () => onFailTransaction(tx.id))}
                                className="action-row-btn btn-delete"
                                style={{ background: '#ef4444', color: '#fff', opacity: processingIds[tx.id] ? 0.5 : 1 }}
                                title="Fail/Reject Payment"
                              >
                                {processingIds[tx.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-xmark"></i>}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Processed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             TAB: DYNAMIC PAYMENT GATEWAYS
             ============================================================== */}
        {activeTab === 'gateways' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3><i className="fa-solid fa-sliders gold-text"></i> Payment Gateways Manager</h3>
                <button className="submit-btn add-game-trigger" onClick={onAddGatewayClick} style={{ width: 'auto', marginTop: 0 }}>
                  <i className="fa-solid fa-plus"></i> Add New Gateway
                </button>
              </div>
              
              <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass input-icon"></i>
                <input
                  type="text"
                  placeholder="Search payment gateways..."
                  value={gatewaySearch}
                  onChange={(e) => setGatewaySearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Gateway Name</th>
                    <th>Subtitle Description</th>
                    <th>Payment Handle Tag</th>
                    <th>Phone / Contact Info</th>
                    <th>Visual Theme</th>
                    <th>QR Image Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGateways.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No gateways configured. Click Add to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredGateways.map((gt) => (
                      <tr key={gt.id}>
                        <td><strong>{gt.name}</strong></td>
                        <td><span style={{ fontSize: '0.725rem', opacity: 0.8 }}>{gt.subtitle || '—'}</span></td>
                        <td><code style={{ color: '#00d2ff' }}>{gt.tag}</code></td>
                        <td>{gt.phone || '—'}</td>
                        <td>
                          <span className={`admin-badge-preview b-${gt.theme === 'chime' ? 'ready' : gt.theme === 'cashapp' ? 'none' : gt.theme === 'crypto' ? 'hot' : 'new'}`} style={{ textTransform: 'uppercase' }}>
                            {gt.theme}
                          </span>
                        </td>
                        <td>
                          <a href={gt.qrImage} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.7rem', textDecoration: 'none' }} title={gt.qrImage}>
                            {gt.qrImage.slice(0, 30)}...
                          </a>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button onClick={() => onEditGatewayClick(gt)} className="action-row-btn btn-edit" title="Edit Gateway"><i className="fa-solid fa-pen"></i></button>
                            <button onClick={() => onDeleteGateway(gt.id)} className="action-row-btn btn-delete" title="Delete Gateway"><i className="fa-solid fa-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             TAB: COINS ALLOTMENT QUEUE
             ============================================================== */}
        {activeTab === 'coins' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3><i className="fa-solid fa-coins gold-text"></i> Pending Game Coin Allotment Tasks</h3>
                <span className="game-tap-tip" style={{ float: 'right' }}>Allot calculated coins on external game panels</span>
              </div>
              
              <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                <i className="fa-solid fa-magnifying-glass input-icon"></i>
                <input
                  type="text"
                  placeholder="Search tasks by player email or game..."
                  value={coinsNotiSearch}
                  onChange={(e) => setCoinsNotiSearch(e.target.value)}
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
                  {filteredCoinsNotifications.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No pending coin allotment tasks found.
                      </td>
                    </tr>
                  ) : (
                    filteredCoinsNotifications.map((noti, idx) => (
                      <tr key={noti.id} style={{ opacity: noti.status === 'COMPLETED' ? 0.6 : 1 }}>
                        <td>{idx + 1}</td>
                        <td><strong>{noti.userEmail}</strong></td>
                        <td><span className="admin-badge-preview b-hot">{noti.gameTitle}</span></td>
                        <td>${parseFloat(noti.depositAmount).toFixed(2)}</td>
                        <td>{noti.bonusApplied}% Bonus</td>
                        <td>
                          <strong style={{ color: '#00ff66', fontSize: '0.9rem' }}>🪙 {noti.totalCoins}</strong>
                        </td>
                        <td style={{ fontSize: '0.7rem' }}>{new Date(noti.timestamp).toLocaleString()}</td>
                        <td>
                          <button
                            disabled={processingIds[noti.id]}
                            onClick={wrapAction(noti.id, () => onUpdateCoinsNotification(noti.id, undefined, !noti.read))}
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
                          <span className={`admin-badge-preview b-${noti.status === 'PENDING' ? 'none' : 'ready'}`}>
                            {noti.status}
                          </span>
                        </td>
                        <td>
                          {noti.status === 'PENDING' ? (
                            <button
                              disabled={processingIds[noti.id]}
                              onClick={wrapAction(noti.id, () => onUpdateCoinsNotification(noti.id, 'COMPLETED', true))}
                              className="submit-btn"
                              style={{ background: 'linear-gradient(135deg, #00ff66 0%, #00a844 100%)', color: '#000', margin: 0, padding: '0.35rem 0.75rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontWeight: 'bold', opacity: processingIds[noti.id] ? 0.6 : 1 }}
                            >
                              {processingIds[noti.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-circle-check"></i>}
                              <span style={{ fontSize: '0.7rem' }}>
                                {processingIds[noti.id] ? 'Updating...' : 'DONE'}
                              </span>
                            </button>
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
          </section>
        )}

        {/* ==============================================================
             TAB: LIVE CUSTOMER SUPPORT INBOX
             ============================================================== */}
        {activeTab === 'support' && (
          <div className="admin-layout-split" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', height: '600px', animation: 'fade-in 0.2s ease-out' }}>
            
            {/* Active chats list */}
            <div className="admin-section-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  <i className="fa-solid fa-comments"></i> Active Conversations
                </h4>
                <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', padding: '0.35rem 0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    style={{ fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredConversations.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', margin: 'auto' }}>No chats found.</p>
                ) : (
                  filteredConversations.map((chat) => (
                    <div
                      key={chat.email}
                      onClick={() => setActiveChatEmail(chat.email)}
                      style={{
                        padding: '0.75rem 1rem',
                        background: activeChatEmail === chat.email ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                        border: activeChatEmail === chat.email ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <strong style={{ fontSize: '0.8rem', color: '#fff', display: 'block' }}>{chat.name || 'Player'}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                        {chat.lastMessage}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Conversation window */}
            <div className="admin-section-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden', background: '#07090f' }}>
              {activeChatEmail ? (
                <>
                  <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Chat: {activeChatEmail}</h4>
                      <span style={{ fontSize: '0.7rem', color: '#ffd700' }}>Active Live Support Session</span>
                    </div>
                    <button
                      onClick={() => { setActiveChatEmail(null); setChatMessages([]); }}
                      className="close-modal"
                      style={{ fontSize: '1rem', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}
                    >
                      Close Chat
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0', paddingRight: '0.25rem' }}>
                    {chatMessages.map((msg) => {
                      const isMe = msg.senderType === 'admin';
                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            background: isMe ? 'var(--gold-primary)' : 'rgba(255,255,255,0.08)',
                            color: isMe ? '#000' : '#fff',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '12px',
                            borderBottomRightRadius: isMe ? '2px' : '12px',
                            borderBottomLeftRadius: isMe ? '12px' : '2px',
                            fontSize: '0.8rem',
                            maxWidth: '75%',
                            fontWeight: isMe ? '600' : 'normal',
                            wordBreak: 'break-word'
                          }}>
                            {msg.message}
                          </div>
                          <span style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '0.15rem' }}>
                            {isMe ? 'You (Agent)' : (msg.userName || 'Player')} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendAdminReply} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Type reply to player..."
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#0c0e17',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '0.65rem 1rem',
                        color: '#fff',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                      required
                    />
                    <button type="submit" className="submit-btn" style={{ margin: 0, padding: '0.65rem 1.25rem', width: 'auto', background: 'linear-gradient(135deg, #ffd700 0%, #cca000 100%)', color: '#000', fontWeight: 'bold' }}>
                      Reply
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
                  <i className="fa-solid fa-headset" style={{ fontSize: '3rem', color: 'var(--gold-primary)', display: 'block', marginBottom: '0.5rem' }}></i>
                  <p style={{ fontSize: '0.85rem' }}>Select a conversation from the sidebar to text live with players.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
             TAB: SUPER ADMIN STAFF / ADMINS CREATION
             ============================================================== */}
        {activeTab === 'staff' && (
          <div className="admin-layout-split" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
            
            <section className="admin-section-card">
              <div className="section-card-header" style={{ marginBottom: '1.25rem' }}>
                <h3><i className="fa-solid fa-user-shield gold-text"></i> Register Admin Staff</h3>
              </div>

              <form onSubmit={handleAddStaffSubmit} noValidate>
                <div className="input-group">
                  <label htmlFor="staff-name">Full Name</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-user input-icon"></i>
                    <input
                      type="text"
                      id="staff-name"
                      placeholder="e.g. Deposit Agent"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="staff-email">Login Email</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-envelope input-icon"></i>
                    <input
                      type="email"
                      id="staff-email"
                      placeholder="staff@jackpot.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="staff-pass">Temporary Password</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-lock input-icon"></i>
                    <input
                      type="text"
                      id="staff-pass"
                      placeholder="e.g. staffPass123"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="staff-role">Staff Authority Role</label>
                  <div className="input-wrapper select-wrapper">
                    <i className="fa-solid fa-user-shield input-icon"></i>
                    <select
                      id="staff-role"
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value)}
                    >
                      <option value="financial_admin">Financial Admin (Transactions Ledger)</option>
                      <option value="coins_admin">Coins & Games Admin (Gateways/Catalog)</option>
                      <option value="support_admin">Support Admin (Human Live Support)</option>
                      <option value="admin">Super Admin (Unrestricted Full Access)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }}>
                  CREATE STAFF USER &rarr;
                </button>
              </form>
            </section>

            <section className="admin-section-card">
              <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <h3><i className="fa-solid fa-user-shield text-red"></i> Administrative Staff Registry</h3>
                
                <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
                  <i className="fa-solid fa-magnifying-glass input-icon"></i>
                  <input
                    type="text"
                    placeholder="Search staff registry..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Privilege Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.length === 0 ? (
                      <tr><td colSpan="4" className="text-center text-muted">No staff found.</td></tr>
                    ) : (
                      filteredStaff.map((staff) => (
                        <tr key={staff.email}>
                          <td>{staff.name}</td>
                          <td>{staff.email}</td>
                          <td>
                            <span className={`admin-badge-preview b-${staff.role === 'admin' ? 'ready' : staff.role === 'financial_admin' ? 'none' : staff.role === 'coins_admin' ? 'hot' : 'new'}`} style={{ textTransform: 'uppercase' }}>
                              {staff.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {staff.email.toLowerCase() === adminUser?.email.toLowerCase() ? (
                              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Active User</span>
                            ) : (
                              <button
                                className="action-row-btn btn-delete"
                                onClick={() => onDeleteUser(staff.email)}
                                title="Delete Admin"
                              >
                                <i className="fa-solid fa-user-minus"></i>
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
          </div>
        )}

        {/* ==============================================================
             TAB: SYSTEM SETTINGS (BONUS PERCENTAGE CONTROLS)
             ============================================================== */}
        {activeTab === 'settings' && (
          <section className="admin-section-card" style={{ maxWidth: '600px', margin: '0 auto', animation: 'fade-in 0.2s ease-out' }}>
            <div className="section-card-header" style={{ marginBottom: '1.25rem' }}>
              <h3><i className="fa-solid fa-sliders gold-text"></i> System Settings & Bonus Percentages</h3>
              <p style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--text-muted)' }}>
                Configure signup and repeat deposit bonuses allotted to players.
              </p>
            </div>

            <form onSubmit={handleSettingsSubmit} noValidate>
              <div className="input-group">
                <label htmlFor="settings-first-bonus">First Deposit Signup Bonus (%)</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-gift input-icon" style={{ color: '#00ff66' }}></i>
                  <input
                    type="number"
                    id="settings-first-bonus"
                    placeholder="e.g. 300"
                    value={firstBonusInput}
                    onChange={(e) => setFirstBonusInput(e.target.value)}
                    required
                  />
                  <span style={{ paddingRight: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
                </div>
                <span className="game-tap-tip">Calculates multiplier of deposit when a player makes their very first payment (e.g. 300% adds 3x coins).</span>
              </div>

              <div className="input-group" style={{ marginTop: '1.5rem' }}>
                <label htmlFor="settings-regular-bonus">Regular Repeat Deposit Bonus (%)</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-rotate input-icon" style={{ color: '#00d2ff' }}></i>
                  <input
                    type="number"
                    id="settings-regular-bonus"
                    placeholder="e.g. 20"
                    value={regularBonusInput}
                    onChange={(e) => setRegularBonusInput(e.target.value)}
                    required
                  />
                  <span style={{ paddingRight: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
                </div>
                <span className="game-tap-tip">Calculates multiplier of deposit when a player makes repeat deposits (e.g. 20% adds 1.2x coins).</span>
              </div>

              <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', marginTop: '2rem' }}>
                SAVE CONFIGURATIONS &rarr;
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
