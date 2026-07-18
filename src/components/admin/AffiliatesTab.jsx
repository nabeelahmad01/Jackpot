'use client';

import PanelModalBackdrop from '../PanelModalBackdrop';
import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function AffiliatesTab() {
  const { data, mutate } = useSWR('/api/agents', fetcher);
  const [searchQuery, setSearchQuery] = useState('');

  // Creation State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [commissionRate, setCommissionRate] = useState(10);
  const [agentCode, setAgentCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingAgent, setEditingAgent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState(0);
  const [editAgentCode, setEditAgentCode] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editAccountType, setEditAccountType] = useState('agent');

  // Referred Players Modal
  const [viewingAgentPlayers, setViewingAgentPlayers] = useState(null);
  const [referredPlayersList, setReferredPlayersList] = useState([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  // Team members modal
  const [viewingTeamMembers, setViewingTeamMembers] = useState(null);
  const [teamMembersList, setTeamMembersList] = useState([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  const agents = data?.agents || [];

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.agentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.parentAgentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      alert('Name, email, and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: password.trim(),
          commissionRate: Number(commissionRate),
          agentCode: agentCode.trim()
        })
      });
      const resData = await response.json();
      if (resData.success) {
        setName('');
        setEmail('');
        setPassword('');
        setCommissionRate(10);
        setAgentCode('');
        mutate();
        alert('Affiliate agent created successfully!');
      } else {
        alert(resData.message || 'Failed to create agent.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (agent) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditEmail(agent.email);
    setEditPassword('');
    setEditCommissionRate(agent.commissionRate || 0);
    setEditAgentCode(agent.agentCode || '');
    setEditStatus(agent.status || 'ACTIVE');
    setEditAccountType(agent.accountType || 'agent');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      alert('Agent Name and Email are required.');
      return;
    }

    try {
      const response = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAgent.id,
          name: editName.trim(),
          email: editEmail.toLowerCase().trim(),
          password: editPassword.trim(),
          commissionRate: Number(editCommissionRate),
          agentCode: editAgentCode.trim(),
          status: editStatus,
          accountType: editAccountType
        })
      });
      const resData = await response.json();
      if (resData.success) {
        setEditingAgent(null);
        mutate();
        alert('Agent updated successfully!');
      } else {
        alert(resData.message || 'Failed to update agent.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating agent details.');
    }
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Are you sure you want to delete this affiliate agent? All referred players will lose their agent mapping.')) {
      return;
    }

    try {
      const response = await fetch(`/api/agents?id=${id}`, {
        method: 'DELETE'
      });
      const resData = await response.json();
      if (resData.success) {
        mutate();
        alert('Agent successfully deleted.');
      } else {
        alert(resData.message || 'Failed to delete agent.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting agent.');
    }
  };

  const handleViewTeam = async (agent) => {
    setViewingTeamMembers(agent);
    setIsLoadingTeam(true);
    try {
      const response = await fetch(`/api/agents/stats?agentCode=${encodeURIComponent(agent.agentCode)}`);
      const resData = await response.json();
      if (resData.success) {
        setTeamMembersList(resData.teamMembers || []);
      } else {
        alert('Failed to load team members.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching team list.');
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleViewPlayers = async (agent) => {
    setViewingAgentPlayers(agent);
    setIsLoadingPlayers(true);
    try {
      const response = await fetch(`/api/agents/stats?agentCode=${encodeURIComponent(agent.agentCode)}`);
      const resData = await response.json();
      if (resData.success) {
        setReferredPlayersList(resData.players || []);
      } else {
        alert('Failed to load referred players.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching players list.');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  return (
    <div className="panel-staff-layout">
      
      {/* 1. CREATION OR EDIT FORM PANEL */}
      <div className="section-card" style={{ height: 'fit-content' }}>
        <h3 className="section-card-title">
          {editingAgent ? 'Edit Affiliate Agent' : 'Create Affiliate Agent'}
        </h3>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          {editingAgent ? 'Update login credentials and commission setup.' : 'Add new affiliate with commission tracking credentials.'}
        </p>

        <form onSubmit={editingAgent ? handleEditSubmit : handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label style={{ fontSize: '0.7rem' }}>Full Name</label>
            <input
              type="text"
              placeholder="e.g. Spidy Affiliate"
              value={editingAgent ? editName : name}
              onChange={(e) => editingAgent ? setEditName(e.target.value) : setName(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
              required
            />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.7rem' }}>Login Email</label>
            <input
              type="email"
              placeholder="agent@jackpot.com"
              value={editingAgent ? editEmail : email}
              onChange={(e) => editingAgent ? setEditEmail(e.target.value) : setEmail(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
              required
            />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.7rem' }}>
              {editingAgent ? 'Password (Leave blank to keep current)' : 'Password'}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={editingAgent ? editPassword : password}
              onChange={(e) => editingAgent ? setEditPassword(e.target.value) : setPassword(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
              required={!editingAgent}
            />
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.7rem' }}>Commission Rate (%)</label>
            <input
              type="number"
              placeholder="e.g. 10"
              step="0.1"
              value={editingAgent ? editCommissionRate : commissionRate}
              onChange={(e) => editingAgent ? setEditCommissionRate(e.target.value) : setCommissionRate(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
              required
            />
          </div>

          {editingAgent && (
            <>
              <div className="input-group">
                <label style={{ fontSize: '0.7rem' }}>Account Type</label>
                <select
                  value={editAccountType}
                  onChange={(e) => setEditAccountType(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                >
                  <option value="agent">Agent</option>
                  <option value="sub-distributor">Sub-Distributor</option>
                </select>
              </div>
              <div className="input-group">
                <label style={{ fontSize: '0.7rem' }}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label style={{ fontSize: '0.7rem' }}>Custom Invite Code (Optional)</label>
            <input
              type="text"
              placeholder="e.g. SUB600718"
              value={editingAgent ? editAgentCode : agentCode}
              onChange={(e) => editingAgent ? setEditAgentCode(e.target.value) : setAgentCode(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
            />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>If blank, an ID like SUBxxxxxx is generated.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
            <button
              type="submit"
              className="submit-btn"
              style={{ width: '100%', minHeight: '44px', background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              disabled={isSubmitting}
            >
              {editingAgent ? 'SAVE CHANGES' : 'CREATE AGENT'}
            </button>
            {editingAgent && (
              <button
                type="button"
                className="submit-btn"
                onClick={() => setEditingAgent(null)}
                style={{ width: '100%', minHeight: '44px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.8rem' }}
              >
                CANCEL
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 2. AGENTS LIST GRID TABLE */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 className="section-card-title">Affiliates Control</h3>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>All custom referred player commission managers.</p>
          </div>
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', padding: '0.4rem 0.75rem', fontSize: '0.75rem', outline: 'none', width: '200px' }}
          />
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Agent Info</th>
                <th>Role / Parent</th>
                <th>Invite Code</th>
                <th>Status</th>
                <th>Comm. Rate</th>
                <th>Stats</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No affiliate agents found.
                  </td>
                </tr>
              ) : (
                filteredAgents.map(agent => (
                  <tr key={agent.id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{agent.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{agent.email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.7rem' }}>
                        <span style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                          {agent.role || 'Agent'}
                        </span>
                        <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                          Parent: <strong>{agent.parentAgentName || '—'}</strong>
                          {agent.parentAgentCode ? ` (${agent.parentAgentCode})` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ background: 'rgba(255,255,255,0.04)', padding: '0.15rem 0.35rem', borderRadius: '4px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                        {agent.agentCode}
                      </code>
                    </td>
                    <td>
                      <span className={`admin-badge-preview b-${(agent.status || 'ACTIVE').toLowerCase() === 'active' ? 'ready' : 'none'}`}>
                        {agent.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{agent.commissionRate}%</td>
                    <td>
                      <div style={{ fontSize: '0.7rem' }}>
                        <div>Players: <strong style={{ color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={() => handleViewPlayers(agent)}>{agent.playersCount || 0}</strong></div>
                        <div>Team: <strong style={{ color: '#a855f7', cursor: 'pointer' }} onClick={() => handleViewTeam(agent)}>{agent.teamMembersCount || 0}</strong></div>
                        <div>Deposits: <strong>${parseFloat(agent.totalDeposits || 0).toFixed(2)}</strong></div>
                        <div>Withdrawals: <strong>${parseFloat(agent.totalWithdrawals || 0).toFixed(2)}</strong></div>
                        <div>Profit: <strong>${parseFloat(agent.netProfit ?? Math.max(0, (agent.totalDeposits || 0) - (agent.totalWithdrawals || 0))).toFixed(2)}</strong></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.7rem' }}>
                        <div>Commission: <strong style={{ color: '#2ecc71' }}>${parseFloat(agent.commissionEarned || 0).toFixed(2)}</strong> <span style={{ color: '#666', fontSize: '0.6rem' }}>(on profit)</span></div>
                        <div>Withdrawn: <strong>${parseFloat(agent.totalWithdrawn || 0).toFixed(2)}</strong></div>
                        <div>Available: <strong style={{ color: 'var(--gold-primary)' }}>${parseFloat(agent.availableBalance || 0).toFixed(2)}</strong></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handleViewTeam(agent)} style={{ border: '1px solid rgba(168,85,247,0.2)', padding: '0.2rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px', background: 'none', color: '#a855f7', cursor: 'pointer' }}>
                          Team
                        </button>
                        <button onClick={() => handleEditClick(agent)} className="btn-edit" style={{ border: '1px solid rgba(255,215,0,0.2)', padding: '0.2rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px', background: 'none', color: 'var(--gold-primary)', cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(agent.id)} className="btn-delete" style={{ border: '1px solid rgba(255,46,99,0.2)', padding: '0.2rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px', background: 'none', color: 'var(--red-primary)', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. REFERRED PLAYERS VIEW MODAL */}
      {viewingAgentPlayers && (
        <PanelModalBackdrop className="panel-modal-overlay">
          <div className="section-card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,215,0,0.3)', boxShadow: 'var(--gold-box-shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 className="section-card-title" style={{ fontSize: '1.1rem' }}>Referred Players - {viewingAgentPlayers.name}</h3>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Affiliate Code: {viewingAgentPlayers.agentCode}</p>
              </div>
              <button 
                onClick={() => setViewingAgentPlayers(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &times;
              </button>
            </div>

            {isLoadingPlayers ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading players list...</div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Player Info</th>
                      <th>Status</th>
                      <th>Total Deposits</th>
                      <th>Total Cashouts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referredPlayersList.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No players registered under this affiliate yet.
                        </td>
                      </tr>
                    ) : (
                      referredPlayersList.map(player => (
                        <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ fontWeight: 'bold' }}>{player.name}</div>
                            <div style={{ fontSize: '0.65rem', color: '#888' }}>{player.email}</div>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <span className={`admin-badge-preview b-${player.status.toLowerCase() === 'active' ? 'ready' : 'none'}`}>
                              {player.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#2ecc71' }}>
                            ${parseFloat(player.totalDeposits || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold', color: 'var(--red-primary)' }}>
                            ${parseFloat(player.totalWithdrawals || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PanelModalBackdrop>
      )}

      {/* 4. TEAM MEMBERS VIEW MODAL */}
      {viewingTeamMembers && (
        <PanelModalBackdrop className="panel-modal-overlay">
          <div className="section-card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(168,85,247,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 className="section-card-title" style={{ fontSize: '1.1rem' }}>Team — {viewingTeamMembers.name}</h3>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Code: {viewingTeamMembers.agentCode} · Role: {viewingTeamMembers.role || 'Agent'}</p>
              </div>
              <button
                onClick={() => setViewingTeamMembers(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &times;
              </button>
            </div>

            {isLoadingTeam ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading team...</div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Code</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembersList.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No team members or referral players yet.
                        </td>
                      </tr>
                    ) : (
                      teamMembersList.map((member) => (
                        <tr key={`${member.memberType}-${member.id}`}>
                          <td style={{ fontWeight: 'bold' }}>{member.name}</td>
                          <td style={{ fontSize: '0.65rem', color: '#888' }}>{member.email}</td>
                          <td>{member.agentCode !== '—' ? member.agentCode : '—'}</td>
                          <td>{member.role}</td>
                          <td>
                            <span className={`admin-badge-preview b-${(member.status || 'ACTIVE').toLowerCase() === 'active' ? 'ready' : 'none'}`}>
                              {member.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td>{member.memberType === 'player' ? '—' : `${member.commissionRate || 0}%`}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PanelModalBackdrop>
      )}

    </div>
  );
}
