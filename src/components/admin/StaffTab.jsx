import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function StaffTab({ adminUser, onCreateAdmin, onDeleteUser }) {
  const { data: usersData, mutate } = useSWR('/api/users?limit=200', fetcher);
  const [staffSearch, setStaffSearch] = useState('');

  // Admin Creation Form State
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('financial_admin');

  const users = usersData?.users || [];
  const staffUsers = users.filter((u) =>
    ['admin', 'financial_admin', 'coins_admin', 'support_admin', 'operation_admin'].includes(u.role)
  );

  const filteredStaff = staffUsers.filter(
    (s) =>
      s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.role.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateAdmin({
        name: newAdminName,
        email: newAdminEmail,
        password: newAdminPassword,
        role: newAdminRole
      });

      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminRole('financial_admin');
    } finally {
      setIsSubmitting(false);
    }
    mutate();
  };

  const handleDelete = async (email) => {
    if (email.toLowerCase() === adminUser?.email.toLowerCase()) {
      alert('You cannot delete your own admin account.');
      return;
    }
    await onDeleteUser(email);
    mutate();
  };

  return (
    <div className="admin-layout-split" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
      
      <section className="admin-section-card">
        <div className="section-card-header" style={{ marginBottom: '1.25rem' }}>
          <h3><i className="fa-solid fa-user-shield gold-text"></i> Register Admin Staff</h3>
        </div>

        <form onSubmit={handleAddStaffSubmit} noValidate>
          <div className="input-group">
            <label htmlFor="staff-name">Full Name</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-user input-icon"></i>
              <input
                type="text"
                id="staff-name"
                placeholder="e.g. Deposit Agent"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="staff-email">Login Email</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-envelope input-icon"></i>
              <input
                type="email"
                id="staff-email"
                placeholder="staff@jackpot.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="staff-pass">Temporary Password</label>
            <div className="input-wrapper">
              <i className="fa-solid fa-lock input-icon"></i>
              <input
                type="text"
                id="staff-pass"
                placeholder="e.g. staffPass123"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="staff-role">Staff Authority Role</label>
            <div className="input-wrapper select-wrapper">
              <i className="fa-solid fa-user-shield input-icon"></i>
              <select
                id="staff-role"
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
              >
                <option value="financial_admin">Financial Admin (Transactions Ledger)</option>
                <option value="coins_admin">Coins & Games Admin (Gateways/Catalog)</option>
                <option value="support_admin">Support Admin (Human Live Support)</option>
                <option value="operation_admin">Operational Manager (Almost Full Access)</option>
                <option value="admin">Super Admin (Unrestricted Full Access)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isSubmitting}>
            {isSubmitting ? 'CREATING...' : 'CREATE STAFF USER ➔'}
          </button>
        </form>
      </section>

      <section className="admin-section-card">
        <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <h3><i className="fa-solid fa-user-shield text-red"></i> Administrative Staff Registry</h3>
          
          <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
            <i className="fa-solid fa-magnifying-glass input-icon"></i>
            <input
              type="text"
              placeholder="Search staff registry..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Privilege Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted">No staff found.</td></tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.email}>
                    <td>{staff.name}</td>
                    <td>{staff.email}</td>
                    <td>
                      <span className={`admin-badge-preview b-${staff.role === 'admin' ? 'ready' : staff.role === 'operation_admin' ? 'vip' : staff.role === 'financial_admin' ? 'none' : staff.role === 'coins_admin' ? 'hot' : 'new'}`} style={{ textTransform: 'uppercase' }}>
                        {staff.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {staff.email.toLowerCase() === adminUser?.email.toLowerCase() ? (
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Active User</span>
                      ) : (
                        <button
                          className="action-row-btn btn-delete"
                          onClick={() => handleDelete(staff.email)}
                          title="Delete Admin"
                        >
                          <i className="fa-solid fa-user-minus"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
