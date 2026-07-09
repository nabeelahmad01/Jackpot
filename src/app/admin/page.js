'use client';

import React, { useState, useEffect } from 'react';
import { mutate } from 'swr';
import ParticlesBackground from '../../components/ParticlesBackground';
import AdminDashboard from '../../components/AdminDashboard';
import LoadingOverlay from '../../components/LoadingOverlay';
import { AdminGameModal, ApproveAccountModal, AdminGatewayModal, ViewProofModal } from '../../components/Modals';

export default function AdminPage({ portalName, forcedRole }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Overlay states
  const [loadingActive, setLoadingActive] = useState(false);
  const [toast, setToast] = useState(null);
  const [completedActionIds, setCompletedActionIds] = useState({});
  
  // Modal Controls
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [editGameData, setEditGameData] = useState(null);
  
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [activeRequestDetails, setActiveRequestDetails] = useState(null);

  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [editGatewayData, setEditGatewayData] = useState(null);

  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState('');

  useEffect(() => {
    // Check local session
    const adminSession = localStorage.getItem('jackpot_admin_session');
    if (adminSession && adminSession !== 'active') {
      try {
        const parsed = JSON.parse(adminSession);
        if (parsed && parsed.role) {
          const cleanRoles = (parsed.role || '').toLowerCase().split(',').map(r => r.trim());
          if (forcedRole && !cleanRoles.includes(forcedRole) && !cleanRoles.includes('admin')) {
            localStorage.removeItem('jackpot_admin_session');
            setAuthenticated(false);
            setAdminUser(null);
          } else {
            setAuthenticated(true);
            setAdminUser(parsed);
          }
        }
      } catch (e) {
        setAuthenticated(true);
        setAdminUser({ name: 'System Admin', email: 'admin@jackpot.com', role: 'admin' });
      }
    } else if (adminSession === 'active') {
      setAuthenticated(true);
      setAdminUser({ name: 'System Admin', email: 'admin@jackpot.com', role: 'admin' });
    }

    // Multi-tab Real-Time Synchronization Listener
    const handleStorageEvent = (e) => {
      if (e.key === 'jackpot_admin_session') {
        const sess = localStorage.getItem('jackpot_admin_session');
        if (sess && sess !== 'null') {
          setAuthenticated(true);
          try {
            setAdminUser(JSON.parse(sess));
          } catch (err) {
            setAdminUser({ name: 'System Admin', email: 'admin@jackpot.com', role: 'admin' });
          }
        } else {
          setAuthenticated(false);
          setAdminUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
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

  // Admin login credentials check against database users
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      const data = await response.json();

      if (data.success) {
        const user = data.user;
        const allowedRoles = ['admin', 'financial_admin', 'coins_admin', 'support_admin', 'operation_admin'];
        const cleanRoles = (user.role || '').toLowerCase().split(',').map(r => r.trim());

        if (allowedRoles.some(r => cleanRoles.includes(r))) {
          if (forcedRole && !cleanRoles.includes(forcedRole) && !cleanRoles.includes('admin')) {
            setLoginError(`Access Denied: This portal is strictly restricted to ${forcedRole.toUpperCase().replace('_', ' ')} accounts.`);
            return;
          }

          triggerLoading(1200, () => {
            setAuthenticated(true);
            setAdminUser(user);
            localStorage.setItem('jackpot_admin_session', JSON.stringify(user));
            showToast(`Welcome back, ${user.name}! Session Initiated.`, 'success');
            
            // Refresh stats SWR cache globally
            mutate('/api/admin/stats');
          });
        } else {
          setLoginError('Access Denied. You do not have administrator privileges.');
        }
      } else {
        setLoginError(data.message || 'Invalid Administrator credentials.');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setLoginError('Connection error during login.');
    }
  };

  const handleAdminLogout = () => {
    triggerLoading(800, () => {
      setAuthenticated(false);
      setAdminUser(null);
      localStorage.removeItem('jackpot_admin_session');
      localStorage.removeItem('jackpot_session');
      setAdminEmail('');
      setAdminPassword('');
      showToast('Logged out of Admin Portal.', 'info');
    });
  };

  const handleUpdateUserCoins = async (email, coins) => {
    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, coins })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`User coins updated to ${coins}!`, 'success');
        
        // Mutate users list caches
        mutate((key) => typeof key === 'string' && key.startsWith('/api/users'));
      } else {
        showToast(data.message || 'Failed to update coins.', 'error');
      }
    } catch (err) {
      console.error('Update coins API error:', err);
      showToast('Connection error updating coins.', 'error');
    }
  };

  const handleCreateAdmin = async (adminData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminData.email,
          password: adminData.password,
          name: adminData.name,
          role: adminData.role
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Admin staff account created for ${adminData.name}!`, 'success');
        
        // Revalidate users endpoint
        mutate((key) => typeof key === 'string' && key.startsWith('/api/users'));
      } else {
        showToast(data.message || 'Failed to create admin staff.', 'error');
      }
    } catch (err) {
      console.error('Create admin API error:', err);
      showToast('Connection error creating admin staff.', 'error');
    }
  };

  const handleUpdateSettings = async (firstDepositBonus, regularDepositBonus, referralBonus) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstDepositBonus, regularDepositBonus, referralBonus })
      });
      const data = await response.json();
      if (data.success) {
        showToast('System settings updated successfully!', 'success');
        
        // Mutate SWR settings cache
        mutate('/api/settings');
      } else {
        showToast(data.message || 'Failed to update settings.', 'error');
      }
    } catch (err) {
      console.error('Update settings API error:', err);
      showToast('Connection error updating settings.', 'error');
    }
  };

  const handleUpdateCoinsNotification = async (id, status, read, holdNote) => {
    try {
      const response = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, read, holdNote, processedBy: adminUser?.email || 'admin@jackpot.com' })
      });
      const data = await response.json();
      if (data.success) {
        if (status === 'COMPLETED') {
          showToast('Coin allotment request marked as DONE!', 'success');
          setCompletedActionIds(prev => ({ ...prev, [id]: true }));
        } else if (status === 'HOLD') {
          showToast('Allotment task placed ON HOLD.', 'info');
        } else {
          showToast('Notification status updated.', 'success');
        }
        
        // Revalidate stats & allotment queues caches
        mutate('/api/admin/stats');
        mutate((key) => typeof key === 'string' && key.startsWith('/api/coins-notifications'));
      } else {
        showToast(data.message || 'Failed to update notification.', 'error');
      }
    } catch (err) {
      console.error('Update notification API error:', err);
      showToast('Connection error updating notification.', 'error');
    }
  };

  const handleUpdateGameCoinsPool = async (gameId, coins) => {
    try {
      const response = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId, availableCoins: coins })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Game coins pool updated successfully!', 'success');
        mutate('/api/games');
      } else {
        showToast(data.message || 'Failed to update coins pool.', 'error');
      }
    } catch (err) {
      console.error('Update coins pool API error:', err);
      showToast('Connection error updating coins pool.', 'error');
    }
  };

  // Games CRUDs
  const handleSaveGame = async (gameItem) => {
    try {
      const method = gameItem.id ? 'PUT' : 'POST';
      const response = await fetch('/api/games', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameItem)
      });
      const data = await response.json();
      if (data.success) {
        showToast(gameItem.id ? `Game updated successfully!` : `Game "${gameItem.title}" created successfully!`, 'success');
        mutate('/api/games');
      } else {
        showToast(data.message || 'Failed to save game.', 'error');
      }
    } catch (err) {
      console.error('Save game API error:', err);
      showToast('Connection error saving game.', 'error');
    }
    setGameModalOpen(false);
  };

  const handleDeleteGame = async (id) => {
    if (window.confirm('Are you sure you want to delete this game?')) {
      try {
        const response = await fetch(`/api/games?id=${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          showToast('Game deleted successfully.', 'error');
          mutate('/api/games');
        } else {
          showToast(data.message || 'Failed to delete game.', 'error');
        }
      } catch (err) {
        console.error('Delete game API error:', err);
        showToast('Connection error deleting game.', 'error');
      }
    }
  };

  const handleDeleteUser = async (email) => {
    if (window.confirm(`Delete user account "${email}"?`)) {
      try {
        const response = await fetch(`/api/users?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          showToast('User account deleted.', 'error');
          mutate((key) => typeof key === 'string' && key.startsWith('/api/users'));
        } else {
          showToast(data.message || 'Failed to delete user.', 'error');
        }
      } catch (err) {
        console.error('Delete user API error:', err);
        showToast('Connection error deleting user.', 'error');
      }
    }
  };

  // Account Request Approvals
  const handleOpenApproveRequest = (requestItem) => {
    setActiveRequestDetails(requestItem);
    setApproveModalOpen(true);
  };

  const handleSaveApprovedAccount = async (credData) => {
    try {
      // 1. Create credentials record
      const credResponse = await fetch('/api/game-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: credData.gameTitle,
          userEmail: credData.userEmail,
          username: credData.username,
          password: credData.password
        })
      });
      const credResult = await credResponse.json();

      // 2. Set Request Status as READY
      const reqResponse = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: credData.requestId,
          status: 'READY'
        })
      });
      const reqResult = await reqResponse.json();

      if (credResult.success && reqResult.success) {
        showToast(`Account credentials sent to ${credData.userEmail}!`, 'success');
        setCompletedActionIds(prev => ({ ...prev, [credData.requestId]: true }));
        
        // Mutate stats and lists
        mutate('/api/admin/stats');
        mutate((key) => typeof key === 'string' && key.startsWith('/api/account-requests'));
      } else {
        showToast('Failed to finalize request approval.', 'error');
      }
    } catch (err) {
      console.error('Approve account request API error:', err);
      showToast('Connection error approving request.', 'error');
    }

    setApproveModalOpen(false);
  };

  // Transaction Ledger Approvals
  const handleApproveTransaction = async (txId) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, status: 'SUCCESS', processedBy: adminUser?.email || 'admin@jackpot.com' })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Transaction approved successfully.`, 'success');
        setCompletedActionIds(prev => ({ ...prev, [txId]: true }));
        
        // Mutate stats and transaction lists
        mutate('/api/admin/stats');
        mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      } else {
        showToast(data.message || 'Failed to approve transaction.', 'error');
      }
    } catch (err) {
      console.error('Approve transaction API error:', err);
      showToast('Connection error approving transaction.', 'error');
    }
  };

  const handleFailTransaction = async (txId) => {
    const feedbackMsg = window.prompt('Enter reason for rejection/failure:', 'Payment not received');
    if (feedbackMsg === null) return;

    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, status: 'FAILED', note: feedbackMsg || 'Declined by Admin', processedBy: adminUser?.email || 'admin@jackpot.com' })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Transaction set to FAILED status.', 'error');
        setCompletedActionIds(prev => ({ ...prev, [txId]: true }));
        
        // Mutate stats and transaction lists
        mutate('/api/admin/stats');
        mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      } else {
        showToast(data.message || 'Failed to decline transaction.', 'error');
      }
    } catch (err) {
      console.error('Decline transaction API error:', err);
      showToast('Connection error declining transaction.', 'error');
    }
  };

  // View Screenshot proof trigger
  const handleInspectProof = async (imgUrl, txId) => {
    if (!imgUrl) return;

    if (typeof imgUrl === 'string' && imgUrl.startsWith('data:')) {
      setProofImageUrl(imgUrl);
      setProofModalOpen(true);
    } else if (txId) {
      setProofImageUrl(''); // Set to empty to trigger loading spinner
      setProofModalOpen(true);
      try {
        const res = await fetch(`/api/transactions?id=${txId}`);
        const data = await res.json();
        if (data.success && data.transaction?.screenshot) {
          setProofImageUrl(data.transaction.screenshot);
        } else {
          alert('Failed to load payment receipt screenshot.');
          setProofModalOpen(false);
        }
      } catch (err) {
        console.error(err);
        alert('Error fetching payment proof.');
        setProofModalOpen(false);
      }
    }
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

  const handleSaveGateway = async (gtData) => {
    try {
      const method = gtData.id ? 'PUT' : 'POST';
      const response = await fetch('/api/gateways', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gtData)
      });
      const data = await response.json();
      if (data.success) {
        showToast(gtData.id ? `Gateway "${gtData.name}" updated successfully.` : `Gateway "${gtData.name}" created successfully.`, 'success');
        mutate('/api/gateways');
      } else {
        showToast(data.message || 'Failed to save gateway.', 'error');
      }
    } catch (err) {
      console.error('Save gateway API error:', err);
      showToast('Connection error saving gateway.', 'error');
    }
    setGatewayModalOpen(false);
  };

  const handleDeleteGateway = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment gateway?')) {
      try {
        const response = await fetch(`/api/gateways?id=${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          showToast('Payment gateway deleted.', 'error');
          mutate('/api/gateways');
        } else {
          showToast(data.message || 'Failed to delete gateway.', 'error');
        }
      } catch (err) {
        console.error('Delete gateway API error:', err);
        showToast('Connection error deleting gateway.', 'error');
      }
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
                <span className="gold-text-1">{portalName ? portalName.split(' ')[0].toUpperCase() : 'ADMIN'}</span>
                <span className="gold-text-2">{portalName ? portalName.split(' ').slice(1).join(' ').toUpperCase() : 'SECURE'}</span>
              </h2>
              <p className="brand-subheading" style={{ fontSize: '0.7rem' }}>{portalName ? `${portalName} access panel.` : 'Authorized staff personnel only.'}</p>
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
          adminUser={adminUser}
          completedActionIds={completedActionIds}
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
          onUpdateUserCoins={handleUpdateUserCoins}
          onCreateAdmin={handleCreateAdmin}
          onUpdateSettings={handleUpdateSettings}
          onUpdateCoinsNotification={handleUpdateCoinsNotification}
          onUpdateGameCoinsPool={handleUpdateGameCoinsPool}
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
