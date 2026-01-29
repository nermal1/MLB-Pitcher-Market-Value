import React, { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerHeadshot, TeamLogo, TEAM_LOGOS } from './Shared';
import PercentileBar from './PercentBar';

// --- CONFIGURATION ---
const COLUMN_CATEGORIES = {
  basic: [
    'WAR', 'kWAR', 'kWAR_Diff', 'ERA', 'WHIP', 'IP', 'G', 'GS', 'W', 'L', 'SV', 'HLD',
    'K%', 'BB%', 'K/9', 'BB/9', 'HR/9', 'BABIP', 'LOB%'
  ],
  advanced: [
    'SIERA', 'FIP', 'xFIP', 'Stuff+', 'Location+', 'Pitching+', 'BotStf', 'BotCmd', 'BotOvr',
    'vFA (sc)', 'vSL (sc)', 'vCU (sc)', 'vCH (sc)', 
    'SwStr%', 'CSW%', 'HardHit%', 'Barrel%', 'GB%', 'LD%', 'FB%', 
    'O-Swing%', 'Z-Swing%', 'Contact%', 'Zone%', 
    'WPA', 'RE24', 'gmLI', 'Clutch', 'SD', 'MD'
  ]
};

const DEFAULT_COLS = ['WAR', 'kWAR', 'ERA', 'WHIP', 'K%', 'Stuff+', 'SIERA'];

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
  
  // --- LOCAL STATE FOR COLUMNS ---
  const [visibleCols, setVisibleCols] = useState(DEFAULT_COLS);
  const [showColModal, setShowColModal] = useState(false);

  const teamList = useMemo(() => Object.keys(TEAM_LOGOS).sort(), []);
  
  // --- DATA FILTERING ---
  const filteredPitchers = useMemo(() => {
    let res = [...data];
    if (teamFilter !== 'All') res = res.filter(p => p.Team === teamFilter);
    if (search) res = res.filter(p => p.Name.toLowerCase().includes(search.toLowerCase()));
    
    res.sort((a, b) => {
        const valA = a[sortConfig.key] !== undefined && a[sortConfig.key] !== null ? a[sortConfig.key] : -999;
        const valB = b[sortConfig.key] !== undefined && b[sortConfig.key] !== null ? b[sortConfig.key] : -999;
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });
    return res;
  }, [data, teamFilter, search, sortConfig]);

  const displayPitchers = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredPitchers.slice(start, start + rowsPerPage);
  }, [filteredPitchers, page]);

  // --- HANDLERS ---
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

  // --- COLUMN MODAL HANDLERS ---
  const toggleCol = (col) => setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  const selectAll = (cat) => setVisibleCols(prev => [...new Set([...prev, ...COLUMN_CATEGORIES[cat]])]);
  const deselectAll = (cat) => setVisibleCols(prev => prev.filter(c => !COLUMN_CATEGORIES[cat].includes(c)));

  // --- FORMATTER ---
  const formatCell = (player, col) => {
    let val = player[col];
    if (val === undefined || val === null) return '-';
    
    // Percentages
    if (['K%', 'BB%', 'GB%', 'LD%', 'FB%', 'SwStr%', 'CSW%', 'HardHit%', 'LOB%', 'Barrel%', 'O-Swing%', 'Z-Swing%', 'Contact%', 'Zone%'].includes(col)) {
        return (val * 100).toFixed(1) + '%';
    }
    // Decimals
    if (['ERA', 'SIERA', 'FIP', 'xFIP', 'WHIP', 'K/9', 'BB/9', 'HR/9'].includes(col)) {
        return val.toFixed(2);
    }
    // Integers / Whole Numbers
    if (['Stuff+', 'Location+', 'Pitching+', 'G', 'GS', 'W', 'L', 'SV', 'HLD'].includes(col)) {
        return Math.round(val);
    }
    // Velocity
    if (col.includes('v') && col.includes('(sc)')) {
        return val.toFixed(1);
    }
    return val;
  };

  return (
    <div className="fade-in">
      {/* --- CONTROLS BAR --- */}
      <div className="controls" style={{ padding: '15px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="search-input" type="text" placeholder="Search Player..." value={search} onChange={handleSearchChange} />
        
        <select value={teamFilter} onChange={handleTeamChange}>
          <option value="All">All Teams</option>
          {teamList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* View Toggles */}
        <div className="view-toggle-group" style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
           {viewMode === 'table' && (
             <button className="toggle-btn" onClick={() => setShowColModal(true)} style={{background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer'}}>
               ⚙️ Columns
             </button>
           )}
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
        /* --- TABLE VIEW (RESTORED DYNAMIC COLS) --- */
        <div className="table-container" style={{ margin: '20px' }}>
            <table className="player-table">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 20 }}>Player</th>
                  {visibleCols.map(col => (
                    <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer' }}>
                      {col} {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayPitchers.map((player) => (
                  <tr key={player.MLBID} onClick={() => goToProfile(player)} style={{ cursor: 'pointer' }}>
                    <td className="player-cell" style={{ position: 'sticky', left: 0, background: '#1e293b', zIndex: 10, borderRight: '1px solid #334155' }}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <PlayerHeadshot mlbId={player.MLBID} size="small" />
                            <div><div className="player-name">{player.Name}</div><div className="player-meta">{player.Team}</div></div>
                        </div>
                    </td>
                    {visibleCols.map(col => (
                        <td key={col} className={col === 'kWAR' ? 'fw-bold' : ''} style={{color: col === 'kWAR' ? '#a855f7' : 'inherit'}}>
                            {formatCell(player, col)}
                        </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* --- COLUMN SELECTION MODAL --- */}
      {showColModal && (
        <div className="modal-overlay" onClick={() => setShowColModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>Select Statistics</h2>
                <button onClick={() => setShowColModal(false)} style={{background:'none', border:'none', color:'white', fontSize:'1.5rem', cursor:'pointer'}}>✕</button>
            </div>
            
            <div className="col-sections">
              <div className="col-section" style={{marginBottom:'20px'}}>
                <div className="section-header" style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', borderBottom:'1px solid #334155', paddingBottom:'5px'}}>
                    <h3 style={{margin:0, color:'#93c5fd'}}>Basic Stats</h3>
                    <div className="section-actions" style={{display:'flex', gap:'10px'}}>
                        <button className="tiny-btn" onClick={() => selectAll('basic')}>All</button>
                        <button className="tiny-btn" onClick={() => deselectAll('basic')}>None</button>
                    </div>
                </div>
                <div className="checkbox-grid">
                    {COLUMN_CATEGORIES.basic.map(col => (
                        <label key={col} className="checkbox-label">
                            <input type="checkbox" checked={visibleCols.includes(col)} onChange={() => toggleCol(col)} />
                            {col}
                        </label>
                    ))}
                </div>
              </div>
              
              <div className="col-section">
                <div className="section-header" style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', borderBottom:'1px solid #334155', paddingBottom:'5px'}}>
                    <h3 style={{margin:0, color:'#a855f7'}}>Advanced Metrics</h3>
                    <div className="section-actions" style={{display:'flex', gap:'10px'}}>
                        <button className="tiny-btn" onClick={() => selectAll('advanced')}>All</button>
                        <button className="tiny-btn" onClick={() => deselectAll('advanced')}>None</button>
                    </div>
                </div>
                <div className="checkbox-grid">
                    {COLUMN_CATEGORIES.advanced.map(col => (
                        <label key={col} className="checkbox-label">
                            <input type="checkbox" checked={visibleCols.includes(col)} onChange={() => toggleCol(col)} />
                            {col}
                        </label>
                    ))}
                </div>
              </div>
            </div>
            
            <button className="close-btn" onClick={() => setShowColModal(false)} style={{width:'100%', padding:'15px', marginTop:'20px', background:'#22c55e', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>
                Done
            </button>
          </div>
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