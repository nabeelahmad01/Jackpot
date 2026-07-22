import Link from 'next/link';

export const metadata = {
  title: 'Account Deletion | Jackpot Royals',
  description:
    'Request deletion of your Jackpot Royals account and associated personal data.'
};

const SUPPORT_EMAIL = 'support@jackpotroyals.com';

const paraStyle = {
  color: 'rgba(255,255,255,0.82)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  margin: '0 0 0.75rem'
};

const listStyle = {
  color: 'rgba(255,255,255,0.82)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  margin: '0 0 0.75rem',
  paddingLeft: '1.2rem'
};

export default function AccountDeletionPage() {
  return (
    <main className="info-page">
      <div className="ambient-glow glow-1" aria-hidden="true" />
      <div className="ambient-glow glow-2" aria-hidden="true" />
      <div className="info-page-aura" aria-hidden="true" />

      <div className="info-page-inner" style={{ maxWidth: '820px' }}>
        <header className="info-topbar">
          <Link href="/login" className="info-back-link">
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            Back to login
          </Link>
        </header>

        <section style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="info-brand" style={{ justifyContent: 'center' }}>
            <span className="brand-text-1">ACCOUNT</span>
            <span className="brand-text-2">DELETION</span>
          </h1>
          <p className="info-tagline">JACKPOT ROYALS</p>
        </section>

        <article
          style={{
            background: 'rgba(12,16,26,0.6)',
            border: '1px solid rgba(255,215,0,0.15)',
            borderRadius: '18px',
            padding: '1.75rem 1.5rem',
            backdropFilter: 'blur(6px)'
          }}
        >
          <p style={paraStyle}>
            You can request deletion of your Jackpot Royals account and associated personal data at
            any time. This page explains how to submit that request for the website and the mobile
            app.
          </p>

          <h2
            style={{
              color: '#ffd700',
              fontSize: '1.05rem',
              fontWeight: 700,
              margin: '1.25rem 0 0.5rem'
            }}
          >
            How to request deletion
          </h2>
          <ol style={listStyle}>
            <li>
              Email us from the same email address registered on your account:{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`} style={{ color: '#ffd700' }}>
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              Use subject line: <strong style={{ color: '#fff' }}>Account deletion request</strong>
            </li>
            <li>
              Include your registered name and confirm that you want the account permanently deleted.
            </li>
          </ol>

          <p style={paraStyle}>
            Or open support chat inside the Jackpot Royals app / website and ask staff to delete your
            account.
          </p>

          <h2
            style={{
              color: '#ffd700',
              fontSize: '1.05rem',
              fontWeight: 700,
              margin: '1.25rem 0 0.5rem'
            }}
          >
            What gets deleted
          </h2>
          <ul style={listStyle}>
            <li>Account profile details (such as name and email)</li>
            <li>App login access and related account settings</li>
            <li>Support chat history tied to your account (where applicable)</li>
          </ul>

          <h2
            style={{
              color: '#ffd700',
              fontSize: '1.05rem',
              fontWeight: 700,
              margin: '1.25rem 0 0.5rem'
            }}
          >
            What may be retained
          </h2>
          <p style={paraStyle}>
            We may keep limited records required for legal, fraud-prevention, accounting, or dispute
            purposes (for example transaction records) for as long as required by law or our
            retention policy. After that period, remaining personal data is deleted or anonymized.
          </p>

          <h2
            style={{
              color: '#ffd700',
              fontSize: '1.05rem',
              fontWeight: 700,
              margin: '1.25rem 0 0.5rem'
            }}
          >
            Processing time
          </h2>
          <p style={paraStyle}>
            We aim to process deletion requests within <strong style={{ color: '#fff' }}>30 days</strong>{' '}
            of verifying your identity. You will receive a confirmation email when the request is
            completed.
          </p>

          <p style={{ ...paraStyle, marginBottom: 0 }}>
            Privacy policy:{' '}
            <Link href="/privacy" style={{ color: '#ffd700' }}>
              https://jackpotroyals.com/privacy
            </Link>
          </p>
        </article>
      </div>
    </main>
  );
}
