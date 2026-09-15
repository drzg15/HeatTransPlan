# Graph Report - HeatTransPlan  (2026-09-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1466 nodes · 2850 edges · 94 communities (53 shown, 25 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 103 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `93dc13fc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bootstrap.js
- Pinch
- 654
- HeatPumpIntegration
- is
- optimization_service.py
- PotentialAnalysisPage.tsx
- projectStore.ts
- ReportRequest
- models/analysis.py
- get_project
- io.ts
- react
- analysisStore.ts
- io_routes.py
- ProjectState
- Qi
- trigger
- ci
- frontend/package.json
- ps
- StreamModel
- .hide
- compilerOptions
- Ai
- routers/analysis.py
- devDependencies
- MapViewer.tsx
- StreamSelector.tsx
- compilerOptions
- Zs
- screenshotter/package.json
- Pinch Analysis
- clipboard.min.js
- Pinch Analysis
- HeatTransPlan
- english-stemmer.js
- pydata-sphinx-theme.js
- dependencies
- Ss
- searchtools.js
- Heat Pump Optimization — Predictive ML Model & Grid Search
- ISSP
- ye
- Heat Pump Integration — Classic Method
- Heat Pump Optimization — Predictive ML Model & Grid Search
- Heat Pump Integration — Classic Method
- useUIStore
- projectSchema.ts
- export_cop_ranges.py
- addCopyButtonToCodeCells
- geo_utils.py
- Qn
- process.py
- import_csv
- vs
- run_hpi
- list_projects
- scripts
- vite.config.ts
- copybutton_funcs.js
- doctools.js
- sphinx_highlight.js
- React + TypeScript + Vite
- ErrorBoundaryClass
- react-plotly.d.ts
- config_optimization.py
- HeatTransPlan — Calculation Logic
- HeatTransPlan — Calculation Logic
- lint-staged
- i18n.ts
- tsconfig.json
- _sources/refrigerant_limits.md
- documentation_options.js
- setupTests.ts
- GEMINI.md
- update-tutorial.sh
- heattransplan-backend

## God Nodes (most connected - your core abstractions)
1. `654()` - 55 edges
2. `ps` - 40 edges
3. `useAnalysisStore` - 33 edges
4. `ci` - 29 edges
5. `trigger()` - 27 edges
6. `react` - 26 edges
7. `react-i18next` - 26 edges
8. `Qi` - 23 edges
9. `ye` - 23 edges
10. `get_project()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `ol()` --indirect_call--> `N()`  [INFERRED]
  docs/_build/html/_static/scripts/fontawesome.js → docs/_build/html/_static/scripts/pydata-sphinx-theme.js
- `TotalSiteProfile` --uses--> `PinchMain`  [INFERRED]
  backend/app/modules/total_site_profile/total_site_profile.py → backend/app/modules/pinch_main.py
- `ProcessNode` --uses--> `StreamModel`  [INFERRED]
  backend/app/models/process.py → backend/app/models/stream.py
- `ProjectState` --uses--> `ProcessNode`  [INFERRED]
  backend/app/models/project.py → backend/app/models/process.py
- `import_csv()` --uses--> `ProcessNode`  [INFERRED]
  backend/app/routers/io_routes.py → backend/app/models/process.py

## Import Cycles
- None detected.

## Communities (94 total, 25 thin omitted)

### Community 0 - "bootstrap.js"
Cohesion: 0.06
Nodes (45): ae(), B(), ce(), ct(), D(), de(), dt(), et() (+37 more)

### Community 1 - "Pinch"
Cohesion: 0.05
Nodes (25): PinchMain, PinchExport, Pinch, PinchPlot, Streams, build_heat_profiles(), _composite_curve(), _composite_profiles() (+17 more)

### Community 2 - "654"
Cohesion: 0.09
Nodes (46): 654(), cl(), dc(), e(), fc(), fl(), g(), Gc() (+38 more)

### Community 3 - "HeatPumpIntegration"
Cohesion: 0.06
Nodes (17): carnot_cop(), HeatPumpIntegration, in_operating_window(), ValueError, A heat pump needs a positive temperature lift. With the pocket-free GCC the…, Best COP available at source temperature T, across every technology rated for…, Returns list of all heat pump types with their COPs and availability status, COP of one named technology at source temperature T. Raises HeatPumpOutOfRange… (+9 more)

### Community 4 - "is"
Cohesion: 0.06
Nodes (6): fe(), ge(), getDataAttributes(), is, tn, ve

### Community 5 - "optimization_service.py"
Cohesion: 0.07
Nodes (43): AST, HPIOptimizationDiagnostics, HPIOptimizationRequest, OptimizedIntegrationPoint, Why the optimization found little or nothing. Filled on every run, so an empty…, Input to the HPI optimization endpoint., heat_pump_integration_optimization(), Run data-driven heat pump integration optimization. (+35 more)

### Community 6 - "PotentialAnalysisPage.tsx"
Cohesion: 0.13
Nodes (28): generateReport(), runHPI(), runHPIOptimization(), runPinch(), runStatusQuo(), CompositeCurvesChart(), GrandCompositeCurveChart(), HeatPumpTable() (+20 more)

### Community 7 - "projectStore.ts"
Cohesion: 0.09
Nodes (30): Props, SortKey, StreamDataTable(), ActionBar(), BASE_OPTIONS, Props, Props, StreamCirclesOverlayProps (+22 more)

### Community 8 - "ReportRequest"
Cohesion: 0.10
Nodes (33): HeatPumpEntry, HPIOptimizationResult, Detailed summary of an available heat pump., BaseModel, Report request/response models., Stream data for report generation., Current energy demand entry., Subprocess data for the data-collection table. (+25 more)

### Community 9 - "models/analysis.py"
Cohesion: 0.12
Nodes (32): CompositeDiagramData, CopFormulaSpec, CopFormulaValidateResult, EnergyDemand, HPIntegrationResult, HPIRequest, HPIResult, PinchRequest (+24 more)

### Community 10 - "get_project"
Cohesion: 0.10
Nodes (35): ProcessNode, A node in the process hierarchy. Exactly mirrors create_process_node(). Level 0…, add_child(), add_group(), add_subprocess(), delete_child(), delete_group(), delete_subprocess() (+27 more)

### Community 12 - "react"
Cohesion: 0.11
Nodes (24): getExample(), App(), DataCollectionPage, PotentialAnalysisPage, EnergyDemands(), AppShell(), NAV_ITEMS, Props (+16 more)

### Community 13 - "analysisStore.ts"
Cohesion: 0.13
Nodes (25): validateCopFormula(), BUILTIN_FORMULAS, CopFormulaModal(), DEFAULT_COP_FORMULA, Props, ModeOption, AnalysisStore, CompositeDiagramData (+17 more)

### Community 14 - "io_routes.py"
Cohesion: 0.09
Nodes (24): verify_api_key(), health(), get, serve_frontend(), get_example(), get_process_models(), list_examples(), get (+16 more)

### Community 15 - "ProjectState"
Cohesion: 0.10
Nodes (27): GroupCoordinates, ProjectState, BaseModel, Project state model — exact mirror of save_app_state() / load_app_state() in…, Coordinates and metadata for a process group on the map., Complete project state. Matches save_app_state() output exactly. This is what…, create_project(), delete_project() (+19 more)

### Community 16 - "Qi"
Cohesion: 0.10
Nodes (5): _e(), fn, Qi, removeDataAttribute(), setDataAttribute()

### Community 17 - "trigger"
Cohesion: 0.16
Nodes (3): remove(), Sn, trigger()

### Community 19 - "frontend/package.json"
Cohesion: 0.09
Nodes (24): name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+16 more)

### Community 21 - "StreamModel"
Cohesion: 0.13
Nodes (19): BaseModel, Stream data model. Field names mirror the original Streamlit create_stream()…, Legacy property labels (prop1..prop4)., Legacy property values (val1..val4)., A single energy stream. Matches create_stream() output exactly. Both legacy…, StreamModel, StreamProperties, StreamType (+11 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 25 - "routers/analysis.py"
Cohesion: 0.14
Nodes (19): CopFormulaValidateRequest, Check a formula (and preview one value) without running the optimisation., generate_report(), get_map_preview(), heat_pump_integration(), pinch_analysis(), post, Analysis router — pinch, HPI, status quo, report endpoints. (+11 more)

### Community 26 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, husky, jsdom (+12 more)

### Community 27 - "MapViewer.tsx"
Cohesion: 0.12
Nodes (9): ScenarioComparison(), createDivIcon(), GroupCoords, MapViewer(), StreamCirclesOverlay(), streamColor(), TILE_URLS, leaflet (+1 more)

### Community 28 - "StreamSelector.tsx"
Cohesion: 0.16
Nodes (15): StreamSelector(), ALL_VARS, DEFAULT_VARS, Props, STREAM_TYPES, StreamEditor(), UNIT_OPTIONS, DEFAULT_STREAM (+7 more)

### Community 29 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 31 - "screenshotter/package.json"
Cohesion: 0.11
Nodes (15): puppeteer, author, dependencies, puppeteer, description, keywords, license, main (+7 more)

### Community 32 - "Pinch Analysis"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 33 - "clipboard.min.js"
Cohesion: 0.15
Nodes (9): d(), e(), h(), i(), m(), r(), v(), q() (+1 more)

### Community 34 - "Pinch Analysis"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 35 - "HeatTransPlan"
Cohesion: 0.12
Nodes (15): 1 — Clone the repository, 2 — Start the backend, 3 — Start the frontend (separate terminal), Backend, Environment Variables, Features, Frontend, Getting Started (+7 more)

### Community 36 - "english-stemmer.js"
Cohesion: 0.22
Nodes (8): r_R1(), r_R2(), r_shortv(), r_Step_1b(), r_Step_2(), r_Step_3(), r_Step_4(), r_Step_5()

### Community 37 - "pydata-sphinx-theme.js"
Cohesion: 0.20
Nodes (10): c(), e(), f(), g(), I(), L(), N(), p() (+2 more)

### Community 38 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, axios, html2canvas, i18next, leaflet, plotly.js, react, react-dom (+7 more)

### Community 40 - "searchtools.js"
Cohesion: 0.19
Nodes (6): _displayItem(), _displayNextItem(), _escapeHTML(), _finishSearch(), Search, SearchResultKind

### Community 41 - "Heat Pump Optimization — Predictive ML Model & Grid Search"
Cohesion: 0.14
Nodes (12): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Predictive ML Model & Refrigerant Alternatives, Refrigerant Data Schema (+4 more)

### Community 44 - "Heat Pump Integration — Classic Method"
Cohesion: 0.17
Nodes (11): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows, Integration Walk: Finding the Operating Point (+3 more)

### Community 45 - "Heat Pump Optimization — Predictive ML Model & Grid Search"
Cohesion: 0.17
Nodes (11): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Predictive ML Model & Refrigerant Alternatives, Refrigerant Data Schema (+3 more)

### Community 46 - "Heat Pump Integration — Classic Method"
Cohesion: 0.17
Nodes (11): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows, Integration Walk: Finding the Operating Point (+3 more)

### Community 47 - "useUIStore"
Cohesion: 0.30
Nodes (8): HPIOptimizationChart(), Props, HPIOptimizationPanel(), isSamePoint(), SortKey, UIStore, useUIStore, OptimizedIntegrationPoint

### Community 48 - "projectSchema.ts"
Cohesion: 0.17
Nodes (11): extraInfoSchema, groupCoordinatesSchema, processModelSelectionSchema, processNodeSchema, processParamsSchema, projectStateSchema, streamPropertiesSchema, streamSchema (+3 more)

### Community 49 - "export_cop_ranges.py"
Cohesion: 0.24
Nodes (10): build_ranges(), check_against_model(), main(), Path, Export the COP model's validity ranges to a small JSON file. The optimizer…, Warn if the ranges and the model disagree on the known categories. A…, Normalise the German dataset labels to the values the API returns., Aggregate the modelling frame into one entry per (stage, medium). (+2 more)

### Community 50 - "addCopyButtonToCodeCells"
Cohesion: 0.27
Nodes (8): addCopyButtonToCodeCells(), escapeRegExp(), formatCopyText(), clearSelection(), codeCellId(), messages, temporarilyChangeIcon(), temporarilyChangeTooltip()

### Community 51 - "geo_utils.py"
Cohesion: 0.24
Nodes (9): haversine_distance(), lonlat_to_tile_xy(), Geo utilities — extracted from data_collection.py. Web Mercator projection +…, Convert lon/lat to tile x/y at given zoom level., Convert tile x/y to lon/lat at given zoom level., Convert pixel coordinates (relative to image top-left) to lon/lat., Calculate the great circle distance in meters between two points., snapshot_pixel_to_lonlat() (+1 more)

### Community 53 - "process.py"
Cohesion: 0.28
Nodes (8): ExtraInfo, ProcessModelSelection, ProcessParams, BaseModel, Process node data model. Field names mirror the original Streamlit…, Extended process metadata., Category selection from process_models.json., Process parameters for thermal power calculation.

### Community 54 - "import_csv"
Cohesion: 0.25
Nodes (9): import_csv(), import_json(), import_json_body(), post, ProjectState, Import process data from CSV., Import a project state from a JSON file (same format as save_app_state()).…, Import a project state from JSON body (for example loading). Creates a new… (+1 more)

### Community 56 - "run_hpi"
Cohesion: 0.29
Nodes (7): HeatPumpOutOfRange, A named heat pump technology was asked for a duty outside its rating. Raised…, _exclusion_reason(), Run heat pump integration analysis. Wraps the existing HeatPumpIntegration…, Return a human-readable reason why a heat pump type cannot be integrated., run_hpi(), HPIResult

### Community 57 - "list_projects"
Cohesion: 0.29
Nodes (7): get_project(), list_projects(), get, List all project IDs and timestamps., Get full project state by ID., list_projects(), Return dict of project_id → timestamp for all projects.

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, prepare, preview, test

### Community 59 - "vite.config.ts"
Cohesion: 0.40
Nodes (3): apiProxy, vite, @vitejs/plugin-react

### Community 62 - "sphinx_highlight.js"
Cohesion: 0.67
Nodes (3): _highlight(), _highlightText(), SphinxHighlight

### Community 63 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 65 - "react-plotly.d.ts"
Cohesion: 0.50
Nodes (3): PlotProps, react-plotly.js, plotly.js

### Community 69 - "lint-staged"
Cohesion: 0.67
Nodes (3): lint-staged, *.{css,md,json}, *.{ts,tsx}

## Knowledge Gaps
- **245 isolated node(s):** `Props`, `Language`, `Props`, `State`, `Props` (+240 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 630 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `de()` connect `bootstrap.js` to `i18n.ts`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `react-i18next` connect `PotentialAnalysisPage.tsx` to `i18n.ts`, `projectStore.ts`, `react`, `analysisStore.ts`, `useUIStore`, `frontend/package.json`, `StreamSelector.tsx`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `654()` connect `654` to `bootstrap.js`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `654()` (e.g. with `dc()` and `hc()`) actually correct?**
  _`654()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Props`, `Language`, `Props` to the rest of the system?**
  _245 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `bootstrap.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06468797564687975 - nodes in this community are weakly interconnected._
- **Should `Pinch` be split into smaller, more focused modules?**
  _Cohesion score 0.05325140809011777 - nodes in this community are weakly interconnected._