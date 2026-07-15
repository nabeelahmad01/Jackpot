'use client';

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
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);

  const cleanRoles = (adminUser?.role || '').toLowerCase().split(',').map(r => r.trim());
  const canUpdateCredentials = cleanRoles.some(r => ['admin', 'operation_admin', 'coins_admin', 'distributor'].includes(r));

  // Check for existing game account and pre-fill credentials
  useEffect(() => {
    if (selectedPlayerEmail && selectedGameTitle) {
      fetch(`/api/game-accounts?email=${encodeURIComponent(selectedPlayerEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.gameAccounts) {
            const match = data.gameAccounts.find(
              acc => acc.gameTitle.toLowerCase() === selectedGameTitle.toLowerCase()
            );
            if (match) {
              setCustomUsername(match.username || '');
              setCustomPassword(match.password || '');
              setIsExistingAccount(true);
            } else {
              setIsExistingAccount(false);
              // Auto-generate username & password
              const prefix = selectedPlayerEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
              const randomSuf = Math.floor(100 + Math.random() * 900);
              setCustomUsername(`${prefix}${randomSuf}`);

              const charSet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
              let randPass = '';
              for (let i = 0; i < 8; i++) {
                randPass += charSet.charAt(Math.floor(Math.random() * charSet.length));
              }
              setCustomPassword(randPass);
            }
          }
        })
        .catch(err => console.error('Error fetching game account details:', err));
    } else {
      setIsExistingAccount(false);
    }
  }, [selectedPlayerEmail, selectedGameTitle]);

  const handleSelectPlayer = (email) => {
    setSelectedPlayerEmail(email);
    setPlayerSearchQuery(email);
    setPlayerDropdownOpen(false);
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
        fetch(`/api/users?limit=50&search=${encodeURIComponent(playerSearchQuery)}&adminDistributorId=${adminUser?.distributorId || ''}`, { signal: controller.signal })
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
    `/api/account-requests?status=PENDING&page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&adminRole=${adminUser?.role || ''}&adminDistributorId=${adminUser?.distributorId || ''}&adminEmail=${encodeURIComponent(adminUser?.email || '')}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  const requests = (data?.accountRequests || []).filter((r) => !completedActionIds[r.id]);
  const totalRequests = data?.totalRequests || 0;
  const totalPages = data?.totalPages || 1;

  const { data: settingsData } = useSWR('/api/settings/frontend', fetcher);
  const [prevCount, setPrevCount] = useState(null);

  useEffect(() => {
    if (data) {
      const currentCount = (data.accountRequests || []).length;
      if (prevCount !== null && currentCount > prevCount) {
        try {
          const rawUrl = settingsData?.settings?.notificationSoundUrl || 'https://raw.githubusercontent.com/AUTOMATIC1111/stable-diffusion-webui/master/notification.mp3';
          const cleanUrl = rawUrl.replace(/^data:video\/[^;]+;/, 'data:audio/mpeg;');
          const audio = new Audio(cleanUrl);
          audio.play().catch(err => console.log('Audio playback blocked or failed:', err));
        } catch (audioErr) {
          console.error('Audio play error:', audioErr);
        }
      }
      setPrevCount(currentCount);
    }
  }, [data, settingsData]);

  const handleApprove = async (reqItem) => {
    // Approve action wrapper handles state modifications
    await onApproveRequest(reqItem);
    mutate(); // instantly refresh list
  };

  const handleEditGameAccount = (email, gameTitle) => {
    setSelectedPlayerEmail(email);
    setSelectedGameTitle(gameTitle);
    setPlayerSearchQuery(email);
    setAddAccountModalOpen(true);
  };

  const handleDeleteGameAccount = async (email, gameTitle) => {
    if (!window.confirm(`Are you sure you want to delete the game credentials for ${gameTitle} of player ${email}?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/game-accounts?userEmail=${encodeURIComponent(email)}&gameTitle=${encodeURIComponent(gameTitle)}`, {
        method: 'DELETE'
      });
      const resData = await response.json();
      if (resData.success) {
        alert('Game credentials deleted successfully!');
        mutate(); // Refresh the list
      } else {
        alert(resData.message || 'Failed to delete game credentials.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting game credentials.');
    }
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
                  <td>
                    <strong>{req.userEmail}</strong>
                    {req.existingAccounts && req.existingAccounts.length > 0 && (() => {
                      // For regular requests, only show the account for the requested game
                      // For synthetic (search) results, show all accounts
                      const accsToShow = req.isSynthetic
                        ? req.existingAccounts
                        : req.existingAccounts.filter(acc => acc.gameTitle === req.gameTitle);
                      if (accsToShow.length === 0) return null;
                      return (
                        <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '0.2rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {accsToShow.map((acc, idx) => (
                            <span key={idx} style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.15)', color: '#fff', padding: '0.05rem 0.3rem', borderRadius: '4px' }}>
                              {acc.gameTitle}: <strong style={{ color: 'var(--gold-primary)' }}>{acc.username}</strong>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                          {req.distributorType === 'B' && (
                            <span style={{ fontSize: '0.6rem', color: '#3b82f6', display: 'block', textAlign: 'center' }}>
                              Managed by {req.distributorName || 'Distributor'}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {req.status === 'READY' && req.gameTitle && req.gameTitle !== '—' && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleEditGameAccount(req.userEmail, req.gameTitle)}
                            className="action-row-btn btn-edit"
                            style={{ background: '#3b82f6', color: '#fff', padding: '0.35rem 0.65rem', margin: 0, width: 'auto', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            title="Edit Credentials"
                          >
                            <i className="fa-solid fa-pen-to-square"></i> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGameAccount(req.userEmail, req.gameTitle)}
                            className="action-row-btn btn-delete"
                            style={{ background: '#ef4444', color: '#fff', padding: '0.35rem 0.65rem', margin: 0, width: 'auto', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            title="Delete Credentials"
                          >
                            <i className="fa-solid fa-trash"></i> Delete
                          </button>
                        </div>
                      )}

                      {req.status === 'READY' && (!req.gameTitle || req.gameTitle === '—') && req.existingAccounts && req.existingAccounts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%', minWidth: '150px' }}>
                          {req.existingAccounts.map((acc, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{acc.gameTitle}</span>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  onClick={() => handleEditGameAccount(req.userEmail, acc.gameTitle)}
                                  style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px', fontSize: '0.75rem' }}
                                  title="Edit"
                                >
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                                <button
                                  onClick={() => handleDeleteGameAccount(req.userEmail, acc.gameTitle)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', fontSize: '0.75rem' }}
                                  title="Delete"
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
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
                  <label htmlFor="custom-username" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Game Username</span>
                    {isExistingAccount && (
                      <span style={{ fontSize: '0.625rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)' }}>
                        Existing Account Found
                      </span>
                    )}
                  </label>
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
                  style={{ background: isExistingAccount ? '#10b981' : 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }}
                  disabled={isUpdatingCreds || !selectedPlayerEmail || !selectedGameTitle}
                >
                  {isUpdatingCreds ? 'SAVING...' : isExistingAccount ? 'UPDATE GAME ACCOUNT' : 'CREATE GAME ACCOUNT'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
