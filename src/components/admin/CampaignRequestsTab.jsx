'use client';

import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function CampaignRequestsTab({ adminUser, onInspectProof }) {
  const [search, setSearch] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [customLink, setCustomLink] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data, error, mutate } = useSWR('/api/campaign-requests', fetcher, {
    refreshInterval: 5000
  });

  const campaigns = data?.campaigns || [];
  const isLoading = !data && !error;

  const filteredCampaigns = campaigns.filter(c => 
    c.campaignName.toLowerCase().includes(search.toLowerCase()) ||
    c.agentEmail.toLowerCase().includes(search.toLowerCase()) ||
    c.agentCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/campaign-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'APPROVED',
          trackingLink: customLink.trim()
        })
      });
      const resData = await res.json();
      if (resData.success) {
        alert('Campaign approved successfully!');
        setApprovingId(null);
        setCustomLink('');
        mutate();
      } else {
        alert(resData.message || 'Approval failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this campaign request?')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/campaign-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'REJECTED'
        })
      });
      const resData = await res.json();
      if (resData.success) {
        alert('Campaign request rejected.');
        mutate();
      } else {
        alert(resData.message || 'Rejection failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h3><i className="fa-solid fa-bullhorn text-gold" style={{ color: 'var(--gold-primary)' }}></i> Affiliate Ads Campaign Requests</h3>
          <span className="game-tap-tip">Review, approve budget deposits, and issue custom tracking links to agent marketing campaigns.</span>
        </div>

        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search campaign requests by campaign name, agent email, or agent code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Agent</th>
              <th>Campaign Name</th>
              <th>Budget</th>
              <th>Facebook Page</th>
              <th>Dates</th>
              <th>Proof</th>
              <th>Status</th>
              <th>Actions / Tracking Link</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="9" className="text-center text-muted" style={{ padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading campaign requests...
                </td>
              </tr>
            ) : filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No campaign requests found.
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((c) => {
                const isThisApproving = approvingId === c.id;
                return (
                  <tr key={c.id}>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <strong>{c.agentEmail}</strong>
                      <div style={{ fontSize: '0.7rem', color: '#aaa' }}>Code: <code>{c.agentCode}</code></div>
                    </td>
                    <td><strong>{c.campaignName}</strong></td>
                    <td><strong style={{ color: 'var(--gold-primary)' }}>${parseFloat(c.budget).toFixed(2)}</strong></td>
                    <td style={{ fontSize: '0.75rem', maxWidth: '150px', wordBreak: 'break-all' }}>
                      <a href={c.facebookPageLink} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>View Page</a>
                    </td>
                    <td style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                      Start: {new Date(c.startDate).toLocaleDateString()}<br/>
                      End: {new Date(c.endDate).toLocaleDateString()}
                    </td>
                    <td>
                      {c.paymentProof ? (
                        <button
                          onClick={() => onInspectProof(c.paymentProof)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.25rem 0.5rem', color: 'var(--gold-primary)', fontSize: '0.675rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <i className="fa-solid fa-image"></i> Inspect
                        </button>
                      ) : (
                        <span style={{ opacity: 0.3, fontSize: '0.75rem' }}>No Proof</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-badge-preview b-${c.status.toLowerCase() === 'ready' ? 'ready' : c.status.toLowerCase()}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ minWidth: '220px' }}>
                      {c.status === 'PENDING' && (
                        <>
                          {!isThisApproving ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => {
                                  setApprovingId(c.id);
                                  setCustomLink(`https://jackpotentry.com/?agent=${c.agentCode}&campaign=${encodeURIComponent(c.campaignName)}`);
                                }}
                                style={{ background: '#2ecc71', color: '#000', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(c.id)}
                                disabled={actionLoading}
                                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <input
                                type="text"
                                placeholder="Enter custom tracking URL"
                                value={customLink}
                                onChange={(e) => setCustomLink(e.target.value)}
                                style={{ background: '#07090f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', padding: '0.3rem', fontSize: '0.7rem', width: '100%' }}
                              />
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <button
                                  onClick={() => handleApprove(c.id)}
                                  disabled={actionLoading}
                                  style={{ background: '#2ecc71', color: '#000', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  {actionLoading ? 'Saving...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setApprovingId(null)}
                                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {c.status === 'APPROVED' && (
                        <div style={{ fontSize: '0.725rem', fontFamily: 'monospace', color: '#2ecc71', wordBreak: 'break-all' }}>
                          <strong>URL: </strong> {c.trackingLink}
                        </div>
                      )}

                      {c.status === 'REJECTED' && (
                        <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>No link assigned</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
