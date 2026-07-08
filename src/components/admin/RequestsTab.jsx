import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function RequestsTab({ adminUser, onApproveRequest, completedActionIds = {}, processingIds, wrapAction }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Add Manual Account States
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [selectedPlayerEmail, setSelectedPlayerEmail] = useState('');
  const [selectedGameTitle, setSelectedGameTitle] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);
  const [playersList, setPlayersList] = useState([]);
  const [gamesList, setGamesList] = useState([]);
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);

  const cleanRoles = (adminUser?.role || '').toLowerCase().split(',').map(r => r.trim());
  const canUpdateCredentials = cleanRoles.some(r => ['admin', 'operation_admin', 'coins_admin'].includes(r));

  const handleSelectPlayer = (email) => {
    setSelectedPlayerEmail(email);
    setPlayerSearchQuery(email);
    setPlayerDropdownOpen(false);

    // Auto-generate username & password
    const prefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomSuf = Math.floor(100 + Math.random() * 900);
    setCustomUsername(`${prefix}${randomSuf}`);

    const charSet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randPass = '';
    for (let i = 0; i < 8; i++) {
      randPass += charSet.charAt(Math.floor(Math.random() * charSet.length));
    }
    setCustomPassword(randPass);
  };

  const handleAddAccountSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlayerEmail || !selectedGameTitle || !customUsername.trim() || !customPassword.trim()) {
      alert('Please fill all required fields.');
      return;
    }
    setIsUpdatingCreds(true);
    try {
      const response = await fetch('/api/game-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: selectedGameTitle,
          userEmail: selectedPlayerEmail,
          username: customUsername.trim(),
          password: customPassword.trim()
        })
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Game account successfully created/allotted!');
        setAddAccountModalOpen(false);
        // Reset states
        setSelectedPlayerEmail('');
        setSelectedGameTitle('');
        setCustomUsername('');
        setCustomPassword('');
        setPlayerSearchQuery('');
        mutate();
      } else {
        alert(resData.message || 'Failed to create/allot game account.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating game account.');
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

  useEffect(() => {
    if (addAccountModalOpen) {
      fetch('/api/games')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setGamesList(data.games || []);
          }
        })
        .catch(err => console.error('Fetch games error:', err));
    }
  }, [addAccountModalOpen]);

  useEffect(() => {
    if (addAccountModalOpen) {
      const controller = new AbortController();
      const delayDebounceFn = setTimeout(() => {
        fetch(`/api/users?limit=50&search=${encodeURIComponent(playerSearchQuery)}`, { signal: controller.signal })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setPlayersList(data.users || []);
            }
          })
          .catch(err => {
            if (err.name !== 'AbortError') {
              console.error('Fetch users error:', err);
            }
          });
      }, 300);

      return () => {
        clearTimeout(delayDebounceFn);
        controller.abort();
      };
    }
  }, [playerSearchQuery, addAccountModalOpen]);

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
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {canUpdateCredentials && (
              <button
                onClick={() => setAddAccountModalOpen(true)}
                className="submit-btn"
                style={{
                  margin: 0,
                  width: 'auto',
                  padding: '0.5rem 1.25rem',
                  background: 'var(--gold-primary)',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <i className="fa-solid fa-key"></i> Add Account
              </button>
            )}
            <span className="game-tap-tip">Allot player login credentials</span>
          </div>
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
      {/* ADD ACCOUNT / ALLOT CREDENTIALS MANUALLY MODAL */}
      {addAccountModalOpen && (
        <div className="modal-backdrop-custom" onClick={() => setAddAccountModalOpen(false)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-key gold-text"></i> Create / Allot Game Account
              </h3>
              <button type="button" className="close-modal" onClick={() => setAddAccountModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddAccountSubmit} noValidate>
                {/* Search Player Dropdown (Select2 Style) */}
                <div className="input-group" style={{ position: 'relative' }}>
                  <label htmlFor="select-player">Search Player (Gmail)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-user input-icon"></i>
                    <input
                      type="text"
                      id="select-player"
                      placeholder="Type player name or email to search..."
                      value={playerSearchQuery}
                      onChange={(e) => {
                        setPlayerSearchQuery(e.target.value);
                        setPlayerDropdownOpen(true);
                        if (!e.target.value.trim()) {
                          setSelectedPlayerEmail('');
                        }
                      }}
                      onFocus={() => setPlayerDropdownOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setPlayerDropdownOpen(false), 200);
                      }}
                      required
                    />
                  </div>
                  
                  {playerDropdownOpen && playersList.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#0d0f1a',
                      border: '1px solid rgba(255,215,0,0.3)',
                      borderRadius: '8px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      zIndex: 1050,
                      marginTop: '0.25rem',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                    }}>
                      {playersList.map((player) => (
                        <div
                          key={player.email}
                          onClick={() => handleSelectPlayer(player.email)}
                          style={{
                            padding: '0.55rem 0.85rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            fontSize: '0.75rem',
                            color: '#fff',
                            transition: 'background 0.2s ease',
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,215,0,0.1)'}
                          onMouseLeave={(e) => e.target.style.background = 'none'}
                        >
                          <strong>{player.name}</strong> ({player.email})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Game Selection Dropdown */}
                <div className="input-group">
                  <label htmlFor="select-game">Select Casino Game</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-gamepad input-icon"></i>
                    <select
                      id="select-game"
                      value={selectedGameTitle}
                      onChange={(e) => setSelectedGameTitle(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.75rem',
                        padding: '0.6rem 0.5rem 0.6rem 2.25rem',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                      }}
                      required
                    >
                      <option value="" style={{ background: '#0a0e1c', color: 'var(--text-muted)' }}>-- Choose Game Portal --</option>
                      {gamesList.map((game) => (
                        <option key={game.id} value={game.title} style={{ background: '#0a0e1c', color: '#fff' }}>
                          {game.title}
                        </option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.65rem', opacity: 0.5 }}></i>
                  </div>
                </div>

                {/* Username */}
                <div className="input-group">
                  <label htmlFor="custom-username">Game Username</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-user-tag input-icon"></i>
                    <input
                      type="text"
                      id="custom-username"
                      placeholder="Username for player..."
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="custom-password">Game Password</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-lock input-icon"></i>
                    <input
                      type="text"
                      id="custom-password"
                      placeholder="Password for player..."
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }}
                  disabled={isUpdatingCreds || !selectedPlayerEmail || !selectedGameTitle}
                >
                  {isUpdatingCreds ? 'CREATING...' : 'CREATE GAME ACCOUNT'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
