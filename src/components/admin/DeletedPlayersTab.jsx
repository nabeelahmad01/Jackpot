'use client';

import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function DeletedPlayersTab() {
  const { data, error, mutate } = useSWR('/api/admin/deleted-players', fetcher);
  const [restoringEmail, setRestoringEmail] = useState(null);

  const deletedPlayers = data?.deletedPlayers || [];

  const handleRestore = async (email) => {
    if (!window.confirm(`Are you sure you want to restore the player account "${email}"? All their details will be restored.`)) {
      return;
    }

    setRestoringEmail(email);
    try {
      const response = await fetch('/api/admin/deleted-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Player account restored successfully!');
        mutate();
      } else {
        alert(resData.message || 'Failed to restore player account.');
      }
    } catch (err) {
      console.error(err);
      alert('Error restoring player account.');
    } finally {
      setRestoringEmail(null);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <p>Error loading deleted accounts history.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
        <p>Loading deleted player accounts archive...</p>
      </div>
    );
  }

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3><i className="fa-solid fa-trash-arrow-up gold-text"></i> Deleted Player Accounts</h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            These accounts have been deleted. You can restore them with the "Undo" button. If not restored, they will be permanently purged after 30 days.
          </p>
        </div>
        <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.35rem 0.6rem', borderRadius: '6px', fontWeight: 'bold' }}>
          AUTO-DELETE AFTER 30 DAYS
        </span>
      </div>

      <div style={{ overflowX: 'auto', background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>NAME</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>EMAIL</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>COINS</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>DELETED DATE</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {deletedPlayers.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  No deleted player accounts recorded in the archive.
                </td>
              </tr>
            ) : (
              deletedPlayers.map((player) => (
                <tr key={player.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{player.name}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{player.email}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                    ${(player.coins || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#888' }}>
                    {player.deletedAt ? new Date(player.deletedAt).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <button
                      onClick={() => handleRestore(player.email)}
                      disabled={restoringEmail === player.email}
                      className="submit-btn"
                      style={{
                        margin: 0,
                        padding: '0.35rem 0.75rem',
                        width: 'auto',
                        fontSize: '0.675rem',
                        background: '#3b82f6',
                        color: '#fff',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        opacity: restoringEmail === player.email ? 0.6 : 1
                      }}
                    >
                      {restoringEmail === player.email ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Undoing...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-trash-arrow-up"></i> Undo (Restore)
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
