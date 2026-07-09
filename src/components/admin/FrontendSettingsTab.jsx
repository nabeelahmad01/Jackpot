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

  // Rewards & limit configurations
  const [firstDepositBonus, setFirstDepositBonus] = useState(300);
  const [signupFreeplay, setSignupFreeplay] = useState(3);
  const [minimumDepositLimit, setMinimumDepositLimit] = useState(5);
  const [minimumWithdrawalLimit, setMinimumWithdrawalLimit] = useState(5);

  // New Landing Copy line settings
  const [landingWelcome, setLandingWelcome] = useState('');
  const [landingGrab, setLandingGrab] = useState('');
  const [landingQuickSignup, setLandingQuickSignup] = useState('');
  const [landingSignupWithGoogle, setLandingSignupWithGoogle] = useState('');
  const [landingOrCreate, setLandingOrCreate] = useState('');
  const [landingMessengerWarning, setLandingMessengerWarning] = useState('');

  // Marquee Cards
  const [marqueePayouts, setMarqueePayouts] = useState([]);

  // Accordion cashout rules
  const [cashoutRules, setCashoutRules] = useState([]);
  
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
      setFirstDepositBonus(s.firstDepositBonus !== undefined ? s.firstDepositBonus : 300);
      setSignupFreeplay(s.signupFreeplay !== undefined ? s.signupFreeplay : 3);
      setMinimumDepositLimit(s.minimumDepositLimit !== undefined ? s.minimumDepositLimit : 5);
      setMinimumWithdrawalLimit(s.minimumWithdrawalLimit !== undefined ? s.minimumWithdrawalLimit : 5);

      setLandingWelcome(s.landingWelcome || 'WELCOME TO JACKPOT ROYALS');
      setLandingGrab(s.landingGrab || 'Grab amazing bonuses and win big!');
      setLandingQuickSignup(s.landingQuickSignup || 'Quick signup');
      setLandingSignupWithGoogle(s.landingSignupWithGoogle || 'Sign up with Google');
      setLandingOrCreate(s.landingOrCreate || 'or create account with email');
      setLandingMessengerWarning(s.landingMessengerWarning || 'Google sign-in is not supported inside Messenger. Please open this page in Chrome or Safari.');

      setMarqueePayouts(s.marqueePayouts || []);
      setCashoutRules(s.cashoutRules || []);
    }
  }, [data]);

  // Handlers for dynamic lists
  const addPayout = () => {
    setMarqueePayouts([...marqueePayouts, { name: 'Player Name', amount: '$100.00', time: 'Just now', color: 'av-purple', init: 'PL' }]);
  };
  const deletePayout = (idx) => {
    setMarqueePayouts(marqueePayouts.filter((_, i) => i !== idx));
  };
  const updatePayout = (idx, field, val) => {
    const updated = [...marqueePayouts];
    updated[idx] = { ...updated[idx], [field]: val };
    setMarqueePayouts(updated);
  };

  const addRule = () => {
    setCashoutRules([...cashoutRules, { title: 'New Cashout Rule', description: 'Describe the cashout rule terms here...' }]);
  };
  const deleteRule = (idx) => {
    setCashoutRules(cashoutRules.filter((_, i) => i !== idx));
  };
  const updateRule = (idx, field, val) => {
    const updated = [...cashoutRules];
    updated[idx] = { ...updated[idx], [field]: val };
    setCashoutRules(updated);
  };

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
          cashappActive,
          firstDepositBonus: Number(firstDepositBonus),
          signupFreeplay: Number(signupFreeplay),
          minimumDepositLimit: Number(minimumDepositLimit),
          minimumWithdrawalLimit: Number(minimumWithdrawalLimit),

          landingWelcome,
          landingGrab,
          landingQuickSignup,
          landingSignupWithGoogle,
          landingOrCreate,
          landingMessengerWarning,
          marqueePayouts,
          cashoutRules
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
        <form onSubmit={handleSave} noValidate style={{ maxWidth: '750px' }}>
          
          {saveSuccess && (
            <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#4ade80', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-circle-check"></i> Frontend settings saved and synced successfully!
            </div>
          )}

          {/* Landing page copy texts section */}
          <div style={{ background: '#0b0d16', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Landing Page Copy & Layout Lines
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Landing Welcome Subtitle Header</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-heading input-icon"></i>
                  <input type="text" value={landingWelcome} onChange={(e) => setLandingWelcome(e.target.value)} required />
                </div>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Landing Welcome Tagline Description</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-align-left input-icon"></i>
                  <input type="text" value={landingGrab} onChange={(e) => setLandingGrab(e.target.value)} required />
                </div>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Signup Tab Title</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-user-plus input-icon"></i>
                  <input type="text" value={landingQuickSignup} onChange={(e) => setLandingQuickSignup(e.target.value)} required />
                </div>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Google Button Title</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-brands fa-google input-icon"></i>
                  <input type="text" value={landingSignupWithGoogle} onChange={(e) => setLandingSignupWithGoogle(e.target.value)} required />
                </div>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Divider Text Link</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-columns input-icon"></i>
                  <input type="text" value={landingOrCreate} onChange={(e) => setLandingOrCreate(e.target.value)} required />
                </div>
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Messenger Webview Warn Alert Notice</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-circle-exclamation input-icon"></i>
                  <input type="text" value={landingMessengerWarning} onChange={(e) => setLandingMessengerWarning(e.target.value)} required />
                </div>
              </div>
            </div>
          </div>

          {/* Marquee Withdrawal Cards Slider */}
          <div style={{ background: '#0b0d16', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                Sliding Withdrawal Marquee Cards
              </h4>
              <button type="button" onClick={addPayout} className="action-row-btn" style={{ width: 'auto', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', border: '1px solid var(--gold-primary)', fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}>
                + Add Card
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {marqueePayouts.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No marquee cards configured.</div>
              ) : (
                marqueePayouts.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', background: '#07090f', padding: '0.5rem', borderRadius: '8px', alignItems: 'center' }}>
                    <input type="text" style={{ flex: 2, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.25rem' }} placeholder="Player Name" value={p.name} onChange={(e) => updatePayout(idx, 'name', e.target.value)} />
                    <input type="text" style={{ flex: 1.5, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.25rem' }} placeholder="Amount ($100.00)" value={p.amount} onChange={(e) => updatePayout(idx, 'amount', e.target.value)} />
                    <input type="text" style={{ flex: 1.5, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.25rem' }} placeholder="Time (1 hour ago)" value={p.time} onChange={(e) => updatePayout(idx, 'time', e.target.value)} />
                    <input type="text" style={{ flex: 1, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', padding: '0.25rem' }} placeholder="Initials (JM)" value={p.init} onChange={(e) => updatePayout(idx, 'init', e.target.value)} />
                    <select style={{ flex: 1.5, background: '#0b0d16', color: '#fff', fontSize: '0.7rem', padding: '0.25rem', border: '1px solid rgba(255,255,255,0.1)' }} value={p.color} onChange={(e) => updatePayout(idx, 'color', e.target.value)}>
                      <option value="av-purple">Purple</option>
                      <option value="av-blue">Blue</option>
                      <option value="av-green">Green</option>
                      <option value="av-orange">Orange</option>
                      <option value="av-red">Red</option>
                    </select>
                    <button type="button" onClick={() => deletePayout(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cashout Rules Section */}
          <div style={{ background: '#0b0d16', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                Lobby Cashout Accordion Rules
              </h4>
              <button type="button" onClick={addRule} className="action-row-btn" style={{ width: 'auto', background: 'rgba(255,215,0,0.1)', color: 'var(--gold-primary)', border: '1px solid var(--gold-primary)', fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}>
                + Add Rule
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {cashoutRules.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No cashout rules configured.</div>
              ) : (
                cashoutRules.map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#07090f', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <input type="text" style={{ flex: 1, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', padding: '0.25rem' }} placeholder="Rule Title (e.g. 1. Verification)" value={rule.title} onChange={(e) => updateRule(idx, 'title', e.target.value)} />
                      <button type="button" onClick={() => deleteRule(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                    <textarea rows="2" style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.25rem', resize: 'none', outline: 'none' }} placeholder="Rule Description text content..." value={rule.description} onChange={(e) => updateRule(idx, 'description', e.target.value)} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rewards & Limit Constraints */}
          <div style={{ background: '#0b0d16', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              Promotional Rewards & Financial Limits
            </h4>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                <label>First Deposit Promo Bonus (%)</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-gift input-icon"></i>
                  <input
                    type="number"
                    placeholder="300"
                    value={firstDepositBonus}
                    onChange={(e) => setFirstDepositBonus(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                <label>Freeplay Signup Reward ($)</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-gift input-icon"></i>
                  <input
                    type="number"
                    placeholder="3"
                    value={signupFreeplay}
                    onChange={(e) => setSignupFreeplay(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                <label>Minimum Deposit Limit ($)</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-coins input-icon"></i>
                  <input
                    type="number"
                    placeholder="5"
                    value={minimumDepositLimit}
                    onChange={(e) => setMinimumDepositLimit(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
                <label>Minimum Cashout Limit ($)</label>
                <div className="input-wrapper" style={{ background: '#07090f' }}>
                  <i className="fa-solid fa-wallet input-icon"></i>
                  <input
                    type="number"
                    placeholder="5"
                    value={minimumWithdrawalLimit}
                    onChange={(e) => setMinimumWithdrawalLimit(e.target.value)}
                    required
                  />
                </div>
              </div>
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
