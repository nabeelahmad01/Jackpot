import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Super Admin (Full Access)' },
  { value: 'operation_admin', label: 'Operational Manager (Almost Full)' },
  { value: 'financial_admin', label: 'Financial Admin (Ledger/Transactions)' },
  { value: 'coins_admin', label: 'Coins & Games Admin (Gateways/Catalog)' },
  { value: 'support_admin', label: 'Support Admin (Live Chat)' }
];

export default function StaffTab({ adminUser, onCreateAdmin, onDeleteUser }) {
  const { data: usersData, mutate } = useSWR('/api/users?limit=200', fetcher);
  const [staffSearch, setStaffSearch] = useState('');

  // Admin Creation Form State
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(['financial_admin']);

  // Editing staff states
  const [editingStaff, setEditingStaff] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [selectedEditRoles, setSelectedEditRoles] = useState([]);

  const users = usersData?.users || [];
  
  // Identify all users that have admin/staff roles
  const { data: distsData } = useSWR('/api/distributors', fetcher);
  const distributorsList = distsData?.distributors || [];

  const [activeSubTab, setActiveSubTab] = useState('system'); // 'system' | 'distributor'

  const staffUsers = users.filter((u) => {
    if (!u.role) return false;
    if (u.distributorId) return false; // Exclude distributor staff from standard list!
    const cleanRole = u.role.toLowerCase();
    return cleanRole.split(',').some(r => 
      ['admin', 'financial_admin', 'coins_admin', 'support_admin', 'operation_admin'].includes(r.trim())
    );
  });

  const distributorStaffUsers = users.filter((u) => {
    if (!u.role) return false;
    if (!u.distributorId) return false; // Must belong to a distributor!
    const cleanRole = u.role.toLowerCase();
    return cleanRole.split(',').some(r => 
      ['admin', 'financial_admin', 'coins_admin', 'support_admin', 'operation_admin', 'distributor_staff'].includes(r.trim())
    );
  });

  const filteredStaff = (activeSubTab === 'system' ? staffUsers : distributorStaffUsers).filter(
    (s) =>
      s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.role.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const getDistributorEmail = (distId) => {
    const d = distributorsList.find(dist => dist.id === distId);
    return d ? `${d.name} (${d.email})` : distId || 'Unknown';
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleCheckboxChange = (roleVal) => {
    if (selectedRoles.includes(roleVal)) {
      // Don't allow empty roles list
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter(r => r !== roleVal));
      }
    } else {
      setSelectedRoles([...selectedRoles, roleVal]);
    }
  };

  const handleEditRoleCheckboxChange = (roleVal) => {
    if (selectedEditRoles.includes(roleVal)) {
      if (selectedEditRoles.length > 1) {
        setSelectedEditRoles(selectedEditRoles.filter(r => r !== roleVal));
      }
    } else {
      setSelectedEditRoles([...selectedEditRoles, roleVal]);
    }
  };

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) return;
    if (selectedRoles.length === 0) {
      alert('Please check at least one role permission.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateAdmin({
        name: newAdminName,
        email: newAdminEmail,
        password: newAdminPassword,
        role: selectedRoles.join(',')
      });

      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setSelectedRoles(['financial_admin']);
    } finally {
      setIsSubmitting(false);
    }
    mutate();
  };

  const handleEditClick = (staff) => {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditEmail(staff.email);
    setEditPassword('');
    setSelectedEditRoles(staff.role.split(',').map(r => r.trim()));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    if (selectedEditRoles.length === 0) {
      alert('Please select at least one permission role.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        email: editEmail,
        name: editName.trim(),
        role: selectedEditRoles.join(',')
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setEditingStaff(null);
        mutate();
      } else {
        alert(data.message || 'Failed to update staff details.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (email) => {
    if (email.toLowerCase() === adminUser?.email.toLowerCase()) {
      alert('You cannot delete your own admin account.');
      return;
    }
    if (window.confirm(`Delete staff registry account "${email}"?`)) {
      await onDeleteUser(email);
      mutate();
    }
  };

  const formatRoleName = (roleVal) => {
    if (!roleVal) return 'Unknown';
    return roleVal
      .split(',')
      .map((r) => {
        const clean = r.trim().toLowerCase();
        if (clean === 'admin') return 'Super Admin';
        if (clean === 'financial_admin') return 'Financial Admin';
        if (clean === 'coins_admin') return 'Coins Admin';
        if (clean === 'support_admin') return 'Support Admin';
        if (clean === 'operation_admin') return 'Operational Manager';
        return r;
      })
      .join(' + ');
  };

  return (
    <div className="admin-layout-split" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
      
      {/* 1) REGISTER FORM CARD */}
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

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ marginBottom: '0.5rem', display: 'block' }}>Authority Permissions (Select Multiple)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#0b0d16', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {AVAILABLE_ROLES.map((role) => (
                <label key={role.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: selectedRoles.includes(role.value) ? 'var(--gold-primary)' : '#fff' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.value)}
                    onChange={() => handleRoleCheckboxChange(role.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isSubmitting}>
            {isSubmitting ? 'CREATING...' : 'CREATE STAFF USER ➔'}
          </button>
        </form>
      </section>

      {/* 2) STAFF REGISTRY TABLE */}
      <section className="admin-section-card">
        <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <h3><i className="fa-solid fa-user-shield text-red"></i> Administrative Staff Registry</h3>
          
          <div style={{ display: 'flex', gap: '0.5rem', background: '#070913', padding: '0.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', width: 'fit-content', marginBottom: '0.25rem' }}>
            <button
              onClick={() => setActiveSubTab('system')}
              style={{
                border: 'none',
                padding: '0.35rem 1rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                background: activeSubTab === 'system' ? 'var(--gold-primary)' : 'none',
                color: activeSubTab === 'system' ? '#000' : '#fff',
                transition: 'all 0.15s ease'
              }}
            >
              System Staff ({staffUsers.length})
            </button>
            <button
              onClick={() => setActiveSubTab('distributor')}
              style={{
                border: 'none',
                padding: '0.35rem 1rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                background: activeSubTab === 'distributor' ? 'var(--gold-primary)' : 'none',
                color: activeSubTab === 'distributor' ? '#000' : '#fff',
                transition: 'all 0.15s ease'
              }}
            >
              Distributor Staff ({distributorStaffUsers.length})
            </button>
          </div>

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
                <th>Privilege Permissions</th>
                {activeSubTab === 'distributor' && <th>Distributor</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr><td colSpan={activeSubTab === 'distributor' ? 5 : 4} className="text-center text-muted">No staff found.</td></tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.email}>
                    <td>{staff.name}</td>
                    <td>{staff.email}</td>
                    <td>
                      <span className="admin-badge-preview b-ready" style={{ textTransform: 'uppercase', display: 'inline-block', fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                        {formatRoleName(staff.role)}
                      </span>
                    </td>
                    {activeSubTab === 'distributor' && (
                      <td style={{ color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                        {getDistributorEmail(staff.distributorId)}
                      </td>
                    )}
                    <td>
                      {staff.email.toLowerCase() === adminUser?.email.toLowerCase() ? (
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Active User</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="action-row-btn"
                            onClick={() => handleEditClick(staff)}
                            title="Edit Staff Member"
                            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: 'var(--gold-primary)' }}
                          >
                            <i className="fa-solid fa-user-pen"></i>
                          </button>
                          <button
                            className="action-row-btn btn-delete"
                            onClick={() => handleDelete(staff.email)}
                            title="Delete Admin"
                          >
                            <i className="fa-solid fa-user-minus"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3) EDIT STAFF MODAL OVERLAY */}
      {editingStaff && (
        <div className="modal-backdrop-custom" onClick={() => setEditingStaff(null)}>
          <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3><i className="fa-solid fa-user-gear gold-text"></i> Edit Staff Member</h3>
              <button type="button" className="close-modal" onClick={() => setEditingStaff(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit} noValidate>
                <div className="input-group">
                  <label>Email Address (Cannot change)</label>
                  <div className="input-wrapper" style={{ opacity: 0.6 }}>
                    <i className="fa-solid fa-envelope input-icon"></i>
                    <input type="text" value={editEmail} readOnly disabled />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="edit-staff-name">Full Name</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-user input-icon"></i>
                    <input
                      type="text"
                      id="edit-staff-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="edit-staff-pass">New Password (Leave blank to keep unchanged)</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-lock input-icon"></i>
                    <input
                      type="text"
                      id="edit-staff-pass"
                      placeholder="Enter new password if changing..."
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ marginBottom: '0.5rem', display: 'block' }}>Modify Authority Roles</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#0b0d16', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {AVAILABLE_ROLES.map((role) => (
                      <label key={role.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: selectedEditRoles.includes(role.value) ? 'var(--gold-primary)' : '#fff' }}>
                        <input
                          type="checkbox"
                          checked={selectedEditRoles.includes(role.value)}
                          onChange={() => handleEditRoleCheckboxChange(role.value)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold' }} disabled={isSubmitting}>
                  {isSubmitting ? 'UPDATING...' : 'UPDATE STAFF DETAILS'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
