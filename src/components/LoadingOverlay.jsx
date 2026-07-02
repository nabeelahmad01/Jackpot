import React from 'react';

export default function LoadingOverlay({ active }) {
  if (!active) return null;

  return (
    <div className="loading-overlay active" aria-hidden="false" role="presentation">
      <div className="loader-content">
        <div className="spinner-container">
          <div className="spinner-outer"></div>
          <div className="spinner-inner"></div>
          <div className="spinner-dot"></div>
        </div>
        <p className="loading-text">Please wait…</p>
        <p className="loading-subtext">Don't close this page.</p>
      </div>
    </div>
  );
}
