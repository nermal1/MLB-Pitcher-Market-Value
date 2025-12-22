import React, { useState } from 'react';

export const EducationPanel = () => {
    // FIX: Set initial state to null so everything starts collapsed
    const [expandedTopic, setExpandedTopic] = useState(null);

    const toggleTopic = (topic) => {
        setExpandedTopic(expandedTopic === topic ? null : topic);
    };

    const headerStyle = {
        width: '100%',
        background: 'transparent',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'left',
        fontFamily: 'Inter, sans-serif'
    };

    const activeHeaderStyle = {
        ...headerStyle,
        background: '#1e293b'
    };

    return (
        <div className="education-sidebar" style={{
            width: '320px',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(10px)',
            borderLeft: '1px solid #334155',
            padding: '20px',
            overflowY: 'auto',
            color: '#e2e8f0',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <h3 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '1.1rem', 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                color: '#94a3b8',
                borderBottom: '1px solid #334155',
                paddingBottom: '10px'
            }}>
                Pitch Logic Academy
            </h3>

            {/* --- PITCH TUNNELING --- */}
            <div className="edu-card" style={{ marginBottom: '15px' }}>
                <button 
                    onClick={() => toggleTopic('tunneling')}
                    style={expandedTopic === 'tunneling' ? activeHeaderStyle : headerStyle}
                >
                    <span>Pitch Tunneling</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {expandedTopic === 'tunneling' ? '▼' : '▶'}
                    </span>
                </button>

                {expandedTopic === 'tunneling' && (
                    <div className="edu-content" style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: '#0f172a',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        border: '1px solid #334155'
                    }}>
                        <p style={{ marginTop: 0 }}>
                            <strong>Pitch Tunneling</strong> refers to the ability of two different pitches to travel along the exact same trajectory for the first 24 feet of flight.
                        </p>
                        <p>
                            A batter has approximately <strong>150 milliseconds</strong> to decide whether to swing. This decision must be made at the "Decision Point" (~23.8 ft from the plate). If a Fastball and Slider share a "tunnel" past this point, the batter is physically incapable of distinguishing them in time.
                        </p>
                        
                        <div style={{ margin: '15px 0', background: '#1e293b', padding: '10px', borderRadius: '6px' }}>
                            <strong style={{ display:'block', marginBottom:'8px', color:'#a855f7' }}>The Tunnel Metric</strong>
                            <p style={{ margin: 0, fontSize: '0.85rem', marginBottom:'10px' }}>
                                Measured as the distance between two pitches at the Decision Point.
                            </p>
                            
                            <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#4ade80' }}>Elite</span>
                                    <span style={{ fontFamily: 'monospace' }}>0.0" - 1.5"</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#facc15' }}>Average</span>
                                    <span style={{ fontFamily: 'monospace' }}>1.5" - 3.0"</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#f87171' }}>Poor</span>
                                    <span style={{ fontFamily: 'monospace' }}>&gt; 3.0"</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- ARM SLOT & RELEASE --- */}
            <div className="edu-card">
                <button 
                    onClick={() => toggleTopic('arm_slot')}
                    style={expandedTopic === 'arm_slot' ? activeHeaderStyle : headerStyle}
                >
                    <span>Arm Slot & Release</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {expandedTopic === 'arm_slot' ? '▼' : '▶'}
                    </span>
                </button>

                {expandedTopic === 'arm_slot' && (
                    <div className="edu-content" style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: '#0f172a',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        border: '1px solid #334155'
                    }}>
                        <p style={{ marginTop: 0 }}>
                            <strong>Arm Slot</strong> is the angle of the arm relative to the shoulder line at the moment of release. It dictates the natural movement profile of a pitcher's arsenal.
                        </p>

                        <div style={{ display: 'grid', gap: '8px', marginBottom: '15px' }}>
                            <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>
                                <strong style={{color: '#e2e8f0'}}>Over the Top (90°-75°)</strong>
                                <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>Promotes vertical "ride" on fastballs and steep depth on curveballs.</div>
                            </div>
                            <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '8px' }}>
                                <strong style={{color: '#e2e8f0'}}>Three-Quarters (75°-50°)</strong>
                                <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>The most common slot. Balances vertical lift with horizontal run.</div>
                            </div>
                            <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '8px' }}>
                                <strong style={{color: '#e2e8f0'}}>Sidearm / Sub (&lt;50°)</strong>
                                <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>Sacrifices vertical lift for extreme horizontal run and sink.</div>
                            </div>
                        </div>

                        <p>
                            <strong>Release Consistency</strong> is critical. Elite pitchers maintain the exact same arm slot and release height for every pitch type. 
                        </p>
                        <p style={{marginBottom: 0}}>
                            If the data shows a different release height for Fastballs vs. Curveballs, batters can "tip" the pitch immediately out of the hand, rendering the deception useless.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
};