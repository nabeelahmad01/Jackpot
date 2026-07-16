'use client';

import PanelModalBackdrop from '../PanelModalBackdrop';
import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function DistributorsTab() {
  const { data, mutate } = useSWR('/api/distributors', fetcher);
  const [searchQuery, setSearchQuery] = useState('');

  // Creation Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState('A');
  const [commissionRate, setCommissionRate] = useState(10);
  const [websiteCommissionRate, setWebsiteCommissionRate] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingDist, setEditingDist] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editType, setEditType] = useState('A');
  const [editCommissionRate, setEditCommissionRate] = useState(0);
  const [editWebsiteCommissionRate, setEditWebsiteCommissionRate] = useState(0);

  // Referred Players List View Modal
  const [viewingPlayersDist, setViewingPlayersDist] = useState(null);
  const [referredPlayersList, setReferredPlayersList] = useState([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  const distributors = data?.distributors || [];

  const filteredDistributors = distributors.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      alert('Please fill out all distributor login credential fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/distributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: password.trim(),
          type,
          commissionRate: Number(commissionRate),
          websiteCommissionRate: Number(websiteCommissionRate)
        })
      });
      const resData = await response.json();
      if (resData.success) {
        setName('');
        setEmail('');
        setPassword('');
        setType('A');
        setCommissionRate(10);
        setWebsiteCommissionRate(5);
        mutate();
        alert('Distributor created successfully!');
      } else {
        alert(resData.message || 'Failed to create distributor.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (dist) => {
    setEditingDist(dist);
    setEditName(dist.name);
    setEditEmail(dist.email);
    setEditPassword('');
    setEditType(dist.type || 'A');
    setEditCommissionRate(dist.commissionRate || 0);
    setEditWebsiteCommissionRate(dist.websiteCommissionRate || 0);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      alert('Distributor Name and Email are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingDist.id,
        name: editName.trim(),
        email: editEmail.toLowerCase().trim(),
        type: editType,
        commissionRate: Number(editCommissionRate),
        websiteCommissionRate: Number(editWebsiteCommissionRate)
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const response = await fetch('/api/distributors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      if (resData.success) {
        setEditingDist(null);
        mutate();
        alert('Distributor details updated successfully!');
      } else {
        alert(resData.message || 'Failed to update distributor.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating distributor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete distributor "${name}"? Referred players will remain in database but the link relationship stats will no longer sync.`)) {
      try {
        const response = await fetch(`/api/distributors?id=${id}`, {
          method: 'DELETE'
        });
        const resData = await response.json();
        if (resData.success) {
          mutate();
          alert('Distributor deleted successfully.');
        } else {
          alert(resData.message || 'Failed to delete distributor.');
        }
      } catch (err) {
        console.error(err);
        alert('Error deleting distributor.');
      }
    }
  };

  const handleViewPlayers = async (dist) => {
    setViewingPlayersDist(dist);
    setIsLoadingPlayers(true);
    setReferredPlayersList([]);
    try {
      const res = await fetch(`/api/distributors/stats?distributorId=${dist.id}`);
      const resData = await res.json();
      if (resData.success) {
        setReferredPlayersList(resData.players || []);
      } else {
        alert(resData.message || 'Failed to load players.');
      }
    } catch (err) {
      console.error(err);
      alert('Error loading players.');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  return (
    <div className="admin-layout-split" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
      
      {/* 1) ADD DISTRIBUTOR FORM */}
      <section className="admin-section-card">
        <div className="section-card-header" style={{ marginBottom: '1.25rem' }}>
          <h3><i className="fa-solid fa-users-gear gold-text"></i> Register Distributor</h3>
        </div>

        <form onSubmit={handleCreateSubmit} noValidate>
          <div className="input-group">
            <label>Distributor Name</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-user input-icon"></i>
              <input
                type="text"
                placeholder="e.g. California Partner"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Login Email</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-envelope input-icon"></i>
              <input
                type="email"
                placeholder="dist@jackpot.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock input-icon"></i>
              <input
                type="text"
                placeholder="SecurePassword123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Distributor Type</label>
            <div className="input-wrapper" style={{ background: '#0b0d16' }}>
              <i className="fa-solid fa-layer-group input-icon"></i>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', fontSize: '0.8rem', padding: '0.5rem', outline: 'none' }}
              >
                <option value="A" style={{ background: '#0b0d16', color: '#fff' }}>Type A (Standard/Uses our Gateways & Staff)</option>
                <option value="B" style={{ background: '#0b0d16', color: '#fff' }}>Type B (Independent/Uses their own Gateways & Staff)</option>
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '0.75rem' }}>
            <label>Distributor Commission Rate (%)</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-percent input-icon"></i>
              <input
                type="number"
                placeholder="30"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                required
              />
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Percentage of net profit earned by the distributor.
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label>Website Commission Rate (%)</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-percent input-icon"></i>
              <input
                type="number"
                placeholder="5"
                min="0"
                max="100"
                value={websiteCommissionRate}
                onChange={(e) => setWebsiteCommissionRate(e.target.value)}
                required
              />
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Percentage of net profit paid to the platform owner.
            </div>
          </div>

          <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isSubmitting}>
            {isSubmitting ? 'REGISTERING...' : 'REGISTER DISTRIBUTOR ➔'}
          </button>
        </form>
      </section>

      {/* 2) DISTRIBUTORS LIST */}
      <section className="admin-section-card">
        <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <h3><i className="fa-solid fa-list-check text-red"></i> Distributors Network</h3>
          <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
            <i className="fa-solid fa-magnifying-glass input-icon"></i>
            <input
              type="text"
              placeholder="Search by ID, name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>DIST ID / NAME</th>
                <th>TYPE</th>
                <th>COMM RATE</th>
                <th>METRICS SUMMARY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDistributors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '1.5rem' }}>No distributors found.</td>
                </tr>
              ) : (
                filteredDistributors.map((dist) => (
                  <tr key={dist.id}>
                    <td>
                      <strong style={{ color: 'var(--gold-primary)', fontSize: '0.8rem' }}>{dist.id}</strong>
                      <div style={{ fontWeight: 'bold' }}>{dist.name}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{dist.email}</div>
                    </td>
                    <td>
                      <span className={`admin-badge-preview b-${dist.type === 'B' ? 'hot' : 'ready'}`} style={{ fontSize: '0.65rem' }}>
                        {dist.type === 'B' ? 'Type B (Independent)' : 'Type A (Standard)'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.725rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <div>Distributor: <strong>{dist.commissionRate || 0}%</strong></div>
                        <div>Website: <strong>{dist.websiteCommissionRate || 0}%</strong></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.725rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <div>Players: <strong style={{ color: '#fff' }}>{dist.playersCount || 0}</strong></div>
                        <div>Deposits: <strong style={{ color: '#2ecc71' }}>${(dist.totalDeposits || 0).toFixed(2)}</strong></div>
                        <div>Withdrawals: <strong style={{ color: '#ef4444' }}>${(dist.totalWithdrawals || 0).toFixed(2)}</strong></div>
                        <div>Profit: <strong style={{ color: '#fff' }}>${(dist.netProfit ?? Math.max(0, (dist.totalDeposits || 0) - (dist.totalWithdrawals || 0))).toFixed(2)}</strong></div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.15rem', marginTop: '0.15rem' }}>
                          <div>Dist Comm: <strong style={{ color: 'var(--gold-primary)' }}>${(dist.commissionEarned || 0).toFixed(2)}</strong> <span style={{ color: '#666', fontSize: '0.6rem' }}>(on profit)</span></div>
                          <div>Website Comm: <strong style={{ color: '#ff4d6d' }}>${(dist.websiteCommissionEarned || 0).toFixed(2)}</strong> <span style={{ color: '#666', fontSize: '0.6rem' }}>(on profit)</span></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.45rem' }}>
                        <button
                          className="action-row-btn"
                          onClick={() => handleViewPlayers(dist)}
                          title="View Re-referred Players"
                          style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}
                        >
                          <i className="fa-solid fa-users"></i>
                        </button>
                        <button
                          className="action-row-btn"
                          onClick={() => handleEditClick(dist)}
                          title="Edit Details"
                          style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: 'var(--gold-primary)' }}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="action-row-btn btn-delete"
                          onClick={() => handleDeleteClick(dist.id, dist.name)}
                          title="Delete Distributor"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3) EDIT DISTRIBUTOR MODAL */}
      {editingDist && (
        <PanelModalBackdrop onClick={() => setEditingDist(null)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3><i className="fa-solid fa-user-gear gold-text"></i> Edit Distributor Details</h3>
              <button type="button" className="close-modal" onClick={() => setEditingDist(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit} noValidate>
                <div className="input-group">
                  <label>Distributor Name</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-user input-icon"></i>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Login Email</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-envelope input-icon"></i>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Password (Leave blank to keep unchanged)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-lock input-icon"></i>
                    <input
                      type="text"
                      placeholder="Enter new password if changing..."
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Distributor Type</label>
                  <div className="input-wrapper" style={{ background: '#0b0d16' }}>
                    <i className="fa-solid fa-layer-group input-icon"></i>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', fontSize: '0.8rem', padding: '0.5rem', outline: 'none' }}
                    >
                      <option value="A" style={{ background: '#0b0d16', color: '#fff' }}>Type A (Standard/Uses our Gateways & Staff)</option>
                      <option value="B" style={{ background: '#0b0d16', color: '#fff' }}>Type B (Independent/Uses their own Gateways & Staff)</option>
                    </select>
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                  <label>Distributor Commission Rate (%)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-percent input-icon"></i>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editCommissionRate}
                      onChange={(e) => setEditCommissionRate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Website Commission Rate (%)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-percent input-icon"></i>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editWebsiteCommissionRate}
                      onChange={(e) => setEditWebsiteCommissionRate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isSubmitting}>
                  {isSubmitting ? 'UPDATING...' : 'UPDATE DISTRIBUTOR DETAILS'}
                </button>
              </form>
            </div>
          </div>
        </PanelModalBackdrop>
      )}

      {/* 4) REFERRED PLAYERS LIST MODAL */}
      {viewingPlayersDist && (
        <PanelModalBackdrop onClick={() => setViewingPlayersDist(null)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-users gold-text"></i> Referred Players List 
                <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.5rem' }}>({viewingPlayersDist.name})</span>
              </h3>
              <button type="button" className="close-modal" onClick={() => setViewingPlayersDist(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {isLoadingPlayers ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin fa-2x gold-text"></i>
                  <p style={{ marginTop: '0.5rem', opacity: 0.5 }}>Loading referred players...</p>
                </div>
              ) : referredPlayersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                  No players signed up under this distributor yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Player Name</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referredPlayersList.map((player) => (
                        <tr key={player.email}>
                          <td><strong>{player.name}</strong></td>
                          <td>{player.email}</td>
                          <td>
                            <span className="admin-badge-preview b-ready" style={{ fontSize: '0.65rem' }}>
                              ACTIVE
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </PanelModalBackdrop>
      )}

    </div>
  );
}
