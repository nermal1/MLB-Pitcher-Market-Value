import React, { useState } from 'react';

const METRIC_DEFINITIONS = {
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

const GlossaryView = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMetrics = Object.entries(METRIC_DEFINITIONS).filter(([key, data]) => 
    key.toLowerCase().includes(searchTerm.toLowerCase()) || 
    data.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-6 bg-slate-900 min-h-screen text-white">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Pitching Metrics Glossary
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          A comprehensive guide to the statistics used in the MLB Pitcher Market Value model.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8 relative max-w-md mx-auto">
        <input
          type="text"
          placeholder="Search metrics (e.g., kWAR, SIERA, Velo)..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredMetrics.map(([key, data]) => (
          <div key={key} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-blue-400 font-mono text-sm font-bold uppercase tracking-wider">{key}</span>
                <h3 className="text-xl font-bold text-slate-100">{data.name}</h3>
              </div>
              <div className="bg-slate-700 px-2 py-1 rounded text-[10px] font-mono text-slate-300">
                {data.calc.includes('(') ? 'FORMULA' : 'DATA POINT'}
              </div>
            </div>

            <p className="text-slate-300 mb-4 italic">"{data.desc}"</p>
            
            <div className="space-y-4 text-sm">
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <span className="text-emerald-400 font-bold block mb-1 uppercase text-xs">Calculation:</span>
                <code className="text-slate-200">{data.calc}</code>
              </div>

              <div>
                <span className="text-blue-300 font-bold block mb-1 uppercase text-xs">Usage:</span>
                <p className="text-slate-400 leading-relaxed">{data.usage}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                <div>
                  <span className="text-red-400 font-bold block mb-1 uppercase text-xs">Flaws:</span>
                  <p className="text-slate-500 text-xs">{data.flaws}</p>
                </div>
                <div>
                  <span className="text-purple-400 font-bold block mb-1 uppercase text-xs">The "Why":</span>
                  <p className="text-slate-500 text-xs">{data.deepDive}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {filteredMetrics.length === 0 && (
        <div className="text-center py-20 text-slate-500">
          No metrics found matching "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default GlossaryView;