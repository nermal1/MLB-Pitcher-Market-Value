import pandas as pd
import os
from pybaseball import chadwick_register

def fetch_player_ids():
    print("⚾ Fetching MLB Player IDs (Chadwick Register)...")
    
    # 1. Get the official register
    # This maps FanGraphs IDs -> MLB IDs -> Names
    register = chadwick_register()
    
    # 2. Filter for what we need
    # key_mlbam = The ID needed for headshots
    # name_first, name_last = For matching
    cols = ['name_first', 'name_last', 'key_mlbam']
    
    # Create a clean copy
    id_map = register[cols].dropna(subset=['key_mlbam']).copy()
    
    # 3. Create a 'Name' column to match your master file
    # We strip whitespace to be safe
    id_map['Name'] = (id_map['name_first'] + " " + id_map['name_last']).str.strip()
    
    # 4. Handle Duplicates (e.g., two players named Luis Garcia)
    # We keep the one with the highest ID (usually the most recent player)
    id_map = id_map.sort_values('key_mlbam', ascending=False)
    id_map = id_map.drop_duplicates(subset=['Name'], keep='first')
    
    # 5. Save
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_script_dir)
    output_dir = os.path.join(project_root, "data", "raw")
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "id_map.csv")
    id_map[['Name', 'key_mlbam']].to_csv(output_path, index=False)
    
    print(f"✅ Saved ID Map for {len(id_map)} players to: {output_path}")

if __name__ == "__main__":
    fetch_player_ids()