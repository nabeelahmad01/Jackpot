'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function PromotionsTab({ adminUser }) {
  const [activeSubTab, setActiveSubTab] = useState('segments'); // 'segments' | 'broadcast'

  // SEGMENTS TAB STATES
  const [segment, setSegment] = useState('subscribed'); // 'subscribed' | 'unsubscribed' | 'active'
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch segmented users
  const { data: userData, mutate: mutateUsers, error: userError } = useSWR(
    `/api/users?segment=${segment}&search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=${limit}`,
    fetcher
  );

  const usersList = userData?.users || [];
  const totalUsers = userData?.totalUsers || 0;
  const totalPages = userData?.totalPages || 1;

  // BROADCAST TAB FORM STATES
  const [promoTitle, setPromoTitle] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoImage, setPromoImage] = useState('');
  const [promoTarget, setPromoTarget] = useState('all'); // 'all' | 'subscribed' | 'unsubscribed' | 'active'
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Fetch past broadcasts
  const { data: promoData, mutate: mutatePromos } = useSWR('/api/promotions', fetcher);
  const pastPromotions = promoData?.promotions || [];

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!promoTitle.trim() || !promoMessage.trim()) {
      alert('Please fill in Title and Message fields.');
      return;
    }

    setIsBroadcasting(true);
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: promoTitle.trim(),
          message: promoMessage.trim(),
          targetGroup: promoTarget,
          image: promoImage.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Promotion successfully broadcasted to target players!');
        setPromoTitle('');
        setPromoMessage('');
        setPromoImage('');
        setPromoTarget('all');
        mutatePromos();
      } else {
        alert(data.message || 'Failed to send promotion.');
      }
    } catch (err) {
      console.error(err);
      alert('Error broadcasting promotion.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleDeletePromo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promotion? It will be removed from player lobbies.')) {
      return;
    }
    try {
      const res = await fetch(`/api/promotions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        mutatePromos();
      } else {
        alert(data.message || 'Failed to delete promotion.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting promotion.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
      
      {/* Tab Navigation header */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveSubTab('segments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSubTab === 'segments' ? 'var(--gold-primary)' : 'rgba(255,255,255,0.6)',
            borderBottom: activeSubTab === 'segments' ? '2px solid var(--gold-primary)' : 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-users-gear" style={{ marginRight: '6px' }}></i> Player Databases & Segments
        </button>
        <button
          onClick={() => setActiveSubTab('broadcast')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSubTab === 'broadcast' ? 'var(--gold-primary)' : 'rgba(255,255,255,0.6)',
            borderBottom: activeSubTab === 'broadcast' ? '2px solid var(--gold-primary)' : 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <i className="fa-solid fa-bullhorn" style={{ marginRight: '6px' }}></i> Send Promotion / Broadcast
        </button>
      </div>

      {/* VIEW A: PLAYER SEGMENTS */}
      {activeSubTab === 'segments' && (
        <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold' }}>Player Database Segmentation</h3>
              <span className="game-tap-tip">Filter players by subscription status or active deposits.</span>
            </div>
            
            {/* Segment selectors */}
            <div style={{ display: 'flex', gap: '0.5rem', background: '#07090f', padding: '0.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { id: 'subscribed', label: 'Subscribed List', icon: 'fa-envelope-open-text' },
                { id: 'unsubscribed', label: 'Unsubscribed List', icon: 'fa-envelope' },
                { id: 'active', label: 'Active Playing List', icon: 'fa-circle-dollar-to-slot' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSegment(s.id); setPage(1); }}
                  style={{
                    background: segment === s.id ? 'var(--gold-primary)' : 'none',
                    color: segment === s.id ? '#000' : '#fff',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <i className={`fa-solid ${s.icon}`}></i> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="input-wrapper search-wrapper" style={{ background: '#07090f', marginBottom: '1rem' }}>
            <i className="fa-solid fa-magnifying-glass input-icon"></i>
            <input
              type="text"
              placeholder="Search players by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player Name</th>
                  <th>Email Address</th>
                  <th>Subscriber Status</th>
                  <th>Account Status</th>
                </tr>
              </thead>
              <tbody>
                {!userData && !userError ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading segment players...
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>No players found matching this criteria.</td>
                  </tr>
                ) : (
                  usersList.map((user, idx) => (
                    <tr key={user.email}>
                      <td>{(page - 1) * limit + idx + 1}</td>
                      <td><strong>{user.name}</strong></td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`admin-badge-preview ${user.isSubscribed ? 'b-ready' : 'b-new'}`} style={{ fontSize: '0.65rem' }}>
                          {user.isSubscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge-preview ${user.status === 'suspended' ? 'b-failed' : 'b-ready'}`} style={{ fontSize: '0.65rem' }}>
                          {user.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Segment Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                Showing page {page} of {totalPages} ({totalUsers} entries)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="action-row-btn"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.7rem', opacity: page === 1 ? 0.4 : 1 }}
                >
                  &larr; Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="action-row-btn"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.7rem', opacity: page === totalPages ? 0.4 : 1 }}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* VIEW B: BROADCAST PROMOTION */}
      {activeSubTab === 'broadcast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Send Promo Form */}
          <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginBottom: '1rem' }}>
              <i className="fa-solid fa-paper-plane gold-text"></i> Broadcast New Promotion Flyer
            </h3>

            <form onSubmit={handleBroadcastSubmit} noValidate>
              <div className="input-group">
                <label htmlFor="promo-title">Promotion Title</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-heading input-icon"></i>
                  <input
                    type="text"
                    id="promo-title"
                    placeholder="e.g. 400% Weekend Cash Match!"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="promo-message">Message / Offer Body</label>
                <div className="input-wrapper" style={{ height: 'auto' }}>
                  <textarea
                    id="promo-message"
                    rows="4"
                    placeholder="Describe the offer rules or coupon details here..."
                    value={promoMessage}
                    onChange={(e) => setPromoMessage(e.target.value)}
                    style={{ background: 'none', border: 'none', color: '#fff', width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.775rem', outline: 'none', resize: 'none' }}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="promo-image">Promotion Flyer Image Graphic Link (Optional)</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-image input-icon"></i>
                  <input
                    type="text"
                    id="promo-image"
                    placeholder="https://example.com/banner.jpg"
                    value={promoImage}
                    onChange={(e) => setPromoImage(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="promo-target">Target Player Group Segment</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-users-viewfinder input-icon"></i>
                  <select
                    id="promo-target"
                    value={promoTarget}
                    onChange={(e) => setPromoTarget(e.target.value)}
                    style={{ background: 'none', border: 'none', color: '#fff', width: '100%', fontSize: '0.775rem', height: '100%', outline: 'none', padding: '0 0.5rem' }}
                  >
                    <option value="all" style={{ background: '#0a0d16' }}>Both Groups (All Registered Players)</option>
                    <option value="subscribed" style={{ background: '#0a0d16' }}>Subscribed Players Only</option>
                    <option value="unsubscribed" style={{ background: '#0a0d16' }}>Unsubscribed Players Only</option>
                    <option value="active" style={{ background: '#0a0d16' }}>Active Playing Players Only (Depositors)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBroadcasting}
                className="submit-btn"
                style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }}
              >
                {isBroadcasting ? 'Broadcasting...' : 'Broadcast Promo Live'}
              </button>
            </form>
          </section>

          {/* Past Broadcasts List */}
          <section className="admin-section-card" style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '600px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginBottom: '1rem' }}>
              <i className="fa-solid fa-clock-rotate-left gold-text"></i> Past Promotional Campaigns
            </h3>

            {pastPromotions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>No active promotions sent yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pastPromotions.map((promo) => (
                  <div
                    key={promo.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      padding: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <strong style={{ color: '#fff', fontSize: '0.8rem' }}>{promo.title}</strong>
                      <button
                        onClick={() => handleDeletePromo(promo.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                        title="Delete Promotion"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                    <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: '0.25rem 0', whiteSpace: 'normal', lineHeight: '1.4' }}>
                      {promo.message}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <span>Target: <strong style={{ color: 'var(--gold-primary)' }}>{promo.targetGroup.toUpperCase()}</strong></span>
                      <span>{new Date(promo.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}

    </div>
  );
}
