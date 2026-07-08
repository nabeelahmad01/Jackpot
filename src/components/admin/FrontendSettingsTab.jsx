import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function FrontendSettingsTab({ adminUser }) {
  const { data, error, mutate } = useSWR('/api/settings/frontend', fetcher);

  const [logoUrl, setLogoUrl] = useState('');
  const [withdrawNotice, setWithdrawNotice] = useState('');
  const [cashoutNotice, setCashoutNotice] = useState('');
  const [slide1, setSlide1] = useState('');
  const [slide2, setSlide2] = useState('');
  const [slide3, setSlide3] = useState('');
  const [chimeActive, setChimeActive] = useState(true);
  const [venmoActive, setVenmoActive] = useState(true);
  const [cashappActive, setCashappActive] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Seed form state when SWR loaded
  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setLogoUrl(s.logoUrl || '/jackpot_lion_mascot.png?v=2');
      setWithdrawNotice(s.withdrawNotice || 'Fastest Withdrawals inside 5 Minutes!');
      setCashoutNotice(s.cashoutNotice || 'Standard cashout processing hours: 9 AM - 11 PM EST');
      setSlide1(s.slides?.[0] || '/slide1.jpg');
      setSlide2(s.slides?.[1] || '/slide2.jpg');
      setSlide3(s.slides?.[2] || '/slide3.jpg');
      setChimeActive(s.chimeActive !== false);
      setVenmoActive(s.venmoActive !== false);
      setCashappActive(s.cashappActive !== false);
    }
  }, [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/settings/frontend', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl,
          withdrawNotice,
          cashoutNotice,
          slides: [slide1, slide2, slide3],
          chimeActive,
          venmoActive,
          cashappActive
        })
      });

      const resData = await response.json();
      if (resData.success) {
        setSaveSuccess(true);
        mutate();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(resData.message || 'Failed to update frontend settings.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating frontend settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = !data && !error;

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ marginBottom: '1.5rem' }}>
        <h3>
          <i className="fa-solid fa-palette gold-text"></i> Player Frontend Settings CMS
        </h3>
        <p className="game-tap-tip" style={{ marginTop: '0.25rem' }}>
          Configure live layout variables, banners, logos, and payment gateway listings shown to players.
        </p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--gold-primary)' }}></i>
          <p style={{ marginTop: '0.5rem', opacity: 0.5 }}>Loading CMS configurations...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} noValidate style={{ maxWidth: '650px' }}>
          
          {saveSuccess && (
            <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#4ade80', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-circle-check"></i> Frontend settings saved and synced successfully!
            </div>
          )}

          {/* Logo configuration */}
          <div className="input-group">
            <label htmlFor="cms-logo">Website Brand Logo Image Path/URL</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-image input-icon"></i>
              <input
                type="text"
                id="cms-logo"
                placeholder="/jackpot_lion_mascot.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Banner Notices */}
          <div className="input-group">
            <label htmlFor="cms-withdraw">Lobby Hero Promo Text</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-trophy input-icon"></i>
              <input
                type="text"
                id="cms-withdraw"
                placeholder="e.g. Fastest Withdrawals inside 5 Minutes!"
                value={withdrawNotice}
                onChange={(e) => setWithdrawNotice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="cms-cashout">Lobby Cashout Notice Text</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-circle-exclamation input-icon"></i>
              <input
                type="text"
                id="cms-cashout"
                placeholder="e.g. Standard cashout processing hours: 9 AM - 11 PM EST"
                value={cashoutNotice}
                onChange={(e) => setCashoutNotice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Homepage slides */}
          <div style={{ background: '#0b0d16', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Homepage Slideshow Images (URLs)
            </h4>
            
            <div className="input-group">
              <label>Slide Image 1</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-link input-icon"></i>
                <input
                  type="text"
                  placeholder="URL to image..."
                  value={slide1}
                  onChange={(e) => setSlide1(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Slide Image 2</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-link input-icon"></i>
                <input
                  type="text"
                  placeholder="URL to image..."
                  value={slide2}
                  onChange={(e) => setSlide2(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Slide Image 3</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-link input-icon"></i>
                <input
                  type="text"
                  placeholder="URL to image..."
                  value={slide3}
                  onChange={(e) => setSlide3(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Active Gateways */}
          <div style={{ background: '#0b0d16', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Active Withdrawal Methods
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input
                  type="checkbox"
                  checked={chimeActive}
                  onChange={(e) => setChimeActive(e.target.checked)}
                />
                Chime Payment Gateway Active
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input
                  type="checkbox"
                  checked={venmoActive}
                  onChange={(e) => setVenmoActive(e.target.checked)}
                />
                Venmo Payment Gateway Active
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                <input
                  type="checkbox"
                  checked={cashappActive}
                  onChange={(e) => setCashappActive(e.target.checked)}
                />
                Cash App Payment Gateway Active
              </label>
            </div>
          </div>

          <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isSaving}>
            {isSaving ? 'SAVING CHANGES...' : 'SAVE FRONTEND SETTINGS'}
          </button>
        </form>
      )}
    </section>
  );
}
