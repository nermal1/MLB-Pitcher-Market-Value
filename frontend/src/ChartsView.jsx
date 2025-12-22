import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

// --- 1. INTERACTIVE SCATTER PLOT ---
export const PerformanceScatter = ({ data }) => {
  // State for Controls
  const [xMetric, setXMetric] = useState('Stuff+');
  const [yMetric, setYMetric] = useState('kWAR');
  const [playerCount, setPlayerCount] = useState(50);
  const [archetype, setArchetype] = useState('All');
  
  // Available Metrics for Axes
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

  // Unique Archetypes for Filter
  const archetypes = ['All', ...new Set(data.map(p => p.Archetype).filter(Boolean))];

  // Filter & Slice Data
  const processedData = data
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

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <div className="tooltip-header">
            <p className="label">{p.Name}</p>
            <span className="tooltip-team">{p.Team} • {p.Archetype}</span>
          </div>
          <p className="intro">
            {xMetric}: <strong>{typeof p[xMetric] === 'number' ? p[xMetric].toFixed(1) : p[xMetric]}</strong>
            {xMetric.includes('%') ? '%' : ''}
          </p>
          <p className="intro">
            {yMetric}: <strong>{typeof p[yMetric] === 'number' ? p[yMetric].toFixed(1) : p[yMetric]}</strong>
             {yMetric.includes('%') ? '%' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container fade-in">
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
               {archetypes.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
           </div>
           <div className="control-group-mini">
             <label>Max Players</label>
             <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                <option value={25}>Top 25</option>
                <option value={50}>Top 50</option>
                <option value={75}>Top 75</option>
                <option value={100}>Top 100</option>
                <option value={200}>Top 200</option>
             </select>
           </div>
        </div>
      </div>

      <div className="legend-bar">
          <span className="legend-item"><span className="dot green"></span> Undervalued</span>
          <span className="legend-item"><span className="dot purple"></span> Fair Value</span>
          <span className="legend-item"><span className="dot red"></span> Overvalued</span>
      </div>

      <div className="scatter-wrapper">
        <ResponsiveContainer width="100%" height={600}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis type="number" dataKey={xMetric} name={xMetric} domain={['auto', 'auto']} stroke="#94a3b8" tickFormatter={(val) => val.toFixed(0)}>
              <Label value={xMetric} offset={0} position="insideBottom" fill="#94a3b8" />
            </XAxis>
            <YAxis type="number" dataKey={yMetric} name={yMetric} domain={['auto', 'auto']} stroke="#94a3b8">
              <Label value={yMetric} angle={-90} position="insideLeft" fill="#94a3b8" />
            </YAxis>
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Pitchers" data={processedData} fill="#8884d8" animationDuration={500} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- 2. SIMILARITY TABLE (This was missing!) ---
const SimilarityTable = ({ targetNode, neighbors, metrics, links }) => {
    if (!targetNode) return null;

    const formatVal = (val, metric) => {
        if (val === undefined || val === null || isNaN(val)) return '-';
        if (metric.includes('%')) return (val * 100).toFixed(1) + '%';
        if (metric.includes('v') && metric.includes('(sc)')) return val.toFixed(1);
        if (['ERA', 'SIERA', 'FIP', 'xFIP'].includes(metric)) return val.toFixed(2);
        return val.toFixed(0);
    };

    return (
        <div className="sim-table-container fade-in">
            <h4>Similarity Breakdown</h4>
            <div className="sim-table-wrapper">
                <table className="sim-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Sim %</th>
                            {metrics.map(m => <th key={m} className="stat-header">{m.length > 8 ? m.split(' ')[0] : m}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="target-row">
                            <td className="name-cell"><span className="marker-dot" style={{background: '#a855f7'}}></span>{targetNode.lastName}</td>
                            <td>-</td>
                            {metrics.map(m => <td key={m} className="stat-cell target-stat">{formatVal(targetNode[m], m)}</td>)}
                        </tr>
                        {neighbors.map(node => {
                            const link = links.find(l => {
                                const s = l.source.id || l.source;
                                const t = l.target.id || l.target;
                                return (s === node.id && t === targetNode.id) || (s === targetNode.id && t === node.id);
                            });
                            const simScore = link && link.similarity ? (link.similarity * 100).toFixed(0) : '?';
                            
                            return (
                                <tr key={node.id}>
                                    <td className="name-cell">{node.lastName}</td>
                                    <td className="sim-cell">{simScore}%</td>
                                    {metrics.map(m => <td key={m} className="stat-cell">{formatVal(node[m], m)}</td>)}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// --- 3. NETWORK GRAPH COMPONENT ---
export const SimilarityNetwork = ({ allPlayers }) => { 
    const fgRef = useRef();
    
    // Data State
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    
    // Search State
    const [inputValue, setInputValue] = useState('');
    const [targetPlayer, setTargetPlayer] = useState('');
    
    // Settings State
    const [neighborCount, setNeighborCount] = useState(5);
    const [selectedMetrics, setSelectedMetrics] = useState(['K%', 'BB%', 'vFA (sc)', 'Stuff+']);
    
    const availableMetrics = ['K%', 'BB%', 'vFA (sc)', 'Stuff+', 'SIERA', 'FIP', 'GB%', 'Whiff%', 'ERA'];
    const imgCache = useRef({});

    // Debounce/Search Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputValue === '') {
                setTargetPlayer('');
            } else {
                const match = allPlayers.find(p => p.Name.toLowerCase() === inputValue.toLowerCase());
                if (match) {
                    setTargetPlayer(match.Name);
                }
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [inputValue, allPlayers]);

    const handleSelectPlayer = (name) => {
        setInputValue(name);
        setTargetPlayer(name);
    };

    const fetchGraph = useCallback(() => {
        const params = new URLSearchParams();
        selectedMetrics.forEach(m => params.append('metrics', m));
        params.append('neighbors', neighborCount);
        if (targetPlayer) params.append('target_player', targetPlayer);

        axios.get(`http://127.0.0.1:8000/graph-data?${params.toString()}`)
            .then(res => {
                setGraphData(res.data);
                if(fgRef.current) {
                    fgRef.current.d3Force('link').distance(link => link.visualDist || 30);
                    fgRef.current.d3ReheatSimulation();
                    if (targetPlayer) fgRef.current.zoom(3, 1000);
                }
            })
            .catch(console.error);
    }, [targetPlayer, neighborCount, selectedMetrics]);

    useEffect(() => { fetchGraph(); }, [fetchGraph]);

    const linkMap = useMemo(() => {
        const map = {};
        graphData.links.forEach(l => {
            const s = l.source.id || l.source;
            const t = l.target.id || l.target;
            const key = [s, t].sort().join('-');
            map[key] = l;
        });
        return map;
    }, [graphData.links]);

    const paintNode = useCallback((node, ctx, globalScale) => {
        const isTarget = node.id === targetPlayer;
        const size = isTarget ? 20 : (targetPlayer ? 12 : 4); 
        
        const colors = {'Power Pitcher': '#ef4444', 'Finesse': '#3b82f6', 'Balanced': '#a855f7'};
        ctx.fillStyle = colors[node.group] || '#94a3b8';
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fill();

        if ((targetPlayer || globalScale > 2) && node.mlbId && node.mlbId !== 0) {
            const imgUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${node.mlbId}/headshot/67/current`;
            
            if (!imgCache.current[node.mlbId]) {
                const img = new Image();
                img.src = imgUrl;
                img.onload = () => { imgCache.current[node.mlbId] = img; };
            } else {
                const img = imgCache.current[node.mlbId];
                ctx.save();
                ctx.beginPath();
                ctx.arc(node.x, node.y, size - 1, 0, 2 * Math.PI, false);
                ctx.clip();
                ctx.drawImage(img, node.x - size + 1, node.y - size + 1, (size - 1) * 2, (size - 1) * 2);
                ctx.restore();
            }
        }

        if (targetPlayer) {
            const fontSize = 14 / globalScale;
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            ctx.fillStyle = isTarget ? '#a855f7' : '#e2e8f0';
            ctx.fillText(node.lastName, node.x, node.y + size + 2);

            if (!isTarget) {
                const key = [node.id, targetPlayer].sort().join('-');
                const link = linkMap[key];
                
                if (link && link.similarity) {
                    ctx.font = `${fontSize * 0.85}px Sans-Serif`;
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText(`${(link.similarity * 100).toFixed(0)}%`, node.x, node.y + size + 2 + fontSize);
                }
            }
        }
    }, [targetPlayer, linkMap]);

    const toggleMetric = (m) => setSelectedMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

    const targetNode = graphData.nodes.find(n => n.id === targetPlayer);
    const neighbors = graphData.nodes.filter(n => n.id !== targetPlayer);

    return (
      <div className="chart-container fade-in" style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
        <div className="graph-sidebar">
            <h3>Similarity Engine</h3>
            <div className="control-group">
                <label>Target Player</label>
                <input 
                    list="players" 
                    placeholder="Type to search..." 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
                <datalist id="players">
                    {allPlayers.map(p => <option key={p.Name} value={p.Name} />)}
                </datalist>
                <small className="hint">{targetPlayer ? "Nodes positioned by statistical distance" : "Showing full league cluster"}</small>
            </div>

            <div className="control-group">
                <label>Metric Mix:</label>
                <div className="metric-tags">
                    {availableMetrics.map(m => (
                        <button key={m} className={`metric-tag ${selectedMetrics.includes(m) ? 'active' : ''}`} onClick={() => toggleMetric(m)}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {targetPlayer && (
                <>
                    <div className="control-group">
                        <label>Neighbors: {neighborCount}</label>
                        <input type="range" min="1" max="20" value={neighborCount} onChange={(e) => setNeighborCount(parseInt(e.target.value))} />
                    </div>
                    
                    {/* THIS IS THE COMPONENT THAT WAS MISSING IN YOUR FILE */}
                    <SimilarityTable targetNode={targetNode} neighbors={neighbors} metrics={selectedMetrics} links={graphData.links} />
                </>
            )}

            <button className="reset-btn" onClick={() => {setInputValue(''); setTargetPlayer(''); setNeighborCount(5);}}>Reset to Full View</button>
        </div>

        <div className="graph-wrapper" style={{ flex: 1, height: '600px', background: '#0f172a', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155' }}>
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodeLabel="id"
            linkColor={() => '#475569'}
            linkWidth={targetPlayer ? 2 : 1}
            linkDistance={link => link.visualDist || 30}
            d3VelocityDecay={0.3}
            backgroundColor="#0f172a"
            onNodeClick={node => handleSelectPlayer(node.id)}
          />
        </div>
      </div>
    );
};