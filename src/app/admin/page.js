'use client';

import React, { useState, useEffect } from 'react';
import ParticlesBackground from '../../components/ParticlesBackground';
import AdminDashboard from '../../components/AdminDashboard';
import LoadingOverlay from '../../components/LoadingOverlay';
import { AdminGameModal, ApproveAccountModal, AdminGatewayModal, ViewProofModal } from '../../components/Modals';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Database State Stores
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [accountRequests, setAccountRequests] = useState([]);
  const [gameAccounts, setGameAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [gateways, setGateways] = useState([]);

  // Modal Controls
  const [loadingActive, setLoadingActive] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [editGameData, setEditGameData] = useState(null);
  
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [activeRequestDetails, setActiveRequestDetails] = useState(null);

  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [editGatewayData, setEditGatewayData] = useState(null);

  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');

  // 1. Initialise and load database values
  const loadDatabase = () => {
    setGames(JSON.parse(localStorage.getItem('jackpot_games') || '[]'));
    setUsers(JSON.parse(localStorage.getItem('jackpot_users') || '[]'));
    setAccountRequests(JSON.parse(localStorage.getItem('jackpot_account_requests') || '[]'));
    setGameAccounts(JSON.parse(localStorage.getItem('jackpot_game_accounts') || '[]'));
    setTransactions(JSON.parse(localStorage.getItem('jackpot_transactions') || '[]'));
    setGateways(JSON.parse(localStorage.getItem('jackpot_payment_gateways') || '[]'));
  };

  useEffect(() => {
    // Check local session
    const adminSession = localStorage.getItem('jackpot_admin_session');
    if (adminSession === 'active') {
      setAuthenticated(true);
    }

    loadDatabase();

    // 2. Multi-tab Real-Time Synchronization Listener (Zero Refresh!)
    const handleStorageEvent = (e) => {
      loadDatabase();
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  // Shared toast trigger
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const triggerLoading = (duration = 1000, callback) => {
    setLoadingActive(true);
    setTimeout(() => {
      setLoadingActive(false);
      if (callback) callback();
    }, duration);
  };

  // Admin login credentials check against env parameters
  const handleAdminLogin = (e) => {
    e.preventDefault();
    const envEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@jackpot.com';
    const envPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';

    if (adminEmail.trim().toLowerCase() === envEmail.toLowerCase() && adminPassword === envPass) {
      triggerLoading(1200, () => {
        setAuthenticated(true);
        localStorage.setItem('jackpot_admin_session', 'active');
        showToast('Secure Admin Session Initiated.', 'success');
      });
    } else {
      setLoginError('Invalid Administrator credentials.');
    }
  };

  const handleAdminLogout = () => {
    triggerLoading(800, () => {
      setAuthenticated(false);
      localStorage.removeItem('jackpot_admin_session');
      setAdminEmail('');
      setAdminPassword('');
      showToast('Logged out of Admin Portal.', 'info');
    });
  };

  // Games CRUDS
  const handleSaveGame = (gameItem) => {
    let updated;
    if (gameItem.id) {
      updated = games.map((g) => (g.id === gameItem.id ? gameItem : g));
      showToast(`Game "${gameItem.title}" updated successfully!`, 'success');
    } else {
      const newGame = { ...gameItem, id: (Date.now() + Math.floor(Math.random() * 100)).toString() };
      updated = [...games, newGame];
      showToast(`Game "${gameItem.title}" created successfully!`, 'success');
    }
    setGames(updated);
    localStorage.setItem('jackpot_games', JSON.stringify(updated));
    setGameModalOpen(false);
  };

  const handleDeleteGame = (id) => {
    if (window.confirm('Are you sure you want to delete this game?')) {
      const updated = games.filter((g) => g.id !== id);
      setGames(updated);
      localStorage.setItem('jackpot_games', JSON.stringify(updated));
      showToast('Game deleted successfully.', 'error');
    }
  };

  const handleDeleteUser = (email) => {
    if (window.confirm(`Delete user account "${email}"?`)) {
      const updated = users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
      setUsers(updated);
      localStorage.setItem('jackpot_users', JSON.stringify(updated));
      showToast('User account deleted.', 'error');
    }
  };

  // Account Request Approvals
  const handleOpenApproveRequest = (requestItem) => {
    setActiveRequestDetails(requestItem);
    setApproveModalOpen(true);
  };

  const handleSaveApprovedAccount = (credData) => {
    // 1. Save credentials
    const newAccount = {
      gameTitle: credData.gameTitle,
      userEmail: credData.userEmail,
      username: credData.username,
      password: credData.password,
      status: 'READY'
    };
    const updatedAccounts = [...gameAccounts, newAccount];
    setGameAccounts(updatedAccounts);
    localStorage.setItem('jackpot_game_accounts', JSON.stringify(updatedAccounts));

    // 2. Mark Request as ready
    const updatedRequests = accountRequests.map((req) => 
      req.id === credData.requestId ? { ...req, status: 'READY' } : req
    );
    setAccountRequests(updatedRequests);
    localStorage.setItem('jackpot_account_requests', JSON.stringify(updatedRequests));

    setApproveModalOpen(false);
    showToast(`Account credentials sent to ${credData.userEmail}!`, 'success');
  };

  // Transaction Ledger Approvals
  const handleApproveTransaction = (txId) => {
    const updated = transactions.map((tx) => {
      if (tx.id === txId) {
        return { ...tx, status: 'SUCCESS' };
      }
      return tx;
    });
    setTransactions(updated);
    localStorage.setItem('jackpot_transactions', JSON.stringify(updated));
    showToast(`Transaction approved successfully.`, 'success');
  };

  const handleFailTransaction = (txId) => {
    const feedbackMsg = window.prompt('Enter reason for rejection/failure:', 'Payment not received');
    if (feedbackMsg === null) return; // Cancelled

    const updated = transactions.map((tx) => {
      if (tx.id === txId) {
        return { ...tx, status: 'FAILED', note: feedbackMsg || 'Declined by Admin' };
      }
      return tx;
    });
    setTransactions(updated);
    localStorage.setItem('jackpot_transactions', JSON.stringify(updated));
    showToast('Transaction set to FAILED status.', 'error');
  };

  // View Screenshot proof trigger
  const handleInspectProof = (imgUrl) => {
    setProofImageUrl(imgUrl);
    setProofModalOpen(true);
  };

  // Payment Gateway CRUDs
  const handleAddGatewayClick = () => {
    setEditGatewayData(null);
    setGatewayModalOpen(true);
  };

  const handleEditGatewayClick = (gateway) => {
    setEditGatewayData(gateway);
    setGatewayModalOpen(true);
  };

  const handleSaveGateway = (gtData) => {
    let updated;
    if (gtData.id) {
      // Edit
      updated = gateways.map((g) => (g.id === gtData.id ? gtData : g));
      showToast(`Gateway "${gtData.name}" updated successfully.`, 'success');
    } else {
      // Add
      const newGt = { ...gtData, id: (Date.now() + Math.floor(Math.random() * 100)).toString() };
      updated = [...gateways, newGt];
      showToast(`Gateway "${gtData.name}" created successfully.`, 'success');
    }
    setGateways(updated);
    localStorage.setItem('jackpot_payment_gateways', JSON.stringify(updated));
    setGatewayModalOpen(false);
  };

  const handleDeleteGateway = (id) => {
    if (window.confirm('Are you sure you want to delete this payment gateway?')) {
      const updated = gateways.filter((g) => g.id !== id);
      setGateways(updated);
      localStorage.setItem('jackpot_payment_gateways', JSON.stringify(updated));
      showToast('Payment gateway deleted.', 'error');
    }
  };

  return (
    <>
      <ParticlesBackground />
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      {toast && (
        <div className={`notification-banner ${toast.type === 'error' ? 'error' : toast.type === 'success' ? 'success' : ''}`}>
          <span>{toast.message}</span>
          <button className="close-notification" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {/* A) SECURE ADMINISTRATIVE SIGN-IN PANEL */}
      {!authenticated ? (
        <div className="page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <article className="auth-card" style={{ maxWidth: '420px', padding: '2.5rem 2rem', width: '100%' }}>
            <div className="glow-border-layer"></div>
            
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div className="logo-container animate-float" style={{ width: '70px', height: '70px', margin: '0 auto 10px auto' }}>
                <i className="fa-solid fa-user-shield gold-text" style={{ fontSize: '2.5rem', marginTop: '12px', display: 'block' }}></i>
                <div className="logo-glow"></div>
              </div>
              <h2 className="brand-title" style={{ fontSize: '1.5rem' }}>
                <span className="gold-text-1">ADMIN</span>
                <span className="gold-text-2">SECURE</span>
              </h2>
              <p className="brand-subheading" style={{ fontSize: '0.7rem' }}>Authorized staff personnel only.</p>
            </div>

            <form onSubmit={handleAdminLogin} noValidate>
              <div className="input-group">
                <label htmlFor="admin-email">Admin Login Email</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-envelope input-icon"></i>
                  <input
                    type="email"
                    id="admin-email"
                    placeholder="admin@jackpot.com"
                    value={adminEmail}
                    onChange={(e) => { setAdminEmail(e.target.value); setLoginError(''); }}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="admin-pass">Access Password</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-lock input-icon"></i>
                  <input
                    type="password"
                    id="admin-pass"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => { setAdminPassword(e.target.value); setLoginError(''); }}
                    required
                  />
                </div>
                <span className="error-msg">{loginError}</span>
              </div>

              <button type="submit" className="submit-btn" style={{ background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)' }}>
                <span>SECURE LOGIN &rarr;</span>
                <div className="btn-glow"></div>
              </button>
            </form>
          </article>
        </div>
      ) : (
        /* B) EXPANDED ADMINISTRATIVE WORKSPACE */
        <AdminDashboard
          games={games}
          users={users}
          accountRequests={accountRequests}
          transactions={transactions}
          gateways={gateways}
          onLogout={handleAdminLogout}
          onAddGameClick={() => { setEditGameData(null); setGameModalOpen(true); }}
          onEditGameClick={(game) => { setEditGameData(game); setGameModalOpen(true); }}
          onDeleteGame={handleDeleteGame}
          onDeleteUser={handleDeleteUser}
          onApproveRequest={handleOpenApproveRequest}
          onApproveTransaction={handleApproveTransaction}
          onFailTransaction={handleFailTransaction}
          onInspectProof={handleInspectProof}
          onAddGatewayClick={handleAddGatewayClick}
          onEditGatewayClick={handleEditGatewayClick}
          onDeleteGateway={handleDeleteGateway}
        />
      )}

      {/* CRUD Games Modal */}
      <AdminGameModal
        isOpen={gameModalOpen}
        onClose={() => setGameModalOpen(false)}
        onSave={handleSaveGame}
        editGame={editGameData}
      />

      {/* Allot login credentials Modal */}
      <ApproveAccountModal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        onApprove={handleSaveApprovedAccount}
        requestDetails={activeRequestDetails}
      />

      {/* CRUD Gateway settings Modal */}
      <AdminGatewayModal
        isOpen={gatewayModalOpen}
        onClose={() => setGatewayModalOpen(false)}
        onSave={handleSaveGateway}
        editGateway={editGatewayData}
      />

      {/* Proof Inspection Modal viewer */}
      <ViewProofModal
        isOpen={proofModalOpen}
        onClose={() => setProofModalOpen(false)}
        proofUrl={proofImageUrl}
      />

      <LoadingOverlay active={loadingActive} />
    </>
  );
}
