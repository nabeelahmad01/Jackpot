'use client';

import { useEffect, useRef, useState } from 'react';

function detectAppMode() {
  if (typeof window === 'undefined') return false;

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  let capacitorNative = false;
  try {
    capacitorNative = window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    capacitorNative = false;
  }

  const nativeUa = /JackpotRoyalsNative/i.test(window.navigator.userAgent || '');
  return standalone || capacitorNative || nativeUa;
}

export default function NativeSplash() {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef(null);
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    try {
      sessionStorage.setItem('jr_splash_shown', '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('jr_splash') === 'done') {
        sessionStorage.setItem('jr_splash_shown', '1');
        params.delete('jr_splash');
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next || '/');
      }
      // Show once per app/browser session so login ↔ lobby does not replay.
      if (sessionStorage.getItem('jr_splash_shown') === '1') return undefined;
    } catch {
      // ignore
    }

    const enable = () => {
      if (!detectAppMode() || dismissedRef.current) return;
      setVisible(true);
    };

    enable();
    const timer = window.setTimeout(enable, 200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const tryPlay = async () => {
      try {
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.playsInline = true;
        video.currentTime = 0;
        await video.play();
      } catch {
        window.setTimeout(dismiss, 1200);
      }
    };

    tryPlay();
    const hardTimeout = window.setTimeout(dismiss, 10000);
    return () => window.clearTimeout(hardTimeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="native-launch-screen" role="dialog" aria-label="Jackpot Royals launching">
      <video
        ref={videoRef}
        className="native-launch-video"
        src="/jackpot-splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        onEnded={dismiss}
        onError={dismiss}
      />
      <button
        type="button"
        className="native-launch-skip"
        onClick={dismiss}
        aria-label="Skip intro"
      >
        Skip
      </button>
    </div>
  );
}
