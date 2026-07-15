'use client';

import React from 'react';
import { isChunkLoadFailure } from '../lib/lazyWithRetry';

export default class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    if (isChunkLoadFailure(error)) {
      window.location.reload();
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        color: '#fff'
      }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.5rem', color: '#fbbf24' }} />
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>This section couldn&apos;t load</h2>
        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Reload to try again, or go back to dashboard.</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#fff',
              color: '#111',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload
          </button>
          {this.props.onBack && (
            <button
              type="button"
              onClick={this.props.onBack}
              style={{
                padding: '0.65rem 1.25rem',
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Back
            </button>
          )}
        </div>
      </div>
    );
  }
}
