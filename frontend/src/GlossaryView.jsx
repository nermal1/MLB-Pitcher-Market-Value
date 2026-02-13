import React, { useState } from 'react';

// Organized definitions by category for better UI grouping
const METRIC_DEFINITIONS = {
  "Core Value": ['WAR', 'kWAR', 'kWAR_Diff'],
  "Traditional Stats": ['ERA', 'WHIP', 'IP', 'G', 'GS', 'W', 'L', 'SV', 'HLD'],
  "Plate Discipline": ['K%', 'BB%', 'K/9', 'BB/9', 'HR/9', 'BABIP', 'LOB%'],
  "Advanced Analytics": ['SIERA', 'FIP', 'xFIP', 'Stuff+', 'Location+', 'Pitching+', 'BotStf', 'BotCmd', 'BotOvr'],
  "Statcast & Batted Ball": ['vFA (sc)', 'vSL (sc)', 'vCU (sc)', 'vCH (sc)', 'SwStr%', 'CSW%', 'HardHit%', 'Barrel%', 'GB%', 'LD%', 'FB%', 'O-Swing%', 'Z-Swing%', 'Contact%', 'Zone%'],
  "Contextual & Leverage": ['WPA', 'RE24', 'gmLI', 'Clutch', 'SD', 'MD']
};

// The raw data you found
const DATA = {
  'WAR': { name: 'Wins Above Replacement', desc: 'Estimates total value relative to a replacement-level player.', calc: '[(FIP_Component - League_Avg) / Inning_Factor] + Role_Adj', usage: 'The gold standard for comparing players across different roles and eras.', flaws: 'Ignores "Weak Contact" specialists.', deepDive: 'WAR attempts to answer: "If this player got injured, how many wins would the team lose?"' },
  'kWAR': { name: 'Predictive WAR', desc: 'A proprietary metric that fixes WAR\'s blind spots.', calc: 'Starter: WAR + [(FIP - SIERA) * IP_Factor]\nReliever: (WAR + Skill_Adj) * Leverage_Multiplier', usage: 'The primary ranking metric for this project.', flaws: 'Heavily reliant on SIERA accuracy.', deepDive: 'Standard WAR suffers from two problems: It ignores "clutch" and assumes pitchers can\'t control contact.' },
  'kWAR_Diff': { name: 'Value Gap', desc: 'Difference between kWAR and standard WAR.', calc: 'kWAR - WAR', usage: 'Positive values = undervalued pitcher (buy low).', flaws: 'Can be misleading for role transitions.', deepDive: 'This is your edge-finder.' },
  'ERA': { name: 'Earned Run Average', desc: 'Avg earned runs allowed per 9 innings.', calc: '(ER * 9) / IP', usage: 'Traditional run prevention measure.', flaws: 'Influenced by defense and luck.', deepDive: 'Modern analysis shows it is too noisy.' },
  'WHIP': { name: 'Walks + Hits per IP', desc: 'Measures baserunners allowed per inning.', calc: '(BB + H) / IP', usage: 'Measures consistency/traffic.', flaws: 'Treats walks and hits equally.', deepDive: 'Sub-1.00 is elite.' },
  'IP': { name: 'Innings Pitched', desc: 'Total innings thrown.', calc: 'Outs / 3', usage: 'Durability context.', flaws: 'Quality not measured.', deepDive: '180+ is a workhorse.' },
  'G': { name: 'Games', desc: 'Total appearances.', calc: 'Count', usage: 'Workload.', flaws: 'One pitch counts.', deepDive: 'Relievers 70+, Starters ~33.' },
  'GS': { name: 'Games Started', desc: 'Starts.', calc: 'First pitch', usage: 'Role definition.', flaws: 'Openers blur this.', deepDive: 'Modern usage is fluid.' },
  'W': { name: 'Wins', desc: 'Pitcher of record for win.', calc: 'Decision', usage: 'Historical curiosity.', flaws: 'Team dependent.', deepDive: 'Largely ignored now.' },
  'L': { name: 'Losses', desc: 'Pitcher of record for loss.', calc: 'Decision', usage: 'None.', flaws: 'Context dependent.', deepDive: 'Felix Hernandez won Cy with 13-12.' },
  'SV': { name: 'Saves', desc: 'Preserves win.', calc: 'Specific rules', usage: 'Fantasy value.', flaws: 'Arbitrary.', deepDive: 'Overvalues 9th inning.' },
  'HLD': { name: 'Holds', desc: 'Preserves lead.', calc: 'No save', usage: 'Setup value.', flaws: 'Situation dependent.', deepDive: 'Finds elite setup men.' },
  'K%': { name: 'Strikeout %', desc: '% of batters struck out.', calc: 'K / PA', usage: 'The most "sticky" skill.', flaws: 'No situational timing.', deepDive: 'Elite is 28%+.' },
  'BB%': { name: 'Walk %', desc: '% of batters walked.', calc: 'BB / PA', usage: 'Control measure.', flaws: 'Includes IBB.', deepDive: 'Elite is <6%.' },
  'K/9': { name: 'Strikeouts per 9', desc: 'Ks per 9 innings.', calc: 'K*9/IP', usage: 'Traditional.', flaws: 'Inflated by walks.', deepDive: 'Use K% instead.' },
  'BB/9': { name: 'Walks per 9', desc: 'Walks per 9 innings.', calc: 'BB*9/IP', usage: 'Traditional.', flaws: 'Use BB% instead.', deepDive: 'Legacy stat.' },
  'HR/9': { name: 'Home Runs per 9', desc: 'HRs allowed per 9.', calc: 'HR*9/IP', usage: 'HR prevention.', flaws: 'Volatile.', deepDive: 'Fluctuates with luck/parks.' },
  'BABIP': { name: 'BABIP', desc: 'Avg on balls in play.', calc: '(H-HR)/(AB-K-HR+SF)', usage: 'Luck indicator.', flaws: 'Skill-dependent for some.', deepDive: 'League avg is ~.300.' },
  'LOB%': { name: 'Left On Base %', desc: '% runners stranded.', calc: 'Formula', usage: 'Luck indicator.', flaws: 'Regresses to ~72%.', deepDive: 'High LOB% isn\'t sustainable.' },
  'SIERA': { name: 'Skill-Interactive ERA', desc: 'ERA estimator based on BIP/K/BB.', calc: 'Complex Formula', usage: 'Best ERA predictor.', flaws: 'Black box.', deepDive: 'Predicts future ERA better than current.' },
  'FIP': { name: 'FIP', desc: 'ERA based on K/BB/HR.', calc: '((13*HR+3*BB-2*K)/IP)+C', usage: 'Strip away defense.', flaws: 'Ignores BIP quality.', deepDive: 'What should the ERA be?' },
  'xFIP': { name: 'Expected FIP', desc: 'FIP with normalized HR rate.', calc: 'Formula', usage: 'Small samples.', flaws: 'HR/FB% assumptions.', deepDive: 'Corrects for HR luck.' },
  'Stuff+': { name: 'Stuff Plus', desc: 'Raw pitch quality.', calc: 'Velo/Move/Spin', usage: 'Predictive of K%.', flaws: 'Ignores sequencing.', deepDive: '100 is average.' },
  'Location+': { name: 'Location Plus', desc: 'Grades command.', calc: 'Location vs Target', usage: 'Measures execution.', flaws: 'Nibbling noise.', deepDive: 'Did you hit your spot?' },
  'Pitching+': { name: 'Pitching Plus', desc: 'Stuff + Location.', calc: 'Blend', usage: 'Overall process grade.', flaws: 'Weighting balance.', deepDive: 'How good is the process?' },
  'BotStf': { name: 'Robot Stuff', desc: '20-80 scale stuff.', calc: 'AI Model', usage: 'Scouting.', flaws: 'Black box.', deepDive: 'Replicates scout grades.' },
  'BotCmd': { name: 'Robot Command', desc: '20-80 scale command.', calc: 'AI Model', usage: 'Precision.', flaws: 'Black box.', deepDive: 'Measures repeatability.' },
  'BotOvr': { name: 'Robot Overall', desc: '20-80 overall.', calc: 'AI Model', usage: 'Future value.', flaws: 'Compressed variance.', deepDive: 'The "ceiling" grade.' },
  'vFA (sc)': { name: 'Fastball Velo', desc: 'Avg FB velocity.', calc: 'Mean MPH', usage: 'Velo is sticky.', flaws: 'Ignores movement.', deepDive: 'Every 1mph adds ~0.5% SwStr%.' },
  'vSL (sc)': { name: 'Slider Velo', desc: 'Avg SL velocity.', calc: 'Mean MPH', usage: 'Pair with movement.', flaws: 'Velo alone incomplete.', deepDive: 'Hard sliders vs Sweepers.' },
  'vCU (sc)': { name: 'Curve Velo', desc: 'Avg CU velocity.', calc: 'Mean MPH', usage: 'Pair with depth.', flaws: 'Shape matters more.', deepDive: 'Power curves vs Loopers.' },
  'vCH (sc)': { name: 'Change Velo', desc: 'Avg CH velocity.', calc: 'Mean MPH', usage: 'Gap off FB matters.', flaws: 'Needs FB context.', deepDive: 'Ideal gap is 8-12mph.' },
  'SwStr%': { name: 'Swinging Strike %', desc: 'Whiffs per pitch.', calc: 'Whiffs / Pitches', usage: 'Pure stuff indicator.', flaws: 'No chase vs zone split.', deepDive: 'Direct K% predictor.' },
  'CSW%': { name: 'Called + Swinging %', desc: 'Total strikes generated.', calc: '(Called+Whiff)/P', usage: 'Strike generation.', flaws: 'Umpire dependent.', deepDive: 'Combines stuff and command.' },
  'HardHit%': { name: 'Hard Hit Rate', desc: '% balls 95mph+.', calc: 'Hard / BBE', usage: 'Predicts ERA.', flaws: 'Statcast required.', deepDive: 'Hard hits find holes.' },
  'Barrel%': { name: 'Barrel Rate', desc: 'Ideal Velo + Angle.', calc: 'Barrels / BBE', usage: 'Elite is <5%.', flaws: 'Sample noise.', deepDive: 'The worst outcome for a pitcher.' },
  'GB%': { name: 'Ground Ball %', desc: '% grounders.', calc: 'GB / BBE', usage: '50%+ is elite.', flaws: 'Ignores exit velo.', deepDive: 'Sinkerballers trade Ks for GBs.' },
  'LD%': { name: 'Line Drive %', desc: '% line drives.', calc: 'LD / BBE', usage: 'Avoid at all cost.', flaws: 'Noisy.', deepDive: 'LDs fall for hits ~70% of time.' },
  'FB%': { name: 'Fly Ball %', desc: '% fly balls.', calc: 'FB / BBE', usage: 'Context dependent.', flaws: 'Ignores popups.', deepDive: 'Risk of HRs.' },
  'O-Swing%': { name: 'Chase Rate', desc: 'Swings at balls.', calc: 'O-Sw / O-P', usage: 'Deception.', flaws: 'Can lead to walks.', deepDive: 'Tunneling creates chases.' },
  'Z-Swing%': { name: 'Zone Swing Rate', desc: 'Swings at strikes.', calc: 'Z-Sw / Z-P', usage: 'Aggression.', flaws: 'Context dependent.', deepDive: 'Low suggests freezing hitters.' },
  'Contact%': { name: 'Contact Rate', desc: 'Contact / Swing.', calc: '1 - Whiff/Sw', usage: 'Lower is better.', flaws: 'Weak contact?', deepDive: 'Inverse of whiffs.' },
  'Zone%': { name: 'Zone Rate', desc: 'Pitches in zone.', calc: 'In-Zone / Total', usage: '42-46% optimal.', flaws: 'Effective zone differs.', deepDive: 'Too high = hittable.' },
  'WPA': { name: 'Win Prob Added', desc: 'Change in win prob.', calc: 'Sum of ΔW', usage: 'Tells the story.', flaws: 'Not predictive.', deepDive: 'Clutch narrative stat.' },
  'RE24': { name: 'Run Expectancy 24', desc: 'Runs saved vs avg.', calc: 'ΔRunExp', usage: 'Situational value.', flaws: 'Context heavy.', deepDive: 'Awards credit for escapes.' },
  'gmLI': { name: 'Leverage Index', desc: 'Pressure of situations.', calc: 'Avg Leverage', usage: 'Reliever usage.', flaws: 'Manager dependent.', deepDive: '1.0 is average.' },
  'Clutch': { name: 'Clutch', desc: 'High lev performance.', calc: 'WPA / LI diff', usage: 'Narrative.', flaws: 'Not sticky.', deepDive: 'Mostly noise.' },
  'SD': { name: 'Std Deviation', desc: 'Variance.', calc: 'Stat StdDev', usage: 'Consistency.', flaws: 'None.', deepDive: 'Boom or Bust measure.' },
  'MD': { name: 'Median Deviation', desc: 'Median variance.', calc: 'Median Diff', usage: 'Consistency.', flaws: 'None.', deepDive: 'Robust metric.' }
};

const GlossaryView = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '10px', color: '#60a5fa' }}>
            Pitching Stats Glossary
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
            Reference guide for the metrics used in the MLB Market Value Model.
          </p>
        </header>

        {/* Search */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <input
            type="text"
            placeholder="Search stat (e.g. WHIP, SIERA)..."
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '12px 20px',
              borderRadius: '8px',
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: 'white',
              fontSize: '1rem',
              outline: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Content Groups */}
        {Object.entries(METRIC_DEFINITIONS).map(([category, stats]) => {
          // Filter stats in this category based on search
          const filteredStats = stats.filter(s => 
            s.toLowerCase().includes(searchTerm.toLowerCase()) || 
            DATA[s]?.name.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (filteredStats.length === 0) return null;

          return (
            <section key={category} style={{ marginBottom: '50px' }}>
              <h2 style={{ fontSize: '1.5rem', borderBottom: '2px solid #334155', paddingBottom: '10px', marginBottom: '20px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {category}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {filteredStats.map(statKey => {
                  const stat = DATA[statKey];
                  return (
                    <div key={statKey} style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#f8fafc' }}>{stat.name}</h3>
                        <span style={{ fontSize: '0.8rem', backgroundColor: '#334155', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8', fontFamily: 'monospace' }}>{statKey}</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: '#cbd5e1', fontStyle: 'italic', marginBottom: '15px' }}>{stat.desc}</p>
                      
                      <div style={{ fontSize: '0.85rem', borderTop: '1px solid #334155', paddingTop: '15px' }}>
                         <div style={{ marginBottom: '8px' }}>
                            <strong style={{ color: '#4ade80', fontSize: '0.7rem', textTransform: 'uppercase' }}>Formula: </strong>
                            <code style={{ color: '#e2e8f0' }}>{stat.calc}</code>
                         </div>
                         <div style={{ marginBottom: '8px' }}>
                            <strong style={{ color: '#60a5fa', fontSize: '0.7rem', textTransform: 'uppercase' }}>Usage: </strong>
                            <span style={{ color: '#94a3b8' }}>{stat.usage}</span>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default GlossaryView;