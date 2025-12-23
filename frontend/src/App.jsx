import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

// --- COMPONENT IMPORTS ---
import { PitchLab } from './pitchLab';
import { PerformanceScatter, SimilarityNetwork } from './ChartsView';
import { EducationPanel } from './EducationPanel';

// --- CONSTANTS ---
const TEAM_LOGOS = {
  'BAL': 'bal', 'BOS': 'bos', 'NYY': 'nyy', 'TB': 'tb', 'TOR': 'tor',
  'CWS': 'chw', 'CLE': 'cle', 'DET': 'det', 'KC': 'kc', 'MIN': 'min',
  'HOU': 'hou', 'LAA': 'laa', 'OAK': 'oak', 'SEA': 'sea', 'TEX': 'tex',
  'ATL': 'atl', 'MIA': 'mia', 'NYM': 'nym', 'PHI': 'phi', 'WSH': 'wsh',
  'CHC': 'chc', 'CIN': 'cin', 'MIL': 'mil', 'PIT': 'pit', 'STL': 'stl',
  'ARI': 'ari', 'COL': 'col', 'LAD': 'lad', 'SD': 'sd', 'SF': 'sf'
}

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
}

const DEFAULT_COLS = ['WAR', 'kWAR', 'kWAR_Diff', 'ERA', 'WHIP', 'K%', 'Stuff+', 'SIERA']

// --- HELPER COMPONENTS ---

const PlayerHeadshot = ({ mlbId, size = 'large' }) => {
  const url = mlbId 
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`
    : 'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/generic/headshot/67/current';
  
  return (
    <div className={`headshot-wrapper ${size}`}>
      <img src={url} alt="Player" className="headshot-img" onError={(e) => {e.target.src = 'https://midfield.mlbstatic.com/v1/people/0/headshot/67/current'}} />
    </div>
  )
}

const TeamLogo = ({ team }) => {
  let code = team ? TEAM_LOGOS[team] || team.toLowerCase() : 'mlb';
  if (code === 'was') code = 'wsh'; 
  return <img src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/${code}.png&w=100&h=100`} alt={team} className="team-logo" onError={(e) => e.target.style.display = 'none'} />
}

const PercentileBar = ({ label, value, percentile, suffix = '' }) => {
  const hue = (100 - (percentile || 50)) * 2.4
  const color = `hsl(${hue}, 85%, 50%)`
  return (
    <div className="metric-bar-container">
      <div className="metric-header"><small>{label}</small><span>{value}{suffix}</span></div>
      <div className="progress-bg"><div className="progress-fill" style={{ width: `${percentile}%`, backgroundColor: color }}></div></div>
    </div>
  )
}

// --- PLAYER LIST VIEW ---

const PlayerListView = ({ 
  pitchers, viewMode, setViewMode, selectedPlayer, handleCardClick, 
  showAdvanced, setShowAdvanced, similarPlayers, isCompareMode, 
  setIsCompareMode, setCompareTarget,
  visibleCols, toggleColModal,
  sortConfig, handleSort, 
  page, rowsPerPage, totalPlayers, handleChangePage, handleChangeRowsPerPage 
}) => {
  
  const formatCell = (player, col) => {
    let val = player[col];
    if (val === undefined || val === null) return '-';
    if (['K%', 'BB%', 'GB%', 'LD%', 'FB%', 'SwStr%', 'CSW%', 'HardHit%', 'LOB%'].includes(col)) return (val * 100).toFixed(1) + '%';
    if (['ERA', 'SIERA', 'FIP', 'xFIP', 'WHIP', 'K/9', 'BB/9', 'HR/9'].includes(col)) return val.toFixed(2);
    if (col.includes('v') && col.includes('(sc)')) return val.toFixed(1);
    if (col === 'kWAR_Diff') return (val > 0 ? '+' : '') + val;
    return val;
  }

  const getSortIcon = (col) => {
    if (sortConfig.key !== col) return <span className="sort-icon opacity-30">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="sort-icon active">↑</span> : <span className="sort-icon active">↓</span>;
  }

  const PitchArsenal = ({ player }) => {
      const [expanded, setExpanded] = useState(false)
      const [hoveredPitch, setHoveredPitch] = useState(null)
      const pitchConfig = [{ code: 'FA', name: 'Fastball', color: '#d946ef' }, { code: 'FC', name: 'Cutter', color: '#9333ea' }, { code: 'CT', name: 'Cutter', color: '#9333ea' }, { code: 'SI', name: 'Sinker', color: '#e879f9' }, { code: 'SL', name: 'Slider', color: '#f59e0b' }, { code: 'CU', name: 'Curve', color: '#06b6d4' }, { code: 'CH', name: 'Change', color: '#10b981' }, { code: 'FS', name: 'Splitter', color: '#3b82f6' }]
      const arsenal = pitchConfig.map(p => ({ ...p, usage: player[`u${p.code}`] || 0, velo: player[`v${p.code}`] || 0, spin: player[`s${p.code}`] || 0 })).filter(p => p.usage * 100 > 5).sort((a, b) => b.usage - a.usage)
      if (arsenal.length === 0) return <div className="no-pitch-data">No Data</div>
      return (
        <div className="arsenal-container">
          <div className="arsenal-badges">
            {arsenal.map(p => (<div key={p.code} className="pitch-badge-wrapper" onMouseEnter={() => setHoveredPitch(p)} onMouseLeave={() => setHoveredPitch(null)} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}><span className="pitch-badge interactable" style={{ border: `1px solid ${p.color}`, color: p.color, backgroundColor: hoveredPitch?.code === p.code ? 'rgba(255,255,255,0.1)' : 'transparent' }}>{p.code === 'CT' ? 'FC' : p.code}</span>{!expanded && hoveredPitch?.code === p.code && <div className="mini-tooltip" style={{ borderColor: p.color }}><strong>{p.velo.toFixed(1)}</strong> <small>mph</small></div>}</div>))}
          </div>
          {expanded && (<div className="arsenal-dropdown" onClick={e => e.stopPropagation()}><table><thead><tr><th>Pitch</th><th>Use</th><th>Velo</th>{arsenal.some(x => x.spin > 0) && <th>Spin</th>}</tr></thead><tbody>{arsenal.map(p => (<tr key={p.code} style={{color: p.color}}><td>{p.name}</td><td>{(p.usage * 100).toFixed(0)}%</td><td>{p.velo.toFixed(1)}</td>{arsenal.some(x => x.spin > 0) && <td>{p.spin > 0 ? p.spin.toFixed(0) : '-'}</td>}</tr>))}</tbody></table></div>)}
        </div>
      )
  }

  return (
    <div className="fade-in">
      <div className="sub-controls">
        <div className="view-toggle">
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>⊞ Grid</button>
          <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>≡ Table</button>
        </div>
        
        {viewMode === 'table' && <button className="toggle-btn" onClick={toggleColModal}>⚙️ Select Stats</button>}
        
        <button className={`toggle-btn ${showAdvanced ? 'active' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? 'Stats: On' : 'Stats: Off'}</button>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid">
          {pitchers.map((player, index) => (
            <div key={`${player.Name}-${index}`} className={`card ${selectedPlayer?.Name === player.Name ? 'selected' : ''}`} onClick={() => handleCardClick(player)}>
              <div className="card-header"><div className="header-content"><PlayerHeadshot mlbId={player.MLBID} /><div className="header-text"><h3>{player.Name}</h3><div className="team-row"><TeamLogo team={player.Team} /><span className="team-name">{player.Team}</span><span className={`badge ${player.Position === 'Starter' ? 'starter' : 'reliever'}`}>{player.Position}</span></div></div></div></div>
              <div className="stats"><div className="stat-row"><span>Type:</span><strong>{player.Archetype}</strong></div><div className="stat-row"><span>WAR:</span><strong>{player.WAR}</strong></div><PitchArsenal player={player} />{showAdvanced && (<div className='advanced-stat-grid'><PercentileBar label="K%" value={(player['K%']*100).toFixed(1)} percentile={player['K%_pct']} suffix="%" /><PercentileBar label="Stuff+" value={player['Stuff+']?.toFixed(0)} percentile={player['Stuff+_pct']} /><PercentileBar label="SIERA" value={player.SIERA?.toFixed(2)} percentile={player['SIERA_pct']} /></div>)}<div className='stat-row kwar-row'><span>kWAR:</span><div className="kwar-stack"><strong style={{color: '#a855f7', fontSize: '1.4rem', lineHeight: '1', display: 'block', textAlign: 'right'}}>{player.kWAR}</strong>{player.kWAR_Diff !== 0 && <small style={{ fontSize: '0.8rem', color: player.kWAR_Diff > 0 ? '#4ade80' : '#f87171', display: 'block', textAlign: 'right' }}>Diff: {player.kWAR_Diff > 0 ? '+' : ''}{player.kWAR_Diff}</small>}</div></div>{player.SkillGap > 0.5 && <div className="stat-row"><span>Metric:</span><div className="value-badge" style={{ color: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid #a855f7' }}>FIP Outperformer</div></div>}</div>
              
              {selectedPlayer?.Name === player.Name && (
                <div className="similar-section">
                  <button className="compare-btn" onClick={(e) => { e.stopPropagation(); setCompareTarget(null); setIsCompareMode(true); }}>⚔️ Compare</button>
                  <h4>Similar Pitchers:</h4>
                  <ul>{similarPlayers.map(sim => <li key={sim.Name}>{sim.Name} <span className="small-war">({sim.WAR})</span></li>)}</ul>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="table-wrapper">
          <div className="table-container">
            <table className="player-table">
              <thead>
                <tr>
                  <th className="sticky-col">Player</th>
                  {visibleCols.map(col => (
                    <th key={col} onClick={() => handleSort(col)} className="sortable-th">
                      {col} {getSortIcon(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitchers.map((player, index) => (
                  <tr key={`${player.Name}-${index}`} onClick={() => handleCardClick(player)}>
                    <td className="player-cell sticky-col"><PlayerHeadshot mlbId={player.MLBID} size="small" /><div><div className="player-name">{player.Name}</div><div className="player-meta">{player.Team} • {player.Position}</div></div></td>
                    {visibleCols.map(col => (<td key={col} className={`number-cell ${col === 'kWAR_Diff' ? (player[col] > 0 ? 'pos' : 'neg') : ''}`}>{formatCell(player, col)}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="pagination-bar">
            <div className="rows-per-page">
              <span>Rows per page:</span>
              <select value={rowsPerPage} onChange={(e) => handleChangeRowsPerPage(Number(e.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="page-controls">
              <span>{page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalPlayers)} of {totalPlayers}</span>
              <button disabled={page === 0} onClick={() => handleChangePage(page - 1)}>‹</button>
              <button disabled={(page + 1) * rowsPerPage >= totalPlayers} onClick={() => handleChangePage(page + 1)}>›</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- MAIN APP COMPONENT ---

function App() {
  const [pitchers, setPitchers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Navigation
  const [activeTab, setActiveTab] = useState('players') // 'players', 'scatter', 'network', 'lab'
  const [viewMode, setViewMode] = useState('grid')

  // Filters
  const [search, setSearch] = useState('')
  const [archetype, setArchetype] = useState('')
  const [archetypeList, setArchetypeList] = useState([])
  
  // Sorting & Pagination
  const [sortConfig, setSortConfig] = useState({ key: 'WAR', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [totalPlayers, setTotalPlayers] = useState(0)

  // Selection States
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [similarPlayers, setSimilarPlayers] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [visibleCols, setVisibleCols] = useState(DEFAULT_COLS)
  const [showColModal, setShowColModal] = useState(false)
  
  // Comparison States
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [compareTarget, setCompareTarget] = useState(null)
  const [compareSearch, setCompareSearch] = useState('')
  const [compareResults, setCompareResults] = useState([])

  useEffect(() => {
    axios.get('`https://pitch-lab-api.onrender.com/archetypes').then(response => setArchetypeList(response.data)).catch(console.error)
  }, [])

  // MAIN DATA FETCH
  useEffect(() => {
    setLoading(true)
    const params = { 
      sort_by: sortConfig.key,
      sort_order: sortConfig.direction,
      limit: rowsPerPage,
      skip: page * rowsPerPage
    }
    if (search) params.search = search
    if (archetype && archetype !== 'All Archetypes') params.archetype = archetype

    // Fetch all players for Charts/Lab view (no pagination)
    if (activeTab !== 'players') {
        params.limit = 1000; 
        params.skip = 0;
    }

    axios.get('`https://pitch-lab-api.onrender.com/pitchers', { params })
      .then(response => { 
        setPitchers(response.data.data) 
        setTotalPlayers(response.data.total)
        setLoading(false) 
      })
      .catch(console.error)
  }, [search, archetype, sortConfig, page, rowsPerPage, activeTab]) 

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, archetype])

  // Comparison Search
  useEffect(() => {
    if (!isCompareMode || !compareSearch) return
    const delayDebounce = setTimeout(() => {
      axios.get('`https://pitch-lab-api.onrender.com/pitchers', { params: { search: compareSearch, limit: 5 } }).then(res => setCompareResults(res.data))
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [compareSearch, isCompareMode])

  const handleSort = (key) => {
    let direction = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc'
    }
    setSortConfig({ key, direction })
    setPage(0)
  }

  const toggleCol = (col) => setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])
  const selectAll = (category) => setVisibleCols(prev => [...new Set([...prev, ...COLUMN_CATEGORIES[category]])])
  const deselectAll = (category) => setVisibleCols(prev => prev.filter(c => !COLUMN_CATEGORIES[category].includes(c)))

  const handleCardClick = (player) => {
    if (selectedPlayer?.Name === player.Name) { setSelectedPlayer(null); return; }
    setSelectedPlayer(player); setSimilarPlayers([])
    axios.get(`https://pitch-lab-api.onrender.com/pitchers/${player.Name}/similar`).then(r => setSimilarPlayers(r.data))
  }

  return (
    <div className="container">
      <header className="main-header">
        <div className="header-top">
          <h1>⚾ MLB Pitcher Valuation 2025</h1>
          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Player Cards</button>
            <button className={`nav-tab ${activeTab === 'scatter' ? 'active' : ''}`} onClick={() => setActiveTab('scatter')}>Scatter Plots</button>
            <button className={`nav-tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>Similarity Network</button>
            <button className={`nav-tab ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => setActiveTab('lab')}>Pitch Lab 3D</button>
          </div>
        </div>

        {activeTab === 'players' && (
          <div className="controls">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <select value={archetype} onChange={e => setArchetype(e.target.value)}>
              <option value="">All Archetypes</option>
              {archetypeList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {viewMode === 'grid' && (
                <select value={sortConfig.key} onChange={e => handleSort(e.target.value)}>
                <option value="WAR">Sort: WAR</option>
                <option value="kWAR">Sort: kWAR</option>
                <option value="kWAR_Diff">Sort: Value Gap</option>
                <option value="ERA">Sort: ERA</option>
                <option value="WHIP">Sort: WHIP</option>
                <option value="K%">Sort: K%</option>
                <option value="Stuff+">Sort: Stuff+</option>
                <option value="vFA (sc)">Sort: Fastball Velo</option>
                </select>
            )}
          </div>
        )}
      </header>

      <main className="main-content">
        {activeTab === 'players' && (
            <PlayerListView 
                pitchers={pitchers} 
                viewMode={viewMode} 
                setViewMode={setViewMode}
                selectedPlayer={selectedPlayer} 
                handleCardClick={handleCardClick}
                showAdvanced={showAdvanced} 
                setShowAdvanced={setShowAdvanced}
                similarPlayers={similarPlayers} 
                isCompareMode={isCompareMode}
                setIsCompareMode={setIsCompareMode} 
                setCompareTarget={setCompareTarget}
                visibleCols={visibleCols} 
                toggleColModal={() => setShowColModal(true)}
                sortConfig={sortConfig} 
                handleSort={handleSort}
                page={page} 
                rowsPerPage={rowsPerPage} 
                totalPlayers={totalPlayers}
                handleChangePage={setPage} 
                handleChangeRowsPerPage={(n) => { setRowsPerPage(n); setPage(0); }}
            />
        )}
        
        {activeTab === 'scatter' && <PerformanceScatter data={pitchers} />}        
        {activeTab === 'network' && <SimilarityNetwork allPlayers={pitchers} />}

        {activeTab === 'lab' && (
          <div style={{ display: 'flex', height: '700px', gap: '0', background: '#0f172a', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ flex: 1, position: 'relative' }}>
                <PitchLab 
                    player={selectedPlayer} 
                    allPlayers={pitchers}
                    setPlayer={setSelectedPlayer}
                />
            </div>
            
            <div style={{ borderLeft: '1px solid #334155' }}>
                <EducationPanel />
            </div>
          </div>
        )}
      </main>

      {showColModal && (
        <div className="modal-overlay" onClick={() => setShowColModal(false)}>
          <div className="modal-content col-modal" onClick={e => e.stopPropagation()}>
            <h2>Select Statistics</h2>
            <div className="col-sections">
              <div className="col-section">
                <div className="section-header"><h3>Basic Stats</h3><div className="section-actions"><button className="tiny-btn" onClick={() => selectAll('basic')}>All</button><button className="tiny-btn" onClick={() => deselectAll('basic')}>None</button></div></div>
                <div className="checkbox-grid">{COLUMN_CATEGORIES.basic.map(col => (<label key={col} className="checkbox-label"><input type="checkbox" checked={visibleCols.includes(col)} onChange={() => toggleCol(col)} />{col}</label>))}</div>
              </div>
              <div className="col-section">
                <div className="section-header"><h3>Advanced Metrics</h3><div className="section-actions"><button className="tiny-btn" onClick={() => selectAll('advanced')}>All</button><button className="tiny-btn" onClick={() => deselectAll('advanced')}>None</button></div></div>
                <div className="checkbox-grid">{COLUMN_CATEGORIES.advanced.map(col => (<label key={col} className="checkbox-label"><input type="checkbox" checked={visibleCols.includes(col)} onChange={() => toggleCol(col)} />{col}</label>))}</div>
              </div>
            </div>
            <button className="close-btn" onClick={() => setShowColModal(false)}>Done</button>
          </div>
        </div>
      )}

      {isCompareMode && selectedPlayer && (
        <div className="modal-overlay" onClick={() => setIsCompareMode(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Head-to-Head</h2>
            <div className="comparison-table">
                <div className="col"><h3>{selectedPlayer.Name}</h3><PlayerHeadshot mlbId={selectedPlayer.MLBID} /><div className="big-stat">{selectedPlayer.kWAR}</div></div>
                <div className="vs">VS</div>
                <div className="col">{compareTarget ? (<><h3>{compareTarget.Name}</h3><PlayerHeadshot mlbId={compareTarget.MLBID} /><div className="big-stat">{compareTarget.kWAR}</div></>) : <p>Select Opponent...</p>}</div>
            </div>
            {!compareTarget && <div className="compare-search"><input autoFocus type="text" placeholder="Search..." value={compareSearch} onChange={e => setCompareSearch(e.target.value)} /><div className="search-results">{compareResults.map(p => <div key={p.Name} className="search-item" onClick={() => setCompareTarget(p)}>{p.Name}</div>)}</div></div>}
            <button className="close-btn" onClick={() => setIsCompareMode(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App