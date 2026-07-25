'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

function isNativeAdminShell() {
  if (typeof window === 'undefined') return false;
  try {
    if (document.documentElement.classList.contains('admin-native-shell')) return true;
    if (/JackpotPortalNative|JackpotDistributorNative/i.test(navigator.userAgent || '')) return true;
    if (window.Capacitor?.isNativePlatform?.() === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Swipe-down pull to refresh for Portal / Distributor APK scroll areas.
 * Only arms when the scroll container is already at the top.
 */
export default function PullToRefresh({
  children,
  onRefresh,
  className = '',
  enabled = true,
  threshold = 72
}) {
  const scrollerRef = useRef(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullPxRef = useRef(0);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [nativeOk, setNativeOk] = useState(false);
  const refreshingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const nativeOkRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  enabledRef.current = enabled;
  nativeOkRef.current = nativeOk;
  onRefreshRef.current = onRefresh;
  refreshingRef.current = refreshing;

  useEffect(() => {
    setNativeOk(isNativeAdminShell());
    const t = window.setInterval(() => {
      if (isNativeAdminShell()) {
        setNativeOk(true);
        window.clearInterval(t);
      }
    }, 400);
    const stop = window.setTimeout(() => window.clearInterval(t), 5000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(stop);
    };
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current || typeof onRefreshRef.current !== 'function') return;
    setRefreshing(true);
    refreshingRef.current = true;
    setPullPx(threshold);
    pullPxRef.current = threshold;
    try {
      await onRefreshRef.current();
    } catch (err) {
      console.warn('PullToRefresh:', err?.message || err);
    } finally {
      setRefreshing(false);
      refreshingRef.current = false;
      setPullPx(0);
      pullPxRef.current = 0;
    }
  }, [threshold]);

  // Non-passive touchmove so we can preventDefault while pulling
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;

    const onTouchStart = (e) => {
      if (!enabledRef.current || !nativeOkRef.current || refreshingRef.current) return;
      if (el.scrollTop > 2) {
        pullingRef.current = false;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current || !enabledRef.current || !nativeOkRef.current || refreshingRef.current) return;
      if (el.scrollTop > 2) {
        pullingRef.current = false;
        setPullPx(0);
        pullPxRef.current = 0;
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setPullPx(0);
        pullPxRef.current = 0;
        return;
      }
      const resisted = Math.min(dy * 0.55, threshold * 1.35);
      setPullPx(resisted);
      pullPxRef.current = resisted;
      if (resisted > 8) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullPxRef.current >= threshold && !refreshingRef.current) {
        void runRefresh();
      } else {
        setPullPx(0);
        pullPxRef.current = 0;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [runRefresh, threshold]);

  const indicatorActive = pullPx > 8 || refreshing;
  const armed = pullPx >= threshold || refreshing;

  return (
    <div
      ref={scrollerRef}
      className={className}
      style={{ position: 'relative', touchAction: 'pan-y' }}
    >
      {enabled && nativeOk && (
        <div
          aria-hidden="true"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            height: indicatorActive ? Math.max(pullPx, refreshing ? 48 : 0) : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: refreshing || pullPx === 0 ? 'height 0.18s ease' : 'none',
            pointerEvents: 'none',
            color: armed ? 'var(--gold-primary)' : 'rgba(255,255,255,0.55)',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            gap: '0.45rem'
          }}
        >
          <i
            className={`fa-solid ${refreshing ? 'fa-spinner fa-spin' : 'fa-arrow-down'}`}
            style={{
              transform: refreshing
                ? undefined
                : `rotate(${armed ? 180 : Math.min(180, (pullPx / threshold) * 180)}deg)`,
              transition: 'transform 0.15s ease'
            }}
          />
          <span>{refreshing ? 'REFRESHING…' : armed ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH'}</span>
        </div>
      )}
      {children}
    </div>
  );
}
