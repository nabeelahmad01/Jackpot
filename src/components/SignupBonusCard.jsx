'use client';

import React, { useState, useEffect } from 'react';

export default function SignupBonusModal({
  isOpen = false,
  onClose,
  frontendSettings = {},
  onGoToRegister,
  onGoToDeposit,
  isLoggedIn = false
}) {
  const [depositAmount, setDepositAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Read live bonus & freeplay settings from system
  const bonusPercent = Number(
    frontendSettings?.firstDepositBonus !== undefined
      ? frontendSettings.firstDepositBonus
      : 300
  );
  const freeplayAmount = Number(
    frontendSettings?.signupFreeplay !== undefined
      ? frontendSettings.signupFreeplay
      : 3
  );

  const presets = [10, 20, 50, 100];

  const activeDeposit = isCustom
    ? Math.max(1, Number(customAmount) || 10)
    : depositAmount;

  // Dynamic bonus calculation based on real system settings
  const bonusAmount = Math.round((activeDeposit * bonusPercent) / 100);
  const totalPlayAmount = activeDeposit + bonusAmount;

  // Lock body scroll cleanly when modal is open
  useEffect(() => {
    if (isOpen) {
      const origBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origBodyOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (amt) => {
    setIsCustom(false);
    setDepositAmount(amt);
    setCustomAmount('');
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setIsCustom(true);
  };

  const handleCtaClick = (e) => {
    e.preventDefault();
    if (onGoToDeposit) {
      onGoToDeposit(activeDeposit);
    } else if (onGoToRegister) {
      onGoToRegister(activeDeposit);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className="bonus-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bonus-modal-title"
    >
      <div
        className="bonus-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="bonus-modal-close-btn"
          aria-label="Close Bonus Modal"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Ambient Top Glow */}
        <div className="bonus-modal-top-glow"></div>

        {/* Top Floating Badge */}
        <div className="bonus-badge-top">
          <span className="bonus-pulse-dot"></span>
          <i className="fa-solid fa-gift bonus-badge-icon"></i>
          <span>{isLoggedIn ? 'FIRST DEPOSIT BONUS READY' : 'REGISTRATION BONUS READY'}</span>
        </div>

        {/* Hero 3D Gift Icon & Glow Header */}
        <div className="bonus-hero-header">
          <div className="bonus-gift-box-wrapper">
            <div className="bonus-gift-glow"></div>
            <div className="bonus-gift-box">
              <i className="fa-solid fa-gift"></i>
            </div>
            <div className="bonus-sparkle-1">✦</div>
            <div className="bonus-sparkle-2">✦</div>
          </div>

          <h2 className="bonus-main-title" id="bonus-modal-title">
            CONGRATS! YOUR{' '}
            <span className="bonus-highlight-gold">{bonusPercent}% SIGNUP BONUS</span>{' '}
            IS UNLOCKED
          </h2>

          <p className="bonus-subtitle">
            {isLoggedIn ? (
              <>
                Make your first deposit to get your <strong style={{ color: '#ffd700' }}>{bonusPercent}% Instant Match</strong>{' '}
                + <strong style={{ color: '#4ade80' }}>${freeplayAmount} Freeplay</strong>!
              </>
            ) : (
              <>
                Sign up today to claim your <strong style={{ color: '#ffd700' }}>{bonusPercent}% Instant Match</strong>{' '}
                on your first deposit + <strong style={{ color: '#4ade80' }}>${freeplayAmount} Freeplay</strong>!
              </>
            )}
          </p>
        </div>

        {/* Interactive Calculation Card */}
        <div className="bonus-calc-card">
          <div className="bonus-calc-header">
            <div className="bonus-calc-icon-title">
              <div className="bonus-mini-gift">
                <i className="fa-solid fa-coins"></i>
              </div>
              <div>
                <h4 className="bonus-calc-title">DEPOSIT NOW TO CLAIM YOUR BONUS</h4>
                <p className="bonus-calc-desc">
                  Make your first deposit now and unlock your <strong>{bonusPercent}% Bonus</strong> Instantly.
                </p>
              </div>
            </div>
          </div>

          {/* Preset Deposit Selectors */}
          <div className="bonus-preset-row">
            <span className="bonus-preset-label">Select Deposit:</span>
            <div className="bonus-preset-buttons">
              {presets.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`bonus-preset-btn ${!isCustom && depositAmount === amt ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(amt)}
                >
                  ${amt}
                </button>
              ))}
              <div className={`bonus-custom-input-wrap ${isCustom ? 'active' : ''}`}>
                <span className="bonus-custom-prefix">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Custom"
                  value={customAmount}
                  onChange={handleCustomChange}
                  onFocus={() => setIsCustom(true)}
                  className="bonus-custom-input"
                  maxLength={5}
                  aria-label="Custom deposit amount"
                />
              </div>
            </div>
          </div>

          {/* Visual 3-Box Calculation Grid */}
          <div className="bonus-calc-grid">
            {/* Box 1: Your Deposit */}
            <div className="bonus-calc-step-box">
              <span className="bonus-step-label">YOUR DEPOSIT</span>
              <div className="bonus-step-value deposit-val">
                ${activeDeposit}
              </div>
            </div>

            {/* Plus Sign */}
            <div className="bonus-math-operator">+</div>

            {/* Box 2: Instant Bonus */}
            <div className="bonus-calc-step-box">
              <span className="bonus-step-label">BONUS ({bonusPercent}%)</span>
              <div className="bonus-step-value bonus-val">
                +${bonusAmount}
              </div>
            </div>

            {/* Equal Sign */}
            <div className="bonus-math-operator">=</div>

            {/* Box 3: Total Play Balance */}
            <div className="bonus-calc-step-box total-box">
              <span className="bonus-step-label total-label">YOUR PLAY WITH</span>
              <div className="bonus-step-value total-val">
                ${totalPlayAmount}
              </div>
            </div>
          </div>

          {/* Freeplay Alert Strip */}
          <div className="bonus-freeplay-strip">
            <span className="freeplay-live-dot"></span>
            <span>
              <strong>${freeplayAmount} Freeplay</strong> is available immediately after registration
            </span>
          </div>

          {/* Main CTA Deposit / Register Button */}
          <button
            type="button"
            onClick={handleCtaClick}
            className="bonus-deposit-cta-btn"
            id="bonus-deposit-cta"
          >
            <span className="cta-icon">🚀</span>
            <span className="cta-text">DEPOSIT NOW</span>
            <i className="fa-solid fa-arrow-right cta-arrow"></i>
          </button>

          {/* Trust Badges */}
          <div className="bonus-trust-badges">
            <div className="bonus-trust-pill">
              <i className="fa-solid fa-bolt" style={{ color: '#ffd700' }}></i>
              <span>Instant Load</span>
            </div>
            <div className="bonus-trust-pill">
              <i className="fa-solid fa-shield-halved" style={{ color: '#22c55e' }}></i>
              <span>Secure Deposit</span>
            </div>
            <div className="bonus-trust-pill">
              <i className="fa-solid fa-headset" style={{ color: '#38bdf8' }}></i>
              <span>24/7 Support</span>
            </div>
          </div>

          {/* Footer Guidance */}
          <p className="bonus-footer-note">
            Choose your favorite game, make your first deposit, and activate your signup bonus.
          </p>
        </div>
      </div>
    </div>
  );
}
