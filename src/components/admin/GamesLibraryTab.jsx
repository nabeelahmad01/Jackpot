import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function GamesLibraryTab({ onAddGameClick, onEditGameClick, onDeleteGame }) {
  const { data: gamesData, error, mutate } = useSWR('/api/games', fetcher);
  const [gameSearch, setGameSearch] = useState('');

  const games = gamesData?.games || [];
  const filteredGames = games.filter((g) =>
    g.title.toLowerCase().includes(gameSearch.toLowerCase())
  );

  const handleDelete = async (id) => {
    await onDeleteGame(id);
    mutate(); // revalidate cache
  };

  if (!gamesData && !error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--gold-primary)', marginBottom: '1rem', display: 'block' }}></i>
        <p>Loading games library...</p>
      </div>
    );
  }

  return (
    <section className="admin-section-card" style={{ animation: 'fade-in 0.2s ease-out' }}>
      <div className="section-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3><i className="fa-solid fa-gamepad gold-text"></i> Game Library Manager</h3>
          <button className="submit-btn add-game-trigger" onClick={onAddGameClick} style={{ width: 'auto', marginTop: 0 }}>
            <i className="fa-solid fa-plus"></i> Add New Game
          </button>
        </div>
        
        <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', width: '100%' }}>
          <i className="fa-solid fa-magnifying-glass input-icon"></i>
          <input
            type="text"
            placeholder="Search games by title..."
            value={gameSearch}
            onChange={(e) => setGameSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Game Cover</th>
              <th>Game Title</th>
              <th>Badge Type</th>
              <th>Target Play Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGames.length === 0 ? (
              <tr><td colSpan="5" className="text-center text-muted">No games matching criteria found.</td></tr>
            ) : (
              filteredGames.map((game) => (
                <tr key={game.id}>
                  <td>
                    <div className="admin-game-th-img">
                      {(() => {
                        const img = String(game.image || '');
                        // API returns lean proxy URLs (/api/games/image?id=...) — same as lobby
                        const isRealCover =
                          img.startsWith('data:') ||
                          img.startsWith('game_') ||
                          img.startsWith('http://') ||
                          img.startsWith('https://') ||
                          img.startsWith('/');
                        if (isRealCover) {
                          const src = img.startsWith('game_') ? `/${img}` : img;
                          return <img src={src} alt={game.title || 'cover'} style={{ borderRadius: '6px', width: '40px', height: '40px', objectFit: 'cover' }} />;
                        }
                        return (
                          <div className={`game-placeholder-card ${img === 'placeholder_2' ? 'pc-red' : img === 'placeholder_3' ? 'pc-blue' : 'pc-gold'}`} style={{ fontSize: '1rem', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(game.title || '??').slice(0, 2).toUpperCase()}
                          </div>
                        );
                      })()}
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
                      <button className="action-row-btn btn-delete" onClick={() => handleDelete(game.id)} title="Delete game"><i className="fa-solid fa-trash"></i></button>
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
