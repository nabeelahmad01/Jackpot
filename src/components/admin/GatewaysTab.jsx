import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function GatewaysTab({ onAddGatewayClick, onEditGatewayClick, onDeleteGateway }) {
  const { data: gatewaysData, error, mutate } = useSWR('/api/gateways', fetcher);
  const [gatewaySearch, setGatewaySearch] = useState('');

  const gateways = gatewaysData?.gateways || [];
  const filteredGateways = gateways.filter((g) =>
    g.name.toLowerCase().includes(gatewaySearch.toLowerCase()) ||
    g.tag.toLowerCase().includes(gatewaySearch.toLowerCase())
  );

  const handleDelete = async (id) => {
    await onDeleteGateway(id);
    mutate();
  };

  if (!gatewaysData && !error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
        <p>Loading payment gateways...</p>
      </div>
    );
  }

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3><i className="fa-solid fa-sliders gold-text"></i> Payment Gateways Manager</h3>
          <button className="submit-btn add-game-trigger" onClick={onAddGatewayClick} style={{ width: 'auto', marginTop: 0 }}>
            <i className="fa-solid fa-plus"></i> Add New Gateway
          </button>
        </div>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search payment gateways..."
            value={gatewaySearch}
            onChange={(e) => setGatewaySearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Gateway Name</th>
              <th>Subtitle Description</th>
              <th>Payment Handle Tag</th>
              <th>Phone / Contact Info</th>
              <th>Visual Theme</th>
              <th>Cashout</th>
              <th>Pay Redirect URL</th>
              <th>QR Image Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGateways.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No gateways configured. Click Add to create one.
                </td>
              </tr>
            ) : (
              filteredGateways.map((gt) => (
                <tr key={gt.id}>
                  <td><strong>{gt.name}</strong></td>
                  <td><span style={{ fontSize: '0.725rem', opacity: 0.8 }}>{gt.subtitle || '—'}</span></td>
                  <td><code style={{ color: '#00d2ff' }}>{gt.tag}</code></td>
                  <td>{gt.phone || '—'}</td>
                  <td>
                    <span className={`admin-badge-preview b-${gt.theme === 'chime' ? 'ready' : gt.theme === 'cashapp' ? 'none' : gt.theme === 'stripe' ? 'vip' : gt.theme === 'crypto' ? 'hot' : 'new'}`} style={{ textTransform: 'uppercase' }}>
                      {gt.theme}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge-preview ${gt.isWithdrawActive ? 'b-ready' : 'b-none'}`}
                      style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}
                      title={gt.isWithdrawActive ? 'Shown on player Withdraw' : 'Deposit only (unless no cashout gateways are enabled)'}
                    >
                      {gt.isWithdrawActive ? 'CASHOUT ON' : 'DEPOSIT'}
                    </span>
                  </td>
                  <td>
                    {gt.redirectUrl ? (
                      <a href={gt.redirectUrl} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.7rem', textDecoration: 'none' }} title={gt.redirectUrl}>
                        {String(gt.redirectUrl).slice(0, 36)}{String(gt.redirectUrl).length > 36 ? '…' : ''}
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <a href={gt.qrImage} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.7rem', textDecoration: 'none' }} title={gt.qrImage}>
                      {(gt.qrImage || '').slice(0, 30)}...
                    </a>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => onEditGatewayClick(gt)} className="action-row-btn btn-edit" title="Edit Gateway"><i className="fa-solid fa-pen"></i></button>
                      <button onClick={() => handleDelete(gt.id)} className="action-row-btn btn-delete" title="Delete Gateway"><i className="fa-solid fa-trash"></i></button>
                    </div>
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
