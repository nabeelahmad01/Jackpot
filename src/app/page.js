'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ParticlesBackground from '../components/ParticlesBackground';
import AuthPortal from '../components/AuthPortal';
import UserLobby from '../components/UserLobby';
import LoadingOverlay from '../components/LoadingOverlay';
import { SupportModal, GoogleWarningModal } from '../components/Modals';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState(null);
  const [view, setView] = useState('loading');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Overlay states
  const [loadingActive, setLoadingActive] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  // Modals Open states
  const [supportOpen, setSupportOpen] = useState(false);
  const [googleWarnOpen, setGoogleWarnOpen] = useState(false);

  // Fetch static data (games and gateways catalog) with SWR (cached, no automatic polling)
  const { data: gamesData } = useSWR('/api/games', fetcher);
  const { data: gatewaysData } = useSWR('/api/gateways', fetcher);
  const { data: frontendSettingsData } = useSWR('/api/settings/frontend', fetcher);

  const games = gamesData?.games || [];
  const gateways = gatewaysData?.gateways || [];
  const frontendSettings = frontendSettingsData?.settings || {};

  // Fetch user-specific queues (only when player is logged in) with SWR polling every 5s
  const emailQuery = session?.email ? encodeURIComponent(session.email) : null;
  
  const { data: requestsData } = useSWR(
    emailQuery ? `/api/account-requests?email=${emailQuery}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: credentialsData } = useSWR(
    emailQuery ? `/api/game-accounts?email=${emailQuery}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: transactionsData } = useSWR(
    emailQuery ? `/api/transactions?email=${emailQuery}&limit=100` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: notificationsData } = useSWR(
    emailQuery ? `/api/coins-notifications?email=${emailQuery}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const accountRequests = requestsData?.accountRequests || [];
  const gameAccounts = credentialsData?.gameAccounts || [];
  const transactions = transactionsData?.transactions || [];
  const coinsNotifications = notificationsData?.coinsNotifications || [];

  // Initialize session
  useEffect(() => {
    setMounted(true);

    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        localStorage.setItem('jackpot_ref_code', ref);
      }
    }

    const savedSession = JSON.parse(localStorage.getItem('jackpot_session') || 'null');
    if (savedSession) {
      if (savedSession.role === 'admin') {
        window.location.href = '/admin';
        return;
      } else {
        setSession(savedSession);
        setView('lobby');
      }
    } else {
      setView('auth');
    }
    
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('PWA Service Worker registered.'))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
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
  };

  const handleRegisterSuccess = (newUser) => {
    setSession(newUser);
    localStorage.setItem('jackpot_session', JSON.stringify(newUser));
    setView('lobby');
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
        
        // Mutate account requests cache key
        mutate(emailQuery ? `/api/account-requests?email=${emailQuery}` : null);
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
        
        // Mutate transactions and notifications cache keys
        const url = emailQuery ? `/api/transactions?email=${emailQuery}&limit=100` : null;
        mutate(url);
        mutate(emailQuery ? `/api/coins-notifications?email=${emailQuery}` : null);
      } else {
        showToast(data.message || 'Transaction submission failed.', 'error');
      }
    } catch (err) {
      console.error('Submit transaction error:', err);
      showToast('Connection error submitting transaction.', 'error');
    }
  };

  const handleUpdateCoinsNotification = async (id, status, read, holdNote) => {
    try {
      const response = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, read, holdNote })
      });
      const data = await response.json();
      if (data.success) {
        // Mutate notifications cache key
        mutate(emailQuery ? `/api/coins-notifications?email=${emailQuery}` : null);
      }
    } catch (err) {
      console.error('Update coins notification error:', err);
    }
  };

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('Thank you for installing Jackpot Royals app!', 'success');
          setDeferredPrompt(null);
        }
      });
    } else {
      showToast('To Install App: Click browser settings menu (or Share button on Safari) and select "Add to Home Screen" or "Install App".', 'info');
    }
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your_google_client_id_here';

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', color: '#fff' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)' }}></i>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Initializing Jackpot Royals...</span>
      </div>
    );
  }

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
        <LoadingOverlay active={true} />
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
          coinsNotifications={coinsNotifications}
          onUpdateCoinsNotification={handleUpdateCoinsNotification}
          onInstallApp={handleInstallApp}
          currentUser={session}
          currentUserEmail={session?.email}
          onLogout={handleLogout}
          showToast={showToast}
          onOpenSupport={() => setSupportOpen(true)}
          onRequestAccount={handleRequestAccount}
          onSubmitTransaction={handleSubmitTransaction}
          frontendSettings={frontendSettings}
        />
      )}

      {/* Modals */}
      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        currentUser={session}
      />

      {!supportOpen && (
        <button
          onClick={() => setSupportOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 99,
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
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          title="Chat with Live Support"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(255,215,0,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,215,0,0.35)';
          }}
        >
          <i className="fa-solid fa-headset"></i>
        </button>
      )}

      <GoogleWarningModal isOpen={googleWarnOpen} onClose={() => setGoogleWarnOpen(false)} />

      <LoadingOverlay active={loadingActive} />
    </GoogleOAuthProvider>
  );
}

