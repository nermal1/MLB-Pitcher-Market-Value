# MLB Pitcher Valuation 2025

## Project Overview
This project is a sophisticated full stack analytics application designed to modernize how Major League Baseball pitchers are evaluated. It moves beyond traditional box score statistics to visualize player value, market inefficiencies, and statistical similarity through a proprietary metric called **kWAR** and an interactive **Similarity Network Engine**.

The application serves as a Portfolio Grade dashboard for General Managers or Analysts, featuring a high performance backend that processes advanced Sabermetrics and a responsive frontend that provides deep exploratory data analysis tools.

## The Core Metric: kWAR
To understand this project, one must understand the metric that drives the rankings: **kWAR**.

### The Context: What is WAR?
Wins Above Replacement (WAR) is the standard metric in baseball for summarizing a player's total contribution to their team in a single number. It attempts to answer the question: *"How many more wins did this player provide than a generic minor league replacement player?"*

### The Problem: Why WAR is Flawed for Pitchers
While WAR is excellent, it suffers from two major blind spots when evaluating modern pitching:

1. **The Leverage Problem:** Traditional WAR treats every inning as equal. A clean inning in a 10 to 0 blowout is valued exactly the same as a clean inning in a tied game in the 9th inning. This drastically undervalues elite relievers (Closers) who pitch fewer innings but in the most critical moments.
2. **The Contact Problem:** Most WAR calculations rely on FIP (Fielding Independent Pitching). FIP assumes that pitchers have zero control over balls in play. However, modern analytics show that elite pitchers *can* suppress exit velocity and induce weak contact. FIP often punishes these pitchers by calling them "lucky."

### The Solution: kWAR
kWAR (adjusted WAR) is a proprietary metric developed for this project to fix these inefficiencies.

#### The Formula Logic:
* **Base:** Starts with standard WAR.
* **Skill Adjustment:** Instead of FIP, kWAR uses **SIERA** (Skill Interactive Earned Run Average). SIERA accounts for the complexity of balls in play (ground ball rates, fly ball rates) to better isolate pure pitching skill from defense.
* **Leverage Multiplier (The "Clutch" Factor):**
  * **For Relievers:** If a reliever pitches in high leverage situations (gmLI > 1.0), their value is multiplied. This rewards "Firemen" who enter difficult situations and succeed.
  * **For Starters:** The multiplier is removed. Starters are judged on pure volume and run prevention efficiency. Rewarding high leverage for starters often inadvertently rewards "Arsonists" (pitchers who walk batters to create their own jams).

**Benefits:**
* Properly ranks elite Closers (like Emmanuel Clase) alongside top Starters.
* Identifies "FIP Outperformers" who consistently induce weak contact.

**Fallbacks:**
* It is a descriptive metric, not purely predictive. It tells you who *was* valuable in a specific context, which may not always repeat if a manager changes a player's role.

---

## Features

### 1. Interactive Player Dashboard
* **Grid View:** Visual cards with player headshots, team logos, and key stats. Includes "FIP Outperformer" badges for players beating their expected metrics.
* **Table View:** A spreadsheet style interface with sticky columns. Users can customize visible columns, selecting from over 50 advanced metrics (e.g., SwStr%, Barrel%, vFA).
* **Pagination & Sorting:** Server side sorting allows ranking millions of data points instantly.

### 2. League Landscape (Scatter Plot)
* **Market Inefficiency Finder:** Plots **Stuff+** (Raw Talent) against **kWAR** (Performance).
* **Dynamic Axes:** Users can swap the X and Y axes to any metric (e.g., Fastball Velocity vs Strikeout Percentage) to find correlations.
* **Color Coded Valuation:**
  * **Green:** Undervalued (High Performance relative to expectations).
  * **Red:** Overvalued (Low Performance relative to expectations).

### 3. Similarity Engine (Network Graph)
* **Physics Based Clustering:** Uses a force directed graph to visualize player similarities.
* **Nearest Neighbors Algorithm:** The backend calculates the Euclidean distance between every pitcher based on user selected metrics (e.g., Velocity, K%, Stuff+).
* **Target Mode:** Users can select a specific player (e.g., "Who is the next Tyler Glasnow?") and the graph isolates that player, drawing links to their 5 closest statistical matches.
* **Statistical Breakdown:** A "Tale of the Tape" table appears, showing exactly *why* the players are similar (e.g., "Player A has 98mph velocity, Player B has 97.5mph").

---

## Technical Architecture & Code Explanation

### Backend (`backend/main.py`)
Built with **Python** and **FastAPI**. It acts as the ETL (Extract, Transform, Load) engine and API layer.

* **Data Pipeline (`lifespan`):** On startup, the system loads the master CSV data. It cleans missing values, merges distinct identifiers (FanGraphs IDs vs MLB IDs), and calculates the proprietary `kWAR` and `kWAR_Diff` metrics for every player.
* **API Endpoints:**
  * `/pitchers`: Handles filtering, sorting, and pagination. It converts Pandas DataFrames into JSON optimized for the frontend.
  * `/graph-data`: The brain of the similarity engine. It uses `scikit-learn` to normalize player stats (StandardScaler) and run a `NearestNeighbors` algorithm. It returns a node link structure with calculated physical distances for the frontend visualization.

### Frontend (`frontend/src/`)
Built with **React**, **Vite**, and modern CSS.

* **`App.jsx`:** The main controller. It manages the global state (active tabs, search filters, modal visibility) and routes data between the Dashboard and the Charts views.
* **`ChartsView.jsx`:** Contains the heavy visualization logic.
  * **`PerformanceScatter`:** Uses `recharts` to render responsive scatter plots with dynamic tooltips.
  * **`SimilarityNetwork`:** Uses `react-force-graph-2d`. It implements custom Canvas rendering to draw circular player headshots directly onto the physics nodes. It manages the simulation "warm up" ticks to ensure the graph stabilizes visually before the user interacts with it.
  * **`SimilarityTable`:** A defensive component that renders the comparison data. It includes strict type checking to prevent rendering crashes when dealing with `NaN` or infinite values in baseball statistics (e.g., infinite ERA).

