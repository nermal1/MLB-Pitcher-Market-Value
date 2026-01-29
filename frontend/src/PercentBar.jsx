import React, { memo } from 'react';

const PercentileBar = memo(({ label, value, percentile, suffix = '', colorOverride = null }) => {
  // Savant Style: 100% = Red (Hue 0), 0% = Blue (Hue 240)
  // We calculate Hue based on percentile.
  const hue = (100 - (percentile || 50)) * 2.4; 
  const color = colorOverride || `hsl(${hue}, 85%, 50%)`;

  return (
    <div className="metric-bar-container" style={{ marginBottom: '16px' }}>
      <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', color: '#cbd5e1' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>
          {value}{suffix} 
          <span style={{ fontSize: '0.8em', opacity: 0.6, marginLeft: '6px' }}>
            ({percentile ? Math.round(percentile) : '-'}th)
          </span>
        </span>
      </div>
      
      {/* The Bar Background */}
      <div className="progress-bg" style={{ height: '10px', background: '#334155', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
        
        {/* The Colored Fill */}
        <div 
          className="progress-fill" 
          style={{ 
            height: '100%', 
            width: `${percentile || 0}%`, 
            backgroundColor: color,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        ></div>
        
        {/* Optional: Center Marker (50th percentile) */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
      </div>
    </div>
  );
});

export default PercentileBar;