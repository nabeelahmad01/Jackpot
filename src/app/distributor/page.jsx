'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import TxSearchTab from '../../components/admin/TxSearchTab';
import SupportTab from '../../components/admin/SupportTab';
import CoinsAllotmentTab from '../../components/admin/CoinsAllotmentTab';
import RequestsTab from '../../components/admin/RequestsTab';
import LedgerTab from '../../components/admin/LedgerTab';
import ShiftDashboardTab from '../../components/admin/ShiftDashboardTab';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function DistributorPortal() {
  const [mounted, setMounted] = useState(false);
  const [distSession, setDistSession] = useState(null);
  const [proofModalUrl, setProofModalUrl] = useState('');

  const handleInspectProof = async (url, txId) => {
    if (url) {
      setProofModalUrl(url);
    } else if (txId) {
      setProofModalUrl('LOADING');
      try {
        const res = await fetch(`/api/transactions?id=${txId}&adminRole=distributor&email=${encodeURIComponent(distSession?.email || '')}`);
        const data = await res.json();
        if (data.success) {
          // If transaction has payoutProof (admin payout receipt) load it, otherwise fallback to user upload proof
          const targetImage = data.transaction?.payoutProof || data.transaction?.screenshot || '';
          if (targetImage) {
            setProofModalUrl(targetImage);
          } else {
            alert('No screenshot proof found for this transaction.');
            setProofModalUrl('');
          }
        } else {
          alert('Failed to load transaction details.');
          setProofModalUrl('');
        }
      } catch (err) {
        console.error(err);
        alert('Error loading receipt image.');
        setProofModalUrl('');
      }
    }
  };

  // Login credentials states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sidebar navigation tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Stats SWR
  const distId = distSession?.id;
  const { data: statsData, mutate: mutateStats } = useSWR(
    distId ? `/api/distributors/stats?distributorId=${distId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Gateways SWR (For Type B)
  const { data: gatewaysData, mutate: mutateGateways } = useSWR(
    distId && distSession?.type === 'B' ? `/api/distributors/gateways?distributorId=${distId}` : null,
    fetcher
  );

  // Staff SWR (For Type B)
  const { data: staffData, mutate: mutateStaff } = useSWR(
    distId && distSession?.type === 'B' ? `/api/distributors/staff?distributorId=${distId}` : null,
    fetcher
  );

  // Dynamic operations queues (Requests & Coins check for Type B players)
  const { data: allRequestsData, mutate: mutateAllRequests } = useSWR(
    distId && distSession?.type === 'B' ? `/api/account-requests?adminRole=distributor&adminDistributorId=${distId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: allCoinsData, mutate: mutateAllCoins } = useSWR(
    distId && distSession?.type === 'B' ? `/api/coins-notifications?adminRole=distributor&adminDistributorId=${distId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: commTxData, mutate: mutateCommTx } = useSWR(
    distSession ? `/api/transactions?email=${encodeURIComponent(distSession.email)}&type=COMMISSION_WITHDRAW` : null,
    fetcher
  );

  const { data: gamesData, mutate: mutateGames } = useSWR(
    distId ? `/api/games?distributorId=${distId}` : null,
    fetcher
  );

  // Filter player queues to show only referred players' requests
  const players = statsData?.players || [];
  const playerEmails = players.map(p => (p.email || '').toLowerCase().trim()).filter(Boolean);

  const referredRequests = (allRequestsData?.accountRequests || []).filter(req =>
    req.email && playerEmails.includes(req.email.toLowerCase().trim())
  );

  const referredCoins = (allCoinsData?.coinsNotifications || []).filter(noti =>
    noti.email && playerEmails.includes(noti.email.toLowerCase().trim())
  );

  const { data: settingsData } = useSWR('/api/settings', fetcher);
  const usdtAddress = settingsData?.settings?.usdtAddress || '';
  const usdtQrCode = settingsData?.settings?.usdtQrCode || '';

  const { data: webCommTxData, mutate: mutateWebCommTx } = useSWR(
    distSession && distSession.type === 'B' ? `/api/transactions?email=${encodeURIComponent(distSession.email)}&type=WEBSITE_COMMISSION_PAYMENT` : null,
    fetcher
  );

  // Form states for creating Gateway (Type B)
  const [gwName, setGwName] = useState('');
  const [gwSubtitle, setGwSubtitle] = useState('');
  const [gwTag, setGwTag] = useState('');
  const [gwPhone, setGwPhone] = useState('');
  const [gwTheme, setGwTheme] = useState('cashapp');
  const [gwQr, setGwQr] = useState('');
  const [gwWithdraw, setGwWithdraw] = useState(false);
  const [isSubmittingGateway, setIsSubmittingGateway] = useState(false);

  // Form states for creating Staff (Type B)
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('coins_admin');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // Commission Withdraw Form States
  const [commAmount, setCommAmount] = useState('');
  const [commGateway, setCommGateway] = useState('USDT');
  const [commCode, setCommCode] = useState('');
  const [isSubmittingComm, setIsSubmittingComm] = useState(false);
  const [commMsg, setCommMsg] = useState('');

  // Player management States
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  // Website Commission payment States (Type B)
  const [webAmount, setWebAmount] = useState('');
  const [webCode, setWebCode] = useState('');
  const [webScreenshot, setWebScreenshot] = useState('');
  const [isSubmittingWeb, setIsSubmittingWeb] = useState(false);
  const [webMsg, setWebMsg] = useState('');

  // Invalidation reason modal (Type B allotments)
  const [invalidatingNoti, setInvalidatingNoti] = useState(null);
  const [holdReason, setHoldReason] = useState('');

  // Referral Link copy
  const [copiedLink, setCopiedLink] = useState(false);

  // Distributor Game Pool Update States
  const [poolUpdateModalOpen, setPoolUpdateModalOpen] = useState(false);
  const [selectedPoolGame, setSelectedPoolGame] = useState(null);
  const [updatePoolCoins, setUpdatePoolCoins] = useState('');
  const [updatePoolLink, setUpdatePoolLink] = useState('');
  const [isUpdatingPool, setIsUpdatingPool] = useState(false);

  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Commission Lookup Calendar States
  const [commLookupDate, setCommLookupDate] = useState(getTodayDateString());
  const [commLookupStats, setCommLookupStats] = useState({ deposits: 0, withdrawals: 0, commission: 0, websiteCommission: 0 });
  const [commLookupLoading, setCommLookupLoading] = useState(false);

  useEffect(() => {
    if (!distId || !commLookupDate) return;
    setCommLookupLoading(true);
    fetch(`/api/distributors/stats/by-date?distributorId=${distId}&date=${commLookupDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCommLookupStats({
            deposits: data.totalDeposits || 0,
            withdrawals: data.totalWithdrawals || 0,
            commission: data.commissionEarned || 0,
            websiteCommission: data.websiteCommissionEarned || 0,
            commissionRate: data.commissionRate || 0,
            websiteCommissionRate: data.websiteCommissionRate || 0
          });
        }
      })
      .catch(err => console.error('Failed lookup by date:', err))
      .finally(() => setCommLookupLoading(false));
  }, [distId, commLookupDate]);

  const prevCountsRef = useRef({ requests: 0, coins: 0 });

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

  useEffect(() => {
    const counts = {
      requests: referredRequests.length,
      coins: referredCoins.length
    };
    const prev = prevCountsRef.current;
    if (counts.requests > prev.requests || counts.coins > prev.coins) {
      playSynthesizedBackup();
    }
    prevCountsRef.current = counts;
  }, [referredRequests.length, referredCoins.length]);

  const handleRequestCommWithdraw = async (e) => {
    e.preventDefault();
    if (!commAmount || !commCode) return;
    const reqVal = parseFloat(commAmount);
    if (isNaN(reqVal) || reqVal <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    
    const commWithdrawals = commTxData?.transactions || [];
    const totalWithdrawn = commWithdrawals.filter(tx => tx.status === 'SUCCESS' || tx.status === 'PENDING').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const availableCommission = Math.max(0, (stats.commissionEarned || 0) - totalWithdrawn);

    if (reqVal > availableCommission) {
      alert('Request amount exceeds available commission.');
      return;
    }

    setIsSubmittingComm(true);
    setCommMsg('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: distSession.email,
          amount: reqVal,
          gateway: commGateway,
          code: commCode,
          type: 'COMMISSION_WITHDRAW',
          gameTitle: 'Distributor Payout',
          status: 'PENDING'
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommAmount('');
        setCommCode('');
        setCommMsg('Commission payout request submitted successfully!');
        mutateCommTx();
      } else {
        setCommMsg(data.message || 'Request failed.');
      }
    } catch (err) {
      setCommMsg('Server error submitting request.');
    } finally {
      setIsSubmittingComm(false);
    }
  };

  const handleClaimDistributorRemainder = async (tx) => {
    if (!window.confirm(`Do you want to submit a cashout request for the remaining $${parseFloat(tx.payoutHold).toFixed(2)} on Hold?`)) {
      return;
    }
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: distSession.email,
          type: 'COMMISSION_WITHDRAW',
          amount: parseFloat(tx.payoutHold),
          gateway: tx.gateway,
          code: tx.code || '—',
          isRemainderRequest: true,
          parentTxId: tx.id
        })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Remainder commission cashout request submitted successfully!');
        mutateCommTx();
      } else {
        alert(resData.message || 'Failed to request remainder payout.');
      }
    } catch (err) {
      console.error(err);
      alert('Error requesting remainder payout.');
    }
  };

  const handlePoolUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPoolGame) return;
    setIsUpdatingPool(true);
    try {
      const res = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPoolGame.id,
          distributorId: distId,
          availableCoins: Number(updatePoolCoins),
          openPanelLink: updatePoolLink
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Game coins pool updated successfully!');
        setPoolUpdateModalOpen(false);
        mutateGames();
      } else {
        alert(data.message || 'Failed to update pool.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating coins pool.');
    } finally {
      setIsUpdatingPool(false);
    }
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) return;
    setIsRegSubmitting(true);
    try {
      const res = await fetch('/api/distributors/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, distributorId: distId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Player account created successfully!');
        setRegModalOpen(false);
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        mutateStats();
      } else {
        alert(data.message || 'Failed to register player.');
      }
    } catch (err) {
      console.error(err);
      alert('Error registering player.');
    } finally {
      setIsRegSubmitting(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetPassword.trim()) return;
    setIsResetSubmitting(true);
    try {
      const res = await fetch('/api/distributors/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, password: resetPassword, distributorId: distId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Player password reset successfully!');
        setResetModalOpen(false);
        setResetPassword('');
      } else {
        alert(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error(err);
      alert('Error resetting password.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleDeletePlayer = async (email) => {
    if (!window.confirm(`Are you sure you want to delete player account "${email}"? This player account will be soft-deleted.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/distributors/players?email=${encodeURIComponent(email)}&distributorId=${distId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        alert('Player account deleted successfully.');
        mutateStats();
      } else {
        alert(data.message || 'Failed to delete player.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting player.');
    }
  };

  const handleWebScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Payment receipt screenshot must be less than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setWebScreenshot(reader.result);
      alert('USDT payment receipt screenshot loaded. Ready to submit!');
    };
    reader.readAsDataURL(file);
  };

  const handleRequestWebPayment = async (e) => {
    e.preventDefault();
    if (!webAmount || !webCode || !webScreenshot) {
      alert('Please fill in amount, TxID/Hash and attach payment screenshot proof.');
      return;
    }
    const reqVal = parseFloat(webAmount);
    if (isNaN(reqVal) || reqVal <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    setIsSubmittingWeb(true);
    setWebMsg('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: distSession.email,
          amount: reqVal,
          gateway: 'USDT',
          code: webCode,
          screenshot: webScreenshot,
          type: 'WEBSITE_COMMISSION_PAYMENT',
          gameTitle: 'Platform Fees',
          status: 'PENDING'
        })
      });
      const data = await res.json();
      if (data.success) {
        setWebAmount('');
        setWebCode('');
        setWebScreenshot('');
        setWebMsg('Website commission payment proof submitted successfully!');
        mutateWebCommTx();
      } else {
        setWebMsg(data.message || 'Submission failed.');
      }
    } catch (err) {
      console.error(err);
      setWebMsg('Server error submitting payment proof.');
    } finally {
      setIsSubmittingWeb(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('jackpot_distributor_session');
    if (saved) {
      setDistSession(JSON.parse(saved));
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/distributors/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('jackpot_distributor_session', JSON.stringify(data.distributor));
        setDistSession(data.distributor);
        setActiveTab('overview');
      } else {
        setLoginError(data.message || 'Invalid credentials.');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Connection failure.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jackpot_distributor_session');
    setDistSession(null);
  };

  // Add Gateway (Type B)
  const handleAddGateway = async (e) => {
    e.preventDefault();
    if (!gwName.trim() || !gwTag.trim()) {
      alert('Gateway Name and tag are required.');
      return;
    }
    setIsSubmittingGateway(true);
    try {
      const res = await fetch('/api/distributors/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: gwName.trim(),
          subtitle: gwSubtitle.trim(),
          tag: gwTag.trim(),
          phone: gwPhone.trim(),
          theme: gwTheme,
          qrImage: gwQr.trim() || undefined,
          isWithdrawActive: gwWithdraw,
          distributorId: distId
        })
      });
      const data = await res.json();
      if (data.success) {
        setGwName('');
        setGwSubtitle('');
        setGwTag('');
        setGwPhone('');
        setGwQr('');
        setGwWithdraw(false);
        mutateGateways();
        alert('Gateway created successfully!');
      } else {
        alert(data.message || 'Failed to create gateway.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingGateway(false);
    }
  };

  // Delete Gateway (Type B)
  const handleDeleteGateway = async (id) => {
    if (window.confirm('Delete this payment gateway?')) {
      try {
        const res = await fetch(`/api/distributors/gateways?id=${id}&distributorId=${distId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          mutateGateways();
          alert('Gateway deleted.');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Add Staff (Type B)
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      alert('Please fill out all staff fields.');
      return;
    }
    setIsSubmittingStaff(true);
    try {
      const res = await fetch('/api/distributors/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffName.trim(),
          email: staffEmail.toLowerCase().trim(),
          password: staffPassword.trim(),
          role: staffRole,
          distributorId: distId
        })
      });
      const data = await res.json();
      if (data.success) {
        setStaffName('');
        setStaffEmail('');
        setStaffPassword('');
        mutateStaff();
        alert('Staff account registered successfully!');
      } else {
        alert(data.message || 'Failed to register staff.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Delete Staff (Type B)
  const handleDeleteStaff = async (staffEmailAddress) => {
    if (window.confirm(`Delete staff registry account "${staffEmailAddress}"?`)) {
      try {
        const res = await fetch(`/api/distributors/staff?email=${staffEmailAddress}&distributorId=${distId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          mutateStaff();
          alert('Staff account deleted.');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Approve Credentials Request (Type B)
  const handleApproveRequest = async (reqId, gameAccountUsername, gameAccountPassword) => {
    const username = prompt("Enter Game Username:", gameAccountUsername || "");
    const password = prompt("Enter Game Password:", gameAccountPassword || "12345");
    if (!username || !password) return;

    try {
      const res = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId, status: 'COMPLETED', gameAccountUsername: username, gameAccountPassword: password, processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        mutateAllRequests();
        alert('Credentials approved and dispatched!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reject Credentials Request (Type B)
  const handleRejectRequest = async (reqId) => {
    const reason = prompt("Enter Rejection Reason:");
    if (!reason) return;

    try {
      const res = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId, status: 'FAILED', rejectionReason: reason, processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        mutateAllRequests();
        alert('Credentials request rejected.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Complete Coin Allotment / Loading (Type B)
  const handleCompleteAllotment = async (noti) => {
    if (!window.confirm("Complete this coin transaction?")) return;
    try {
      const res = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noti.id, status: 'COMPLETED', processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        mutateAllCoins();
        mutateStats();
        alert('Coin loading processed successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCoinsNotificationDirect = async (notiId, status, read) => {
    try {
      const payload = { id: notiId };
      if (status !== undefined) {
        payload.status = status;
        payload.processedBy = distSession?.name || 'Staff';
      }
      if (read !== undefined) payload.read = read;

      const response = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      if (resData.success) {
        mutateAllCoins();
        mutateStats();
        mutate((key) => typeof key === 'string' && key.startsWith('/api/coins-notifications'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAccountRequestDirect = async (reqId, status, username, password, rejectionReason) => {
    try {
      const payload = {
        id: reqId,
        status: status,
        processedBy: distSession?.name || 'Staff'
      };
      if (username !== undefined) payload.gameAccountUsername = username;
      if (password !== undefined) payload.gameAccountPassword = password;
      if (rejectionReason !== undefined) payload.rejectionReason = rejectionReason;

      const res = await fetch('/api/account-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        mutateAllRequests();
        mutate((key) => typeof key === 'string' && key.startsWith('/api/account-requests'));
        alert('Credentials status updated successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveTransactionDirect = async (txId) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, status: 'SUCCESS', processedBy: distSession?.name || 'Staff' })
      });
      const data = await response.json();
      if (data.success) {
        alert('Transaction approved successfully.');
        mutateStats();
        mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      } else {
        alert(data.message || 'Failed to approve transaction.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFailTransactionDirect = async (txId) => {
    const feedbackMsg = window.prompt('Enter reason for rejection/failure:', 'Payment not received');
    if (feedbackMsg === null) return;

    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, status: 'FAILED', note: feedbackMsg || 'Declined by Admin', processedBy: distSession?.name || 'Staff' })
      });
      const data = await response.json();
      if (data.success) {
        alert('Transaction set to FAILED status.');
        mutateStats();
        mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
      } else {
        alert(data.message || 'Failed to decline transaction.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Invalidate Coin Allotment / Loading (Type B)
  const handleInvalidateAllotment = async (e) => {
    e.preventDefault();
    if (!holdReason.trim()) return;

    try {
      const res = await fetch('/api/coins-notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invalidatingNoti.id, status: 'HOLD', holdNote: holdReason.trim(), processedBy: distSession.name })
      });
      const data = await res.json();
      if (data.success) {
        setInvalidatingNoti(null);
        setHoldReason('');
        mutateAllCoins();
        mutateStats();
        alert('Allotment request invalidated.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy Referral link
  const copyReferralLink = () => {
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    const referralLink = `${domain}/?dist=${distId}`;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!mounted) return null;

  // 1) LOGIN SCREEN
  if (!distSession) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#040509 url("/gold_particles_pattern.png") no-repeat center/cover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(11, 13, 22, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 215, 0, 0.15)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          padding: '2.5rem 2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: 'var(--gold-primary)', fontWeight: '800', fontSize: '1.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Distributor Login
          </h2>
          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '2rem' }}>
            Access your custom panel and referral analytics dashboard.
          </p>

          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.6rem', borderRadius: '8px', fontSize: '0.75rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.4rem' }}></i> {loginError}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Email Address</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <i className="fa-solid fa-envelope" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                <input
                  type="email"
                  placeholder="name@distributor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Access Password</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0b0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <i className="fa-solid fa-lock" style={{ color: 'var(--gold-primary)', marginRight: '0.6rem', fontSize: '0.85rem' }}></i>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.85rem' }}
                  required
                />
              </div>
            </div>

            <button type="submit" style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'LOGGING IN...' : 'LOGIN TO PORTAL ➔'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2) MAIN PORTAL LAYOUT
  const stats = statsData?.stats || {};
  const referredTransactions = statsData?.transactions || [];

  const hasTabAccess = (tabName) => {
    if (!distSession?.isStaff) return true;
    const role = distSession.staffRole || distSession.role;
    if (role === 'coins_admin') {
      return ['overview', 'referred_players', 'operations', 'requests', 'shift_dashboard'].includes(tabName);
    }
    if (role === 'support_admin') {
      return ['overview', 'support'].includes(tabName);
    }
    if (role === 'financial_admin') {
      return ['overview', 'tx_logs', 'gateways', 'ledger'].includes(tabName);
    }
    return false;
  };

  const webPaymentsList = webCommTxData?.transactions || [];
  const totalWebPaid = webPaymentsList.filter(tx => tx.status === 'SUCCESS').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
  const dueWebsiteCommission = Math.max(0, (stats.websiteCommissionEarned || 0) - totalWebPaid);

  return (
    <div className="admin-dashboard-layout" style={{ minHeight: '100vh', background: '#060812', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="admin-sidebar-nav" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <i className="fa-solid fa-crown gold-text" style={{ fontSize: '1.5rem', color: 'var(--gold-primary)' }}></i>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', margin: 0 }}>
              JACKPOT<span className="accent-red" style={{ color: '#ef4444' }}>ROYALS</span>
            </h2>
            <span style={{ fontSize: '0.55rem', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', padding: '0.1rem 0.3rem', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 'bold', display: 'inline-block', marginTop: '0.15rem' }}>
              Distributor Portal
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {hasTabAccess('overview') && (
            <button
              onClick={() => setActiveTab('overview')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'overview' ? 'var(--gold-primary)' : 'none', color: activeTab === 'overview' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
            >
              <i className="fa-solid fa-chart-line" style={{ width: '16px' }}></i>
              Overview & Analytics
            </button>
          )}

          {hasTabAccess('tx_logs') && (
            <button
              onClick={() => setActiveTab('tx_logs')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'tx_logs' ? 'var(--gold-primary)' : 'none', color: activeTab === 'tx_logs' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
            >
              <i className="fa-solid fa-clock-rotate-left" style={{ width: '16px' }}></i>
              Transaction Logs
            </button>
          )}

          {hasTabAccess('referred_players') && (
            <button
              onClick={() => setActiveTab('referred_players')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'referred_players' ? 'var(--gold-primary)' : 'none', color: activeTab === 'referred_players' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
            >
              <i className="fa-solid fa-users" style={{ width: '16px' }}></i>
              Referred Players
            </button>
          )}

          {hasTabAccess('comm_cashout') && (
            <button
              onClick={() => setActiveTab('comm_cashout')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'comm_cashout' ? 'var(--gold-primary)' : 'none', color: activeTab === 'comm_cashout' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
            >
              <i className="fa-solid fa-hand-holding-dollar" style={{ width: '16px' }}></i>
              {distSession.type === 'B' ? 'Website Commission' : 'Commission Cashout'}
            </button>
          )}

          {hasTabAccess('promotions') && (
            <button
              onClick={() => setActiveTab('promotions')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'promotions' ? 'var(--gold-primary)' : 'none', color: activeTab === 'promotions' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
            >
              <i className="fa-solid fa-gift" style={{ width: '16px' }}></i>
              Active Promotions
            </button>
          )}

          {hasTabAccess('guidelines') && (
            <button
              onClick={() => setActiveTab('guidelines')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'guidelines' ? 'var(--gold-primary)' : 'none', color: activeTab === 'guidelines' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
            >
              <i className="fa-solid fa-circle-info" style={{ width: '16px' }}></i>
              Guidelines & Rules
            </button>
          )}

          {distSession.type === 'B' && (
            <>
              {hasTabAccess('gateways') && (
                <button
                  onClick={() => setActiveTab('gateways')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'gateways' ? 'var(--gold-primary)' : 'none', color: activeTab === 'gateways' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
                >
                  <i className="fa-solid fa-wallet" style={{ width: '16px' }}></i>
                  My Gateways
                </button>
              )}

              {hasTabAccess('staff') && (
                <button
                  onClick={() => setActiveTab('staff')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', background: activeTab === 'staff' ? 'var(--gold-primary)' : 'none', color: activeTab === 'staff' ? '#000' : '#fff', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}
                >
                  <i className="fa-solid fa-user-shield" style={{ width: '16px' }}></i>
                  My Staff
                </button>
              )}

              {hasTabAccess('operations') && (
                <button
                  onClick={() => setActiveTab('operations')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: activeTab === 'operations' ? 'var(--gold-primary)' : 'none',
                    color: activeTab === 'operations' ? '#000' : '#fff',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  <i className="fa-solid fa-circle-play" style={{ width: '16px' }}></i>
                  Operations Queue
                  {(referredRequests.length + referredCoins.length) > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.625rem', padding: '0.15rem 0.35rem', borderRadius: '10px' }}>
                      {referredRequests.length + referredCoins.length}
                    </span>
                  )}
                </button>
              )}

              {hasTabAccess('requests') && (
                <button
                  onClick={() => setActiveTab('requests')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: activeTab === 'requests' ? 'var(--gold-primary)' : 'none',
                    color: activeTab === 'requests' ? '#000' : '#fff',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  <i className="fa-solid fa-key" style={{ width: '16px' }}></i>
                  Account Requests
                  {referredRequests.length > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.625rem', padding: '0.15rem 0.35rem', borderRadius: '10px' }}>
                      {referredRequests.length}
                    </span>
                  )}
                </button>
              )}

              {hasTabAccess('shift_dashboard') && (
                <button
                  onClick={() => setActiveTab('shift_dashboard')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: activeTab === 'shift_dashboard' ? 'var(--gold-primary)' : 'none',
                    color: activeTab === 'shift_dashboard' ? '#000' : '#fff',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  <i className="fa-solid fa-business-time" style={{ width: '16px' }}></i>
                  Shift Dashboard
                </button>
              )}

              {hasTabAccess('ledger') && (
                <button
                  onClick={() => setActiveTab('ledger')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: activeTab === 'ledger' ? 'var(--gold-primary)' : 'none',
                    color: activeTab === 'ledger' ? '#000' : '#fff',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  <i className="fa-solid fa-wallet" style={{ width: '16px' }}></i>
                  Financial Ledger
                </button>
              )}

              {hasTabAccess('support') && (
                <button
                  onClick={() => setActiveTab('support')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: activeTab === 'support' ? 'var(--gold-primary)' : 'none',
                    color: activeTab === 'support' ? '#000' : '#fff',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}
                >
                  <i className="fa-solid fa-headset" style={{ width: '16px' }}></i>
                  Live Chat Support
                </button>
              )}
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{distSession.name}</div>
            <div style={{ fontSize: '0.65rem', color: '#888' }}>{distSession.email}</div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
            Log Out Panel
          </button>
        </div>
      </aside>

      {/* PORTAL BODY CONTAINER */}
      <main className="admin-main-workspace" style={{ padding: '2rem', overflowY: 'auto' }}>
        
        {/* TAB: TRANSACTION LOGS */}
        {activeTab === 'tx_logs' && (
          <TxSearchTab 
            onInspectProof={handleInspectProof} 
            adminUser={{
              role: distSession?.role || 'distributor',
              distributorId: distId
            }} 
          />
        )}

        {/* TAB: SUPPORT CHAT */}
        {activeTab === 'support' && (
          <SupportTab
            adminUser={{
              email: distSession?.email || '',
              role: distSession?.role || 'distributor',
              distributorId: distId
            }}
          />
        )}

        {/* TAB: REFERRED PLAYERS */}
        {activeTab === 'referred_players' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>Referred Players</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Detailed list of all players registered through your referral link.</p>

            <div style={{ background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-users gold-text"></i> My Players ({players.length})
                </h3>
                <button
                  onClick={() => setRegModalOpen(true)}
                  style={{
                    background: 'var(--gold-primary)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <i className="fa-solid fa-user-plus"></i> Register Player
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>NAME</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>EMAIL</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>COINS</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>STATUS</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>No players registered through your referral link yet.</td>
                      </tr>
                    ) : (
                      players.map(p => (
                        <tr key={p.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{p.email}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>{(p.coins || 0).toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => { setResetEmail(p.email); setResetModalOpen(true); }}
                              style={{
                                background: 'rgba(255,215,0,0.1)',
                                border: '1px solid rgba(255,215,0,0.3)',
                                color: 'var(--gold-primary)',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.65rem',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                              title="Reset Password"
                            >
                              <i className="fa-solid fa-key"></i> Reset PW
                            </button>
                            <button
                              onClick={() => handleDeletePlayer(p.email)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.65rem',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                              title="Delete Player Account"
                            >
                              <i className="fa-solid fa-trash"></i> Delete
                            </button>
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

        {/* TAB: COMMISSION CASHOUT */}
        {activeTab === 'comm_cashout' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>
              {distSession.type === 'B' ? 'Website Commission & Payments' : 'Commission & Cashouts'}
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>
              {distSession.type === 'B' 
                ? 'Submit screenshot proof of website commission payments to keep your account active.'
                : 'Request payouts for your referral earnings and track processing history.'}
            </p>

            {/* DATE LOOKUP CALENDAR WIDGET */}
            <div className="stat-card" style={{ borderLeft: '4px solid var(--gold-primary)', background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', maxWidth: '600px', marginBottom: '1.5rem' }}>
              <div className="stat-icon-wrapper gold-bg" style={{ minWidth: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', fontSize: '1.25rem' }}>
                <i className="fa-solid fa-calendar-days"></i>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>
                  HISTORICAL RECORDS (1 YR MAX)
                </span>
                <input 
                  type="date"
                  value={commLookupDate}
                  onChange={(e) => setCommLookupDate(e.target.value)}
                  style={{
                    background: 'rgba(7,9,18,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    outline: 'none',
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                {commLookupLoading ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.15rem' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)' }}></i> Loading date stats...
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: '#2ecc71', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📥 In: ${(commLookupStats.deposits || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📤 Out: ${(commLookupStats.withdrawals || 0).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                        My Comm ({commLookupStats.commissionRate || 0}%): ${(commLookupStats.commission || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#ff4d6d', fontWeight: 'bold' }}>
                        Web Comm ({commLookupStats.websiteCommissionRate || 0}%): ${(commLookupStats.websiteCommission || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              if (distSession.type === 'B') {
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem' }}>
                    <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>Pay Website Commission</h3>
                      <p style={{ fontSize: '0.65rem', color: '#888', marginBottom: '1rem' }}>
                        Due Commission Balance: <strong style={{ color: '#ff4d6d' }}>${dueWebsiteCommission.toFixed(2)}</strong>
                      </p>

                      <div style={{ background: '#040509', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', marginBottom: '1.25rem', fontSize: '0.7rem' }}>
                        <span style={{ color: '#888', display: 'block', marginBottom: '0.2rem' }}>SEND USDT (TRC20) TO:</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ color: 'var(--gold-primary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {usdtAddress || 'No address configured by Admin'}
                          </strong>
                          {usdtAddress && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(usdtAddress); alert('USDT Address copied!'); }}
                              style={{ background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '4px', padding: '0.15rem 0.4rem', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                            >
                              COPY
                            </button>
                          )}
                        </div>
                      </div>

                      {usdtQrCode && (
                        <div style={{ textAlign: 'center', marginBottom: '1.25rem', background: '#040509', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                          <span style={{ color: '#888', display: 'block', fontSize: '0.65rem', marginBottom: '0.4rem' }}>TRC20 PAYMENT QR CODE:</span>
                          <img
                            src={usdtQrCode}
                            alt="TRC20 QR Code"
                            onClick={() => handleInspectProof(usdtQrCode)}
                            style={{ width: '140px', height: '140px', objectFit: 'contain', margin: '0 auto', display: 'block', cursor: 'pointer', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}
                            title="Click to view full-size QR Code"
                          />
                        </div>
                      )}

                      <form onSubmit={handleRequestWebPayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem' }}>Payment Amount ($)</label>
                          <input
                            type="number"
                            placeholder="e.g. 50.00"
                            step="0.01"
                            value={webAmount}
                            onChange={(e) => setWebAmount(e.target.value)}
                            style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                            required
                          />
                        </div>
                        
                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem' }}>TxID / Hash / Tag</label>
                          <input
                            type="text"
                            placeholder="USDT Tx Hash or reference code"
                            value={webCode}
                            onChange={(e) => setWebCode(e.target.value)}
                            style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                            required
                          />
                        </div>

                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem' }}>Upload Payment Screenshot</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleWebScreenshotChange}
                            style={{ width: '100%', color: '#888', fontSize: '0.7rem', padding: '0.2rem 0' }}
                            required
                          />
                        </div>

                        {webMsg && (
                          <p style={{ fontSize: '0.7rem', color: webMsg.includes('success') ? '#2ecc71' : '#ef4444', margin: '0.2rem 0' }}>{webMsg}</p>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmittingWeb}
                          style={{ width: '100%', padding: '0.6rem', background: '#ff4d6d', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', opacity: isSubmittingWeb ? 0.5 : 1 }}
                        >
                          {isSubmittingWeb ? 'Submitting proof...' : 'Submit Payment Proof'}
                        </button>
                      </form>
                    </div>

                    <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Website Commission Payment logs</h3>
                      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                              <th style={{ padding: '0.5rem' }}>DATE</th>
                              <th style={{ padding: '0.5rem' }}>GATEWAY</th>
                              <th style={{ padding: '0.5rem' }}>HASH/TAG</th>
                              <th style={{ padding: '0.5rem' }}>AMOUNT</th>
                              <th style={{ padding: '0.5rem' }}>STATUS</th>
                              <th style={{ padding: '0.5rem' }}>RECEIPT / NOTES</th>
                            </tr>
                          </thead>
                          <tbody>
                            {webPaymentsList.length === 0 ? (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No website commission payment history.</td>
                              </tr>
                            ) : (
                              webPaymentsList.map(tx => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>{tx.date}</td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>{tx.gateway}</td>
                                  <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace' }}>{tx.code}</td>
                                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: '#ff4d6d' }}>${parseFloat(tx.amount || 0).toFixed(2)}</td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>
                                    <span style={{
                                      padding: '0.15rem 0.35rem',
                                      borderRadius: '4px',
                                      fontSize: '0.6rem',
                                      fontWeight: 'bold',
                                      background: tx.status === 'SUCCESS' ? 'rgba(46,204,113,0.1)' : tx.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(241,196,15,0.1)',
                                      color: tx.status === 'SUCCESS' ? '#2ecc71' : tx.status === 'FAILED' ? '#ef4444' : '#f1c40f'
                                    }}>{tx.status}</span>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>
                                    {tx.payoutProof ? (
                                      <button
                                        onClick={() => handleInspectProof(null, tx.id)}
                                        style={{ border: 'none', background: '#3498db', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                                      >
                                        <i className="fa-solid fa-receipt"></i> View Receipt
                                      </button>
                                    ) : (
                                      <span style={{ color: '#555' }}>No receipt</span>
                                    )}
                                    {tx.note && (
                                      <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: '0.25rem', maxWidth: '200px', whiteSpace: 'normal' }}>
                                        Note: {tx.note}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const commWithdrawals = commTxData?.transactions || [];
                const totalWithdrawn = commWithdrawals.filter(tx => tx.status === 'SUCCESS' || tx.status === 'PENDING').reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
                const availableCommission = Math.max(0, (stats.commissionEarned || 0) - totalWithdrawn);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
                    <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>Request Commission</h3>
                      <p style={{ fontSize: '0.65rem', color: '#888', marginBottom: '1.25rem' }}>
                        Available Balance: <strong style={{ color: 'var(--gold-primary)' }}>${availableCommission.toFixed(2)}</strong>
                      </p>
                      <form onSubmit={handleRequestCommWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem' }}>Amount ($)</label>
                          <input
                            type="number"
                            placeholder="e.g. 50.00"
                            step="0.01"
                            value={commAmount}
                            onChange={(e) => setCommAmount(e.target.value)}
                            max={availableCommission}
                            style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                            required
                          />
                        </div>
                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem' }}>Gateway / Method</label>
                          <select
                            value={commGateway}
                            onChange={(e) => setCommGateway(e.target.value)}
                            style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                          >
                            <option value="Chime">Chime</option>
                            <option value="Zelle">Zelle</option>
                            <option value="CashApp">CashApp</option>
                            <option value="PayPal">PayPal</option>
                            <option value="Venmo">Venmo</option>
                            <option value="USDT">USDT (Tether)</option>
                          </select>
                        </div>
                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem' }}>Payment Address / Tag</label>
                          <input
                            type="text"
                            placeholder="e.g. $cashtag, email, or TRC20 wallet"
                            value={commCode}
                            onChange={(e) => setCommCode(e.target.value)}
                            style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                            required
                          />
                        </div>
                        {commMsg && (
                          <p style={{ fontSize: '0.7rem', color: commMsg.includes('success') ? '#2ecc71' : '#ef4444', margin: '0.2rem 0' }}>{commMsg}</p>
                        )}
                        <button
                          type="submit"
                          disabled={isSubmittingComm || availableCommission <= 0}
                          style={{ width: '100%', padding: '0.6rem', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', opacity: (isSubmittingComm || availableCommission <= 0) ? 0.5 : 1 }}
                        >
                          {isSubmittingComm ? 'Submitting...' : 'Request Cashout ➔'}
                        </button>
                      </form>
                    </div>

                    <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Commission Withdrawal Logs</h3>
                      <div style={{ maxHeight: '310px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                              <th style={{ padding: '0.5rem' }}>DATE</th>
                              <th style={{ padding: '0.5rem' }}>GATEWAY</th>
                              <th style={{ padding: '0.5rem' }}>ADDRESS</th>
                              <th style={{ padding: '0.5rem' }}>AMOUNT</th>
                              <th style={{ padding: '0.5rem' }}>STATUS</th>
                              <th style={{ padding: '0.5rem' }}>RECEIPT / NOTES</th>
                            </tr>
                          </thead>
                          <tbody>
                            {commWithdrawals.length === 0 ? (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No commission withdrawals requested.</td>
                              </tr>
                            ) : (
                              commWithdrawals.map(tx => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>{tx.date}</td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>{tx.gateway}</td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>{tx.code}</td>
                                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--gold-primary)' }}>
                                    {tx.status === 'SUCCESS' && tx.payoutHold > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.7rem' }}>
                                        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>${parseFloat(tx.amount || 0).toFixed(2)}</span>
                                        <span style={{ color: '#2ecc71' }}>Paid: ${parseFloat(tx.payoutSent || 0).toFixed(2)}</span>
                                        <span style={{ color: '#f39c12' }}>Held: ${parseFloat(tx.payoutHold || 0).toFixed(2)}</span>
                                      </div>
                                    ) : (
                                      `$${parseFloat(tx.amount || 0).toFixed(2)}`
                                    )}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>
                                    <span style={{
                                      padding: '0.15rem 0.35rem',
                                      borderRadius: '4px',
                                      fontSize: '0.6rem',
                                      fontWeight: 'bold',
                                      background: tx.status === 'SUCCESS' ? 'rgba(46,204,113,0.1)' : tx.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(241,196,15,0.1)',
                                      color: tx.status === 'SUCCESS' ? '#2ecc71' : tx.status === 'FAILED' ? '#ef4444' : '#f1c40f'
                                    }}>{tx.status}</span>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.5rem' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                                      {tx.status === 'SUCCESS' && tx.payoutHold > 0 && (
                                        tx.remainderRequested ? (
                                          <span style={{ fontSize: '0.6rem', color: 'var(--gold-primary)', fontWeight: 'bold', background: 'rgba(255,215,0,0.1)', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                                            [Remainder Requested]
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleClaimDistributorRemainder(tx)}
                                            style={{ border: '1px solid var(--gold-primary)', background: 'rgba(255,215,0,0.08)', color: 'var(--gold-primary)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 'bold' }}
                                          >
                                            Claim Remainder (${parseFloat(tx.payoutHold).toFixed(2)})
                                          </button>
                                        )
                                      )}
                                      {tx.payoutProof ? (
                                        <button
                                          onClick={() => handleInspectProof(null, tx.id)}
                                          style={{ border: 'none', background: '#3498db', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                                        >
                                          <i className="fa-solid fa-receipt"></i> View Receipt
                                        </button>
                                      ) : (
                                        <span style={{ color: '#555', fontSize: '0.65rem' }}>No receipt</span>
                                      )}
                                    </div>
                                    {tx.note && (
                                      <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: '0.25rem', maxWidth: '200px', whiteSpace: 'normal' }}>
                                        Note: {tx.note}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        )}

        {/* TAB: ACTIVE PROMOTIONS */}
        {activeTab === 'promotions' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>Active Promotions</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Share these active codes and welcome bonuses with players to drive referrals.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-gift gold-text"></i> $3 Signup Freeplay Code
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#040509', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.15)', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.6rem', color: '#888', display: 'block', textTransform: 'uppercase' }}>Promo Code</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--gold-primary)', letterSpacing: '0.5px' }}>SIGNUP-FREE3</strong>
                  </div>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE</span>
                </div>
                <ul style={{ fontSize: '0.75rem', color: '#aaa', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <li>Players get $3.00 instantly upon registration and verified email check.</li>
                  <li>Max cashout on wins originating from freeplay is strictly capped at $30.00.</li>
                  <li>No duplicate accounts or fake emails are permitted.</li>
                </ul>
              </div>

              <div style={{ background: '#0b0d16', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-percent gold-text"></i> 100% Signup Match Bonus
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#040509', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.6rem', color: '#888', display: 'block', textTransform: 'uppercase' }}>Promo Offer</span>
                    <strong style={{ fontSize: '1.1rem', color: '#2ecc71', letterSpacing: '0.5px' }}>100% FIRST DEPOSIT MATCH</strong>
                  </div>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>AUTOMATIC</span>
                </div>
                <ul style={{ fontSize: '0.75rem', color: '#aaa', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <li>Applied automatically to a player's first wallet deposit load.</li>
                  <li>Match bonus coin value goes directly into their game balance.</li>
                  <li>Drives massive engagement and recurring loads!</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB: GUIDELINES & RULES */}
        {activeTab === 'guidelines' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#fff' }}>Guidelines & Platform Rules</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Frequently asked questions, deposit/withdrawal limits, and commission structures.</p>

            <div style={{ background: '#0b0d16', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '0.4rem' }}>1. What are the deposit and withdrawal limits?</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', lineHeight: '1.4' }}>
                  To maintain system health, we enforce a minimum deposit threshold of <strong>$5.00</strong> and a minimum withdrawal threshold of <strong>$25.00</strong> per transaction for all standard user requests.
                </p>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '0.4rem' }}>2. How is my distributor commission calculated?</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', lineHeight: '1.4' }}>
                  Your commission is based on your unique rate (e.g. {stats.commissionRate || 10}%) applied directly to all successful deposits completed by your referred players. Earnings are calculated in real-time.
                </p>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '0.4rem' }}>3. How can I withdraw my earned commission?</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', lineHeight: '1.4' }}>
                  Navigate to the <strong>"Commission Cashout"</strong> tab, input your desired cashout value, choose a gateway (such as Chime or Zelle), and type your address/tag. The Super Admin ledger team will process and verify your payout.
                </p>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '0.4rem' }}>4. What is the maximum cashout rule for Freeplay winnings?</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', lineHeight: '1.4' }}>
                  If a player signs up using a freeplay promo code and wins, they can request a withdrawal. The maximum payout allowed on freeplay wins is capped at exactly <strong>$30.00</strong>. Winnings above this cap are discarded and cannot be claimed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>Overview & Analytics</h1>
                <p style={{ fontSize: '0.75rem', color: '#888' }}>Track your referred players, deposits, and commission summaries.</p>
              </div>

              {/* REFERRAL LINK COPY CARD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0b0d16', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>Referral Link:</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontFamily: 'monospace' }}>?dist={distId}</span>
                <button onClick={copyReferralLink} style={{ background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  {copiedLink ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>

            {/* METRICS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Referred Players</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#fff', marginTop: '0.25rem' }}>{stats.playersCount || 0}</div>
              </div>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Deposits</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#2ecc71', marginTop: '0.25rem' }}>${(stats.totalDeposits || 0).toFixed(2)}</div>
              </div>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Withdrawals</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ef4444', marginTop: '0.25rem' }}>${(stats.totalWithdrawals || 0).toFixed(2)}</div>
              </div>
              {distSession.type === 'B' && !distSession.isStaff ? (
                <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Website Commission ({stats.websiteCommissionRate || 0}%)</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ff4d6d', marginTop: '0.25rem' }}>${dueWebsiteCommission.toFixed(2)}</div>
                </div>
              ) : (
                <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>My Commission ({stats.commissionRate || 0}%)</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--gold-primary)', marginTop: '0.25rem' }}>${(stats.commissionEarned || 0).toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* TWO COLUMN GRID FOR PLAYERS & LEDGER */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
              {/* PLAYERS LIST */}
              <div style={{ background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-users gold-text"></i> Referred Players ({players.length})
                </h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {players.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '0.75rem', padding: '2rem' }}>No players registered.</div>
                  ) : (
                    players.map(p => (
                      <div key={p.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#040509', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{p.name}</div>
                          <div style={{ fontSize: '0.6rem', color: '#666' }}>{p.email}</div>
                        </div>
                        <span style={{ fontSize: '0.6rem', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TRANSACTIONS HIST */}
              <div style={{ background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fa-solid fa-file-invoice-dollar gold-text"></i> Referred Players Transactions History
                </h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                        <th style={{ padding: '0.5rem' }}>PLAYER</th>
                        <th style={{ padding: '0.5rem' }}>TYPE</th>
                        <th style={{ padding: '0.5rem' }}>AMOUNT</th>
                        <th style={{ padding: '0.5rem' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No transactions recorded.</td>
                        </tr>
                      ) : (
                        referredTransactions.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.6rem 0.5rem' }}>{tx.userEmail}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{ color: tx.type === 'DEPOSIT' ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>{tx.type}</span>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold' }}>${parseFloat(tx.amount || 0).toFixed(2)}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{
                                padding: '0.15rem 0.35rem',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                fontWeight: 'bold',
                                background: tx.status === 'SUCCESS' ? 'rgba(46,204,113,0.1)' : tx.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(241,196,15,0.1)',
                                color: tx.status === 'SUCCESS' ? '#2ecc71' : tx.status === 'FAILED' ? '#ef4444' : '#f1c40f'
                              }}>{tx.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Game coins pool status (Only for Type B distributors) */}
            {distSession.type === 'B' && (
              <section className="admin-section-card" style={{ marginTop: '2rem', background: '#0b0d16', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="section-card-header" style={{ marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <i className="fa-solid fa-coins gold-text"></i> Game Coins Remaining Pool
                    </h3>
                    <span className="game-tap-tip" style={{ fontSize: '0.65rem', color: '#888' }}>Allotment reserves of active game platforms</span>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                        <th style={{ padding: '0.5rem' }}>Game Title</th>
                        <th style={{ padding: '0.5rem' }}>Game Badge</th>
                        <th style={{ padding: '0.5rem' }}>Remaining Coins Balance</th>
                        <th style={{ padding: '0.5rem' }}>Used Coins</th>
                        <th style={{ padding: '0.5rem' }}>Fulfillment Portal</th>
                        <th style={{ padding: '0.5rem' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!gamesData?.games || gamesData.games.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No games loaded in library.</td>
                        </tr>
                      ) : (
                        gamesData.games.map((game) => (
                          <tr key={game.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.6rem 0.5rem' }}><strong>{game.title}</strong></td>
                            <td style={{ padding: '0.6rem 0.5rem' }}><span className={`admin-badge-preview b-${game.badge}`} style={{ textTransform: 'uppercase', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>{game.badge}</span></td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <strong style={{ fontSize: '0.85rem', color: (game.availableCoins || 0) < 5000 ? '#ef4444' : '#ffd700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-coins" style={{ color: '#ffd700' }}></i> {game.availableCoins || 0} Coins
                              </strong>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <strong style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-circle-dollar-to-slot" style={{ color: '#10b981' }}></i> {game.usedCoins || 0} Coins
                              </strong>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <a href={game.openPanelLink || game.link} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.75rem', textDecoration: 'none', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                                Open Panel &rarr;
                              </a>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <button
                                onClick={() => {
                                  setSelectedPoolGame(game);
                                  setUpdatePoolCoins(game.availableCoins || 0);
                                  setUpdatePoolLink(game.openPanelLink || '');
                                  setPoolUpdateModalOpen(true);
                                }}
                                className="action-row-btn btn-edit"
                                style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid var(--gold-primary)', color: 'var(--gold-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                                title="Update Remaining Pool & Link"
                              >
                                <i className="fa-solid fa-pen-to-square"></i> Update Pool
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: GATEWAYS MANAGEMENT (TYPE B) */}
        {activeTab === 'gateways' && distSession.type === 'B' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>My Payment Gateways</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Add or delete payment methods visible to your referred players.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Add Gateway</h3>
                <form onSubmit={handleAddGateway}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Gateway Name</label>
                    <input type="text" placeholder="Cash App, Venmo..." value={gwName} onChange={(e) => setGwName(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Subtitle</label>
                    <input type="text" placeholder="Instantly Loaded sweepstakes..." value={gwSubtitle} onChange={(e) => setGwSubtitle(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Payment Tag/Handle</label>
                    <input type="text" placeholder="$username" value={gwTag} onChange={(e) => setGwTag(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Phone Number (Optional)</label>
                    <input type="text" placeholder="+1234..." value={gwPhone} onChange={(e) => setGwPhone(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>QR Code Image (Optional)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (file.size > 3 * 1024 * 1024) {
                              alert('Image is too large. Please select a file smaller than 3MB.');
                              e.target.value = '';
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setGwQr(event.target.result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        style={{ display: 'none' }}
                        id="dist-gw-qr-file"
                      />
                      <label 
                        htmlFor="dist-gw-qr-file"
                        style={{
                          background: '#040509',
                          border: '1px dashed rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          padding: '0.6rem',
                          color: 'var(--gold-primary)',
                          fontSize: '0.75rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'block'
                        }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '0.4rem' }}></i>
                        {gwQr ? 'CHANGE QR IMAGE' : 'CHOOSE QR IMAGE'}
                      </label>
                      {gwQr && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <img src={gwQr} alt="QR Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.625rem', color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>QR Image Selected</span>
                          <button 
                            type="button" 
                            onClick={() => setGwQr('')}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Theme Color</label>
                    <select value={gwTheme} onChange={(e) => setGwTheme(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }}>
                      <option value="cashapp">Green (Cash App)</option>
                      <option value="venmo">Blue (Venmo)</option>
                      <option value="chime">Lime (Chime)</option>
                      <option value="zelle">Purple (Zelle)</option>
                      <option value="apple">Dark/White (Apple Pay)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={gwWithdraw} onChange={(e) => setGwWithdraw(e.target.checked)} style={{ cursor: 'pointer' }} />
                    <label style={{ fontSize: '0.7rem', cursor: 'pointer' }}>Active for Withdrawals</label>
                  </div>

                  <button type="submit" style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '0.5rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }} disabled={isSubmittingGateway}>
                    {isSubmittingGateway ? 'CREATING...' : 'CREATE GATEWAY'}
                  </button>
                </form>
              </div>

              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>My Gateways Catalog</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  {(!gatewaysData?.gateways || gatewaysData.gateways.length === 0) ? (
                    <div style={{ colSpan: 2, color: '#666', fontSize: '0.75rem', padding: '1.5rem', textAlign: 'center', width: '100%' }}>No gateways registered yet.</div>
                  ) : (
                    gatewaysData.gateways.map(g => (
                      <div key={g.id} style={{ border: '1px solid rgba(255,255,255,0.05)', background: '#040509', padding: '1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>{g.name}</strong>
                          <div style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'monospace', marginTop: '0.15rem' }}>{g.tag}</div>
                          <div style={{ fontSize: '0.625rem', color: '#666', marginTop: '0.25rem' }}>Withdrawals: {g.isWithdrawActive ? 'ACTIVE' : 'INACTIVE'}</div>
                        </div>
                        <button onClick={() => handleDeleteGateway(g.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', border: 'none', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.65rem', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STAFF REGISTRY (TYPE B) */}
        {activeTab === 'staff' && distSession.type === 'B' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>My Staff Management</h1>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2rem' }}>Hire staff managers to process credentials and load coins allotments.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Register Staff</h3>
                <form onSubmit={handleAddStaff}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Full Name</label>
                    <input type="text" placeholder="e.g. Coins Handler" value={staffName} onChange={(e) => setStaffName(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Email</label>
                    <input type="email" placeholder="staff@distributor.com" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Password</label>
                    <input type="text" placeholder="StaffPassword123" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }} required />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.65rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Authority Role</label>
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} style={{ width: '100%', background: '#040509', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: '#fff', fontSize: '0.75rem', outline: 'none' }}>
                      <option value="coins_admin">Coins Admin (Load allotments)</option>
                      <option value="support_admin">Support Admin (Live Chat support)</option>
                      <option value="financial_admin">Financial Admin (Audit ledger)</option>
                    </select>
                  </div>

                  <button type="submit" style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '0.5rem', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }} disabled={isSubmittingStaff}>
                    {isSubmittingStaff ? 'REGISTERING...' : 'REGISTER STAFF'}
                  </button>
                </form>
              </div>

              <div style={{ background: '#0b0d16', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 'bold' }}>Administrative Staff Registry</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                      <th style={{ padding: '0.5rem' }}>Name</th>
                      <th style={{ padding: '0.5rem' }}>Email</th>
                      <th style={{ padding: '0.5rem' }}>Role Permission</th>
                      <th style={{ padding: '0.5rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!staffData?.staff || staffData.staff.length === 0) ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No staff members registered.</td>
                      </tr>
                    ) : (
                      staffData.staff.map(s => (
                        <tr key={s.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.6rem 0.5rem' }}><strong>{s.name}</strong></td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>{s.email}</td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <span className="admin-badge-preview b-ready" style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}>
                              {s.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <button onClick={() => handleDeleteStaff(s.email)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', border: 'none', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.65rem', cursor: 'pointer' }}>
                              Remove
                            </button>
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

        {/* TAB 4: OPERATIONS QUEUE (TYPE B) - Render CoinsAllotmentTab */}
        {activeTab === 'operations' && distSession.type === 'B' && (
          <CoinsAllotmentTab
            onUpdateCoinsNotification={handleUpdateCoinsNotificationDirect}
            completedActionIds={{}}
            processingIds={{}}
            wrapAction={(id, fn) => fn}
            adminUser={{
              role: distSession.staffRole || distSession.role,
              distributorId: distId,
              email: distSession.email
            }}
          />
        )}

        {/* TAB: ACCOUNT CREDENTIALS REQUESTS - Render RequestsTab */}
        {activeTab === 'requests' && distSession.type === 'B' && (
          <RequestsTab
            onApproveRequest={handleUpdateAccountRequestDirect}
            completedActionIds={{}}
            processingIds={{}}
            wrapAction={(id, fn) => fn}
            adminUser={{
              role: distSession.staffRole || distSession.role,
              distributorId: distId,
              email: distSession.email
            }}
          />
        )}

        {/* TAB: SHIFT DASHBOARD */}
        {activeTab === 'shift_dashboard' && distSession.type === 'B' && (
          <ShiftDashboardTab
            adminUser={{
              role: distSession.staffRole || distSession.role,
              distributorId: distId,
              email: distSession.email
            }}
          />
        )}

        {/* TAB: FINANCIAL LEDGER - Render LedgerTab */}
        {activeTab === 'ledger' && distSession.type === 'B' && (
          <LedgerTab
            onInspectProof={handleInspectProof}
            onApproveTransaction={handleApproveTransactionDirect}
            onFailTransaction={handleFailTransactionDirect}
            completedActionIds={{}}
            processingIds={{}}
            wrapAction={(id, fn) => fn}
            adminUser={{
              role: distSession.staffRole || distSession.role,
              distributorId: distId,
              email: distSession.email
            }}
          />
        )}

      {proofModalUrl && (
        <div 
          onClick={() => setProofModalUrl('')}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
            {proofModalUrl === 'LOADING' ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#0e111d', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
                <p style={{ color: '#fff', fontSize: '0.8rem', margin: 0 }}>Fetching proof image from secure server...</p>
              </div>
            ) : (
              <img src={proofModalUrl} alt="Deposit Proof" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', border: '2px solid var(--gold-primary)' }} />
            )}
            <button 
              onClick={() => setProofModalUrl('')}
              style={{
                position: 'absolute',
                top: '-2rem',
                right: 0,
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER PLAYER */}
      {regModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0b0d16', padding: '2rem', borderRadius: '12px', border: '1px solid var(--gold-primary)', width: '380px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}><i className="fa-solid fa-user-plus gold-text"></i> Register New Player</h3>
              <button onClick={() => setRegModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleRegSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.7rem' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                  required
                />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '0.7rem' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="player@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                  required
                />
              </div>
              <div className="input-group">
                <label style={{ fontSize: '0.7rem' }}>Initial Password</label>
                <input
                  type="text"
                  placeholder="e.g. Pass123"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isRegSubmitting}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', opacity: isRegSubmitting ? 0.5 : 1 }}
              >
                {isRegSubmitting ? 'Registering...' : 'Register Player'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0b0d16', padding: '2rem', borderRadius: '12px', border: '1px solid var(--gold-primary)', width: '380px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}><i className="fa-solid fa-key gold-text"></i> Reset Player Password</h3>
              <button onClick={() => setResetModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                Resetting password for: <strong style={{ color: '#fff' }}>{resetEmail}</strong>
              </div>
              <div className="input-group">
                <label style={{ fontSize: '0.7rem' }}>New Password</label>
                <input
                  type="text"
                  placeholder="Enter new password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  style={{ width: '100%', background: '#070912', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isResetSubmitting}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', opacity: isResetSubmitting ? 0.5 : 1 }}
              >
                {isResetSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE POOL */}
      {poolUpdateModalOpen && selectedPoolGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
          <div style={{ background: '#0a0d16', border: '1.5px solid var(--gold-primary)', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', position: 'relative', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-pen-to-square text-gold" style={{ color: 'var(--gold-primary)' }}></i>
                Update {selectedPoolGame.title} Pool
              </h3>
              <button onClick={() => setPoolUpdateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', padding: 0 }}>&times;</button>
            </div>
            <form onSubmit={handlePoolUpdateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Available/Remaining Coins</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-coins input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                  <input
                    type="number"
                    value={updatePoolCoins}
                    onChange={(e) => setUpdatePoolCoins(e.target.value)}
                    placeholder="Enter coin balance"
                    style={{ fontSize: '0.75rem' }}
                    required
                  />
                </div>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Fulfillment Portal URL</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-link input-icon" style={{ color: 'var(--gold-primary)' }}></i>
                  <input
                    type="url"
                    value={updatePoolLink}
                    onChange={(e) => setUpdatePoolLink(e.target.value)}
                    placeholder="https://example.com/panel"
                    style={{ fontSize: '0.75rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', margin: 0, flex: 1 }} disabled={isUpdatingPool}>
                  {isUpdatingPool ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button type="button" className="action-row-btn" onClick={() => setPoolUpdateModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', margin: 0 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      </main>

    </div>
  );
}
