'use client';

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ParticlesBackground from '../components/ParticlesBackground';
import AuthPortal from '../components/AuthPortal';
import UserLobby from '../components/UserLobby';
import LoadingOverlay from '../components/LoadingOverlay';
import { SupportModal, GoogleWarningModal } from '../components/Modals';

export default function Home() {
  const [session, setSession] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('jackpot_session') || 'null');
      } catch (err) {
        return null;
      }
    }
    return null;
  });

  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('jackpot_session') || 'null');
        if (saved) {
          if (saved.role === 'admin') return 'loading';
          return 'lobby';
        }
      } catch (err) {
        return 'auth';
      }
    }
    return 'auth';
  });
  
  // Database State Stores
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [accountRequests, setAccountRequests] = useState([]);
  const [gameAccounts, setGameAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [gateways, setGateways] = useState([]);

  // Overlay states
  const [loadingActive, setLoadingActive] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  // Modals Open states
  const [supportOpen, setSupportOpen] = useState(false);
  const [googleWarnOpen, setGoogleWarnOpen] = useState(false);

  // Load database lists from backend APIs
  const loadDatabase = async (userSession = session) => {
    try {
      const gamesRes = await fetch('/api/games');
      const gamesData = await gamesRes.json();
      if (gamesData.success) setGames(gamesData.games);

      const gatewaysRes = await fetch('/api/gateways');
      const gatewaysData = await gatewaysRes.json();
      if (gatewaysData.success) setGateways(gatewaysData.gateways);

      if (userSession && userSession.email) {
        const emailQuery = encodeURIComponent(userSession.email);
        
        const requestsRes = await fetch(`/api/account-requests?email=${emailQuery}`);
        const requestsData = await requestsRes.json();
        if (requestsData.success) setAccountRequests(requestsData.accountRequests);

        const credentialsRes = await fetch(`/api/game-accounts?email=${emailQuery}`);
        const credentialsData = await credentialsRes.json();
        if (credentialsData.success) setGameAccounts(credentialsData.gameAccounts);

        const txRes = await fetch(`/api/transactions?email=${emailQuery}`);
        const txData = await txRes.json();
        if (txData.success) setTransactions(txData.transactions);
      }
    } catch (err) {
      console.error('Failed to load database from APIs:', err);
    }
  };

  // Initialize session and trigger data fetch
  useEffect(() => {
    const savedSession = JSON.parse(localStorage.getItem('jackpot_session') || 'null');
    if (savedSession) {
      if (savedSession.role === 'admin') {
        window.location.href = '/admin';
        return;
      } else {
        setSession(savedSession);
        setView('lobby');
      }
    }
    
    loadDatabase(savedSession);

    // Auto-poll user records from DB every 4 seconds for real-time updates
    const interval = setInterval(() => {
      const currentSess = JSON.parse(localStorage.getItem('jackpot_session') || 'null');
      if (currentSess) {
        loadDatabase(currentSess);
      }
    }, 4000);
    
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('PWA Service Worker registered.'))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }

    return () => clearInterval(interval);
  }, []);

  // Multi-tab Session Synchronization Listener
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'jackpot_session') {
        const currentSess = localStorage.getItem('jackpot_session');
        if (currentSess === 'null' || !currentSess) {
          setSession(null);
          setView('auth');
        } else {
          const parsed = JSON.parse(currentSess);
          setSession(parsed);
          setView('lobby');
          loadDatabase(parsed);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Shared loader trigger
  const triggerLoading = (durationMs = 1500, callback) => {
    setLoadingActive(true);
    setTimeout(() => {
      setLoadingActive(false);
      if (callback) callback();
    }, durationMs);
  };

  // Toast notifier
  const showToast = (message, type = 'info', duration = 5000) => {
    setToast({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        setToast(null);
      }, duration);
    }
  };

  // Authentications callback handlers
  const handleLoginSuccess = (user) => {
    if (user.role === 'admin') {
      showToast('Admin credentials verified. Redirecting to Secure Workspace...', 'success');
      localStorage.setItem('jackpot_admin_session', 'active');
      localStorage.setItem('jackpot_session', JSON.stringify(user));
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1000);
      return;
    }

    setSession(user);
    localStorage.setItem('jackpot_session', JSON.stringify(user));
    setView('lobby');
    loadDatabase(user);
  };

  const handleRegisterSuccess = (newUser) => {
    setSession(newUser);
    localStorage.setItem('jackpot_session', JSON.stringify(newUser));
    setView('lobby');
    loadDatabase(newUser);
    showToast('Welcome to Jackpot Royals! Registration verified successfully.', 'success');
  };

  const handleLogout = () => {
    triggerLoading(1000, () => {
      setSession(null);
      localStorage.setItem('jackpot_session', 'null');
      setView('auth');
      showToast('Logged out successfully.', 'info');
    });
  };

  // Player Account Creation Requests
  const handleRequestAccount = async (gameTitle) => {
    try {
      const response = await fetch('/api/account-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameTitle, userEmail: session.email })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Account creation request submitted for ${gameTitle}!`, 'success');
        loadDatabase(session);
      } else {
        showToast(data.message || 'Failed to submit account request.', 'error');
      }
    } catch (err) {
      console.error('Request account error:', err);
      showToast('Connection error submitting request.', 'error');
    }
  };

  // Player Transactions Requests
  const handleSubmitTransaction = async (newTx) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTx, userEmail: session.email })
      });
      const data = await response.json();
      if (data.success) {
        if (newTx.type === 'DEPOSIT') {
          showToast(`Deposit request of $${parseFloat(newTx.amount).toFixed(2)} submitted with payment proof.`, 'success');
        } else {
          showToast(`Withdrawal request of $${parseFloat(newTx.amount).toFixed(2)} submitted.`, 'success');
        }
        loadDatabase(session);
      } else {
        showToast(data.message || 'Transaction submission failed.', 'error');
      }
    } catch (err) {
      console.error('Submit transaction error:', err);
      showToast('Connection error submitting transaction.', 'error');
    }
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your_google_client_id_here';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ParticlesBackground />
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      {toast && (
        <div className={`notification-banner ${toast.type === 'error' ? 'error' : toast.type === 'success' ? 'success' : ''}`}>
          <span>{toast.message}</span>
          <button className="close-notification" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {/* Screen Views Wrapper */}
      {view === 'loading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', color: '#fff' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)' }}></i>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Redirecting to secure workspace...</span>
        </div>
      ) : view === 'auth' ? (
        <AuthPortal
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
          onGoogleWarning={() => setGoogleWarnOpen(true)}
          triggerLoading={triggerLoading}
          showToast={showToast}
          onOpenSupport={() => setSupportOpen(true)}
        />
      ) : (
        <UserLobby
          games={games}
          accountRequests={accountRequests}
          gameAccounts={gameAccounts}
          transactions={transactions}
          gateways={gateways}
          currentUser={session}
          currentUserEmail={session?.email}
          onLogout={handleLogout}
          showToast={showToast}
          onOpenSupport={() => setSupportOpen(true)}
          onRequestAccount={handleRequestAccount}
          onSubmitTransaction={handleSubmitTransaction}
        />
      )}

      {/* Modals */}
      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        currentUser={session}
      />

      <GoogleWarningModal isOpen={googleWarnOpen} onClose={() => setGoogleWarnOpen(false)} />

      <LoadingOverlay active={loadingActive} />
    </GoogleOAuthProvider>
  );
}
