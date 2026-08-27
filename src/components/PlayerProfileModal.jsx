'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import PanelModalBackdrop from './PanelModalBackdrop';
import { calculatePlayerLevel, LEVEL_TIERS } from '../lib/levelTiers';

export default function PlayerProfileModal({
  isOpen,
  onClose,
  currentUser,
  currentUserEmail,
  gameAccounts = [],
  transactions = [],
  onUpdateUser,
  showToast
}) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedAccountIndex, setCopiedAccountIndex] = useState(null);
  const [localTotalDeposit, setLocalTotalDeposit] = useState(0);
  const [localGameAccounts, setLocalGameAccounts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [levelRewardsData, setLevelRewardsData] = useState(null);
  const [selectedRewardGame, setSelectedRewardGame] = useState('');
  const [claimingReward, setClaimingReward] = useState(false);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState('');
  const [showAllAccounts, setShowAllAccounts] = useState(false);

  // Fetch Level Rewards data
  const fetchLevelRewards = (email) => {
    if (!email) return;
    fetch(`/api/user/level-rewards?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setLevelRewardsData(data);
          if (data.gameAccounts?.length > 0 && !selectedRewardGame) {
            setSelectedRewardGame(data.gameAccounts[0].gameTitle);
          }
        }
      })
      .catch((err) => console.error('Failed to fetch level rewards:', err));
  };

  // Compute total deposit from transactions prop or server
  useEffect(() => {
    if (!isOpen) return;

    setFullName(currentUser?.name || '');
    setPhoneNumber(currentUser?.phone || '');
    setNewPassword('');
    setConfirmPassword('');
    setClaimSuccessMessage('');

    const email = currentUserEmail?.toLowerCase().trim();
    if (email) {
      setLoadingProfile(true);
      fetch(`/api/user/profile?email=${encodeURIComponent(email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.success) {
            if (data.user?.name) setFullName(data.user.name);
            if (data.user?.phone) setPhoneNumber(data.user.phone);
            setLocalTotalDeposit(data.totalDeposit || 0);
            if (Array.isArray(data.gameAccounts)) {
              setLocalGameAccounts(data.gameAccounts);
              if (data.gameAccounts.length > 0 && !selectedRewardGame) {
                setSelectedRewardGame(data.gameAccounts[0].gameTitle);
              }
            }
          }
        })
        .catch((err) => console.error('Failed to fetch detailed profile:', err))
        .finally(() => setLoadingProfile(false));

      fetchLevelRewards(email);
    }
  }, [isOpen, currentUser, currentUserEmail]);

  // Fallback calculation from transactions array if server fetch hasn't loaded yet
  const calculatedDeposit = React.useMemo(() => {
    if (localTotalDeposit > 0) return localTotalDeposit;
    if (!transactions || !currentUserEmail) return 0;
    const email = currentUserEmail.toLowerCase().trim();
    return transactions
      .filter((t) => (t.userEmail || '').toLowerCase().trim() === email && String(t.type).toUpperCase() === 'DEPOSIT' && String(t.status).toUpperCase() === 'SUCCESS')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [localTotalDeposit, transactions, currentUserEmail]);

  const levelInfo = React.useMemo(() => calculatePlayerLevel(calculatedDeposit), [calculatedDeposit]);

  const userGameAccounts = React.useMemo(() => {
    if (localGameAccounts.length > 0) return localGameAccounts;
    if (!gameAccounts || !currentUserEmail) return [];
    const email = currentUserEmail.toLowerCase().trim();
    return gameAccounts.filter((ga) => (ga.userEmail || '').toLowerCase().trim() === email);
  }, [localGameAccounts, gameAccounts, currentUserEmail]);

  if (!isOpen) return null;

  const handleCopyUsername = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedAccountIndex(index);
    if (showToast) showToast(`Copied account username: ${text}`, 'success');
    setTimeout(() => setCopiedAccountIndex(null), 2000);
  };

  const handleClaimLevelReward = async () => {
    if (!selectedRewardGame) {
      if (showToast) showToast('Please select a game account to receive your Level Reward.', 'error');
      else alert('Please select a game account to receive your Level Reward.');
      return;
    }

    setClaimingReward(true);
    try {
      const res = await fetch('/api/user/level-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUserEmail,
          gameTitle: selectedRewardGame
        })
      });

      const data = await res.json();
      if (data?.success) {
        setClaimSuccessMessage(data.message || 'Level Reward claimed successfully! Coins loading is in progress.');
        if (showToast) showToast(data.message || 'Level Reward claimed successfully!', 'success');
        fetchLevelRewards(currentUserEmail);
      } else {
        if (showToast) showToast(data?.message || 'Failed to claim Level Reward.', 'error');
        else alert(data?.message || 'Failed to claim Level Reward.');
      }
    } catch (err) {
      console.error('Error claiming Level Reward:', err);
      if (showToast) showToast('Network error while claiming reward.', 'error');
      else alert('Network error while claiming reward.');
    } finally {
      setClaimingReward(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      if (showToast) showToast('New passwords do not match.', 'error');
      else alert('New passwords do not match.');
      return;
    }

    if (newPassword && newPassword.length < 4) {
      if (showToast) showToast('Password must be at least 4 characters long.', 'error');
      else alert('Password must be at least 4 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUserEmail,
          name: fullName.trim(),
          phone: phoneNumber.trim(),
          newPassword: newPassword.trim() || undefined
        })
      });

      const data = await res.json();
      if (data?.success) {
        if (showToast) showToast('Profile changes saved successfully!', 'success');
        if (onUpdateUser && data.user) {
          onUpdateUser(data.user);
        }
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        if (showToast) showToast(data?.message || 'Failed to update profile.', 'error');
        else alert(data?.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      if (showToast) showToast('Network error while saving profile.', 'error');
      else alert('Network error while saving profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // User avatar initial
  const userInitial = (fullName || currentUser?.name || currentUserEmail || 'P').charAt(0).toUpperCase();

  return (
    <PanelModalBackdrop isOpen={isOpen} onClose={onClose}>
      <div
        className="profile-modal-container"
        style={{
          background: 'linear-gradient(185deg, #0d0f19 0%, #06070d 100%)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 30px rgba(255, 215, 0, 0.1)',
          color: '#fff',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Profile"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#aaa',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            zIndex: 10,
            transition: 'all 0.2s ease'
          }}
        >
          &times;
        </button>

        {/* Top User Card Header (Image 1 Header) */}
        <div style={{ padding: '1.5rem 1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Avatar Circle */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #facc15 0%, #ca8a04 100%)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 'bold',
                boxShadow: '0 0 20px rgba(250, 204, 21, 0.4)',
                flexShrink: 0
              }}
            >
              {userInitial}
            </div>

            {/* Details & VIP Badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em' }}>
                {fullName || currentUser?.name || 'Player'}
              </h2>
              <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: '0.15rem', wordBreak: 'break-all' }}>
                {currentUserEmail}
              </div>

              {/* Level/VIP Pill Badge (Matching Image 1) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.725rem',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    background: levelInfo.isVip
                      ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.2), rgba(234, 179, 8, 0.4))'
                      : 'rgba(255,255,255,0.06)',
                    color: levelInfo.isVip ? '#fde047' : '#e2e8f0',
                    border: levelInfo.isVip ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.15)',
                    boxShadow: levelInfo.isVip ? '0 0 12px rgba(250, 204, 21, 0.3)' : 'none'
                  }}
                >
                  <span>{levelInfo.badgeEmoji}</span>
                  <span>{levelInfo.badgeLabel}</span>
                </span>

                <span style={{ fontSize: '0.725rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.4)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                  Total Deposit: <strong style={{ color: '#facc15' }}>${calculatedDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          {/* 1. GAME ACCOUNTS SECTION (Requirement 1) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                <i className="fa-solid fa-gamepad gold-text" style={{ marginRight: '0.4rem' }}></i>
                Game Accounts ({userGameAccounts.length})
              </h3>
            </div>

            {userGameAccounts.length > 0 ? (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gap: '0.6rem',
                    maxHeight: showAllAccounts ? '280px' : 'none',
                    overflowY: showAllAccounts ? 'auto' : 'visible',
                    paddingRight: showAllAccounts ? '4px' : '0'
                  }}
                >
                  {(showAllAccounts ? userGameAccounts : userGameAccounts.slice(0, 3)).map((acc, idx) => (
                    <div
                      key={acc.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '0.65rem 0.85rem'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>{acc.gameTitle}</div>
                        <div style={{ fontSize: '0.75rem', color: '#facc15', fontFamily: 'monospace', marginTop: '0.1rem' }}>
                          ID: {acc.username}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyUsername(acc.username, idx)}
                        style={{
                          background: copiedAccountIndex === idx ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: copiedAccountIndex === idx ? '#4ade80' : '#cbd5e1',
                          borderRadius: '6px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.725rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <i className={`fa-solid ${copiedAccountIndex === idx ? 'fa-check' : 'fa-copy'}`}></i>
                        <span>{copiedAccountIndex === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  ))}
                </div>

                {userGameAccounts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAccounts(!showAllAccounts)}
                    style={{
                      width: '100%',
                      marginTop: '0.6rem',
                      padding: '0.45rem 0.75rem',
                      background: 'rgba(250, 204, 21, 0.08)',
                      border: '1px dashed rgba(250, 204, 21, 0.35)',
                      borderRadius: '8px',
                      color: '#facc15',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <i className={`fa-solid ${showAllAccounts ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                    <span>
                      {showAllAccounts
                        ? 'Show Less Accounts'
                        : `View All (${userGameAccounts.length}) Game Accounts (+${userGameAccounts.length - 3} more)`}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: '#94a3b8'
                }}
              >
                No game accounts assigned yet. Click on any game card in the lobby to request an account!
              </div>
            )}
          </div>

          {/* 2. ACCOUNT DETAILS SECTION (Image 1) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              ACCOUNT DETAILS
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  FULL NAME
                </label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07090f',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07090f',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3. SECURITY & PASSWORD SECTION (Image 1 & Requirement 1) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              SECURITY & PASSWORD
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  NEW PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07090f',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: '700', color: '#cbd5e1', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  CONFIRM PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07090f',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4. PLAYER LEVEL & VIP BONUS TABLE (Image 3 & Requirement 3) */}
          <div style={{ marginBottom: '1.5rem', background: '#080a11', border: '1px solid rgba(255, 215, 0, 0.15)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#facc15', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                <i className="fa-solid fa-crown" style={{ marginRight: '0.4rem' }}></i>
                Player Level & VIP Rewards
              </h3>

              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: levelInfo.isVip ? '#facc15' : '#e2e8f0' }}>
                {levelInfo.badgeEmoji} {levelInfo.levelName}
              </span>
            </div>

            {/* Deposit Progress bar */}
            {!levelInfo.isVip && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  <span>Next Level: <strong>{levelInfo.nextTier}</strong></span>
                  <span>Need <strong>${levelInfo.neededForNext?.toLocaleString()}</strong> more</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${levelInfo.progressPercent}%`,
                      background: 'linear-gradient(90deg, #eab308 0%, #facc15 100%)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Level Milestone Reward Claim Card */}
            {levelRewardsData?.milestoneRewards?.unclaimedAmount > 0 && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(202, 138, 4, 0.28) 100%)',
                  border: '1px solid #facc15',
                  boxShadow: '0 0 20px rgba(250, 204, 21, 0.25)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      🎉 UNCLAIMED LEVEL REWARD READY
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#fff', marginTop: '0.1rem' }}>
                      ${levelRewardsData.milestoneRewards.unclaimedAmount.toFixed(2)} Bonus Coins
                    </div>
                  </div>

                  <span style={{ background: '#facc15', color: '#000', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '900' }}>
                    {levelInfo.levelName} Milestone
                  </span>
                </div>

                {claimSuccessMessage ? (
                  <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', color: '#4ade80', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', marginTop: '0.5rem' }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i> {claimSuccessMessage}
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', color: '#cbd5e1', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Select Game Account to Receive Coins:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <select
                        value={selectedRewardGame}
                        onChange={(e) => setSelectedRewardGame(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '160px',
                          background: '#07090f',
                          border: '1px solid rgba(255, 215, 0, 0.4)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.8rem',
                          padding: '0.5rem 0.75rem',
                          outline: 'none'
                        }}
                      >
                        {(levelRewardsData.gameAccounts?.length > 0 ? levelRewardsData.gameAccounts : userGameAccounts).map((ga) => (
                          <option key={ga.gameTitle} value={ga.gameTitle}>
                            {ga.gameTitle} (ID: {ga.username})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleClaimLevelReward}
                        disabled={claimingReward || (!selectedRewardGame && userGameAccounts.length === 0)}
                        style={{
                          background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.5rem 1.25rem',
                          fontSize: '0.8rem',
                          fontWeight: '900',
                          cursor: claimingReward ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 4px 15px rgba(250, 204, 21, 0.4)',
                          textTransform: 'uppercase'
                        }}
                      >
                        {claimingReward ? (
                          <><i className="fa-solid fa-spinner fa-spin"></i> Claiming...</>
                        ) : (
                          <><i className="fa-solid fa-gift"></i> Claim ${levelRewardsData.milestoneRewards.unclaimedAmount.toFixed(2)} Bonus</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Table matching Image 3 */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Total Deposit</th>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Level</th>
                    <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Claimable Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVEL_TIERS.map((tier) => {
                    const isActive = levelInfo.tierKey === tier.tierKey;
                    return (
                      <tr
                        key={tier.tierKey}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: isActive
                            ? 'linear-gradient(90deg, rgba(250, 204, 21, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)'
                            : 'transparent',
                          color: isActive ? '#fff' : '#cbd5e1',
                          fontWeight: isActive ? '700' : 'normal'
                        }}
                      >
                        <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {tier.maxDeposit === Infinity
                            ? '$20,000+'
                            : `$${tier.minDeposit.toLocaleString()}–$${tier.maxDeposit.toLocaleString()}`}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>{tier.badgeEmoji}</span>
                            <span>{tier.levelName}</span>
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: isActive ? '#facc15' : '#94a3b8' }}>
                          {tier.bonusDesc}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VIP Rules Callout Box */}
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.75rem',
                background: levelInfo.isVip ? 'rgba(250, 204, 21, 0.08)' : 'rgba(255,255,255,0.02)',
                border: levelInfo.isVip ? '1px solid rgba(250, 204, 21, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                fontSize: '0.725rem',
                color: '#e2e8f0',
                lineHeight: 1.45
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#facc15', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <i className="fa-solid fa-circle-info"></i>
                VIP Bonus Terms & Eligibility:
              </div>
              At <strong>$20,000 cumulative deposit</strong>, the player receives a VIP badge. Once VIP, the player becomes eligible to claim the <strong>50% bonus</strong> only when making a deposit of <strong>$300 or more</strong>. <em>(The $300 is the minimum qualifying deposit threshold to claim the bonus).</em>
            </div>
          </div>

          {/* FOOTER ACTIONS (Image 1 Footer) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link
              href="/account-deletion"
              style={{
                color: '#ef4444',
                fontSize: '0.775rem',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <i className="fa-solid fa-trash-can"></i>
              <span>Request Account Deletion</span>
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #facc15 0%, #ca8a04 100%)',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 1.35rem',
                fontSize: '0.85rem',
                fontWeight: '800',
                cursor: isSubmitting ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 15px rgba(250, 204, 21, 0.3)',
                letterSpacing: '0.02em',
                transition: 'all 0.2s ease'
              }}
            >
              <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
              <span>{isSubmitting ? 'SAVING...' : 'SAVE CHANGES'}</span>
            </button>
          </div>
        </form>
      </div>
    </PanelModalBackdrop>
  );
}
