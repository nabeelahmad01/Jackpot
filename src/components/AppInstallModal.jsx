'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { subscribeToPromoPush } from '../lib/pushClient';

const subscribe = () => () => {};

function getDeviceSnapshot() {
  if (typeof window === 'undefined') return 0;

  const userAgent = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.Capacitor?.isNativePlatform?.() === true;
  const isInAppWebview =
    /FBAN|FBAV|Instagram|Line|Twitter|Snapchat|TikTok|Pinterest|LinkedInApp|MicroMessenger/i.test(
      userAgent
    );
  const canShare = typeof window.navigator.share === 'function';
  return (
    (isIOS ? 1 : 0) |
    (isAndroid ? 2 : 0) |
    (isStandalone ? 4 : 0) |
    (isInAppWebview ? 8 : 0) |
    (canShare ? 16 : 0)
  );
}

export default function AppInstallModal({
  isOpen,
  onClose,
  onInstallPwa,
  androidAppUrl = '/downloads/jackpot-royals.apk',
  iosAppUrl = '',
  currentUserEmail = '',
  showToast
}) {
  const deviceFlags = useSyncExternalStore(subscribe, getDeviceSnapshot, () => 0);
  const device = {
    isIOS: Boolean(deviceFlags & 1),
    isAndroid: Boolean(deviceFlags & 2),
    isStandalone: Boolean(deviceFlags & 4),
    isInAppWebview: Boolean(deviceFlags & 8),
    canShare: Boolean(deviceFlags & 16)
  };

  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [shareTried, setShareTried] = useState(false);

  // Auto-pick the right platform when the modal opens on a phone.
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlatform(null);
      setShareTried(false);
      setBusy(false);
      return;
    }
    if (device.isStandalone) {
      setSelectedPlatform(null);
      return;
    }
    if (device.isIOS) setSelectedPlatform('ios');
    else if (device.isAndroid) setSelectedPlatform('android');
    else setSelectedPlatform(null);
  }, [isOpen, device.isIOS, device.isAndroid, device.isStandalone]);

  if (!isOpen) return null;

  const toast = (msg, type = 'info') => {
    if (typeof showToast === 'function') showToast(msg, type);
  };

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setLinkCopied(true);
      toast('Link copied — open it in Safari, then install.', 'success');
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      toast('Copy the site link from the address bar.', 'info');
    }
  };

  const installAndroid = () => {
    setSelectedPlatform('android');
    window.location.assign(androidAppUrl);
    toast('Android APK download started. Open the file to install.', 'success');
    setTimeout(() => onClose?.(), 600);
  };

  // Prefer TestFlight / App Store link when configured (real native iOS app).
  // Fallback: Share → Add to Home Screen (only if no iosAppUrl yet).
  const installIos = async () => {
    setSelectedPlatform('ios');
    const testFlightUrl = String(iosAppUrl || '').trim();
    if (testFlightUrl) {
      window.location.assign(testFlightUrl);
      toast('Opening TestFlight / install link…', 'success');
      setTimeout(() => onClose?.(), 600);
      return;
    }

    setBusy(true);
    try {
      if (device.isInAppWebview) {
        await copyPageLink();
        setShareTried(true);
        return;
      }

      if (device.canShare) {
        try {
          await navigator.share({
            title: 'Jackpot Royals',
            text: 'Add Jackpot Royals to your Home Screen',
            url: window.location.origin
          });
          setShareTried(true);
          toast('In the share sheet, tap “Add to Home Screen”, then open the new icon.', 'success');
          return;
        } catch (err) {
          if (String(err?.name || '').includes('Abort')) {
            setShareTried(true);
            return;
          }
        }
      }

      setShareTried(true);
      toast('Tap Share → Add to Home Screen to install.', 'info');
    } finally {
      setBusy(false);
    }
  };

  const enableLockScreenPush = async () => {
    if (!currentUserEmail) {
      toast('Log in first, then enable notifications.', 'info');
      return;
    }
    setPushBusy(true);
    try {
      await subscribeToPromoPush(currentUserEmail);
      toast('Lock-screen notifications enabled!', 'success');
      onClose?.();
    } catch (err) {
      toast(err?.message || 'Could not enable notifications. Allow them when prompted.', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="app-install-backdrop" onMouseDown={onClose}>
      <div
        className="app-install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-install-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="app-install-close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <Image className="app-install-logo" src="/icon-192.png" alt="" width={84} height={84} />
        <h2 id="app-install-title">Get Jackpot Royals</h2>

        {device.isStandalone ? (
          <>
            <p className="app-install-lead">
              App is installed. Enable notifications so promo offers also show on your lock screen.
            </p>
            <button
              type="button"
              className="app-install-primary"
              onClick={enableLockScreenPush}
              disabled={pushBusy}
            >
              <i className="fa-solid fa-bell" aria-hidden="true"></i>
              {pushBusy ? 'Enabling…' : 'Enable Lock Screen Notifications'}
            </button>
          </>
        ) : (
          <>
            <p className="app-install-lead">
              {device.isIOS
                ? 'Install on your iPhone — opens as a full-screen app with lock-screen offers.'
                : device.isAndroid
                  ? 'Download the Android app for lock-screen notifications and a native experience.'
                  : 'Choose your phone to install Jackpot Royals.'}
            </p>

            {/* Desktop / unknown: show both. Phones auto-select and show the CTA. */}
            {!device.isIOS && !device.isAndroid && (
              <div className="app-platform-grid">
                <button
                  type="button"
                  className="app-platform-card"
                  onClick={installAndroid}
                >
                  <i className="fa-brands fa-android" aria-hidden="true"></i>
                  <strong>Android</strong>
                  <span>Download APK</span>
                </button>
                <button
                  type="button"
                  className="app-platform-card"
                  onClick={installIos}
                >
                  <i className="fa-brands fa-apple" aria-hidden="true"></i>
                  <strong>iPhone</strong>
                  <span>{iosAppUrl ? 'Get iOS App' : 'Add to Home Screen'}</span>
                </button>
              </div>
            )}

            {selectedPlatform === 'android' && (
              <div className="app-install-action-block">
                <button
                  type="button"
                  className="app-install-primary"
                  onClick={installAndroid}
                >
                  <i className="fa-brands fa-android" aria-hidden="true"></i>
                  Download Android App (APK)
                </button>
                <p className="app-install-hint">
                  Open the downloaded file → Install. Lock-screen notifications work in the APK.
                </p>
                <button type="button" className="pwa-install-fallback" onClick={installIos}>
                  Download iOS app
                </button>
              </div>
            )}

            {selectedPlatform === 'ios' && (
              <div className="app-install-action-block">
                {String(iosAppUrl || '').trim() ? (
                  <>
                    <button
                      type="button"
                      className="app-install-primary"
                      onClick={installIos}
                    >
                      <i className="fa-brands fa-apple" aria-hidden="true"></i>
                      Install iPhone App
                    </button>
                    <p className="app-install-hint">
                      Opens Apple TestFlight (or your install link). Install TestFlight if asked, then Install Jackpot Royals. Lock-screen notifications work in the native app.
                    </p>
                  </>
                ) : device.isInAppWebview ? (
                  <>
                    <p className="app-install-hint" style={{ marginBottom: '0.85rem' }}>
                      You’re inside another app’s browser. Open this site in <b>Safari</b> (best) or Chrome, then install.
                    </p>
                    <button type="button" className="app-install-primary" onClick={copyPageLink}>
                      <i className="fa-solid fa-link" aria-hidden="true"></i>
                      {linkCopied ? 'Link copied!' : 'Copy link to open in Safari'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="app-install-primary"
                      onClick={installIos}
                      disabled={busy}
                    >
                      <i className="fa-brands fa-apple" aria-hidden="true"></i>
                      {busy ? 'Opening…' : 'Install on iPhone'}
                    </button>
                    <p className="app-install-hint">
                      {shareTried
                        ? 'In the share menu tap Add to Home Screen → Add. Then open the new icon and allow notifications.'
                        : 'One tap opens your phone’s share menu — choose Add to Home Screen. (After TestFlight is ready, set iOS App URL in admin settings for one-tap native install.)'}
                    </p>
                    {shareTried && (
                      <ol className="ios-mini-steps">
                        <li>
                          Tap <b>Add to Home Screen</b>{' '}
                          <i className="fa-solid fa-plus-square" aria-hidden="true"></i>
                        </li>
                        <li>Tap <b>Add</b>, then open the Jackpot icon</li>
                        <li>Allow notifications for lock-screen offers</li>
                      </ol>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
