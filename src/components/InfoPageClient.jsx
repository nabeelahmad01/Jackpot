'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { getInfoChannels, isInfoPageEnabled } from '../lib/infoPage';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function InfoPageClient() {
  const { data } = useSWR('/api/settings/frontend', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });
  const settings = data?.settings || {};
  const channels = useMemo(() => getInfoChannels(settings), [settings]);
  const pageEnabled = isInfoPageEnabled(settings);
  const emailChannel = channels.find((c) => c.id === 'email');
  const supportEmail = emailChannel?.handle || 'support@jackpotroyals.com';
  const supportMailto = emailChannel?.href || `mailto:${supportEmail}`;

  return (
    <main className="info-page">
      <div className="ambient-glow glow-1" aria-hidden="true" />
      <div className="ambient-glow glow-2" aria-hidden="true" />
      <div className="info-page-aura" aria-hidden="true" />

      <div className="info-page-inner">
        <header className="info-topbar">
          <Link href="/login" className="info-back-link">
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            Back to login
          </Link>
        </header>

        <section className="info-hero">
          <div className="info-logo-wrap animate-float">
            <Image
              src="/jackpot_royals_logo.png"
              alt="Jackpot Royals"
              width={88}
              height={88}
              className="info-logo"
              priority
            />
            <span className="info-logo-ring" aria-hidden="true" />
          </div>

          <h1 className="info-brand">
            <span className="brand-text-1">JACKPOT</span>
            <span className="brand-text-2">ROYALS</span>
          </h1>
          <p className="info-tagline">
            {settings.infoTagline || 'PLAY SMARTER. CASHOUT FASTER.'}
          </p>
          <p className="info-lead">
            {settings.infoLead ||
              'Official channels for updates, community, and player support. Reach us anytime — we\'re here to help you win big.'}
          </p>
        </section>

        {!pageEnabled ? (
          <section className="info-support-note">
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
            <p>This info page is currently turned off by the administrator.</p>
          </section>
        ) : (
          <>
            <section className="info-channels" aria-label="Contact channels">
              {channels.map((channel) => (
                <a
                  key={channel.id}
                  className={`info-channel info-channel--${channel.accent}`}
                  href={channel.href}
                  target={channel.id === 'email' ? undefined : '_blank'}
                  rel={channel.id === 'email' ? undefined : 'noopener noreferrer'}
                >
                  <span className="info-channel-icon" aria-hidden="true">
                    <i className={channel.icon} />
                  </span>
                  <span className="info-channel-copy">
                    <strong>{channel.label}</strong>
                    <span>{channel.handle}</span>
                  </span>
                  <i
                    className="fa-solid fa-arrow-up-right-from-square info-channel-arrow"
                    aria-hidden="true"
                  />
                </a>
              ))}
              {channels.length === 0 && (
                <p className="info-lead" style={{ textAlign: 'center' }}>
                  No contact channels are enabled right now.
                </p>
              )}
            </section>

            <section className="info-support-note">
              <i className="fa-solid fa-headset" aria-hidden="true" />
              <p>
                {settings.infoSupportNote ||
                  'For account help, deposits, or withdrawals, email support and our team will get back to you.'}{' '}
                <a href={supportMailto}>{supportEmail}</a>
              </p>
            </section>
          </>
        )}

        <footer className="info-footer">
          <Link href="/login" className="info-cta slanted-green-btn">
            <span className="btn-inner">ENTER LOBBY</span>
            <span className="btn-glow" aria-hidden="true" />
          </Link>
          <p className="info-footer-copy">© {new Date().getFullYear()} Jackpot Royals</p>
        </footer>
      </div>
    </main>
  );
}
