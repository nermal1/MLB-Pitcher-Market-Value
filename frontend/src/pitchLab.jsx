import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Grid, PerspectiveCamera, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { getBallPosAtTime, getTotalFlightTime, getPitchColor } from './physics';

// --- CONSTANTS ---
const DECISION_POINT_Z = 23.8; 

const PITCH_NAMES = {
    'FF': 'Four-Seam', 'FA': 'Fastball', 'SL': 'Slider', 'ST': 'Sweeper',
    'CH': 'Changeup', 'CU': 'Curve', 'KC': 'Knuckle-Curve', 'SI': 'Sinker',
    'FC': 'Cutter', 'CT': 'Cutter', 'FS': 'Splitter', 'FO': 'Forkball'
};

// --- CAMERA CONFIGURATION ---
const CAMERA_VIEWS = {
    catcher: { pos: [-0.0, 2.0, -4.5], target: [0.0, 3.5, 60.5], static: false }, 
    pitcher: { pos: [-2.5, 6.0, 64.0], target: [0.0, 1.5, 0.0], static: false },
    rhh: { pos: [1.8, 3.0, -4.0], target: [0.0, 3.5, 55.0], static: false },
    lhh: { pos: [-1.8, 3.0, -4.0], target: [0.0, 3.5, 55.0], static: false },
    side: { pos: [25, 6, 30], target: [0, 3, 30], static: false }
};

// --- VISUAL COMPONENTS ---

const DecisionPointWall = () => (
    <group position={[0, 2.5, DECISION_POINT_Z]}>
        <mesh>
            <planeGeometry args={[5, 5]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.03} side={THREE.DoubleSide} />
        </mesh>
        <Line points={[[-2.5, -2.5, 0], [2.5, -2.5, 0], [2.5, 2.5, 0], [-2.5, 2.5, 0], [-2.5, -2.5, 0]]} color="#94a3b8" lineWidth={1} dashed dashSize={0.5} gapSize={0.5} opacity={0.3} transparent />
    </group>
);

const TunnelLabel = ({ metric }) => {
    if (!metric) return null;
    const color = metric.isGood ? '#4ade80' : '#f87171'; 
    const radius = (parseFloat(metric.dist) / 12 / 2) + 0.15; 
    
    return (
        <group position={[metric.pos.x, metric.pos.y, DECISION_POINT_Z]}>
            <Billboard follow={true}>
                <Text fontSize={1.2} color={color} outlineWidth={0.05} outlineColor="#000000" anchorY="bottom" position={[0, radius + 0.2, 0]}>
                    {metric.dist}"
                </Text>
            </Billboard>
            <mesh><ringGeometry args={[radius, radius + 0.05, 64]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} /></mesh>
            <mesh><circleGeometry args={[radius, 64]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.15} /></mesh>
        </group>
    );
};

const PitchHUD = ({ activePitches, isLefty }) => {
    if (!activePitches || activePitches.length === 0) return null;
    const displayPitches = activePitches.slice(0, 2); 

    return (
        <div style={{ position: 'absolute', top: 20, right: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 50 }}>
            {displayPitches.map(p => (
                <div key={p.code} style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(4px)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${getPitchColor(p.code)}`, color: 'white', width: '200px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:'5px'}}>
                        <strong style={{color: getPitchColor(p.code)}}>{PITCH_NAMES[p.code] || p.code}</strong>
                        <span>{p.velo.toFixed(1)} <small>mph</small></span>
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', color:'#cbd5e1'}}>
                        <div>Spin: {p.spin.toFixed(0)}</div>
                        <div>Ext: {p.extension.toFixed(1)}'</div>
                        <div>V: {p.vBreak.toFixed(1)}"</div>
                        <div>H: {Math.abs(p.hBreak*12).toFixed(1)}"</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ModernArm = ({ isLefty, targetRelease }) => {
    const shoulderPos = new THREE.Vector3(isLefty ? -1.0 : 1.0, 5.8, 55.0);
    const handPos = targetRelease ? new THREE.Vector3(...targetRelease) : new THREE.Vector3(isLefty ? -1.5 : 1.5, 4.0, 55.0); 
    const midPoint = new THREE.Vector3().addVectors(shoulderPos, handPos).multiplyScalar(0.5);
    const armObj = useMemo(() => {
        const obj = new THREE.Object3D();
        obj.position.copy(midPoint);
        obj.lookAt(handPos); 
        obj.rotateX(Math.PI / 2); 
        return obj;
    }, [midPoint, handPos]);

    return (
        <group>
            <mesh position={shoulderPos}><sphereGeometry args={[0.15]} /><meshStandardMaterial color="#64748b" opacity={0.8} transparent /></mesh>
            <mesh position={midPoint} quaternion={armObj.quaternion}><cylinderGeometry args={[0.04, 0.09, shoulderPos.distanceTo(handPos)]} /><meshStandardMaterial color="#94a3b8" opacity={0.6} transparent /></mesh>
            <mesh position={handPos}><sphereGeometry args={[0.12]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} /></mesh>
        </group>
    );
};

const Mound = () => (
    <group position={[0, 0, 60.5]}>
        <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[3, 9, 1.5, 32]} /><meshStandardMaterial color="#573e28" /></mesh>
        <mesh position={[0, 0.51, 0]} rotation={[-Math.PI/2, 0, 0]}><planeGeometry args={[2, 0.5]} /><meshStandardMaterial color="white" /></mesh>
    </group>
);

const StrikeZone = () => (
    <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><planeGeometry args={[1.4, 1.4]} /><meshStandardMaterial color="white" /></mesh>
        <Line points={[[-0.7, 1.5, 0], [0.7, 1.5, 0], [0.7, 3.5, 0], [-0.7, 3.5, 0], [-0.7, 1.5, 0]]} color="white" lineWidth={2} />
    </group>
);

const StaticTrail = ({ pitch, target }) => {
    const points = useMemo(() => {
        const pts = [];
        const flightTime = getTotalFlightTime(pitch.velo);
        for(let i=0; i<=50; i++) pts.push(getBallPosAtTime((i/50)*flightTime, pitch, target));
        return pts;
    }, [pitch, target]);

    const splitIndex = points.findIndex(p => p.z < DECISION_POINT_Z);
    return (
        <group>
            <Line points={points.slice(0, splitIndex + 1)} color="#94a3b8" lineWidth={2} opacity={0.4} transparent />
            <Line points={points.slice(splitIndex)} color={getPitchColor(pitch.code)} lineWidth={4} opacity={0.8} transparent />
        </group>
    );
};

const AnimatedBall = ({ pitch, isPlaying, timeOffset, target }) => {
    const meshRef = useRef();
    const flightTime = useMemo(() => getTotalFlightTime(pitch.velo), [pitch.velo]);
    useFrame(() => {
        if (!meshRef.current) return;
        if (timeOffset <= flightTime && timeOffset >= 0) {
            meshRef.current.position.copy(getBallPosAtTime(timeOffset, pitch, target));
            meshRef.current.visible = true;
        } else {
            meshRef.current.visible = false;
        }
    });
    return <mesh ref={meshRef} visible={false}><sphereGeometry args={[0.12]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.6} /></mesh>;
};

const CameraRig = ({ view }) => {
    const { camera, controls } = useThree();
    const controlsRef = useRef();

    useEffect(() => {
        const config = CAMERA_VIEWS[view];
        if (config && controlsRef.current) {
            camera.position.set(...config.pos);
            controlsRef.current.target.set(...config.target);
            controlsRef.current.enabled = true; 
            controlsRef.current.update();
        }
    }, [view, camera]);

    return <OrbitControls ref={controlsRef} enablePan={true} zoomSpeed={0.5} rotateSpeed={0.5} />;
};

const InteractiveZone = ({ onSelectTarget, editingPitch }) => {
    return (
        <mesh 
            visible={false} position={[0, 2.5, 0]}
            onClick={(e) => { e.stopPropagation(); if (onSelectTarget) onSelectTarget(e.point); }}
        >
            <planeGeometry args={[4, 4]} /><meshBasicMaterial color="red" />
        </mesh>
    );
};

// --- MAIN COMPONENT ---
export const PitchLab = ({ player, allPlayers, setPlayer }) => {
    const [search, setSearch] = useState('');
    const [view, setView] = useState('catcher');
    const [activeTypes, setActiveTypes] = useState([]); 
    const [isPlaying, setIsPlaying] = useState(false);
    const [animTime, setAnimTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [showDecisionPoint, setShowDecisionPoint] = useState(true);
    const [pitchTargets, setPitchTargets] = useState({}); 
    const [editingPitch, setEditingPitch] = useState(null); 

    const { arsenal, isLefty } = useMemo(() => {
        if(!player) return { arsenal: [], isLefty: false };
        const pitchTypes = [{ code: 'FF', prefix: 'ff' }, { code: 'SL', prefix: 'sl' }, { code: 'CH', prefix: 'ch' }, { code: 'CU', prefix: 'cu' }, { code: 'SI', prefix: 'si' }, { code: 'FC', prefix: 'fc' }, { code: 'FS', prefix: 'fs' }];
        
        let detectedLefty = parseFloat(player['ff_release_x']) > 0 || parseFloat(player['ff_avg_break_x']) > 2.0;
        
        const processed = pitchTypes.map(p => {
            const velo = parseFloat(player[`${p.prefix}_avg_speed`]);
            if (!velo) return null;
            let extension = parseFloat(player[`${p.prefix}_extension`] || 6.0);
            let relX = parseFloat(player[`${p.prefix}_release_x`]) * -1 || (detectedLefty ? -2 : 2);
            let relZ = parseFloat(player[`${p.prefix}_release_z`]) || 6.0;
            
            return {
                code: p.code, velo: velo,
                hBreak: (parseFloat(player[`${p.prefix}_avg_break_x`] || 0) / 12) * -1, 
                vBreak: (parseFloat(player[`${p.prefix}_avg_break_z`] || 0) / 12), 
                spin: parseFloat(player[`${p.prefix}_avg_spin`] || 0),
                extension: extension,
                release: [relX, relZ, 60.5 - extension]
            };
        }).filter(Boolean);
        return { arsenal: processed, isLefty: detectedLefty };
    }, [player]);

    // Initial Filter Setup
    useEffect(() => { 
        if(arsenal.length > 0) {
            setActiveTypes(arsenal.map(p => p.code));
            setPitchTargets({}); 
            setEditingPitch(null);
        }
    }, [arsenal]);

    // Animation Loop
    useEffect(() => {
        if (!isPlaying) return;
        let lastTime = performance.now();
        let accTime = 0;
        const loop = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            accTime += dt * playbackSpeed;
            setAnimTime(accTime);
            if (accTime < 0.6) requestAnimationFrame(loop);
            else { setIsPlaying(false); setAnimTime(0); }
        };
        requestAnimationFrame(loop);
    }, [isPlaying, playbackSpeed]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        const match = allPlayers.find(p => p.Name.toLowerCase() === e.target.value.toLowerCase());
        if (match) setPlayer(match);
    };

    const toggleType = (code) => setActiveTypes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    const handleTargetUpdate = (point) => {
        if (!editingPitch) return;
        setPitchTargets(prev => ({ ...prev, [editingPitch]: { x: point.x, y: point.y, z: 0 } }));
        setEditingPitch(null);
    };

    const activePitchData = arsenal.filter(p => activeTypes.includes(p.code));
    const tunnelMetric = useMemo(() => {
        if (activePitchData.length < 2) return null;
        const p1 = activePitchData[0], p2 = activePitchData[1];
        const t1 = pitchTargets[p1.code] || { x: 0, y: 2.5, z: 0 };
        const t2 = pitchTargets[p2.code] || { x: 0, y: 2.5, z: 0 };
        
        const getTunnelPos = (p, t) => getBallPosAtTime(getTotalFlightTime(p.velo) * ((p.release[2] - DECISION_POINT_Z) / p.release[2]), p, t);
        const pos1 = getTunnelPos(p1, t1);
        const pos2 = getTunnelPos(p2, t2);
        
        return { dist: (pos1.distanceTo(pos2) * 12).toFixed(1), isGood: pos1.distanceTo(pos2) * 12 < 6.0, pos: pos1.lerp(pos2, 0.5) };
    }, [activePitchData, pitchTargets]);

    return (
        <div className="pitch-lab-container fade-in" style={{ height: '100%', width: '100%', background: '#0f172a', position: 'relative', overflow: 'hidden', display: 'flex' }}>
            
            {/* --- LEFT SIDEBAR: COMPACT (220px) --- */}
            <div style={{ width: '220px', background: 'rgba(15, 23, 42, 0.95)', borderRight: '1px solid #334155', padding: '15px', zIndex: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <h2 style={{margin: '0 0 10px 0', fontSize: '1.2rem', color: 'white', whiteSpace: 'nowrap'}}>Pitch Lab <span style={{color: '#a855f7'}}>3D</span></h2>
                
                {/* Search */}
                <div style={{marginBottom: '15px'}}>
                    <input type="text" list="lab-players" placeholder="Search Pitcher..." value={search} onChange={handleSearch} 
                        style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: 'white', outline: 'none', fontSize: '0.9rem'}} />
                    <datalist id="lab-players">{allPlayers && allPlayers.map(p => <option key={p.Name} value={p.Name} />)}</datalist>
                </div>

                {/* Player Info */}
                {player ? (
                    <div style={{marginBottom: '15px'}}>
                        <h3 style={{margin: '0 0 4px 0', color: 'white', fontSize: '1rem'}}>{player.Name}</h3>
                        <div style={{fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '8px'}}>
                            <span style={{background: isLefty ? '#f59e0b' : '#3b82f6', color: 'white', padding: '1px 5px', borderRadius: '4px'}}>{isLefty ? 'LHP' : 'RHP'}</span>
                            <span>{player.Team}</span>
                        </div>
                    </div>
                ) : <div style={{color: '#64748b', fontSize: '0.85rem'}}>Select a player to begin analysis.</div>}

                {/* Arsenal Toggles (Compact) */}
                {player && (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '6px', flex: 1}}>
                        <div style={{fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px'}}>Arsenal</div>
                        {arsenal.map(p => (
                            <div key={p.code} style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                                <button onClick={() => toggleType(p.code)} 
                                    style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #334155', 
                                    background: activeTypes.includes(p.code) ? getPitchColor(p.code) : '#1e293b', 
                                    color: 'white', opacity: activeTypes.includes(p.code) ? 1 : 0.6, cursor: 'pointer', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem' }}>
                                    {PITCH_NAMES[p.code] || p.code}
                                </button>
                                <button onClick={() => setEditingPitch(editingPitch === p.code ? null : p.code)}
                                    title="Set Pitch Location"
                                    style={{padding: '6px', borderRadius: '4px', border: '1px solid #334155', background: editingPitch === p.code ? '#f59e0b' : '#1e293b', cursor: 'pointer'}}>
                                    🎯
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Speed Slider & Action Button */}
                <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#94a3b8', fontSize: '0.75rem' }}>
                        <span>Speed</span>
                        <span>{(playbackSpeed * 100).toFixed(0)}%</span>
                    </div>
                    {/* FIXED: Slider constrained to 100% width with border-box to prevent overflow */}
                    <input 
                        type="range" min="0.05" max="1.0" step="0.05" value={playbackSpeed} 
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} 
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', accentColor: '#22c55e', cursor: 'pointer', height: '4px', marginBottom: '15px' }} 
                    />
                    
                    <div style={{display: 'flex', gap: '8px'}}>
                        <button onClick={() => setIsPlaying(true)} disabled={!player}
                            style={{flex: 1, padding: '10px', background: isPlaying ? '#ef4444' : '#22c55e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: player ? 1 : 0.5, fontSize: '0.9rem'}}>
                            {isPlaying ? 'Replaying...' : 'Throw'}
                        </button>
                        <button onClick={() => setShowDecisionPoint(!showDecisionPoint)} style={{padding: '10px', background: showDecisionPoint ? '#ef4444' : '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}} title="Toggle Tunnel">🛑</button>
                    </div>
                </div>
            </div>

            {/* --- RIGHT HUD --- */}
            <PitchHUD activePitches={activePitchData} isLefty={isLefty} />

            {/* --- BOTTOM RIGHT CAMERA CONTROLS --- */}
            <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 20, display: 'flex', gap: '5px', background: 'rgba(15,23,42,0.9)', padding: '5px', borderRadius: '8px', border: '1px solid #334155' }}>
                {Object.keys(CAMERA_VIEWS).map(v => (
                    <button key={v} onClick={() => setView(v)} 
                        style={{ padding: '6px 10px', background: view === v ? '#3b82f6' : 'transparent', color: view === v ? 'white' : '#94a3b8', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                        {v}
                    </button>
                ))}
            </div>

            {/* --- CENTER ALERT (Editing Mode) --- */}
            {editingPitch && (
                <div style={{position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: '#f59e0b', color: 'black', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginLeft: '110px'}}>
                    Click Strike Zone to place {editingPitch}
                </div>
            )}

            {/* --- 3D CANVAS (Expands to fill remaining width) --- */}
            <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
                <Canvas>
                    <PerspectiveCamera makeDefault fov={40} />
                    <CameraRig view={view} />
                    <ambientLight intensity={0.8} />
                    <pointLight position={[10, 20, 10]} intensity={1.2} />
                    
                    <Grid position={[0, 0, 30]} args={[40, 80]} cellSize={1} cellThickness={0.5} cellColor="#1e293b" sectionSize={5} sectionThickness={1} sectionColor="#334155" fadeDistance={50} infiniteGrid />
                    <Mound />
                    <StrikeZone />
                    {showDecisionPoint && <DecisionPointWall />}
                    {showDecisionPoint && tunnelMetric && <TunnelLabel metric={tunnelMetric} />}
                    <InteractiveZone onSelectTarget={handleTargetUpdate} editingPitch={editingPitch} />

                    {player && (
                        <>
                            <ModernArm isLefty={isLefty} targetRelease={activePitchData[0]?.release} />
                            {activePitchData.map(pitch => {
                                const target = pitchTargets[pitch.code] || { x: 0, y: 2.5, z: 0 };
                                return (
                                    <group key={pitch.code}>
                                        <StaticTrail pitch={pitch} target={target} />
                                        <AnimatedBall pitch={pitch} isPlaying={isPlaying} timeOffset={animTime} target={target} />
                                    </group>
                                )
                            })}
                        </>
                    )}
                </Canvas>
            </div>
        </div>
    );
};