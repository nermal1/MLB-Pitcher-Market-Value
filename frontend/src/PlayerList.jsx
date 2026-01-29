import React, { useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerHeadshot, TeamLogo, TEAM_LOGOS } from './Shared';
import PercentileBar from './PercentBar';

const PitchArsenal = memo(({ player }) => {
    const pitchConfig = [{ code: 'FA', color: '#d946ef' }, { code: 'FC', color: '#9333ea' }, { code: 'SI', color: '#e879f9' }, { code: 'SL', color: '#f59e0b' }, { code: 'CU', color: '#06b6d4' }, { code: 'CH', color: '#10b981' }, { code: 'FS', color: '#3b82f6' }];
    
    const arsenal = useMemo(() => {
        return pitchConfig.map(p => ({ ...p, usage: player[`u${p.code}`] || 0 })).filter(p => p.usage * 100 > 5).sort((a, b) => b.usage - a.usage);
    }, [player]);

    return (
      <div className="arsenal-container">
        <div className="arsenal-badges">
          {arsenal.map(p => (
              <span key={p.code} className="pitch-badge" style={{ border: `1px solid ${p.color}`, color: p.color }}>{p.code}</span>
            ))}
        </div>
      </div>
    )
});

// ACCEPT ALL STATE AS PROPS NOW
const PlayerList = ({ 
    data, 
    search, setSearch, 
    teamFilter, setTeamFilter, 
    sortConfig, setSortConfig, 
    viewMode, setViewMode, 
    page, setPage 
}) => {
  
  const navigate = useNavigate();
  const rowsPerPage = 50;
  const teamList = useMemo(() => Object.keys(TEAM_LOGOS).sort(), []);
  
  const filteredPitchers = useMemo(() => {
    let res = [...data];
    if (teamFilter !== 'All') res = res.filter(p => p.Team === teamFilter);
    if (search) res = res.filter(p => p.Name.toLowerCase().includes(search.toLowerCase()));
    
    res.sort((a, b) => {
        const valA = a[sortConfig.key] || 0;
        const valB = b[sortConfig.key] || 0;
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });
    return res;
  }, [data, teamFilter, search, sortConfig]);

  const displayPitchers = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredPitchers.slice(start, start + rowsPerPage);
  }, [filteredPitchers, page]);

  // If search or filter changes, reset page to 0
  // (We use useMemo so we don't need a useEffect here that triggers infinite loops)
  // Actually, standard practice is to reset page in the onChange handlers below.

  const handleSort = (key) => {
      setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
      setPage(0);
  };

  const handleTeamChange = (e) => {
      setTeamFilter(e.target.value);
      setPage(0);
  }

  const handleSearchChange = (e) => {
      setSearch(e.target.value);
      setPage(0);
  }

  const goToProfile = (player) => {
      navigate(`/player/${player.MLBID}`);
  };

  return (
    <div className="fade-in">
      {/* --- CONTROLS BAR --- */}
      <div className="controls" style={{ padding: '15px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input className="search-input" type="text" placeholder="Search Player..." value={search} onChange={handleSearchChange} />
        
        <select value={teamFilter} onChange={handleTeamChange}>
          <option value="All">All Teams</option>
          {teamList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={sortConfig.key} onChange={e => handleSort(e.target.value)}>
           <option value="WAR">Sort: WAR</option>
           <option value="kWAR">Sort: kWAR</option>
           <option value="ERA">Sort: ERA</option>
           <option value="Stuff+">Sort: Stuff+</option>
           <option value="vFA (sc)">Sort: Velocity</option>
        </select>

        <div className="view-toggle-group" style={{ marginLeft: 'auto' }}>
           <button className={`toggle-option ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>Grid</button>
           <button className={`toggle-option ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>Table</button>
        </div>
      </div>

      {/* --- GRID VIEW --- */}
      {viewMode === 'grid' ? (
        <div className="grid" style={{ padding: '20px' }}>
          {displayPitchers.map((player) => (
            <div key={player.MLBID} className="card interactable" onClick={() => goToProfile(player)}>
              <div className="card-header">
                  <div className="header-content">
                      <PlayerHeadshot mlbId={player.MLBID} />
                      <div className="header-text">
                          <h3>{player.Name}</h3>
                          <div className="team-row"><TeamLogo team={player.Team} /><span className="team-name">{player.Team}</span></div>
                      </div>
                  </div>
              </div>
              
              <div className="stats">
                  <div className="stat-row"><span>WAR:</span><strong>{player.WAR}</strong></div>
                  <div className='stat-row kwar-row'><span>kWAR:</span><strong style={{color: '#a855f7'}}>{player.kWAR}</strong></div>
                  <PitchArsenal player={player} />
                  <div style={{marginTop: '10px'}}>
                      <PercentileBar label="Stuff+" value={player['Stuff+']?.toFixed(0)} percentile={player['Stuff+_pct']} />
                  </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* --- TABLE VIEW --- */
        <div className="table-container" style={{ padding: '20px' }}>
            <table className="player-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th onClick={() => handleSort('WAR')}>WAR</th>
                  <th onClick={() => handleSort('kWAR')}>kWAR</th>
                  <th onClick={() => handleSort('ERA')}>ERA</th>
                  <th onClick={() => handleSort('WHIP')}>WHIP</th>
                  <th onClick={() => handleSort('Stuff+')}>Stuff+</th>
                </tr>
              </thead>
              <tbody>
                {displayPitchers.map((player) => (
                  <tr key={player.MLBID} onClick={() => goToProfile(player)} style={{ cursor: 'pointer' }}>
                    <td className="player-cell">
                        <PlayerHeadshot mlbId={player.MLBID} size="small" />
                        <div><div className="player-name">{player.Name}</div><div className="player-meta">{player.Team}</div></div>
                    </td>
                    <td>{player.WAR}</td>
                    <td style={{ fontWeight: 'bold', color: '#a855f7' }}>{player.kWAR}</td>
                    <td>{player.ERA?.toFixed(2)}</td>
                    <td>{player.WHIP?.toFixed(2)}</td>
                    <td>{player['Stuff+']?.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* Pagination */}
      <div className="pagination-bar" style={{ padding: '20px', textAlign: 'center' }}>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ margin: '0 15px' }}>Page {page + 1}</span>
          <button onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}

export default PlayerList;