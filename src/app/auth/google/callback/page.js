'use client';

import { useEffect, useState } from 'react';

const APP_SCHEME = 'com.jackpotroyals.app';

async function completeGoogleFromToken(accessToken) {
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await profileRes.json();
  if (!profile.email) {
    throw new Error('Google profile email was missing.');
  }

  const googleRes = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(profile.email).toLowerCase(),
      name: profile.name || 'Google Player',
      referredBy: localStorage.getItem('jackpot_ref_code') || '',
      distributorId: localStorage.getItem('jackpot_distributor_id') || '',
      agentCode: localStorage.getItem('jackpot_agent_code') || '',
      campaign: localStorage.getItem('jackpot_campaign') || ''
    })
  });
  const googleData = await googleRes.json();
  if (!googleRes.ok || !googleData.success) {
    throw new Error(googleData.message || 'Google sign-in failed.');
  }

  const ticketRes = await fetch('/api/auth/google/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: googleData.user, isNewUser: googleData.isNewUser })
  });
  const ticketData = await ticketRes.json();
  if (!ticketRes.ok || !ticketData.ticket) {
    throw new Error(ticketData.message || 'Could not finish Google sign-in.');
  }

  return ticketData.ticket;
}

export default function GoogleOAuthCallbackPage() {
  const [status, setStatus] = useState('Signing you in with Google…');
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash || window.location.search);
        const accessToken = params.get('access_token');
        const err = params.get('error');
        if (err) throw new Error('Google sign-in was cancelled.');
        if (!accessToken) throw new Error('Missing Google access token.');

        const nextTicket = await completeGoogleFromToken(accessToken);
        if (cancelled) return;
        setTicket(nextTicket);
        setStatus('Signed in. Returning to Jackpot Royals…');

        const deepLink = `${APP_SCHEME}://oauth?ticket=${encodeURIComponent(nextTicket)}`;
        const webFallback = `${window.location.origin}/login?google_ticket=${encodeURIComponent(nextTicket)}`;

        window.location.href = deepLink;
        window.setTimeout(() => {
          if (!cancelled) window.location.replace(webFallback);
        }, 700);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Google sign-in failed.');
        setStatus('Could not complete Google sign-in.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background: '#080a11',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center'
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Jackpot Royals</h1>
        <p style={{ color: error ? '#f87171' : '#cbd5e1', marginBottom: '1.25rem' }}>
          {error || status}
        </p>
        {ticket && !error && (
          <a
            href={`com.jackpotroyals.app://oauth?ticket=${encodeURIComponent(ticket)}`}
            style={{
              display: 'inline-block',
              padding: '0.85rem 1.25rem',
              borderRadius: 999,
              background: '#f5d76e',
              color: '#111',
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            Open App
          </a>
        )}
        {error && (
          <a
            href="/login"
            style={{ color: '#f5d76e', fontWeight: 600 }}
          >
            Back to login
          </a>
        )}
      </div>
    </main>
  );
}
