from pybaseball import statcast
import pandas as pd
import numpy as np

# 1. Fetch Raw Data (e.g., 2025 Season)
# This might take 2-3 minutes to download the first time
print("📥 Fetching raw pitch data (this may take a moment)...")
data = statcast(start_dt='2025-03-28', end_dt='2025-10-01')

# 2. Define Pitch Map (Savant Code -> Your App Prefix)
pitch_map = {
    'FF': 'ff', 'FA': 'ff', # Four-Seam
    'SL': 'sl', 'ST': 'sl', # Slider / Sweeper
    'CH': 'ch',             # Changeup
    'CU': 'cu', 'KC': 'cu', # Curve / Knuckle-Curve
    'SI': 'si',             # Sinker
    'FC': 'fc',             # Cutter
    'FS': 'fs', 'FO': 'fs'  # Splitter / Fork
}

# 3. Initialize Dictionary to store Player Stats
player_stats = {}

print("⚙️ Processing pitch metrics...")

# Group by Pitcher and Pitch Type
grouped = data.groupby(['player_name', 'pitcher', 'pitch_type'])

for (name, mlbid, p_code), group in grouped:
    if p_code not in pitch_map:
        continue
        
    prefix = pitch_map[p_code]
    
    # Initialize player if new
    if mlbid not in player_stats:
        player_stats[mlbid] = {
            'last_name, first_name': name,
            'player_id': mlbid,
            'year': 2025
        }
    
    # Calculate Averages for this pitch
    stats = player_stats[mlbid]
    
    # VELOCITY & SPIN
    stats[f'{prefix}_avg_speed'] = round(group['release_speed'].mean(), 1)
    stats[f'{prefix}_avg_spin'] = round(group['release_spin_rate'].mean(), 0)
    
    # BREAK (Flip X for catcher view consistency if needed, Savant is already catcher view)
    stats[f'{prefix}_avg_break_x'] = round(group['pfx_x'].mean() * 12, 1) # Convert ft to inches
    stats[f'{prefix}_avg_break_z'] = round(group['pfx_z'].mean() * 12, 1) # Vertical Break
    
    # --- NEW: REALISTIC RELEASE DATA ---
    stats[f'{prefix}_release_x'] = round(group['release_pos_x'].mean(), 2)
    stats[f'{prefix}_release_z'] = round(group['release_pos_z'].mean(), 2)
    stats[f'{prefix}_extension'] = round(group['release_extension'].mean(), 1)

# 4. Convert to DataFrame and Save
df_final = pd.DataFrame.from_dict(player_stats, orient='index')

# Fill NaNs with empty string or 0
df_final = df_final.fillna('')

print(f"✅ Generated data for {len(df_final)} pitchers.")
df_final.to_csv('stats.csv', index=False)
print("📂 Saved to stats.csv")