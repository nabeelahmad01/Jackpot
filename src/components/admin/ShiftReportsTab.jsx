'use client';

import React, { useState } from 'react';
import usePollingSWR from '../../hooks/usePollingSWR';
import { POLL } from '../../lib/pollingConfig';
import { formatDeviceDateTime } from '../../lib/formatDateTime';

export default function ShiftReportsTab() {
  const [search, setSearch] = useState('');
  
  // Fetch shift reports from database
  const { data, error, mutate } = usePollingSWR('/api/admin/shift-reports', POLL.LISTS);

  const reports = data?.reports || [];
  const isLoading = !data && !error;

  const filteredReports = reports.filter((r) =>
    r.staffEmail.toLowerCase().includes(search.toLowerCase()) ||
    r.shiftName.toLowerCase().includes(search.toLowerCase()) ||
    (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h3><i className="fa-solid fa-clock-rotate-left text-red"></i> Staff Shift Loading Records</h3>
          <span className="game-tap-tip">Shift loading reports and hand-over notes submitted by coins admins</span>
        </div>

        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search shift reports by staff email, shift name, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Staff Email</th>
              <th>Shift Name</th>
              <th>Hand-over Notes & Comments</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="4" className="text-center text-muted" style={{ padding: '2rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--gold-primary)', marginRight: '6px' }}></i> Loading shift reports...
                </td>
              </tr>
            ) : filteredReports.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center text-muted" style={{ padding: '2rem' }}>
                  No shift reports submitted yet.
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr key={report.id}>
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDeviceDateTime(report.timestamp, report.date)}</td>
                  <td><strong>{report.staffEmail}</strong></td>
                  <td>
                    <span className="admin-badge-preview b-ready" style={{ fontSize: '0.7rem' }}>
                      {report.shiftName}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', maxWidth: '300px', wordBreak: 'break-word', color: 'rgba(255,255,255,0.8)' }}>
                    {report.notes || <span style={{ opacity: 0.4 }}>— No Notes —</span>}
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
