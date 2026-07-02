'use client';

import React, { useState } from 'react';

export default function AdminDashboard({
  games,
  users,
  accountRequests = [],
  transactions = [],
  gateways = [],
  onLogout,
  onAddGameClick,
  onEditGameClick,
  onDeleteGame,
  onDeleteUser,
  onApproveRequest,
  onApproveTransaction,
  onFailTransaction,
  onInspectProof,
  onAddGatewayClick,
  onEditGatewayClick,
  onDeleteGateway
}) {
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'requests' | 'ledger' | 'gateways'

  const normalUsers = users.filter((u) => u.role !== 'admin');
  const pendingRequests = accountRequests.filter((r) => r.status === 'PENDING');
  const pendingTransactions = transactions.filter((t) => t.status === 'PENDING');

  return (
    <div id="view-admin-dashboard">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-logo">
          <i className="fa-solid fa-gears admin-gear-icon"></i>
          <h2>
            JACKPOT ENTRY <span className="accent-red">ADMIN</span>
          </h2>
        </div>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', gap: '0.25rem', background: '#0b0c16', padding: '0.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setActiveTab('library')}
            className="lobby-nav-btn"
            style={{
              background: activeTab === 'library' ? 'var(--gold-primary)' : 'none',
              color: activeTab === 'library' ? '#111' : '#fff',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '0.45rem 0.85rem'
            }}
          >
            Library & Users
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className="lobby-nav-btn"
            style={{
              background: activeTab === 'requests' ? 'var(--gold-primary)' : 'none',
              color: activeTab === 'requests' ? '#111' : '#fff',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '0.45rem 0.85rem',
              position: 'relative'
            }}
          >
            Lobby Requests
            {pendingRequests.length > 0 && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', fontSize: '0.55rem', padding: '0.15rem 0.35rem', borderRadius: '50%', fontWeight: '900' }}>
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className="lobby-nav-btn"
            style={{
              background: activeTab === 'ledger' ? 'var(--gold-primary)' : 'none',
              color: activeTab === 'ledger' ? '#111' : '#fff',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '0.45rem 0.85rem',
              position: 'relative'
            }}
          >
            Financial Ledger
            {pendingTransactions.length > 0 && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', fontSize: '0.55rem', padding: '0.15rem 0.35rem', borderRadius: '50%', fontWeight: '900' }}>
                {pendingTransactions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('gateways')}
            className="lobby-nav-btn"
            style={{
              background: activeTab === 'gateways' ? 'var(--gold-primary)' : 'none',
              color: activeTab === 'gateways' ? '#111' : '#fff',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '0.45rem 0.85rem'
            }}
          >
            Payment Gateways
          </button>
        </nav>

        <div className="admin-profile">
          <span className="admin-email-tag">
            <i className="fa-solid fa-user-shield"></i> admin@jackpot.com
          </span>
          <button className="lobby-nav-btn logout-btn" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Workspace Cards */}
      <div className="admin-content-container">
        
        {/* ==============================================================
             TAB 1: GAMES LIBRARY & USERS
             ============================================================== */}
        {activeTab === 'library' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fade-in 0.25s ease-out' }}>
            <section className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-icon-wrapper gold-bg"><i className="fa-solid fa-gamepad"></i></div>
                <div className="stat-info"><h3>{games.length}</h3><p>Total Games</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper red-bg"><i className="fa-solid fa-users"></i></div>
                <div className="stat-info"><h3>{normalUsers.length}</h3><p>Registered Users</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper green-bg"><i className="fa-solid fa-circle-check"></i></div>
                <div className="stat-info"><h3>Active</h3><p>DB Status</p></div>
              </div>
            </section>

            <div className="admin-layout-split">
              {/* Games catalog */}
              <section className="admin-section-card">
                <div className="section-card-header">
                  <h3><i className="fa-solid fa-gamepad gold-text"></i> Game Library Manager</h3>
                  <button className="submit-btn add-game-trigger" onClick={onAddGameClick}>
                    <i className="fa-solid fa-plus"></i> Add New Game
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Game Image</th>
                        <th>Game Title</th>
                        <th>Badge Type</th>
                        <th>Target Play Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {games.length === 0 ? (
                        <tr><td colSpan="5" className="text-center text-muted">No games online.</td></tr>
                      ) : (
                        games.map((game) => (
                          <tr key={game.id}>
                            <td>
                              <div className="admin-game-th-img">
                                {game.image.startsWith('game_') ? (
                                  <img src={game.image} alt="cover" />
                                ) : (
                                  <div className={`game-placeholder-card ${game.image === 'placeholder_2' ? 'pc-red' : game.image === 'placeholder_3' ? 'pc-blue' : 'pc-gold'}`} style={{ fontSize: '1rem' }}>
                                    {game.title.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td><strong>{game.title}</strong></td>
                            <td><span className={`admin-badge-preview b-${game.badge}`}>{game.badge}</span></td>
                            <td>
                              <a href={game.link} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
                                {game.link.slice(0, 24)}...
                              </a>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button className="action-row-btn btn-edit" onClick={() => onEditGameClick(game)} title="Edit game"><i className="fa-solid fa-pen"></i></button>
                                <button className="action-row-btn btn-delete" onClick={() => onDeleteGame(game.id)} title="Delete game"><i className="fa-solid fa-trash"></i></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Users account */}
              <section className="admin-section-card">
                <div className="section-card-header">
                  <h3><i className="fa-solid fa-users text-red"></i> User Accounts</h3>
                </div>

                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Password (Demo)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalUsers.length === 0 ? (
                        <tr><td colSpan="4" className="text-center text-muted">No users.</td></tr>
                      ) : (
                        normalUsers.map((user) => (
                          <tr key={user.email}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td><code style={{ color: '#ffe066' }}>{user.password}</code></td>
                            <td>
                              <button className="action-row-btn btn-delete" onClick={() => onDeleteUser(user.email)} title="Delete User"><i className="fa-solid fa-user-minus"></i></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ==============================================================
             TAB 2: LOBBY REQUESTS
             ============================================================== */}
        {activeTab === 'requests' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.25s ease-out' }}>
            <div className="section-card-header">
              <h3><i className="fa-solid fa-user-plus gold-text"></i> Pending Lobby Game Account Requests</h3>
              <span className="game-tap-tip">Allot player login credentials</span>
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
                  {accountRequests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No pending game account requests.
                      </td>
                    </tr>
                  ) : (
                    accountRequests.map((req, idx) => (
                      <tr key={req.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{req.userEmail}</strong></td>
                        <td><span className="admin-badge-preview b-hot">{req.gameTitle}</span></td>
                        <td>{req.date}</td>
                        <td>
                          <span className={`admin-badge-preview b-${req.status.toLowerCase() === 'ready' ? 'ready' : req.status.toLowerCase()}`}>
                            {req.status}
                          </span>
                        </td>
                        <td>
                          {req.status === 'PENDING' ? (
                            <button
                              onClick={() => onApproveRequest(req)}
                              className="submit-btn"
                              style={{ background: '#22c55e', margin: 0, padding: '0.4rem 0.85rem', width: 'auto', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}
                            >
                              <i className="fa-solid fa-user-check"></i> <span style={{ fontSize: '0.7rem' }}>Approve Request</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Credentials Issued</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             TAB 3: FINANCIAL LEDGER WITH RECEIPT PROOF INSPECTORS
             ============================================================== */}
        {activeTab === 'ledger' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.25s ease-out' }}>
            <div className="section-card-header">
              <h3><i className="fa-solid fa-wallet text-red"></i> Financial Transaction Ledger</h3>
              <span className="game-tap-tip">Verify screenshot proof before approving</span>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User Email</th>
                    <th>Game Title</th>
                    <th>Tx Type</th>
                    <th>Amount</th>
                    <th>Gateway (Code)</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Payment Screenshot</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No transactions recorded.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => (
                      <tr key={tx.id}>
                        <td>{idx + 1}</td>
                        <td>{tx.userEmail}</td>
                        <td><strong>{tx.gameTitle}</strong></td>
                        <td>
                          <span className={`admin-badge-preview ${tx.type === 'DEPOSIT' ? 'b-hot' : 'b-new'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td><strong>${parseFloat(tx.amount).toFixed(2)}</strong></td>
                        <td>
                          <span style={{ fontSize: '0.725rem', opacity: 0.9 }}>
                            {tx.gateway} ({tx.code})
                          </span>
                          {tx.note && <p style={{ fontSize: '0.65rem', color: '#ff8787', margin: '0.2rem 0 0 0' }}>{tx.note}</p>}
                        </td>
                        <td style={{ fontSize: '0.7rem' }}>{tx.date}</td>
                        <td>
                          <span className={`admin-badge-preview b-${tx.status.toLowerCase() === 'success' ? 'ready' : tx.status.toLowerCase()}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td>
                          {tx.screenshot ? (
                            <button
                              onClick={() => onInspectProof(tx.screenshot)}
                              className="submit-btn"
                              style={{ background: '#3498db', margin: 0, padding: '0.35rem 0.65rem', width: 'auto', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}
                            >
                              <i className="fa-solid fa-receipt"></i> <span style={{ fontSize: '0.65rem' }}>View Proof</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No Screenshot</span>
                          )}
                        </td>
                        <td>
                          {tx.status === 'PENDING' ? (
                            <div className="table-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                              <button
                                onClick={() => onApproveTransaction(tx.id)}
                                className="action-row-btn btn-edit"
                                style={{ background: '#22c55e', color: '#fff' }}
                                title="Approve Payment"
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                              <button
                                onClick={() => onFailTransaction(tx.id)}
                                className="action-row-btn btn-delete"
                                style={{ background: '#ef4444', color: '#fff' }}
                                title="Fail/Reject Payment"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Processed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==============================================================
             TAB 4: DYNAMIC PAYMENT GATEWAYS CRUD
             ============================================================== */}
        {activeTab === 'gateways' && (
          <section className="admin-section-card" style={{ animation: 'fade-in 0.25s ease-out' }}>
            <div className="section-card-header">
              <h3><i className="fa-solid fa-sliders gold-text"></i> Payment Gateways Manager</h3>
              <button className="submit-btn add-game-trigger" onClick={onAddGatewayClick}>
                <i className="fa-solid fa-plus"></i> Add New Gateway
              </button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Gateway Name</th>
                    <th>Description Subtitle</th>
                    <th>Payment Tag / ID Address</th>
                    <th>Linked Number / Details</th>
                    <th>Visual Theme</th>
                    <th>QR Image Tag Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gateways.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No gateways configured. Click Add to create one.
                      </td>
                    </tr>
                  ) : (
                    gateways.map((gt) => (
                      <tr key={gt.id}>
                        <td><strong>{gt.name}</strong></td>
                        <td><span style={{ fontSize: '0.725rem', opacity: 0.8 }}>{gt.subtitle || '—'}</span></td>
                        <td><code style={{ color: '#00d2ff' }}>{gt.tag}</code></td>
                        <td>{gt.phone || '—'}</td>
                        <td>
                          <span className={`admin-badge-preview b-${gt.theme === 'chime' ? 'ready' : gt.theme === 'cashapp' ? 'none' : gt.theme === 'crypto' ? 'hot' : 'new'}`} style={{ textTransform: 'uppercase' }}>
                            {gt.theme}
                          </span>
                        </td>
                        <td>
                          <a href={gt.qrImage} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.7rem', textDecoration: 'none' }} title={gt.qrImage}>
                            {gt.qrImage.slice(0, 30)}...
                          </a>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              onClick={() => onEditGatewayClick(gt)}
                              className="action-row-btn btn-edit"
                              title="Edit Gateway"
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button
                              onClick={() => onDeleteGateway(gt.id)}
                              className="action-row-btn btn-delete"
                              title="Delete Gateway"
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
        )}
      </div>
    </div>
  );
}
