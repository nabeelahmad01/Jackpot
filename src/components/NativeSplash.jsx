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

function isAndroidNativeShell() {
  if (typeof window === 'undefined') return false;
  try {
    return window.Capacitor?.getPlatform?.() === 'android';
  } catch {
    return /Android/i.test(window.navigator.userAgent || '') &&
      /JackpotRoyalsNative/i.test(window.navigator.userAgent || '');
  }
}

export default function NativeSplash() {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef(null);
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
  };

  useEffect(() => {
    // Android APK already plays the splash video natively in MainActivity.
    if (isAndroidNativeShell()) {
      return undefined;
    }

    const enable = () => {
      if (!detectAppMode() || dismissedRef.current) return;
      setVisible(true);
    };

    enable();
    const timer = window.setTimeout(enable, 250);
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
        video.playsInline = true;
        await video.play();
      } catch {
        // Keep overlay visible briefly; dismiss if autoplay is blocked.
        window.setTimeout(dismiss, 1500);
      }
    };

    tryPlay();
    const hardTimeout = window.setTimeout(dismiss, 12000);
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
