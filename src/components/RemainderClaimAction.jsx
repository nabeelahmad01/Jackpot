'use client';

import React, { useState, useEffect } from 'react';
import {
  canShowClaimRemainderButton,
  getRemainderCountdown,
  formatRemainderCountdown,
  isRemainderClaimPending,
  isRemainderFullyPaid
} from '../lib/remainderClaim';

export default function RemainderClaimAction({
  tx,
  claimedIds = [],
  onClaim,
  actionLoading = false,
  buttonStyle = {},
  compact = false
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!tx || isRemainderFullyPaid(tx) || parseFloat(tx.payoutHold || 0) <= 0) {
    return null;
  }

  if (isRemainderClaimPending(tx, claimedIds)) {
    return (
      <span style={{ fontSize: compact ? '0.6rem' : '0.625rem', color: '#888', fontStyle: 'italic' }}>
        Remainder Requested
      </span>
    );
  }

  const countdown = getRemainderCountdown(tx, now);

  if (countdown) {
    return (
      <span
        style={{
          fontSize: compact ? '0.6rem' : '0.625rem',
          color: '#f59e0b',
          fontWeight: 'bold',
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          display: 'inline-block',
          marginTop: compact ? 0 : '0.25rem'
        }}
      >
        <i className="fa-solid fa-clock" style={{ marginRight: '0.25rem' }}></i>
        Claim in {formatRemainderCountdown(countdown)}
      </span>
    );
  }

  if (!canShowClaimRemainderButton(tx, claimedIds, now)) {
    return null;
  }

  const defaultButtonStyle = {
    alignSelf: 'flex-start',
    background: 'rgba(255,215,0,0.1)',
    border: '1px solid var(--gold-primary)',
    color: 'var(--gold-primary)',
    fontSize: compact ? '0.6rem' : '0.625rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    cursor: actionLoading ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    marginTop: compact ? 0 : '0.25rem',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    opacity: actionLoading ? 0.6 : 1,
    ...buttonStyle
  };

  return (
    <button
      type="button"
      disabled={actionLoading}
      onClick={(e) => {
        e.stopPropagation();
        onClaim(tx);
      }}
      style={defaultButtonStyle}
      onMouseEnter={(e) => {
        if (actionLoading) return;
        e.currentTarget.style.background = 'var(--gold-primary)';
        e.currentTarget.style.color = '#000';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
        e.currentTarget.style.color = 'var(--gold-primary)';
      }}
    >
      Claim Remainder (${parseFloat(tx.payoutHold).toFixed(2)})
    </button>
  );
}
