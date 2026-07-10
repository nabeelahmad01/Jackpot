import React from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function OverviewTab({ adminUser, onUpdateGameCoinsPool }) {
  const [shiftName, setShiftName] = React.useState('Morning Shift (8 AM - 4 PM)');
  const [totalLoaded, setTotalLoaded] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);

  const handleShiftReportSubmit = async (e) => {
    e.preventDefault();
    if (!totalLoaded || isNaN(parseFloat(totalLoaded)) || parseFloat(totalLoaded) < 0) {
      alert('Please enter a valid positive number for total loaded coins.');
      return;
    }
    
    setIsSubmittingReport(true);
    try {
      const response = await fetch('/api/admin/shift-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffEmail: adminUser.email,
          shiftName,
          totalLoaded: parseFloat(totalLoaded),
          notes
        })
      });
      const data = await response.json();
      if (data.success) {
        setTotalLoaded('');
        setNotes('');
        alert('End of shift report submitted successfully!');
      } else {
        alert(data.message || 'Failed to submit report.');
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Use SWR to poll stats every 4s and games list
  const { data: statsData, error: statsError } = useSWR('/api/admin/stats', fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true
  });
  const { data: gamesData, error: gamesError, mutate: mutateGames } = useSWR('/api/games', fetcher);
  const { data: activityData } = useSWR('/api/admin/activity', fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true
  });

  const stats = statsData?.stats || {
    todayDeposits: 0,
    todayWithdrawals: 0,
    yesterdayDeposits: 0,
    yesterdayWithdrawals: 0
  };

  const games = gamesData?.games || [];

  const triggerPoolUpdate = async (game) => {
    const promptVal = window.prompt(`Update available/remaining coins pool for ${game.title}:`, game.availableCoins || 0);
    if (promptVal === null) return;
    const val = parseInt(promptVal, 10);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid positive number.');
      return;
    }
    await onUpdateGameCoinsPool(game.id, val);
    mutateGames(); // immediately refresh games pool
  };

  const isLoading = !statsData || !gamesData;

  if (isLoading && !statsError && !gamesError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
        <p>Loading overview stats...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fade-in 0.2s ease-out' }}>
      
      {/* Inactive Staff / Unresponded Request alert box */}
      {(adminUser?.role === 'admin' || adminUser?.role?.toLowerCase().split(',').map(r => r.trim()).includes('operation_admin')) && activityData?.hasUnrespondedRequest && activityData?.activeStaffCount > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)',
          animation: 'pulse-lion 2s infinite ease-in-out'
        }}>
          <h4 style={{ color: '#ef4444', margin: 0, fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-bell animate-bounce" style={{ color: '#ef4444' }}></i>
            Unresponded Request Alert (Staff Logged In)
          </h4>
          <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '0.5rem 0' }}>
            There are currently <strong style={{ color: '#ef4444' }}>{activityData?.activeStaffCount} active staff member(s)</strong> logged in, but one or more requests have been pending for **over 2 minutes** without a response!
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            {activityData?.activeStaffList?.map((s) => (
              <span key={s.email} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', color: '#ffd700' }}>
                👤 {s.name || s.email} ({s.role.replace('_', ' ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Daily Financial Summaries */}
      <section className="admin-stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #2ecc71' }}>
          <div className="stat-icon-wrapper green-bg"><i className="fa-solid fa-arrow-down-long"></i></div>
          <div className="stat-info">
            <h3>${stats.todayDeposits.toFixed(2)}</h3>
            <p>Today's Total Deposits</p>
          </div>
        </div>
        
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon-wrapper red-bg"><i className="fa-solid fa-arrow-up-long"></i></div>
          <div className="stat-info">
            <h3>${stats.todayWithdrawals.toFixed(2)}</h3>
            <p>Today's Total Withdrawals</p>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #3498db' }}>
          <div className="stat-icon-wrapper gold-bg"><i className="fa-solid fa-calendar-day"></i></div>
          <div className="stat-info">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Yesterday Details:</span>
            <span style={{ fontSize: '0.8rem', color: '#2ecc71', fontWeight: 'bold' }}>📥 In: ${stats.yesterdayDeposits.toFixed(2)}</span>
            <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold', marginLeft: '0.5rem' }}>📤 Out: ${stats.yesterdayWithdrawals.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* End of Shift Coins Loading Report Card (Visible to all admins/staff to submit) */}
      {adminUser && (
        <section className="admin-section-card" style={{ borderLeft: '4px solid var(--gold-primary)', background: '#0a0d16' }}>
          <div className="section-card-header" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <i className="fa-solid fa-clock-rotate-left text-red"></i> Submit End of Shift Loading Report
              </h3>
              <span className="game-tap-tip">Submit your shift statistics directly to the Boss & Operation Manager</span>
            </div>
          </div>

          <form onSubmit={handleShiftReportSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
            <div className="input-group" style={{ flex: '1 1 100%', margin: 0 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Select Shift Timeframe</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'Morning Shift (8 AM - 4 PM)', label: 'Morning Shift', hours: '8 AM - 4 PM', icon: 'fa-sun' },
                  { value: 'Evening Shift (4 PM - 12 AM)', label: 'Evening Shift', hours: '4 PM - 12 AM', icon: 'fa-moon' },
                  { value: 'Night Shift (12 AM - 8 AM)', label: 'Night Shift', hours: '12 AM - 8 AM', icon: 'fa-star' }
                ].map((s) => {
                  const isSelected = shiftName === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setShiftName(s.value)}
                      style={{
                        flex: '1 1 180px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 1rem',
                        background: isSelected ? 'rgba(255, 215, 0, 0.1)' : '#070912',
                        border: isSelected ? '1px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        color: isSelected ? 'var(--gold-primary)' : '#fff',
                        margin: 0
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isSelected ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        color: isSelected ? 'var(--gold-primary)' : 'var(--text-muted)'
                      }}>
                        <i className={`fa-solid ${s.icon}`}></i>
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.75rem', display: 'block' }}>{s.label}</strong>
                        <span style={{ fontSize: '0.6rem', opacity: 0.6, display: 'block', marginTop: '0.15rem' }}>{s.hours}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="input-group" style={{ flex: '1 1 200px', margin: 0 }}>
              <label style={{ fontSize: '0.7rem' }}>Total Coins Loaded during shift ($)</label>
              <div className="input-wrapper" style={{ background: '#07090f' }}>
                <i className="fa-solid fa-coins input-icon"></i>
                <input
                  type="number"
                  placeholder="e.g. 1500.00"
                  step="0.01"
                  value={totalLoaded}
                  onChange={(e) => setTotalLoaded(e.target.value)}
                  style={{ fontSize: '0.775rem' }}
                  required
                />
              </div>
            </div>

            <div className="input-group" style={{ flex: '1 1 100%', margin: 0 }}>
              <label style={{ fontSize: '0.7rem' }}>Shift Notes & Hand-over Comments</label>
              <textarea
                placeholder="Write highlights, hand-over notes, or shift details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  background: '#07090f',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  color: '#fff',
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem',
                  fontSize: '0.775rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <button type="submit" className="submit-btn" style={{ background: 'var(--gold-primary)', color: '#000', fontWeight: 'bold', width: 'auto', padding: '0.65rem 1.5rem', margin: 0 }} disabled={isSubmittingReport}>
              <span>{isSubmittingReport ? 'SUBMITTING...' : 'SUBMIT SHIFT REPORT ➔'}</span>
              <div className="btn-glow"></div>
            </button>
          </form>
        </section>
      )}

      {/* Game coins pool status */}
      <section className="admin-section-card">
        <div className="section-card-header">
          <div>
            <h3><i className="fa-solid fa-coins gold-text"></i> Game Coins Remaining Pool</h3>
            <span className="game-tap-tip">Allotment reserves of active game platforms</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Game Title</th>
                <th>Game Badge</th>
                <th>Remaining Coins Balance</th>
                <th>Fulfillment Portal</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted">No games loaded in library.</td>
                </tr>
              ) : (
                games.map((game) => (
                  <tr key={game.id}>
                    <td><strong>{game.title}</strong></td>
                    <td><span className={`admin-badge-preview b-${game.badge}`}>{game.badge}</span></td>
                    <td>
                      <strong style={{ fontSize: '0.95rem', color: (game.availableCoins || 0) < 5000 ? '#ef4444' : '#ffd700' }}>
                        <i className="fa-solid fa-coins" style={{ color: '#ffd700', marginRight: '4px' }}></i> {game.availableCoins || 0} Coins
                      </strong>
                    </td>
                    <td>
                      <a href={game.link} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
                        Open Panel &rarr;
                      </a>
                    </td>
                    <td>
                      {(adminUser?.role === 'admin' || adminUser?.role === 'coins_admin') ? (
                        <button
                          onClick={() => triggerPoolUpdate(game)}
                          className="action-row-btn btn-edit"
                          style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Update Remaining Pool"
                        >
                          <i className="fa-solid fa-pen-to-square"></i> Update Pool
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Restricted</span>
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
