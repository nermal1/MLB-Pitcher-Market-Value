import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import './App.css'

// --- COMPONENT IMPORTS ---
import PlayerList from './PlayerList';
import PlayerProfile from './PlayerProfile';
import { PitchLab } from './pitchLab';
import { ChartsView, SimilarityNetwork } from './ChartsView';
import { EducationPanel } from './EducationPanel';
import GlossaryView from './GlossaryView';


const API_BASE_URL = 'https://pitch-lab-api.onrender.com';

const PitchLabWrapper = ({ data }) => {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (location.state && location.state.targetPlayer) {
      setSelectedPlayer(location.state.targetPlayer);
    }
  }, [location]);

  return (
      <div style={{ display: 'flex', minHeight: '600px', width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', margin: '20px' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <PitchLab 
            player={selectedPlayer} 
            allPlayers={data}
            setPlayer={setSelectedPlayer}
          />
        </div>
        <div style={{ width: '300px', borderLeft: '1px solid #334155', flexShrink: 0, background: '#0f172a', zIndex: 50 }}>
          <EducationPanel />
        </div>
      </div>
  );
};

function App() {
  const [globalData, setGlobalData] = useState([]); 
  const [loading, setLoading] = useState(true);

  // --- LIFTED STATE (These keep your filters alive when you navigate away) ---
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'WAR', direction: 'desc' });
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(0);

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/pitchers`, { params: { limit: 2500, sort_by: 'WAR', sort_order: 'desc' } })
      .then(response => {
        let rawData = response.data.data;

        // 1. Data Normalization
        let normalized = rawData.map(p => {
            let team = p.Team;
            // Fix Team Codes
            if (team === 'CHW') team = 'CWS'; 
            if (team === 'ATH') team = 'OAK'; 
            if (team === 'WAS') team = 'WSH';
            if (team === 'TBR') team = 'TB'; 
            if (team === 'KCR') team = 'KC';
            if (team === 'SDP') team = 'SD';
            if (team === 'SFG') team = 'SF';

            // FIX JERSEY NUMBERS: Try to find the number in different common property names
            // If your API uses a specific name like 'jersey_number', add it here
            const number = p.Number || p.JerseyNumber || p.jersey_number || p.uniform_number || '00';

            return { ...p, Team: team, Number: number };
        });

        // 2. Percentile Calculation Helper
        const calculatePercentiles = (data, key, lowerIsBetter = false) => {
          const sorted = [...data].sort((a, b) => {
            const valA = a[key] !== undefined && a[key] !== null ? a[key] : (lowerIsBetter ? 999 : -999);
            const valB = b[key] !== undefined && b[key] !== null ? b[key] : (lowerIsBetter ? 999 : -999);
            return lowerIsBetter ? valB - valA : valA - valB; 
          });

          const rankMap = new Map();
          sorted.forEach((p, index) => {
            rankMap.set(p.MLBID, (index / sorted.length) * 100);
          });

          return rankMap;
        };

        const eraRanks = calculatePercentiles(normalized, 'ERA', true); 
        const kwarRanks = calculatePercentiles(normalized, 'kWAR', false);
        const kPctRanks = calculatePercentiles(normalized, 'K%', false);
        const veloRanks = calculatePercentiles(normalized, 'vFA (sc)', false);
        const stuffRanks = calculatePercentiles(normalized, 'Stuff+', false);

        normalized = normalized.map(p => ({
            ...p,
            ERA_pct: p.ERA_pct || eraRanks.get(p.MLBID),
            kWAR_pct: p.kWAR_pct || kwarRanks.get(p.MLBID),
            'K%_pct': p['K%_pct'] || kPctRanks.get(p.MLBID),
            'vFA (sc)_pct': p['vFA (sc)_pct'] || veloRanks.get(p.MLBID),
            'Stuff+_pct': p['Stuff+_pct'] || stuffRanks.get(p.MLBID)
        }));

        setGlobalData(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error("API Error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <BrowserRouter>
      <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <header className="main-header">
          <div className="header-top">
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <h1>MLB Pitcher Valuation 2025</h1>
            </Link>
            
            <nav className="nav-tabs">
              <NavLink to="/" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`} end>Player Cards</NavLink>
              <NavLink to="/charts" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>Charts & Trends</NavLink>
              <NavLink to="/network" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>Similarity Network</NavLink>
              <NavLink to="/lab" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>Pitch Lab 3D</NavLink>
              <NavLink to="/info" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>Info & Glossary</NavLink>
            </nav>
          </div>
        </header>

        <main className="main-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          {loading ? (
             <div className="loading-state">Loading Data...</div>
          ) : (
            <Routes>
              {/* WE PASS THE STATE AND SETTERS DOWN TO PLAYERLIST */}
              <Route path="/" element={
                <PlayerList 
                  data={globalData} 
                  search={search} setSearch={setSearch}
                  teamFilter={teamFilter} setTeamFilter={setTeamFilter}
                  sortConfig={sortConfig} setSortConfig={setSortConfig}
                  viewMode={viewMode} setViewMode={setViewMode}
                  page={page} setPage={setPage}
                />
              } />
              
              <Route path="/player/:id" element={<PlayerProfileWrapper data={globalData} />} />
              <Route path="/charts" element={<ChartsView data={globalData} />} />
              <Route path="/network" element={<SimilarityNetwork allPlayers={globalData} />} />
              <Route path="/lab" element={<PitchLabWrapper data={globalData} />} />
              <Route path="/info" element={<GlossaryView />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  )
}

const PlayerProfileWrapper = ({ data }) => {
    const navigate = useNavigate();
    const handleOpenLab = (player) => {
        navigate('/lab', { state: { targetPlayer: player } });
    };
    return <PlayerProfile data={data} onOpenLab={handleOpenLab} />;
}

export default App