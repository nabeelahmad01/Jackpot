'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentMethodModal } from './Modals';
import AppInstallModal from './AppInstallModal';
import { subscribeToPromoPush } from '../lib/pushClient';
import { shouldShowInfoOnLobby } from '../lib/infoPage';
import ReferralCenter from './ReferralCenter';
import RemainderClaimAction from './RemainderClaimAction';
import { canShowClaimRemainderButton } from '../lib/remainderClaim';

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
  frontendSettings = {},
  onUpdateUser
}) {
  // Navigation states
  const [activeGame, setActiveGame] = useState(null); // game object or null
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [txPage, setTxPage] = useState(1);

  // Financial inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTag, setWithdrawTag] = useState('');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState('Chime');
  const [nameOnTag, setNameOnTag] = useState('');
  const [phoneOnTag, setPhoneOnTag] = useState('');
  const [withdrawEmail, setWithdrawEmail] = useState('');
  const [selectedWithdrawGateway, setSelectedWithdrawGateway] = useState(null);
  const [lobbySubView, setLobbySubView] = useState('main'); // 'main' | 'referrals'
  const [referralsList, setReferralsList] = useState([]);
  const [pendingReferrals, setPendingReferrals] = useState([]);
  const [selectedReferralToClaim, setSelectedReferralToClaim] = useState(null);
  const [selectedGameForReferral, setSelectedGameForReferral] = useState('');
  const [claimingReferralId, setClaimingReferralId] = useState(null);
  const [claimedRemainderIds, setClaimedRemainderIds] = useState([]);
  const [isFreeplaySession, setIsFreeplaySession] = useState(false);
  const [appInstallOpen, setAppInstallOpen] = useState(false);
  const pendingGameSlugRef = useRef(null);
  const pushAutoTriedRef = useRef('');

  const toGameSlug = (title) => String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const matchGameBySlug = (slug, gameList = games) => {
    if (!slug) return null;
    return gameList.find((g) => toGameSlug(g.title) === slug) || null;
  };

  const applyPathToState = (path, gameList = games) => {
    if (path === '/lobby/referrals') {
      setLobbySubView('referrals');
      setActiveGame(null);
      pendingGameSlugRef.current = null;
      return;
    }

    if (path.startsWith('/lobby/game/')) {
      const slug = path.replace('/lobby/game/', '').replace(/\/$/, '');
      if (gameList.length === 0) {
        pendingGameSlugRef.current = slug;
        return;
      }
      const matched = matchGameBySlug(slug, gameList);
      if (matched) {
        setActiveGame(matched);
        setLobbySubView('main');
        pendingGameSlugRef.current = null;
      } else {
        setActiveGame(null);
        setLobbySubView('main');
        pendingGameSlugRef.current = null;
        window.history.replaceState({}, '', '/lobby');
      }
      return;
    }

    setLobbySubView('main');
    setActiveGame(null);
    pendingGameSlugRef.current = null;
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let targetPath = '/lobby';
    if (lobbySubView === 'referrals') {
      targetPath = '/lobby/referrals';
    } else if (activeGame) {
      const slug = toGameSlug(activeGame.title);
      targetPath = `/lobby/game/${slug}`;
    }
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [lobbySubView, activeGame]);

  // Sync browser back/forward buttons (popstate) to local state
  useEffect(() => {
    const handlePopState = () => {
      applyPathToState(window.location.pathname, games);
    };
    window.addEventListener('popstate', handlePopState);
    applyPathToState(window.location.pathname, games);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [games]);

  // Restore game from URL after games list finishes loading (fixes refresh 404/redirect race)
  useEffect(() => {
    if (games.length === 0) return;
    if (pendingGameSlugRef.current) {
      applyPathToState(`/lobby/game/${pendingGameSlugRef.current}`, games);
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/lobby/game/')) {
      applyPathToState(window.location.pathname, games);
    }
  }, [games]);

  // Active freeplay session: last action was a successful freeplay claim, with no deposit or freeplay cashout after it
  useEffect(() => {
    const isAfter = (tx, ref) => {
      if (tx.id && ref.id) return parseFloat(tx.id) > parseFloat(ref.id);
      return new Date(tx.createdAt || tx.date || 0) > new Date(ref.createdAt || ref.date || 0);
    };

    const sorted = [...(transactions || [])].sort((a, b) => {
      if (a.id && b.id) return parseFloat(b.id) - parseFloat(a.id);
      return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
    });

    const lastFreeplay = sorted.find(
      (t) => t.type === 'BONUS' && (t.code === 'SIGNUP-FREE3' || t.code === 'FREEPLAY') && t.status === 'SUCCESS'
    );

    if (!lastFreeplay) {
      setIsFreeplaySession(false);
      return;
    }

    const hasDepositAfterFreeplay = sorted.some(
      (t) => t.type === 'DEPOSIT' && t.status === 'SUCCESS' && isAfter(t, lastFreeplay)
    );

    const hasFreeplayWithdrawAfter = sorted.some(
      (t) => t.type === 'WITHDRAW' && t.isFreeplayWithdraw && isAfter(t, lastFreeplay)
    );

    setIsFreeplaySession(!hasDepositAfterFreeplay && !hasFreeplayWithdrawAfter);
  }, [transactions]);

  // Signup freeplay (one game) OR deposit $25+ freeplay. Hide claim once a request
  // is already pending/processing until the next eligibility window.
  const freeplayGate = React.useMemo(() => {
    const sorted = [...(transactions || [])].sort((a, b) => {
      if (a.id && b.id) return parseFloat(b.id) - parseFloat(a.id);
      return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
    });

    const isFreeplayTx = (t) =>
      t.type === 'BONUS' && (t.code === 'SIGNUP-FREE3' || t.code === 'FREEPLAY');

    const pending = sorted.filter(
      (t) => isFreeplayTx(t) && ['COINS_LOADING', 'PENDING', 'PENDING_COINS'].includes(t.status)
    );
    const success = sorted.filter((t) => isFreeplayTx(t) && t.status === 'SUCCESS');

    if (pending.length > 0) {
      return {
        canClaim: false,
        phase: 'pending',
        isFirst: success.length === 0,
        message: 'Your freeplay request is already submitted. Please wait for approval.'
      };
    }

    if (success.length === 0) {
      return {
        canClaim: true,
        phase: 'signup',
        isFirst: true,
        message: 'Select one game and claim your signup freeplay.'
      };
    }

    const mostRecent = success[0];
    const isAfterTx = (t, anchor) => {
      if (t.id && anchor.id) return parseFloat(t.id) > parseFloat(anchor.id);
      return new Date(t.date || t.createdAt || 0).getTime() > new Date(anchor.date || anchor.createdAt || 0).getTime();
    };

    // Any cashout after freeplay resets the $25 deposit counter to 0
    const lastCashoutAfterFreeplay = sorted.find(
      (t) =>
        t.type === 'WITHDRAW' &&
        t.status !== 'FAILED' &&
        isAfterTx(t, mostRecent)
    );
    const depositAnchor = lastCashoutAfterFreeplay || mostRecent;

    const depositTotalAfter = sorted.reduce((sum, t) => {
      if (t.type === 'DEPOSIT' && t.status === 'SUCCESS' && isAfterTx(t, depositAnchor)) {
        return sum + parseFloat(t.amount || 0);
      }
      return sum;
    }, 0);

    if (depositTotalAfter >= 25) {
      return {
        canClaim: true,
        phase: 'deposit',
        isFirst: false,
        message: 'You qualify for another freeplay after depositing $25+.'
      };
    }

    const remaining = Math.max(0, 25 - depositTotalAfter);
    return {
      canClaim: false,
      phase: 'need_deposit',
      isFirst: false,
      depositTotal: depositTotalAfter,
      remaining,
      message: lastCashoutAfterFreeplay
        ? `You will be eligible for freeplay after depositing $${remaining.toFixed(2)} more since your last cashout ($${depositTotalAfter.toFixed(2)} / $25.00).`
        : `You will be eligible for freeplay after depositing $${remaining.toFixed(2)} more ($${depositTotalAfter.toFixed(2)} / $25.00).`
    };
  }, [transactions]);

  const fetchPendingReferrals = () => {
    if (!currentUserEmail) return;
    fetch(`/api/referrals/pending?email=${encodeURIComponent(currentUserEmail)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPendingReferrals(data.pending || []);
        }
      })
      .catch(err => console.error('Failed to load pending referrals:', err));
  };

  const handleClaimReferral = async (referralId) => {
    if (!selectedGameForReferral) {
      showToast('Please select a game first!', 'error');
      return;
    }
    setClaimingReferralId(referralId);
    try {
      const res = await fetch('/api/referrals/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: referralId, gameTitle: selectedGameForReferral })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setSelectedReferralToClaim(null);
        setSelectedGameForReferral('');
        fetchPendingReferrals();
      } else {
        showToast(data.message || 'Failed to claim referral reward.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error claiming referral.', 'error');
    } finally {
      setClaimingReferralId(null);
    }
  };

  const [claimBonus, setClaimBonus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTooltipId, setActiveTooltipId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Subscription Alert Prompt states
  const [showSubPrompt, setShowSubPrompt] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (currentUser && (!currentUser.isSubscribed)) {
      const dismissed = sessionStorage.getItem('jackpot_sub_dismissed');
      if (!dismissed) {
        setShowSubPrompt(true);
      }
    }
  }, [currentUser]);

  const proofScreenshots = frontendSettings?.proofScreenshots || [];

  // Build a seamless infinite marquee: repeat the proofs enough to always fill
  // the viewport (so there's never empty space), then duplicate that whole set
  // once so the CSS animation can loop from 0 to -50% without any visible gap.
  const proofMarqueeSet = useMemo(() => {
    if (proofScreenshots.length === 0) return [];
    const multiplier = Math.max(1, Math.ceil(8 / proofScreenshots.length));
    const set = [];
    for (let i = 0; i < multiplier; i += 1) set.push(...proofScreenshots);
    return set;
  }, [proofScreenshots]);

  const proofMarqueeSlides = useMemo(
    () => [...proofMarqueeSet, ...proofMarqueeSet],
    [proofMarqueeSet]
  );

  useEffect(() => {
    if (withdrawModalOpen) {
      const activeGts = (gateways || []).filter(g => g.isWithdrawActive);
      if (activeGts.length > 0) {
        setSelectedWithdrawGateway(activeGts[0]);
        setWithdrawMethod(activeGts[0].name);
      } else {
        setSelectedWithdrawGateway(null);
        setWithdrawMethod('Chime');
      }
    }
  }, [withdrawModalOpen, gateways]);

  // Targeted Promotions states
  const [activePromos, setActivePromos] = useState([]);
  const [currentPromoToShow, setCurrentPromoToShow] = useState(null);
  // A freeplay offer the player started claiming but still needs to pick a game
  // (and have an account) for. Kept here so they don't lose the offer.
  const [pendingPromoFreeplay, setPendingPromoFreeplay] = useState(null);

  useEffect(() => {
    if (!currentUserEmail) return;

    fetch(`/api/promotions?email=${encodeURIComponent(currentUserEmail)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.promotions && data.promotions.length > 0) {
          const dismissedRaw = localStorage.getItem('dismissed_promotions');
          const dismissedIds = dismissedRaw ? JSON.parse(dismissedRaw) : [];
          const unseen = data.promotions.filter(p => !dismissedIds.includes(p.id));
          
          setActivePromos(unseen);
          if (unseen.length > 0) {
            setCurrentPromoToShow(unseen[0]);
          }
        }
      })
      .catch(err => console.error('Failed to load promotions:', err));
  }, [currentUserEmail]);

  // Auto-register promo push for logged-in users (APK / Chrome / iOS Home Screen app).
  useEffect(() => {
    if (!currentUserEmail) return;

    let cancelled = false;
    let registered = false;

    const register = async () => {
      if (cancelled || registered) return;
      try {
        await subscribeToPromoPush(currentUserEmail);
        registered = true;
        pushAutoTriedRef.current = currentUserEmail;
      } catch {
        // Permission may need a gesture, or iOS may still be in a browser tab
        // (push only works after Add to Home Screen).
      }
    };

    if (pushAutoTriedRef.current !== currentUserEmail) {
      register();
    }

    const onInteract = () => {
      register();
    };
    // When user opens the iOS Home Screen app, retry push once it is standalone.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') register();
    };
    window.addEventListener('pointerdown', onInteract, { once: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onInteract);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUserEmail]);

  const renderFailedStatusWithTooltip = (tx) => {
    const isTooltipActive = activeTooltipId === tx.id;
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <span
          className="admin-badge-preview b-failed"
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltipId(activeTooltipId === tx.id ? null : tx.id);
          }}
          onMouseEnter={() => setActiveTooltipId(tx.id)}
          onMouseLeave={() => setActiveTooltipId(null)}
        >
          FAILED <i className="fa-solid fa-circle-info" style={{ fontSize: '0.65rem' }}></i>
        </span>

        {isTooltipActive && (
          <div style={{
            position: 'absolute',
            bottom: '125%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            color: '#111',
            padding: '0.6rem 0.8rem',
            borderRadius: '10px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            zIndex: 999,
            width: '200px',
            fontSize: '0.725rem',
            lineHeight: '1.4',
            textAlign: 'left',
            animation: 'scale-up 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none'
          }}>
            <strong style={{ color: '#000', display: 'block', marginBottom: '0.2rem' }}>Rejection Reason:</strong>
            <span style={{ color: '#333', fontWeight: '500' }}>{tx.note || 'Declined by Administrator.'}</span>
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              marginLeft: '-6px',
              borderWidth: '6px',
              borderStyle: 'solid',
              borderColor: '#fff transparent transparent transparent'
            }}></div>
          </div>
        )}
      </div>
    );
  };

  // Payment selection modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null); // { amount, gateway, noteCode, timeRemaining }

  // Screenshot Upload state
  const [screenshotBase64, setScreenshotBase64] = useState('');
  const [withdrawScreenshot, setWithdrawScreenshot] = useState('');
  const [tagQrScreenshot, setTagQrScreenshot] = useState('');

  // Countdown timer ref for live invoice
  const timerRef = useRef(null);

  // Seeded withdrawals for marquee loop
  const payouts = frontendSettings.marqueePayouts || [
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
        
      fetchPendingReferrals();
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

  const handleTagQrScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Tag QR screenshot must be less than 2MB.', 'error');
      e.target.value = '';
      setTagQrScreenshot('');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTagQrScreenshot(reader.result);
      showToast('Tag QR screenshot loaded successfully!', 'success');
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

  const buildGatewayRedirectUrl = (gatewayObj, amount, noteCode) => {
    const raw = String(gatewayObj?.redirectUrl || '').trim();
    if (!raw) return '';
    const amt = parseFloat(amount || 0);
    return raw
      .replace(/\{amount\}/gi, Number.isFinite(amt) ? amt.toFixed(2) : '')
      .replace(/\{code\}/gi, String(noteCode || ''))
      .replace(/\{tag\}/gi, String(gatewayObj?.tag || ''));
  };

  const openGatewayPaymentLink = async (url) => {
    if (!url) return;
    try {
      const Browser = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Browser : null;
      if (Browser?.open) {
        await Browser.open({ url });
        return;
      }
    } catch (_) {
      // fall through to window.open
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSelectGateway = (gatewayObj) => {
    setPaymentModalOpen(false);

    // Generate Random Transaction Reference Code (e.g. Book321, Car123, Rocky432)
    const words = [
      'Book', 'Car', 'Rocky', 'Apple', 'Tiger', 'Lion', 'Sky', 'Tree', 'Star', 
      'Moon', 'Sun', 'River', 'Bird', 'Fish', 'Ring', 'King', 'Queen', 'Royal', 
      'Club', 'Jack', 'Gold', 'Card', 'Play', 'Game', 'Win', 'Luck', 'Cash',
      'Ace', 'Diamond', 'Heart', 'Spade', 'Crown', 'Ruby', 'Pearl', 'Coin'
    ];
    const randWord = words[Math.floor(Math.random() * words.length)];
    const randNum = Math.floor(100 + Math.random() * 900); // 3 digits
    const code = `${randWord}${randNum}`;

    setScreenshotBase64('');

    const amountVal = parseFloat(depositAmount);
    setActiveInvoice({
      amount: amountVal,
      gateway: gatewayObj, // Keep gateway reference
      noteCode: code,
      timeRemaining: 600, // 10 minutes
    });

    setDepositAmount('');
  };

  const isLinkPayGateway = (gatewayObj) => {
    const theme = String(gatewayObj?.theme || '').toLowerCase();
    return Boolean(String(gatewayObj?.redirectUrl || '').trim()) || theme === 'cashapp' || theme === 'stripe';
  };

  const handleOpenActiveInvoicePayLink = () => {
    if (!activeInvoice?.gateway) return;
    const payUrl = buildGatewayRedirectUrl(
      activeInvoice.gateway,
      activeInvoice.amount,
      activeInvoice.noteCode
    );
    if (!payUrl) {
      showToast('Payment link is not configured in admin. Contact support.', 'error');
      return;
    }
    openGatewayPaymentLink(payUrl);
  };

  const handleCopyInvoiceSummary = () => {
    if (!activeInvoice) return;
    const text = [
      `Gateway: ${activeInvoice.gateway?.name || ''}`,
      `Game: ${activeGame?.title || ''}`,
      `Amount: $${parseFloat(activeInvoice.amount).toFixed(2)}`,
      `Memo / Code: ${activeInvoice.noteCode}`
    ].join('\n');
    handleCopyText(text);
  };

  const handleCancelInvoice = () => {
    setActiveInvoice(null);
    setScreenshotBase64('');
    showToast('Deposit checkout cancelled.', 'info');
  };

  const handlePaidConfirm = () => {
    if (!activeInvoice || !activeGame) return;
    if (actionLoading) return;

    if (!screenshotBase64) {
      showToast('Please upload a screenshot of your payment to continue.', 'error');
      return;
    }

    setActionLoading(true);
    setTimeout(() => setActionLoading(false), 2500);

    const allottedAcc = (gameAccounts || []).find(
      (acc) => acc.gameTitle === activeGame.title
    );
    const gameUsername = allottedAcc ? allottedAcc.username : '';

    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'DEPOSIT',
      amount: activeInvoice.amount,
      gateway: activeInvoice.gateway.name,
      code: activeInvoice.noteCode,
      screenshot: screenshotBase64, // Pass Base64 image
      gameUsername: gameUsername || ''
    });

    setActiveInvoice(null);
    setScreenshotBase64('');
  };

  const handleClaimRemainder = async (tx) => {
    if (actionLoading) return;
    if (!canShowClaimRemainderButton(tx, claimedRemainderIds)) {
      showToast('Claim is not available yet. Please wait for the countdown to finish.', 'error');
      return;
    }
    if (!window.confirm(`Do you want to submit a payout request for the remaining $${parseFloat(tx.payoutHold).toFixed(2)} on Hold?`)) {
      return;
    }

    setActionLoading(true);
    try {
      setClaimedRemainderIds(prev => [...prev, tx.id]);
      onSubmitTransaction({
        isRemainderRequest: true,
        parentTxId: tx.id,
        amount: parseFloat(tx.payoutHold),
        gateway: tx.gateway,
        code: tx.code || '—',
        gameTitle: tx.gameTitle || 'Lobby',
        type: 'WITHDRAW'
      });
      // The parent onSubmitTransaction handler will hit API, trigger mutate, and show success toast!
    } catch (err) {
      console.error(err);
      showToast('Error submitting remainder request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawInitiate = (e) => {
    e.preventDefault();
    const amountVal = parseFloat(withdrawAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast('Please enter a valid withdrawal amount.', 'error');
      return;
    }
    if (amountVal < 25) {
      showToast('Minimum withdrawal limit is $25.00.', 'error');
      return;
    }
    setWithdrawModalOpen(true);
  };

  const shouldShowField = (fieldName) => {
    if (!selectedWithdrawGateway) return true;
    const gw = selectedWithdrawGateway;
    // Players must always provide payout destination
    if (fieldName === 'tag' || fieldName === 'name') return true;
    if (fieldName === 'email') return gw.requireEmailOnTag === true;
    return false;
  };

  const handleWithdrawConfirm = (e) => {
    e.preventDefault();
    if (actionLoading) return;
    const amountVal = parseFloat(withdrawAmount);
    
    if (shouldShowField('tag') && withdrawTag.trim() === '') {
      showToast('Please provide your payout tag.', 'error');
      return;
    }
    if (shouldShowField('name') && nameOnTag.trim() === '') {
      showToast('Please provide the name on your tag.', 'error');
      return;
    }
    if (phoneOnTag.trim() === '') {
      showToast('Please provide your phone number on tag.', 'error');
      return;
    }
    if (shouldShowField('email') && withdrawEmail.trim() === '') {
      showToast('Please provide the email address.', 'error');
      return;
    }
    const requireGameShot = frontendSettings?.withdrawRequireGameScreenshot === true;
    const requireTagQr = frontendSettings?.withdrawRequireTagQrScreenshot !== false;
    if (requireGameShot && !withdrawScreenshot) {
      showToast('Please upload a screenshot of your game balance.', 'error');
      return;
    }
    if (requireTagQr && !tagQrScreenshot) {
      showToast('Please upload a screenshot of your Tag QR code.', 'error');
      return;
    }

    setActionLoading(true);
    setTimeout(() => setActionLoading(false), 2500);

    const allottedAcc = (gameAccounts || []).find(
      (acc) => acc.gameTitle === activeGame.title
    );
    const gameUsername = allottedAcc ? allottedAcc.username : '';

    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'WITHDRAW',
      amount: amountVal,
      gateway: withdrawMethod,
      code: shouldShowField('tag') ? withdrawTag.trim() : '—',
      nameOnTag: shouldShowField('name') ? nameOnTag.trim() : '',
      phoneOnTag: phoneOnTag.trim(),
      emailOnTag: shouldShowField('email') ? withdrawEmail.trim() : '',
      ...(isFreeplaySession ? { isFreeplayWithdraw: true } : {}),
      screenshot: withdrawScreenshot || '',
      tagQrScreenshot: tagQrScreenshot || '',
      gameUsername: gameUsername || ''
    });

    setWithdrawAmount('');
    setWithdrawTag('');
    setNameOnTag('');
    setPhoneOnTag('');
    setWithdrawEmail('');
    setWithdrawScreenshot('');
    setTagQrScreenshot('');
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
    if (activeGame && activeGame.link) {
      window.open(activeGame.link, '_blank', 'noopener,noreferrer');
    } else if (onInstallApp) {
      onInstallApp();
    } else {
      showToast('To Install App: Click browser settings menu and select "Add to Home Screen".', 'info');
    }
  };

  const handleFreeplayClaim = () => {
    if (!freeplayGate.canClaim) {
      showToast(freeplayGate.message || 'You are not eligible for Freeplay right now.', 'info');
      return;
    }

    // 2. Check if a game is active — signup freeplay is for ONE game only
    if (!activeGame) {
      showToast(
        freeplayGate.isFirst
          ? 'Select one game first to claim your signup freeplay on that game only.'
          : 'Please select a game first to claim your Freeplay!',
        'info'
      );
      document.getElementById('lobby-games-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 3. Check if they have a game account for this active game
    const currentAccount = gameAccounts.find(
      (acc) => acc.gameTitle.toLowerCase() === activeGame.title.toLowerCase()
    );
    if (!currentAccount) {
      // Auto-submit account request if they don't have one
      const existingRequest = (accountRequests || []).find(
        (r) => r.gameTitle && r.gameTitle.toLowerCase() === activeGame.title.toLowerCase() && r.status !== 'REJECTED'
      );
      if (!existingRequest) {
        onRequestAccount(activeGame.title);
      }
      showToast(`Account request submitted for ${activeGame.title}! Once your account is created, come back to claim your Freeplay.`, "info");
      return;
    }

    if (actionLoading) return;
    setActionLoading(true);
    setTimeout(() => setActionLoading(false), 2500);

    // 4. Submit the Freeplay request (signup once / deposit re-earn)
    const isFirstFreeplay = freeplayGate.isFirst;
    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'BONUS',
      amount: 3.00,
      gateway: isFirstFreeplay ? 'Signup Bonus' : 'Freeplay',
      code: isFirstFreeplay ? 'SIGNUP-FREE3' : 'FREEPLAY',
      nameOnTag: currentUser?.name || 'Player',
      phoneOnTag: '',
      emailOnTag: currentUserEmail,
      gameUsername: currentAccount.username,
      screenshot: ''
    });
    showToast(`Freeplay request of $3.00 submitted for ${activeGame.title}! Awaiting approval.`, "success");
  };

  // Close a promo popup. `permanent` (default) also remembers it so it never
  // shows again — used once the offer is actually claimed or an announcement is
  // acknowledged. For "Later" on a claimable offer we pass permanent=false so it
  // can gently remind the player next visit until they claim it.
  const dismissPromo = (promo, permanent = true) => {
    if (!promo) return;
    if (permanent) {
      try {
        const dismissedRaw = localStorage.getItem('dismissed_promotions');
        const dismissedIds = dismissedRaw ? JSON.parse(dismissedRaw) : [];
        if (!dismissedIds.includes(promo.id)) dismissedIds.push(promo.id);
        localStorage.setItem('dismissed_promotions', JSON.stringify(dismissedIds));
      } catch {
        /* ignore storage errors */
      }
    }
    const nextPromos = activePromos.filter((p) => p.id !== promo.id);
    setActivePromos(nextPromos);
    setCurrentPromoToShow(nextPromos.length > 0 ? nextPromos[0] : null);
  };

  // Claim a "freeplay" promo. The player must pick a game (and have an account)
  // first, so if they aren't ready we KEEP the offer pending (a small banner lets
  // them finish later) instead of losing it. Once ready it is submitted as a
  // normal freeplay request — goes to the Coins queue exactly like existing
  // freeplay — and bypasses the usual $25 gate because the admin granted it.
  const handlePromoFreeplayClaim = (promo) => {
    const amount = Math.max(0, parseFloat(promo?.freeplayAmount) || 0);
    if (amount <= 0) {
      setPendingPromoFreeplay(null);
      dismissPromo(promo, true);
      return;
    }

    // Step 1 — need a game selected. Stash the offer, close the popup (so the
    // lobby/games are usable), scroll to games, and let them tap the banner.
    if (!activeGame) {
      setPendingPromoFreeplay(promo);
      dismissPromo(promo, false);
      showToast(`Select a game below, then tap "Claim" to get your $${amount.toFixed(2)} freeplay.`, 'info');
      document.getElementById('lobby-games-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Step 2 — game chosen but no account yet: request one and keep the offer
    // pending so they can claim as soon as the account is created.
    const currentAccount = gameAccounts.find(
      (acc) => acc.gameTitle.toLowerCase() === activeGame.title.toLowerCase()
    );
    if (!currentAccount) {
      const existingRequest = (accountRequests || []).find(
        (r) => r.gameTitle && r.gameTitle.toLowerCase() === activeGame.title.toLowerCase() && r.status !== 'REJECTED'
      );
      if (!existingRequest) {
        onRequestAccount(activeGame.title);
      }
      setPendingPromoFreeplay(promo);
      dismissPromo(promo, false);
      showToast(`Account requested for ${activeGame.title}. Once it's ready, tap "Claim" to get your $${amount.toFixed(2)} freeplay.`, 'info');
      return;
    }

    // Step 3 — everything is ready: submit the freeplay request.
    if (actionLoading) return;
    setActionLoading(true);
    setTimeout(() => setActionLoading(false), 2500);

    onSubmitTransaction({
      gameTitle: activeGame.title,
      type: 'BONUS',
      amount: amount,
      gateway: 'Freeplay',
      code: 'FREEPLAY',
      note: `Promo freeplay claim ($${amount.toFixed(2)}) — ${promo?.title || 'Promotion'}`,
      nameOnTag: currentUser?.name || 'Player',
      phoneOnTag: '',
      emailOnTag: currentUserEmail,
      gameUsername: currentAccount.username,
      screenshot: ''
    });
    showToast(`Freeplay request of $${amount.toFixed(2)} submitted for ${activeGame.title}! Awaiting approval.`, 'success');
    setPendingPromoFreeplay(null);
    dismissPromo(promo, true);
  };

  // Claim a "deposit bonus" promo: arm the bonus on the player's account so their
  // next approved deposit uses this % (and any bundled freeplay is auto-granted).
  const handlePromoBonusClaim = async (promo) => {
    if (!promo) return;
    try {
      const res = await fetch('/api/promotions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail, promoId: promo.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Bonus armed! Make a deposit to receive it.', 'success');
        dismissPromo(promo, true);
      } else {
        showToast(data.message || 'Could not claim this offer.', 'error');
      }
    } catch (err) {
      console.error('Promo bonus claim error:', err);
      showToast('Error claiming offer. Please try again.', 'error');
    }
  };

  const handleRequestAccountWithBonus = () => {
    if (actionLoading) return;
    setActionLoading(true);
    setTimeout(() => setActionLoading(false), 2500);

    onRequestAccount(activeGame.title);
  };

  const normEmail = (v) => String(v || '').toLowerCase().trim();
  const normTitle = (v) => String(v || '').toLowerCase().trim();

  const currentRequest = activeGame
    ? accountRequests.find(
        (r) =>
          normTitle(r.gameTitle) === normTitle(activeGame.title) &&
          normEmail(r.userEmail) === normEmail(currentUserEmail) &&
          r.status !== 'REJECTED'
      )
    : null;

  const currentAccount = activeGame
    ? gameAccounts.find(
        (a) =>
          normTitle(a.gameTitle) === normTitle(activeGame.title) &&
          normEmail(a.userEmail) === normEmail(currentUserEmail)
      )
    : null;

  useEffect(() => {
    setTxPage(1);
  }, [activeGame]);

  const filteredTransactions = activeGame
    ? transactions.filter((t) => t.gameTitle === activeGame.title && t.userEmail === currentUserEmail)
    : [];

  const txLimit = 10;
  const totalTx = filteredTransactions.length;
  const totalTxPages = Math.ceil(totalTx / txLimit);
  const paginatedTransactions = filteredTransactions.slice((txPage - 1) * txLimit, txPage * txLimit);

  const isFirstAccount = gameAccounts.length === 0 && !accountRequests.some(
    (r) => normEmail(r.userEmail) === normEmail(currentUserEmail)
  );
  const hasClaimedBonus = (transactions || []).some(
    (t) =>
      t.type === 'BONUS' &&
      normEmail(t.userEmail) === normEmail(currentUserEmail) &&
      (t.code === 'SIGNUP-FREE3' || t.code === 'FREEPLAY')
  );
  const eligibleForSignupBonus = isFirstAccount && !hasClaimedBonus;

  return (
    <div id="view-user-dashboard">
      {/* Dynamic Header */}
      <header className="dashboard-header">
        <div className="lobby-brand" onClick={() => { setActiveGame(null); setActiveInvoice(null); setLobbySubView('main'); }} style={{ cursor: 'pointer' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--gold-primary)',
            background: '#000'
          }}>
            <img
              src={frontendSettings?.logoUrl || "/jackpot_lion_mascot.png?v=2"}
              alt="Logo"
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
          {frontendSettings?.getAppEnabled && (
            <button
              type="button"
              className="lobby-nav-btn get-app-btn"
              onClick={() => setAppInstallOpen(true)}
              aria-label="Download Jackpot Royals app"
            >
              <span className="get-app-tip" aria-hidden="true">
                <span>Get the App</span>
                <span className="get-app-tip-arrow" />
              </span>
              <i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
              <span className="get-app-label">Get App</span>
            </button>
          )}
          {lobbySubView !== 'referrals' && (
            <button className="lobby-nav-btn refer-btn" onClick={handleReferEarn}>
              <i className="fa-solid fa-gift"></i> <span>Refer</span>
            </button>
          )}
          {shouldShowInfoOnLobby(frontendSettings) && (
            <Link href="/info" className="lobby-nav-btn info-nav-btn" aria-label="Official channels and contact">
              <i className="fa-solid fa-circle-info"></i> <span>Info</span>
            </Link>
          )}
          <button className="lobby-nav-btn logout-btn" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ==============================================================
           VIEW A: MAIN PLAYER LOBBY
           ============================================================== */}
      <AnimatePresence mode="wait">
        {lobbySubView === 'referrals' ? (
          <motion.div
            key="referrals"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="lobby-content-container"
          >
          <ReferralCenter
            currentUserEmail={currentUserEmail}
            referralCode={currentUser?.referralCode || ''}
            referralsList={referralsList}
            onClose={() => setLobbySubView('main')}
            onOpenSupport={onOpenSupport}
            showToast={showToast}
          />
        </motion.div>
      ) : !activeGame ? (
        <motion.div
          key="main-lobby"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="lobby-content-container"
        >
          {/* Pending Referral Claims Alert Card */}
          {pendingReferrals && pendingReferrals.length > 0 && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingReferrals.map(ref => {
                const isSelected = selectedReferralToClaim === ref.id;
                return (
                  <div key={ref.id} className="admin-section-card" style={{
                    padding: '1.25rem',
                    border: '1.5px solid rgba(168, 85, 247, 0.4)',
                    background: 'linear-gradient(135deg, rgba(8, 10, 17, 0.95) 0%, rgba(20, 5, 25, 0.95) 100%)',
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
                        background: 'rgba(168,85,247,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(168,85,247,0.3)'
                      }}>
                        <i className="fa-solid fa-gift" style={{ fontSize: '1.25rem', color: '#c084fc' }}></i>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', margin: 0 }}>
                          🎁 Referral Reward Unlocked!
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: '0.25rem 0' }}>
                          You have an unclaimed reward of <strong style={{ color: 'var(--gold-primary)' }}>{ref.rewardCoins} Coins</strong> from inviting <strong>{ref.refereeEmail}</strong>!
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {!isSelected ? (
                        <button
                          onClick={() => {
                            setSelectedReferralToClaim(ref.id);
                            setSelectedGameForReferral('');
                          }}
                          className="submit-btn"
                          style={{
                            background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                            color: '#fff',
                            fontWeight: 'bold',
                            padding: '0.6rem 1.25rem',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            width: 'auto',
                            margin: 0,
                            boxShadow: '0 4px 15px rgba(168,85,247,0.3)'
                          }}
                        >
                          Claim Reward
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <select 
                            value={selectedGameForReferral} 
                            onChange={(e) => setSelectedGameForReferral(e.target.value)}
                            style={{
                              background: '#070912',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#fff',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              outline: 'none'
                            }}
                          >
                            <option value="">-- Choose a Game --</option>
                            {games.map(g => (
                              <option key={g.id} value={g.title} style={{ background: '#070912', color: '#fff' }}>{g.title}</option>
                            ))}
                          </select>

                          <button
                            disabled={claimingReferralId === ref.id}
                            onClick={() => handleClaimReferral(ref.id)}
                            className="submit-btn"
                            style={{
                              background: 'var(--gold-primary)',
                              color: '#000',
                              fontWeight: 'bold',
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              width: 'auto',
                              margin: 0
                            }}
                          >
                            {claimingReferralId === ref.id ? 'Claiming...' : 'Confirm'}
                          </button>

                          <button
                            onClick={() => setSelectedReferralToClaim(null)}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: 'none',
                              color: '#fff',
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                        {noti.totalCoins < 0 ? 'Withdrawal Status: ' : 'Allotment Status: '}<span style={{ color: noti.status === 'HOLD' ? '#f59e0b' : '#38bdf8' }}>{noti.status === 'HOLD' ? 'ON HOLD' : 'CLAIM REQUESTED'}</span>
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: '0.25rem 0' }}>
                        {noti.totalCoins < 0 ? 'Coins to deduct: ' : 'Coins to credit: '}<strong style={{ color: noti.totalCoins < 0 ? '#ff4d6d' : 'var(--gold-primary)' }}>{Math.abs(noti.totalCoins)} Coins</strong> for <strong>{noti.gameTitle}</strong>
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
              <h2 className="hero-promo-headline" style={{ textTransform: 'uppercase', visibility: frontendSettings?.lobbyHeroPromo ? 'visible' : 'hidden' }}>
                {frontendSettings?.lobbyHeroPromo || "GET SIGNUP BONUS ON YOUR FIRST DEPOSIT"}
              </h2>
              <div className="hero-trust-badges">
                <div className="trust-pill"><i className="fa-solid fa-shield-halved"></i> {frontendSettings?.lobbyTrustBadge1 || "Instant Withdrawals"}</div>
                <div className="trust-pill"><i className="fa-solid fa-lock"></i> {frontendSettings?.lobbyTrustBadge2 || "Secure & Safe"}</div>
                <div className="trust-pill"><i className="fa-solid fa-trophy"></i> {frontendSettings?.lobbyTrustBadge3 || "Trusted by 1B+ Players"}</div>
              </div>
            </div>

            <div className="hero-badge-block">
              <div className={`freeplay-card ${(frontendSettings?.lobbyHeroSideEnabled !== false && frontendSettings?.lobbyHeroSideImage) ? 'freeplay-card--with-flyer' : ''}`}>
                {(frontendSettings?.lobbyHeroSideEnabled !== false && frontendSettings?.lobbyHeroSideImage) ? (
                  <>
                    <div className="freeplay-flyer">
                      <img
                        src={frontendSettings.lobbyHeroSideImage}
                        alt={frontendSettings?.lobbyHeroSideImageAlt || 'Download mobile app promotion'}
                      />
                    </div>
                    <div className="freeplay-flyer-footer">
                      <div className="freeplay-flyer-offer">
                        <span className="freeplay-flyer-amount">{frontendSettings?.lobbyFreeplayValue || "$3"}</span>
                        <div className="freeplay-flyer-copy">
                          <strong>{frontendSettings?.lobbyFreeplayLabel || "FREEPLAY"}</strong>
                          <span>
                            {freeplayGate.isFirst && freeplayGate.phase !== 'pending'
                              ? (frontendSettings?.lobbyFreeplayCondition || 'ON SIGNUP!')
                              : freeplayGate.phase === 'deposit' && freeplayGate.canClaim
                                ? 'READY TO CLAIM'
                                : freeplayGate.phase === 'pending'
                                  ? 'REQUEST PENDING'
                                  : freeplayGate.phase === 'need_deposit'
                                    ? `$${Number(freeplayGate.depositTotal || 0).toFixed(0)} / $25 TO ELIGIBLE`
                                    : 'AFTER $25+ DEPOSIT'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleFreeplayClaim}
                        className="freeplay-claim-btn"
                      >
                        <i className="fa-solid fa-gift"></i>
                        {frontendSettings?.lobbyFreeplayClaimBtn || "CLAIM FREEPLAY NOW"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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
                    <h3 className="freeplay-value">{frontendSettings?.lobbyFreeplayValue || "$3"}</h3>
                    <h4 className="freeplay-label">{frontendSettings?.lobbyFreeplayLabel || "FREEPLAY"}</h4>
                    <p className="freeplay-condition">
                      {freeplayGate.isFirst && freeplayGate.phase !== 'pending'
                        ? (frontendSettings?.lobbyFreeplayCondition || 'ON SIGNUP!')
                        : freeplayGate.phase === 'deposit' && freeplayGate.canClaim
                          ? 'READY TO CLAIM'
                          : freeplayGate.phase === 'pending'
                            ? 'REQUEST PENDING'
                            : freeplayGate.phase === 'need_deposit'
                              ? `$${Number(freeplayGate.depositTotal || 0).toFixed(0)} / $25 TO ELIGIBLE`
                              : 'AFTER $25+ DEPOSIT'}
                    </p>

                    <div className="freeplay-bullets">
                      <div className="bullet-item">
                        <i className="fa-solid fa-circle-play text-green"></i>
                        <div className="bullet-desc"><strong>{frontendSettings?.lobbyBullet1Title || "PLAY"}</strong><span>{frontendSettings?.lobbyBullet1Desc || "Explore exciting games"}</span></div>
                      </div>
                      <div className="bullet-item">
                        <i className="fa-solid fa-circle-check text-blue"></i>
                        <div className="bullet-desc"><strong>{frontendSettings?.lobbyBullet2Title || "WIN"}</strong><span>{frontendSettings?.lobbyBullet2Desc || "Win real rewards"}</span></div>
                      </div>
                      <div className="bullet-item">
                        <i className="fa-solid fa-circle-dollar-to-slot text-magenta"></i>
                        <div className="bullet-desc"><strong>{frontendSettings?.lobbyBullet3Title || "CASH OUT"}</strong><span>{frontendSettings?.lobbyBullet3Desc || "Fast withdrawals"}</span></div>
                      </div>
                    </div>
                    <button
                      type="button"
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
                      <i className="fa-solid fa-gift" style={{ marginRight: '6px' }}></i> {frontendSettings?.lobbyFreeplayClaimBtn || "CLAIM FREEPLAY NOW"}
                    </button>
                  </>
                )}
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
                      {game.image.startsWith('game_') || game.image.startsWith('data:') || game.image.startsWith('http') || game.image.startsWith('/') ? (
                        <img
                          src={game.image.startsWith('/') || game.image.startsWith('http') || game.image.startsWith('data:') ? game.image : '/' + game.image}
                          alt={game.title}
                          loading={index < 8 ? 'eager' : 'lazy'}
                          decoding="async"
                        />
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

          {/* Cashout Proof Screenshots Slider */}
          {proofScreenshots.length > 0 && (
            <section className="rules-accordion-section proof-slider-section" style={{ marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#2ecc71', fontSize: '1.2rem' }}></i>
                <h4 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)', color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Our Cashout Proofs & Winnings
                </h4>
              </div>

              <div className="proof-marquee">
                <div
                  className="proof-marquee-track"
                  style={{ '--proof-marquee-duration': `${proofMarqueeSet.length * 2.6}s` }}
                >
                  {proofMarqueeSlides.map((proof, idx) => (
                    <button
                      type="button"
                      key={`${proof.id || 'proof'}-${idx}`}
                      className="proof-slide"
                      onClick={() => setLightboxImage(proof.imageUrl)}
                      aria-hidden={idx >= proofMarqueeSet.length ? 'true' : undefined}
                      tabIndex={idx >= proofMarqueeSet.length ? -1 : 0}
                    >
                      <img
                        src={proof.imageUrl}
                        alt={proof.title || 'Cashout proof'}
                      />
                      <span className="proof-slide-caption">
                        {proof.title || 'Cashout Completed'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="rules-accordion-section" style={{ marginTop: '2rem' }}>
            <div className={`accordion-item ${accordionOpen ? 'active' : ''}`}>
              <div className="accordion-header" onClick={() => setAccordionOpen(!accordionOpen)}>
                <span><i className="fa-scroll fa-solid gold-text"></i> CASHOUT RULES & PLAY INFO</span>
                <i className="fa-solid fa-chevron-down arrow-icon"></i>
              </div>
              <div className="accordion-body">
                <div className="rules-content">
                  {(frontendSettings.cashoutRules || [
                    { title: '1. Account Verification', description: 'Before requesting your first cashout, your email must be verified. Go to customer support if you need assistance updating details.' },
                    { title: '2. Playthrough Requirements', description: 'Sign-up bonuses and deposit match values carry a standard 1x playthrough requirement before funds are eligible for withdrawal requests.' },
                    { title: '3. Minimum & Maximum Cashouts', description: 'The minimum cashout limit is $25. Daily maximum cashouts are capped at $5,000 for standard players. Support can raise limits for VIP accounts.' },
                    { title: '4. Payout Duration', description: 'Withdrawal requests are processed instantly or within 10-15 minutes on average via digital wallets.' }
                  ]).map((rule, idx) => (
                    <React.Fragment key={idx}>
                      <h5>{rule.title}</h5>
                      <p style={{ whiteSpace: 'pre-line' }}>{rule.description}</p>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="lobby-cashout-trust-section" style={{ marginTop: '1.25rem' }}>
            {(frontendSettings?.lobbyCashoutTrustItems || [
              { icon: 'fa-shield-halved', title: '100% SECURE', description: 'Your data is always protected' },
              { icon: 'fa-circle-check', title: 'FAIR PLAY', description: 'Provably fair and transparent' },
              { icon: 'fa-bolt', title: 'INSTANT WITHDRAWALS', description: 'Get your winnings instantly' },
              { icon: 'fa-headset', title: '24/7 SUPPORT', description: 'Always here to help you' }
            ]).map((item, idx) => (
              <div key={idx} className="lobby-cashout-trust-item">
                <div className="lobby-cashout-trust-icon">
                  <i className={`fa-solid ${item.icon || 'fa-shield-halved'}`}></i>
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </section>
        </motion.div>
      ) : (
        /* ==============================================================
             VIEW B: GAME ACCESS DRILL-DOWN PANEL
             ============================================================== */
        <motion.div
          key="game-portal"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="lobby-content-container game-access-portal-view"
        >

          <div className="game-access-header">
            <div className="game-header-brand">
              <div className="lobby-logo-box" style={{ width: '50px', height: '50px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', border: '1px solid rgba(255,215,0,0.4)', borderRadius: '50%', boxShadow: '0 0 15px rgba(255,215,0,0.25)' }}>
                {activeGame.image && (activeGame.image.startsWith('game_') || activeGame.image.startsWith('data:') || activeGame.image.startsWith('http') || activeGame.image.startsWith('/')) ? (
                  <img
                    src={activeGame.image.startsWith('/') || activeGame.image.startsWith('http') || activeGame.image.startsWith('data:') ? activeGame.image : '/' + activeGame.image}
                    alt={activeGame.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      clipPath: 'circle(50%)'
                    }}
                  />
                ) : (
                  <div 
                    className={`game-placeholder-card ${(activeGame.image === 'placeholder_2' || !activeGame.image) ? 'pc-red' : activeGame.image === 'placeholder_3' ? 'pc-blue' : 'pc-gold'}`}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      borderRadius: '50%'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff', textTransform: 'uppercase' }}>
                      {activeGame.title ? activeGame.title.charAt(0) : 'G'}
                    </span>
                  </div>
                )}
              </div>
              <div className="game-header-titles">
                <h3>
                  {activeGame.title} PANEL
                </h3>
                <span>
                  Deposits • Withdrawals • Game Access
                </span>
              </div>
            </div>

            <div className="game-header-buttons">
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
            isLinkPayGateway(activeInvoice.gateway) ? (
              /* Cash App / Stripe — video-style: pay link only (no tag / phone / QR) */
              <div className="invoice-container" style={{ animation: 'fade-in 0.3s ease-out', maxWidth: '440px', margin: '0 auto' }}>
                <div
                  className="invoice-card"
                  style={{
                    background: '#111318',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '18px',
                    padding: '1.35rem 1.25rem 1.5rem',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.35)'
                  }}
                >
                  <h3 style={{ textAlign: 'center', fontSize: '1.15rem', fontWeight: '800', color: '#fff', margin: '0 0 1.15rem' }}>
                    {String(activeInvoice.gateway?.theme || '').toLowerCase() === 'stripe' ? '💳' : '💵'}{' '}
                    Pay with {activeInvoice.gateway?.name || 'Link'}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.15rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Game</span>
                      <strong style={{ color: '#fff', textAlign: 'right' }}>{activeGame?.title || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Username</span>
                      <strong style={{ color: '#fff', textAlign: 'right' }}>
                        {(gameAccounts || []).find((a) => a.gameTitle === activeGame?.title)?.username
                          || currentUser?.name
                          || currentUserEmail
                          || '—'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Amount USD</span>
                      <strong style={{ color: '#fff' }}>${parseFloat(activeInvoice.amount).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Status</span>
                      <strong style={{ color: '#f59e0b' }}>UNPAID</strong>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.45rem', textAlign: 'center' }}>
                      Unique Code / Memo
                    </div>
                    <div
                      style={{
                        border: '1px dashed rgba(34,197,94,0.55)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        textAlign: 'center',
                        background: 'rgba(34,197,94,0.06)'
                      }}
                    >
                      <code style={{ fontSize: '1.35rem', color: '#4ade80', fontWeight: '900', letterSpacing: '1px' }}>
                        {activeInvoice.noteCode}
                      </code>
                    </div>
                    <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center', margin: '0.45rem 0 0', lineHeight: 1.35 }}>
                      Put this code in the payment note / memo when you pay.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenActiveInvoicePayLink}
                    className="submit-btn"
                    style={{
                      marginTop: 0,
                      marginBottom: '0.65rem',
                      width: '100%',
                      background: String(activeInvoice.gateway?.theme || '').toLowerCase() === 'stripe' ? '#635bff' : '#00d632',
                      color: String(activeInvoice.gateway?.theme || '').toLowerCase() === 'stripe' ? '#fff' : '#000',
                      boxShadow: 'none',
                      padding: '0.95rem 1rem',
                      borderRadius: '12px'
                    }}
                  >
                    <span style={{ fontSize: '0.95rem', fontWeight: '900' }}>
                      {String(activeInvoice.gateway?.theme || '').toLowerCase() === 'stripe' ? '💳' : '💵'}{' '}
                      Pay with {activeInvoice.gateway?.name || 'Link'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyInvoiceSummary}
                    className="submit-btn"
                    style={{
                      marginTop: 0,
                      marginBottom: '1rem',
                      width: '100%',
                      background: '#1c1f2b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: 'none',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>📋 Copy Invoice</span>
                  </button>

                  <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 0.85rem' }}>
                    Waiting for payment confirmation…
                  </p>

                  <div
                    className="tag-field-row"
                    style={{
                      background: '#0b0c16',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      marginBottom: '1rem'
                    }}
                  >
                    <label htmlFor="screenshot-receipt-linkpay" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Upload Payment Screenshot (Required)
                    </label>
                    <input
                      type="file"
                      id="screenshot-receipt-linkpay"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      style={{ border: 'none', background: 'none', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', width: '100%' }}
                      required
                    />
                    {screenshotBase64 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <i className="fa-solid fa-circle-check text-green" style={{ fontSize: '0.8rem' }}></i>
                        <span style={{ fontSize: '0.65rem', color: '#4ade80', fontWeight: 'bold' }}>Screenshot proof selected.</span>
                      </div>
                    )}
                  </div>

                  <div className="invoice-actions-row" style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={handleCancelInvoice}
                      className="submit-btn"
                      style={{ flex: 1, marginTop: 0, background: '#ef4444', borderRadius: '10px', padding: '0.8rem' }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePaidConfirm}
                      className="submit-btn"
                      disabled={!screenshotBase64}
                      style={{
                        flex: 1,
                        marginTop: 0,
                        background: '#fff',
                        color: '#111',
                        borderRadius: '10px',
                        padding: '0.8rem',
                        opacity: screenshotBase64 ? 1 : 0.5,
                        cursor: screenshotBase64 ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>✅ I Paid</span>
                    </button>
                  </div>

                  <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center', margin: '0.85rem 0 0', lineHeight: 1.4 }}>
                    After making the payment, click <strong style={{ color: '#fff' }}>I Paid</strong>. To stop this payment, click <strong style={{ color: '#fff' }}>Cancel</strong>.
                  </p>
                </div>
              </div>
            ) : (
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

                  <div className="invoice-actions-row" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
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
            )
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
                            <h4 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              WITHDRAW
                              {isFreeplaySession && (
                                <span style={{ background: 'rgba(0, 255, 102, 0.1)', border: '1px solid rgba(0, 255, 102, 0.3)', color: '#00ff66', fontSize: '0.575rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 'bold' }}>
                                  FREEPLAY CASHOUT
                                </span>
                              )}
                            </h4>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {isFreeplaySession ? 'Your freeplay cashout limit is $30.' : 'Request payout to your preferred tag.'}
                            </p>
                          </div>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                            <i className="fa-solid fa-receipt"></i>
                          </div>
                        </div>

                        <form onSubmit={handleWithdrawInitiate}>
                          <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <div className="input-wrapper" style={{ background: '#0b0c16', position: 'relative' }}>
                              {isFreeplaySession && (
                                <span style={{
                                  position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                                  background: 'linear-gradient(135deg, #00ff66, #10b981)', color: '#000', fontSize: '0.6rem',
                                  padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', letterSpacing: '0.5px',
                                  zIndex: 2, pointerEvents: 'none', userSelect: 'none'
                                }}>
                                  FREEPLAY
                                </span>
                              )}
                              <input
                                type="number"
                                placeholder="10"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                style={{ padding: '0.75rem 1rem', paddingLeft: isFreeplaySession ? '5.5rem' : '1rem' }}
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

                    {/* Allotment Hold Notices */}
                    {(() => {
                      const userHoldAllotments = (coinsNotifications || []).filter(n => n.status === 'HOLD');
                      if (userHoldAllotments.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                          {userHoldAllotments.map((noti) => (
                            <div key={noti.id} style={{
                              padding: '0.85rem 1.25rem',
                              background: 'linear-gradient(135deg, rgba(8, 10, 17, 0.95) 0%, rgba(20, 15, 5, 0.95) 100%)',
                              border: '1.5px solid rgba(245, 158, 11, 0.4)',
                              borderRadius: '14px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem',
                              flexWrap: 'wrap',
                              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '1.35rem', color: '#f59e0b', flexShrink: 0 }}></i>
                                <div>
                                  <span style={{ display: 'block', fontWeight: 'bold', color: '#fff', marginBottom: '0.15rem' }}>
                                    {noti.totalCoins < 0 ? 'Withdrawal' : 'Allotment'} for {noti.gameTitle} is ON HOLD!
                                  </span>
                                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                                    Reason: <strong style={{ color: '#fca5a5' }}>{noti.holdNote || 'Declined / Hold by Manager'}</strong>.
                                  </span>
                                </div>
                              </div>
                              {noti.totalCoins >= 0 && (
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
                                    padding: '0.45rem 1rem',
                                    borderRadius: '8px',
                                    fontSize: '0.65rem',
                                    width: 'auto',
                                    margin: 0,
                                    flexShrink: 0,
                                    boxShadow: '0 4px 10px rgba(245,158,11,0.2)'
                                  }}
                                >
                                  Claim Coins (Played Existing)
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="wallet-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }}>
                        Recent Transactions
                      </h4>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {totalTx} Records
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
                          {paginatedTransactions.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center text-muted" style={{ padding: '1.5rem' }}>
                                No transactions recorded yet.
                              </td>
                            </tr>
                          ) : (
                            paginatedTransactions.map((tx, idx) => (
                              <tr key={tx.id}>
                                <td>{(txPage - 1) * txLimit + idx + 1}</td>
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
                                  {tx.status === 'FAILED' ? (
                                    renderFailedStatusWithTooltip(tx)
                                  ) : (
                                    <span className={`admin-badge-preview b-${(tx.status === 'PENDING_COINS' || tx.status === 'COINS_LOADING') ? 'new' : (tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase())}`}>
                                      {tx.status === 'PENDING_COINS' ? 'VERIFYING COINS' : (tx.status === 'COINS_LOADING' ? 'COINS LOADING' : tx.status)}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '0.725rem', opacity: 0.8 }}>
                                      {tx.note && tx.status !== 'FAILED' ? tx.note : (tx.code === 'SIGNUP-FREE3' ? 'Freeplay (SIGNUP-FREE3)' : tx.code === 'FREEPLAY' ? 'Freeplay' : `${tx.gateway} (${tx.code})`)}
                                    </span>
                                    {tx.type === 'WITHDRAW' && (
                                      <RemainderClaimAction
                                        tx={tx}
                                        claimedIds={claimedRemainderIds}
                                        onClaim={handleClaimRemainder}
                                        actionLoading={actionLoading}
                                      />
                                    )}
                                  </div>
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

                    {totalTxPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', padding: '0 0.25rem' }}>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          Page {txPage} of {totalTxPages}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => txPage > 1 && setTxPage(txPage - 1)}
                            disabled={txPage === 1}
                            className="action-row-btn"
                            style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.65rem', opacity: txPage === 1 ? 0.3 : 1, cursor: txPage === 1 ? 'not-allowed' : 'pointer' }}
                          >
                            &larr; Prev
                          </button>
                          <button
                            onClick={() => txPage < totalTxPages && setTxPage(txPage + 1)}
                            disabled={txPage === totalTxPages}
                            className="action-row-btn"
                            style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.65rem', opacity: txPage === totalTxPages ? 0.3 : 1, cursor: txPage === totalTxPages ? 'not-allowed' : 'pointer' }}
                          >
                            Next &rarr;
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>

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
                  {(() => {
                    const activeGts = (gateways || []).filter(g => g.isWithdrawActive);
                    if (activeGts.length > 0) {
                      return activeGts.map((gt) => (
                        <label
                          key={gt.id}
                          onClick={() => {
                            setSelectedWithdrawGateway(gt);
                            setWithdrawMethod(gt.name);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1rem',
                            background: withdrawMethod === gt.name ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.01)',
                            border: withdrawMethod === gt.name ? '1.5px solid var(--gold-primary)' : '1.5px solid rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div>
                            <strong style={{ display: 'block', fontSize: '0.85rem', color: '#fff' }}>{gt.name}</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{gt.subtitle || `Withdraw to your ${gt.name} tag`}</span>
                          </div>
                          <input
                            type="radio"
                            name="withdrawMethod"
                            checked={withdrawMethod === gt.name}
                            onChange={() => {
                              setSelectedWithdrawGateway(gt);
                              setWithdrawMethod(gt.name);
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                          />
                        </label>
                      ));
                    }

                    // Fallback to static if no withdrawal gateways configured in CMS
                    return (
                      <>
                        <label
                          onClick={() => {
                            setSelectedWithdrawGateway(null);
                            setWithdrawMethod('Chime');
                          }}
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
                            onChange={() => {
                              setSelectedWithdrawGateway(null);
                              setWithdrawMethod('Chime');
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                          />
                        </label>
                        <label
                          onClick={() => {
                            setSelectedWithdrawGateway(null);
                            setWithdrawMethod('Cash App');
                          }}
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
                            onChange={() => {
                              setSelectedWithdrawGateway(null);
                              setWithdrawMethod('Cash App');
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                          />
                        </label>
                      </>
                    );
                  })()}
                </div>
              </div>

              {shouldShowField('name') && (
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
              )}

              {shouldShowField('tag') && (
                <div className="input-group">
                  <label htmlFor="tag-code">Tag / Address</label>
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
              )}

              <div className="input-group">
                <label htmlFor="tag-phone">Phone Number on Tag</label>
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

              {shouldShowField('email') && (
                <div className="input-group">
                  <label htmlFor="tag-email">Email Address</label>
                  <div className="input-wrapper" style={{ background: '#0b0c16' }}>
                    <i className="fa-solid fa-envelope input-icon"></i>
                    <input
                      type="email"
                      id="tag-email"
                      placeholder="e.g. name@email.com"
                      value={withdrawEmail}
                      onChange={(e) => setWithdrawEmail(e.target.value)}
                      style={{ paddingLeft: '2.5rem' }}
                      required
                    />
                  </div>
                </div>
              )}

              {frontendSettings?.withdrawRequireGameScreenshot === true && (
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
              )}

              {frontendSettings?.withdrawRequireTagQrScreenshot !== false && (
              <div className="input-group" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="withdraw-tag-qr-screenshot" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Upload Tag QR Screenshot (Required)
                </label>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '0.1rem 0 0.5rem' }}>
                  Please upload a clear screenshot of your payment tag QR code.
                </p>
                <div className="input-wrapper" style={{ background: '#0b0c16', position: 'relative' }}>
                  <i className="fa-solid fa-qrcode input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                  <input
                    type="file"
                    id="withdraw-tag-qr-screenshot"
                    accept="image/*"
                    onChange={handleTagQrScreenshotChange}
                    style={{ opacity: 0, position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 5 }}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', paddingLeft: '2.5rem', color: tagQrScreenshot ? '#4ade80' : 'rgba(255,255,255,0.4)', lineHeight: '40px', pointerEvents: 'none' }}>
                    {tagQrScreenshot ? 'Tag QR screenshot selected ✓' : 'Choose Tag QR screenshot...'}
                  </span>
                </div>
              </div>
              )}

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

      {/* Subscription Alert Prompt Modal */}
      {showSubPrompt && (
        <div className="modal-backdrop-custom" style={{ zIndex: 2000 }}>
          <div className="modal-content border-gold animate-float" style={{ maxWidth: '420px', width: '90%', textAlign: 'center', padding: '2rem 1.5rem', position: 'relative' }}>
            {/* Top-Right Close Button */}
            <button
              onClick={() => {
                sessionStorage.setItem('jackpot_sub_dismissed', 'true');
                setShowSubPrompt(false);
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '1.4rem',
                cursor: 'pointer',
                transition: 'color 0.2s',
                lineHeight: 1
              }}
              onMouseEnter={(e) => e.target.style.color = '#fff'}
              onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.4)'}
              aria-label="Close"
            >
              &times;
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1rem auto',
                borderRadius: '50%',
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1px solid var(--gold-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                color: 'var(--gold-primary)',
                boxShadow: '0 0 20px rgba(255,215,0,0.2)'
              }}>
                <i className="fa-solid fa-bell animate-pulse"></i>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Unlock VIP Promos & Bonuses!</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Subscribe to our official Jackpot Royals newsletter to receive exclusive first deposit bonuses, freeplay coins, and daily game updates directly in your inbox.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={async () => {
                  setSubscribing(true);
                  try {
                    const res = await fetch('/api/users/subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: currentUserEmail, isSubscribed: true })
                    });
                    const data = await res.json();
                    if (data.success) {
                      showToast('Thank you for subscribing!', 'success');
                      if (onUpdateUser) {
                        onUpdateUser({ ...currentUser, isSubscribed: true });
                      } else if (currentUser) {
                        currentUser.isSubscribed = true;
                      }
                      setShowSubPrompt(false);
                    } else {
                      showToast(data.message || 'Subscription failed.', 'error');
                    }
                  } catch (err) {
                    console.error(err);
                    showToast('Connection error. Please try again.', 'error');
                  } finally {
                    setSubscribing(false);
                  }
                }}
                disabled={subscribing}
                className="submit-btn"
                style={{
                  background: 'var(--gold-primary)',
                  color: '#000',
                  fontWeight: 'bold',
                  margin: 0,
                  width: '100%'
                }}
              >
                {subscribing ? 'SUBSCRIBING...' : 'SUBSCRIBE NOW'}
              </button>
              
              <button
                onClick={() => {
                  sessionStorage.setItem('jackpot_sub_dismissed', 'true');
                  setShowSubPrompt(false);
                }}
                style={{
                  background: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  border: 'none',
                  fontSize: '0.725rem',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  textDecoration: 'underline',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.4)'}
              >
                No thanks, maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending freeplay claim banner — lets the player finish claiming after
          they pick a game, so the offer is never lost when they close the popup. */}
      {pendingPromoFreeplay && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(12px + env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2500,
            width: 'min(94%, 460px)',
            background: 'linear-gradient(135deg, #1a1030 0%, #0a0d16 100%)',
            border: '1px solid rgba(168,85,247,0.5)',
            borderRadius: '12px',
            padding: '0.7rem 0.85rem',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}
        >
          <i className="fa-solid fa-gift" style={{ color: '#c084fc', fontSize: '1.1rem' }}></i>
          <div style={{ flex: 1, fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.35 }}>
            {activeGame ? (
              <>Tap claim to get your <strong style={{ color: '#c084fc' }}>${Number(pendingPromoFreeplay.freeplayAmount || 0).toFixed(2)} freeplay</strong> on <strong>{activeGame.title}</strong>.</>
            ) : (
              <>Select a game below to claim your <strong style={{ color: '#c084fc' }}>${Number(pendingPromoFreeplay.freeplayAmount || 0).toFixed(2)} freeplay</strong>.</>
            )}
          </div>
          <button
            onClick={() => handlePromoFreeplayClaim(pendingPromoFreeplay)}
            className="submit-btn"
            style={{ margin: 0, width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.7rem', background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', whiteSpace: 'nowrap' }}
          >
            Claim
          </button>
          <button
            onClick={() => { dismissPromo(pendingPromoFreeplay, true); setPendingPromoFreeplay(null); }}
            aria-label="Dismiss offer"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 0.2rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Targeted Promotion Announcement Modal Popup */}
      {currentPromoToShow && (
        <div className="modal-backdrop-custom" style={{ zIndex: 3000 }}>
          <div className="modal-content border-gold animate-float" style={{ maxWidth: '460px', width: '90%', padding: 0, overflow: 'hidden' }}>
            {currentPromoToShow.image ? (
              <div style={{ width: '100%', height: '180px', position: 'relative' }}>
                <img
                  src={currentPromoToShow.image}
                  alt={currentPromoToShow.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 30%, rgba(10, 13, 22, 0.95) 100%)'
                }}></div>
              </div>
            ) : (
              <div style={{
                width: '100%',
                height: '120px',
                background: 'linear-gradient(135deg, #ffd700 0%, #b38600 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <i className="fa-solid fa-gift" style={{ fontSize: '3rem', color: '#000', opacity: 0.85 }}></i>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, transparent 30%, rgba(10, 13, 22, 0.95) 100%)'
                }}></div>
              </div>
            )}

            <div style={{ padding: '1.5rem', background: '#0a0d16', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--gold-primary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                {currentPromoToShow.title}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#e2e8f0', lineHeight: '1.5', marginBottom: '1.5rem', whiteSpace: 'normal' }}>
                {currentPromoToShow.message}
              </p>

              {(() => {
                const pType = currentPromoToShow.promoType || 'message';
                const fp = Number(currentPromoToShow.freeplayAmount || 0);
                const bp = Number(currentPromoToShow.bonusPercent || 0);
                return (
                  <>
                    {(pType === 'freeplay' && fp > 0) && (
                      <div style={{ display: 'inline-block', margin: '0 auto 1rem', padding: '0.4rem 0.9rem', borderRadius: '999px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', color: '#c084fc', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        <i className="fa-solid fa-gift" style={{ marginRight: '6px' }}></i>${fp.toFixed(2)} Freeplay
                      </div>
                    )}
                    {pType === 'deposit_bonus' && (
                      <div style={{ display: 'inline-block', margin: '0 auto 1rem', padding: '0.4rem 0.9rem', borderRadius: '999px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        <i className="fa-solid fa-coins" style={{ marginRight: '6px' }}></i>{bp}% Deposit Bonus
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {pType === 'message' ? (
                        <button
                          onClick={() => dismissPromo(currentPromoToShow, true)}
                          className="submit-btn"
                          style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', margin: 0 }}
                        >
                          Got it
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => (pType === 'freeplay'
                              ? handlePromoFreeplayClaim(currentPromoToShow)
                              : handlePromoBonusClaim(currentPromoToShow))}
                            className="submit-btn"
                            style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', margin: 0 }}
                          >
                            {pType === 'freeplay' ? 'CLAIM FREEPLAY' : 'CLAIM BONUS'}
                          </button>
                          <button
                            onClick={() => dismissPromo(currentPromoToShow, false)}
                            className="action-row-btn"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            Later
                          </button>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            animation: 'fade-in 0.25s ease-out'
          }}
        >
          <button 
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '2rem',
              cursor: 'pointer'
            }}
          >
            &times;
          </button>
          <img 
            src={lightboxImage} 
            alt="Winnings Proof High Resolution" 
            style={{
              maxWidth: '95%',
              maxHeight: '90vh',
              borderRadius: '12px',
              border: '2px solid var(--gold-primary)',
              boxShadow: '0 0 35px rgba(255,215,0,0.2)'
            }}
          />
        </div>
      )}

      {frontendSettings?.getAppEnabled && (
        <AppInstallModal
          isOpen={appInstallOpen}
          onClose={() => setAppInstallOpen(false)}
          onInstallPwa={onInstallApp}
          currentUserEmail={currentUserEmail}
          androidAppUrl={frontendSettings?.androidAppUrl || '/downloads/jackpot-royals.apk'}
          iosAppUrl={frontendSettings?.iosAppUrl || ''}
          showToast={showToast}
        />
      )}

      {/* Floating support — move aside during deposit invoice so I HAVE PAID stays tappable */}
      <div
        className={`support-chat-widget${activeInvoice ? ' support-chat-widget--deposit' : ''}`}
        onClick={onOpenSupport}
      >
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
