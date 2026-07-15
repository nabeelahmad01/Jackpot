'use client';

import React from 'react';
import usePollingSWR from '../../hooks/usePollingSWR';
import { POLL } from '../../lib/pollingConfig';

export default function GatewayRevenueBreakdown({ adminDistributorId = '', title = 'Financial Transaction Ledger', compact = false }) {
  const { data: gatewayStatsData } = usePollingSWR(
    `/api/transactions/gateway-stats?adminDistributorId=${adminDistributorId || ''}`,
    POLL.LISTS
  );

  const gatewayStats = gatewayStatsData?.stats || [];

  const breakdown = (
    <div style={{ marginBottom: compact ? '2rem' : 0, padding: '1.25rem', background: '#0b0d16', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h4 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <i className="fa-solid fa-chart-pie" style={{ color: 'var(--gold-primary)' }}></i> GATEWAY REVENUE BREAKDOWN
        </h4>
        {gatewayStats.length === 0 ? (
          <div style={{ color: '#666', fontSize: '0.75rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
            No successful gateway transaction history found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table" style={{ fontSize: '0.75rem', border: 'none', background: 'transparent' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>GATEWAY NAME</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>TOTAL RECEIVED (DEPOSITS)</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>TOTAL WITHDRAWN</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>NET BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {gatewayStats.map((item) => (
                  <tr key={item.gateway} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold', color: '#fff' }}>
                      <span className="admin-badge-preview b-new" style={{ textTransform: 'uppercase', padding: '0.15rem 0.35rem' }}>{item.gateway}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#2ecc71', fontWeight: 'bold' }}>
                      ${item.received.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}>
                      ${item.withdrawn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: item.net >= 0 ? '#2ecc71' : '#ef4444', fontWeight: 'bold' }}>
                      ${item.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );

  if (compact) return breakdown;

  return (
    <section className="admin-section-card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-card-header" style={{ marginBottom: '1rem' }}>
        <h3><i className="fa-solid fa-wallet text-red"></i> {title}</h3>
      </div>
      {breakdown}
    </section>
  );
}
