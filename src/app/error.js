'use client';

export default function Error({ reset }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505',
      color: '#fff',
      flexDirection: 'column',
      gap: '1rem',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '3rem', color: '#fbbf24' }} />
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>This page couldn&apos;t load</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Reload to try again, or go back.</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '0.75rem 1.5rem',
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
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            padding: '0.75rem 1.5rem',
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
      </div>
    </div>
  );
}
