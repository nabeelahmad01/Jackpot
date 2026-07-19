'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';

const subscribe = () => () => {};

function getDeviceSnapshot() {
  if (typeof window === 'undefined') return 0;

  const userAgent = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    // iPadOS 13+ reports as Mac; detect via touch support.
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.Capacitor?.isNativePlatform?.() === true;
  // Real iOS browsers (Safari, Chrome, Firefox, Edge...) all expose an
  // "Add to Home Screen" option in their Share menu. Only embedded in-app
  // webviews (Instagram, Facebook, TikTok, etc.) hide it, so there we must
  // send the user out to a real browser first.
  const isInAppWebview =
    /FBAN|FBAV|Instagram|Line|Twitter|Snapchat|TikTok|Pinterest|LinkedInApp|MicroMessenger/i.test(
      userAgent
    );
  return (
    (isIOS ? 1 : 0) |
    (isAndroid ? 2 : 0) |
    (isStandalone ? 4 : 0) |
    (isInAppWebview ? 8 : 0)
  );
}

export default function AppInstallModal({
  isOpen,
  onClose,
  onInstallPwa,
  androidAppUrl = '/downloads/jackpot-royals.apk'
}) {
  const deviceFlags = useSyncExternalStore(subscribe, getDeviceSnapshot, () => 0);
  const device = {
    isIOS: Boolean(deviceFlags & 1),
    isAndroid: Boolean(deviceFlags & 2),
    isStandalone: Boolean(deviceFlags & 4),
    isInAppWebview: Boolean(deviceFlags & 8)
  };
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  if (!isOpen) return null;

  const choosePlatform = (platform) => {
    setSelectedPlatform(platform);
    if (platform === 'android') {
      window.location.assign(androidAppUrl);
    }
  };

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      /* clipboard blocked — user can copy from the address bar */
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
        <p className="app-install-lead">
          Install once for a fullscreen app experience and automatic website updates.
        </p>

        {!device.isStandalone && (
          <div className="app-platform-grid">
            <button
              type="button"
              className={`app-platform-card ${device.isAndroid ? 'recommended' : ''}`}
              onClick={() => choosePlatform('android')}
            >
              <i className="fa-brands fa-android" aria-hidden="true"></i>
              <strong>Android</strong>
              <span>Download APK</span>
            </button>
            <button
              type="button"
              className={`app-platform-card ${device.isIOS ? 'recommended' : ''}`}
              onClick={() => setSelectedPlatform('ios')}
            >
              <i className="fa-brands fa-apple" aria-hidden="true"></i>
              <strong>iPhone</strong>
              <span>Add to Home Screen</span>
            </button>
          </div>
        )}

        {selectedPlatform === 'ios' && !device.isStandalone && (
          <div className="ios-install-steps">
            {device.isInAppWebview ? (
              <>
                <strong>Open in your browser first</strong>
                <p>
                  You’re inside another app’s browser (like Instagram or Facebook),
                  which hides the install option. Open this page in <b>Safari</b> or
                  <b> Chrome</b> to add the app.
                </p>
                <ol>
                  <li>Copy the link below.</li>
                  <li>Open the <b>Safari</b> or <b>Chrome</b> app and paste the link.</li>
                  <li>Then follow the “Add to Home Screen” steps.</li>
                </ol>
                <button type="button" className="pwa-install-fallback" onClick={copyPageLink}>
                  <i className="fa-solid fa-link" aria-hidden="true"></i>
                  {linkCopied ? 'Link copied!' : 'Copy link'}
                </button>
              </>
            ) : (
              <>
                <strong>Install on iPhone / iPad</strong>
                <ol>
                  <li>
                    Tap the <b>Share</b> button{' '}
                    <i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
                    {' '}(in Safari it’s at the bottom; in Chrome it’s at the top-right).
                  </li>
                  <li>Scroll and tap <b>“Add to Home Screen”</b>.</li>
                  <li>Tap <b>Add</b> in the top-right corner.</li>
                </ol>
                <p>
                  Open Jackpot Royals from its new Home Screen icon — it launches
                  fullscreen, like a native app. <b>Tip:</b> Safari gives the most
                  app-like result.
                </p>
              </>
            )}
          </div>
        )}

        {!selectedPlatform && !device.isStandalone && (
          <button type="button" className="pwa-install-fallback" onClick={onInstallPwa}>
            <i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
            Use browser install
          </button>
        )}
      </div>
    </div>
  );
}
