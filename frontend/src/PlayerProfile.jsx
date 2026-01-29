import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PercentileBar from './PercentBar';

// Helper for Team Logos (Reused)
const TEAM_LOGOS = {
  'BAL': 'bal', 'BOS': 'bos', 'NYY': 'nyy', 'TB': 'tb', 'TOR': 'tor',
  'CWS': 'chw', 'CLE': 'cle', 'DET': 'det', 'KC': 'kc', 'MIN': 'min',
  'HOU': 'hou', 'LAA': 'laa', 'OAK': 'oak', 'SEA': 'sea', 'TEX': 'tex',
  'ATL': 'atl', 'MIA': 'mia', 'NYM': 'nym', 'PHI': 'phi', 'WSH': 'wsh',
  'CHC': 'chc', 'CIN': 'cin', 'MIL': 'mil', 'PIT': 'pit', 'STL': 'stl',
  'ARI': 'ari', 'COL': 'col', 'LAD': 'lad', 'SD': 'sd', 'SF': 'sf'
};

const PlayerProfile = ({ data, onOpenLab }) => {
  const { id } = useParams(); // Gets the ID from URL: /player/12345
  const navigate = useNavigate();

  // Find player in the global data
  const player = useMemo(() => {
    return data.find(p => p.MLBID.toString() === id);
  }, [data, id]);

  if (!player) {
    return (
      <div className="loading-container" style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Player not found</h2>
        <button onClick={() => navigate('/')} className="back-btn">Return Home</button>
      </div>
    );
  }

  // Formatting helper
  const fmt = (val, fixed = 1, suffix = '') => (val !== undefined && val !== null) ? val.toFixed(fixed) + suffix : '-';

  return (
    <div className="profile-page fade-in" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      
      {/* --- HEADER --- */}
      <div className="profile-header" style={{ borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '30px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', marginBottom: '15px' }}>
          ← Back to List
        </button>
        
        <div className="profile-hero" style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', alignItems: 'center' }}>
          <div className="headshot-wrapper" style={{ width: '160px', height: '160px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #fff', background: '#e2e8f0' }}>
             <img 
               src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.MLBID}/headshot/67/current`} 
               alt={player.Name} 
               style={{ width: '100%', height: '100%', objectFit: 'cover' }}
               onError={(e) => {e.target.src = 'https://midfield.mlbstatic.com/v1/people/0/headshot/67/current'}}
             />
          </div>
          
          <div className="hero-info" style={{ flex: 1 }}>
            <h1 style={{ fontSize: '3.5rem', margin: '0', lineHeight: 1 }}>{player.Name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px', fontSize: '1.4rem', color: '#cbd5e1' }}>
              <img src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/${TEAM_LOGOS[player.Team] || 'mlb'}.png&w=50&h=50`} alt={player.Team} style={{height: '40px'}} />
              <span>{player.Team} • #{player.Number || '00'} • {player.Position}</span>
            </div>
            <div className="badges" style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
               <span style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>{player.Archetype}</span>
               <span style={{ background: '#a855f7', color: 'white', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>WAR: {player.WAR}</span>
            </div>
          </div>

          {/* CTA Box */}
          <div className="lab-cta" style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #3b82f6', minWidth: '260px' }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#60a5fa', fontSize: '1rem' }}>Pitch Lab 3D</h3>
            <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#94a3b8' }}>Analyze mechanics & release.</p>
            <button 
              onClick={() => onOpenLab(player)}
              style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
            >
              Open in 3D Lab ➜
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT GRID --- */}
      <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>
        
        {/* 1. SLIDERS CARD */}
        <div className="card" style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ borderBottom: '2px solid #a855f7', paddingBottom: '10px', marginBottom: '20px', marginTop: 0 }}>Metric Profile</h3>
          
          <PercentileBar label="kWAR" value={player.kWAR} percentile={player.kWAR_pct} />
          <PercentileBar label="Fastball Velocity" value={fmt(player['vFA (sc)'])} suffix=" mph" percentile={player['vFA (sc)_pct']} />
          <PercentileBar label="ERA" value={fmt(player.ERA, 2)} percentile={player.ERA_pct} />
          <PercentileBar label="Stuff+" value={fmt(player['Stuff+'], 0)} percentile={player['Stuff+_pct']} />
          <PercentileBar label="Strikeout %" value={fmt(player['K%']*100, 1)} suffix="%" percentile={player['K%_pct']} />
        </div>

        {/* 2. STATS BOXES */}
        <div className="card" style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ borderBottom: '2px solid #a855f7', paddingBottom: '10px', marginBottom: '20px', marginTop: 0 }}>Key Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
             <StatBox label="Innings" value={player.IP} />
             <StatBox label="WHIP" value={fmt(player.WHIP, 2)} />
             <StatBox label="SIERA" value={fmt(player.SIERA, 2)} />
             <StatBox label="FIP" value={fmt(player.FIP, 2)} />
             <StatBox label="BB%" value={fmt(player['BB%']*100, 1) + '%'} />
             <StatBox label="SwStr%" value={fmt(player['SwStr%']*100, 1) + '%'} />
          </div>
        </div>

        {/* 3. ARSENAL TABLE */}
        <div className="card" style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h3 style={{ borderBottom: '2px solid #a855f7', paddingBottom: '10px', marginBottom: '20px', marginTop: 0 }}>Pitch Arsenal</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'left' }}>
                <th style={{ paddingBottom: '10px' }}>Pitch</th>
                <th style={{ paddingBottom: '10px' }}>Usage</th>
                <th style={{ paddingBottom: '10px' }}>Velo</th>
                <th style={{ paddingBottom: '10px' }}>Spin</th>
              </tr>
            </thead>
            <tbody>
              {['FA','SL','CU','CH','SI','FC','FS'].map(type => {
                  const use = player[`u${type}`];
                  if (!use || use < 0.03) return null; // Filter out rare pitches
                  return (
                    <tr key={type} style={{ borderTop: '1px solid #334155' }}>
                      <td style={{ padding: '12px 0', fontWeight: 'bold', color: getPitchColor(type) }}>{type}</td>
                      <td>{fmt(use * 100, 0)}%</td>
                      <td>{fmt(player[`v${type}`], 1)}</td>
                      <td>{fmt(player[`s${type}`], 0)}</td>
                    </tr>
                  )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

// Helper Components for this file
const StatBox = ({ label, value }) => (
  <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{value}</div>
  </div>
);

const getPitchColor = (code) => {
    const map = { 'FA': '#d946ef', 'FC': '#9333ea', 'SI': '#e879f9', 'SL': '#f59e0b', 'CU': '#06b6d4', 'CH': '#10b981', 'FS': '#3b82f6' };
    return map[code] || '#fff';
};

export default PlayerProfile;