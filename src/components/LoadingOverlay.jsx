import React from 'react';

export default function LoadingOverlay({ active }) {
  if (!active) return null;

  return (
    <div className="loading-overlay active" aria-hidden="false" role="presentation" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 7, 15, 0.95)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fade-in 0.2s ease-out'
    }}>
      <div className="loader-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Luxury Gold Medal Card with floating animation */}
        <div className="luxury-vip-medal" style={{
          position: 'relative',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          border: '3px solid var(--gold-primary)',
          background: '#000',
          boxShadow: '0 0 35px rgba(255,215,0,0.45), inset 0 0 20px rgba(255,215,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'float-animation 3s infinite ease-in-out',
          marginBottom: '1.5rem',
          overflow: 'hidden'
        }}>
          {/* Internal rotating gold sparkles ring */}
          <div className="rotating-sparkles" style={{
            position: 'absolute',
            width: '104%',
            height: '104%',
            border: '1.5px dashed rgba(255,215,0,0.3)',
            borderRadius: '50%',
            animation: 'spin-clockwise 15s infinite linear'
          }}></div>

          <img
            src="/jackpot_lion_mascot.png"
            alt="Jackpot Royals Gold Lion"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
              zIndex: 2,
              filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.4))'
            }}
          />
        </div>

        <p className="loading-text" style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.1rem',
          fontWeight: '900',
          color: '#fff',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          margin: '0 0 0.25rem 0',
          animation: 'glow-text 2s infinite ease-in-out',
          textAlign: 'center'
        }}>
          JACKPOT<span style={{ color: 'var(--gold-primary)' }}>ROYALS</span>
        </p>
        <p className="loading-subtext" style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.725rem',
          color: 'var(--text-muted)',
          margin: 0,
          letterSpacing: '0.05em',
          textAlign: 'center'
        }}>
          Please wait while we process...
        </p>
      </div>
    </div>
  );
}
