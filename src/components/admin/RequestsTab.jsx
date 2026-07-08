import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function RequestsTab({ adminUser, onApproveRequest, completedActionIds = {}, processingIds, wrapAction }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Manual Credentials Editing State
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [targetGame, setTargetGame] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);

  const cleanRoles = (adminUser?.role || '').toLowerCase().split(',').map(r => r.trim());
  const canUpdateCredentials = cleanRoles.some(r => ['admin', 'operation_admin', 'coins_admin'].includes(r));

  const handleOpenManualCredentials = (reqItem) => {
    setTargetEmail(reqItem.userEmail);
    setTargetGame(reqItem.gameTitle);
    setManualUsername('');
    setManualPassword('');
    setCredentialsModalOpen(true);
  };

  const handleManualCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!manualUsername.trim() || !manualPassword.trim()) {
      alert('Please fill in both username and password fields.');
      return;
    }
    setIsUpdatingCreds(true);
    try {
      const response = await fetch('/api/game-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: targetGame,
          userEmail: targetEmail,
          username: manualUsername,
          password: manualPassword
        })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Credentials successfully updated manually!');
        setCredentialsModalOpen(false);
        mutate();
      } else {
        alert(resData.message || 'Failed to update credentials.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating credentials.');
    } finally {
      setIsUpdatingCreds(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // SWR automatically refreshes every 4s for requests tab (real-time lobby queue)
  const { data, error, mutate } = useSWR(
    `/api/account-requests?status=PENDING&page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  const requests = (data?.accountRequests || []).filter((r) => !completedActionIds[r.id]);
  const totalRequests = data?.totalRequests || 0;
  const totalPages = data?.totalPages || 1;

  const handleApprove = async (reqItem) => {
    // Approve action wrapper handles state modifications
    await onApproveRequest(reqItem);
    mutate(); // instantly refresh list
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const isLoading = !data && !error;

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3><i className="fa-solid fa-user-plus gold-text"></i> Pending Lobby Game Account Requests</h3>
          <span className="game-tap-tip" style={{ float: 'right' }}>Allot player login credentials</span>
        </div>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search requests by email or game portal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User Email</th>
              <th>Requested Game</th>
              <th>Request Timestamp</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No pending game account requests match criteria.
                </td>
              </tr>
            ) : (
              requests.map((req, idx) => (
                <tr key={req.id}>
                  <td>{(page - 1) * limit + idx + 1}</td>
                  <td><strong>{req.userEmail}</strong></td>
                  <td><span className="admin-badge-preview b-hot">{req.gameTitle}</span></td>
                  <td>{req.date}</td>
                  <td>
                    <span className={`admin-badge-preview b-${req.status.toLowerCase() === 'ready' ? 'ready' : req.status.toLowerCase()}`}>
                      {req.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {req.status === 'PENDING' && (
                        <button
                          disabled={processingIds[req.id]}
                          onClick={wrapAction(req.id, () => handleApprove(req))}
                          className="submit-btn"
                          style={{
                            margin: 0,
                            padding: '0.4rem 0.85rem',
                            width: 'auto',
                            display: 'inline-flex',
                            gap: '0.4rem',
                            alignItems: 'center',
                            opacity: processingIds[req.id] ? 0.6 : 1,
                            background: '#22c55e'
                          }}
                        >
                          {processingIds[req.id] ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-user-check"></i>}
                          <span style={{ fontSize: '0.7rem' }}>
                            {processingIds[req.id] ? 'Approving...' : 'Approve'}
                          </span>
                        </button>
                      )}
                      {canUpdateCredentials && (
                        <button
                          onClick={() => handleOpenManualCredentials(req)}
                          className="action-row-btn"
                          style={{
                            background: 'rgba(255, 215, 0, 0.1)',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            color: 'var(--gold-primary)',
                            padding: '0.4rem 0.85rem',
                            fontSize: '0.7rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title="Update Username & Password Profile Manually"
                        >
                          <i className="fa-solid fa-key"></i> Manual Credentials
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing page {page} of {totalPages} ({totalRequests} entries)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handlePrevPage}
              disabled={page === 1}
              className="action-row-btn"
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            >
              &larr; Prev
            </button>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages}
              className="action-row-btn"
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}
      {/* MANUAL CREDENTIALS UPDATE MODAL */}
      {credentialsModalOpen && (
        <div className="modal-backdrop-custom" onClick={() => setCredentialsModalOpen(false)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-key gold-text"></i> Update Credentials Manually
              </h3>
              <button type="button" className="close-modal" onClick={() => setCredentialsModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  User: <strong style={{ color: '#fff' }}>{targetEmail}</strong>
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Game: <strong style={{ color: 'var(--gold-primary)' }}>{targetGame}</strong>
                </p>
              </div>

              <form onSubmit={handleManualCredentialsSubmit} noValidate>
                <div className="input-group">
                  <label htmlFor="cred-username">Username for {targetGame}</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-user-tag input-icon"></i>
                    <input
                      type="text"
                      id="cred-username"
                      placeholder="Enter game username..."
                      value={manualUsername}
                      onChange={(e) => setManualUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="cred-password">Password for {targetGame}</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-lock input-icon"></i>
                    <input
                      type="text"
                      id="cred-password"
                      placeholder="Enter game password..."
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isUpdatingCreds}>
                  {isUpdatingCreds ? 'UPDATING...' : 'SAVE CREDENTIALS'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
