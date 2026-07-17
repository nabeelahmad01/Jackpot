'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';

const subscribe = () => () => {};

function getDeviceSnapshot() {
  if (typeof window === 'undefined') return 0;

  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.Capacitor?.isNativePlatform?.() === true;
  return (isIOS ? 1 : 0) | (isAndroid ? 2 : 0) | (isStandalone ? 4 : 0);
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
    isStandalone: Boolean(deviceFlags & 4)
  };
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  if (!isOpen) return null;

  const choosePlatform = (platform) => {
    setSelectedPlatform(platform);
    if (platform === 'android') {
      window.location.assign(androidAppUrl);
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
            <strong>Install on iPhone</strong>
            <ol>
              <li>Open this page in Safari.</li>
              <li>Tap the Share button in Safari.</li>
              <li>Choose “Add to Home Screen”, then tap Add.</li>
            </ol>
            <p>Open Jackpot Royals from its new Home Screen icon.</p>
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
