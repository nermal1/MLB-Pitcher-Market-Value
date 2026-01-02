# MLB Pitcher Valuation 2025

website link https://mlb-pitcher-market-value-e2snajh8g-chances-projects-d5c99157.vercel.app

## Project Overview
This project is a sophisticated full-stack analytics application designed to modernize how Major League Baseball pitchers are evaluated. It moves beyond traditional box score statistics to visualize player value, market inefficiencies, and statistical similarity through a proprietary metric called **kWAR**, an interactive **Similarity Network Engine**, and a **3D Biomechanical Pitch Lab**.

The application serves as a Portfolio-Grade dashboard for General Managers or Analysts, featuring a high-performance backend that processes advanced Sabermetrics and a responsive frontend that provides deep exploratory data analysis tools.

## The Core Metric: kWAR
To understand this project, one must understand the metric that drives the rankings: **kWAR**.

### The Context: What is WAR?
Wins Above Replacement (WAR) is the standard metric in baseball for summarizing a player's total contribution to their team in a single number. It attempts to answer the question: *"How many more wins did this player provide than a generic minor league replacement player?"*

### The Problem: Why WAR is Flawed for Pitchers
While WAR is excellent, it suffers from two major blind spots when evaluating modern pitching:

1. **The Leverage Problem:** Traditional WAR treats every inning as equal. A clean inning in a 10-0 blowout is valued exactly the same as a clean inning in a tied game in the 9th. This drastically undervalues elite relievers (Closers) who pitch fewer innings but in the most critical moments.
2. **The Contact Problem:** Most WAR calculations rely on FIP (Fielding Independent Pitching). FIP assumes that pitchers have zero control over balls in play. However, modern analytics show that elite pitchers *can* suppress exit velocity and induce weak contact. FIP often punishes these pitchers by calling them "lucky."

### The Solution: kWAR
kWAR (adjusted WAR) is a proprietary metric developed for this project to fix these inefficiencies.

#### The Formula Logic:
* **Base:** Starts with standard WAR.
* **Skill Adjustment:** Instead of FIP, kWAR uses **SIERA** (Skill Interactive Earned Run Average). SIERA accounts for the complexity of balls in play (ground ball rates, fly ball rates) to better isolate pure pitching skill from defense.
* **Leverage Multiplier (The "Clutch" Factor):**
  * **For Relievers:** If a reliever pitches in high-leverage situations (gmLI > 1.0), their value is multiplied. This rewards "Firemen" who enter difficult situations and succeed.
  * **For Starters:** The multiplier is removed. Starters are judged on pure volume and run prevention efficiency.

**Benefits:**
* Properly ranks elite Closers (like Emmanuel Clase) alongside top Starters.
* Identifies "FIP Outperformers" who consistently induce weak contact.

---

## Features

### 1. Interactive Player Dashboard
* **Grid View:** Visual cards with player headshots, team logos, and key stats. Includes "FIP Outperformer" badges for players beating their expected metrics.
* **Table View:** A spreadsheet-style interface with sticky columns. Users can customize visible columns, selecting from over 50 advanced metrics (e.g., SwStr%, Barrel%, vFA).
* **Pagination & Sorting:** Server-side sorting allows ranking millions of data points instantly.

### 2. League Landscape (Scatter Plot)
* **Market Inefficiency Finder:** Plots **Stuff+** (Raw Talent) against **kWAR** (Performance).
* **Dynamic Axes:** Users can swap the X and Y axes to any metric (e.g., Fastball Velocity vs Strikeout Percentage) to find correlations.
* **Color Coded Valuation:**
  * **Green:** Undervalued (High Performance relative to expectations).
  * **Red:** Overvalued (Low Performance relative to expectations).

### 3. Similarity Engine (Network Graph)
* **Physics-Based Clustering:** Uses a force-directed graph to visualize player similarities.
* **Nearest Neighbors Algorithm:** The backend calculates the Euclidean distance between every pitcher based on user-selected metrics (e.g., Velocity, K%, Stuff+).
* **Target Mode:** Users can select a specific player (e.g., "Who is the next Tyler Glasnow?") and the graph isolates that player, drawing links to their 5 closest statistical matches.

### 4. 3D Pitch Lab (Biomechanics & Tunneling)
* **Real-Time Physics Engine:** A custom kinematic physics system (`physics.js`) that simulates gravity, drag, and spin-induced movement (Magnus Effect) to render realistic flight paths.
* **Ghost Arm Visualization:** A procedural 3D arm model ("ModernArm") that dynamically adjusts to the player's actual release point data (height, extension, and lateral offset) and handedness (LHP/RHP).
* **Pitch Tunneling Analysis:**
  * **Visual Tunnel:** Pitch trails are split into two segments: the "Tunnel" (first 24ft, silver) and the "Break" (colored). This visualizes how long two pitches look identical to a batter.
  * **Decision Point Metrics:** Calculates the exact separation (in inches) between two pitches at the "Decision Point" (23.8ft from the plate).
  * **Tunnel Ring:** A dynamic 3D ring renders at the decision point to visualize the batter's window of recognition.
* **Interactive Targets:** Users can click anywhere in the strike zone to re-target pitches, allowing them to test hypothetical pitch combinations and sequencing strategies.

### 5. Pitch Logic Academy (Education Sidebar)
* **Interactive Learning:** A sidebar module that explains complex concepts like "Pitch Tunneling" and "Arm Slot" to users who may be new to sabermetrics.
* **Grading Scales:** Provides context for the data (e.g., defining that <1.5 inch tunnel separation is "Elite").

---

## Technical Architecture & Code Explanation

### Backend (`backend/main.py`)
Built with **Python** and **FastAPI**. It acts as the ETL (Extract, Transform, Load) engine and API layer.

* **Data Pipeline (`lifespan`):** On startup, the system loads the master CSV data. It includes a **Robust Name Matcher** using `unicodedata` to handle accent marks (e.g., "Rodón" vs "Rodon") and name formatting differences ("Last, First") to ensure physics data merges correctly.
* **API Endpoints:**
  * `/pitchers`: Handles filtering, sorting, and pagination.
  * `/graph-data`: The brain of the similarity engine using `scikit-learn`.

### Frontend (`frontend/src/`)
Built with **React**, **Vite**, **Three.js**, and **React Three Fiber**.

* **`App.jsx`:** The main controller managing global state and layout.
* **`PitchLab.jsx`:** The 3D environment. It handles the `Canvas` scene, camera rigging, and the integration of the physics engine. It uses `useMemo` for high-performance geometry calculations to prevent frame drops during animation.
* **`physics.js`:** A pure math module that solves kinematic equations to determine the initial velocity vector required for a pitch to hit a specific 3D coordinate given gravity and spin forces.
* **`EducationPanel.jsx`:** A collapsible sidebar component that provides contextual help and definitions without cluttering the main UI.
* **`ChartsView.jsx`:** Contains the D3/Recharts logic for the Scatter Plots and Network Graphs.
