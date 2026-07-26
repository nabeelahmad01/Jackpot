'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { formatDeviceDateTime } from '../../lib/formatDateTime';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

// Human-friendly label + colour for the deleted account's type.
const ROLE_LABELS = {
  admin: 'Super Admin',
  operation_admin: 'Operation Staff',
  financial_admin: 'Financial Staff',
  coins_admin: 'Coins Staff',
  support_admin: 'Support Staff',
  distributor_staff: 'Distributor Staff',
  distributor: 'Distributor',
  user: 'Player'
};

function getAccountType(record) {
  if (record.deletedEntityType === 'distributor' || record.role === 'distributor') {
    return { label: 'Distributor', color: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)' };
  }
  const role = record.role || 'user';
  if (role === 'user') {
    return { label: 'Player', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.4)' };
  }
  if (role === 'admin') {
    return { label: 'Super Admin', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)' };
  }
  return { label: ROLE_LABELS[role] || 'Staff', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)' };
}

export default function DeletedPlayersTab() {
  const { data, error, mutate } = useSWR('/api/admin/deleted-players', fetcher);
  const [restoringEmail, setRestoringEmail] = useState(null);

  const deletedPlayers = data?.deletedPlayers || [];

  const handleRestore = async (email, record) => {
    const isDistributor =
      record?.deletedEntityType === 'distributor' || record?.role === 'distributor';
    const distDeletedPlayer = record?.deletedBy === 'distributor' || record?.wipeGameAccess === true;
    const gameCount = Array.isArray(record?.restoreGameTitles) ? record.restoreGameTitles.length : 0;
    const linkedCount = Array.isArray(record?.linkedPlayerEmails) ? record.linkedPlayerEmails.length : 0;

    let confirmMsg = `Restore "${email}"?\n\nIf this was an HQ delete, their previous game accounts will come back.`;
    if (isDistributor) {
      confirmMsg = `Restore distributor "${email}"?\n\n${linkedCount} player(s) will be re-linked — requests/deposits go back to this distributor.`;
    } else if (distDeletedPlayer) {
      const gamesList = Array.isArray(record?.restoreGameTitles) && record.restoreGameTitles.length
        ? `\nGames to recreate: ${record.restoreGameTitles.join(', ')}`
        : '';
      confirmMsg =
        `UNDO distributor delete for "${email}"?\n\n` +
        `• Player comes under YOUR Super Admin panel (not back to distributor)\n` +
        `• Old game accounts stay wiped\n` +
        `• ${gameCount > 0 ? `${gameCount} PENDING request(s) → your Requests tab (Create Account)` : 'No prior games — player can Request / Create'}\n` +
        `• Deposits / withdraws / support move to HQ` +
        gamesList;
    }
    if (!window.confirm(confirmMsg)) {
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
        alert(resData.message || 'Player account restored successfully!');
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
          <h3><i className="fa-solid fa-trash-arrow-up gold-text"></i> Deleted Accounts</h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Soft-deleted players &amp; distributors. <strong style={{ color: '#c084fc' }}>Distributor → new request</strong>:
            Undo brings the player under YOUR HQ panel, clears old game accounts, and puts Create Account requests in Requests.
            Archive auto-purges after 30 days if not restored.
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
              <th style={{ padding: '0.75rem 0.5rem' }}>TYPE</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>EMAIL</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>COINS</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>DELETED BY</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>GAMES / NOTE</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>DELETED DATE</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {deletedPlayers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  No deleted accounts recorded in the archive.
                </td>
              </tr>
            ) : (
              deletedPlayers.map((player) => (
                <tr key={player.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{player.name}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {(() => {
                      const t = getAccountType(player);
                      return (
                        <span style={{ fontSize: '0.6rem', background: t.bg, color: t.color, border: `1px solid ${t.border}`, padding: '0.2rem 0.5rem', borderRadius: '5px', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {t.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{player.email}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                    ${(player.coins || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {player.deletedBy === 'distributor' || player.wipeGameAccess ? (
                      <span style={{ fontSize: '0.6rem', color: '#c084fc', fontWeight: 'bold' }}>Distributor → HQ Undo</span>
                    ) : player.deletedEntityType === 'distributor' || player.role === 'distributor' ? (
                      <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: 'bold' }}>Distributor entity</span>
                    ) : (
                      <span style={{ fontSize: '0.6rem', color: '#4ade80', fontWeight: 'bold' }}>HQ → keep games</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#aaa', fontSize: '0.68rem', maxWidth: '12rem' }}>
                    {player.deletedBy === 'distributor' || player.wipeGameAccess ? (
                      Array.isArray(player.restoreGameTitles) && player.restoreGameTitles.length > 0
                        ? player.restoreGameTitles.join(', ')
                        : 'No games saved — player can Request'
                    ) : player.deletedEntityType === 'distributor' || player.role === 'distributor' ? (
                      `${Array.isArray(player.linkedPlayerEmails) ? player.linkedPlayerEmails.length : 0} linked player(s)`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#888' }}>
                    {formatDeviceDateTime(player.deletedAt)}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <button
                      onClick={() => handleRestore(player.email, player)}
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
