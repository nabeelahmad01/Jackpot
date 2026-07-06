'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PaymentMethodModal } from './Modals';
import ReferralCenter from './ReferralCenter';

export default function UserLobby({
  games,
  accountRequests = [],
  gameAccounts = [],
  transactions = [],
  gateways = [],
  coinsNotifications = [],
  onUpdateCoinsNotification,
  onInstallApp,
  currentUser,
  currentUserEmail,
  onLogout,
  showToast,
  onOpenSupport,
  onRequestAccount,
  onSubmitTransaction,
}) {
  // Navigation states
  const [activeGame, setActiveGame] = useState(null); // game object or null
  const [accordionOpen, setAccordionOpen] = useState(false);

  // Financial inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTag, setWithdrawTag] = useState('');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState('Chime');
  const [nameOnTag, setNameOnTag] = useState('');
  const [phoneOnTag, setPhoneOnTag] = useState('');
  const [lobbySubView, setLobbySubView] = useState('main'); // 'main' | 'referrals'
  const [referralsList, setReferralsList] = useState([]);
  const [claimBonus, setClaimBonus] = useState(true);

  // Payment selection modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null); // { amount, gateway, noteCode, timeRemaining }

  // Screenshot Upload state
  const [screenshotBase64, setScreenshotBase64] = useState('');
  const [withdrawScreenshot, setWithdrawScreenshot] = useState('');

  // Countdown timer ref for live invoice
  const timerRef = useRef(null);

  // Seeded withdrawals for marquee loop
  const payouts = [
    { name: 'Elizabeth Audrey', amount: '$208.00', time: '1 hour ago', color: 'av-purple', init: 'EA' },
    { name: 'Jamie', amount: '$30.00', time: '1 hour ago', color: 'av-blue', init: 'JM' },
    { name: 'Angel', amount: '$90.00', time: '1 hour ago', color: 'av-green', init: 'AN' },
    { name: 'Ashley', amount: '$45.00', time: '1 hour ago', color: 'av-orange', init: 'AS' },
    { name: 'Ryan G.', amount: '$420.00', time: '2 hours ago', color: 'av-red', init: 'RG' },
    { name: 'Michael S.', amount: '$150.00', time: '2 hours ago', color: 'av-purple', init: 'MS' },
  ];
  const doubledPayouts = [...payouts, ...payouts];

  // 1. Live countdown timer effect
  useEffect(() => {
    if (activeInvoice) {
      timerRef.current = setInterval(() => {
        setActiveInvoice((prev) => {
          if (!prev) return null;
          if (prev.timeRemaining <= 1) {
            clearInterval(timerRef.current);
            showToast('Deposit session expired.', 'error');
            return null;
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeInvoice]);

  // 2. Fetch referrals list effect
  useEffect(() => {
    if (currentUserEmail) {
      fetch(`/api/users?referredBy=${encodeURIComponent(currentUserEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setReferralsList(data.referrals || []);
          }
        })
        .catch(err => console.error('Error fetching referrals list:', err));
    }
  }, [currentUserEmail, lobbySubView]);

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  // Convert uploaded image to Base64 data string
  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Payment proof screenshot must be less than 2MB.', 'error');
      e.target.value = '';
      setScreenshotBase64('');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotBase64(reader.result);
      showToast('Payment screenshot receipt loaded. Ready to confirm!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleWithdrawScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Game screenshot must be less than 2MB.', 'error');
      e.target.value = '';
      setWithdrawScreenshot('');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setWithdrawScreenshot(reader.result);
      showToast('Game screenshot loaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDepositClick = (e) => {
    e.preventDefault();
    const amountVal = parseFloat(depositAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast('Please enter a valid deposit amount.', 'error');
      return;
    }
    if (amountVal < 5) {
      showToast('Minimum deposit limit is $5.00.', 'error');
      return;
    }
    
    setPaymentModalOpen(true);
  };

  const handleSelectGateway = (gatewayObj) => {
    setPaymentModalOpen(false);
    
    // Generate Random Transaction Reference Code (e.g. JKP-837291)
    const randNum = Math.floor(100000 + Math.random() * 900000);
    const code = `JKP-${randNum}`;

    setScreenshotBase64('');

    setActiveInvoice({
      amount: parseFloat(depositAmount),
      gateway: gatewayObj, // Keep gateway reference
      noteCode: code,
      timeRemaining: 600, // 10 minutes
    });

    setDepositAmount('');
  };

  const handleCancelInvoice = () => {
    setActiveInvoice(null);
    setScreenshotBase64('');
    showToast('Deposit checkout cancelled.', 'info');
  };

  const handlePaidConfirm = () => {
    if (!activeInvoice || !activeGame) return;
    
    if (!screenshotBase64) {
      showToast('Please upload a screenshot of your payment to continue.', 'error');
      return;
    }

    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'DEPOSIT',
      amount: activeInvoice.amount,
      gateway: activeInvoice.gateway.name,
      code: activeInvoice.noteCode,
      screenshot: screenshotBase64, // Pass Base64 image
    });
    
    setActiveInvoice(null);
    setScreenshotBase64('');
  };

  const handleWithdrawInitiate = (e) => {
    e.preventDefault();
    const amountVal = parseFloat(withdrawAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast('Please enter a valid withdrawal amount.', 'error');
      return;
    }
    if (amountVal < 5) {
      showToast('Minimum withdrawal limit is $5.00.', 'error');
      return;
    }
    setWithdrawModalOpen(true);
  };

  const handleWithdrawConfirm = (e) => {
    e.preventDefault();
    const amountVal = parseFloat(withdrawAmount);
    if (withdrawTag.trim() === '') {
      showToast('Please provide your payout tag.', 'error');
      return;
    }
    if (nameOnTag.trim() === '') {
      showToast('Please provide the name on your tag.', 'error');
      return;
    }
    if (!withdrawScreenshot) {
      showToast('Please upload a screenshot of your game balance.', 'error');
      return;
    }

    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'WITHDRAW',
      amount: amountVal,
      gateway: withdrawMethod,
      code: withdrawTag.trim(),
      nameOnTag: nameOnTag.trim(),
      phoneOnTag: phoneOnTag.trim(),
      screenshot: withdrawScreenshot
    });

    setWithdrawAmount('');
    setWithdrawTag('');
    setNameOnTag('');
    setPhoneOnTag('');
    setWithdrawScreenshot('');
    setWithdrawModalOpen(false);
    showToast('Withdrawal request submitted successfully!', 'success');
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleReferEarn = () => {
    setLobbySubView('referrals');
  };

  const handleDownloadApp = () => {
    if (onInstallApp) {
      onInstallApp();
    } else {
      showToast('To Install App: Click browser settings menu and select "Add to Home Screen".', 'info');
    }
  };

  const handleFreeplayClaim = () => {
    // 1. Check if user already claimed signup freeplay bonus
    const hasClaimedFreeplay = (transactions || []).some(
      (t) => t.type === 'BONUS' && t.code === 'SIGNUP-FREE3'
    );
    if (hasClaimedFreeplay) {
      showToast("You have already claimed your $3.00 signup Freeplay bonus!", "error");
      return;
    }

    // 2. Check if a game is active
    if (!activeGame) {
      // If no active game, scroll to games section so they select a game first
      showToast("Please select a game first to request account and claim your Freeplay!", "info");
      document.getElementById('lobby-games-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 3. Check if they have a game account for this active game
    const currentAccount = gameAccounts.find(
      (acc) => acc.gameTitle.toLowerCase() === activeGame.title.toLowerCase()
    );
    if (!currentAccount) {
      showToast(`Please request/create a game account for ${activeGame.title} first to claim Freeplay!`, "error");
      return;
    }

    // 4. Submit the Freeplay request directly!
    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'BONUS',
      amount: 3.00,
      gateway: 'Signup Bonus',
      code: 'SIGNUP-FREE3',
      nameOnTag: currentUser?.name || 'Player',
      phoneOnTag: '',
      screenshot: ''
    });
    showToast(`Freeplay request of $3.00 submitted for ${activeGame.title}! Awaiting manager allotment.`, "success");
  };

  const handleRequestAccountWithBonus = () => {
    onRequestAccount(activeGame.title);
    const isFirstAccount = gameAccounts.length === 0 && !accountRequests.some(r => r.userEmail === currentUserEmail);
    const hasClaimedBonus = (transactions || []).some(t => t.type === 'BONUS' && t.userEmail === currentUserEmail && t.code === 'SIGNUP-FREE3');
    const eligibleForSignupBonus = isFirstAccount && !hasClaimedBonus;

    if (eligibleForSignupBonus && claimBonus) {
      onSubmitTransaction({
        gameTitle: activeGame.title,
        type: 'BONUS',
        amount: 3.00,
        gateway: 'Signup Bonus',
        code: 'SIGNUP-FREE3',
        nameOnTag: currentUser?.name || 'Player',
        phoneOnTag: '',
        screenshot: ''
      });
      showToast('$3.00 Free Signup Bonus request submitted! Awaiting admin confirmation.', 'success');
    }
  };

  const currentRequest = activeGame 
    ? accountRequests.find((r) => r.gameTitle === activeGame.title && r.userEmail === currentUserEmail)
    : null;

  const currentAccount = activeGame
    ? gameAccounts.find((a) => a.gameTitle === activeGame.title && a.userEmail === currentUserEmail)
    : null;

  const filteredTransactions = activeGame
    ? transactions.filter((t) => t.gameTitle === activeGame.title && t.userEmail === currentUserEmail)
    : [];

  const isFirstAccount = gameAccounts.length === 0 && !accountRequests.some(r => r.userEmail === currentUserEmail);
  const hasClaimedBonus = (transactions || []).some(t => t.type === 'BONUS' && t.userEmail === currentUserEmail && t.code === 'SIGNUP-FREE3');
  const eligibleForSignupBonus = isFirstAccount && !hasClaimedBonus;

  return (
    <div id="view-user-dashboard">
      {/* Dynamic Header */}
      <header className="dashboard-header">
        <div className="lobby-brand" onClick={() => { setActiveGame(null); setActiveInvoice(null); setLobbySubView('main'); }} style={{ cursor: 'pointer' }}>
          <div className="lobby-logo-box" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', border: '1px solid rgba(255,215,0,0.4)', borderRadius: '50%', boxShadow: '0 0 15px rgba(255,215,0,0.25)' }}>
            <img
              src="/jackpot_lion_mascot.png?v=2"
              alt="Jackpot Lion Mascot"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
                clipPath: 'circle(50%)',
                animation: 'pulse-lion 2s infinite ease-in-out',
                transform: 'scale(1.05)'
              }}
            />
          </div>
          <div className="lobby-brand-names">
            <h2 className="lobby-brand-title">
              JACKPOT<span className="gold-accent">ROYALS</span>
            </h2>
            <p className="lobby-brand-tagline">PLAY SMARTER. CASHOUT FASTER.</p>
          </div>
        </div>

        <div className="lobby-nav-actions">
          {(activeGame || lobbySubView === 'referrals') && (
            <button className="lobby-nav-btn" onClick={() => { setActiveGame(null); setActiveInvoice(null); setLobbySubView('main'); }} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <i className="fa-solid fa-chevron-left"></i> <span>Back to Lobby</span>
            </button>
          )}
          {lobbySubView !== 'referrals' && (
            <button className="lobby-nav-btn refer-btn" onClick={handleReferEarn}>
              <i className="fa-solid fa-gift"></i> <span>Refer</span>
            </button>
          )}
          <button className="lobby-nav-btn logout-btn" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ==============================================================
           VIEW A: MAIN PLAYER LOBBY
           ============================================================== */}
      {lobbySubView === 'referrals' ? (
        <div className="lobby-content-container">
          <ReferralCenter
            currentUserEmail={currentUserEmail}
            referralCode={currentUser?.referralCode || ''}
            referralsList={referralsList}
            onClose={() => setLobbySubView('main')}
            onOpenSupport={onOpenSupport}
            showToast={showToast}
          />
        </div>
      ) : !activeGame ? (
        <div className="lobby-content-container">
          {/* Active Hold/Claim Notifications */}
          {coinsNotifications && coinsNotifications.filter(n => n.status === 'HOLD' || n.status === 'CLAIM_REQUESTED').length > 0 && (
            <div className="hold-notifications-wrapper" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {coinsNotifications.filter(n => n.status === 'HOLD' || n.status === 'CLAIM_REQUESTED').map(noti => (
                <div key={noti.id} className="admin-section-card" style={{
                  padding: '1.25rem',
                  border: '1.5px solid rgba(245, 158, 11, 0.4)',
                  background: 'linear-gradient(135deg, rgba(8, 10, 17, 0.95) 0%, rgba(20, 15, 5, 0.95) 100%)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  animation: 'fade-in 0.3s ease-out'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '50%',
                      background: 'rgba(245,158,11,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(245,158,11,0.3)'
                    }}>
                      <i className="fa-solid fa-coins" style={{ fontSize: '1.25rem', color: '#f59e0b' }}></i>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                        Allotment Status: <span style={{ color: noti.status === 'HOLD' ? '#f59e0b' : '#38bdf8' }}>{noti.status === 'HOLD' ? 'ON HOLD' : 'CLAIM REQUESTED'}</span>
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: '0.25rem 0' }}>
                        Coins to credit: <strong style={{ color: 'var(--gold-primary)' }}>{noti.totalCoins} Coins</strong> for <strong>{noti.gameTitle}</strong>
                      </p>
                      {noti.holdNote && (
                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '3px solid #f59e0b', fontSize: '0.7rem', color: '#e2e8f0', marginTop: '0.5rem', fontStyle: 'italic', maxWidth: '500px' }}>
                          Manager Note: "{noti.holdNote}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {noti.status === 'HOLD' ? (
                      <button
                        onClick={async () => {
                          if (onUpdateCoinsNotification) {
                            await onUpdateCoinsNotification(noti.id, 'CLAIM_REQUESTED');
                            showToast("Coins claim request sent to manager!", "success");
                          }
                        }}
                        className="submit-btn"
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#000',
                          fontWeight: 'bold',
                          padding: '0.6rem 1.25rem',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          width: 'auto',
                          margin: 0,
                          boxShadow: '0 4px 15px rgba(245,158,11,0.2)'
                        }}
                      >
                        Claim Coins Now (Played Existing)
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(56,189,248,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Awaiting Verification...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="lobby-hero">
            <div className="hero-promo-block">
              <h2 className="hero-promo-headline">
                GET <span className="highlight-yellow">300%</span> SIGNUP BONUS ON YOUR FIRST DEPOSIT
              </h2>
              <div className="hero-trust-badges">
                <div className="trust-pill"><i className="fa-solid fa-shield-halved"></i> Instant Withdrawals</div>
                <div className="trust-pill"><i className="fa-solid fa-lock"></i> Secure & Safe</div>
                <div className="trust-pill"><i className="fa-solid fa-trophy"></i> Trusted by 1B+ Players</div>
              </div>
            </div>

            <div className="hero-badge-block">
              <div className="freeplay-card">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    border: '2px solid var(--gold-primary)',
                    background: '#000',
                    boxShadow: '0 0 15px rgba(255,215,0,0.35)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src="/jackpot_lion_mascot.png?v=2"
                      alt="Jackpot Royals Lion Mascot"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                        clipPath: 'circle(50%)',
                        animation: 'pulse-lion 2s infinite ease-in-out',
                        transform: 'scale(1.05)'
                      }}
                    />
                  </div>
                </div>
                <h3 className="freeplay-value">$3</h3>
                <h4 className="freeplay-label">FREEPLAY</h4>
                <p className="freeplay-condition">ON SIGNUP!</p>

                <div className="freeplay-bullets">
                  <div className="bullet-item">
                    <i className="fa-solid fa-circle-play text-green"></i>
                    <div className="bullet-desc"><strong>PLAY</strong><span>Explore exciting games</span></div>
                  </div>
                  <div className="bullet-item">
                    <i className="fa-solid fa-circle-check text-blue"></i>
                    <div className="bullet-desc"><strong>WIN</strong><span>Win real rewards</span></div>
                  </div>
                  <div className="bullet-item">
                    <i className="fa-solid fa-circle-dollar-to-slot text-magenta"></i>
                    <div className="bullet-desc"><strong>CASH OUT</strong><span>Fast withdrawals</span></div>
                  </div>
                </div>
                <button
                  onClick={handleFreeplayClaim}
                  className="submit-btn"
                  style={{
                    marginTop: '1.25rem',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    color: '#fff',
                    fontWeight: 'bold',
                    padding: '0.65rem 1rem',
                    fontSize: '0.75rem',
                    borderRadius: '10px',
                    width: '100%',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fa-solid fa-gift" style={{ marginRight: '6px' }}></i> CLAIM FREEPLAY NOW
                </button>
              </div>
            </div>
          </section>

          <div className="deposit-button-wrapper">
            <button type="button" className="deposit-now-btn" onClick={() => document.getElementById('lobby-games-section')?.scrollIntoView({ behavior: 'smooth' })}>
              <div className="deposit-btn-content">
                <i className="fa-solid fa-circle-chevron-down deposit-bag-icon" style={{ animation: 'bounce 2s infinite' }}></i>
                <span className="deposit-text">SELECT GAME BELOW</span>
              </div>
              <span className="deposit-subtext">Choose a casino portal to request credentials and deposit</span>
            </button>
          </div>

          <section className="lobby-features-grid">
            <div className="lobby-feature-card">
              <i className="fa-solid fa-money-bill-wave card-icon"></i>
              <div><h4>$3 Freeplay</h4><p>On Signup</p></div>
            </div>
            <div className="lobby-feature-card">
              <i className="fa-solid fa-bolt-lightning card-icon"></i>
              <div><h4>Instant Payouts</h4><p>Withdraw Anytime</p></div>
            </div>
            <div className="lobby-feature-card">
              <i className="fa-solid fa-briefcase card-icon"></i>
              <div><h4>Low Minimum</h4><p>Start From Just $5</p></div>
            </div>
            <div className="lobby-feature-card">
              <i className="fa-solid fa-headset card-icon"></i>
              <div><h4>24/7 Support</h4><p>We're Here For You</p></div>
            </div>
          </section>

          <section className="recent-withdrawals-section">
            <div className="section-title-row">
              <h3><i className="fa-solid fa-fire text-red"></i> RECENT WITHDRAWALS</h3>
            </div>
            <div className="ticker-wrapper">
              <div className="ticker-mover">
                {doubledPayouts.map((p, idx) => (
                  <div key={idx} className="ticker-item">
                    <div className={`ticker-avatar ${p.color}`}>{p.init}</div>
                    <div className="ticker-info">
                      <span className="ticker-name">{p.name}</span>
                      <span className="ticker-amount">{p.amount}</span>
                      <span className="ticker-time">{p.time}</span>
                    </div>
                    <span className="ticker-badge">PAID</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <article className="referral-banner">
            <div className="referral-flex">
              <div className="referral-left">
                <i className="fa-solid fa-handshake referral-icon"></i>
                <div>
                  <h3>SHARE JACKPOT ROYALS WITH FRIENDS</h3>
                  <p>Enjoying our platform? Invite your friends and help grow our community. Great experiences are worth sharing.</p>
                </div>
              </div>
              <button type="button" className="share-btn" onClick={() => setLobbySubView('referrals')}>
                <span>SHARE NOW &rarr;</span>
              </button>
            </div>
          </article>

          <section id="lobby-games-section" className="games-lobby-section">
            <div className="lobby-section-header">
              <h3><i className="fa-solid fa-gamepad gold-text"></i> OUR GAMES</h3>
              <span className="game-tap-tip">Tap a game to play <i className="fa-solid fa-hand-pointer"></i></span>
            </div>

            <div className="games-grid">
              {games.map((game, index) => {
                let colorClass = 'play-orange';
                const cycle = index % 5;
                if (cycle === 1) colorClass = 'play-yellow';
                else if (cycle === 2) colorClass = 'play-red';
                else if (cycle === 3) colorClass = 'play-green';
                else if (cycle === 4) colorClass = 'play-blue';

                return (
                  <div key={game.id} className="game-card">
                    {game.badge !== 'none' && <span className={`game-badge ${game.badge}`}>{game.badge.toUpperCase()}</span>}
                    <div className="game-image-wrapper" onClick={() => setActiveGame(game)} style={{ cursor: 'pointer' }}>
                      {game.image.startsWith('game_') ? (
                        <img src={game.image} alt={game.title} />
                      ) : (
                        <div className={`game-placeholder-card ${game.image === 'placeholder_2' ? 'pc-red' : game.image === 'placeholder_3' ? 'pc-blue' : 'pc-gold'}`}>
                          {game.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <button className={`game-play-btn ${colorClass}`} onClick={() => setActiveGame(game)}>
                      PLAY NOW &nbsp;<i className="fa-solid fa-circle-play"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rules-accordion-section" style={{ marginTop: '2rem' }}>
            <div className={`accordion-item ${accordionOpen ? 'active' : ''}`}>
              <div className="accordion-header" onClick={() => setAccordionOpen(!accordionOpen)}>
                <span><i className="fa-scroll fa-solid gold-text"></i> CASHOUT RULES & PLAYER INFO</span>
                <i className="fa-solid fa-chevron-down arrow-icon"></i>
              </div>
              <div className="accordion-body">
                <div className="rules-content">
                  <h5>1. Account Verification</h5>
                  <p>Before requesting your first cashout, your email must be verified. Go to customer support if you need assistance updating details.</p>
                  <h5>2. Playthrough Requirements</h5>
                  <p>Sign-up bonuses and deposit match values carry a standard 1x playthrough requirement before funds are eligible for withdrawal requests.</p>
                  <h5>3. Minimum & Maximum Cashouts</h5>
                  <p>The minimum cashout limit is $5. Daily maximum cashouts are capped at $5,000 for standard players. Support can raise limits for VIP accounts.</p>
                  <h5>4. Payout Duration</h5>
                  <p>Withdrawal requests are processed instantly or within 10-15 minutes on average via digital wallets.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* ==============================================================
             VIEW B: GAME ACCESS DRILL-DOWN PANEL
             ============================================================== */
        <div className="lobby-content-container game-access-portal-view">
          
          <div className="game-access-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', marginBottom: '1.5rem' }}>
            <div className="game-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="lobby-logo-box" style={{ width: '50px', height: '50px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', border: '1px solid rgba(255,215,0,0.4)', borderRadius: '50%', boxShadow: '0 0 15px rgba(255,215,0,0.25)' }}>
                <img
                  src="/jackpot_lion_mascot.png?v=2"
                  alt="Jackpot Lion Mascot"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    clipPath: 'circle(50%)',
                    animation: 'pulse-lion 2s infinite ease-in-out',
                    transform: 'scale(1.05)'
                  }}
                />
              </div>
              <div className="game-header-titles">
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: '900', letterSpacing: '0.05em' }}>
                  {activeGame.title} PANEL
                </h3>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  Deposits • Withdrawals • Game Access
                </span>
              </div>
            </div>

            <div className="game-header-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleFreeplayClaim} className="lobby-nav-btn app-btn" style={{ background: '#a855f7', color: '#fff', padding: '0.5rem 0.85rem' }}>
                <i className="fa-solid fa-gift"></i> <span style={{ fontSize: '0.75rem' }}>FREEPLAY</span>
              </button>
              <button onClick={handleReferEarn} className="lobby-nav-btn app-btn" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 0.85rem' }}>
                <i className="fa-solid fa-link"></i> <span style={{ fontSize: '0.75rem' }}>INVITE</span>
              </button>
              <button onClick={handleDownloadApp} className="lobby-nav-btn app-btn" style={{ background: '#eab308', color: '#111', padding: '0.5rem 0.85rem' }}>
                <i className="fa-solid fa-download"></i> <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>DOWNLOAD</span>
              </button>
            </div>
          </div>

          {/* ACTIVE INVOICE SCREEN */}
          {activeInvoice ? (
            <div className="invoice-container" style={{ animation: 'fade-in 0.3s ease-out' }}>
              <div className="recorded-toast-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', background: '#d1fae5', border: '1px solid #10b981', color: '#065f46', borderRadius: '12px', fontSize: '0.8rem', marginBottom: '1.25rem', fontWeight: '500' }}>
                <span><i className="fa-solid fa-circle-check"></i> Deposit recorded. Use the tag shown below to send your payment.</span>
                <button onClick={handleCancelInvoice} style={{ background: 'none', border: 'none', color: '#065f46', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
              </div>

              <div className="invoice-grid-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
                
                {/* Left Invoice elements */}
                <div className="invoice-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Pending Deposit
                  </span>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#fff', margin: '0.25rem 0 0.5rem 0' }}>
                    Complete Your Payment
                  </h3>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Your deposit has been recorded. Please send payment using the details below.
                  </p>

                  <span className="unpaid-badge" style={{ background: 'rgba(230, 142, 0, 0.15)', border: '1px solid #e68e00', color: '#ffe16c', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '1rem' }}>
                    UNPAID
                  </span>

                  <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '1rem' }}>
                    Deposit Amount <strong style={{ color: '#00d2ff' }}>${parseFloat(activeInvoice.amount).toFixed(2)}</strong>
                  </h4>

                  <div className="red-strip-notice" style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '10px', color: '#f87171', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>Don't forget to write the Payment Note Code in the note while sending payment.</span>
                  </div>

                  <div className="tag-details-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {/* Copy actions styled with blue copy icon - NO COPY TEXT */}
                    <div className="tag-field-row" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.15rem' }}>PAYMENT TAG ({activeInvoice.gateway.name})</span>
                        <code style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>
                          {activeInvoice.gateway.tag}
                        </code>
                      </div>
                      <button onClick={() => handleCopyText(activeInvoice.gateway.tag)} className="action-row-btn btn-edit" style={{ background: 'none', border: 'none', color: '#00d2ff', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }} title="Copy Tag">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>

                    <div className="tag-field-row" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.15rem' }}>LINKED NUMBER / NETWORK</span>
                        <code style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>
                          {activeInvoice.gateway.phone}
                        </code>
                      </div>
                      <button onClick={() => handleCopyText(activeInvoice.gateway.phone)} className="action-row-btn btn-edit" style={{ background: 'none', border: 'none', color: '#00d2ff', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }} title="Copy Phone">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>

                    <div className="tag-field-row" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ paddingRight: '0.5rem' }}>
                        <span style={{ fontSize: '0.55rem', color: '#f59e0b', textTransform: 'uppercase', display: 'block', marginBottom: '0.15rem', fontWeight: 'bold' }}>IMPORTANT: TRANSACTION REFERENCE CODE</span>
                        <code style={{ fontSize: '1.05rem', color: '#f59e0b', fontWeight: '900', letterSpacing: '1px' }}>{activeInvoice.noteCode}</code>
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.65)', display: 'block', marginTop: '0.25rem', lineHeight: '1.3' }}>
                          *You MUST write this code in the Payment Note / Message / Reference field in your payment app while transferring the money.
                        </span>
                      </div>
                      <button onClick={() => handleCopyText(activeInvoice.noteCode)} className="action-row-btn" style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }} title="Copy Code">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>

                    <div className="tag-field-row" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.15rem' }}>TIME REMAINING</span>
                      <strong style={{ fontSize: '1rem', color: '#eab308', fontFamily: 'var(--font-heading)' }}>{formatTimer(activeInvoice.timeRemaining)}</strong>
                    </div>

                    {/* Screenshot Receipt uploader */}
                    <div className="tag-field-row" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <label htmlFor="screenshot-receipt" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Upload Payment Screenshot (Required)
                      </label>
                      <input
                        type="file"
                        id="screenshot-receipt"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        style={{ border: 'none', background: 'none', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', width: '100%' }}
                        required
                      />
                      {screenshotBase64 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <i className="fa-solid fa-circle-check text-green" style={{ fontSize: '0.8rem' }}></i>
                          <span style={{ fontSize: '0.65rem', color: '#4ade80', fontWeight: 'bold' }}>Screenshot proof selected.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button onClick={handleCancelInvoice} className="submit-btn" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', flex: 1, marginTop: 0 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>CANCEL DEPOSIT</span>
                    </button>
                    <button
                      onClick={handlePaidConfirm}
                      className="submit-btn"
                      style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                        flex: 1,
                        marginTop: 0,
                        opacity: screenshotBase64 ? 1 : 0.5,
                        cursor: screenshotBase64 ? 'pointer' : 'not-allowed'
                      }}
                      disabled={!screenshotBase64}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>I HAVE PAID</span>
                    </button>
                  </div>
                </div>

                {/* Right QR card - ALWAYS loads image tag (No Fallback) */}
                <div className="invoice-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="qr-container" style={{ background: '#fff', padding: '0.5rem', borderRadius: '14px', marginBottom: '1rem', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img
                      src={activeInvoice.gateway.qrImage}
                      alt="Payment Gateway QR code tag"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Scan QR to pay faster
                  </span>
                </div>
              </div>
            </div>
          ) : (
            
            /* NORMAL ACCOUNT VIEWS */
            <>
              {/* STATE A: REQUEST LOGIN */}
              {!currentRequest && !currentAccount && (
                <div className="game-access-panel active">
                  <div className="auth-card" style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem 1.5rem', textAlign: 'center' }}>
                    <div className="glow-border-layer"></div>
                    <div className="game-alert-strip" style={{ padding: '1rem', border: '1px solid rgba(230,142,0,0.2)', background: 'rgba(230,142,0,0.05)', borderRadius: '12px', color: '#ffe16c', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                      You don't have a <strong>{activeGame.title}</strong> account yet. Request one below.
                    </div>

                    {eligibleForSignupBonus && (
                      <div style={{
                        margin: '0 auto 1.5rem auto',
                        maxWidth: '450px',
                        padding: '1rem 1.25rem',
                        background: 'rgba(168,85,247,0.06)',
                        border: '1px dashed rgba(168,85,247,0.3)',
                        borderRadius: '12px',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem'
                      }}>
                        <input
                          type="checkbox"
                          id="claim-signup-bonus"
                          checked={claimBonus}
                          onChange={(e) => setClaimBonus(e.target.checked)}
                          style={{
                            width: '20px',
                            height: '20px',
                            accentColor: '#a855f7',
                            cursor: 'pointer',
                            marginTop: '0.15rem'
                          }}
                        />
                        <label htmlFor="claim-signup-bonus" style={{ cursor: 'pointer' }}>
                          <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.15rem' }}>
                            🎁 Claim $3.00 Free Redeemable Signup Bonus!
                          </span>
                          <span style={{ display: 'block', fontSize: '0.675rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            Get $3 free playable coins on this first game portal. Bonus request will be processed in your transactions list.
                          </span>
                        </label>
                      </div>
                    )}

                    <button onClick={handleRequestAccountWithBonus} className="submit-btn" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', maxWidth: '350px', margin: '0 auto' }}>
                      <span style={{ letterSpacing: '0.1em', fontWeight: 'bold' }}>REQUEST / CREATE ACCOUNT</span>
                      <div className="btn-glow"></div>
                    </button>
                  </div>
                </div>
              )}

              {/* STATE B: REQUEST IS PENDING */}
              {currentRequest && currentRequest.status === 'PENDING' && (
                <div className="game-access-panel active">
                  <div className="auth-card" style={{ maxWidth: '650px', margin: '0 auto', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                    <div className="glow-border-layer"></div>
                    <div className="game-alert-strip" style={{ padding: '1.25rem', border: '1px solid rgba(230,142,0,0.3)', background: 'rgba(230,142,0,0.05)', borderRadius: '12px', color: '#ffd043', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <i className="fa-solid fa-hourglass-half" style={{ fontSize: '1.5rem', animation: 'spin 3s infinite linear' }}></i>
                      <span><strong>APPROVAL PENDING</strong></span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Your account creation request is pending administrator approval. Please check back shortly.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STATE C: ACCOUNT READY */}
              {currentAccount && currentAccount.status === 'READY' && (
                <div className="game-access-panel active" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Account detail */}
                  <div className="auth-card" style={{ maxWidth: '100%', padding: '1.5rem' }}>
                    <div className="glow-border-layer"></div>
                    <div className="account-details-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }}>
                        Account Details
                      </h4>
                      <span className="unpaid-badge" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#4ade80', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                        READY
                      </span>
                    </div>

                    <div className="credentials-row-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="cred-block-item" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Email</span>
                        <code style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{currentAccount.userEmail}</code>
                      </div>
                      <div className="cred-block-item" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Username</span>
                        <code style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{currentAccount.username}</code>
                      </div>
                      <div className="cred-block-item" style={{ background: '#0b0c16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Password</span>
                        <code style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>{currentAccount.password}</code>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Forms */}
                  <div className="auth-card" style={{ maxWidth: '100%', padding: '1.5rem' }}>
                    <div className="glow-border-layer"></div>
                    
                    <div className="yellow-strip-notice" style={{ padding: '0.75rem 1rem', border: '1px solid rgba(230,142,0,0.3)', background: 'rgba(230,142,0,0.05)', borderRadius: '12px', color: '#ffd043', fontSize: '0.725rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span> Important: Please deposit only if your in-game balance is less than 1. If you face any problem, contact Customer Support.</span>
                    </div>

                    <div className="wallet-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }}>
                        Wallet Actions
                      </h4>
                      <button onClick={onOpenSupport} className="lobby-nav-btn app-btn" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.75rem', fontSize: '0.65rem' }}>
                        QUICK ACCESS
                      </button>
                    </div>

                    <div className="wallet-actions-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      {/* Deposit Box */}
                      <div className="wallet-side-box" style={{ background: 'rgba(34,197,94,0.02)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '14px', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div>
                            <h4 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '700' }}>DEPOSIT</h4>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Add funds to your {activeGame.title} account.</p>
                          </div>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                            <i className="fa-solid fa-sack-dollar"></i>
                          </div>
                        </div>

                        <form onSubmit={handleDepositClick}>
                          <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <div className="input-wrapper" style={{ background: '#0b0c16' }}>
                              <input
                                type="number"
                                placeholder="Deposit amount"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                style={{ padding: '0.75rem 1rem' }}
                                required
                              />
                            </div>
                          </div>
                          <button type="submit" className="submit-btn" style={{ background: '#22c55e', marginTop: 0, padding: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>DEPOSIT</span>
                          </button>
                        </form>
                      </div>

                      {/* Withdraw Box */}
                      <div className="wallet-side-box" style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '14px', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div>
                            <h4 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '700' }}>WITHDRAW</h4>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Request payout to your preferred tag.</p>
                          </div>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                            <i className="fa-solid fa-receipt"></i>
                          </div>
                        </div>

                        <form onSubmit={handleWithdrawInitiate}>
                          <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <div className="input-wrapper" style={{ background: '#0b0c16' }}>
                              <input
                                type="number"
                                placeholder="10"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                style={{ padding: '0.75rem 1rem' }}
                                required
                              />
                            </div>
                          </div>
                          <button type="submit" className="submit-btn" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', marginTop: 0, padding: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>WITHDRAW</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Ledger */}
                  <div className="auth-card" style={{ maxWidth: '100%', padding: '1.5rem' }}>
                    <div className="glow-border-layer"></div>
                    <div className="wallet-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }}>
                        Recent Transactions
                      </h4>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Last 20 Records
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Amount in Game</th>
                            <th>Status</th>
                            <th>Note / Gateway</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center text-muted" style={{ padding: '1.5rem' }}>
                                No transactions recorded yet.
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((tx, idx) => (
                              <tr key={tx.id}>
                                <td>{idx + 1}</td>
                                <td>
                                  <span className={`admin-badge-preview ${tx.type === 'DEPOSIT' ? 'b-hot' : tx.type === 'BONUS' ? 'b-vip' : 'b-new'}`} style={{ textTransform: 'uppercase', padding: '0.2rem 0.5rem', borderRadius: '4px', background: tx.type === 'BONUS' ? '#a855f7' : undefined, color: tx.type === 'BONUS' ? '#fff' : undefined }}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td>
                                  <strong>${parseFloat(tx.amount).toFixed(2)}</strong>
                                </td>
                                <td>
                                  {tx.status === 'SUCCESS' ? `$${parseFloat(tx.amount).toFixed(2)}` : '—'}
                                </td>
                                <td>
                                  <span className={`admin-badge-preview b-${tx.status === 'PENDING_COINS' ? 'new' : (tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase())}`}>
                                    {tx.status === 'PENDING_COINS' ? 'VERIFYING COINS' : tx.status}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.725rem', opacity: 0.8 }}>
                                    {tx.note ? tx.note : `${tx.gateway} (${tx.code})`}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                  {tx.date}
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
            </>
          )}
        </div>
      )}

      {/* Choose Payment Method Modal screen */}
      <PaymentMethodModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        amount={depositAmount}
        gateways={gateways}
        onSelectMethod={handleSelectGateway}
      />

      {/* Payout Withdrawal Modal Overlay */}
      {withdrawModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 0', backdropFilter: 'blur(8px)', animation: 'fade-in 0.25s ease-out' }}>
          <div className="auth-card" style={{ maxWidth: '460px', width: '92%', padding: '2rem 1.75rem', position: 'relative', animation: 'scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <div className="glow-border-layer"></div>
            
            <button
              onClick={() => setWithdrawModalOpen(false)}
              className="close-modal"
              style={{ position: 'absolute', top: '1rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', zIndex: 10 }}
            >
              &times;
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '0.25rem' }}>
                Withdraw Amount
              </span>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ff4d6d', fontFamily: 'var(--font-heading)', margin: 0 }}>
                ${parseFloat(withdrawAmount).toFixed(2)}
              </h2>
            </div>

            <form onSubmit={handleWithdrawConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>
              
              <div className="input-group">
                <label style={{ marginBottom: '0.5rem', display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose Payment Method</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Chime Option */}
                  <label
                    onClick={() => setWithdrawMethod('Chime')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: withdrawMethod === 'Chime' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.01)',
                      border: withdrawMethod === 'Chime' ? '1.5px solid var(--gold-primary)' : '1.5px solid rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: '#fff' }}>Chime</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Withdraw to your Chime tag</span>
                    </div>
                    <input
                      type="radio"
                      name="withdrawMethod"
                      checked={withdrawMethod === 'Chime'}
                      onChange={() => setWithdrawMethod('Chime')}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                    />
                  </label>

                  {/* Cash App Option */}
                  <label
                    onClick={() => setWithdrawMethod('Cash App')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: withdrawMethod === 'Cash App' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.01)',
                      border: withdrawMethod === 'Cash App' ? '1.5px solid var(--gold-primary)' : '1.5px solid rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: '#fff' }}>Cash App</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Withdraw to your Cash App tag</span>
                    </div>
                    <input
                      type="radio"
                      name="withdrawMethod"
                      checked={withdrawMethod === 'Cash App'}
                      onChange={() => setWithdrawMethod('Cash App')}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                    />
                  </label>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="tag-name">Name on Tag</label>
                <div className="input-wrapper" style={{ background: '#0b0c16' }}>
                  <i className="fa-solid fa-user input-icon"></i>
                  <input
                    type="text"
                    id="tag-name"
                    placeholder="e.g. John Doe"
                    value={nameOnTag}
                    onChange={(e) => setNameOnTag(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="tag-code">Tag</label>
                <div className="input-wrapper" style={{ background: '#0b0c16' }}>
                  <i className="fa-solid fa-at input-icon"></i>
                  <input
                    type="text"
                    id="tag-code"
                    placeholder="e.g. $john777 or @john"
                    value={withdrawTag}
                    onChange={(e) => setWithdrawTag(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="tag-phone">Linked number on Tag</label>
                <div className="input-wrapper" style={{ background: '#0b0c16' }}>
                  <i className="fa-solid fa-phone input-icon"></i>
                  <input
                    type="tel"
                    id="tag-phone"
                    placeholder="e.g. +1 555 123 4567"
                    value={phoneOnTag}
                    onChange={(e) => setPhoneOnTag(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                    required
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '0.5rem' }}>
                <label htmlFor="withdraw-screenshot-receipt" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Upload Game Screenshot (Required)
                </label>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '0.1rem 0 0.5rem' }}>
                  Please upload a full screen screenshot of your game balance showing your wins.
                </p>
                <div className="input-wrapper" style={{ background: '#0b0c16', position: 'relative' }}>
                  <i className="fa-solid fa-image input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                  <input
                    type="file"
                    id="withdraw-screenshot-receipt"
                    accept="image/*"
                    onChange={handleWithdrawScreenshotChange}
                    style={{ opacity: 0, position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 5 }}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', paddingLeft: '2.5rem', color: withdrawScreenshot ? '#4ade80' : 'rgba(255,255,255,0.4)', lineHeight: '40px', pointerEvents: 'none' }}>
                    {withdrawScreenshot ? 'Game screenshot selected ✓' : 'Choose screenshot image...'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                style={{
                  background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
                  color: '#fff',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  marginTop: '0.75rem',
                  padding: '0.85rem'
                }}
              >
                CONFIRM WITHDRAW
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating support */}
      <div className="support-chat-widget" onClick={onOpenSupport}>
        <div className="chat-widget-bubble">
          <div className="chat-widget-tooltip">
            <span>Need help with deposit?</span>
            <div className="tooltip-arrow"></div>
          </div>
          <div className="chat-widget-inner">
            <i className="fa-solid fa-comment-dots"></i>
            <span>SUPPORT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
