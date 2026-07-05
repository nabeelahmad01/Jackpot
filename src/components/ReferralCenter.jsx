'use client';

import React from 'react';

export default function ReferralCenter({
  currentUserEmail,
  referralCode = '',
  referralsList = [],
  onClose,
  onOpenSupport,
  showToast,
}) {
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}?ref=${encodeURIComponent(referralCode)}`
    : `https://jackpotroyals.com?ref=${encodeURIComponent(referralCode)}`;

  const promoText = `Join JackpotRoyals with my referral link and get started with bonus offers. Sign up here: ${referralLink}`;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, 'success');
  };

  const shareWhatsApp = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(promoText)}`, '_blank');
  const shareSMS = () => window.open(`sms:?&body=${encodeURIComponent(promoText)}`, '_blank');

  const s = {
    page: { display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', paddingBottom: '2rem' },
    // Top bar
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', background: 'rgba(14,18,36,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', flexWrap: 'wrap', gap: '0.75rem' },
    topLeft: { display: 'flex', alignItems: 'center', gap: '0.85rem' },
    topIcon: { width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid var(--gold-primary)', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    topTitle: { fontSize: '1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.04em', margin: 0 },
    topSub: { fontSize: '0.675rem', color: 'var(--text-muted)', marginTop: '0.1rem' },
    topBtns: { display: 'flex', gap: '0.5rem' },
    topBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s' },
    // Hero
    hero: { position: 'relative', background: 'linear-gradient(160deg, #1a0e2e 0%, #0d0f1b 50%, #0a0c16 100%)', border: '1px solid rgba(168,85,247,0.12)', borderRadius: '18px', padding: '2.5rem 2rem 2rem', overflow: 'hidden' },
    heroBg: { position: 'absolute', top: '-80px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 65%)', pointerEvents: 'none' },
    heroBg2: { position: 'absolute', bottom: '-60px', left: '-40px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 65%)', pointerEvents: 'none' },
    heroActiveBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.6rem', color: '#4ade80', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' },
    heroTitle: { fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', fontWeight: 900, fontFamily: 'var(--font-heading)', lineHeight: 1.05, color: '#fff', margin: '0 0 1rem 0', position: 'relative', zIndex: 1 },
    heroGradText: { background: 'linear-gradient(135deg, #c084fc 0%, #f472b6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    heroDesc: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 1.5rem 0', maxWidth: '550px', position: 'relative', zIndex: 1 },
    heroTip: { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)', borderRadius: '10px', padding: '0.6rem 0.85rem', fontSize: '0.7rem', color: '#ffd700', fontWeight: 600, position: 'relative', zIndex: 1 },
    heroActions: { display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 },
    btnPrimary: { background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.06em', boxShadow: '0 4px 20px rgba(124,58,237,0.25)', transition: 'transform 0.15s', textTransform: 'uppercase' },
    btnSecondary: { background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', padding: '0.7rem 1.4rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.04em', transition: 'all 0.2s', textTransform: 'uppercase' },
    // Link row
    linkSection: { background: 'rgba(14,18,36,0.8)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1.25rem' },
    linkLabel: { fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem' },
    linkRow: { display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' },
    linkInput: { flex: 1, minWidth: '220px', background: '#080a14', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0.7rem 0.85rem', fontSize: '0.78rem', color: '#c084fc', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: 'monospace' },
    linkCopyBtn: { background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', color: '#fff', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
    linkHint: { fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.5rem' },
    // Stats row
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' },
    statCard: { background: 'rgba(14,18,36,0.8)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1.25rem', textAlign: 'center' },
    statNumber: { fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: '#fff', lineHeight: 1 },
    statLabel: { fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.35rem' },
    // Promo copy
    promoBox: { background: 'rgba(14,18,36,0.8)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
    promoText: { flex: 1, minWidth: '200px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
    promoBtn: { background: '#a855f7', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.05em' },
    // Players table
    tableSection: { background: 'rgba(14,18,36,0.8)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1.25rem' },
    tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' },
    tableTitle: { fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 },
    tableSub: { fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.15rem' },
    emptyState: { padding: '2.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.06)' },
    emptyIcon: { fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.2 },
    emptyText: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', margin: 0, lineHeight: 1.5 },
    // Steps
    stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' },
    stepCard: { background: 'rgba(14,18,36,0.8)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1.5rem 1.25rem', position: 'relative', overflow: 'hidden' },
    stepAccent: (color) => ({ position: 'absolute', bottom: 0, left: '1.25rem', right: '1.25rem', height: '3px', background: color, borderRadius: '3px 3px 0 0' }),
    stepNum: (bg) => ({ width: '34px', height: '34px', borderRadius: '50%', background: bg, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', marginBottom: '0.85rem', boxShadow: `0 4px 15px ${bg}40` }),
    stepTitle: { fontSize: '0.8rem', fontWeight: 800, color: '#fff', margin: '0 0 0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' },
    stepDesc: { fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.45 },
    // Share buttons
    shareGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' },
    shareBtn: (bg, shadow) => ({ background: bg, color: '#fff', border: 'none', padding: '0.85rem 1rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', boxShadow: shadow || 'none', transition: 'transform 0.15s' }),
    // Bottom banner
    banner: { background: 'linear-gradient(135deg, #1a0e2e 0%, #0d0f1b 100%)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: '14px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
    bannerLeft: { display: 'flex', gap: '0.85rem', alignItems: 'center' },
    bannerEmoji: { fontSize: '2rem', flexShrink: 0 },
    bannerTitle: { fontSize: '0.85rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', margin: 0 },
    bannerDesc: { fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', margin: '0.15rem 0 0 0', lineHeight: 1.4 },
  };

  return (
    <div style={s.page}>

      {/* ─── TOP BAR ─── */}
      <div style={s.topBar}>
        <div style={s.topLeft}>
          <div style={s.topIcon}>
            <img src="/jackpot_lion_mascot.png" alt="Gold Lion Mascot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h2 style={s.topTitle}>JACKPOT<span style={{ color: 'var(--gold-primary)' }}>ROYALS</span> REFERRALS</h2>
          </div>
        </div>
        <div style={s.topBtns}>
          <button style={s.topBtn} onClick={onClose}><i className="fa-solid fa-chevron-left"></i> BACK</button>
          <button style={s.topBtn} onClick={onOpenSupport}><i className="fa-solid fa-headset"></i> SUPPORT</button>
        </div>
      </div>

      {/* ─── HERO SECTION ─── */}
      <div style={s.hero}>
        <style dangerouslySetInnerHTML={{__html: `
          @media (max-width: 600px) {
            .desktop-only-lion { display: none !important; }
          }
        `}} />
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '30px',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '2px solid var(--gold-primary)',
          background: '#000',
          boxShadow: '0 0 20px rgba(255,215,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'float-animation 4s infinite ease-in-out',
          zIndex: 2,
          opacity: 0.85
        }} className="desktop-only-lion">
          <img src="/jackpot_lion_mascot.png" alt="Gold Lion Mascot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={s.heroBg}></div>
        <div style={s.heroBg2}></div>

        <div style={s.heroActiveBadge}>
          <i className="fa-solid fa-circle" style={{ fontSize: '0.4rem', color: '#4ade80' }}></i>
          REFERRAL PROGRAM ACTIVE
        </div>

        <h1 style={s.heroTitle}>
          LOVE JACKPOTROYALS?<br/>
          <span style={s.heroGradText}>SHARE IT WITH FRIENDS.</span>
        </h1>

        <p style={s.heroDesc}>
          Great gaming experiences are worth sharing. Invite your friends, family, and gaming groups
          to join the JackpotRoyals community and enjoy the action together.
        </p>

        <div style={s.heroTip}>
          <i className="fa-solid fa-lightbulb" style={{ fontSize: '0.85rem' }}></i>
          Share JackpotRoyals with friends and help grow our gaming community.
        </div>

        <div style={s.heroActions}>
          <button style={s.btnPrimary} onClick={() => copy(referralLink, 'Referral link')}>
            <i className="fa-solid fa-rocket"></i> Copy Referral Link
          </button>
          <button style={s.btnSecondary} onClick={() => showToast('Share your personal referral link to register invitees under your account.', 'info')}>
            <i className="fa-solid fa-circle-question"></i> How To Get More
          </button>
        </div>
      </div>

      {/* ─── REFERRAL LINK + STATS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <div style={s.linkSection}>
          <div style={s.linkLabel}>Your Referral Link</div>
          <div style={s.linkRow}>
            <div style={s.linkInput}>{referralLink}</div>
            <button style={s.linkCopyBtn} onClick={() => copy(referralLink, 'Referral link')}>
              <i className="fa-solid fa-copy"></i> COPY LINK
            </button>
          </div>
          <div style={s.linkHint}>Share this link everywhere. Anyone who signs up with it becomes your referral.</div>
        </div>

        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={s.statNumber}>{referralsList.length}</div>
            <div style={s.statLabel}>Total Referred</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNumber, color: '#4ade80' }}>{referralsList.length}</div>
            <div style={s.statLabel}>Active Players</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNumber, color: '#ffd700' }}>100%</div>
            <div style={s.statLabel}>Bonus Rate</div>
          </div>
        </div>
      </div>

      {/* ─── PROMO COPY BOX ─── */}
      <div style={s.promoBox}>
        <div style={s.promoText}>{promoText}</div>
        <button style={s.promoBtn} onClick={() => copy(promoText, 'Promo text')}>
          <i className="fa-solid fa-clipboard" style={{ marginRight: '0.3rem' }}></i> COPY PROMO TEXT
        </button>
      </div>

      {/* ─── INVITED PLAYERS TABLE ─── */}
      <div style={s.tableSection}>
        <div style={s.tableHeader}>
          <div>
            <h4 style={s.tableTitle}>Invited Players</h4>
            <div style={s.tableSub}>Players who joined using your referral link</div>
          </div>
          <button style={s.btnPrimary} onClick={() => copy(referralLink, 'Referral link')}>
            <i className="fa-solid fa-user-plus"></i> Invite More
          </button>
        </div>

        {referralsList.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>👥</div>
            <p style={s.emptyText}>
              No referred users found yet.<br/>
              Share your link now and start earning 100% referral bonuses.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.65rem 1rem', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Name</th>
                  <th style={{ padding: '0.65rem 1rem', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Email</th>
                  <th style={{ padding: '0.65rem 1rem', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {referralsList.map((u, i) => (
                  <tr key={i}>
                    <td style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', color: '#fff', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>{u.name}</td>
                    <td style={{ padding: '0.7rem 1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>{u.email}</td>
                    <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.05em' }}>ACTIVE</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── HOW IT WORKS (3 Steps) ─── */}
      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.85rem' }}>How It Works</div>
        <div style={s.stepsGrid}>
          <div style={s.stepCard}>
            <div style={s.stepAccent('#a855f7')}></div>
            <div style={s.stepNum('#a855f7')}>1</div>
            <h5 style={s.stepTitle}>Post Your Link</h5>
            <p style={s.stepDesc}>Share it on social media, stories, bios, gaming groups, and messages.</p>
          </div>
          <div style={s.stepCard}>
            <div style={s.stepAccent('#ec4899')}></div>
            <div style={s.stepNum('#ec4899')}>2</div>
            <h5 style={s.stepTitle}>Friend Signs Up</h5>
            <p style={s.stepDesc}>Anyone who joins using your link is connected to your referral account.</p>
          </div>
          <div style={s.stepCard}>
            <div style={s.stepAccent('#ffd700')}></div>
            <div style={s.stepNum('#d97706')}>3</div>
            <h5 style={s.stepTitle}>Grow The Community</h5>
            <p style={s.stepDesc}>Help more players discover JackpotRoyals by sharing your referral link.</p>
          </div>
        </div>
      </div>

      {/* ─── SHARE BUTTONS ─── */}
      <div style={s.shareGrid}>
        <button style={s.shareBtn('#25D366', '0 4px 20px rgba(37,211,102,0.2)')} onClick={shareWhatsApp}>
          <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Share on WhatsApp
        </button>
        <button style={s.shareBtn('rgba(255,255,255,0.04)', 'none')} onClick={shareSMS}>
          <i className="fa-solid fa-comment-sms" style={{ fontSize: '1rem' }}></i> Share SMS
        </button>
        <button style={s.shareBtn('rgba(255,255,255,0.04)', 'none')} onClick={() => copy(referralLink, 'Referral link')}>
          <i className="fa-solid fa-link" style={{ fontSize: '0.9rem' }}></i> Copy Link
        </button>
      </div>

      {/* ─── BOTTOM BANNER ─── */}
      <div style={s.banner}>
        <div style={s.bannerLeft}>
          <div style={s.bannerEmoji}>🚀</div>
          <div>
            <h4 style={s.bannerTitle}>Share More, Grow More</h4>
            <p style={s.bannerDesc}>Post your referral link on social media, share it in active gaming groups, and invite friends directly.</p>
          </div>
        </div>
        <button style={s.btnPrimary} onClick={() => copy(promoText, 'Promo text')}>
          <i className="fa-solid fa-share-nodes"></i> Community Sharing
        </button>
      </div>

    </div>
  );
}
