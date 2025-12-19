import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
from typing import List, Optional
from sklearn.metrics.pairwise import euclidean_distances
from scipy import stats
from sklearn.neighbors import NearestNeighbors

# 1. Global Variable
data_store = {}

# 2. Define Lifespan (Logic for loading data)
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("⚾ Loading MLB Data Engine (Robust Version)...")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    master_path = os.path.join(project_root, "data", "master_pitcher_clusters.csv")

    try:
        if os.path.exists(master_path):
            df = pd.read_csv(master_path)
            df = df.fillna(0)

            # --- 1. CLEAN & DEDUPLICATE ---
            if 'Season' in df.columns and 'IP' in df.columns:
                df = df.sort_values(by=['Name', 'Season', 'IP'], ascending=[True, False, False])
            
            df = df.drop_duplicates(subset=['Name'], keep='first')
            print(f"   -> Loaded {len(df)} Unique Players.")

            df = df.drop_duplicates(subset=['Name'], keep='first')
            print(f"   -> Loaded {len(df)} Unique Players.")

            id_path = os.path.join(project_root, "data", "raw", "id_map.csv")

            if os.path.exists(id_path):
                print("   -> Loading ID Map...")
                id_df = pd.read_csv(id_path)
                df = df.merge(id_df, on='Name', how='left')
                df = df.rename(columns={'key_mlbam': 'MLBID'})

                df['MLBID'] = df['MLBID'].fillna(0).astype(int)
            else:
                print("   -> ID Map not found, skipping ID mapping.")
                df['MLBID'] = 0

            # --- 2. ROBUST COLUMN MAPPING (The Fix for Cutters & missing Sc) ---
            # We map standard codes to whatever is in your CSV
            # Codes: FA=Fastball, FC=Cutter, SI=Sinker, SL=Slider, CU=Curve, CH=Change, FS=Splitter
            pitch_codes = ['FA', 'FC', 'SI', 'SL', 'CU', 'CH', 'FS']
            
            # Helper to find the best matching column for a metric
            def find_col(prefixes, suffixes, code):
                # Generates combinations like: vFA (sc), vFA (pi), vFA
                candidates = []
                for p in prefixes:
                    for s in suffixes:
                        candidates.append(f"{p}{code}{s}")
                
                for c in candidates:
                    # Case insensitive check
                    match = next((actual for actual in df.columns if actual.lower() == c.lower()), None)
                    if match: return match
                return None

            # Create standardized columns for Frontend
            for code in pitch_codes:
                # 1. VELOCITY (Prefer (sc) -> (pi))
                # Looks for: vFA (sc), vFA (pi), vFA
                velo_col = find_col(['v'], [' (sc)', ' (pi)', ''], code)
                if velo_col:
                    df[f"v{code}"] = df[velo_col]
                else:
                    df[f"v{code}"] = 0.0

                # 2. SPIN RATE (Prefer (sc) -> (pi))
                # Looks for: sFA (sc), sFA (pi), Spin_FA
                spin_col = find_col(['s', 'Spin_'], [' (sc)', ' (pi)', ''], code)
                if spin_col:
                    df[f"s{code}"] = df[spin_col]
                else:
                    df[f"s{code}"] = 0.0

                # 3. USAGE (Prefer (sc) -> (pi) -> %)
                # Looks for: FA% (sc), FA% (pi), FA%
                usage_col = find_col([''], ['% (sc)', '% (pi)', '%'], code)
                if usage_col:
                    df[f"u{code}"] = df[usage_col]
                else:
                    df[f"u{code}"] = 0.0

            # --- 3. AUDIT CRITICAL STATS ---
            required_stats = ['WAR', 'FIP', 'SIERA', 'gmLI']
            for col in required_stats:
                if col not in df.columns:
                    # Handle missing columns gracefully
                    df[col] = 1.0 if col == 'gmLI' else 0.0

            # --- 4. CALCULATE kWAR ---
            def calculate_kwar(row):
                try:
                    base_war = float(row.get('WAR', 0))
                    fip = float(row.get('FIP', 0))
                    siera = float(row.get('SIERA', 0))
                    ip = float(row.get('IP', 0))
                    
                    # A. Skill Adjustment (SIERA vs FIP)
                    skill_adj = 0
                    if fip > 0 and siera > 0:
                        runs_saved = fip - siera
                        # Conservative adjustment per inning
                        skill_adj = (runs_saved * ip / 9) / 10
                    
                    # B. Leverage Adjustment
                    leverage = float(row.get('gmLI', 1.0))
                    position = row.get('Position', 'Reliever') 

                    if position == 'Starter':
                        k_war = base_war + skill_adj
                    else:  
                        # Reliever Logic
                        multiplier = 1 + (leverage - 1) * 0.5
                        multiplier = max(0.85, min(multiplier, 1.5))
                        k_war = (base_war + skill_adj) * multiplier
                    
                    return round(k_war, 2)
                except:
                    return 0.0

            df['kWAR'] = df.apply(calculate_kwar, axis=1)
            df['kWAR_Diff'] = (df['kWAR'] - df['WAR']).round(2)
            
            # Skill Gap (FIP Outperformer)
            if 'FIP' in df.columns and 'SIERA' in df.columns:
                df['SkillGap'] = df['FIP'] - df['SIERA']
            else:
                df['SkillGap'] = 0

            # --- 5. PERCENTILES ---
            stats_to_rank = {
                'K%': True, 'BB%': False, 'Stuff+': True, 
                'SIERA': False, 'vFA (sc)': True, 'WAR': True, 'kWAR': True
            }
            for col, higher_is_better in stats_to_rank.items():
                if col in df.columns:
                    pct_col = f"{col}_pct"
                    rankings = df[col].rank(pct=True)
                    if not higher_is_better: rankings = 1 - rankings
                    df[pct_col] = (rankings * 100).round(0)
            
            data_store["pitchers"] = df
            print(f"✅ SYSTEM READY: Loaded {len(df)} Pitchers.")
        else:
            print(f"❌ CRITICAL ERROR: Master file not found at {master_path}")
            data_store["pitchers"] = pd.DataFrame()
            
    except Exception as e:
        print(f"❌ SYSTEM ERROR: {e}")
        import traceback
        traceback.print_exc()
        data_store["pitchers"] = pd.DataFrame()
    yield
    data_store.clear()

# 3. App Definition
app = FastAPI(title="MLB Pitcher Valuation API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# 4. Endpoints
@app.get("/")
def home():
    count = len(data_store.get("pitchers", []))
    return {"message": "MLB Pitcher API is Live", "pitcher_count": count}

@app.get("/pitchers")
def get_pitchers(
    search: Optional[str] = None, 
    archetype: Optional[str] = None,
    position: Optional[str] = None,
    sort_by: str = "WAR", 
    sort_order: str = "desc", # NEW: 'asc' or 'desc'
    skip: int = 0,            # NEW: Pagination offset
    limit: int = 50
):
    df = data_store.get("pitchers")
    if df is None or df.empty: return {"data": [], "total": 0}
    
    # 1. Filter
    if position: df = df[df['Position'] == position]
    if archetype and archetype != "All Archetypes": df = df[df['Archetype'] == archetype]
    if search: df = df[df['Name'].str.contains(search, case=False, na=False)]
    
    # Calculate Total (Before Pagination)
    total_count = len(df)
        
    # 2. Dynamic Sort Logic
    if sort_by in df.columns:
        # Convert sort_order string to boolean
        ascending = (sort_order.lower() == "asc")
        df = df.sort_values(by=sort_by, ascending=ascending)
    
    # 3. Pagination (Slice the dataframe)
    paginated_df = df.iloc[skip : skip + limit]
    
    # 4. Return Data + Metadata
    return {
        "data": paginated_df.replace({np.nan: None}).to_dict(orient="records"),
        "total": total_count,
        "page": (skip // limit) + 1,
        "pages": (total_count + limit - 1) // limit
    }

@app.get("/archetypes")
def get_archetypes():
    df = data_store.get("pitchers")
    return sorted(df['Archetype'].unique().tolist()) if df is not None else []

@app.get("/pitchers/{name}/similar")
def get_similar_pitchers(name: str):
    df = data_store.get("pitchers")
    target = df[df['Name'].str.lower() == name.lower()]
    if target.empty: raise HTTPException(status_code=404, detail="Pitcher not found")
    
    target_row = target.iloc[0]
    cluster_mates = df[df['Archetype'] == target_row['Archetype']].copy()
    
    features = ['K%', 'BB%', 'vFA', 'Stuff+'] # Used standardized vFA
    for col in features:
        if col not in cluster_mates.columns: cluster_mates[col] = 0
            
    target_stats = target_row[features].values.reshape(1, -1)
    others_stats = cluster_mates[features].values
    
    dists = euclidean_distances(target_stats, others_stats)[0]
    cluster_mates['distance'] = dists
    
    return cluster_mates[cluster_mates['Name'] != target_row['Name']].sort_values('distance').head(3).to_dict(orient="records")

@app.get("/graph-data")
def get_graph_data(
    metrics: Optional[List[str]] = Query(None),
    neighbors: int = 5,
    target_player: Optional[str] = None
):
    df = data_store.get("pitchers")
    if df is None or df.empty: return {"nodes": [], "links": []}

    # 1. Metrics Selection
    if not metrics:
        features = ['K%', 'BB%', 'vFA (sc)', 'Stuff+']
    else:
        features = metrics

    # Only keep features that actually exist in the CSV
    valid_features = [f for f in features if f in df.columns]
    if not valid_features:
        valid_features = ['K%', 'BB%', 'vFA (sc)', 'Stuff+']
    
    # 2. Normalize Data
    from sklearn.preprocessing import StandardScaler
    
    # CRASH FIX 1: Replace Infinite/NaN values in the matrix before scaling
    data_matrix = df[valid_features].replace([np.inf, -np.inf], 0).fillna(0).values
    
    scaler = StandardScaler()
    scaled_matrix = scaler.fit_transform(data_matrix)

    # 3. Run Nearest Neighbors
    n_search = neighbors + 1 if target_player else 4 
    nbrs = NearestNeighbors(n_neighbors=min(n_search, len(df)), algorithm='ball_tree').fit(scaled_matrix)
    distances, indices = nbrs.kneighbors(scaled_matrix)

    nodes = []
    links = []
    seen_nodes = set()

    # --- HELPER: SAFE NODE CREATION ---
    def get_node(idx):
        idx = int(idx)
        row = df.iloc[idx]
        
        name_parts = row['Name'].split(' ')
        last_name = name_parts[-1] if len(name_parts) > 0 else row['Name']
        
        node_data = {
            "id": str(row['Name']),
            "lastName": str(last_name),
            "mlbId": int(row.get('MLBID', 0)),
            "group": str(row['Archetype']),
            "val": float(row.get('WAR', 0)),
            "team": str(row.get('Team', ''))
        }
        
        # CRASH FIX 2: Sanitize every metric value
        for feature in valid_features:
            val = row.get(feature, 0)
            
            # Check for NaN or Infinity manually
            if pd.isna(val) or val == np.inf or val == -np.inf:
                val = 0.0
            
            # Convert numpy types to python native types
            if isinstance(val, (np.integer, int)):
                val = int(val)
            elif isinstance(val, (np.floating, float)):
                val = float(val)
                
            node_data[feature] = val
            
        return node_data

    # --- BUILD GRAPH ---
    if target_player:
        target_rows = df[df['Name'].str.lower() == target_player.lower()]
        if target_rows.empty: return {"nodes": [], "links": []}
        
        i = int(target_rows.index[0])
        nodes.append(get_node(i))
        seen_nodes.add(i)
        
        for j in range(1, n_search): 
            if j >= len(indices[i]): break
            neighbor_idx = int(indices[i][j])
            raw_dist = float(distances[i][j])
            
            # Avoid division by zero
            similarity = 1.0 / (1.0 + raw_dist)
            
            if neighbor_idx not in seen_nodes:
                nodes.append(get_node(neighbor_idx))
                seen_nodes.add(neighbor_idx)
            
            links.append({
                "source": df.iloc[i]['Name'],
                "target": df.iloc[neighbor_idx]['Name'],
                "visualDist": float(60 + (raw_dist * 100)), 
                "similarity": float(round(similarity, 3))
            })

    else:
        for i in range(len(df)):
            nodes.append(get_node(i))
            for j in range(1, 4): 
                if j >= len(indices[i]): break
                neighbor_idx = int(indices[i][j])
                links.append({
                    "source": df.iloc[i]['Name'],
                    "target": df.iloc[neighbor_idx]['Name'],
                    "visualDist": 40.0
                })

    return {"nodes": nodes, "links": links}