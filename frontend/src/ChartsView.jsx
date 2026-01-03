import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Label, Legend, Cell 
} from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';

// ==========================================
// 1. HELPER: TEAM DATA AGGREGATION
// ==========================================
const aggregateTeamData = (players, metric) => {
  const teams = {};

  players.forEach(p => {
    if (!p.Team) return;
    
    // Initialize team object if missing
    if (!teams[p.Team]) {
      teams[p.Team] = { 
        Team: p.Team, 
        StarterVal: 0, 
        RelieverVal: 0, 
        TotalVal: 0, 
        TotalIP: 0,
        WeightedSum: 0 
      };
    }

    const val = parseFloat(p[metric]) || 0;
    
    // Robust check for Starter position (fixes the "only relievers" bug)
    const pos = p.Position ? p.Position.toLowerCase() : '';
    const isStarter = pos.includes('start') || pos === 'sp';

    // Logic for COUNTING stats (Sum them up: WAR, kWAR, Wins, etc.)
    if (['WAR', 'kWAR', 'W', 'L', 'SV', 'HLD', 'IP'].includes(metric)) {
      if (isStarter) {
          teams[p.Team].StarterVal += val;
      } else {
          teams[p.Team].RelieverVal += val;
      }
      teams[p.Team].TotalVal += val;
    } 
    // Logic for RATE stats (Weighted Average by IP: ERA, K%, Velo)
    else {
      const ip = parseFloat(p.IP) || 0;
      teams[p.Team].TotalIP += ip;
      teams[p.Team].WeightedSum += (val * ip);
    }
  });

  return Object.values(teams).map(t => {
    // Finalize Rate Stats calculation (Weighted Sum / Total IP)
    if (!['WAR', 'kWAR', 'W', 'L', 'SV', 'HLD', 'IP'].includes(metric)) {
      t.TotalVal = t.TotalIP > 0 ? t.WeightedSum / t.TotalIP : 0;
    }
    return t;
  }).sort((a, b) => b.TotalVal - a.TotalVal); // Sort highest to lowest
};


// ==========================================
// 2. SUB-VIEW: INDIVIDUAL SCATTER PLOT
// ==========================================
const ScatterView = ({ data }) => {
  const [xMetric, setXMetric] = useState('Stuff+');
  const [yMetric, setYMetric] = useState('kWAR');
  const [playerCount, setPlayerCount] = useState(50);
  const [archetype, setArchetype] = useState('All');
  
  const metrics = [
    { label: 'kWAR (Value)', value: 'kWAR' },
    { label: 'WAR (Standard)', value: 'WAR' },
    { label: 'Stuff+ (Raw Talent)', value: 'Stuff+' },
    { label: 'Fastball Velo', value: 'vFA (sc)' },
    { label: 'Strikeout %', value: 'K%' },
    { label: 'Walk %', value: 'BB%' },
    { label: 'ERA', value: 'ERA' },
    { label: 'SIERA', value: 'SIERA' },
    { label: 'FIP', value: 'FIP' },
    { label: 'Groundball %', value: 'GB%' },
    { label: 'Whiff %', value: 'SwStr%' }
  ];

  const processedData = useMemo(() => {
    return data
      .filter(p => {
          if (archetype !== 'All' && p.Archetype !== archetype) return false;
          if (p[xMetric] === undefined || p[yMetric] === undefined) return false;
          return true;
      })
      .sort((a, b) => b[yMetric] - a[yMetric])
      .slice(0, playerCount)
      .map(p => ({
        ...p,
        fill: p.kWAR_Diff > 0.2 ? '#4ade80' : (p.kWAR_Diff < -0.2 ? '#f87171' : '#a855f7')
      }));
  }, [data, xMetric, yMetric, playerCount, archetype]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <div className="tooltip-header">
            <p className="label">{p.Name}</p>
            <span className="tooltip-team">{p.Team} • {p.Archetype}</span>
          </div>
          <p className="intro">{xMetric}: <strong>{typeof p[xMetric] === 'number' ? p[xMetric].toFixed(1) : p[xMetric]}</strong></p>
          <p className="intro">{yMetric}: <strong>{typeof p[yMetric] === 'number' ? p[yMetric].toFixed(1) : p[yMetric]}</strong></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-sub-view fade-in">
      <div className="chart-header-row">
        <h2>League Landscape</h2>
        <div className="chart-controls">
           <div className="control-group-mini">
             <label>X-Axis</label>
             <select value={xMetric} onChange={(e) => setXMetric(e.target.value)}>
               {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           <div className="control-group-mini">
             <label>Y-Axis</label>
             <select value={yMetric} onChange={(e) => setYMetric(e.target.value)}>
               {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
           </div>
           <div className="control-group-mini">
             <label>Filter</label>
             <select value={archetype} onChange={(e) => setArchetype(e.target.value)}>
               <option value="All">All Archetypes</option>
               {[...new Set(data.map(p => p.Archetype).filter(Boolean))].map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           <div className="control-group-mini">
             <label>Max Players</label>
             <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                {[25, 50, 75, 100, 200].map(v => <option key={v} value={v}>Top {v}</option>)}
             </select>
           </div>
        </div>
      </div>

      <div className="legend-bar">
          <span className="legend-item"><span className="dot green"></span> Undervalued</span>
          <span className="legend-item"><span className="dot purple"></span> Fair Value</span>
          <span className="legend-item"><span className="dot red"></span> Overvalued</span>
      </div>

      <div className="scatter-wrapper" style={{ height: '600px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis type="number" dataKey={xMetric} name={xMetric} domain={['auto', 'auto']} stroke="#94a3b8">
              <Label value={xMetric} offset={0} position="insideBottom" fill="#94a3b8" />
            </XAxis>
            <YAxis type="number" dataKey={yMetric} name={yMetric} domain={['auto', 'auto']} stroke="#94a3b8">
              <Label value={yMetric} angle={-90} position="insideLeft" fill="#94a3b8" />
            </YAxis>
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Pitchers" data={processedData} fill="#8884d8" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
};


// ==========================================
// 3. SUB-VIEW: TEAM STACKED BAR CHART
// ==========================================
const TeamBarView = ({ data }) => {
  const [metric, setMetric] = useState('kWAR');

  const chartData = useMemo(() => aggregateTeamData(data, metric), [data, metric]);

  const isSummable = ['WAR', 'kWAR', 'W', 'L', 'IP'].includes(metric);

  return (
    <div className="chart-sub-view fade-in">
      <div className="chart-header-row">
        <h2>Team Roster Analysis</h2>
        <div className="chart-controls">
            <div className="control-group-mini">
                <label>Metric</label>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                <option value="kWAR">kWAR (Total Value)</option>
                <option value="WAR">WAR (Standard)</option>
                <option value="ERA">ERA (Weighted Avg)</option>
                <option value="Stuff+">Stuff+ (Weighted Avg)</option>
                <option value="vFA (sc)">Fastball Velo (Avg)</option>
                <option value="K%">Strikeout % (Avg)</option>
                </select>
            </div>
        </div>
      </div>

      <div className="scatter-wrapper" style={{ height: '600px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
            <XAxis dataKey="Team" stroke="#94a3b8" angle={-45} textAnchor="end" interval={0} height={60} />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              cursor={{fill: 'rgba(255,255,255,0.05)'}}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="custom-tooltip">
                      <div className="tooltip-header"><h3>{d.Team}</h3></div>
                      {isSummable ? (
                        <>
                          <p style={{color: '#a855f7'}}>Starters: <strong>{d.StarterVal.toFixed(1)}</strong></p>
                          <p style={{color: '#38bdf8'}}>Relievers: <strong>{d.RelieverVal.toFixed(1)}</strong></p>
                          <hr style={{borderColor: '#334155', margin: '5px 0'}}/>
                          <p>Total: <strong>{d.TotalVal.toFixed(1)}</strong></p>
                        </>
                      ) : (
                        <p>Team Average: <strong>{d.TotalVal.toFixed(1)}</strong></p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            {isSummable && <Legend verticalAlign="top" height={36}/>}
            
            {isSummable ? (
              <>
                <Bar dataKey="StarterVal" name="Starters" stackId="a" fill="#a855f7" />
                <Bar dataKey="RelieverVal" name="Relievers" stackId="a" fill="#38bdf8" />
              </>
            ) : (
              // Fixed Colors (No conditional Green/Red/Purple)
              <Bar dataKey="TotalVal" name="Team Average" fill="#a855f7" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {isSummable && (
        <div className="chart-note">
          * Sorted by Total {metric}. The stacked bars show the contribution of the Rotation (Purple) vs Bullpen (Blue).
        </div>
      )}
    </div>
  )
};


// ==========================================
// 4. MAIN EXPORT: CHARTS VIEW WRAPPER
// ==========================================
export const ChartsView = ({ data }) => {
  const [activeChart, setActiveChart] = useState('scatter');

  return (
    <div className="charts-view-container fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="charts-nav">
        <button className={`chart-tab ${activeChart === 'scatter' ? 'active' : ''}`} onClick={() => setActiveChart('scatter')}>Scatter Plots (Individual)</button>
        <button className={`chart-tab ${activeChart === 'team' ? 'active' : ''}`} onClick={() => setActiveChart('team')}>Team Comparison (Roster Analysis)</button>
      </div>
      
      {/* Container for the specific chart view */}
      <div style={{ flex: 1, minHeight: '600px' }}>
        {activeChart === 'scatter' ? <ScatterView data={data} /> : <TeamBarView data={data} />}
      </div>
    </div>
  );
};


// ==========================================
// 5. EXPORT: SIMILARITY NETWORK (Client-Side Logic)
// ==========================================
export const SimilarityNetwork = ({ allPlayers }) => { 
    const fgRef = useRef();
    
    // State
    const [inputValue, setInputValue] = useState('');
    const [targetPlayer, setTargetPlayer] = useState('');
    const [neighborCount, setNeighborCount] = useState(5);
    const [selectedMetrics, setSelectedMetrics] = useState(['K%', 'BB%', 'vFA (sc)', 'Stuff+']);
    
    const availableMetrics = ['K%', 'BB%', 'vFA (sc)', 'Stuff+', 'SIERA', 'FIP', 'GB%', 'Whiff%', 'ERA'];
    
    const imgCache = useRef({});
    const prevTargetRef = useRef(null);

    // --- 1. CLIENT-SIDE GRAPH CALCULATION ---
    const graphData = useMemo(() => {
        if (!allPlayers.length) return { nodes: [], links: [] };

        // --- CASE A: NO TARGET (LANDSCAPE MODE) ---
        // Show Top 50 Players by WAR if no specific player is selected
        if (!targetPlayer) {
            const topPlayers = [...allPlayers]
                .sort((a, b) => b.WAR - a.WAR) // Sort by WAR
                .slice(0, 50) // Top 50
                .map(p => ({ ...p, id: p.Name, lastName: p.Name.split(' ').pop(), group: p.Archetype || 'Balanced', val: 10 })); // Standard size

            // Create light links between similar players in the top 50
            const landscapeLinks = [];
            // Simple linking logic for landscape (link if archetype matches)
            for (let i = 0; i < topPlayers.length; i++) {
                for (let j = i + 1; j < topPlayers.length; j++) {
                    if (topPlayers[i].Archetype === topPlayers[j].Archetype) {
                        landscapeLinks.push({ source: topPlayers[i].id, target: topPlayers[j].id });
                    }
                }
            }
            return { nodes: topPlayers, links: landscapeLinks };
        }

        // --- CASE B: TARGET MODE (SIMILARITY SEARCH) ---
        const targetNode = allPlayers.find(p => p.Name === targetPlayer);
        if (!targetNode) return { nodes: [], links: [] };

        // 1. Calculate Statistics (Mean & StdDev) for selected metrics
        const stats = {};
        selectedMetrics.forEach(m => {
            const values = allPlayers.map(p => parseFloat(p[m])).filter(v => !isNaN(v));
            if (values.length === 0) { stats[m] = { mean: 0, std: 1 }; return; }
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
            stats[m] = { mean, std: Math.sqrt(variance) || 1 };
        });

        // 2. Calculate Euclidean Distance
        const neighbors = allPlayers
            .filter(p => p.Name !== targetPlayer)
            .map(p => {
                let distanceSq = 0;
                let hasData = true;
                selectedMetrics.forEach(m => {
                    const valA = parseFloat(targetNode[m]);
                    const valB = parseFloat(p[m]);
                    if (isNaN(valA) || isNaN(valB)) { hasData = false; return; }
                    const zA = (valA - stats[m].mean) / stats[m].std;
                    const zB = (valB - stats[m].mean) / stats[m].std;
                    distanceSq += Math.pow(zA - zB, 2);
                });
                if (!hasData) return null;
                const distance = Math.sqrt(distanceSq);
                const similarity = Math.exp(-distance / 2);
                return { ...p, id: p.Name, lastName: p.Name.split(' ').pop(), similarity, group: p.Archetype || 'Balanced', val: 10 };
            })
            .filter(Boolean)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, neighborCount);

        const targetGraphNode = { ...targetNode, id: targetNode.Name, lastName: targetNode.Name.split(' ').pop(), group: targetNode.Archetype, val: 20 };
        
        return {
            nodes: [targetGraphNode, ...neighbors],
            links: neighbors.map(n => ({ source: targetGraphNode.id, target: n.id, similarity: n.similarity }))
        };

    }, [targetPlayer, allPlayers, neighborCount, selectedMetrics]);

    // --- 2. CAMERA & CACHE ---
    useEffect(() => {
        graphData.nodes.forEach(node => {
            if (node.MLBID && !imgCache.current[node.MLBID]) {
                const img = new Image();
                img.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${node.MLBID}/headshot/67/current`;
                imgCache.current[node.MLBID] = img;
            }
        });

        // Only zoom if we have a target. If landscape mode, let it settle.
        if (fgRef.current && targetPlayer && targetPlayer !== prevTargetRef.current) {
            fgRef.current.d3Force('link').distance(50);
            fgRef.current.d3ReheatSimulation();
            setTimeout(() => fgRef.current.zoomToFit(400, 50), 250);
        }
        prevTargetRef.current = targetPlayer;
    }, [graphData, targetPlayer]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!inputValue) { setTargetPlayer(''); return; }
            const match = allPlayers.find(p => p.Name.toLowerCase() === inputValue.toLowerCase());
            if (match) setTargetPlayer(match.Name);
        }, 600);
        return () => clearTimeout(timer);
    }, [inputValue, allPlayers]);

    // --- 3. RENDERING ---
    const paintNode = useCallback((node, ctx, globalScale) => {
        const isTarget = node.id === targetPlayer;
        const size = isTarget ? 16 : (targetPlayer ? 8 : (globalScale > 1.5 ? 6 : 4)); // Resize logic
        
        const colors = {'Power Pitcher': '#ef4444', 'Finesse': '#3b82f6', 'Balanced': '#a855f7'};
        ctx.fillStyle = colors[node.group] || '#94a3b8';
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fill();

        // Draw Image (Only if zoomed in or target)
        const shouldDrawImage = (globalScale > 1.2 || isTarget) && node.MLBID && imgCache.current[node.MLBID];
        if (shouldDrawImage) {
            const img = imgCache.current[node.MLBID];
            if (img.complete) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(node.x, node.y, size - 1, 0, 2 * Math.PI, false);
                ctx.clip();
                const imgSize = size * 2; 
                ctx.drawImage(img, node.x - size, node.y - size, imgSize, imgSize);
                ctx.restore();
            }
        }

        // Draw Label
        if (isTarget || globalScale > 1.5) {
            const fontSize = isTarget ? 14 / globalScale : 10 / globalScale;
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 3 / globalScale;
            const labelY = node.y + size + fontSize + 2;
            ctx.strokeText(node.lastName || node.id, node.x, labelY);
            ctx.fillText(node.lastName || node.id, node.x, labelY);
        }
    }, [targetPlayer]);

    const nodePointerAreaPaint = useCallback((node, color, ctx) => {
        const size = node.id === targetPlayer ? 16 : 8;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
        ctx.fill();
    }, [targetPlayer]);

    const toggleMetric = (m) => setSelectedMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

    // Sub-Component: Similarity Table
    const SimilarityTable = ({ targetNode, neighbors, metrics }) => {
        if (!targetNode) return null;
        const formatVal = (val, metric) => {
            const num = parseFloat(val);
            if (isNaN(num)) return '-';
            if (metric.includes('%')) return (num * 100).toFixed(1) + '%';
            if (metric.includes('v') && metric.includes('(sc)')) return num.toFixed(1);
            if (['ERA', 'SIERA', 'FIP'].includes(metric)) return num.toFixed(2);
            return num.toFixed(0);
        };
    
        return (
            <div className="sim-table-container fade-in">
                <h4>Similarity Breakdown</h4>
                <div className="sim-table-wrapper">
                    <table className="sim-table">
                        <thead>
                            <tr><th>Player</th><th>Sim %</th>{metrics.map(m => <th key={m} className="stat-header">{m}</th>)}</tr>
                        </thead>
                        <tbody>
                            <tr className="target-row">
                                <td className="name-cell"><span className="marker-dot" style={{background: '#a855f7'}}></span>{targetNode.lastName}</td>
                                <td>-</td>{metrics.map(m => <td key={m} className="stat-cell target-stat">{formatVal(targetNode[m], m)}</td>)}
                            </tr>
                            {neighbors.map(node => (
                                <tr key={node.id}>
                                    <td className="name-cell">{node.lastName}</td>
                                    <td className="sim-cell">{(node.similarity * 100).toFixed(0)}%</td>
                                    {metrics.map(m => <td key={m} className="stat-cell">{formatVal(node[m], m)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    };

    return (
      <div className="chart-container fade-in" style={{ marginTop: '20px', display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
        <div className="graph-sidebar" style={{ minWidth: '250px', flex: '0 0 250px' }}>
            <h3>Similarity Engine</h3>
            <div className="control-group">
                <label>Target Player</label>
                <div style={{position: 'relative'}}>
                    <input 
                        list="players" placeholder="Type name..." value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)} className="dark-input"
                    />
                </div>
                <datalist id="players">{allPlayers.map(p => <option key={p.Name} value={p.Name} />)}</datalist>
            </div>
            <div className="control-group">
                <label>Metric Mix:</label>
                <div className="metric-tags">
                    {availableMetrics.map(m => (
                        <button key={m} className={`metric-tag ${selectedMetrics.includes(m) ? 'active' : ''}`} onClick={() => toggleMetric(m)}>{m}</button>
                    ))}
                </div>
            </div>
            {targetPlayer && (
                <>
                    <div className="control-group">
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                            <label>Neighbors</label>
                            <span style={{color:'#a855f7', fontWeight:'bold'}}>{neighborCount}</span>
                        </div>
                        <input type="range" min="1" max="20" value={neighborCount} onChange={(e) => setNeighborCount(parseInt(e.target.value))} style={{width: '100%', cursor: 'pointer'}} />
                    </div>
                     <SimilarityTable 
                        targetNode={graphData.nodes[0]} 
                        neighbors={graphData.nodes.slice(1)} 
                        metrics={selectedMetrics} 
                    />
                </>
            )}
            <button className="reset-btn" onClick={() => {setInputValue(''); setTargetPlayer('');}}>Reset View</button>
        </div>
        <div className="graph-wrapper" style={{ flex: 1, height: '600px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
          {graphData.nodes.length === 0 && (
              <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#64748b'}}>Select a player to generate network</div>
          )}
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={nodePointerAreaPaint}
            warmupTicks={100} cooldownTicks={0}
            nodeLabel="id"
            linkColor={() => 'rgba(71, 85, 105, 0.4)'}
            linkWidth={link => (link.similarity ? link.similarity * 3 : 1)}
            backgroundColor="#0f172a"
            onNodeClick={node => { setInputValue(node.id); setTargetPlayer(node.id); }}
            enableNodeDrag={false} enableZoomInteraction={true}
          />
        </div>
      </div>
    );
};