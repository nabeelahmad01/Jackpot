import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function SettingsTab({ onUpdateSettings }) {
  const { data: settingsData, error, mutate } = useSWR('/api/settings', fetcher);

  const [firstBonusInput, setFirstBonusInput] = useState(300);
  const [regularBonusInput, setRegularBonusInput] = useState(20);
  const [referralBonusInput, setReferralBonusInput] = useState(10);
  const [usdtAddressInput, setUsdtAddressInput] = useState('');
  const [usdtQrCodeInput, setUsdtQrCodeInput] = useState('');
  const [affiliatePayoutNetwork, setAffiliatePayoutNetwork] = useState('TRC20');
  const [affiliatePayoutWallet, setAffiliatePayoutWallet] = useState('');
  const [affiliatePayoutQrCode, setAffiliatePayoutQrCode] = useState('');
  const [affiliatePayoutWalletBEP20, setAffiliatePayoutWalletBEP20] = useState('');
  const [affiliatePayoutQrBEP20, setAffiliatePayoutQrBEP20] = useState('');
  const [affiliatePlatformCommissionRate, setAffiliatePlatformCommissionRate] = useState(90);
  const [adPaymentNetwork, setAdPaymentNetwork] = useState('BEP20');
  const [adPaymentWallet, setAdPaymentWallet] = useState('');
  const [adPaymentQrCode, setAdPaymentQrCode] = useState('');
  const [adBudgetLimit, setAdBudgetLimit] = useState(6000);

  // Sync settings inputs when SWR loads data
  useEffect(() => {
    if (settingsData?.settings) {
      setFirstBonusInput(settingsData.settings.firstDepositBonus);
      setRegularBonusInput(settingsData.settings.regularDepositBonus);
      setReferralBonusInput(settingsData.settings.referralBonus || 10);
      setUsdtAddressInput(settingsData.settings.usdtAddress || '');
      setUsdtQrCodeInput(settingsData.settings.usdtQrCode || '');
      setAffiliatePayoutNetwork(settingsData.settings.affiliatePayoutNetwork || 'TRC20');
      setAffiliatePayoutWallet(settingsData.settings.affiliatePayoutWallet || '');
      setAffiliatePayoutQrCode(settingsData.settings.affiliatePayoutQrCode || '');
      setAffiliatePayoutWalletBEP20(settingsData.settings.affiliatePayoutWalletBEP20 || '');
      setAffiliatePayoutQrBEP20(settingsData.settings.affiliatePayoutQrBEP20 || '');
      setAffiliatePlatformCommissionRate(settingsData.settings.affiliatePlatformCommissionRate ?? 90);
      setAdPaymentNetwork(settingsData.settings.adPaymentNetwork || 'BEP20');
      setAdPaymentWallet(settingsData.settings.adPaymentWallet || '');
      setAdPaymentQrCode(settingsData.settings.adPaymentQrCode || '');
      setAdBudgetLimit(settingsData.settings.adBudgetLimit ?? 6000);
    }
  }, [settingsData]);

  const handleQrCodeChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUsdtQrCodeInput(reader.result);
      alert('TRC20 QR Code screenshot loaded. Click Save configurations to update!');
    };
    reader.readAsDataURL(file);
  };

  const handleAffiliateQrChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAffiliatePayoutQrCode(reader.result);
      alert('Affiliate payout QR loaded. Click Save configurations to update!');
    };
    reader.readAsDataURL(file);
  };

  const handleAffiliateQrBep20Change = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAffiliatePayoutQrBEP20(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAdQrChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAdPaymentQrCode(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstDepositBonus: firstBonusInput,
          regularDepositBonus: regularBonusInput,
          referralBonus: referralBonusInput,
          usdtAddress: usdtAddressInput,
          usdtQrCode: usdtQrCodeInput,
          affiliatePayoutNetwork,
          affiliatePayoutWallet,
          affiliatePayoutQrCode,
          affiliatePayoutWalletBEP20,
          affiliatePayoutQrBEP20,
          affiliatePlatformCommissionRate,
          adPaymentNetwork,
          adPaymentWallet,
          adPaymentQrCode,
          adBudgetLimit
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('System settings updated successfully!');
        mutate();
        if (onUpdateSettings) {
          await onUpdateSettings(firstBonusInput, regularBonusInput, referralBonusInput, usdtAddressInput, usdtQrCodeInput, affiliatePayoutNetwork, affiliatePayoutWallet, affiliatePayoutQrCode, affiliatePlatformCommissionRate);
        }
      } else {
        alert(data.message || 'Failed to update settings.');
      }
    } catch (err) {
      console.error(err);
      alert('Connection error updating settings.');
    }
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

        <div className="input-group" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="settings-usdt-address">Platform Owner USDT Address (Zelle/USDT Wallet)</label>
          <div className="input-wrapper">
            <i className="fa-solid fa-wallet input-icon" style={{ color: '#ffcc00' }}></i>
            <input
              type="text"
              id="settings-usdt-address"
              placeholder="e.g. TR7NHgoKwqTvF24F7545G... or cashapp tag"
              value={usdtAddressInput}
              onChange={(e) => setUsdtAddressInput(e.target.value)}
            />
          </div>
          <span className="game-tap-tip">The wallet address independent Type B distributors will send their platform website commission payments to.</span>
        </div>

        <div className="input-group" style={{ marginTop: '1.5rem' }}>
          <label>TRC20 QR Code Screenshot</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleQrCodeChange}
              style={{ color: '#888', fontSize: '0.75rem' }}
            />
            {usdtQrCodeInput && (
              <div style={{ position: 'relative' }}>
                <img
                  src={usdtQrCodeInput}
                  alt="USDT QR Code"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button
                  type="button"
                  onClick={() => setUsdtQrCodeInput('')}
                  style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>
            )}
          </div>
          <span className="game-tap-tip">Upload a QR Code screenshot so distributors can quickly scan and pay.</span>
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ fontSize: '0.95rem', color: 'var(--gold-primary)', marginBottom: '1rem' }}>
            <i className="fa-solid fa-users" style={{ marginRight: '0.4rem' }}></i> Affiliate Commission Payout Settings
          </h4>

          <div className="input-group">
            <label>Affiliate Crypto Network</label>
            <select
              value={affiliatePayoutNetwork}
              onChange={(e) => setAffiliatePayoutNetwork(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}
            >
              <option value="TRC20">USDT (TRC20)</option>
              <option value="BEP20">BNB Smart Chain (BEP20)</option>
            </select>
            <span className="game-tap-tip">Which crypto network affiliates will see when requesting commission withdrawal.</span>
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>USDT TRC20 Wallet + QR</label>
            <input
              type="text"
              placeholder="TRC20 wallet address"
              value={affiliatePayoutWallet}
              onChange={(e) => setAffiliatePayoutWallet(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '0.5rem' }}
            />
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="file" accept="image/*" onChange={handleAffiliateQrChange} style={{ color: '#888', fontSize: '0.75rem' }} />
              {affiliatePayoutQrCode && (
                <img src={affiliatePayoutQrCode} alt="TRC20 QR" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
              )}
            </div>
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>USDT BEP20 Wallet + QR</label>
            <input
              type="text"
              placeholder="BEP20 wallet address (0x...)"
              value={affiliatePayoutWalletBEP20}
              onChange={(e) => setAffiliatePayoutWalletBEP20(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '0.5rem' }}
            />
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="file" accept="image/*" onChange={handleAffiliateQrBep20Change} style={{ color: '#888', fontSize: '0.75rem' }} />
              {affiliatePayoutQrBEP20 && (
                <img src={affiliatePayoutQrBEP20} alt="BEP20 QR" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
              )}
            </div>
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Platform Commission Share (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={affiliatePlatformCommissionRate}
              onChange={(e) => setAffiliatePlatformCommissionRate(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}
            />
            <span className="game-tap-tip">Shown to affiliates as platform share (affiliate share = 100 - this value).</span>
          </div>
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <h4 style={{ fontSize: '0.95rem', color: 'var(--gold-primary)', marginBottom: '1rem' }}>
            <i className="fa-solid fa-bullhorn" style={{ marginRight: '0.4rem' }}></i> Affiliate Ads Payment Settings
          </h4>

          <div className="input-group">
            <label>Ads Budget Limit Per Agent ($)</label>
            <input type="number" min="0" step="1" value={adBudgetLimit} onChange={(e) => setAdBudgetLimit(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }} />
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Ads Payment Network</label>
            <select value={adPaymentNetwork} onChange={(e) => setAdPaymentNetwork(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}>
              <option value="BEP20">BNB Smart Chain (BEP20)</option>
              <option value="TRC20">USDT (TRC20)</option>
            </select>
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Ads Payment Wallet Address</label>
            <input type="text" placeholder="Wallet for ad budget deposits" value={adPaymentWallet} onChange={(e) => setAdPaymentWallet(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }} />
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label>Ads Payment QR Code</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="file" accept="image/*" onChange={handleAdQrChange} style={{ color: '#888', fontSize: '0.75rem' }} />
              {adPaymentQrCode && (
                <img src={adPaymentQrCode} alt="Ads QR" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
              )}
            </div>
          </div>
        </div>

        <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', marginTop: '2rem' }}>
          SAVE CONFIGURATIONS &rarr;
        </button>
      </form>
    </section>
  );
}
