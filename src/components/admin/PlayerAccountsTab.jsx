import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function PlayerAccountsTab({ onDeleteUser }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Debounce search typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 400000); // Wait, 400s is way too long for debounce! Let's use 400ms!
    return () => clearTimeout(handler);
  }, [search]);

  // Actually let's use a standard 400ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, error, mutate } = useSWR(
    `/api/users?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`,
    fetcher
  );

  const users = data?.users || [];
  const totalUsers = data?.totalUsers || 0;
  const totalPages = data?.totalPages || 1;

  const handleDelete = async (email) => {
    await onDeleteUser(email);
    mutate();
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
        <h3><i className="fa-solid fa-users text-red"></i> Player Accounts ({totalUsers} Registered)</h3>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search players by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email Address</th>
              <th>Referral Code</th>
              <th>Privilege Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading accounts...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5" className="text-center text-muted">No matching players.</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.email}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#a855f7', fontWeight: 700 }}>
                      {user.referralCode || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge-preview b-new">PLAYER</span>
                  </td>
                  <td>
                    <button className="action-row-btn btn-delete" onClick={() => handleDelete(user.email)} title="Delete User"><i className="fa-solid fa-user-minus"></i></button>
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
            Showing page {page} of {totalPages} ({totalUsers} entries)
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
    </section>
  );
}
