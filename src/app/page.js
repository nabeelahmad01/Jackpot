'use client';

import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ParticlesBackground from '../components/ParticlesBackground';
import AuthPortal from '../components/AuthPortal';
import UserLobby from '../components/UserLobby';
import LoadingOverlay from '../components/LoadingOverlay';
import { SupportModal, GoogleWarningModal } from '../components/Modals';

export default function Home() {
  const [view, setView] = useState('auth'); // 'auth' | 'lobby'
  const [session, setSession] = useState(null);
  
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

  // Load database lists
  const loadDatabase = () => {
    setUsers(JSON.parse(localStorage.getItem('jackpot_users') || '[]'));
    setGames(JSON.parse(localStorage.getItem('jackpot_games') || '[]'));
    setAccountRequests(JSON.parse(localStorage.getItem('jackpot_account_requests') || '[]'));
    setGameAccounts(JSON.parse(localStorage.getItem('jackpot_game_accounts') || '[]'));
    setTransactions(JSON.parse(localStorage.getItem('jackpot_transactions') || '[]'));
    setGateways(JSON.parse(localStorage.getItem('jackpot_payment_gateways') || '[]'));
  };

  // Initialize and synchronize LocalStorage Database
  useEffect(() => {
    const DEFAULT_GAMES = [
      { id: '1', title: 'JUWA', badge: 'hot', image: 'game_juwa.png', link: 'https://play.juwa.org/' },
      { id: '2', title: 'GAMEVAULT', badge: 'hot', image: 'game_gamevault.png', link: 'https://play.gamevault.com/' },
      { id: '3', title: 'VEGAS SWEEPS', badge: 'hot', image: 'game_vegassweeps.png', link: 'https://play.vegassweeps.com/' },
      { id: '4', title: 'ULTRAPANDA', badge: 'none', image: 'placeholder_1', link: 'https://play.ultrapanda.com/' },
      { id: '5', title: 'BLUE DRAGON', badge: 'none', image: 'placeholder_2', link: 'https://play.bluedragon.com/' },
      { id: '6', title: 'FIREKIRIN', badge: 'none', image: 'placeholder_3', link: 'https://play.firekirin.com/' },
    ];

    const DEFAULT_USERS = [
      { email: 'admin@jackpot.com', password: 'admin123', name: 'System Admin', role: 'admin' },
      { email: 'player@test.com', password: 'password123', name: 'Demo Player', role: 'user' },
    ];

    const DEFAULT_GATEWAYS = [
      {
        id: '1',
        name: 'Chime',
        subtitle: 'Fast bank transfer',
        tag: '$Autumn-King-34',
        phone: '3239902704',
        theme: 'chime',
        qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ChimeTag-Autumn-King-34'
      },
      {
        id: '2',
        name: 'Cash App',
        subtitle: 'Pay using your Cash App',
        tag: '$Autumn-King-34',
        phone: '3239902704',
        theme: 'cashapp',
        qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CashApp-Autumn-King-34'
      },
      {
        id: '3',
        name: 'Crypto',
        subtitle: 'Pay using USDT / crypto wallet',
        tag: '0x71C568971B9c7e73238971a153b8971a153b8971',
        phone: 'USDT (TRC20)',
        theme: 'crypto',
        qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=USDT-0x71C568971B9c7e73238971a153b8971a153b8971'
      }
    ];

    if (!localStorage.getItem('jackpot_users')) {
      localStorage.setItem('jackpot_users', JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem('jackpot_games')) {
      localStorage.setItem('jackpot_games', JSON.stringify(DEFAULT_GAMES));
    }
    if (!localStorage.getItem('jackpot_session')) {
      localStorage.setItem('jackpot_session', 'null');
    }
    if (!localStorage.getItem('jackpot_account_requests')) {
      localStorage.setItem('jackpot_account_requests', '[]');
    }
    if (!localStorage.getItem('jackpot_game_accounts')) {
      localStorage.setItem('jackpot_game_accounts', '[]');
    }
    if (!localStorage.getItem('jackpot_transactions')) {
      localStorage.setItem('jackpot_transactions', '[]');
    }
    if (!localStorage.getItem('jackpot_payment_gateways')) {
      localStorage.setItem('jackpot_payment_gateways', JSON.stringify(DEFAULT_GATEWAYS));
    }

    loadDatabase();

    const savedSession = JSON.parse(localStorage.getItem('jackpot_session'));
    if (savedSession) {
      if (savedSession.role === 'admin') {
        // Redirect to admin portal
        window.location.href = '/admin';
      } else {
        setSession(savedSession);
        setView('lobby');
      }
    }

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('PWA Service Worker registered.'))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }
  }, []);

  // Multi-tab Real-Time Synchronization Listener (Zero Refresh!)
  useEffect(() => {
    const handleStorageChange = (e) => {
      loadDatabase();
      
      // Auto logout player if session cleared elsewhere
      const currentSess = localStorage.getItem('jackpot_session');
      if (currentSess === 'null' || !currentSess) {
        setSession(null);
        setView('auth');
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
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('jackpot_users', JSON.stringify(updatedUsers));

    setSession(newUser);
    localStorage.setItem('jackpot_session', JSON.stringify(newUser));
    setView('lobby');
    showToast('Welcome to Jackpot Entry! Registration verified successfully.', 'success');
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
  const handleRequestAccount = (gameTitle) => {
    const newRequest = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      gameTitle,
      userEmail: session.email,
      status: 'PENDING',
      date: new Date().toLocaleString()
    };
    const updatedRequests = [...accountRequests, newRequest];
    setAccountRequests(updatedRequests);
    localStorage.setItem('jackpot_account_requests', JSON.stringify(updatedRequests));
    showToast(`Account creation request submitted for ${gameTitle}!`, 'success');
  };

  // Player Transactions Requests (Sends receipt image uploader)
  const handleSubmitTransaction = (newTx) => {
    const txObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      userEmail: session.email,
      date: new Date().toLocaleString(),
      status: 'PENDING',
      note: '',
      ...newTx
    };
    const updatedTx = [txObject, ...transactions];
    setTransactions(updatedTx);
    localStorage.setItem('jackpot_transactions', JSON.stringify(updatedTx));
    
    if (newTx.type === 'DEPOSIT') {
      showToast(`Deposit request of $${parseFloat(newTx.amount).toFixed(2)} submitted with payment proof.`, 'success');
    } else {
      showToast(`Withdrawal request of $${parseFloat(newTx.amount).toFixed(2)} submitted.`, 'success');
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
      {view === 'auth' ? (
        <AuthPortal
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
          onGoogleWarning={() => setGoogleWarnOpen(true)}
          triggerLoading={triggerLoading}
          showToast={showToast}
        />
      ) : (
        <UserLobby
          games={games}
          accountRequests={accountRequests}
          gameAccounts={gameAccounts}
          transactions={transactions}
          gateways={gateways}
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
        onTicketSubmit={() => showToast('Support Ticket Created! We will email you within 15 minutes.', 'success')}
      />

      <GoogleWarningModal isOpen={googleWarnOpen} onClose={() => setGoogleWarnOpen(false)} />

      <LoadingOverlay active={loadingActive} />
    </GoogleOAuthProvider>
  );
}
