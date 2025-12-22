import * as THREE from 'three';

const MOUND_DIST = 60.5;
const FPS_CONVERSION = 1.467; // mph to ft/s
const GRAVITY = 32.174; // ft/s^2

/**
 * Calculates ball position using "Ghost Path" Physics.
 * We calculate the 'Aim Point' required so that when Gravity and Spin
 * act on the ball, it lands perfectly at the targetPos.
 */
export const getBallPosAtTime = (t, pitch, targetPos = {x: 0, y: 2.5, z: 0}) => {
    // 1. Calculate Flight Characteristics
    const speedFps = pitch.velo * FPS_CONVERSION;
    const totalTime = MOUND_DIST / speedFps;
    
    // Clamp time so the ball stops at the plate (doesn't go behind it)
    const currentTime = Math.min(t, totalTime);
    const pct = currentTime / totalTime; // 0.0 to 1.0 progress

    // 2. Calculate Forces (in Feet)
    // Gravity Drop: d = 0.5 * g * t^2
    const totalGravityDrop = 0.5 * GRAVITY * (totalTime * totalTime);
    
    // Lift/Break (Induced Vertical Break from Statcast)
    // We treat this as a force fighting gravity.
    const totalInducedLift = pitch.vBreak; 

    // Net Vertical Movement (The actual distance the ball falls or rises relative to aim)
    // Positive = Rises (Physics impossible, but technically "Rise"), Negative = Drops
    const netVerticalMove = totalInducedLift - totalGravityDrop;

    // Horizontal Break (Statcast)
    const totalHorizontalMove = pitch.hBreak;

    // 3. Determine "Ghost Aim" Point
    // To hit the target, we must aim opposite to the movement.
    // e.g. If ball drops 2ft, we aim 2ft high.
    const startX = pitch.release[0];
    const startY = pitch.release[1];
    const startZ = pitch.release[2]; // usually ~55.0

    const aimX = targetPos.x - totalHorizontalMove;
    const aimY = targetPos.y - netVerticalMove;
    
    // 4. Linear Interpolation (The "Laser" Path to the Aim Point)
    const linearX = startX + (aimX - startX) * pct;
    const linearY = startY + (aimY - startY) * pct;
    
    // Z-Axis: Simple linear interpolation from Release to Plate (0)
    const currentZ = startZ - (startZ * pct);

    // 5. Apply Physics Curve (Quadratic Bezier-like offset)
    // We apply the movement incrementally based on time squared (t^2)
    const currentHBreak = totalHorizontalMove * (pct * pct);
    const currentVMove = netVerticalMove * (pct * pct);

    const x = linearX + currentHBreak;
    const y = linearY + currentVMove;
    const z = Math.max(0, currentZ); // Clamp Z to 0 so it doesn't go behind plate

    return new THREE.Vector3(x, y, z);
};

export const getTotalFlightTime = (velocity) => {
    if (!velocity) return 0;
    const speedFps = velocity * FPS_CONVERSION;
    return MOUND_DIST / speedFps;
};

export const getPitchColor = (code) => {
    const map = {
        'FF': '#d946ef', 'FA': '#d946ef', 
        'SL': '#f59e0b', 'ST': '#f59e0b',
        'CH': '#10b981', 
        'CU': '#06b6d4', 'KC': '#06b6d4',
        'SI': '#e879f9', 
        'FC': '#9333ea', 'CT': '#9333ea',
        'FS': '#3b82f6', 'FO': '#3b82f6',
        'KN': '#94a3b8'
    };
    return map[code] || '#ffffff';
};