import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Info & Contact | Jackpot Royals',
  description:
    'Official Jackpot Royals contact channels — Instagram, Telegram, Facebook, and support email.'
};

const CHANNELS = [
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@jackpotroyals_casino',
    href: 'https://www.instagram.com/jackpotroyals_casino?igsh=dnZjNmNwdmNzazN6',
    icon: 'fa-brands fa-instagram',
    accent: 'instagram'
  },
  {
    id: 'telegram',
    label: 'Telegram',
    handle: 't.me/Jackpotroyals_casino',
    href: 'https://t.me/Jackpotroyals_casino',
    icon: 'fa-brands fa-telegram',
    accent: 'telegram'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: 'Jackpot Royals',
    href: 'https://www.facebook.com/share/1KgG9SdC5N/',
    icon: 'fa-brands fa-facebook',
    accent: 'facebook'
  },
  {
    id: 'email',
    label: 'Email Support',
    handle: 'support@jackpotroyals.com',
    href: 'mailto:support@jackpotroyals.com',
    icon: 'fa-solid fa-envelope',
    accent: 'email'
  }
];

export default function InfoPage() {
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
          <p className="info-tagline">PLAY SMARTER. CASHOUT FASTER.</p>
          <p className="info-lead">
            Official channels for updates, community, and player support. Reach us anytime —
            we&apos;re here to help you win big.
          </p>
        </section>

        <section className="info-channels" aria-label="Contact channels">
          {CHANNELS.map((channel) => (
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
              <i className="fa-solid fa-arrow-up-right-from-square info-channel-arrow" aria-hidden="true" />
            </a>
          ))}
        </section>

        <section className="info-support-note">
          <i className="fa-solid fa-headset" aria-hidden="true" />
          <p>
            For account help, deposits, or withdrawals, email{' '}
            <a href="mailto:support@jackpotroyals.com">support@jackpotroyals.com</a>
            {' '}and our team will get back to you.
          </p>
        </section>

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
