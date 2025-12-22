import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Grid, PerspectiveCamera, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { getBallPosAtTime, getTotalFlightTime, getPitchColor } from './physics';

// --- CONSTANTS ---
const DECISION_POINT_Z = 23.8; // Standard MLB Tunnel Point

const PITCH_NAMES = {
    'FF': 'Four-Seam', 'FA': 'Fastball',
    'SL': 'Slider', 'ST': 'Sweeper',
    'CH': 'Changeup',
    'CU': 'Curveball', 'KC': 'Knuckle-Curve',
    'SI': 'Sinker',
    'FC': 'Cutter', 'CT': 'Cutter',
    'FS': 'Splitter', 'FO': 'Forkball',
    'KN': 'Knuckle'
};

const CAMERA_VIEWS = {
    catcher: { pos: [-0.0, 2.2, -5.0], target: [0.0, 5.0, 60.5], static: true },
    pitcher: { pos: [-2.5, 6.5, 63.1], target: [0.0, 1.5, 0.0], static: false },
    rhh: { pos: [1.4, 2.9, -5.0], target: [0.0, 5.0, 60.5], static: false },
    lhh: { pos: [-1.6, 2.6, -5.0], target: [0.0, 5.0, 60.5], static: false },
    side: { pos: [30, 8, 30], target: [0, 4, 30], static: false }
};

// --- VISUAL COMPONENTS ---

const DecisionPointWall = () => (
    <group position={[0, 2.5, DECISION_POINT_Z]}>
        <mesh>
            <planeGeometry args={[5, 5]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
        <Line points={[[-2.5, -2.5, 0], [2.5, -2.5, 0], [2.5, 2.5, 0], [-2.5, 2.5, 0], [-2.5, -2.5, 0]]} color="#94a3b8" lineWidth={1} dashed dashSize={0.5} gapSize={0.5} opacity={0.3} transparent />
    </group>
);

const TunnelLabel = ({ metric }) => {
    if (!metric) return null;
    const color = metric.isGood ? '#4ade80' : '#f87171'; 
    
    // DYNAMIC RING SIZING
    // metric.dist is in inches.
    // Convert to Feet: / 12
    // Radius is half distance: / 2
    // Add minimum base size so it doesn't vanish: + 0.25 (3 inches visual padding)
    const separationFeet = parseFloat(metric.dist) / 12;
    const radius = (separationFeet / 2) + 0.15; 
    
    return (
        <group position={[metric.pos.x, metric.pos.y, DECISION_POINT_Z]}>
            <Billboard follow={true}>
                <Text 
                    fontSize={1.5} 
                    color={color} 
                    outlineWidth={0.05} 
                    outlineColor="#000000"
                    anchorY="bottom"
                    position={[0, radius + 0.2, 0]} // Float text above ring
                >
                    {metric.dist}"
                </Text>
                <Text 
                    position={[0, radius + 0.2 - 0.6, 0]} 
                    fontSize={0.4} 
                    color="#cbd5e1"
                    anchorY="top"
                >
                    TUNNEL
                </Text>
            </Billboard>
            
            {/* Dynamic Ring */}
            <mesh>
                <ringGeometry args={[radius, radius + 0.05, 64]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
            {/* Inner faint fill for better visibility */}
            <mesh>
                <circleGeometry args={[radius, 64]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.15} />
            </mesh>
        </group>
    );
};

const PitchHUD = ({ activePitches, isLefty }) => {
    if (!activePitches || activePitches.length === 0) return null;
    const displayPitches = activePitches.slice(0, 2); 

    return (
        <div style={{ position: 'absolute', top: 20, right: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 50 }}>
            {displayPitches.map(p => (
                <div key={p.code} className="hud-card" style={{ background: 'rgba(15, 23, 42, 0.95)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${getPitchColor(p.code)}`, color: 'white', width: '240px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
                    <div style={{marginBottom:'8px', borderBottom:'1px solid #334155', paddingBottom:'4px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <strong style={{color: getPitchColor(p.code), fontSize:'1.1em'}}>{PITCH_NAMES[p.code] || p.code}</strong>
                        <div style={{textAlign: 'right', lineHeight: '1.1'}}>
                            <div style={{color: '#fff', fontWeight: 'bold', fontSize: '1.2em'}}>{p.velo.toFixed(1)} <small style={{fontSize:'0.6em', color:'#94a3b8'}}>MPH</small></div>
                            <div style={{color: '#94a3b8', fontSize: '0.7em', marginTop:'2px'}}>
                                {isLefty ? 'L' : 'R'} {p.calculatedAngle.toFixed(0)}° Slot
                            </div>
                        </div>
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'0.85em'}}>
                        <div><div style={{color:'#94a3b8', fontSize:'0.8em'}}>SPIN RATE</div><div>{p.spin > 0 ? p.spin.toFixed(0) : '-'} <small>rpm</small></div></div>
                        <div><div style={{color:'#94a3b8', fontSize:'0.8em'}}>EXTENSION</div><div>{p.extension.toFixed(1)} <small>ft</small></div></div>
                        <div><div style={{color:'#94a3b8', fontSize:'0.8em'}}>RELEASE H</div><div>{p.release[1].toFixed(2)} <small>ft</small></div></div>
                        <div><div style={{color:'#94a3b8', fontSize:'0.8em'}}>BREAK (V/H)</div><div>{p.vBreak.toFixed(2)}" / {Math.abs(p.hBreak * 12).toFixed(1)}"</div></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ModernArm = ({ isLefty, targetRelease }) => {
    const shoulderPos = new THREE.Vector3(isLefty ? -1.0 : 1.0, 5.8, 55.0);
    const handPos = targetRelease 
        ? new THREE.Vector3(targetRelease[0], targetRelease[1], targetRelease[2])
        : new THREE.Vector3(isLefty ? -1.5 : 1.5, 4.0, 55.0); 

    const midPoint = new THREE.Vector3().addVectors(shoulderPos, handPos).multiplyScalar(0.5);
    const armLength = shoulderPos.distanceTo(handPos);

    const armObj = useMemo(() => {
        const obj = new THREE.Object3D();
        obj.position.copy(midPoint);
        obj.lookAt(handPos); 
        obj.rotateX(Math.PI / 2); 
        return obj;
    }, [midPoint.x, midPoint.y, midPoint.z, handPos.x, handPos.y, handPos.z]);

    return (
        <group>
            <mesh position={shoulderPos}><sphereGeometry args={[0.15, 16, 16]} /><meshStandardMaterial color="#64748b" transparent opacity={0.8} /></mesh>
            <mesh position={midPoint} quaternion={armObj.quaternion}><cylinderGeometry args={[0.04, 0.09, armLength, 12]} /><meshStandardMaterial color="#94a3b8" transparent opacity={0.6} /></mesh>
            <mesh position={handPos}><sphereGeometry args={[0.12, 16, 16]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} /></mesh>
            <Line points={[[handPos.x, handPos.y, handPos.z], [handPos.x, 0, handPos.z]]} color="#334155" lineWidth={1} dashed dashSize={0.2} gapSize={0.2} />
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

// --- NEW STATIC TRAIL (SPLIT COLOR) ---
const StaticTrail = ({ pitch, target }) => {
    const points = useMemo(() => {
        const pts = [];
        const flightTime = getTotalFlightTime(pitch.velo);
        const segments = 50;
        for(let i=0; i<=segments; i++) pts.push(getBallPosAtTime((i/segments)*flightTime, pitch, target));
        return pts;
    }, [pitch, target]);

    // Split points at Decision Point Z
    const splitIndex = points.findIndex(p => p.z < DECISION_POINT_Z);
    const tunnelPoints = points.slice(0, splitIndex + 1);
    const breakPoints = points.slice(splitIndex);

    const color = getPitchColor(pitch.code);

    return (
        <group>
            {/* Tunnel Segment (Silver) */}
            <Line points={tunnelPoints} color="#94a3b8" lineWidth={2} transparent opacity={0.4} />
            {/* Break Segment (Colored) */}
            <Line points={breakPoints} color={color} lineWidth={4} transparent opacity={0.8} />
        </group>
    );
};

const AnimatedBall = ({ pitch, isPlaying, timeOffset, target }) => {
    const meshRef = useRef();
    const flightTime = useMemo(() => getTotalFlightTime(pitch.velo), [pitch.velo]);
    useFrame(() => {
        if (!meshRef.current) return;
        if (timeOffset <= flightTime && timeOffset >= 0) {
            const pos = getBallPosAtTime(timeOffset, pitch, target);
            meshRef.current.position.copy(pos);
            meshRef.current.visible = true;
        } else {
            meshRef.current.visible = false;
        }
    });
    return <mesh ref={meshRef} visible={false}><sphereGeometry args={[0.12, 16, 16]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.6} /></mesh>;
};

const CameraRig = ({ view, isDevMode }) => {
    const { camera, controls } = useThree();
    const controlsRef = useRef();
    useEffect(() => {
        const config = CAMERA_VIEWS[view];
        if (config && controlsRef.current) {
            camera.position.set(...config.pos);
            controlsRef.current.target.set(...config.target);
            controlsRef.current.enabled = isDevMode ? true : !config.static;
            controlsRef.current.update();
        }
    }, [view, camera, isDevMode]);
    return <OrbitControls ref={controlsRef} enablePan={isDevMode} zoomSpeed={0.2} rotateSpeed={0.5} />;
};

const InteractiveZone = ({ onSelectTarget, editingPitch }) => {
    const [hover, setHover] = useState(null);
    return (
        <group position={[0, 2.5, 0]}> 
            <mesh 
                visible={false} position={[0, 0, 0]}
                onClick={(e) => { e.stopPropagation(); if (onSelectTarget) onSelectTarget(e.point); }}
                onPointerMove={(e) => { e.stopPropagation(); if(editingPitch) setHover(e.point); }}
                onPointerOut={() => setHover(null)}
            >
                <planeGeometry args={[4, 4]} /><meshBasicMaterial color="red" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
            {editingPitch && hover && <mesh position={[hover.x, hover.y - 2.5, 0]}><ringGeometry args={[0.15, 0.2, 32]} /><meshBasicMaterial color="lime" /></mesh>}
            {editingPitch && <gridHelper args={[4, 8, 0xffffff, 0x444444]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.01]} />}
        </group>
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
    const [isDevMode, setIsDevMode] = useState(false);
    const [showDecisionPoint, setShowDecisionPoint] = useState(true);
    const [pitchTargets, setPitchTargets] = useState({}); 
    const [editingPitch, setEditingPitch] = useState(null); 

    const { arsenal, isLefty } = useMemo(() => {
        if(!player) return { arsenal: [], isLefty: false };
        
        const pitchTypes = [
            { code: 'FF', prefix: 'ff' }, { code: 'SL', prefix: 'sl' },
            { code: 'CH', prefix: 'ch' }, { code: 'CU', prefix: 'cu' },
            { code: 'SI', prefix: 'si' }, { code: 'FC', prefix: 'fc' }, { code: 'FS', prefix: 'fs' }
        ];

        // --- HANDEDNESS ---
        let detectedLefty = false;
        let validReleaseFound = false;
        for (const p of pitchTypes) {
            const rx = parseFloat(player[`${p.prefix}_release_x`]);
            if (!isNaN(rx) && rx !== 0) {
                detectedLefty = rx > 0;
                validReleaseFound = true;
                break;
            }
        }
        if (!validReleaseFound) detectedLefty = parseFloat(player['ff_avg_break_x'] || 0) > 2.0;

        const processed = pitchTypes.map(p => {
            const veloKey = `${p.prefix}_avg_speed`;
            const velo = parseFloat(player[veloKey]);
            if (!velo) return null;

            let extension = parseFloat(player[`${p.prefix}_extension`] || player[`${p.prefix}_release_extension`] || 6.0);
            let relX, relZ;
            let rawX = parseFloat(player[`${p.prefix}_release_x`]);
            let rawZ = parseFloat(player[`${p.prefix}_release_z`]);

            if (!isNaN(rawX) && !isNaN(rawZ) && rawZ > 1.0) {
                relX = rawX * -1; 
                relZ = rawZ;
            } else {
                let angle = parseFloat(player['arm_angle']) || 45; 
                const rad = (angle * Math.PI) / 180;
                const armLen = 2.0; const shoulder = 5.5;
                const xOffset = Math.cos(rad) * armLen;
                relX = detectedLefty ? (xOffset * -1) : xOffset; 
                relZ = shoulder + Math.sin(rad) * armLen;
            }

            // Arm Angle Calc
            const shoulderX = detectedLefty ? -1.0 : 1.0;
            const shoulderY = 5.8;
            const deltaY = shoulderY - relZ; 
            const deltaX = Math.abs(relX - shoulderX);
            let calcAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

            const pfxX = parseFloat(player[`${p.prefix}_avg_break_x`] || 0);
            const pfxZ = parseFloat(player[`${p.prefix}_avg_break_z`] || 0);

            return {
                code: p.code, velo: velo,
                hBreak: (pfxX / 12) * -1, 
                vBreak: (pfxZ / 12), 
                spin: parseFloat(player[`${p.prefix}_avg_spin`] || 0),
                extension: extension,
                calculatedAngle: calcAngle, 
                release: [relX, relZ, 60.5 - extension]
            };
        }).filter(Boolean);
        
        return { arsenal: processed, isLefty: detectedLefty };
    }, [player]);

    // Set Filters
    useEffect(() => { 
        if(arsenal.length > 0) {
            setActiveTypes(arsenal.map(p => p.code));
            setPitchTargets({}); 
            setEditingPitch(null);
        }
    }, [arsenal]);

    // Animation
    useEffect(() => {
        if (!isPlaying) return;
        let lastFrameTime = performance.now();
        let accumulatedTime = 0;
        const loop = (now) => {
            const delta = (now - lastFrameTime) / 1000;
            lastFrameTime = now;
            accumulatedTime += delta * playbackSpeed;
            setAnimTime(accumulatedTime);
            if (accumulatedTime < 0.6) requestAnimationFrame(loop);
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
    const dummyRelease = activePitchData.length > 0 ? activePitchData[0].release : null;

    // --- TUNNEL METRIC CALC ---
    const tunnelMetric = useMemo(() => {
        if (activePitchData.length < 2) return null;
        const p1 = activePitchData[0];
        const p2 = activePitchData[1];
        
        const t1 = pitchTargets[p1.code] || { x: 0, y: 2.5, z: 0 };
        const t2 = pitchTargets[p2.code] || { x: 0, y: 2.5, z: 0 };

        const getTunnelPos = (pitch, target) => {
            const totalT = getTotalFlightTime(pitch.velo);
            const startZ = pitch.release[2];
            const distTraveled = startZ - DECISION_POINT_Z;
            const pct = distTraveled / startZ;
            return getBallPosAtTime(totalT * pct, pitch, target);
        };

        const pos1 = getTunnelPos(p1, t1);
        const pos2 = getTunnelPos(p2, t2);
        const distFeet = pos1.distanceTo(pos2);
        const distInches = distFeet * 12;

        return {
            dist: distInches.toFixed(1),
            isGood: distInches < 6.0,
            pos: pos1.lerp(pos2, 0.5)
        };
    }, [activePitchData, pitchTargets]);

    return (
        <div className="chart-container fade-in" style={{ height: '700px', background: '#0f172a', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
            {/* UI LAYER */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                {/* Search & Select */}
                <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'auto', background: 'rgba(15,23,42,0.95)', padding: '15px', borderRadius: '8px', border: '1px solid #334155', minWidth: '220px' }}>
                    <h2 style={{margin: '0 0 10px 0', fontSize: '1.2rem'}}>Pitch Lab <span style={{color: '#a855f7'}}>Pro</span></h2>
                    {editingPitch && <div style={{background: '#f59e0b', color: 'black', padding: '5px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem'}}>🎯 Click Zone to Place {editingPitch}</div>}
                    <input type="text" list="lab-players" placeholder="Search Player..." value={search} onChange={handleSearch} style={{background: '#1e293b', border: '1px solid #475569', color: 'white', padding: '8px', borderRadius: '4px', width: '100%'}} />
                    <datalist id="lab-players">{allPlayers && allPlayers.map(p => <option key={p.Name} value={p.Name} />)}</datalist>
                    <div style={{marginTop: '15px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <strong>{player ? player.Name : 'Select Player'}</strong>
                            {player && <span style={{fontSize:'0.7rem', background: isLefty?'#f59e0b':'#3b82f6', padding:'2px 6px', borderRadius:'4px'}}>{isLefty ? 'LHP' : 'RHP'}</span>}
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px'}}>
                            {arsenal.map(p => (
                                <div key={p.code} style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
                                    <button onClick={() => toggleType(p.code)} title={PITCH_NAMES[p.code] || p.code} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px 0 0 4px', border: 'none', cursor: 'pointer', background: activeTypes.includes(p.code) ? getPitchColor(p.code) : '#334155', color: 'white', opacity: activeTypes.includes(p.code) ? 1 : 0.5, flex: 1 }}>{p.code}</button>
                                    <button onClick={() => { if (!activeTypes.includes(p.code)) toggleType(p.code); setEditingPitch(editingPitch === p.code ? null : p.code); }} style={{ padding: '4px', borderRadius: '0 4px 4px 0', border: 'none', background: editingPitch === p.code ? '#f59e0b' : '#475569', cursor: 'pointer', color: 'white' }}>🎯</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right HUD */}
                <PitchHUD activePitches={activePitchData} isLefty={isLefty} />

                {/* Bottom Controls */}
                <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: 'rgba(15,23,42,0.8)', padding: '15px', borderRadius: '16px', border: '1px solid #334155' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '15px', width: '100%'}}>
                        <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>Speed: {(playbackSpeed * 100).toFixed(0)}%</span>
                        <input type="range" min="0.05" max="1.0" step="0.05" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} style={{accentColor: '#22c55e', width: '120px'}} />
                    </div>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button onClick={() => { setIsPlaying(true); }} style={{ padding: '10px 40px', background: isPlaying ? '#ef4444' : '#22c55e', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', minWidth: '160px' }}>{isPlaying ? 'REPLAYING...' : 'THROW PITCH'}</button>
                        <button onClick={() => setShowDecisionPoint(!showDecisionPoint)} style={{ padding: '10px', background: showDecisionPoint ? '#ef4444' : '#475569', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }} title="Toggle Tunnel">🛑</button>
                    </div>
                </div>
                
                {/* Camera Toggles */}
                <div style={{ position: 'absolute', bottom: 30, right: 20, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {Object.keys(CAMERA_VIEWS).map(v => (
                        <button key={v} onClick={() => setView(v)} style={{ padding: '8px 12px', background: view === v ? '#3b82f6' : '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', textTransform: 'capitalize' }}>🎥 {v}</button>
                    ))}
                    <button onClick={() => setIsDevMode(!isDevMode)} style={{ marginTop: '10px', padding: '8px 12px', background: isDevMode ? '#f59e0b' : '#334155', color: 'white', border: '1px solid #f59e0b', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{isDevMode ? '🛠️ Lock' : '🛠️ Adjust'}</button>
                </div>
            </div>

            {/* 3D SCENE */}
            <Canvas>
                <PerspectiveCamera makeDefault fov={45} />
                <CameraRig view={view} isDevMode={isDevMode} />
                <ambientLight intensity={0.7} />
                <pointLight position={[10, 20, 10]} intensity={1} />
                <pointLight position={[-10, 5, 60]} intensity={0.5} />
                <Grid position={[0, 0, 30]} args={[40, 80]} cellSize={1} cellThickness={0.5} cellColor="#1e293b" sectionSize={5} sectionThickness={1} sectionColor="#334155" fadeDistance={60} infiniteGrid />
                <Mound />
                <StrikeZone />
                {showDecisionPoint && <DecisionPointWall />}
                
                {/* 3D Tunnel Metric */}
                {showDecisionPoint && tunnelMetric && <TunnelLabel metric={tunnelMetric} />}

                <InteractiveZone onSelectTarget={handleTargetUpdate} editingPitch={editingPitch} />

                {player && (
                    <>
                        <ModernArm isLefty={isLefty} targetRelease={dummyRelease} />
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
    );
};