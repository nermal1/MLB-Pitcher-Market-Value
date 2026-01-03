import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import axios from 'axios'
import './App.css'

// --- COMPONENT IMPORTS ---
import { PitchLab } from './pitchLab';
import { ChartsView, SimilarityNetwork } from './ChartsView';
import { EducationPanel } from './EducationPanel';

// --- CONSTANTS & CONFIGURATION ---

const API_BASE_URL = 'https://pitch-lab-api.onrender.com';

const TEAM_LOGOS = {
  'BAL': 'bal', 'BOS': 'bos', 'NYY': 'nyy', 'TB': 'tb', 'TOR': 'tor',
  'CWS': 'chw', 'CLE': 'cle', 'DET': 'det', 'KC': 'kc', 'MIN': 'min',
  'HOU': 'hou', 'LAA': 'laa', 'OAK': 'oak', 'SEA': 'sea', 'TEX': 'tex',
  'ATL': 'atl', 'MIA': 'mia', 'NYM': 'nym', 'PHI': 'phi', 'WSH': 'wsh',
  'CHC': 'chc', 'CIN': 'cin', 'MIL': 'mil', 'PIT': 'pit', 'STL': 'stl',
  'ARI': 'ari', 'COL': 'col', 'LAD': 'lad', 'SD': 'sd', 'SF': 'sf'
};

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

const DEFAULT_COLS = ['WAR', 'kWAR', 'kWAR_Diff', 'ERA', 'WHIP', 'K%', 'Stuff+', 'SIERA'];

// --- METRIC DEFINITIONS ---
const METRIC_DEFINITIONS = {
  // --- BASIC STATS ---
  'WAR': { 
    name: 'Wins Above Replacement', 
    desc: 'Estimates total value relative to a replacement-level player.',
    calc: '[(FIP_Component - League_Avg) / Inning_Factor] + Role_Adj',
    usage: 'The gold standard for comparing players across different roles and eras. Use it to evaluate overall season value.',
    flaws: 'Ignores "Weak Contact" specialists. Pitchers who induce soft groundouts are often undervalued by FIP-based WAR.',
    deepDive: 'WAR attempts to answer: "If this player got injured, how many wins would the team lose?" Replacement level is defined as a AAAA player readily available.'
  },
  'kWAR': { 
    name: 'Predictive WAR', 
    desc: 'A proprietary metric that fixes WAR\'s blind spots by rewarding weak-contact management and high-leverage relief performance.',
    calc: 'Starter: WAR + [(FIP - SIERA) * IP_Factor]\nReliever: (WAR + Skill_Adj) * Leverage_Multiplier',
    usage: 'The primary ranking metric for this project. It allows for a fair comparison between workhorse Starters and elite "Firemen" Closers.',
    flaws: 'Heavily reliant on SIERA accuracy. Can be volatile for relievers with small sample sizes where gmLI fluctuates wildly.',
    deepDive: 'Standard WAR suffers from two problems: 1) It ignores "clutch" pitching (Leverage), and 2) It assumes pitchers can\'t control contact (FIP). kWAR fixes this. First, we replace FIP with SIERA to credit pitchers who induce weak contact (the "Skill Gap"). Second, for relievers, we apply a Leverage Multiplier based on gmLI. This rewards closers like Emmanuel Clase who pitch fewer innings but in the most critical, game-defining moments.'
  },
  'kWAR_Diff': { 
    name: 'Value Gap', 
    desc: 'The difference between kWAR and standard WAR.',
    calc: 'kWAR - WAR',
    usage: 'Positive values = undervalued pitcher (buy low). Negative values = overperformer due for regression (sell high).',
    flaws: 'Can be misleading for pitchers transitioning roles (starter to reliever) or recovering from injury.',
    deepDive: 'This is your edge-finder. A pitcher with +2.0 kWAR_Diff has elite underlying metrics but poor surface results—often due to bad BABIP luck or terrible defense.'
  },
  'ERA': { 
    name: 'Earned Run Average', 
    desc: 'Average earned runs allowed per 9 innings.',
    calc: '(Earned_Runs * 9) / IP',
    usage: 'Simple, traditional way to measure run prevention. Best used alongside other metrics, not in isolation.',
    flaws: 'Heavily influenced by team defense, park factors, and luck.',
    deepDive: 'ERA was king for decades, but modern analysis shows it\'s too noisy. Fielding-independent metrics (FIP, SIERA) often predict future ERA better than current ERA does.'
  },
  'WHIP': { 
    name: 'Walks + Hits per IP', 
    calc: '(BB + H) / IP',
    desc: 'Measures baserunners allowed per inning.',
    usage: 'Excellent for measuring consistency and limiting traffic. Sub-1.00 WHIP is elite; above 1.40 is concerning.',
    flaws: 'Treats walks and hits equally, even though walks are more in a pitcher\'s control.',
    deepDive: 'WHIP is beloved in fantasy baseball. However, a pitcher who allows lots of weak singles but no walks might have a worse WHIP than someone who strikes everyone out but walks 5 per game.'
  },
  'IP': { name: 'Innings Pitched', desc: 'Total innings thrown.', calc: 'Outs / 3', usage: 'Durability context.', flaws: 'Doesn\'t account for quality.', deepDive: '180+ IP is a workhorse.' },
  'G': { name: 'Games', desc: 'Total appearances.', calc: 'Count of games', usage: 'Workload context.', flaws: 'One pitch counts as a game.', deepDive: 'Relievers appear 70+ times, starters ~33.' },
  'GS': { name: 'Games Started', desc: 'Starts.', calc: 'First pitch thrown', usage: 'Role definition.', flaws: 'Openers complicate this.', deepDive: 'Modern usage blurs starter/reliever lines.' },
  'W': { name: 'Wins', desc: 'Pitcher of record for win.', calc: 'Scorer decision', usage: 'Historical curiosity.', flaws: 'Dependent on offense/bullpen.', deepDive: 'Largely ignored in modern analysis due to noise.' },
  'L': { name: 'Losses', desc: 'Pitcher of record for loss.', calc: 'Scorer decision', usage: 'None.', flaws: 'Context dependent.', deepDive: 'Felix Hernandez won Cy Young with 13-12 record.' },
  'SV': { name: 'Saves', desc: 'Reliever preserves win.', calc: 'Specific lead rules', usage: 'Fantasy value.', flaws: 'Arbitrary rules.', deepDive: 'Overvalues 9th inning usage over leverage.' },
  'HLD': { name: 'Holds', desc: 'Reliever preserves lead.', calc: 'Lead preserved, no save', usage: 'Setup value.', flaws: 'Situation dependent.', deepDive: 'Good for finding setup men.' },
  'K%': { 
    name: 'Strikeout Percentage', 
    desc: 'Percentage of batters faced that struck out.',
    calc: 'K / PA',
    usage: 'Elite: 28%+. Average: 20-22%. The most "sticky" skill—high K% pitchers stay good.',
    flaws: 'Doesn\'t account for situational timing.',
    deepDive: 'K% is the single most predictive pitching stat. Strikeouts can\'t be affected by defense, park, or luck.'
  },
  'BB%': { 
    name: 'Walk Percentage', 
    desc: 'Percentage of batters faced that walked.',
    calc: 'BB / PA',
    usage: 'Elite: <6%. Average: 8-9%. Concerning: >11%. Control is crucial.',
    flaws: 'Includes intentional walks.',
    deepDive: 'Walk rate is highly stable. Unlike hits allowed, walks are 100% in the pitcher\'s control.'
  },
  'K/9': { name: 'Strikeouts per 9', desc: 'Ks per 9 innings.', calc: 'K*9/IP', usage: 'Traditional.', flaws: 'Inflated by walks.', deepDive: 'Use K% instead.' },
  'BB/9': { name: 'Walks per 9', desc: 'Walks per 9 innings.', calc: 'BB*9/IP', usage: 'Traditional.', flaws: 'Use BB% instead.', deepDive: 'Legacy stat.' },
  'HR/9': { name: 'Home Runs per 9', desc: 'HRs allowed per 9.', calc: 'HR*9/IP', usage: 'HR prevention.', flaws: 'Volatile year-to-year.', deepDive: 'HR rates fluctuate wildly based on luck and parks.' },
  'BABIP': { 
    name: 'Batting Avg on Balls in Play', 
    desc: 'Batting average on non-HR, non-K balls in play.',
    calc: '(H - HR) / (AB - K - HR + SF)',
    usage: 'League avg ~.300. High/Low indicates luck.',
    flaws: 'Some pitchers (knuckleballers) sustain low BABIPs.',
    deepDive: 'BABIP is a luck indicator. A .350 BABIP suggests bad luck/defense; .250 suggests good luck.'
  },
  'LOB%': { name: 'Left On Base %', desc: '% of runners stranded.', calc: 'Formula based on H/BB/R', usage: 'Luck indicator.', flaws: 'Regresses to ~72%.', deepDive: 'High LOB% usually isn\'t sustainable.' },

  // --- ADVANCED STATS ---
  'SIERA': { 
    name: 'Skill-Interactive ERA', 
    desc: 'ERA estimator focusing on balls in play and strikeout rates.',
    calc: 'Complex formula (K, BB, GB interaction)',
    usage: 'Best ERA predictor available. Use for dynasty/keeper leagues.',
    flaws: 'Black box formula.',
    deepDive: 'Accounts for the interaction between K, BB, and batted ball types. Predicts future ERA better than current ERA.'
  },
  'FIP': { 
    name: 'Fielding Independent Pitching', 
    desc: 'ERA based only on K, BB, HBP, HR.',
    calc: '((13*HR + 3*BB - 2*K) / IP) + C',
    usage: 'Strip away defense and luck. Elite: <3.00.',
    flaws: 'Ignores batted ball quality.',
    deepDive: 'FIP asks: "What SHOULD this pitcher\'s ERA be based on the outcomes they control?"'
  },
  'xFIP': { name: 'Expected FIP', desc: 'FIP with normalized HR rate.', calc: 'FIP with league avg HR/FB%', usage: 'Better for small samples.', flaws: 'Assumes avg HR/FB is skill-neutral.', deepDive: 'Corrects for HR luck.' },
  'Stuff+': { 
    name: 'Stuff Plus', 
    desc: 'Grades raw pitch quality: velocity, movement, spin.',
    calc: 'Velocity + Movement + Spin vs Avg',
    usage: '100 = Avg. 110+ = Elite. Predictive of K%.',
    flaws: 'Ignores deception/sequencing.',
    deepDive: 'Stuff+ measures physical characteristics. It tells you "raw talent" in a vacuum.'
  },
  'Location+': { name: 'Location Plus', desc: 'Grades command.', calc: 'Pitch location vs intent targets', usage: '100 = Avg. Measures execution.', flaws: 'Can be gamed by nibbling.', deepDive: 'Did you hit your spot? Elite pitchers live on the edges.' },
  'Pitching+': { name: 'Pitching Plus', desc: 'Stuff+ and Location+ combined.', calc: 'Weighted blend', usage: 'Overall process grade.', flaws: 'Weighting balance.', deepDive: 'Answers: "How good is the overall process?"' },
  'BotStf': { name: 'Robot Stuff', desc: '20-80 scale stuff grade.', calc: 'AI Scout Model', usage: 'Scouting scale.', flaws: 'Black box.', deepDive: 'Replicates a scout\'s grade using data.' },
  'BotCmd': { name: 'Robot Command', desc: '20-80 scale command grade.', calc: 'AI Scout Model', usage: 'Scouting scale.', flaws: 'Black box.', deepDive: 'Measures repeatability and precision.' },
  'BotOvr': { name: 'Robot Overall', desc: '20-80 overall grade.', calc: 'AI Scout Model', usage: 'Future value.', flaws: 'Compresses variance.', deepDive: 'The "ceiling" grade.' },
  'vFA (sc)': { name: 'Fastball Velo', desc: 'Avg FB velocity.', calc: 'Mean MPH', usage: 'Velo is sticky.', flaws: 'Ignores movement.', deepDive: 'Every 1mph adds ~0.5% SwStr%.' },
  'vSL (sc)': { name: 'Slider Velo', desc: 'Avg SL velocity.', calc: 'Mean MPH', usage: 'Pair with movement.', flaws: 'Velo alone incomplete.', deepDive: 'Hard sliders vs Sweepers.' },
  'vCU (sc)': { name: 'Curve Velo', desc: 'Avg CU velocity.', calc: 'Mean MPH', usage: 'Pair with depth.', flaws: 'Shape matters more.', deepDive: 'Power curves vs Loopers.' },
  'vCH (sc)': { name: 'Change Velo', desc: 'Avg CH velocity.', calc: 'Mean MPH', usage: 'Gap off FB matters.', flaws: 'Needs FB context.', deepDive: 'Ideal gap is 8-12mph.' },
  'SwStr%': { 
    name: 'Swinging Strike %', 
    desc: 'Percentage of pitches inducing swings and misses.',
    calc: 'Whiffs / Total Pitches',
    usage: 'Elite: 13%+. Direct K% predictor.',
    flaws: 'Doesn\'t distinguish chase vs zone.',
    deepDive: 'The purest "stuff" indicator. A drop usually signals injury.'
  },
  'CSW%': { name: 'Called + Swinging Strike %', desc: 'Total strikes generated.', calc: '(Called + Whiff) / Pitches', usage: 'Elite: 30%+. Strike generation.', flaws: 'Umpire dependent.', deepDive: 'Combines stuff (whiffs) and command (called).' },
  'HardHit%': { name: 'Hard Hit Rate', desc: '% batted balls 95mph+.', calc: 'Hard / BBE', usage: 'Predicts ERA.', flaws: 'Statcast required.', deepDive: 'Quality of contact stat. Hard hits find holes.' },
  'Barrel%': { name: 'Barrel Rate', desc: 'Ideal Velo + Angle.', calc: 'Barrels / BBE', usage: 'Elite <5%.', flaws: 'Small sample noise.', deepDive: 'Barrels = .500 AVG / 1.500 SLG. The worst outcome.' },
  'GB%': { name: 'Ground Ball %', desc: '% grounders.', calc: 'GB / BBE', usage: '50%+ is elite GB.', flaws: 'Ignores exit velo.', deepDive: 'Sinkerballers trade Ks for GBs.' },
  'LD%': { name: 'Line Drive %', desc: '% line drives.', calc: 'LD / BBE', usage: 'Avoid at all cost.', flaws: 'Noisy year-to-year.', deepDive: 'LDs fall for hits ~70% of the time.' },
  'FB%': { name: 'Fly Ball %', desc: '% fly balls.', calc: 'FB / BBE', usage: 'Context dependent.', flaws: 'Ignores popups.', deepDive: 'Risk of HRs, but also popups.' },
  'O-Swing%': { name: 'Chase Rate', desc: 'Swings at balls.', calc: 'O-Swing / O-Pitches', usage: 'Deception indicator.', flaws: 'Can lead to walks.', deepDive: 'Tunneling creates chases.' },
  'Z-Swing%': { name: 'Zone Swing Rate', desc: 'Swings at strikes.', calc: 'Z-Swing / Z-Pitches', usage: 'Aggression.', flaws: 'Context dependent.', deepDive: 'Low Z-Swing suggests freezing hitters.' },
  'Contact%': { name: 'Contact Rate', desc: 'Contact / Swing.', calc: '1 - Whiff/Swing', usage: 'Lower is better.', flaws: 'Weak contact?', deepDive: 'Inverse of whiffs.' },
  'Zone%': { name: 'Zone Rate', desc: 'Pitches in zone.', calc: 'In-Zone / Total', usage: '42-46% optimal.', flaws: 'Effective zone differs.', deepDive: 'Too high = hittable. Too low = walks.' },
  'WPA': { 
    name: 'Win Probability Added', 
    desc: 'Change in win probability caused by pitcher.', 
    calc: 'Sum of ΔWinProb', 
    usage: 'Tells the story of the game.', 
    flaws: 'Context dependent, not predictive.', 
    deepDive: 'Great for "Clutch" narratives, bad for predicting future talent.' 
  },
  'RE24': { name: 'Run Expectancy 24', desc: 'Runs saved vs avg based on base/out state.', calc: 'ΔRunExp', usage: 'Situational value.', flaws: 'Context heavy.', deepDive: 'Awards credit for getting out of jams.' },
  'gmLI': { name: 'Leverage Index', desc: 'Pressure of situations faced.', calc: 'Avg Leverage', usage: 'Reliever usage.', flaws: 'Manager dependent.', deepDive: '1.0 is avg. Closers often 1.8+.' },
  'Clutch': { name: 'Clutch', desc: 'Performance in high lev vs neutral.', calc: 'WPA / LI diff', usage: 'Narrative.', flaws: 'Not a sticky skill.', deepDive: 'Most "clutch" stats are just noise.' },
  'SD': { name: 'Standard Deviation', desc: 'Variance in performance.', calc: 'Statistical StdDev', usage: 'Consistency.', flaws: 'None.', deepDive: 'Measures "Boom or Bust".' },
  'MD': { name: 'Median Deviation', desc: 'Median variance.', calc: 'Median Diff', usage: 'Consistency.', flaws: 'None.', deepDive: 'More robust consistency metric.' }
};

// --- HELPER COMPONENTS (Memoized) ---

const PlayerHeadshot = memo(({ mlbId, size = 'large' }) => {
  const url = mlbId 
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`
    : 'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/generic/headshot/67/current';
  
  return (
    <div className={`headshot-wrapper ${size}`}>
      <img loading="lazy" src={url} alt="Player" className="headshot-img" onError={(e) => {e.target.src = 'https://midfield.mlbstatic.com/v1/people/0/headshot/67/current'}} />
    </div>
  )
});

const TeamLogo = memo(({ team }) => {
  let code = team ? TEAM_LOGOS[team] || team.toLowerCase() : 'mlb';
  // Normalize team codes for logos if necessary
  if (code === 'was') code = 'wsh'; 
  return <img loading="lazy" src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/${code}.png&w=100&h=100`} alt={team} className="team-logo" onError={(e) => e.target.style.display = 'none'} />
});

const PercentileBar = memo(({ label, value, percentile, suffix = '' }) => {
  const hue = (100 - (percentile || 50)) * 2.4
  const color = `hsl(${hue}, 85%, 50%)`
  return (
    <div className="metric-bar-container">
      <div className="metric-header"><small>{label}</small><span>{value}{suffix}</span></div>
      <div className="progress-bg"><div className="progress-fill" style={{ width: `${percentile}%`, backgroundColor: color }}></div></div>
    </div>
  )
});

const PitchArsenal = memo(({ player }) => {
    const [expanded, setExpanded] = useState(false)
    const [hoveredPitch, setHoveredPitch] = useState(null)
    const pitchConfig = [{ code: 'FA', name: 'Fastball', color: '#d946ef' }, { code: 'FC', name: 'Cutter', color: '#9333ea' }, { code: 'CT', name: 'Cutter', color: '#9333ea' }, { code: 'SI', name: 'Sinker', color: '#e879f9' }, { code: 'SL', name: 'Slider', color: '#f59e0b' }, { code: 'CU', name: 'Curve', color: '#06b6d4' }, { code: 'CH', name: 'Change', color: '#10b981' }, { code: 'FS', name: 'Splitter', color: '#3b82f6' }]
    
    const arsenal = useMemo(() => {
        return pitchConfig.map(p => ({ ...p, usage: player[`u${p.code}`] || 0, velo: player[`v${p.code}`] || 0, spin: player[`s${p.code}`] || 0 })).filter(p => p.usage * 100 > 5).sort((a, b) => b.usage - a.usage)
    }, [player]);

    if (arsenal.length === 0) return <div className="no-pitch-data">No Data</div>
    
    return (
      <div className="arsenal-container">
        <div className="arsenal-badges">
          {arsenal.map(p => (
              <div key={p.code} className="pitch-badge-wrapper" onMouseEnter={() => setHoveredPitch(p)} onMouseLeave={() => setHoveredPitch(null)} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
                  <span className="pitch-badge interactable" style={{ border: `1px solid ${p.color}`, color: p.color, backgroundColor: hoveredPitch?.code === p.code ? 'rgba(255,255,255,0.1)' : 'transparent' }}>{p.code === 'CT' ? 'FC' : p.code}</span>
                  {!expanded && hoveredPitch?.code === p.code && <div className="mini-tooltip" style={{ borderColor: p.color }}><strong>{p.velo.toFixed(1)}</strong> <small>mph</small></div>}
              </div>
            ))}
        </div>
        {expanded && (
            <div className="arsenal-dropdown" onClick={e => e.stopPropagation()}>
                <table><thead><tr><th>Pitch</th><th>Use</th><th>Velo</th>{arsenal.some(x => x.spin > 0) && <th>Spin</th>}</tr></thead>
                <tbody>{arsenal.map(p => (<tr key={p.code} style={{color: p.color}}><td>{p.name}</td><td>{(p.usage * 100).toFixed(0)}%</td><td>{p.velo.toFixed(1)}</td>{arsenal.some(x => x.spin > 0) && <td>{p.spin > 0 ? p.spin.toFixed(0) : '-'}</td>}</tr>))}</tbody></table>
            </div>
        )}
      </div>
    )
})

// --- SUB-VIEWS ---

const GlossaryView = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState(null);

  const categories = useMemo(() => [
    { title: 'Basic Metrics', keys: COLUMN_CATEGORIES.basic },
    { title: 'Advanced Sabermetrics', keys: COLUMN_CATEGORIES.advanced }
  ], []);

  const handleGridClick = (key) => {
    setExpandedMetric(key);
    setSidebarOpen(true);
  };

  const toggleAccordion = (key) => {
    setExpandedMetric(prev => prev === key ? null : key);
  };

  return (
    <div className="glossary-container fade-in">
      
      {!isSidebarOpen && (
        <button className="sidebar-trigger" onClick={() => setSidebarOpen(true)} title="Open Metrics Sidebar">
          ☰
        </button>
      )}

      <div className="glossary-header">
        <h2>Statistical Glossary</h2>
        <p>Click any card below (or the menu icon ☰) to open the details sidebar.</p>
      </div>

      {categories.map(cat => (
        <div key={cat.title} className="glossary-section">
          <h3>{cat.title}</h3>
          <div className="glossary-grid">
            {cat.keys.map(key => {
              const def = METRIC_DEFINITIONS[key] || { name: key, desc: 'Metric' };
              return (
                <div key={key} className="glossary-card interactable" onClick={() => handleGridClick(key)}>
                  <div className="card-top">
                    <strong>{key}</strong>
                    {['kWAR', 'Stuff+', 'SIERA'].includes(key) && <span className="key-badge">KEY</span>}
                  </div>
                  <div className="card-name">{def.name}</div>
                  <div className="click-hint">View Details →</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>}

      <div className={`glossary-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Metric Explorer</h3>
          <button className="close-btn-icon" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <div className="sidebar-content">
          {categories.map(cat => (
            <div key={cat.title} style={{ marginBottom: '2rem' }}>
              <h4 style={{ color: '#94a3b8', paddingLeft: '0.5rem', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                {cat.title}
              </h4>
              
              {cat.keys.map(key => {
                const def = METRIC_DEFINITIONS[key] || { name: key, desc: 'No definition available.' };
                const isOpen = expandedMetric === key;

                return (
                  <div key={key} id={`metric-${key}`} className={`metric-accordion-item ${isOpen ? 'active' : ''}`}>
                    <div className="accordion-header" onClick={() => toggleAccordion(key)}>
                      <span>{key} <span style={{fontWeight:'normal', fontSize:'0.85rem', color:'#94a3b8'}}>- {def.name}</span></span>
                      <span className="arrow-icon">▼</span>
                    </div>

                    {isOpen && (
                      <div className="accordion-body">
                        <div>
                          <h4>Definition</h4>
                          <p>{def.desc}</p>
                        </div>
                        
                        {def.calc && (
                          <div>
                            <h4>Calculation / Formula</h4>
                            <div className="sidebar-formula">{def.calc}</div>
                          </div>
                        )}

                        <div className="usage-flaws-section">
                            <div className="uf-block">
                                <div className="tag-badge tag-good">Usage</div>
                                <p className="uf-text">{def.usage}</p>
                            </div>
                            <div className="uf-block">
                                <div className="tag-badge tag-bad">Flaws</div>
                                <p className="uf-text">{def.flaws}</p>
                            </div>
                        </div>

                        {def.deepDive && (
                          <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#1e293b', borderLeft: '3px solid #a855f7', borderRadius: '4px' }}>
                            <h4 style={{ color: '#a855f7', marginBottom: '0.5rem' }}>💡 Analyst Insight</h4>
                            <p>{def.deepDive}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


const PlayerListView = ({ 
  pitchers, viewMode, setViewMode, selectedPlayer, handleCardClick, 
  showAdvanced, setShowAdvanced, similarPlayers, isCompareMode, 
  setIsCompareMode, setCompareTarget, visibleCols, toggleColModal,
  sortConfig, handleSort, page, rowsPerPage, totalPlayers, 
  handleChangePage, handleChangeRowsPerPage 
}) => {
  
  const formatCell = useCallback((player, col) => {
    let val = player[col];
    if (val === undefined || val === null) return '-';
    if (['K%', 'BB%', 'GB%', 'LD%', 'FB%', 'SwStr%', 'CSW%', 'HardHit%', 'LOB%'].includes(col)) return (val * 100).toFixed(1) + '%';
    if (['ERA', 'SIERA', 'FIP', 'xFIP', 'WHIP', 'K/9', 'BB/9', 'HR/9'].includes(col)) return val.toFixed(2);
    if (col.includes('v') && col.includes('(sc)')) return val.toFixed(1);
    if (col === 'kWAR_Diff') return (val > 0 ? '+' : '') + val;
    return val;
  }, []);

  const getSortIcon = (col) => {
    if (sortConfig.key !== col) return <span className="sort-icon opacity-30">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="sort-icon active">↑</span> : <span className="sort-icon active">↓</span>;
  }

  return (
    <div className="fade-in">
      <div className="sub-controls">
        <div className="view-toggle-group">
          <button className={`toggle-option ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grid View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Grid</span>
          </button>
          <button className={`toggle-option ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} aria-label="Table View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            <span>Table</span>
          </button>
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
  // 1. GLOBAL STATE: Holds all ~2000 players fetched ONCE
  const [globalData, setGlobalData] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Navigation & Filters
  const [activeTab, setActiveTab] = useState('players');
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [archetype, setArchetype] = useState('');
  const [archetypeList, setArchetypeList] = useState([]);
  const [teamFilter, setTeamFilter] = useState('All');
  const teamList = useMemo(() => Object.keys(TEAM_LOGOS).sort(), []);
  
  // Pagination & Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'WAR', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Selection & Modal States
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [similarPlayers, setSimilarPlayers] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibleCols, setVisibleCols] = useState(DEFAULT_COLS);
  const [showColModal, setShowColModal] = useState(false);
  
  // Comparison States
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareTarget, setCompareTarget] = useState(null);
  const [compareSearch, setCompareSearch] = useState('');
  const [compareResults, setCompareResults] = useState([]);

  // --- INITIAL DATA FETCH (RUNS ONCE) ---
  useEffect(() => {
    // 1. Fetch Archetypes
    axios.get(`${API_BASE_URL}/archetypes`)
      .then(res => setArchetypeList(res.data))
      .catch(console.error);

    // 2. Fetch ALL Pitchers (High limit to get everyone at start)
    setLoading(true);
    axios.get(`${API_BASE_URL}/pitchers`, { params: { limit: 2500, sort_by: 'WAR', sort_order: 'desc' } })
      .then(response => {
        let rawData = response.data.data;
        // Data Normalization (Fix CWS, ATH, WAS, etc.)
        const normalized = rawData.map(p => {
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
        setGlobalData(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error("API Error:", err);
        setLoading(false);
      });
  }, []); // Empty dependency array = Runs once on mount

  // --- DERIVED STATE (INSTANT FILTERING) ---
  const filteredPitchers = useMemo(() => {
    let data = [...globalData];

    // 1. Team Filter
    if (activeTab === 'players' && teamFilter !== 'All') {
        data = data.filter(p => p.Team === teamFilter);
    }

    // 2. Search
    if (search) {
        data = data.filter(p => p.Name.toLowerCase().includes(search.toLowerCase()));
    }

    // 3. Archetype
    if (archetype && archetype !== 'All Archetypes') {
        data = data.filter(p => p.Archetype === archetype);
    }

    // 4. Sort
    data.sort((a, b) => {
        const valA = a[sortConfig.key] || 0;
        const valB = b[sortConfig.key] || 0;
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });

    return data;
  }, [globalData, activeTab, teamFilter, search, archetype, sortConfig]);

  // --- PAGINATION SLICE ---
  const displayPitchers = useMemo(() => {
    // Only slice data for the 'players' list to keep DOM light
    const start = page * rowsPerPage;
    return filteredPitchers.slice(start, start + rowsPerPage);
  }, [filteredPitchers, page, rowsPerPage]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, archetype, teamFilter]);

  // Comparison Logic (Local Search)
  useEffect(() => {
    if (!isCompareMode || !compareSearch) return;
    const results = globalData.filter(p => p.Name.toLowerCase().includes(compareSearch.toLowerCase())).slice(0, 5);
    setCompareResults(results);
  }, [compareSearch, isCompareMode, globalData]);

  // Handlers
  const handleSort = (key) => { 
      setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' })); 
      setPage(0); 
  };
  
  const toggleCol = (col) => setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  const selectAll = (cat) => setVisibleCols(prev => [...new Set([...prev, ...COLUMN_CATEGORIES[cat]])]);
  const deselectAll = (cat) => setVisibleCols(prev => prev.filter(c => !COLUMN_CATEGORIES[cat].includes(c)));
  
  const handleCardClick = (player) => {
    if (selectedPlayer?.Name === player.Name) { setSelectedPlayer(null); return; }
    setSelectedPlayer(player); setSimilarPlayers([]);
    axios.get(`${API_BASE_URL}/pitchers/${player.Name}/similar`).then(r => setSimilarPlayers(r.data)).catch(console.error);
  };

  return (
    <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header className="main-header">
        <div className="header-top">
          <h1>MLB Pitcher Valuation 2025</h1>
          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => {setActiveTab('players'); setPage(0);}}>Player Cards</button>
            <button className={`nav-tab ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')}>Charts & Trends</button>
            <button className={`nav-tab ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>Similarity Network</button>
            <button className={`nav-tab ${activeTab === 'lab' ? 'active' : ''}`} onClick={() => setActiveTab('lab')}>Pitch Lab 3D</button>
            <button className={`nav-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Info & Glossary</button>
          </div>
        </div>

        {activeTab === 'players' && (
          <div className="controls">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="All">All Teams</option>
              {teamList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

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

      <main className="main-content" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading && activeTab !== 'info' ? (
          <div className="loading-state">Loading Data...</div>
        ) : (
          <>
            {activeTab === 'players' && (
                <PlayerListView 
                    pitchers={displayPitchers} 
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
                    totalPlayers={filteredPitchers.length}
                    handleChangePage={setPage} 
                    handleChangeRowsPerPage={(n) => { setRowsPerPage(n); setPage(0); }}
                />
            )}
            
            {/* ChartsView gets ALL global data (normalized), ignoring team filter */}
            {activeTab === 'charts' && <ChartsView data={globalData} />}        
            {activeTab === 'network' && <SimilarityNetwork allPlayers={globalData} />}

          {activeTab === 'lab' && (
            <div style={{ display: 'flex', height: '100%', width: '100%', background: '#0f172a', borderTop: '1px solid #334155' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <PitchLab 
                player={selectedPlayer} 
                allPlayers={globalData}
                setPlayer={setSelectedPlayer}
                />
              </div>
              <div style={{ width: '300px', borderLeft: '1px solid #334155', flexShrink: 0, background: '#0f172a', zIndex: 50 }}>
                <EducationPanel />
              </div>
            </div>
          )}

            {activeTab === 'info' && <GlossaryView />}
          </>
        )}
      </main>

      {/* --- MODALS --- */}
      
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