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

// Placeholder for Glossary (You can paste your Glossary code into a file named GlossaryView.jsx later)
const GlossaryView = () => <div style={{padding:'20px', color:'white'}}><h2>Glossary Moved</h2><p>Please create GlossaryView.jsx and import it.</p></div>;

const API_BASE_URL = 'https://pitch-lab-api.onrender.com';

// Wrapper to handle PitchLab navigation from Profile
// We need this to handle the props passing correctly for the PitchLab
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

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/pitchers`, { params: { limit: 2500, sort_by: 'WAR', sort_order: 'desc' } })
      .then(response => {
        let rawData = response.data.data;

        // 1. Data Normalization
        let normalized = rawData.map(p => {
            let team = p.Team;
            if (team === 'CHW') team = 'CWS'; 
            if (team === 'ATH') team = 'OAK'; 
            if (team === 'WAS') team = 'WSH';
            if (team === 'TBR') team = 'TB'; 
            if (team === 'KCR') team = 'KC';
            if (team === 'SDP') team = 'SD';
            if (team === 'SFG') team = 'SF';
            return { ...p, Team: team };
        });

        // 2. Percentile Calculation Helper
        const calculatePercentiles = (data, key, lowerIsBetter = false) => {
          // Sort safe copy of data
          const sorted = [...data].sort((a, b) => {
            const valA = a[key] !== undefined && a[key] !== null ? a[key] : (lowerIsBetter ? 999 : -999);
            const valB = b[key] !== undefined && b[key] !== null ? b[key] : (lowerIsBetter ? 999 : -999);
            return lowerIsBetter ? valB - valA : valA - valB; 
          });

          const rankMap = new Map();
          sorted.forEach((p, index) => {
            // Rank 0 = 0th percentile, Rank N = 100th percentile
            rankMap.set(p.MLBID, (index / sorted.length) * 100);
          });

          return rankMap;
        };

        // 3. Calculate Ranks for Specific Stats
        const eraRanks = calculatePercentiles(normalized, 'ERA', true); // Lower ERA is better
        const kwarRanks = calculatePercentiles(normalized, 'kWAR', false); // Higher WAR is better
        const kPctRanks = calculatePercentiles(normalized, 'K%', false);
        const veloRanks = calculatePercentiles(normalized, 'vFA (sc)', false);
        const stuffRanks = calculatePercentiles(normalized, 'Stuff+', false);

        // 4. Merge Ranks back into Player Objects
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
        
        {/* --- GLOBAL HEADER --- */}
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

        {/* --- MAIN CONTENT AREA --- */}
        <main className="main-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          {loading ? (
             <div className="loading-state">Loading Data...</div>
          ) : (
            <Routes>
              {/* 1. Home / List View */}
              <Route path="/" element={<PlayerList data={globalData} />} />
              
              {/* 2. Player Profile (The new page) */}
              <Route 
                path="/player/:id" 
                element={<PlayerProfileWrapper data={globalData} />} 
              />
              
              {/* 3. Other Views */}
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

// Wrapper to handle navigation from Profile -> Lab
const PlayerProfileWrapper = ({ data }) => {
    const navigate = useNavigate();
    
    // Note: The actual navigation logic is handled inside PlayerProfile.jsx
    // This wrapper simply passes data down.
    
    // We pass a dummy handler if needed, but the Profile handles the logic itself now via router state.
    const handleOpenLab = (player) => {
        navigate('/lab', { state: { targetPlayer: player } });
    };

    return <PlayerProfile data={data} onOpenLab={handleOpenLab} />;
}

export default App