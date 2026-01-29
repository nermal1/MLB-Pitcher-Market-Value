import React, { memo } from 'react';

// 1. MUST have "export" here
export const TEAM_LOGOS = {
  'BAL': 'bal', 'BOS': 'bos', 'NYY': 'nyy', 'TB': 'tb', 'TOR': 'tor',
  'CWS': 'chw', 'CLE': 'cle', 'DET': 'det', 'KC': 'kc', 'MIN': 'min',
  'HOU': 'hou', 'LAA': 'laa', 'OAK': 'oak', 'SEA': 'sea', 'TEX': 'tex',
  'ATL': 'atl', 'MIA': 'mia', 'NYM': 'nym', 'PHI': 'phi', 'WSH': 'wsh',
  'CHC': 'chc', 'CIN': 'cin', 'MIL': 'mil', 'PIT': 'pit', 'STL': 'stl',
  'ARI': 'ari', 'COL': 'col', 'LAD': 'lad', 'SD': 'sd', 'SF': 'sf'
};

// 2. MUST have "export" here
export const PlayerHeadshot = memo(({ mlbId, size = 'large' }) => {
  const url = mlbId 
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`
    : 'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/generic/headshot/67/current';
  
  return (
    <div className={`headshot-wrapper ${size}`}>
      <img 
        loading="lazy" 
        src={url} 
        alt="Player" 
        className="headshot-img" 
        onError={(e) => {e.target.src = 'https://midfield.mlbstatic.com/v1/people/0/headshot/67/current'}} 
      />
    </div>
  )
});

// 3. MUST have "export" here
export const TeamLogo = memo(({ team }) => {
  let code = team ? TEAM_LOGOS[team] || team.toLowerCase() : 'mlb';
  if (code === 'was') code = 'wsh'; 
  return (
    <img 
        loading="lazy" 
        src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/${code}.png&w=100&h=100`} 
        alt={team} 
        className="team-logo" 
        onError={(e) => e.target.style.display = 'none'} 
    />
  );
});