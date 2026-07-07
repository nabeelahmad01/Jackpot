import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function SettingsTab({ onUpdateSettings }) {
  const { data: settingsData, error, mutate } = useSWR('/api/settings', fetcher);

  const [firstBonusInput, setFirstBonusInput] = useState(300);
  const [regularBonusInput, setRegularBonusInput] = useState(20);
  const [referralBonusInput, setReferralBonusInput] = useState(10);

  // Sync settings inputs when SWR loads data
  useEffect(() => {
    if (settingsData?.settings) {
      setFirstBonusInput(settingsData.settings.firstDepositBonus);
      setRegularBonusInput(settingsData.settings.regularDepositBonus);
      setReferralBonusInput(settingsData.settings.referralBonus || 10);
    }
  }, [settingsData]);

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    await onUpdateSettings(firstBonusInput, regularBonusInput, referralBonusInput);
    mutate(); // reload settings SWR cache
  };

  if (!settingsData && !error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
        <p>Loading settings configuration...</p>
      </div>
    );
  }

  return (
    <section className="admin-section-card" style={{ maxWidth: '600px', margin: '0 auto', animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ marginBottom: '1.25rem' }}>
        <h3><i className="fa-solid fa-sliders gold-text"></i> System Settings & Bonus Percentages</h3>
        <p style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--text-muted)' }}>
          Configure signup and repeat deposit bonuses allotted to players.
        </p>
      </div>

      <form onSubmit={handleSettingsSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="settings-first-bonus">First Deposit Signup Bonus (%)</label>
          <div className="input-wrapper">
            <i className="fa-solid fa-gift input-icon" style={{ color: '#00ff66' }}></i>
            <input
              type="number"
              id="settings-first-bonus"
              placeholder="e.g. 300"
              value={firstBonusInput}
              onChange={(e) => setFirstBonusInput(e.target.value)}
              required
            />
            <span style={{ paddingRight: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
          </div>
          <span className="game-tap-tip">Calculates multiplier of deposit when a player makes their very first payment (e.g. 300% adds 3x coins).</span>
        </div>

        <div className="input-group" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="settings-regular-bonus">Regular Repeat Deposit Bonus (%)</label>
          <div className="input-wrapper">
            <i className="fa-solid fa-rotate input-icon" style={{ color: '#00d2ff' }}></i>
            <input
              type="number"
              id="settings-regular-bonus"
              placeholder="e.g. 20"
              value={regularBonusInput}
              onChange={(e) => setRegularBonusInput(e.target.value)}
              required
            />
            <span style={{ paddingRight: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
          </div>
          <span className="game-tap-tip">Calculates multiplier of deposit when a player makes repeat deposits (e.g. 20% adds 1.2x coins).</span>
        </div>

        <div className="input-group" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="settings-referral-bonus">Referral Deposit Reward Bonus (%)</label>
          <div className="input-wrapper">
            <i className="fa-solid fa-users-viewfinder input-icon" style={{ color: '#a855f7' }}></i>
            <input
              type="number"
              id="settings-referral-bonus"
              placeholder="e.g. 10"
              value={referralBonusInput}
              onChange={(e) => setReferralBonusInput(e.target.value)}
              required
            />
            <span style={{ paddingRight: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
          </div>
          <span className="game-tap-tip">Calculates reward coins allotted to the referrer when their referred friend makes a deposit (e.g. 10% sends 10% of deposit value to referrer).</span>
        </div>

        <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', marginTop: '2rem' }}>
          SAVE CONFIGURATIONS &rarr;
        </button>
      </form>
    </section>
  );
}
