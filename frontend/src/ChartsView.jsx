import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

// --- 1. INTERACTIVE SCATTER PLOT ---
export const PerformanceScatter = ({ data }) => {
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

  const archetypes = useMemo(() => ['All', ...new Set(data.map(p => p.Archetype).filter(Boolean))], [data]);

  // PERFORMANCE FIX: Only recalculate data when filters actually change
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
          <p className="intro">{xMetric}: <strong>{typeof p[xMetric] === 'number' ? p[xMetric].toFixed(1) : p[xMetric]}{xMetric.includes('%') ? '%' : ''}</strong></p>
          <p className="intro">{yMetric}: <strong>{typeof p[yMetric] === 'number' ? p[yMetric].toFixed(1) : p[yMetric]}{yMetric.includes('%') ? '%' : ''}</strong></p>
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

      <div className="scatter-wrapper">
        <ResponsiveContainer width="100%" height={600}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis type="number" dataKey={xMetric} name={xMetric} domain={['auto', 'auto']} stroke="#94a3b8">
              <Label value={xMetric} offset={0} position="insideBottom" fill="#94a3b8" />
            </XAxis>
            <YAxis type="number" dataKey={yMetric} name={yMetric} domain={['auto', 'auto']} stroke="#94a3b8">
              <Label value={yMetric} angle={-90} position="insideLeft" fill="#94a3b8" />
            </YAxis>
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            {/* PERFORMANCE FIX: Disable animation for large datasets */}
            <Scatter name="Pitchers" data={processedData} fill="#8884d8" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- 2. SIMILARITY TABLE ---
const SimilarityTable = ({ targetNode, neighbors, metrics, links }) => {
    if (!targetNode) return null;
    const formatVal = (val, metric) => {
        if (val === undefined || val === null || isNaN(val)) return '-';
        if (metric.includes('%')) return (val * 100).toFixed(1) + '%';
        if (metric.includes('v') && metric.includes('(sc)')) return val.toFixed(1);
        if (['ERA', 'SIERA', 'FIP'].includes(metric)) return val.toFixed(2);
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
                            {metrics.map(m => <th key={m} className="stat-header">{m}</th>)}
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

// --- 3. OPTIMIZED NETWORK GRAPH COMPONENT ---
export const SimilarityNetwork = ({ allPlayers }) => { 
    const fgRef = useRef();
    
    // State
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [inputValue, setInputValue] = useState('');
    const [targetPlayer, setTargetPlayer] = useState('');
    const [neighborCount, setNeighborCount] = useState(5); // Capped at 20 in UI
    const [selectedMetrics, setSelectedMetrics] = useState(['K%', 'BB%', 'vFA (sc)', 'Stuff+']);
    const [isLoading, setIsLoading] = useState(false);
    
    // Refs for interaction & logic
    const imgCache = useRef({});
    const prevTargetRef = useRef(null); // Track previous target to prevent jarring zooms
    
    const availableMetrics = ['K%', 'BB%', 'vFA (sc)', 'Stuff+', 'SIERA', 'FIP', 'GB%', 'Whiff%', 'ERA'];

    // Debounce Input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!inputValue) {
                setTargetPlayer('');
                return;
            }
            const match = allPlayers.find(p => p.Name.toLowerCase() === inputValue.toLowerCase());
            if (match) setTargetPlayer(match.Name);
        }, 600);
        return () => clearTimeout(timer);
    }, [inputValue, allPlayers]);

    // Data Fetching
    const fetchGraph = useCallback(() => {
        setIsLoading(true);
        const params = new URLSearchParams();
        selectedMetrics.forEach(m => params.append('metrics', m));
        params.append('neighbors', neighborCount);
        
        if (targetPlayer) params.append('target_player', targetPlayer);
        else params.append('limit', 50);

        axios.get(`https://pitch-lab-api.onrender.com/graph-data?${params.toString()}`)
            .then(res => {
                const data = res.data;
                // Pre-load images
                data.nodes.forEach(node => {
                    if (node.mlbId && !imgCache.current[node.mlbId]) {
                        const img = new Image();
                        img.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${node.mlbId}/headshot/67/current`;
                        imgCache.current[node.mlbId] = img;
                    }
                });
                
                setGraphData(data);
                setIsLoading(false);
                
                // ZOOM LOGIC FIX: Only zoom if the TARGET PLAYER has changed.
                // If we just changed metrics/neighbors, keep the camera steady.
                if (fgRef.current && targetPlayer && targetPlayer !== prevTargetRef.current) {
                    fgRef.current.d3Force('link').distance(40);
                    fgRef.current.d3ReheatSimulation();
                    setTimeout(() => fgRef.current.zoomToFit(400, 50), 200);
                }
                
                // Update ref
                prevTargetRef.current = targetPlayer;
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [targetPlayer, neighborCount, selectedMetrics]);

    useEffect(() => { fetchGraph(); }, [fetchGraph]);

    // --- VISUAL RENDERING (Paint Node) ---
    const paintNode = useCallback((node, ctx, globalScale) => {
        const isTarget = node.id === targetPlayer;
        const size = isTarget ? 16 : (targetPlayer ? 8 : 4); 
        
        // 1. Draw Circle Base (The "Border")
        const colors = {'Power Pitcher': '#ef4444', 'Finesse': '#3b82f6', 'Balanced': '#a855f7'};
        ctx.fillStyle = colors[node.group] || '#94a3b8';
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fill();

        // 2. Draw Circular Image (Optimized)
        // Only draw if zoomed in OR if it's the target player
        const shouldDrawImage = (globalScale > 1.2 || isTarget) && node.mlbId && imgCache.current[node.mlbId];
        
        if (shouldDrawImage) {
            const img = imgCache.current[node.mlbId];
            if (img.complete) {
                ctx.save();
                ctx.beginPath();
                // Create circular clipping path
                ctx.arc(node.x, node.y, size - 1, 0, 2 * Math.PI, false);
                ctx.clip();
                // Draw image
                const imgSize = size * 2; 
                ctx.drawImage(img, node.x - size, node.y - size, imgSize, imgSize);
                ctx.restore();
            }
        }

        // 3. Draw Text Labels
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

    // --- INTERACTION AREA (Fixes Clickability) ---
    const nodePointerAreaPaint = useCallback((node, color, ctx) => {
        const size = node.id === targetPlayer ? 16 : (targetPlayer ? 8 : 4);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false); // Slightly larger hit area
        ctx.fill();
    }, [targetPlayer]);

    const toggleMetric = (m) => setSelectedMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

    return (
      <div className="chart-container fade-in" style={{ marginTop: '20px', display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* SIDEBAR */}
        <div className="graph-sidebar" style={{ minWidth: '250px', flex: '0 0 250px' }}>
            <h3>Similarity Engine</h3>
            
            <div className="control-group">
                <label>Target Player</label>
                <div style={{position: 'relative'}}>
                    <input 
                        list="players" 
                        placeholder="Type name..." 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)} 
                        className="dark-input"
                    />
                    {isLoading && <span className="input-loader">Loading...</span>}
                </div>
                <datalist id="players">{allPlayers.map(p => <option key={p.Name} value={p.Name} />)}</datalist>
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
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                            <label>Neighbors</label>
                            <span style={{color:'#a855f7', fontWeight:'bold'}}>{neighborCount}</span>
                        </div>
                        {/* Fixed range slider style */}
                        <input 
                            type="range" 
                            min="1" 
                            max="20" 
                            value={neighborCount} 
                            onChange={(e) => setNeighborCount(parseInt(e.target.value))} 
                            style={{width: '100%', cursor: 'pointer'}}
                        />
                    </div>
                     <SimilarityTable 
                        targetNode={graphData.nodes.find(n => n.id === targetPlayer)} 
                        neighbors={graphData.nodes.filter(n => n.id !== targetPlayer)} 
                        metrics={selectedMetrics} 
                        links={graphData.links} 
                    />
                </>
            )}
            
            <button className="reset-btn" onClick={() => {setInputValue(''); setTargetPlayer('');}}>Reset View</button>
        </div>

        {/* GRAPH CANVAS */}
        <div className="graph-wrapper" style={{ flex: 1, height: '600px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
          {graphData.nodes.length === 0 && !isLoading && (
              <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#64748b'}}>
                  Select a player to generate network
              </div>
          )}
          
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={nodePointerAreaPaint} // CRITICAL: Ensures clicks work on custom nodes
            
            warmupTicks={100} 
            cooldownTicks={0}
            
            nodeLabel="id"
            linkColor={() => 'rgba(71, 85, 105, 0.4)'}
            linkWidth={link => (link.similarity > 0.8 ? 2 : 1)}
            backgroundColor="#0f172a"
            onNodeClick={node => { setInputValue(node.id); setTargetPlayer(node.id); }}
            
            enableNodeDrag={false}
            enableZoomInteraction={true}
          />
        </div>
      </div>
    );
};