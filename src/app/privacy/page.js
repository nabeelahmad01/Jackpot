import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Jackpot Royals',
  description:
    'How Jackpot Royals collects, uses, and protects your information across our website and mobile app.'
};

const UPDATED = 'July 19, 2026';
const SUPPORT_EMAIL = 'support@jackpotroyals.com';

const sectionStyle = { marginTop: '1.75rem' };
const headingStyle = {
  color: '#ffd700',
  fontSize: '1.05rem',
  fontWeight: 700,
  margin: '0 0 0.5rem',
  letterSpacing: '0.02em'
};
const paraStyle = {
  color: 'rgba(255,255,255,0.82)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  margin: '0 0 0.6rem'
};
const listStyle = {
  color: 'rgba(255,255,255,0.82)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  margin: '0 0 0.6rem',
  paddingLeft: '1.2rem'
};

export default function PrivacyPolicyPage() {
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
            <span className="brand-text-1">PRIVACY</span>
            <span className="brand-text-2">POLICY</span>
          </h1>
          <p className="info-tagline">JACKPOT ROYALS</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Last updated: {UPDATED}
          </p>
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
            This Privacy Policy explains how Jackpot Royals (&quot;we&quot;, &quot;us&quot;, or
            &quot;our&quot;) collects, uses, and protects your information when you use our website
            (<a href="https://jackpotroyals.com" style={{ color: '#ffd700' }}>jackpotroyals.com</a>)
            and our mobile application (together, the &quot;Service&quot;). By using the Service you
            agree to the practices described below.
          </p>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>1. Who can use the Service</h2>
            <p style={paraStyle}>
              The Service is intended only for adults aged 18 years or older. It is not directed to
              children, and we do not knowingly collect information from anyone under 18. If we learn
              that we have collected such data, we will delete it.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>2. Information we collect</h2>
            <ul style={listStyle}>
              <li>
                <strong>Account details:</strong> name and email address you provide, or that we
                receive from Google Sign-In when you choose to log in with Google.
              </li>
              <li>
                <strong>Activity data:</strong> game account requests, coin balances, deposit and
                withdrawal transaction records, referral information, and support messages you send
                us.
              </li>
              <li>
                <strong>Device &amp; notification data:</strong> a push-notification token and basic
                device/user-agent information so we can send you alerts you have enabled.
              </li>
              <li>
                <strong>Technical data:</strong> standard log information (such as IP-derived region
                and app version) used to keep the Service secure and working.
              </li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>3. How we use your information</h2>
            <ul style={listStyle}>
              <li>To create and manage your account and verify your identity (including OTP emails).</li>
              <li>To process game-account requests, coin allotments, and transactions.</li>
              <li>To provide customer support and respond to your messages.</li>
              <li>To send notifications and, where enabled, promotional updates.</li>
              <li>To detect, prevent, and address fraud, abuse, or security issues.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>4. Service providers we share data with</h2>
            <p style={paraStyle}>
              We do not sell your personal information. We share limited data only with trusted
              providers that help us run the Service:
            </p>
            <ul style={listStyle}>
              <li>
                <strong>Google Firebase Cloud Messaging</strong> — to deliver push notifications.
              </li>
              <li>
                <strong>Google Sign-In</strong> — for optional login authentication.
              </li>
              <li>
                <strong>MongoDB Atlas</strong> — secure cloud database hosting for your account data.
              </li>
              <li>
                <strong>Email delivery provider</strong> — to send verification (OTP) and
                promotional emails.
              </li>
            </ul>
            <p style={paraStyle}>
              We may also disclose information if required by law or to protect the rights, safety,
              and security of our users and the Service.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>5. Data retention</h2>
            <p style={paraStyle}>
              We keep your information for as long as your account is active or as needed to provide
              the Service and meet legal obligations. You may request deletion of your account and
              associated data at any time (see contact below).
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>6. Your choices &amp; rights</h2>
            <ul style={listStyle}>
              <li>You can turn notifications on or off from your device settings at any time.</li>
              <li>You can request access to, correction of, or deletion of your personal data.</li>
              <li>You can unsubscribe from promotional emails using the option provided or by contacting us.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>7. Data security</h2>
            <p style={paraStyle}>
              We use reasonable technical and organizational measures to protect your data. However,
              no method of transmission or storage is completely secure, and we cannot guarantee
              absolute security.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>8. Changes to this policy</h2>
            <p style={paraStyle}>
              We may update this Privacy Policy from time to time. Changes take effect when posted on
              this page, and we will update the &quot;Last updated&quot; date above.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>9. Contact us</h2>
            <p style={paraStyle}>
              If you have any questions about this Privacy Policy or your data, contact us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#ffd700' }}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
        </article>

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
